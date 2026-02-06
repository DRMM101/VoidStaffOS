/**
 * HeadOfficeOS - Migration 027: Probation Management
 * Probation periods and review milestones for new employees.
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
 * Module: Probation Management
 */

BEGIN;

-- ===========================================
-- CREATE TYPES
-- ===========================================

DO $$ BEGIN
    CREATE TYPE probation_status AS ENUM (
        'active',
        'extended',
        'passed',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE probation_outcome AS ENUM (
        'passed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE probation_review_type AS ENUM (
        '1_month',
        '3_month',
        '6_month',
        'final',
        'extension'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE probation_review_status AS ENUM (
        'pending',
        'in_progress',
        'completed',
        'skipped'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE probation_recommendation AS ENUM (
        'continue',
        'extend',
        'pass',
        'fail'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- PROBATION PERIODS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS probation_periods (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    original_end_date DATE,  -- Stored when extended

    -- Duration
    duration_months INTEGER NOT NULL DEFAULT 6,

    -- Status
    status probation_status NOT NULL DEFAULT 'active',

    -- Extension info
    extended BOOLEAN DEFAULT false,
    extension_weeks INTEGER,
    extension_reason TEXT,

    -- Outcome
    outcome probation_outcome,
    outcome_date DATE,
    outcome_notes TEXT,
    outcome_by INTEGER REFERENCES users(id),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

-- Partial unique index for one active probation per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_probation_one_active
    ON probation_periods (tenant_id, employee_id)
    WHERE status = 'active' OR status = 'extended';

-- ===========================================
-- PROBATION REVIEWS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS probation_reviews (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    probation_id INTEGER NOT NULL REFERENCES probation_periods(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Review type and scheduling
    review_type probation_review_type NOT NULL,
    review_number INTEGER NOT NULL DEFAULT 1,
    scheduled_date DATE NOT NULL,

    -- Status
    status probation_review_status NOT NULL DEFAULT 'pending',
    completed_date DATE,
    completed_by INTEGER REFERENCES users(id),

    -- Review content
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 5),
    meeting_expectations BOOLEAN,
    areas_of_strength TEXT,
    areas_for_improvement TEXT,
    support_provided TEXT,
    support_needed TEXT,
    objectives_for_next_period TEXT,
    manager_notes TEXT,

    -- Recommendation
    recommendation probation_recommendation,

    -- Manager sign-off
    manager_signed BOOLEAN DEFAULT false,
    manager_signed_at TIMESTAMP WITH TIME ZONE,
    manager_id INTEGER REFERENCES users(id),

    -- Employee acknowledgment
    employee_acknowledged BOOLEAN DEFAULT false,
    employee_acknowledged_at TIMESTAMP WITH TIME ZONE,
    employee_comments TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Probation periods indexes
CREATE INDEX IF NOT EXISTS idx_probation_tenant ON probation_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_probation_employee ON probation_periods(employee_id);
CREATE INDEX IF NOT EXISTS idx_probation_status ON probation_periods(status);
CREATE INDEX IF NOT EXISTS idx_probation_tenant_status ON probation_periods(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_probation_end_date ON probation_periods(end_date);
CREATE INDEX IF NOT EXISTS idx_probation_tenant_employee ON probation_periods(tenant_id, employee_id);

-- Probation reviews indexes
CREATE INDEX IF NOT EXISTS idx_probation_review_tenant ON probation_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_probation_review_probation ON probation_reviews(probation_id);
CREATE INDEX IF NOT EXISTS idx_probation_review_employee ON probation_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_probation_review_status ON probation_reviews(status);
CREATE INDEX IF NOT EXISTS idx_probation_review_scheduled ON probation_reviews(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_probation_review_tenant_status ON probation_reviews(tenant_id, status);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE probation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE probation_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS probation_periods_tenant_isolation ON probation_periods;
DROP POLICY IF EXISTS probation_reviews_tenant_isolation ON probation_reviews;

-- Create tenant isolation policies
CREATE POLICY probation_periods_tenant_isolation ON probation_periods
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY probation_reviews_tenant_isolation ON probation_reviews
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- ===========================================
-- AUTO-UPDATE TIMESTAMP TRIGGERS
-- ===========================================

CREATE OR REPLACE FUNCTION update_probation_period_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS probation_period_timestamp_trigger ON probation_periods;
CREATE TRIGGER probation_period_timestamp_trigger
    BEFORE UPDATE ON probation_periods
    FOR EACH ROW EXECUTE FUNCTION update_probation_period_timestamp();

CREATE OR REPLACE FUNCTION update_probation_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS probation_review_timestamp_trigger ON probation_reviews;
CREATE TRIGGER probation_review_timestamp_trigger
    BEFORE UPDATE ON probation_reviews
    FOR EACH ROW EXECUTE FUNCTION update_probation_review_timestamp();

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE probation_periods IS 'Employee probation periods with status tracking';
COMMENT ON TABLE probation_reviews IS 'Scheduled review milestones during probation';
COMMENT ON COLUMN probation_periods.duration_months IS 'Standard probation duration (default 6 months)';
COMMENT ON COLUMN probation_periods.extended IS 'Whether probation has been extended';
COMMENT ON COLUMN probation_periods.original_end_date IS 'Original end date before any extensions';
COMMENT ON COLUMN probation_reviews.review_type IS 'Type of review: 1_month, 3_month, 6_month, final, or extension';
COMMENT ON COLUMN probation_reviews.recommendation IS 'Manager recommendation: continue, extend, pass, or fail';

COMMIT;
