/**
 * HeadOfficeOS - Migration 023: PolicyOS
 * Policy management with legally compliant acknowledgment tracking.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: PolicyOS
 */

-- ===========================================
-- POLICY CATEGORIES ENUM
-- ===========================================

CREATE TYPE policy_category AS ENUM (
    'HR',
    'Health & Safety',
    'Safeguarding',
    'Compliance',
    'IT',
    'Operational'
);

CREATE TYPE policy_status AS ENUM (
    'draft',
    'published',
    'archived'
);

CREATE TYPE acknowledgment_frequency AS ENUM (
    'once',
    'annual',
    'biannual',
    'quarterly'
);

CREATE TYPE policy_assignment_type AS ENUM (
    'all',          -- All employees
    'role',         -- Specific role
    'tier_min',     -- Minimum tier level
    'tier_max',     -- Maximum tier level
    'department',   -- Specific department
    'individual'    -- Specific user
);

-- ===========================================
-- POLICIES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),

    -- Policy content
    title VARCHAR(255) NOT NULL,
    category policy_category NOT NULL,
    content TEXT NOT NULL,
    summary TEXT, -- Brief description for listings

    -- Version control
    version INTEGER NOT NULL DEFAULT 1,
    version_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of content for legal proof

    -- Status
    status policy_status NOT NULL DEFAULT 'draft',

    -- Acknowledgment requirements
    requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
    acknowledgment_frequency acknowledgment_frequency DEFAULT 'once',
    acknowledgment_deadline_days INTEGER, -- Days from publish/assignment to acknowledge

    -- PDF attachment
    pdf_filename VARCHAR(255),           -- UUID filename on disk
    pdf_original_name VARCHAR(255),      -- Original upload filename
    pdf_size INTEGER,                    -- File size in bytes
    pdf_uploaded_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_by INTEGER NOT NULL REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    published_by INTEGER REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT policies_version_positive CHECK (version > 0),
    CONSTRAINT policies_hash_format CHECK (version_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT policies_pdf_size_limit CHECK (pdf_size IS NULL OR pdf_size <= 10485760)
);

-- ===========================================
-- POLICY ASSIGNMENTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS policy_assignments (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,

    -- Assignment type and value
    assignment_type policy_assignment_type NOT NULL,
    assignment_value VARCHAR(255), -- Role name, tier number, department, user ID, or NULL for 'all'

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint to prevent duplicate assignments
    CONSTRAINT unique_policy_assignment UNIQUE (policy_id, assignment_type, assignment_value)
);

-- ===========================================
-- POLICY ACKNOWLEDGMENTS TABLE (IMMUTABLE)
-- Legal proof that employee acknowledged policy
-- ===========================================

CREATE TABLE IF NOT EXISTS policy_acknowledgments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),

    -- Policy reference (versioned)
    policy_id INTEGER NOT NULL REFERENCES policies(id),
    policy_version INTEGER NOT NULL,
    version_hash VARCHAR(64) NOT NULL, -- Captured at time of acknowledgment

    -- User who acknowledged
    user_id INTEGER NOT NULL REFERENCES users(id),

    -- Acknowledgment timestamp
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Legal compliance proof
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,

    -- Proof they read the document
    scroll_completed BOOLEAN NOT NULL DEFAULT false,
    time_spent_seconds INTEGER, -- How long they had the document open
    pdf_pages_viewed INTEGER, -- Number of PDF pages viewed (if PDF policy)
    pdf_total_pages INTEGER, -- Total pages in PDF at acknowledgment time

    -- Proof of explicit consent
    checkbox_confirmed BOOLEAN NOT NULL DEFAULT false,
    typed_name VARCHAR(255) NOT NULL, -- User types their name as signature

    -- Constraints
    CONSTRAINT ack_hash_format CHECK (version_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT ack_requires_checkbox CHECK (checkbox_confirmed = true),
    CONSTRAINT ack_requires_typed_name CHECK (typed_name IS NOT NULL AND length(trim(typed_name)) > 0)
);

-- ===========================================
-- POLICY VERSION HISTORY TABLE
-- Keeps track of all policy versions
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

    -- PDF snapshot
    pdf_filename VARCHAR(255),
    pdf_original_name VARCHAR(255),

    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT unique_policy_version UNIQUE (policy_id, version)
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Policies indexes
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);
CREATE INDEX IF NOT EXISTS idx_policies_created_by ON policies(created_by);
CREATE INDEX IF NOT EXISTS idx_policies_tenant_status ON policies(tenant_id, status);

-- Policy assignments indexes
CREATE INDEX IF NOT EXISTS idx_policy_assignments_policy ON policy_assignments(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_type ON policy_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_type_value ON policy_assignments(assignment_type, assignment_value);

-- Policy acknowledgments indexes
CREATE INDEX IF NOT EXISTS idx_policy_ack_tenant ON policy_acknowledgments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_policy ON policy_acknowledgments(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_user ON policy_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_policy_user ON policy_acknowledgments(policy_id, user_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_hash ON policy_acknowledgments(version_hash);
CREATE INDEX IF NOT EXISTS idx_policy_ack_date ON policy_acknowledgments(acknowledged_at DESC);

-- Policy versions indexes
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id);

-- ===========================================
-- IMMUTABILITY PROTECTION FOR ACKNOWLEDGMENTS
-- Acknowledgment records must be tamper-proof
-- ===========================================

-- Trigger function to prevent modification of acknowledgment records
CREATE OR REPLACE FUNCTION prevent_acknowledgment_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Policy acknowledgment records cannot be modified or deleted. This is a legal compliance requirement.';
END;
$$ LANGUAGE plpgsql;

-- Trigger to block UPDATE operations
CREATE TRIGGER policy_ack_no_update
BEFORE UPDATE ON policy_acknowledgments
FOR EACH ROW EXECUTE FUNCTION prevent_acknowledgment_modification();

-- Trigger to block DELETE operations
CREATE TRIGGER policy_ack_no_delete
BEFORE DELETE ON policy_acknowledgments
FOR EACH ROW EXECUTE FUNCTION prevent_acknowledgment_modification();

-- ===========================================
-- VERSION HASH TRIGGER
-- Auto-generates SHA-256 hash when content changes
-- ===========================================

CREATE OR REPLACE FUNCTION update_policy_version_hash()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate SHA-256 hash of content + title for legal proof
  NEW.version_hash := encode(sha256((NEW.title || '::' || NEW.content)::bytea), 'hex');

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
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

-- Policies visible to same tenant
CREATE POLICY policies_tenant_isolation ON policies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- Acknowledgments visible to same tenant
CREATE POLICY policy_ack_tenant_isolation ON policy_acknowledgments
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE policies IS 'Policy documents with version control and acknowledgment tracking';
COMMENT ON TABLE policy_assignments IS 'Defines which employees must acknowledge each policy';
COMMENT ON TABLE policy_acknowledgments IS 'Immutable record of policy acknowledgments for legal compliance';
COMMENT ON TABLE policy_versions IS 'Historical archive of all policy versions';

COMMENT ON COLUMN policies.version_hash IS 'SHA-256 hash of title+content for legal proof of exact document version';
COMMENT ON COLUMN policies.acknowledgment_frequency IS 'How often employees must re-acknowledge the policy';
COMMENT ON COLUMN policies.acknowledgment_deadline_days IS 'Days allowed to acknowledge after policy is assigned/published';

COMMENT ON COLUMN policy_acknowledgments.scroll_completed IS 'Proof user scrolled to end of document';
COMMENT ON COLUMN policy_acknowledgments.checkbox_confirmed IS 'Proof user explicitly checked acknowledgment checkbox';
COMMENT ON COLUMN policy_acknowledgments.typed_name IS 'Typed signature - user types their full name';
COMMENT ON COLUMN policy_acknowledgments.version_hash IS 'Hash captured at acknowledgment time - proves exact version acknowledged';

COMMENT ON FUNCTION prevent_acknowledgment_modification IS 'Security function ensuring policy acknowledgment immutability';
COMMENT ON FUNCTION update_policy_version_hash IS 'Automatically generates SHA-256 hash and manages version history';
