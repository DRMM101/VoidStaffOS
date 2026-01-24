-- Migration: Leave Request System and Employee Transfer Support
-- Adds annual leave entitlement, leave requests table, and skip_week flag for reviews

-- Add annual leave entitlement to users (default 28 days per year in UK)
ALTER TABLE users ADD COLUMN IF NOT EXISTS annual_leave_entitlement DECIMAL(4,1) DEFAULT 28;

-- Create leave type enum
DO $$ BEGIN
    CREATE TYPE leave_type_enum AS ENUM ('full_day', 'half_day_am', 'half_day_pm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create leave status enum
DO $$ BEGIN
    CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id),
    manager_id INTEGER REFERENCES users(id),
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    leave_start_date DATE NOT NULL,
    leave_end_date DATE NOT NULL,
    leave_type leave_type_enum NOT NULL DEFAULT 'full_day',
    total_days DECIMAL(4,1) NOT NULL,
    status leave_status_enum NOT NULL DEFAULT 'pending',
    notice_days INTEGER NOT NULL,
    required_notice_days INTEGER NOT NULL,
    meets_notice_requirement BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    rejection_reason TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_date_range CHECK (leave_end_date >= leave_start_date),
    CONSTRAINT valid_total_days CHECK (total_days > 0)
);

-- Add skip_week flag to reviews table for employees on leave
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS skip_week BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Create indexes for leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_manager ON leave_requests(manager_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(leave_start_date, leave_end_date);

-- Function to calculate working days between two dates (excluding weekends)
CREATE OR REPLACE FUNCTION calculate_working_days(p_start_date DATE, p_end_date DATE)
RETURNS INTEGER AS $$
DECLARE
    working_days INTEGER := 0;
    curr_date DATE := p_start_date;
BEGIN
    WHILE curr_date <= p_end_date LOOP
        -- 0 = Sunday, 6 = Saturday in PostgreSQL's EXTRACT(DOW FROM date)
        IF EXTRACT(DOW FROM curr_date) NOT IN (0, 6) THEN
            working_days := working_days + 1;
        END IF;
        curr_date := curr_date + 1;
    END LOOP;
    RETURN working_days;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate required notice days based on leave duration
CREATE OR REPLACE FUNCTION calculate_required_notice(p_total_days DECIMAL)
RETURNS INTEGER AS $$
BEGIN
    -- Half days (0.5) treated as 1 day for notice calculation
    -- 1-4 working days = 2x notice required
    -- 5+ working days = 30 days (1 month) notice required
    IF p_total_days >= 5 THEN
        RETURN 30;
    ELSE
        -- Ceiling to treat half days as full days for notice
        RETURN CEIL(p_total_days) * 2;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment for clarity
COMMENT ON TABLE leave_requests IS 'Employee leave/annual holiday requests with policy enforcement';
COMMENT ON COLUMN leave_requests.notice_days IS 'Actual days between request_date and leave_start_date';
COMMENT ON COLUMN leave_requests.required_notice_days IS 'Required notice based on policy (2x for 1-4 days, 30 days for 5+ days)';
COMMENT ON COLUMN reviews.skip_week IS 'If true, review is auto-skipped (e.g., employee on leave >2 days)';
