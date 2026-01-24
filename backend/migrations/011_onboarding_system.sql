-- Migration: 011_onboarding_system.sql
-- Description: Onboarding system with Candidate → Pre-Colleague → Active stages

-- Candidates table
CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  postcode VARCHAR(20),
  dob DATE,
  proposed_start_date DATE,
  actual_start_date DATE,
  proposed_role_id INTEGER REFERENCES roles(id),
  proposed_tier INTEGER CHECK (proposed_tier IS NULL OR (proposed_tier >= 1 AND proposed_tier <= 5)),
  proposed_salary DECIMAL(10, 2),
  proposed_hours DECIMAL(4, 1) DEFAULT 40.0,
  skills_experience TEXT,
  notes TEXT,
  contract_signed BOOLEAN DEFAULT false,
  contract_signed_date DATE,
  stage VARCHAR(20) DEFAULT 'candidate' CHECK (stage IN ('candidate', 'pre_colleague', 'active')),
  user_id INTEGER REFERENCES users(id), -- Linked user account when promoted to pre_colleague
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Candidate references table
CREATE TABLE candidate_references (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  reference_name VARCHAR(255) NOT NULL,
  reference_company VARCHAR(255),
  reference_email VARCHAR(255),
  reference_phone VARCHAR(50),
  relationship VARCHAR(100), -- e.g., "Previous Manager", "Colleague"
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'requested', 'received', 'verified')),
  reference_notes TEXT,
  received_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Background checks table
CREATE TABLE background_checks (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  check_type VARCHAR(30) NOT NULL CHECK (check_type IN ('dbs_basic', 'dbs_enhanced', 'right_to_work', 'qualification_verify', 'other')),
  check_type_other VARCHAR(100), -- Description if check_type is 'other'
  status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'submitted', 'in_progress', 'cleared', 'failed')),
  required BOOLEAN DEFAULT true,
  submitted_date DATE,
  completed_date DATE,
  certificate_number VARCHAR(100),
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Onboarding tasks table
CREATE TABLE onboarding_tasks (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  task_description TEXT,
  task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('document_read', 'form_submit', 'check_complete', 'meeting', 'training')),
  required_before_start BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMP,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Policies table
CREATE TABLE policies (
  id SERIAL PRIMARY KEY,
  policy_name VARCHAR(255) NOT NULL,
  policy_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  policy_content TEXT,
  policy_link VARCHAR(500),
  requires_acknowledgment BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Policy acknowledgments table
CREATE TABLE policy_acknowledgments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  candidate_id INTEGER REFERENCES candidates(id),
  policy_id INTEGER NOT NULL REFERENCES policies(id),
  acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  UNIQUE(user_id, policy_id),
  UNIQUE(candidate_id, policy_id)
);

-- Day One plan items
CREATE TABLE day_one_items (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  time_slot VARCHAR(20), -- e.g., "09:00", "10:30"
  activity VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  meeting_with VARCHAR(255), -- Person they're meeting
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_candidates_stage ON candidates(stage);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_candidate_refs_candidate ON candidate_references(candidate_id);
CREATE INDEX idx_candidate_refs_status ON candidate_references(status);
CREATE INDEX idx_background_checks_candidate ON background_checks(candidate_id);
CREATE INDEX idx_background_checks_status ON background_checks(status);
CREATE INDEX idx_onboarding_tasks_candidate ON onboarding_tasks(candidate_id);
CREATE INDEX idx_onboarding_tasks_status ON onboarding_tasks(status);
CREATE INDEX idx_policy_acks_user ON policy_acknowledgments(user_id);
CREATE INDEX idx_policy_acks_candidate ON policy_acknowledgments(candidate_id);

-- Insert default policies
INSERT INTO policies (policy_name, policy_version, policy_content, requires_acknowledgment) VALUES
('Employee Handbook', '1.0', 'The employee handbook contains all company policies, procedures, and expectations. Please read thoroughly before your start date.', true),
('Health and Safety Policy', '1.0', 'This policy outlines health and safety requirements, emergency procedures, and your responsibilities for maintaining a safe workplace.', true),
('Data Protection and Privacy Policy', '1.0', 'This policy explains how we handle personal data, your rights under GDPR, and your responsibilities when handling customer and colleague data.', true),
('IT Acceptable Use Policy', '1.0', 'This policy covers acceptable use of company IT systems, email, internet access, and data security requirements.', true),
('Code of Conduct', '1.0', 'Our code of conduct outlines expected professional behaviour, ethics, and workplace standards.', true),
('Anti-Harassment and Bullying Policy', '1.0', 'This policy defines harassment and bullying, explains the reporting process, and outlines consequences for violations.', true);

-- Comments
COMMENT ON TABLE candidates IS 'Tracks individuals through the hiring pipeline: candidate → pre_colleague → active';
COMMENT ON COLUMN candidates.stage IS 'Current stage: candidate (interviewing), pre_colleague (offer accepted, onboarding), active (started work)';
COMMENT ON COLUMN candidates.user_id IS 'Linked to users table when promoted to pre_colleague';
COMMENT ON COLUMN background_checks.required IS 'If true, must be cleared before promotion to pre_colleague';
COMMENT ON COLUMN onboarding_tasks.required_before_start IS 'If true, must be completed before promotion to active';
