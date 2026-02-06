/**
 * HeadOfficeOS - Multi-Role System Migration
 * Implements tier-based role system (10-100 scale) with additional functional roles.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 26/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

-- ============================================
-- Part 1: Migrate tier scale from 1-5 to 10-100
-- ============================================

-- Step 1: Remove existing constraint on users.tier
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;

-- Step 2: Convert existing tier values (1-5 to 10-100 scale)
-- 1 (Executive) → 100
-- 2 (Senior) → 70
-- 3 (Mid) → 50
-- 4 (Junior) → 30
-- 5 (Entry) → 20
UPDATE users SET tier =
  CASE tier
    WHEN 1 THEN 100
    WHEN 2 THEN 70
    WHEN 3 THEN 50
    WHEN 4 THEN 30
    WHEN 5 THEN 20
    ELSE tier
  END
WHERE tier IS NOT NULL;

-- Step 3: Add new constraint for 10-100 scale
ALTER TABLE users ADD CONSTRAINT users_tier_check
  CHECK (tier IS NULL OR (tier >= 10 AND tier <= 100));

-- Step 4: Update recruitment_requests.role_tier constraint if exists
ALTER TABLE recruitment_requests DROP CONSTRAINT IF EXISTS recruitment_requests_role_tier_check;

-- Convert existing recruitment request tier values
UPDATE recruitment_requests SET role_tier =
  CASE role_tier
    WHEN 1 THEN 100
    WHEN 2 THEN 70
    WHEN 3 THEN 50
    WHEN 4 THEN 30
    WHEN 5 THEN 20
    ELSE role_tier
  END
WHERE role_tier IS NOT NULL;

ALTER TABLE recruitment_requests ADD CONSTRAINT recruitment_requests_role_tier_check
  CHECK (role_tier IS NULL OR (role_tier >= 10 AND role_tier <= 100));

-- ============================================
-- Part 2: Create tier_definitions table
-- ============================================

CREATE TABLE IF NOT EXISTS tier_definitions (
  tier_level INTEGER PRIMARY KEY CHECK (tier_level >= 10 AND tier_level <= 100),
  tier_name VARCHAR(50) NOT NULL,
  description TEXT,
  can_manage_tier_below INTEGER CHECK (can_manage_tier_below IS NULL OR (can_manage_tier_below >= 10 AND can_manage_tier_below <= 100)),
  is_leadership BOOLEAN DEFAULT FALSE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_tier_definitions_tenant ON tier_definitions(tenant_id);

-- Insert standard tier definitions
INSERT INTO tier_definitions (tier_level, tier_name, description, can_manage_tier_below, is_leadership, tenant_id) VALUES
  (100, 'Chair/CEO', 'Top executive leadership with full organizational authority', 90, TRUE, 1),
  (90, 'Director', 'Senior leadership overseeing major organizational functions', 80, TRUE, 1),
  (80, 'Executive', 'Executive-level management with strategic responsibilities', 70, TRUE, 1),
  (70, 'Senior Manager', 'Senior management overseeing multiple teams or departments', 60, TRUE, 1),
  (60, 'Manager', 'Direct people management responsibilities', 50, FALSE, 1),
  (50, 'Team Lead', 'Team coordination without formal management authority', 40, FALSE, 1),
  (40, 'Senior Employee', 'Experienced individual contributor with mentorship role', 30, FALSE, 1),
  (30, 'Employee', 'Standard employee with full job responsibilities', 20, FALSE, 1),
  (20, 'Trainee', 'Employee in training or probationary period', NULL, FALSE, 1),
  (10, 'Contractor', 'External contractor with limited access', NULL, FALSE, 1)
ON CONFLICT (tier_level) DO UPDATE SET
  tier_name = EXCLUDED.tier_name,
  description = EXCLUDED.description,
  can_manage_tier_below = EXCLUDED.can_manage_tier_below,
  is_leadership = EXCLUDED.is_leadership;

-- ============================================
-- Part 3: Create additional_roles table
-- ============================================

CREATE TABLE IF NOT EXISTS additional_roles (
  id SERIAL PRIMARY KEY,
  role_code VARCHAR(50) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('hr', 'compliance', 'safety', 'finance', 'operations', 'regulatory')),
  permissions_json JSONB DEFAULT '[]'::JSONB,
  requires_tier_min INTEGER CHECK (requires_tier_min IS NULL OR (requires_tier_min >= 10 AND requires_tier_min <= 100)),
  is_active BOOLEAN DEFAULT TRUE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_code, tenant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_additional_roles_tenant ON additional_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_additional_roles_category ON additional_roles(category);
CREATE INDEX IF NOT EXISTS idx_additional_roles_active ON additional_roles(is_active);

-- Insert pre-populated additional roles
-- HR roles
INSERT INTO additional_roles (role_code, role_name, description, category, permissions_json, requires_tier_min, tenant_id) VALUES
  ('HR_MANAGER', 'HR Manager', 'Full HR management responsibilities including policy and personnel decisions', 'hr', '["hr.manage", "hr.view_all", "hr.edit_policies", "hr.approve_leave"]'::JSONB, 60, 1),
  ('HIRING_MANAGER', 'Hiring Manager', 'Leads recruitment for their department, interviews and makes hiring decisions', 'hr', '["recruitment.manage", "recruitment.interview", "recruitment.hire"]'::JSONB, 50, 1),
  ('TRAINING_ADMIN', 'Training Administrator', 'Manages training programs, certifications and learning resources', 'hr', '["training.manage", "training.assign", "training.report"]'::JSONB, 40, 1),
  ('WELLBEING_CHAMPION', 'Wellbeing Champion', 'Promotes employee wellbeing and mental health initiatives', 'hr', '["wellbeing.view", "wellbeing.report"]'::JSONB, 30, 1)
ON CONFLICT (role_code, tenant_id) DO NOTHING;

-- Compliance roles
INSERT INTO additional_roles (role_code, role_name, description, category, permissions_json, requires_tier_min, tenant_id) VALUES
  ('DPO', 'Data Protection Officer', 'Responsible for GDPR compliance and data protection policies', 'compliance', '["data.audit", "data.manage_requests", "data.view_all", "compliance.report"]'::JSONB, 60, 1),
  ('COMPLIANCE_OFFICER', 'Compliance Officer', 'Ensures organizational compliance with regulations and policies', 'compliance', '["compliance.audit", "compliance.report", "compliance.manage_policies"]'::JSONB, 60, 1),
  ('SAFEGUARDING_LEAD', 'Safeguarding Lead', 'Leads safeguarding policies and handles safeguarding concerns', 'compliance', '["safeguarding.manage", "safeguarding.report", "safeguarding.alert"]'::JSONB, 50, 1)
ON CONFLICT (role_code, tenant_id) DO NOTHING;

-- Safety roles
INSERT INTO additional_roles (role_code, role_name, description, category, permissions_json, requires_tier_min, tenant_id) VALUES
  ('HS_OFFICER', 'Health & Safety Officer', 'Responsible for workplace health and safety compliance', 'safety', '["safety.audit", "safety.manage", "safety.report", "safety.incident"]'::JSONB, 50, 1),
  ('FIRE_WARDEN', 'Fire Warden', 'Fire safety and evacuation responsibilities for designated area', 'safety', '["safety.fire_drill", "safety.evacuation"]'::JSONB, 30, 1),
  ('FIRST_AIDER', 'First Aider', 'Certified to provide first aid assistance', 'safety', '["safety.first_aid", "safety.incident_report"]'::JSONB, 30, 1)
ON CONFLICT (role_code, tenant_id) DO NOTHING;

-- Finance roles
INSERT INTO additional_roles (role_code, role_name, description, category, permissions_json, requires_tier_min, tenant_id) VALUES
  ('FINANCE_APPROVER', 'Finance Approver', 'Authority to approve expenses and financial transactions', 'finance', '["finance.approve", "finance.view_reports"]'::JSONB, 60, 1)
ON CONFLICT (role_code, tenant_id) DO NOTHING;

-- Operations roles
INSERT INTO additional_roles (role_code, role_name, description, category, permissions_json, requires_tier_min, tenant_id) VALUES
  ('ASSET_MANAGER', 'Asset Manager', 'Manages organizational assets and equipment inventory', 'operations', '["assets.manage", "assets.report", "assets.allocate"]'::JSONB, 40, 1),
  ('FLEET_MANAGER', 'Fleet Manager', 'Manages vehicle fleet and transportation logistics', 'operations', '["fleet.manage", "fleet.report", "fleet.allocate"]'::JSONB, 50, 1),
  ('ROTA_MANAGER', 'Rota Manager', 'Manages staff scheduling and shift assignments', 'operations', '["rota.manage", "rota.view_all", "rota.report"]'::JSONB, 40, 1)
ON CONFLICT (role_code, tenant_id) DO NOTHING;

-- Regulatory roles (UK Care sector specific)
INSERT INTO additional_roles (role_code, role_name, description, category, permissions_json, requires_tier_min, tenant_id) VALUES
  ('CQC_REGISTERED_MANAGER', 'CQC Registered Manager', 'Registered manager with the Care Quality Commission', 'regulatory', '["cqc.manage", "cqc.report", "compliance.full_access"]'::JSONB, 60, 1),
  ('CQC_NOMINATED_INDIVIDUAL', 'CQC Nominated Individual', 'Nominated individual responsible for CQC compliance', 'regulatory', '["cqc.oversee", "cqc.report", "compliance.full_access"]'::JSONB, 70, 1)
ON CONFLICT (role_code, tenant_id) DO NOTHING;

-- ============================================
-- Part 4: Create user_additional_roles table
-- ============================================

CREATE TABLE IF NOT EXISTS user_additional_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  additional_role_id INTEGER NOT NULL REFERENCES additional_roles(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  notes TEXT,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(user_id, additional_role_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_additional_roles_user ON user_additional_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_additional_roles_role ON user_additional_roles(additional_role_id);
CREATE INDEX IF NOT EXISTS idx_user_additional_roles_tenant ON user_additional_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_additional_roles_expires ON user_additional_roles(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- Part 5: Helper functions
-- ============================================

-- Function: Get combined permissions for a user (from both role and additional roles)
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_permissions JSONB := '[]'::JSONB;
  v_role_permissions JSONB;
  v_additional_permissions JSONB;
BEGIN
  -- Get base role permissions
  SELECT COALESCE(r.permissions_json, '[]'::JSONB)
  INTO v_role_permissions
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = p_user_id;

  -- Get additional role permissions (only active, non-expired)
  SELECT COALESCE(jsonb_agg(DISTINCT perm), '[]'::JSONB)
  INTO v_additional_permissions
  FROM user_additional_roles uar
  JOIN additional_roles ar ON uar.additional_role_id = ar.id
  CROSS JOIN LATERAL jsonb_array_elements_text(ar.permissions_json) AS perm
  WHERE uar.user_id = p_user_id
    AND ar.is_active = TRUE
    AND (uar.expires_at IS NULL OR uar.expires_at > CURRENT_TIMESTAMP);

  -- Combine and deduplicate permissions
  SELECT COALESCE(jsonb_agg(DISTINCT perm), '[]'::JSONB)
  INTO v_permissions
  FROM (
    SELECT jsonb_array_elements_text(v_role_permissions) AS perm
    UNION
    SELECT jsonb_array_elements_text(v_additional_permissions) AS perm
  ) combined;

  RETURN v_permissions;
END;
$$;

-- Function: Check if user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id INTEGER, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT p_permission = ANY(
    SELECT jsonb_array_elements_text(get_user_permissions(p_user_id))
  )
  INTO v_has_permission;

  RETURN COALESCE(v_has_permission, FALSE);
END;
$$;

-- Function: Get user's additional role codes
CREATE OR REPLACE FUNCTION get_user_additional_roles(p_user_id INTEGER)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_roles TEXT[];
BEGIN
  SELECT ARRAY_AGG(ar.role_code)
  INTO v_roles
  FROM user_additional_roles uar
  JOIN additional_roles ar ON uar.additional_role_id = ar.id
  WHERE uar.user_id = p_user_id
    AND ar.is_active = TRUE
    AND (uar.expires_at IS NULL OR uar.expires_at > CURRENT_TIMESTAMP);

  RETURN COALESCE(v_roles, ARRAY[]::TEXT[]);
END;
$$;

-- ============================================
-- Part 6: Audit trigger for user_additional_roles
-- ============================================

CREATE OR REPLACE FUNCTION audit_user_additional_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_name TEXT;
  v_role_name TEXT;
  v_assigned_by_name TEXT;
BEGIN
  -- Get user name
  SELECT full_name INTO v_user_name FROM users WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  -- Get role name
  SELECT role_name INTO v_role_name FROM additional_roles WHERE id = COALESCE(NEW.additional_role_id, OLD.additional_role_id);

  IF TG_OP = 'INSERT' THEN
    -- Get assigned by name
    SELECT full_name INTO v_assigned_by_name FROM users WHERE id = NEW.assigned_by;

    INSERT INTO audit_log (tenant_id, user_id, action, resource_type, resource_id, resource_name, changes, ip_address, created_at)
    VALUES (
      NEW.tenant_id,
      NEW.assigned_by,
      'ADDITIONAL_ROLE_ASSIGNED',
      'user_additional_roles',
      NEW.id,
      v_user_name || ' - ' || v_role_name,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'user_name', v_user_name,
        'role_code', v_role_name,
        'assigned_by', v_assigned_by_name,
        'expires_at', NEW.expires_at,
        'notes', NEW.notes
      ),
      NULL,
      CURRENT_TIMESTAMP
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (tenant_id, user_id, action, resource_type, resource_id, resource_name, changes, ip_address, created_at)
    VALUES (
      OLD.tenant_id,
      NULL, -- We don't know who removed it in DELETE trigger
      'ADDITIONAL_ROLE_REMOVED',
      'user_additional_roles',
      OLD.id,
      v_user_name || ' - ' || v_role_name,
      jsonb_build_object(
        'user_id', OLD.user_id,
        'user_name', v_user_name,
        'role_code', v_role_name,
        'was_assigned_at', OLD.assigned_at
      ),
      NULL,
      CURRENT_TIMESTAMP
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_audit_user_additional_roles ON user_additional_roles;
CREATE TRIGGER trg_audit_user_additional_roles
  AFTER INSERT OR DELETE ON user_additional_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_additional_roles();

-- ============================================
-- Part 7: Update trigger for timestamps
-- ============================================

-- Update timestamp trigger for tier_definitions
CREATE OR REPLACE FUNCTION update_tier_definitions_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tier_definitions_timestamp ON tier_definitions;
CREATE TRIGGER trg_tier_definitions_timestamp
  BEFORE UPDATE ON tier_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_tier_definitions_timestamp();

-- Update timestamp trigger for additional_roles
CREATE OR REPLACE FUNCTION update_additional_roles_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_additional_roles_timestamp ON additional_roles;
CREATE TRIGGER trg_additional_roles_timestamp
  BEFORE UPDATE ON additional_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_additional_roles_timestamp();

-- ============================================
-- Done
-- ============================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 019_multi_role_system.sql completed successfully';
  RAISE NOTICE 'Tier scale migrated from 1-5 to 10-100';
  RAISE NOTICE 'Created tier_definitions table with 10 standard tiers';
  RAISE NOTICE 'Created additional_roles table with 16 pre-populated roles';
  RAISE NOTICE 'Created user_additional_roles table for role assignments';
  RAISE NOTICE 'Created helper functions: get_user_permissions, user_has_permission, get_user_additional_roles';
  RAISE NOTICE 'Created audit trigger for user_additional_roles';
END;
$$;
