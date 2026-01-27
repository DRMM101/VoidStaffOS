/**
 * VoidStaffOS - Migration 025: Compliance Checks (RTW & DBS)
 * CQC-critical Right to Work and DBS verification tracking.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Compliance
 */

BEGIN;

-- ===========================================
-- CREATE TYPES
-- ===========================================

DO $$ BEGIN
    CREATE TYPE rtw_check_type AS ENUM (
        'passport_uk',
        'passport_foreign',
        'visa',
        'share_code',
        'brp',
        'euss',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE rtw_status AS ENUM (
        'pending',
        'verified',
        'expired',
        'action_required'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dbs_level AS ENUM (
        'basic',
        'standard',
        'enhanced',
        'enhanced_barred'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dbs_status AS ENUM (
        'pending',
        'valid',
        'expired',
        'action_required'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add notification types for compliance
DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'rtw_expiry_warning';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'rtw_expired';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'dbs_expiry_warning';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'dbs_update_due';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- RTW CHECKS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS rtw_checks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES employee_documents(id) ON DELETE SET NULL,

    -- Check details
    check_type rtw_check_type NOT NULL,
    document_reference VARCHAR(100),
    immigration_status VARCHAR(100),

    -- Dates
    check_date DATE NOT NULL,
    expiry_date DATE,
    followup_date DATE,  -- For time-limited RTW requiring repeat checks

    -- Verification
    checked_by INTEGER NOT NULL REFERENCES users(id),
    verification_method VARCHAR(100),  -- online_check, manual_document, employer_checking_service

    -- Status tracking
    status rtw_status DEFAULT 'verified',
    expiry_notified_90 BOOLEAN DEFAULT false,
    expiry_notified_60 BOOLEAN DEFAULT false,
    expiry_notified_30 BOOLEAN DEFAULT false,
    expiry_notified_expired BOOLEAN DEFAULT false,

    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT rtw_followup_logic CHECK (
        followup_date IS NULL OR followup_date > check_date
    )
);

-- ===========================================
-- DBS CHECKS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS dbs_checks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES employee_documents(id) ON DELETE SET NULL,

    -- Certificate details
    dbs_level dbs_level NOT NULL,
    certificate_number VARCHAR(50),
    issue_date DATE NOT NULL,

    -- Update Service
    update_service_registered BOOLEAN DEFAULT false,
    update_service_id VARCHAR(50),
    last_update_check DATE,
    next_update_check DATE,  -- Calculated from last check + interval

    -- Verification
    checked_by INTEGER NOT NULL REFERENCES users(id),
    workforce VARCHAR(50),  -- adult, child, adult_and_child

    -- Status tracking
    status dbs_status DEFAULT 'valid',
    expiry_notified_90 BOOLEAN DEFAULT false,
    expiry_notified_60 BOOLEAN DEFAULT false,
    expiry_notified_30 BOOLEAN DEFAULT false,
    expiry_notified_expired BOOLEAN DEFAULT false,

    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT dbs_update_service_logic CHECK (
        (update_service_registered = false) OR
        (update_service_registered = true AND update_service_id IS NOT NULL)
    )
);

-- ===========================================
-- INDEXES
-- ===========================================

-- RTW indexes
CREATE INDEX IF NOT EXISTS idx_rtw_tenant ON rtw_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rtw_employee ON rtw_checks(employee_id);
CREATE INDEX IF NOT EXISTS idx_rtw_status ON rtw_checks(status);
CREATE INDEX IF NOT EXISTS idx_rtw_expiry ON rtw_checks(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rtw_followup ON rtw_checks(followup_date) WHERE followup_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rtw_tenant_employee ON rtw_checks(tenant_id, employee_id);

-- DBS indexes
CREATE INDEX IF NOT EXISTS idx_dbs_tenant ON dbs_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dbs_employee ON dbs_checks(employee_id);
CREATE INDEX IF NOT EXISTS idx_dbs_status ON dbs_checks(status);
CREATE INDEX IF NOT EXISTS idx_dbs_certificate ON dbs_checks(certificate_number);
CREATE INDEX IF NOT EXISTS idx_dbs_update_service ON dbs_checks(update_service_registered, next_update_check)
    WHERE update_service_registered = true;
CREATE INDEX IF NOT EXISTS idx_dbs_tenant_employee ON dbs_checks(tenant_id, employee_id);

-- ===========================================
-- AUTO-UPDATE TIMESTAMP TRIGGERS
-- ===========================================

CREATE OR REPLACE FUNCTION update_rtw_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rtw_timestamp_trigger ON rtw_checks;
CREATE TRIGGER rtw_timestamp_trigger
    BEFORE UPDATE ON rtw_checks
    FOR EACH ROW EXECUTE FUNCTION update_rtw_timestamp();

CREATE OR REPLACE FUNCTION update_dbs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    -- Auto-calculate next update check if using update service
    IF NEW.update_service_registered = true AND NEW.last_update_check IS NOT NULL THEN
        NEW.next_update_check = NEW.last_update_check + INTERVAL '1 year';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dbs_timestamp_trigger ON dbs_checks;
CREATE TRIGGER dbs_timestamp_trigger
    BEFORE UPDATE ON dbs_checks
    FOR EACH ROW EXECUTE FUNCTION update_dbs_timestamp();

-- ===========================================
-- AUTO-EXPIRE STATUS TRIGGERS
-- ===========================================

CREATE OR REPLACE FUNCTION check_rtw_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-set status to expired if past expiry date
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE AND NEW.status = 'verified' THEN
        NEW.status := 'expired';
    END IF;
    -- Set to action_required if followup is overdue
    IF NEW.followup_date IS NOT NULL AND NEW.followup_date < CURRENT_DATE AND NEW.status = 'verified' THEN
        NEW.status := 'action_required';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rtw_expiry_check ON rtw_checks;
CREATE TRIGGER rtw_expiry_check
    BEFORE INSERT OR UPDATE ON rtw_checks
    FOR EACH ROW EXECUTE FUNCTION check_rtw_expiry();

CREATE OR REPLACE FUNCTION check_dbs_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- For update service: action required if next check is overdue
    IF NEW.update_service_registered = true AND NEW.next_update_check IS NOT NULL
       AND NEW.next_update_check < CURRENT_DATE AND NEW.status = 'valid' THEN
        NEW.status := 'action_required';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dbs_expiry_check ON dbs_checks;
CREATE TRIGGER dbs_expiry_check
    BEFORE INSERT OR UPDATE ON dbs_checks
    FOR EACH ROW EXECUTE FUNCTION check_dbs_expiry();

-- ===========================================
-- VIEWS FOR COMPLIANCE DASHBOARD
-- ===========================================

CREATE OR REPLACE VIEW compliance_overview AS
SELECT
    u.id as employee_id,
    u.tenant_id,
    u.full_name,
    u.employee_number,
    u.email,
    -- Latest RTW check
    rtw.id as rtw_check_id,
    rtw.check_type as rtw_type,
    rtw.status as rtw_status,
    rtw.expiry_date as rtw_expiry,
    rtw.followup_date as rtw_followup,
    CASE
        WHEN rtw.id IS NULL THEN 'missing'
        WHEN rtw.status = 'expired' THEN 'expired'
        WHEN rtw.expiry_date IS NOT NULL AND rtw.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
        WHEN rtw.status = 'action_required' THEN 'action_required'
        ELSE 'compliant'
    END as rtw_compliance,
    -- Latest DBS check
    dbs.id as dbs_check_id,
    dbs.dbs_level,
    dbs.status as dbs_status,
    dbs.update_service_registered,
    dbs.next_update_check,
    CASE
        WHEN dbs.id IS NULL THEN 'missing'
        WHEN dbs.status = 'expired' THEN 'expired'
        WHEN dbs.status = 'action_required' THEN 'action_required'
        WHEN dbs.update_service_registered AND dbs.next_update_check <= CURRENT_DATE + INTERVAL '30 days' THEN 'update_due'
        ELSE 'compliant'
    END as dbs_compliance
FROM users u
LEFT JOIN LATERAL (
    SELECT * FROM rtw_checks
    WHERE employee_id = u.id AND tenant_id = u.tenant_id
    ORDER BY check_date DESC LIMIT 1
) rtw ON true
LEFT JOIN LATERAL (
    SELECT * FROM dbs_checks
    WHERE employee_id = u.id AND tenant_id = u.tenant_id
    ORDER BY issue_date DESC LIMIT 1
) dbs ON true
WHERE u.employment_status = 'active';

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE rtw_checks IS 'Right to Work verification records - CQC critical compliance';
COMMENT ON TABLE dbs_checks IS 'DBS certificate verification records - CQC critical compliance';
COMMENT ON COLUMN rtw_checks.followup_date IS 'For time-limited RTW requiring repeat verification';
COMMENT ON COLUMN dbs_checks.update_service_registered IS 'Whether employee is on DBS Update Service';
COMMENT ON COLUMN dbs_checks.next_update_check IS 'Auto-calculated: last_update_check + 1 year';
COMMENT ON VIEW compliance_overview IS 'Combined RTW and DBS compliance status for all active employees';

COMMIT;
