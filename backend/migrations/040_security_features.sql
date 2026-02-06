-- HeadOfficeOS - Security Features
-- Migration: 040_security_features.sql
--
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Created: 06/02/2026
--
-- PROPRIETARY AND CONFIDENTIAL
--
-- Adds: tenant security policy columns, user MFA/lockout columns,
-- backup codes table, session devices table, security audit log table.

-- =============================================
-- TENANT SECURITY POLICY COLUMNS
-- =============================================

-- MFA policy: off = hidden, optional = user choice, required = mandatory
ALTER TABLE tenants ADD COLUMN mfa_policy VARCHAR(20) DEFAULT 'optional'
  CHECK (mfa_policy IN ('off', 'optional', 'required'));

-- Grace period for required MFA (days before enforcement)
ALTER TABLE tenants ADD COLUMN mfa_grace_period_days INTEGER DEFAULT 7;

-- Password complexity policy
ALTER TABLE tenants ADD COLUMN password_min_length INTEGER DEFAULT 8;
ALTER TABLE tenants ADD COLUMN password_require_uppercase BOOLEAN DEFAULT true;
ALTER TABLE tenants ADD COLUMN password_require_number BOOLEAN DEFAULT true;
ALTER TABLE tenants ADD COLUMN password_require_special BOOLEAN DEFAULT false;

-- Session timeout in minutes (default 480 = 8 hours, matches existing cookie maxAge)
ALTER TABLE tenants ADD COLUMN session_timeout_minutes INTEGER DEFAULT 480;

-- =============================================
-- USER SECURITY COLUMNS
-- =============================================

-- Account lockout after failed login attempts
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;

-- TOTP MFA fields
ALTER TABLE users ADD COLUMN mfa_secret TEXT;           -- TOTP secret (encrypted at rest by DB)
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN mfa_enabled_at TIMESTAMPTZ;

-- Last login tracking for inactive account detection
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;

-- =============================================
-- BACKUP CODES TABLE
-- =============================================
-- Each user gets 10 single-use backup codes when enabling MFA.
-- Codes are bcrypt-hashed; plaintext shown once at generation.

CREATE TABLE user_backup_codes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  code_hash TEXT NOT NULL,                    -- bcrypt hash of 8-char backup code
  used_at TIMESTAMPTZ,                        -- NULL = unused, set when consumed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backup_codes_user ON user_backup_codes(user_id);
CREATE INDEX idx_backup_codes_tenant ON user_backup_codes(tenant_id);

-- =============================================
-- SESSION DEVICES TABLE
-- =============================================
-- Tracks active login sessions with device info.
-- Complements the existing connect-pg-simple user_sessions table.

CREATE TABLE session_devices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  session_sid VARCHAR(255),                   -- Matches user_sessions.sid
  device_name TEXT,                           -- e.g. "Chrome on Windows"
  ip_address TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_devices_user ON session_devices(user_id);
CREATE INDEX idx_session_devices_sid ON session_devices(session_sid);
CREATE INDEX idx_session_devices_tenant ON session_devices(tenant_id);

-- =============================================
-- SECURITY AUDIT LOG TABLE
-- =============================================
-- Dedicated security event log separate from the general audit trail.
-- Events: mfa_enabled, mfa_disabled, mfa_verified, mfa_failed,
--         backup_code_used, backup_codes_regenerated,
--         account_locked, account_unlocked, login_success, login_failed,
--         session_terminated, all_sessions_terminated,
--         password_changed, security_policy_updated

CREATE TABLE security_audit_log (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,                             -- Extra context (e.g. { attempts: 5 })
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sec_audit_user ON security_audit_log(user_id, created_at DESC);
CREATE INDEX idx_sec_audit_tenant ON security_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_sec_audit_event ON security_audit_log(event_type);
