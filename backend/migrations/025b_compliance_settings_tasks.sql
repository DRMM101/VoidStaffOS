/**
 * VoidStaffOS - Migration 025b: Compliance Settings & Tasks
 * Additional tables for RTW/DBS compliance management.
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
-- COMPLIANCE SETTINGS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS compliance_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id),

    -- DBS Settings
    default_dbs_renewal_years INTEGER NOT NULL DEFAULT 3 CHECK (default_dbs_renewal_years IN (1, 2, 3)),
    update_service_check_months INTEGER NOT NULL DEFAULT 3,

    -- RTW Settings
    rtw_reminder_days INTEGER[] DEFAULT ARRAY[90, 60, 30],

    -- Task Settings
    auto_create_followup_tasks BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings for tenant 1
INSERT INTO compliance_settings (tenant_id)
VALUES (1)
ON CONFLICT (tenant_id) DO NOTHING;

-- ===========================================
-- COMPLIANCE TASK TYPES
-- ===========================================

DO $$ BEGIN
    CREATE TYPE compliance_task_type AS ENUM (
        'rtw_expiry',
        'rtw_followup',
        'dbs_renewal',
        'dbs_update_check',
        'manual'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE compliance_task_status AS ENUM (
        'pending',
        'completed',
        'dismissed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- COMPLIANCE TASKS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS compliance_tasks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),

    -- Task details
    task_type compliance_task_type NOT NULL,
    source_type VARCHAR(20),  -- 'rtw' or 'dbs'
    source_id INTEGER,        -- References rtw_checks.id or dbs_checks.id
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Task content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,

    -- Assignment
    assigned_to INTEGER REFERENCES users(id),

    -- Status
    status compliance_task_status DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by INTEGER REFERENCES users(id),
    dismissed_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- ADD RENEWAL PERIOD TO DBS CHECKS
-- ===========================================

ALTER TABLE dbs_checks
ADD COLUMN IF NOT EXISTS renewal_period_years INTEGER DEFAULT 3 CHECK (renewal_period_years IN (1, 2, 3));

ALTER TABLE dbs_checks
ADD COLUMN IF NOT EXISTS calculated_expiry_date DATE;

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_compliance_tasks_tenant ON compliance_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_employee ON compliance_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_status ON compliance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_due_date ON compliance_tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_assigned ON compliance_tasks(assigned_to) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_source ON compliance_tasks(source_type, source_id);

-- ===========================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ===========================================

CREATE OR REPLACE FUNCTION update_compliance_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compliance_settings_timestamp_trigger ON compliance_settings;
CREATE TRIGGER compliance_settings_timestamp_trigger
    BEFORE UPDATE ON compliance_settings
    FOR EACH ROW EXECUTE FUNCTION update_compliance_settings_timestamp();

CREATE OR REPLACE FUNCTION update_compliance_tasks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compliance_tasks_timestamp_trigger ON compliance_tasks;
CREATE TRIGGER compliance_tasks_timestamp_trigger
    BEFORE UPDATE ON compliance_tasks
    FOR EACH ROW EXECUTE FUNCTION update_compliance_tasks_timestamp();

-- ===========================================
-- AUTO-CALCULATE DBS EXPIRY TRIGGER
-- ===========================================

CREATE OR REPLACE FUNCTION calculate_dbs_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate expiry based on issue_date + renewal_period_years
    IF NEW.issue_date IS NOT NULL AND NEW.renewal_period_years IS NOT NULL THEN
        NEW.calculated_expiry_date = NEW.issue_date + (NEW.renewal_period_years || ' years')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dbs_expiry_calculation ON dbs_checks;
CREATE TRIGGER dbs_expiry_calculation
    BEFORE INSERT OR UPDATE OF issue_date, renewal_period_years ON dbs_checks
    FOR EACH ROW EXECUTE FUNCTION calculate_dbs_expiry();

-- Update existing DBS records with calculated expiry
UPDATE dbs_checks
SET calculated_expiry_date = issue_date + (COALESCE(renewal_period_years, 3) || ' years')::INTERVAL
WHERE calculated_expiry_date IS NULL AND issue_date IS NOT NULL;

-- ===========================================
-- AUTO-CREATE TASKS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION create_rtw_compliance_task()
RETURNS TRIGGER AS $$
DECLARE
    settings_record RECORD;
BEGIN
    -- Get tenant settings
    SELECT * INTO settings_record FROM compliance_settings WHERE tenant_id = NEW.tenant_id;

    -- Only create if auto-creation is enabled
    IF settings_record IS NULL OR settings_record.auto_create_followup_tasks = true THEN
        -- Create task for expiry if expiry_date exists
        IF NEW.expiry_date IS NOT NULL THEN
            INSERT INTO compliance_tasks (
                tenant_id, task_type, source_type, source_id, employee_id,
                title, description, due_date
            ) VALUES (
                NEW.tenant_id, 'rtw_expiry', 'rtw', NEW.id, NEW.employee_id,
                'RTW Check Due - Expiry',
                'Right to Work verification expires on ' || NEW.expiry_date::TEXT || '. Repeat check required.',
                NEW.expiry_date - INTERVAL '30 days'
            ) ON CONFLICT DO NOTHING;
        END IF;

        -- Create task for followup if followup_date exists
        IF NEW.followup_date IS NOT NULL THEN
            INSERT INTO compliance_tasks (
                tenant_id, task_type, source_type, source_id, employee_id,
                title, description, due_date
            ) VALUES (
                NEW.tenant_id, 'rtw_followup', 'rtw', NEW.id, NEW.employee_id,
                'RTW Follow-up Check Required',
                'Time-limited Right to Work requires repeat verification by ' || NEW.followup_date::TEXT,
                NEW.followup_date - INTERVAL '30 days'
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rtw_auto_task_trigger ON rtw_checks;
CREATE TRIGGER rtw_auto_task_trigger
    AFTER INSERT ON rtw_checks
    FOR EACH ROW EXECUTE FUNCTION create_rtw_compliance_task();

-- ===========================================
-- AUTO-CREATE DBS TASKS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION create_dbs_compliance_task()
RETURNS TRIGGER AS $$
DECLARE
    settings_record RECORD;
BEGIN
    -- Get tenant settings
    SELECT * INTO settings_record FROM compliance_settings WHERE tenant_id = NEW.tenant_id;

    -- Only create if auto-creation is enabled
    IF settings_record IS NULL OR settings_record.auto_create_followup_tasks = true THEN
        -- Create renewal task based on calculated_expiry_date
        IF NEW.calculated_expiry_date IS NOT NULL THEN
            INSERT INTO compliance_tasks (
                tenant_id, task_type, source_type, source_id, employee_id,
                title, description, due_date
            ) VALUES (
                NEW.tenant_id, 'dbs_renewal', 'dbs', NEW.id, NEW.employee_id,
                'DBS Certificate Renewal Due',
                'DBS certificate (' || COALESCE(NEW.certificate_number, 'N/A') || ') renewal due by ' || NEW.calculated_expiry_date::TEXT,
                NEW.calculated_expiry_date - INTERVAL '90 days'
            ) ON CONFLICT DO NOTHING;
        END IF;

        -- Create update service check task if registered
        IF NEW.update_service_registered = true AND NEW.next_update_check IS NOT NULL THEN
            INSERT INTO compliance_tasks (
                tenant_id, task_type, source_type, source_id, employee_id,
                title, description, due_date
            ) VALUES (
                NEW.tenant_id, 'dbs_update_check', 'dbs', NEW.id, NEW.employee_id,
                'DBS Update Service Check Due',
                'Annual DBS Update Service check required for certificate ' || COALESCE(NEW.certificate_number, 'N/A'),
                NEW.next_update_check - INTERVAL '14 days'
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dbs_auto_task_trigger ON dbs_checks;
CREATE TRIGGER dbs_auto_task_trigger
    AFTER INSERT ON dbs_checks
    FOR EACH ROW EXECUTE FUNCTION create_dbs_compliance_task();

-- ===========================================
-- UPDATE COMPLIANCE OVERVIEW VIEW
-- ===========================================

DROP VIEW IF EXISTS compliance_overview;
CREATE VIEW compliance_overview AS
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
    rtw.check_date as rtw_check_date,
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
    dbs.issue_date as dbs_issue_date,
    dbs.calculated_expiry_date as dbs_expiry,
    dbs.renewal_period_years,
    CASE
        WHEN dbs.id IS NULL THEN 'missing'
        WHEN dbs.status = 'expired' THEN 'expired'
        WHEN dbs.status = 'action_required' THEN 'action_required'
        WHEN dbs.calculated_expiry_date IS NOT NULL AND dbs.calculated_expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'expiring'
        WHEN dbs.update_service_registered AND dbs.next_update_check <= CURRENT_DATE + INTERVAL '30 days' THEN 'update_due'
        ELSE 'compliant'
    END as dbs_compliance,
    -- Pending tasks count
    (SELECT COUNT(*) FROM compliance_tasks ct
     WHERE ct.employee_id = u.id AND ct.status = 'pending') as pending_tasks
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

COMMENT ON TABLE compliance_settings IS 'Per-tenant compliance configuration settings';
COMMENT ON TABLE compliance_tasks IS 'Auto-generated and manual compliance follow-up tasks';
COMMENT ON COLUMN dbs_checks.renewal_period_years IS 'DBS renewal period (1, 2, or 3 years)';
COMMENT ON COLUMN dbs_checks.calculated_expiry_date IS 'Auto-calculated: issue_date + renewal_period_years';

COMMIT;
