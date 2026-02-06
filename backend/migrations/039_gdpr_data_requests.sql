-- Migration 039: GDPR Data Requests
-- Subject Access Requests (data export) and deletion requests.
-- Employees can request a copy of all their personal data (UK GDPR right of access).
-- HR/Admin can manage deletion requests (right to erasure).
--
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Proprietary and confidential. Unauthorised copying, modification,
-- or distribution is strictly prohibited.

-- Data export and deletion request tracking
CREATE TABLE IF NOT EXISTS data_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),          -- Multi-tenant isolation
  employee_id INTEGER NOT NULL REFERENCES users(id),          -- The data subject (whose data)
  requested_by INTEGER NOT NULL REFERENCES users(id),         -- Who created the request (self or HR)
  request_type VARCHAR(20) NOT NULL                           -- 'export' = data copy, 'deletion' = right to erasure
    CHECK (request_type IN ('export', 'deletion')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'               -- Workflow status
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'expired')),
  reason TEXT,                                                 -- Reason for request (optional for export, required for deletion)
  rejection_reason TEXT,                                       -- Why a deletion request was rejected
  file_path TEXT,                                              -- Relative path to generated ZIP (export only)
  file_size_bytes BIGINT,                                      -- Size of the generated ZIP file
  processed_by INTEGER REFERENCES users(id),                   -- HR/Admin who processed or rejected
  processed_at TIMESTAMPTZ,                                    -- When the request was processed
  expires_at TIMESTAMPTZ,                                      -- When the download link expires (30 days for exports)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable audit log for GDPR compliance — tracks every action on a request
CREATE TABLE IF NOT EXISTS data_request_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),          -- Multi-tenant isolation
  data_request_id INTEGER NOT NULL REFERENCES data_requests(id) ON DELETE CASCADE,  -- Parent request
  action VARCHAR(50) NOT NULL,                                 -- 'created', 'processing', 'completed', 'downloaded', 'rejected', 'expired', 'error'
  performed_by INTEGER NOT NULL REFERENCES users(id),          -- Who performed this action
  details TEXT,                                                -- Freeform context about the action
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_data_requests_tenant ON data_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_employee ON data_requests(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_data_requests_type ON data_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_data_requests_expires ON data_requests(expires_at) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_data_request_logs_request ON data_request_logs(data_request_id);
