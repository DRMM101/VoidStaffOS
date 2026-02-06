/**
 * HeadOfficeOS - Row Level Security Migration
 * Implements PostgreSQL RLS for tenant data isolation.
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
-- Part 1: Context functions
-- ============================================

-- Function: Set tenant context for current session
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, FALSE);
END;
$$;

-- Function: Get current tenant from session
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  v_tenant_id := current_setting('app.current_tenant_id', TRUE);
  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_tenant_id::INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Function: Set both tenant and user context for RLS + audit
CREATE OR REPLACE FUNCTION set_session_context(p_tenant_id INTEGER, p_user_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, FALSE);
  PERFORM set_config('app.current_user_id', p_user_id::TEXT, FALSE);
END;
$$;

-- Function: Get current user from session
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  v_user_id := current_setting('app.current_user_id', TRUE);
  IF v_user_id IS NULL OR v_user_id = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_user_id::INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Function: Clear session context
CREATE OR REPLACE FUNCTION clear_session_context()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', '', FALSE);
  PERFORM set_config('app.current_user_id', '', FALSE);
END;
$$;

-- ============================================
-- Part 2: Enable RLS on tables
-- ============================================

-- Users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_tenant_isolation ON roles;
CREATE POLICY roles_tenant_isolation ON roles
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reviews_tenant_isolation ON reviews;
CREATE POLICY reviews_tenant_isolation ON reviews
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Leave requests table
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leave_requests_tenant_isolation ON leave_requests;
CREATE POLICY leave_requests_tenant_isolation ON leave_requests
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Candidates table
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS candidates_tenant_isolation ON candidates;
CREATE POLICY candidates_tenant_isolation ON candidates
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Candidate references table
ALTER TABLE candidate_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS candidate_references_tenant_isolation ON candidate_references;
CREATE POLICY candidate_references_tenant_isolation ON candidate_references
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Candidate interviews table
ALTER TABLE candidate_interviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS candidate_interviews_tenant_isolation ON candidate_interviews;
CREATE POLICY candidate_interviews_tenant_isolation ON candidate_interviews
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Candidate notes table
ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS candidate_notes_tenant_isolation ON candidate_notes;
CREATE POLICY candidate_notes_tenant_isolation ON candidate_notes
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Background checks table
ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS background_checks_tenant_isolation ON background_checks;
CREATE POLICY background_checks_tenant_isolation ON background_checks
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Recruitment requests table
ALTER TABLE recruitment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recruitment_requests_tenant_isolation ON recruitment_requests;
CREATE POLICY recruitment_requests_tenant_isolation ON recruitment_requests
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Onboarding tasks table
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_tasks_tenant_isolation ON onboarding_tasks;
CREATE POLICY onboarding_tasks_tenant_isolation ON onboarding_tasks
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
CREATE POLICY notifications_tenant_isolation ON notifications
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Feedback requests table
ALTER TABLE feedback_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feedback_requests_tenant_isolation ON feedback_requests;
CREATE POLICY feedback_requests_tenant_isolation ON feedback_requests
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Feedback cycles table
ALTER TABLE feedback_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feedback_cycles_tenant_isolation ON feedback_cycles;
CREATE POLICY feedback_cycles_tenant_isolation ON feedback_cycles
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Quarterly feedback table
ALTER TABLE quarterly_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quarterly_feedback_tenant_isolation ON quarterly_feedback;
CREATE POLICY quarterly_feedback_tenant_isolation ON quarterly_feedback
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Quarterly composites table
ALTER TABLE quarterly_composites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quarterly_composites_tenant_isolation ON quarterly_composites;
CREATE POLICY quarterly_composites_tenant_isolation ON quarterly_composites
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Audit log table
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Additional roles table
ALTER TABLE additional_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS additional_roles_tenant_isolation ON additional_roles;
CREATE POLICY additional_roles_tenant_isolation ON additional_roles
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- User additional roles table
ALTER TABLE user_additional_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_additional_roles_tenant_isolation ON user_additional_roles;
CREATE POLICY user_additional_roles_tenant_isolation ON user_additional_roles
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Tier definitions table
ALTER TABLE tier_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tier_definitions_tenant_isolation ON tier_definitions;
CREATE POLICY tier_definitions_tenant_isolation ON tier_definitions
  FOR ALL
  USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- ============================================
-- Part 3: Bypass RLS for service role (migrations, admin tasks)
-- ============================================

-- The application database user should have the BYPASSRLS attribute
-- or be the table owner to perform migrations and admin tasks.
-- This is typically set up during initial database configuration.
--
-- Example (run as superuser):
-- ALTER ROLE HeadOfficeOS_app BYPASSRLS;
--
-- For now, the OR get_current_tenant_id() IS NULL clause allows
-- operations when context is not set, enabling backwards compatibility
-- and migration scripts to work properly.

-- ============================================
-- Done
-- ============================================

-- Verify migration
DO $$
DECLARE
  v_table_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_table_count
  FROM pg_catalog.pg_policies
  WHERE policyname LIKE '%_tenant_isolation';

  RAISE NOTICE 'Migration 020_row_level_security.sql completed successfully';
  RAISE NOTICE 'Created context functions: set_tenant_context, get_current_tenant_id, set_session_context';
  RAISE NOTICE 'Created % RLS policies for tenant isolation', v_table_count;
  RAISE NOTICE 'Note: Policies allow access when tenant context is not set (for migrations/admin)';
END;
$$;
