-- Migration: 013_recruitment_pipeline.sql
-- Description: Full recruitment pipeline with interviews, notes, and offer workflow

-- ============================================
-- UPDATE CANDIDATES TABLE FOR RECRUITMENT STAGES
-- ============================================

-- Create recruitment stage enum type
DO $$ BEGIN
  CREATE TYPE recruitment_stage AS ENUM (
    'application',
    'shortlisted',
    'interview_requested',
    'interview_scheduled',
    'interview_complete',
    'further_assessment',
    'final_shortlist',
    'offer_made',
    'offer_accepted',
    'offer_declined',
    'rejected',
    'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add recruitment stage to candidates (separate from onboarding stage)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruitment_stage VARCHAR(30) DEFAULT 'application';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruitment_stage_updated_at TIMESTAMP;

-- Add offer-related fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS further_assessment_required BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS offer_date DATE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS offer_expiry_date DATE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS offer_salary DECIMAL(10, 2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS offer_start_date DATE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;

-- Add constraint for valid recruitment stages
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS valid_recruitment_stage;
ALTER TABLE candidates ADD CONSTRAINT valid_recruitment_stage CHECK (
  recruitment_stage IN (
    'application', 'shortlisted', 'interview_requested', 'interview_scheduled',
    'interview_complete', 'further_assessment', 'final_shortlist', 'offer_made',
    'offer_accepted', 'offer_declined', 'rejected', 'withdrawn'
  )
);

-- Index for recruitment stage queries
CREATE INDEX IF NOT EXISTS idx_candidates_recruitment_stage ON candidates(recruitment_stage);

-- ============================================
-- CANDIDATE INTERVIEWS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS candidate_interviews (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

  -- Interview details
  interview_type VARCHAR(30) NOT NULL CHECK (interview_type IN (
    'phone_screen', 'first_interview', 'second_interview', 'technical', 'panel', 'final'
  )),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT, -- Room name or video link

  -- Interviewers (stored as JSON array of user IDs)
  interviewer_ids INTEGER[] DEFAULT '{}',

  -- Status and outcome
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'completed', 'cancelled', 'no_show'
  )),
  score INTEGER CHECK (score IS NULL OR (score >= 1 AND score <= 10)),
  notes TEXT,
  recommend_next_stage BOOLEAN,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  -- Who scheduled it
  scheduled_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON candidate_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON candidate_interviews(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON candidate_interviews(status);

-- ============================================
-- CANDIDATE NOTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS candidate_notes (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),

  -- Note details
  note_type VARCHAR(30) DEFAULT 'general' CHECK (note_type IN (
    'general', 'screening', 'interview_feedback', 'reference', 'concern', 'positive', 'stage_change', 'offer'
  )),
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false, -- Only visible to author and admin

  -- For stage change notes
  from_stage VARCHAR(30),
  to_stage VARCHAR(30),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_candidate ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON candidate_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_type ON candidate_notes(note_type);

-- ============================================
-- STAGE HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS candidate_stage_history (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  from_stage VARCHAR(30),
  to_stage VARCHAR(30) NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stage_history_candidate ON candidate_stage_history(candidate_id);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN candidates.recruitment_stage IS 'Current stage in recruitment pipeline';
COMMENT ON COLUMN candidates.stage IS 'Onboarding stage (candidate/pre_colleague/active) - used after offer_accepted';
COMMENT ON TABLE candidate_interviews IS 'Interview scheduling and scoring';
COMMENT ON TABLE candidate_notes IS 'Notes and feedback on candidates';
COMMENT ON TABLE candidate_stage_history IS 'Audit trail of stage transitions';
