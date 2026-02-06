/**
 * HeadOfficeOS - Migration 018: Comprehensive Audit Trail
 * Creates audit_trail table for tracking all system changes.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 25/01/2026
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

-- Comprehensive audit trail table
-- Tracks WHO did WHAT, WHEN, WHERE with full BEFORE/AFTER values
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,

    -- Tenant isolation
    tenant_id INTEGER REFERENCES tenants(id),

    -- WHO: User information at time of action
    user_id INTEGER REFERENCES users(id),
    user_email VARCHAR(255),
    user_role VARCHAR(100),

    -- WHAT: Action and resource details
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, VIEW_SENSITIVE, BULK_UPDATE, BULK_DELETE
    resource_type VARCHAR(100) NOT NULL, -- users, reviews, leave_requests, feedback, etc.
    resource_id INTEGER, -- ID of affected record (NULL for bulk operations)
    resource_name VARCHAR(255), -- Human readable: "John Smith", "Annual Leave Request #123"

    -- CHANGES: What was modified
    changes JSONB, -- {field: {old: "x", new: "y"}} for changed fields only
    previous_values JSONB, -- Full record snapshot before change (for UPDATE/DELETE)
    new_values JSONB, -- Full record snapshot after change (for CREATE/UPDATE)

    -- WHERE: Request context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    request_id VARCHAR(255), -- For correlating multiple changes in single request

    -- Additional context
    reason TEXT, -- Optional reason for change (e.g., "Annual performance review")
    metadata JSONB, -- Additional context: {affected_count: 5, triggered_by: "scheduled_job"}

    -- WHEN: Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant ON audit_trail(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_session ON audit_trail(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_request ON audit_trail(request_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_created ON audit_trail(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource_created ON audit_trail(resource_type, resource_id, created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_audit_trail_changes_gin ON audit_trail USING GIN (changes);
CREATE INDEX IF NOT EXISTS idx_audit_trail_metadata_gin ON audit_trail USING GIN (metadata);

-- Comment on table
COMMENT ON TABLE audit_trail IS 'Comprehensive audit trail tracking all system changes with full before/after values';

-- Comments on columns
COMMENT ON COLUMN audit_trail.action IS 'Type of action: CREATE, UPDATE, DELETE, VIEW_SENSITIVE, BULK_UPDATE, BULK_DELETE';
COMMENT ON COLUMN audit_trail.changes IS 'JSON diff of changed fields: {field: {old: value, new: value}}';
COMMENT ON COLUMN audit_trail.previous_values IS 'Full record snapshot before change (sensitive fields masked)';
COMMENT ON COLUMN audit_trail.new_values IS 'Full record snapshot after change (sensitive fields masked)';
COMMENT ON COLUMN audit_trail.request_id IS 'UUID correlating multiple audit entries from single request';

-- Migrate existing audit_logs data to new format (optional)
-- Uncomment if you want to preserve existing audit_logs
/*
INSERT INTO audit_trail (tenant_id, user_id, action, resource_type, resource_id, ip_address, user_agent, created_at, metadata)
SELECT
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address::inet,
    user_agent,
    created_at,
    details as metadata
FROM audit_logs
WHERE action IS NOT NULL;
*/

-- Create view for easy querying
CREATE OR REPLACE VIEW audit_trail_summary AS
SELECT
    at.id,
    at.tenant_id,
    at.user_id,
    at.user_email,
    at.user_role,
    at.action,
    at.resource_type,
    at.resource_id,
    at.resource_name,
    at.ip_address,
    at.created_at,
    jsonb_object_keys(at.changes) as changed_fields
FROM audit_trail at
WHERE at.changes IS NOT NULL;

COMMENT ON VIEW audit_trail_summary IS 'Summary view of audit trail with expanded changed fields';

-- ===========================================
-- IMMUTABILITY PROTECTION
-- Audit trail records must be tamper-proof
-- ===========================================

-- Trigger function to prevent modification of audit records
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit trail records cannot be modified or deleted. This is a security requirement.';
END;
$$ LANGUAGE plpgsql;

-- Trigger to block UPDATE operations
CREATE TRIGGER audit_trail_no_update
BEFORE UPDATE ON audit_trail
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Trigger to block DELETE operations
CREATE TRIGGER audit_trail_no_delete
BEFORE DELETE ON audit_trail
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Note: If using a dedicated database role for the application,
-- you can also revoke permissions at the database level:
-- REVOKE UPDATE, DELETE ON audit_trail FROM HeadOfficeOS_app;

COMMENT ON FUNCTION prevent_audit_modification IS 'Security function to ensure audit trail immutability';
COMMENT ON TRIGGER audit_trail_no_update ON audit_trail IS 'Prevents modification of audit records';
COMMENT ON TRIGGER audit_trail_no_delete ON audit_trail IS 'Prevents deletion of audit records';
