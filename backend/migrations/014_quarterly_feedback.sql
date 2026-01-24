-- Migration: 014_quarterly_feedback.sql
-- 360 Feedback System for Quarterly Reviews

-- Quarterly feedback table
CREATE TABLE IF NOT EXISTS quarterly_feedback (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_type VARCHAR(20) NOT NULL CHECK (reviewer_type IN ('manager', 'skip_level', 'direct_report', 'self')),
    quarter VARCHAR(10) NOT NULL, -- e.g., 'Q1-2025'

    -- Ratings (1-10 scale)
    tasks_completed DECIMAL(3,1) CHECK (tasks_completed >= 1 AND tasks_completed <= 10),
    work_volume DECIMAL(3,1) CHECK (work_volume >= 1 AND work_volume <= 10),
    problem_solving DECIMAL(3,1) CHECK (problem_solving >= 1 AND problem_solving <= 10),
    communication DECIMAL(3,1) CHECK (communication >= 1 AND communication <= 10),
    leadership DECIMAL(3,1) CHECK (leadership >= 1 AND leadership <= 10),

    comments TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint: one feedback per reviewer per employee per quarter
    UNIQUE(employee_id, reviewer_id, quarter)
);

-- Feedback requests table (tracks who needs to provide feedback)
CREATE TABLE IF NOT EXISTS feedback_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_type VARCHAR(20) NOT NULL CHECK (reviewer_type IN ('manager', 'skip_level', 'direct_report', 'self')),
    quarter VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'skipped')),
    deadline DATE,
    reminded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id, reviewer_id, quarter)
);

-- Quarterly feedback cycles table (tracks overall cycle status)
CREATE TABLE IF NOT EXISTS feedback_cycles (
    id SERIAL PRIMARY KEY,
    quarter VARCHAR(10) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    started_by INTEGER REFERENCES users(id),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deadline DATE,
    closed_at TIMESTAMP
);

-- Composite results table (stores calculated 360 results)
CREATE TABLE IF NOT EXISTS quarterly_composites (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quarter VARCHAR(10) NOT NULL,

    -- Final composite KPIs
    velocity DECIMAL(4,2),
    friction DECIMAL(4,2),
    cohesion DECIMAL(4,2),

    -- Source breakdown for transparency
    manager_velocity DECIMAL(4,2),
    manager_friction DECIMAL(4,2),
    manager_cohesion DECIMAL(4,2),

    skip_level_velocity DECIMAL(4,2),
    skip_level_friction DECIMAL(4,2),
    skip_level_cohesion DECIMAL(4,2),

    direct_reports_velocity DECIMAL(4,2),
    direct_reports_friction DECIMAL(4,2),
    direct_reports_cohesion DECIMAL(4,2),

    self_velocity DECIMAL(4,2),
    self_friction DECIMAL(4,2),
    self_cohesion DECIMAL(4,2),

    -- Countersign tracking
    employee_signed_at TIMESTAMP,
    manager_signed_at TIMESTAMP,

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id, quarter)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quarterly_feedback_employee ON quarterly_feedback(employee_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_feedback_reviewer ON quarterly_feedback(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_feedback_quarter ON quarterly_feedback(quarter);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_reviewer ON feedback_requests(reviewer_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_quarter ON feedback_requests(quarter);
CREATE INDEX IF NOT EXISTS idx_quarterly_composites_employee ON quarterly_composites(employee_id);

-- Add notification type for feedback requests
DO $$
BEGIN
    -- Check if the type constraint allows feedback types, if not we'll handle in app layer
    -- Notifications will use type 'feedback_request', 'feedback_reminder', 'feedback_complete'
END $$;
