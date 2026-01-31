-- Migration 033: PIP, Disciplinary, and Grievance Management
-- ACAS-compliant HR case management with full audit trails

-- Case types
DO $$ BEGIN
  CREATE TYPE hr_case_type AS ENUM (
    'pip',
    'disciplinary',
    'grievance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Case status
DO $$ BEGIN
  CREATE TYPE hr_case_status AS ENUM (
    'draft',
    'open',
    'investigation',
    'hearing_scheduled',
    'awaiting_decision',
    'appeal',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PIP outcomes
DO $$ BEGIN
  CREATE TYPE pip_outcome AS ENUM (
    'passed',
    'extended',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Disciplinary outcomes
DO $$ BEGIN
  CREATE TYPE disciplinary_outcome AS ENUM (
    'no_action',
    'verbal_warning',
    'written_warning',
    'final_warning',
    'dismissal',
    'appeal_upheld',
    'appeal_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grievance outcomes
DO $$ BEGIN
  CREATE TYPE grievance_outcome AS ENUM (
    'upheld',
    'partially_upheld',
    'not_upheld',
    'withdrawn',
    'appeal_upheld',
    'appeal_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main cases table
CREATE TABLE IF NOT EXISTS hr_cases (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  employee_id INTEGER NOT NULL REFERENCES users(id),

  -- Case details
  case_type hr_case_type NOT NULL,
  case_reference VARCHAR(50),
  status hr_case_status DEFAULT 'draft',

  -- Dates
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_close_date DATE,
  closed_date DATE,

  -- Ownership
  opened_by INTEGER NOT NULL REFERENCES users(id),
  case_owner_id INTEGER REFERENCES users(id),
  manager_id INTEGER REFERENCES users(id),

  -- Details
  summary TEXT NOT NULL,
  background TEXT,

  -- Outcomes (use appropriate one based on case_type)
  pip_outcome pip_outcome,
  disciplinary_outcome disciplinary_outcome,
  grievance_outcome grievance_outcome,
  outcome_notes TEXT,
  outcome_date DATE,
  outcome_by INTEGER REFERENCES users(id),

  -- Appeal
  appeal_requested BOOLEAN DEFAULT false,
  appeal_date DATE,
  appeal_outcome TEXT,
  appeal_heard_by INTEGER REFERENCES users(id),

  -- Flags
  confidential BOOLEAN DEFAULT true,
  legal_hold BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PIP objectives (SMART goals)
CREATE TABLE IF NOT EXISTS pip_objectives (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  case_id INTEGER NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,

  objective TEXT NOT NULL,
  success_criteria TEXT NOT NULL,
  support_provided TEXT,
  target_date DATE NOT NULL,

  -- Review
  status VARCHAR(20) DEFAULT 'pending',
  review_notes TEXT,
  reviewed_date DATE,
  reviewed_by INTEGER REFERENCES users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case milestones/timeline
CREATE TABLE IF NOT EXISTS hr_case_milestones (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  case_id INTEGER NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,

  milestone_type VARCHAR(50) NOT NULL,
  milestone_date DATE NOT NULL,
  description TEXT,

  completed BOOLEAN DEFAULT false,
  completed_date DATE,
  completed_by INTEGER REFERENCES users(id),

  -- Documents
  document_ids INTEGER[],

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case meetings (hearings, reviews, appeals)
CREATE TABLE IF NOT EXISTS hr_case_meetings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  case_id INTEGER NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,

  meeting_type VARCHAR(50) NOT NULL,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  location TEXT,

  -- Attendees
  attendees INTEGER[],
  companion_name VARCHAR(255),
  companion_type VARCHAR(50),

  -- Outcome
  held BOOLEAN DEFAULT false,
  held_date DATE,
  minutes TEXT,
  outcome_summary TEXT,

  -- Adjourned/rescheduled
  adjourned BOOLEAN DEFAULT false,
  adjourn_reason TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case notes (audit trail)
CREATE TABLE IF NOT EXISTS hr_case_notes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  case_id INTEGER NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,

  note_type VARCHAR(50) DEFAULT 'general',
  content TEXT NOT NULL,

  -- Visibility
  visible_to_employee BOOLEAN DEFAULT false,

  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Witness statements
CREATE TABLE IF NOT EXISTS hr_case_witnesses (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  case_id INTEGER NOT NULL REFERENCES hr_cases(id) ON DELETE CASCADE,

  witness_name VARCHAR(255) NOT NULL,
  witness_id INTEGER REFERENCES users(id),
  relationship VARCHAR(100),

  statement TEXT,
  statement_date DATE,
  document_id INTEGER, -- Reference to employee_documents if applicable

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate case reference function
CREATE OR REPLACE FUNCTION generate_case_reference()
RETURNS TRIGGER AS $$
DECLARE
  prefix VARCHAR(10);
  year_str VARCHAR(4);
  seq INTEGER;
BEGIN
  prefix := CASE NEW.case_type
    WHEN 'pip' THEN 'PIP'
    WHEN 'disciplinary' THEN 'DISC'
    WHEN 'grievance' THEN 'GRIEV'
  END;

  year_str := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(case_reference, '-', 3) AS INTEGER)
  ), 0) + 1 INTO seq
  FROM hr_cases
  WHERE tenant_id = NEW.tenant_id
    AND case_type = NEW.case_type
    AND case_reference LIKE prefix || '-' || year_str || '-%';

  NEW.case_reference := prefix || '-' || year_str || '-' || LPAD(seq::VARCHAR, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for case reference
DROP TRIGGER IF EXISTS set_case_reference ON hr_cases;
CREATE TRIGGER set_case_reference
  BEFORE INSERT ON hr_cases
  FOR EACH ROW
  WHEN (NEW.case_reference IS NULL)
  EXECUTE FUNCTION generate_case_reference();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hr_cases_employee ON hr_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_cases_tenant ON hr_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_cases_type ON hr_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_hr_cases_status ON hr_cases(status);
CREATE INDEX IF NOT EXISTS idx_pip_objectives_case ON pip_objectives(case_id);
CREATE INDEX IF NOT EXISTS idx_case_milestones_case ON hr_case_milestones(case_id);
CREATE INDEX IF NOT EXISTS idx_case_meetings_case ON hr_case_meetings(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_case ON hr_case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_witnesses_case ON hr_case_witnesses(case_id);

-- Add HR case notification types
DO $$ BEGIN
  ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'hr_case_opened';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'hr_case_meeting_scheduled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'hr_case_outcome_recorded';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'hr_case_appeal_submitted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'pip_objective_due';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'grievance_submitted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
