/**
 * HeadOfficeOS - Migration 023b: PolicyOS Upgrade
 * Upgrades existing policies schema to new PolicyOS structure.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 */

-- Drop existing triggers first (they reference old schema)
DROP TRIGGER IF EXISTS policy_version_hash_trigger ON policies;
DROP FUNCTION IF EXISTS update_policy_version_hash() CASCADE;

-- Drop existing RLS policies
DROP POLICY IF EXISTS policies_tenant_isolation ON policies;
DROP POLICY IF EXISTS policy_ack_tenant_isolation ON policy_acknowledgments;

-- Disable RLS temporarily
ALTER TABLE policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE policy_acknowledgments DISABLE ROW LEVEL SECURITY;

-- ===========================================
-- CREATE TYPES IF NOT EXIST
-- ===========================================

DO $$ BEGIN
    CREATE TYPE policy_category AS ENUM ('HR', 'Health & Safety', 'Safeguarding', 'Compliance', 'IT', 'Operational');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE policy_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE acknowledgment_frequency AS ENUM ('once', 'annual', 'biannual', 'quarterly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE policy_assignment_type AS ENUM ('all', 'role', 'tier_min', 'tier_max', 'department', 'individual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- UPGRADE POLICIES TABLE
-- ===========================================

-- Rename old columns for migration
ALTER TABLE policies RENAME COLUMN policy_name TO title;
ALTER TABLE policies RENAME COLUMN policy_version TO version_old;
ALTER TABLE policies RENAME COLUMN policy_content TO content;

-- Drop old columns we don't need
ALTER TABLE policies DROP COLUMN IF EXISTS policy_link;
ALTER TABLE policies DROP COLUMN IF EXISTS effective_date;
ALTER TABLE policies DROP COLUMN IF EXISTS is_active;

-- Add new columns
ALTER TABLE policies ADD COLUMN IF NOT EXISTS category policy_category DEFAULT 'HR';
ALTER TABLE policies ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS version_hash VARCHAR(64);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS status policy_status DEFAULT 'published';
ALTER TABLE policies ADD COLUMN IF NOT EXISTS acknowledgment_frequency acknowledgment_frequency DEFAULT 'once';
ALTER TABLE policies ADD COLUMN IF NOT EXISTS acknowledgment_deadline_days INTEGER;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS published_by INTEGER REFERENCES users(id);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS pdf_original_name VARCHAR(255);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS pdf_size INTEGER;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS pdf_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Set default created_by to first admin user
UPDATE policies SET created_by = (SELECT id FROM users WHERE role_id = 1 LIMIT 1) WHERE created_by IS NULL;

-- Set published_at for existing policies
UPDATE policies SET published_at = created_at WHERE published_at IS NULL;

-- Generate version hashes for existing policies
UPDATE policies SET version_hash = encode(sha256((title || '::' || COALESCE(content, ''))::bytea), 'hex') WHERE version_hash IS NULL;

-- Drop old version column
ALTER TABLE policies DROP COLUMN IF EXISTS version_old;

-- Add constraints
ALTER TABLE policies ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE policies ADD CONSTRAINT policies_version_positive CHECK (version > 0);
ALTER TABLE policies ADD CONSTRAINT policies_hash_format CHECK (version_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE policies ADD CONSTRAINT policies_pdf_size_limit CHECK (pdf_size IS NULL OR pdf_size <= 10485760);

-- ===========================================
-- UPGRADE POLICY_ACKNOWLEDGMENTS TABLE
-- ===========================================

-- Add new columns
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS policy_version INTEGER DEFAULT 1;
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS version_hash VARCHAR(64);
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS scroll_completed BOOLEAN DEFAULT true;
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS checkbox_confirmed BOOLEAN DEFAULT true;
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS typed_name VARCHAR(255);
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS pdf_pages_viewed INTEGER;
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS pdf_total_pages INTEGER;

-- Update existing acknowledgments with placeholder data
UPDATE policy_acknowledgments SET
    version_hash = (SELECT version_hash FROM policies WHERE policies.id = policy_acknowledgments.policy_id),
    ip_address = '0.0.0.0'::inet,
    user_agent = 'Migrated from legacy system',
    typed_name = (SELECT full_name FROM users WHERE users.id = policy_acknowledgments.user_id)
WHERE version_hash IS NULL;

-- Add constraints (allow existing NULL values from migration)
ALTER TABLE policy_acknowledgments ADD CONSTRAINT ack_hash_format CHECK (version_hash IS NULL OR version_hash ~ '^[a-f0-9]{64}$');

-- ===========================================
-- CREATE/UPDATE POLICY_VERSIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS policy_versions (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    version_hash VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category policy_category NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    pdf_filename VARCHAR(255),
    pdf_original_name VARCHAR(255),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_policy_version UNIQUE (policy_id, version)
);

-- ===========================================
-- CREATE INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);
CREATE INDEX IF NOT EXISTS idx_policies_created_by ON policies(created_by);
CREATE INDEX IF NOT EXISTS idx_policies_tenant_status ON policies(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_policy_ack_tenant ON policy_acknowledgments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_policy ON policy_acknowledgments(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_user ON policy_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_policy_user ON policy_acknowledgments(policy_id, user_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_hash ON policy_acknowledgments(version_hash);
CREATE INDEX IF NOT EXISTS idx_policy_ack_date ON policy_acknowledgments(acknowledged_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id);

-- ===========================================
-- RECREATE TRIGGERS AND FUNCTIONS
-- ===========================================

-- Trigger function to prevent modification of acknowledgment records
CREATE OR REPLACE FUNCTION prevent_acknowledgment_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Policy acknowledgment records cannot be modified or deleted. This is a legal compliance requirement.';
END;
$$ LANGUAGE plpgsql;

-- Only create triggers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'policy_ack_no_update') THEN
        CREATE TRIGGER policy_ack_no_update
        BEFORE UPDATE ON policy_acknowledgments
        FOR EACH ROW EXECUTE FUNCTION prevent_acknowledgment_modification();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'policy_ack_no_delete') THEN
        CREATE TRIGGER policy_ack_no_delete
        BEFORE DELETE ON policy_acknowledgments
        FOR EACH ROW EXECUTE FUNCTION prevent_acknowledgment_modification();
    END IF;
END $$;

-- Version hash trigger
CREATE OR REPLACE FUNCTION update_policy_version_hash()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate SHA-256 hash of content + title for legal proof
  NEW.version_hash := encode(sha256((NEW.title || '::' || COALESCE(NEW.content, ''))::bytea), 'hex');

  -- Increment version if content changed on existing record
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := NOW();

    -- Archive the previous version
    INSERT INTO policy_versions (policy_id, version, version_hash, title, category, content, summary, pdf_filename, pdf_original_name, created_by)
    VALUES (OLD.id, OLD.version, OLD.version_hash, OLD.title, OLD.category, OLD.content, OLD.summary, OLD.pdf_filename, OLD.pdf_original_name, OLD.created_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policy_version_hash_trigger
BEFORE INSERT OR UPDATE ON policies
FOR EACH ROW EXECUTE FUNCTION update_policy_version_hash();

-- ===========================================
-- RE-ENABLE ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY policies_tenant_isolation ON policies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY policy_ack_tenant_isolation ON policy_acknowledgments
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE policies IS 'Policy documents with version control and acknowledgment tracking';
COMMENT ON TABLE policy_acknowledgments IS 'Immutable record of policy acknowledgments for legal compliance';
COMMENT ON TABLE policy_versions IS 'Historical archive of all policy versions';
