-- Migration 036: Internal Opportunities
-- Creates tables for internal job postings and employee applications.
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.

-- =====================================================
-- Internal job postings
-- =====================================================
CREATE TABLE IF NOT EXISTS internal_opportunities (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  location VARCHAR(100),
  employment_type VARCHAR(50) CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary')),
  description TEXT,
  requirements TEXT,
  salary_range_min INTEGER,        -- annual salary in pence (or smallest currency unit)
  salary_range_max INTEGER,
  show_salary BOOLEAN DEFAULT false, -- whether salary range is visible to applicants
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'filled')),
  posted_by INTEGER REFERENCES users(id),   -- HR user who created it
  posted_at TIMESTAMPTZ,                    -- when it was published (moved to 'open')
  closes_at TIMESTAMPTZ,                    -- application deadline
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Internal applications
-- =====================================================
CREATE TABLE IF NOT EXISTS internal_applications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  opportunity_id INTEGER NOT NULL REFERENCES internal_opportunities(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES users(id),
  cover_letter TEXT,
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'reviewing', 'shortlisted', 'interview', 'offered', 'accepted', 'rejected', 'withdrawn'
  )),
  reviewed_by INTEGER REFERENCES users(id), -- HR user who last reviewed
  reviewed_at TIMESTAMPTZ,
  notes TEXT,                                -- HR/manager internal notes (never shown to applicant)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(opportunity_id, applicant_id)       -- one application per person per opportunity
);

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_status ON internal_opportunities(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_closes_at ON internal_opportunities(closes_at);
CREATE INDEX IF NOT EXISTS idx_applications_opportunity ON internal_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON internal_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_tenant ON internal_applications(tenant_id);
