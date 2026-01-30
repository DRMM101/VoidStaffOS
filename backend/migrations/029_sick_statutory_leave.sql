/**
 * VoidStaffOS - Migration 029: Sick & Statutory Leave
 * Extends leave system with sick leave, statutory leave types, and RTW interviews.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 30/01/2026
 */

-- =====================================================
-- PART 1: New Leave Category System
-- =====================================================

-- Create absence category enum (extends existing leave_type_enum concept)
DO $$ BEGIN
    CREATE TYPE absence_category_enum AS ENUM (
        'annual',           -- Existing annual leave
        'sick',             -- Sick leave (self-cert or with fit note)
        'maternity',        -- Statutory maternity leave
        'paternity',        -- Statutory paternity leave
        'adoption',         -- Statutory adoption leave
        'shared_parental',  -- Shared parental leave
        'parental',         -- Unpaid parental leave (18 weeks per child)
        'bereavement',      -- Bereavement/compassionate
        'jury_duty',        -- Jury service
        'public_duties',    -- Magistrate, councillor, etc.
        'compassionate',    -- Compassionate leave (company policy)
        'toil',             -- Time off in lieu
        'unpaid'            -- Unpaid leave
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create sick reason category enum
DO $$ BEGIN
    CREATE TYPE sick_reason_enum AS ENUM (
        'illness',
        'medical_appointment',
        'injury',
        'mental_health',
        'hospital',
        'covid',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PART 2: Extend leave_requests Table
-- =====================================================

-- Add absence category to existing leave_requests table
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS absence_category absence_category_enum DEFAULT 'annual';

-- Add sick-leave specific fields
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS sick_reason sick_reason_enum;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS sick_notes TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS fit_note_required BOOLEAN DEFAULT false;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS fit_note_document_id INTEGER REFERENCES employee_documents(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS ssp_eligible BOOLEAN;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS self_certified BOOLEAN DEFAULT false;

-- Add statutory leave specific fields
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS expected_date DATE; -- Due date, placement date, etc.
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS actual_date DATE;   -- Actual birth/placement date
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS kit_days_used INTEGER DEFAULT 0; -- Keep In Touch days
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS statutory_weeks_requested DECIMAL(4,1);

-- Add RTW tracking flag
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rtw_required BOOLEAN DEFAULT false;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rtw_completed BOOLEAN DEFAULT false;

-- Update existing annual leave records to have absence_category
UPDATE leave_requests SET absence_category = 'annual' WHERE absence_category IS NULL;

-- =====================================================
-- PART 3: Return to Work Interviews Table
-- =====================================================

CREATE TABLE IF NOT EXISTS return_to_work_interviews (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    leave_request_id INTEGER NOT NULL REFERENCES leave_requests(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    interviewer_id INTEGER NOT NULL REFERENCES users(id),

    -- Interview details
    interview_date DATE NOT NULL,
    interview_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Wellbeing-focused questions (NOT punitive)
    feeling_ready BOOLEAN,
    ready_notes TEXT,
    ongoing_concerns TEXT,
    workplace_adjustments TEXT,
    support_required TEXT,
    wellbeing_notes TEXT,

    -- Follow-up
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Occupational health referral
    oh_referral_recommended BOOLEAN DEFAULT false,
    oh_referral_reason TEXT,

    -- Manager's overall notes
    manager_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_rtw_per_leave UNIQUE(leave_request_id)
);

-- =====================================================
-- PART 4: SSP Tracking Table
-- =====================================================

CREATE TABLE IF NOT EXISTS ssp_periods (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),

    -- Period tracking
    period_start DATE NOT NULL,
    period_end DATE,
    is_active BOOLEAN DEFAULT true,

    -- SSP calculations
    waiting_days_used INTEGER DEFAULT 0,  -- Max 3 per period
    qualifying_days_paid INTEGER DEFAULT 0,
    weeks_paid DECIMAL(4,2) DEFAULT 0,

    -- Linked leave requests
    linked_leave_ids INTEGER[], -- Array of leave_request IDs in this period

    -- Period can be linked if gap < 8 weeks
    linked_to_previous_period_id INTEGER REFERENCES ssp_periods(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PART 5: Statutory Leave Entitlements
-- =====================================================

CREATE TABLE IF NOT EXISTS statutory_leave_entitlements (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    leave_year_start DATE NOT NULL,
    leave_year_end DATE NOT NULL,

    -- Parental leave (18 weeks per child under 18)
    parental_leave_weeks_used DECIMAL(4,1) DEFAULT 0,
    parental_leave_child_id INTEGER, -- Reference to dependent if we track them

    -- SSP tracking for the year
    ssp_weeks_used_ytd DECIMAL(4,2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_entitlement_per_year UNIQUE(tenant_id, employee_id, leave_year_start)
);

-- =====================================================
-- PART 6: Absence Category Settings (Tenant Configurable)
-- =====================================================

CREATE TABLE IF NOT EXISTS absence_category_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    category absence_category_enum NOT NULL,

    -- Display settings
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,

    -- Approval settings
    requires_approval BOOLEAN DEFAULT true,
    auto_approve BOOLEAN DEFAULT false,
    approval_required_from VARCHAR(50) DEFAULT 'manager', -- manager, hr, admin

    -- Balance settings
    deducts_from_annual BOOLEAN DEFAULT false,
    has_separate_balance BOOLEAN DEFAULT false,
    default_entitlement_days DECIMAL(4,1),

    -- Notice requirements
    min_notice_days INTEGER DEFAULT 0,

    -- Documentation requirements
    requires_evidence_after_days INTEGER, -- e.g., fit note after 7 days for sick
    evidence_type VARCHAR(100), -- 'fit_note', 'court_summons', etc.

    -- RTW requirements
    rtw_required_after_days INTEGER, -- e.g., 1 day for sick leave

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_category_per_tenant UNIQUE(tenant_id, category)
);

-- Insert default settings for tenant 1
INSERT INTO absence_category_settings (tenant_id, category, display_name, description, requires_approval, deducts_from_annual, requires_evidence_after_days, rtw_required_after_days) VALUES
    (1, 'annual', 'Annual Leave', 'Paid annual holiday entitlement', true, false, NULL, NULL),
    (1, 'sick', 'Sick Leave', 'Absence due to illness or injury', false, false, 7, 1),
    (1, 'maternity', 'Maternity Leave', 'Statutory maternity leave (up to 52 weeks)', true, false, NULL, NULL),
    (1, 'paternity', 'Paternity Leave', 'Statutory paternity leave (1-2 weeks)', true, false, NULL, NULL),
    (1, 'adoption', 'Adoption Leave', 'Statutory adoption leave', true, false, NULL, NULL),
    (1, 'shared_parental', 'Shared Parental Leave', 'Shared parental leave between parents', true, false, NULL, NULL),
    (1, 'parental', 'Parental Leave', 'Unpaid parental leave (18 weeks per child)', true, false, NULL, NULL),
    (1, 'bereavement', 'Bereavement Leave', 'Time off following a death', false, false, NULL, NULL),
    (1, 'jury_duty', 'Jury Duty', 'Court service requirement', false, false, NULL, NULL),
    (1, 'public_duties', 'Public Duties', 'Magistrate, councillor, or similar duties', true, false, NULL, NULL),
    (1, 'compassionate', 'Compassionate Leave', 'Paid leave for family emergencies', true, false, NULL, NULL),
    (1, 'toil', 'Time Off In Lieu', 'Time off earned from overtime', true, false, NULL, NULL),
    (1, 'unpaid', 'Unpaid Leave', 'Approved unpaid absence', true, false, NULL, NULL)
ON CONFLICT (tenant_id, category) DO NOTHING;

-- =====================================================
-- PART 7: Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leave_absence_category ON leave_requests(absence_category);
CREATE INDEX IF NOT EXISTS idx_leave_rtw_required ON leave_requests(rtw_required) WHERE rtw_required = true;
CREATE INDEX IF NOT EXISTS idx_rtw_employee ON return_to_work_interviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_rtw_interviewer ON return_to_work_interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_rtw_pending ON return_to_work_interviews(interview_completed) WHERE interview_completed = false;
CREATE INDEX IF NOT EXISTS idx_ssp_employee ON ssp_periods(employee_id);
CREATE INDEX IF NOT EXISTS idx_ssp_active ON ssp_periods(is_active) WHERE is_active = true;

-- =====================================================
-- PART 8: Row Level Security
-- =====================================================

ALTER TABLE return_to_work_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_leave_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_category_settings ENABLE ROW LEVEL SECURITY;

-- RTW interviews: tenant isolation
DROP POLICY IF EXISTS rtw_tenant_isolation ON return_to_work_interviews;
CREATE POLICY rtw_tenant_isolation ON return_to_work_interviews
    FOR ALL
    USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- SSP periods: tenant isolation
DROP POLICY IF EXISTS ssp_tenant_isolation ON ssp_periods;
CREATE POLICY ssp_tenant_isolation ON ssp_periods
    FOR ALL
    USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Statutory entitlements: tenant isolation
DROP POLICY IF EXISTS stat_entitlements_tenant_isolation ON statutory_leave_entitlements;
CREATE POLICY stat_entitlements_tenant_isolation ON statutory_leave_entitlements
    FOR ALL
    USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- Absence settings: tenant isolation
DROP POLICY IF EXISTS absence_settings_tenant_isolation ON absence_category_settings;
CREATE POLICY absence_settings_tenant_isolation ON absence_category_settings
    FOR ALL
    USING (tenant_id = get_current_tenant_id() OR get_current_tenant_id() IS NULL);

-- =====================================================
-- PART 9: Comments
-- =====================================================

COMMENT ON TABLE return_to_work_interviews IS 'Wellbeing-focused return to work conversations after sick leave';
COMMENT ON TABLE ssp_periods IS 'Tracks Statutory Sick Pay periods and eligibility';
COMMENT ON TABLE statutory_leave_entitlements IS 'Tracks statutory leave usage per employee per year';
COMMENT ON TABLE absence_category_settings IS 'Tenant-configurable settings for each absence type';

COMMENT ON COLUMN leave_requests.absence_category IS 'Type of absence: annual, sick, maternity, etc.';
COMMENT ON COLUMN leave_requests.fit_note_required IS 'True if absence exceeds self-certification period (7 days UK)';
COMMENT ON COLUMN leave_requests.rtw_required IS 'True if return to work interview is required';
COMMENT ON COLUMN return_to_work_interviews.feeling_ready IS 'Employee indicates if they feel ready to return';
COMMENT ON COLUMN return_to_work_interviews.oh_referral_recommended IS 'Manager recommends occupational health referral';
