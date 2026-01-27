/**
 * VoidStaffOS - Migration 023c: Policy Tables RLS Fix
 * Disables RLS on policy tables since app handles tenant isolation at application level.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 */

-- Add tenant_id column if it doesn't exist
ALTER TABLE policy_acknowledgments ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;

-- Update existing rows to have the correct tenant_id from their user
UPDATE policy_acknowledgments pa
SET tenant_id = COALESCE(
    (SELECT u.tenant_id FROM users u WHERE u.id = pa.user_id),
    1
)
WHERE pa.tenant_id IS NULL;

-- Recreate the index if tenant_id column exists
DROP INDEX IF EXISTS idx_policy_ack_tenant;
CREATE INDEX IF NOT EXISTS idx_policy_ack_tenant ON policy_acknowledgments(tenant_id);

-- Disable RLS on policy tables - app handles tenant isolation in WHERE clauses
-- This fixes the "view details" error where RLS was blocking queries
ALTER TABLE policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE policy_acknowledgments DISABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions DISABLE ROW LEVEL SECURITY;

-- Drop RLS policies since they're no longer needed
DROP POLICY IF EXISTS policies_tenant_isolation ON policies;
DROP POLICY IF EXISTS policy_ack_tenant_isolation ON policy_acknowledgments;
