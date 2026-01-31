-- Migration 032: Offboarding Workflow
-- VoidStaffOS - Structured offboarding with compliance, knowledge transfer, asset recovery
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Created: 2026-01-31
-- PROPRIETARY AND CONFIDENTIAL

-- Termination types enum
DO $$ BEGIN
    CREATE TYPE termination_type AS ENUM (
        'resignation',
        'termination',
        'redundancy',
        'retirement',
        'end_of_contract',
        'tupe_transfer',
        'death_in_service'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Offboarding status enum
DO $$ BEGIN
    CREATE TYPE offboarding_status AS ENUM (
        'pending',
        'in_progress',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Checklist item types enum
DO $$ BEGIN
    CREATE TYPE checklist_item_type AS ENUM (
        'equipment_return',
        'it_access_revoke',
        'badge_collection',
        'key_return',
        'handover_docs',
        'exit_interview',
        'final_pay',
        'p45_issued',
        'reference_policy',
        'data_retention',
        'manager_signoff',
        'hr_signoff',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main offboarding workflow table
CREATE TABLE IF NOT EXISTS offboarding_workflows (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Exit details
    termination_type termination_type NOT NULL,
    status offboarding_status NOT NULL DEFAULT 'pending',

    -- Key dates
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,

    -- Reason (optional, for HR records)
    reason TEXT,

    -- Flags
    eligible_for_rehire BOOLEAN,
    reference_agreed BOOLEAN DEFAULT true,

    -- Workflow tracking
    initiated_by INTEGER REFERENCES users(id),
    manager_id INTEGER REFERENCES users(id),
    hr_owner_id INTEGER REFERENCES users(id),

    -- Completion
    completed_at TIMESTAMP,
    completed_by INTEGER REFERENCES users(id),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate active workflows for same employee
    CONSTRAINT unique_active_offboarding UNIQUE (tenant_id, employee_id, status)
);

-- Offboarding checklist items
CREATE TABLE IF NOT EXISTS offboarding_checklist_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id INTEGER NOT NULL REFERENCES offboarding_workflows(id) ON DELETE CASCADE,

    item_type checklist_item_type NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Assignment
    assigned_to INTEGER REFERENCES users(id),
    assigned_role VARCHAR(50), -- 'IT', 'HR', 'Manager', 'Employee', 'Payroll'
    due_date DATE,

    -- Completion
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMP,
    completion_notes TEXT,

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Exit interviews
CREATE TABLE IF NOT EXISTS exit_interviews (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id INTEGER NOT NULL REFERENCES offboarding_workflows(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Scheduling
    scheduled_date DATE,
    scheduled_time TIME,
    interviewer_id INTEGER REFERENCES users(id),

    -- Interview status
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP,

    -- Feedback (structured)
    overall_experience INTEGER CHECK (overall_experience BETWEEN 1 AND 5),
    would_recommend_employer BOOLEAN,
    would_consider_return BOOLEAN,

    -- Feedback (open)
    reason_for_leaving TEXT,
    feedback_management TEXT,
    feedback_role TEXT,
    feedback_culture TEXT,
    feedback_improvements TEXT,
    additional_comments TEXT,

    -- HR notes (not visible to employee)
    hr_notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- One exit interview per workflow
    CONSTRAINT unique_exit_interview UNIQUE (workflow_id)
);

-- Handover items tracking
CREATE TABLE IF NOT EXISTS offboarding_handovers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id INTEGER NOT NULL REFERENCES offboarding_workflows(id) ON DELETE CASCADE,

    -- What's being handed over
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL, -- 'project', 'client', 'document', 'system_access', 'responsibility', 'other'
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'

    -- Who's receiving
    handover_to INTEGER REFERENCES users(id),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
    completed_at TIMESTAMP,
    notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offboarding_employee ON offboarding_workflows(employee_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_tenant ON offboarding_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_status ON offboarding_workflows(status);
CREATE INDEX IF NOT EXISTS idx_offboarding_last_day ON offboarding_workflows(last_working_day);
CREATE INDEX IF NOT EXISTS idx_checklist_workflow ON offboarding_checklist_items(workflow_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assigned ON offboarding_checklist_items(assigned_to) WHERE completed = false;
CREATE INDEX IF NOT EXISTS idx_exit_interview_workflow ON exit_interviews(workflow_id);
CREATE INDEX IF NOT EXISTS idx_handover_workflow ON offboarding_handovers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_handover_to ON offboarding_handovers(handover_to) WHERE status != 'completed';

-- Trigger for updated_at on offboarding_workflows
CREATE OR REPLACE FUNCTION update_offboarding_workflow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS offboarding_workflow_updated ON offboarding_workflows;
CREATE TRIGGER offboarding_workflow_updated
    BEFORE UPDATE ON offboarding_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_offboarding_workflow_timestamp();

-- Trigger for updated_at on exit_interviews
DROP TRIGGER IF EXISTS exit_interview_updated ON exit_interviews;
CREATE TRIGGER exit_interview_updated
    BEFORE UPDATE ON exit_interviews
    FOR EACH ROW
    EXECUTE FUNCTION update_offboarding_workflow_timestamp();

-- Trigger for updated_at on offboarding_handovers
DROP TRIGGER IF EXISTS handover_updated ON offboarding_handovers;
CREATE TRIGGER handover_updated
    BEFORE UPDATE ON offboarding_handovers
    FOR EACH ROW
    EXECUTE FUNCTION update_offboarding_workflow_timestamp();

-- Add notification types for offboarding
DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offboarding_initiated';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offboarding_task_assigned';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'exit_interview_scheduled';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'handover_assigned';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offboarding_completed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Comments
COMMENT ON TABLE offboarding_workflows IS 'Main offboarding workflow tracking - one per employee exit';
COMMENT ON TABLE offboarding_checklist_items IS 'Checklist items for offboarding compliance';
COMMENT ON TABLE exit_interviews IS 'Exit interview feedback and scheduling';
COMMENT ON TABLE offboarding_handovers IS 'Knowledge transfer and handover tracking';
