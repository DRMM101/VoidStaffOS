-- VoidStaffOS - Enhanced Audit Log
-- Migration: 017_audit_log_enhanced.sql
--
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Created: 24/01/2026
--
-- PROPRIETARY AND CONFIDENTIAL

-- =============================================
-- DROP OLD AUDIT LOG IF EXISTS
-- =============================================

DROP TABLE IF EXISTS audit_log CASCADE;

-- =============================================
-- CREATE COMPREHENSIVE AUDIT_LOGS TABLE
-- =============================================

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Composite index for common query patterns
CREATE INDEX idx_audit_logs_tenant_action_date ON audit_logs(tenant_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at DESC);

-- =============================================
-- DOCUMENTATION
-- =============================================

COMMENT ON TABLE audit_logs IS 'Security audit trail for compliance and forensics.

Action Types:
- Authentication: LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET_REQUEST
- Authorization: ROLE_CHANGE, PERMISSION_CHANGE
- Data Access: DATA_EXPORT, GDPR_DATA_REQUEST, GDPR_DELETION_REQUEST
- HR Operations: EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_TERMINATED, DISCIPLINARY_CREATED, GRIEVANCE_SUBMITTED, PIP_CREATED
- Sensitive Access: SALARY_VIEWED, SALARY_CHANGED, DOCUMENT_ACCESSED
- Admin: TENANT_SETTINGS_CHANGED, ADMIN_ACTION
- Records: RECORD_CREATE, RECORD_UPDATE, RECORD_DELETE';

COMMENT ON COLUMN audit_logs.tenant_id IS 'NULL for system-wide events (e.g., failed login attempts)';
COMMENT ON COLUMN audit_logs.user_id IS 'NULL for anonymous/system actions';
COMMENT ON COLUMN audit_logs.action IS 'Standardized action type from documented list';
COMMENT ON COLUMN audit_logs.resource_type IS 'Entity type affected (user, review, leave_request, etc.)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected entity';
COMMENT ON COLUMN audit_logs.details IS 'Additional context in JSON format';
COMMENT ON COLUMN audit_logs.ip_address IS 'Client IP address';
COMMENT ON COLUMN audit_logs.user_agent IS 'Client user agent string';

-- =============================================
-- PARTITION BY MONTH (for high-volume deployments)
-- Note: Uncomment if needed for large-scale deployments
-- =============================================

-- CREATE TABLE audit_logs_y2026m01 PARTITION OF audit_logs
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- CREATE TABLE audit_logs_y2026m02 PARTITION OF audit_logs
--   FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... etc.

-- =============================================
-- RETENTION POLICY HELPER VIEW
-- =============================================

CREATE OR REPLACE VIEW audit_logs_recent AS
SELECT * FROM audit_logs
WHERE created_at > NOW() - INTERVAL '90 days';

COMMENT ON VIEW audit_logs_recent IS 'Last 90 days of audit logs for quick access';
