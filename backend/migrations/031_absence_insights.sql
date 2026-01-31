-- Migration 031: Absence Insights
-- VoidStaffOS - Pattern detection and reporting for HR review
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Created: 2026-01-31
-- PROPRIETARY AND CONFIDENTIAL

-- Pattern types enum
DO $$ BEGIN
    CREATE TYPE absence_pattern_type AS ENUM (
        'frequency',           -- High absence frequency
        'monday_friday',       -- Pattern around weekends
        'post_holiday',        -- Absences after annual leave
        'duration_trend',      -- Increasing absence durations
        'seasonal',            -- Same time each year
        'short_notice',        -- Frequent same-day reporting
        'recurring_reason'     -- Same reason repeatedly
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Insight status enum
DO $$ BEGIN
    CREATE TYPE insight_status AS ENUM (
        'new',                 -- Just detected
        'pending_review',      -- Awaiting HR review
        'reviewed',            -- HR has reviewed
        'action_taken',        -- Follow-up action taken
        'dismissed'            -- Dismissed as not concerning
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Insight priority enum
DO $$ BEGIN
    CREATE TYPE insight_priority AS ENUM (
        'low',
        'medium',
        'high'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Absence insights table - individual detected patterns
CREATE TABLE IF NOT EXISTS absence_insights (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_type absence_pattern_type NOT NULL,
    priority insight_priority NOT NULL DEFAULT 'medium',
    status insight_status NOT NULL DEFAULT 'new',

    -- Pattern details
    detection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Pattern-specific data (JSON for flexibility)
    pattern_data JSONB NOT NULL DEFAULT '{}',
    -- Examples:
    -- frequency: {"count": 6, "period_days": 90, "threshold": 3}
    -- monday_friday: {"monday_count": 4, "friday_count": 3, "total_absences": 10, "percentage": 70}
    -- post_holiday: {"occurrences": [{"holiday_end": "2026-01-15", "absence_start": "2026-01-16"}]}
    -- duration_trend: {"periods": [{"period": "Q3", "avg_days": 1.5}, {"period": "Q4", "avg_days": 2.8}]}

    -- Related absences
    related_absence_ids INTEGER[] DEFAULT '{}',

    -- Human-readable summary
    summary TEXT NOT NULL,

    -- Review tracking
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,

    -- Action tracking
    action_taken TEXT,
    action_by INTEGER REFERENCES users(id),
    action_at TIMESTAMP,
    follow_up_date DATE,

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_period CHECK (period_end >= period_start)
);

-- Absence summaries table - rolling statistics per employee
CREATE TABLE IF NOT EXISTS absence_summaries (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Rolling 12-month stats
    total_sick_days_12m DECIMAL(5,1) NOT NULL DEFAULT 0,
    total_absences_12m INTEGER NOT NULL DEFAULT 0,
    avg_duration_12m DECIMAL(4,2) NOT NULL DEFAULT 0,

    -- Pattern counts (for quick filtering)
    monday_absences_12m INTEGER NOT NULL DEFAULT 0,
    friday_absences_12m INTEGER NOT NULL DEFAULT 0,
    same_day_reports_12m INTEGER NOT NULL DEFAULT 0,

    -- Bradford Factor (trigger points)
    -- Formula: S² × D where S = spells, D = total days
    bradford_factor INTEGER NOT NULL DEFAULT 0,
    bradford_updated_at TIMESTAMP,

    -- Last absence tracking
    last_absence_date DATE,
    last_absence_duration INTEGER,
    last_absence_reason TEXT,

    -- SSP tracking
    ssp_days_used_tax_year INTEGER NOT NULL DEFAULT 0,
    ssp_weeks_remaining DECIMAL(4,2),

    -- Comparison data
    team_avg_sick_days DECIMAL(5,1),
    dept_avg_sick_days DECIMAL(5,1),
    company_avg_sick_days DECIMAL(5,1),

    -- Last calculation
    calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Unique per employee per tenant
    CONSTRAINT unique_employee_summary UNIQUE (tenant_id, employee_id)
);

-- Insight review history (audit trail)
CREATE TABLE IF NOT EXISTS insight_review_history (
    id SERIAL PRIMARY KEY,
    insight_id INTEGER NOT NULL REFERENCES absence_insights(id) ON DELETE CASCADE,
    previous_status insight_status NOT NULL,
    new_status insight_status NOT NULL,
    changed_by INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_absence_insights_tenant ON absence_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_absence_insights_employee ON absence_insights(employee_id);
CREATE INDEX IF NOT EXISTS idx_absence_insights_status ON absence_insights(status);
CREATE INDEX IF NOT EXISTS idx_absence_insights_priority ON absence_insights(priority);
CREATE INDEX IF NOT EXISTS idx_absence_insights_detection_date ON absence_insights(detection_date);
CREATE INDEX IF NOT EXISTS idx_absence_insights_pattern_type ON absence_insights(pattern_type);
CREATE INDEX IF NOT EXISTS idx_absence_insights_pending ON absence_insights(tenant_id, status) WHERE status IN ('new', 'pending_review');

CREATE INDEX IF NOT EXISTS idx_absence_summaries_tenant ON absence_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_absence_summaries_employee ON absence_summaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_absence_summaries_bradford ON absence_summaries(bradford_factor DESC);

CREATE INDEX IF NOT EXISTS idx_insight_review_history_insight ON insight_review_history(insight_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_absence_insights_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS absence_insights_updated ON absence_insights;
CREATE TRIGGER absence_insights_updated
    BEFORE UPDATE ON absence_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_absence_insights_timestamp();

-- Comment on tables
COMMENT ON TABLE absence_insights IS 'Detected absence patterns for HR review - wellbeing focused, not punitive';
COMMENT ON TABLE absence_summaries IS 'Rolling absence statistics per employee for quick dashboard display';
COMMENT ON TABLE insight_review_history IS 'Audit trail of insight status changes';

COMMENT ON COLUMN absence_insights.bradford_factor IS 'S² × D formula - higher scores indicate more frequent short absences';
COMMENT ON COLUMN absence_summaries.bradford_factor IS 'Pre-calculated Bradford Factor for quick access';
