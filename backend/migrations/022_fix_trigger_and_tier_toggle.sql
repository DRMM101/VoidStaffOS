-- Fix audit trigger to match actual audit_logs columns
-- Add is_active to tier_definitions for toggle feature

-- 1. Fix the audit trigger
CREATE OR REPLACE FUNCTION audit_user_additional_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_name TEXT;
  v_role_name TEXT;
  v_assigned_by_name TEXT;
BEGIN
  SELECT full_name INTO v_user_name FROM users WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  SELECT role_name INTO v_role_name FROM additional_roles WHERE id = COALESCE(NEW.additional_role_id, OLD.additional_role_id);

  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO v_assigned_by_name FROM users WHERE id = NEW.assigned_by;
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, created_at)
    VALUES (
      NEW.tenant_id,
      NEW.assigned_by,
      'ADDITIONAL_ROLE_ASSIGNED',
      'user_additional_roles',
      NEW.id,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'user_name', v_user_name,
        'role_code', v_role_name,
        'assigned_by', v_assigned_by_name,
        'expires_at', NEW.expires_at,
        'notes', NEW.notes
      ),
      CURRENT_TIMESTAMP
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, created_at)
    VALUES (
      OLD.tenant_id,
      NULL,
      'ADDITIONAL_ROLE_REMOVED',
      'user_additional_roles',
      OLD.id,
      jsonb_build_object(
        'user_id', OLD.user_id,
        'user_name', v_user_name,
        'role_code', v_role_name,
        'was_assigned_at', OLD.assigned_at
      ),
      CURRENT_TIMESTAMP
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 2. Add is_active column to tier_definitions if not exists
ALTER TABLE tier_definitions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Set core tiers (10, 20, 30) as always active (can't be disabled)
-- These will be handled in application logic

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Fixed audit trigger and added is_active to tier_definitions';
END;
$$;
