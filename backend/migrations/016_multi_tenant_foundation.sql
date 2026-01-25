-- VoidStaffOS - Multi-Tenant Foundation
-- Migration: 016_multi_tenant_foundation.sql
--
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Created: 24/01/2026
--
-- PROPRIETARY AND CONFIDENTIAL

-- =============================================
-- TENANTS TABLE
-- =============================================

CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(63) UNIQUE NOT NULL,
  domain VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'standard',
  enabled_modules JSONB DEFAULT '["core"]',
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create default tenant for existing data
INSERT INTO tenants (name, subdomain) VALUES ('Default Organisation', 'default');

-- =============================================
-- ADD tenant_id TO ALL EXISTING TABLES
-- =============================================

-- Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE reviews SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE reviews ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_tenant ON reviews(tenant_id);

-- Review Snapshots (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'review_snapshots') THEN
    ALTER TABLE review_snapshots ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    UPDATE review_snapshots SET tenant_id = 1 WHERE tenant_id IS NULL;
    ALTER TABLE review_snapshots ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_review_snapshots_tenant ON review_snapshots(tenant_id);
  END IF;
END $$;

-- Leave Requests
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE leave_requests SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE leave_requests ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id);

-- Candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE candidates SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE candidates ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_tenant ON candidates(tenant_id);

-- Candidate References
ALTER TABLE candidate_references ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE candidate_references SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE candidate_references ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidate_references_tenant ON candidate_references(tenant_id);

-- Candidate Interviews
ALTER TABLE candidate_interviews ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE candidate_interviews SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE candidate_interviews ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidate_interviews_tenant ON candidate_interviews(tenant_id);

-- Candidate Notes
ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE candidate_notes SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE candidate_notes ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidate_notes_tenant ON candidate_notes(tenant_id);

-- Background Checks
ALTER TABLE background_checks ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE background_checks SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE background_checks ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_background_checks_tenant ON background_checks(tenant_id);

-- Recruitment Requests
ALTER TABLE recruitment_requests ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE recruitment_requests SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE recruitment_requests ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recruitment_requests_tenant ON recruitment_requests(tenant_id);

-- Policies (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'policies') THEN
    ALTER TABLE policies ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    UPDATE policies SET tenant_id = 1 WHERE tenant_id IS NULL;
    ALTER TABLE policies ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_policies_tenant ON policies(tenant_id);
  END IF;
END $$;

-- Policy Acknowledgments (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'policy_acknowledgments') THEN
    ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    UPDATE policy_acknowledgments SET tenant_id = 1 WHERE tenant_id IS NULL;
    ALTER TABLE policy_acknowledgments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_policy_acknowledgments_tenant ON policy_acknowledgments(tenant_id);
  END IF;
END $$;

-- Onboarding Tasks
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE onboarding_tasks SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE onboarding_tasks ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_tenant ON onboarding_tasks(tenant_id);

-- Notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE notifications SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE notifications ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

-- Feedback Requests
ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE feedback_requests SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE feedback_requests ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_requests_tenant ON feedback_requests(tenant_id);

-- Feedback Cycles
ALTER TABLE feedback_cycles ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE feedback_cycles SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE feedback_cycles ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_cycles_tenant ON feedback_cycles(tenant_id);

-- Quarterly Feedback
ALTER TABLE quarterly_feedback ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE quarterly_feedback SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE quarterly_feedback ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quarterly_feedback_tenant ON quarterly_feedback(tenant_id);

-- Quarterly Composites
ALTER TABLE quarterly_composites ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE quarterly_composites SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE quarterly_composites ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quarterly_composites_tenant ON quarterly_composites(tenant_id);

-- Audit Log (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    UPDATE audit_log SET tenant_id = 1 WHERE tenant_id IS NULL;
    -- Note: Not setting NOT NULL on audit_log as some entries may be system-wide
    CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
  END IF;
END $$;

-- Roles table (shared across tenants but tenant-scoped assignments possible)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
UPDATE roles SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

-- =============================================
-- UPDATE UNIQUE CONSTRAINTS TO BE TENANT-SCOPED
-- =============================================

-- Users email should be unique within tenant
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ADD CONSTRAINT users_email_tenant_unique UNIQUE (tenant_id, email);

-- Employee number should be unique within tenant
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_number_key;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'employee_number') THEN
    ALTER TABLE users ADD CONSTRAINT users_employee_number_tenant_unique UNIQUE (tenant_id, employee_number);
  END IF;
END $$;

-- Feedback cycles quarter should be unique within tenant
ALTER TABLE feedback_cycles DROP CONSTRAINT IF EXISTS feedback_cycles_quarter_key;
ALTER TABLE feedback_cycles ADD CONSTRAINT feedback_cycles_quarter_tenant_unique UNIQUE (tenant_id, quarter);

-- =============================================
-- TENANT UPDATED_AT TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_tenant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_timestamp
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_timestamp();
