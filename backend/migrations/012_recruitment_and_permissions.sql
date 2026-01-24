-- Migration: 012_recruitment_and_permissions.sql
-- Description: Recruitment requests workflow and role-based onboarding permissions

-- ============================================
-- ROLE PERMISSIONS FOR ONBOARDING
-- ============================================

-- Add onboarding permission columns to roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS onboarding_full BOOLEAN DEFAULT false;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS onboarding_post_checks BOOLEAN DEFAULT false;

-- Update existing roles with appropriate permissions
UPDATE roles SET onboarding_full = true WHERE role_name = 'Admin';

-- Create HR Manager role if not exists
INSERT INTO roles (role_name, permissions_json, onboarding_full, onboarding_post_checks)
VALUES ('HR Manager', '{"hr": true, "onboarding": "full"}', true, false)
ON CONFLICT (role_name) DO UPDATE SET onboarding_full = true;

-- Create Hiring Manager role if not exists (or it could be a tag on Manager role)
-- For now, we'll add the permission to the Manager role
UPDATE roles SET onboarding_post_checks = true WHERE role_name = 'Manager';

-- ============================================
-- RECRUITMENT REQUESTS TABLE
-- ============================================

CREATE TABLE recruitment_requests (
  id SERIAL PRIMARY KEY,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  approver_id INTEGER REFERENCES users(id), -- Their line manager

  -- Role details
  role_title VARCHAR(255) NOT NULL,
  role_tier INTEGER CHECK (role_tier IS NULL OR (role_tier >= 1 AND role_tier <= 5)),
  department VARCHAR(100),
  role_description TEXT,
  justification TEXT NOT NULL, -- Why do we need this role?

  -- Salary and terms
  proposed_salary_min DECIMAL(10, 2),
  proposed_salary_max DECIMAL(10, 2),
  proposed_hours VARCHAR(50) DEFAULT 'full-time', -- full-time, part-time, contract
  proposed_start_date DATE,

  -- Status tracking
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'filled', 'cancelled')),
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by INTEGER REFERENCES users(id),
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add recruitment_request_id to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruitment_request_id INTEGER REFERENCES recruitment_requests(id);

-- Indexes
CREATE INDEX idx_recruitment_requested_by ON recruitment_requests(requested_by);
CREATE INDEX idx_recruitment_approver ON recruitment_requests(approver_id);
CREATE INDEX idx_recruitment_status ON recruitment_requests(status);
CREATE INDEX idx_candidates_recruitment_req ON candidates(recruitment_request_id);

-- Comments
COMMENT ON TABLE recruitment_requests IS 'Workflow for requesting and approving new hires';
COMMENT ON COLUMN recruitment_requests.justification IS 'Required explanation for why this role is needed';
COMMENT ON COLUMN recruitment_requests.status IS 'draft -> pending_approval -> approved/rejected -> filled/cancelled';
COMMENT ON COLUMN roles.onboarding_full IS 'HR permission: full access to all candidates including contact details';
COMMENT ON COLUMN roles.onboarding_post_checks IS 'Hiring Manager permission: can only see candidates after all required checks cleared';
