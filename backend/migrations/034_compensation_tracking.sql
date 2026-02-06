-- Migration 034: Compensation Tracking
-- Chunk 11 — Pay bands, salary records, benefits, review cycles, pay reviews,
-- pay slips, and compensation audit log.
--
-- NOTE: Uses INTEGER foreign keys to match existing users(SERIAL) and tenants(SERIAL)
-- tables. UUID primary keys used for new tables for global uniqueness.
--
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Proprietary and confidential.

-- ============================================
-- Pay Bands (org-wide salary structure)
-- ============================================
CREATE TABLE pay_bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    band_name VARCHAR(100) NOT NULL,
    grade INTEGER NOT NULL,
    min_salary DECIMAL(12,2) NOT NULL,
    mid_salary DECIMAL(12,2) NOT NULL,
    max_salary DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, band_name)
);

-- ============================================
-- Compensation Records (one per salary change — never update, insert new)
-- ============================================
CREATE TABLE compensation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    effective_date DATE NOT NULL,
    base_salary DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    fte_percentage DECIMAL(5,2) DEFAULT 100.00,
    pay_band_id UUID REFERENCES pay_bands(id),
    reason VARCHAR(255),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_salary_date UNIQUE(employee_id, effective_date)
);

-- ============================================
-- Benefits
-- ============================================
CREATE TABLE benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    benefit_type VARCHAR(50) NOT NULL CHECK (benefit_type IN ('pension', 'healthcare', 'car', 'bonus', 'stock', 'allowance', 'other')),
    provider VARCHAR(255),
    description TEXT,
    value DECIMAL(12,2),
    employer_contribution DECIMAL(12,2),
    employee_contribution DECIMAL(12,2),
    frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'one-off')),
    start_date DATE NOT NULL,
    end_date DATE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Review Cycles
-- ============================================
CREATE TABLE review_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    budget_total DECIMAL(14,2),
    budget_remaining DECIMAL(14,2),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'open', 'in_review', 'complete')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Pay Reviews
-- ============================================
CREATE TABLE pay_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    review_cycle_id UUID NOT NULL REFERENCES review_cycles(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    current_salary DECIMAL(12,2) NOT NULL,
    proposed_salary DECIMAL(12,2),
    approved_salary DECIMAL(12,2),
    manager_id INTEGER REFERENCES users(id),
    manager_notes TEXT,
    hr_approved_by INTEGER REFERENCES users(id),
    hr_notes TEXT,
    finance_approved_by INTEGER REFERENCES users(id),
    finance_notes TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'hr_review', 'approved', 'rejected', 'applied')),
    effective_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_cycle_id, employee_id)
);

-- ============================================
-- Pay Slips (references documents table from Chunk 3)
-- ============================================
CREATE TABLE pay_slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    document_id UUID, -- references documents table from Chunk 3
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Compensation Audit Log (append-only — NO updates, NO deletes)
-- ============================================
CREATE TABLE compensation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    employee_id INTEGER,                                  -- whose data was accessed
    accessed_by INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'create', 'update', 'export', 'download')),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for query performance
-- ============================================
CREATE INDEX idx_compensation_records_employee ON compensation_records(employee_id, effective_date DESC);
CREATE INDEX idx_compensation_records_tenant ON compensation_records(tenant_id);
CREATE INDEX idx_benefits_employee ON benefits(employee_id);
CREATE INDEX idx_benefits_tenant ON benefits(tenant_id);
CREATE INDEX idx_pay_reviews_cycle ON pay_reviews(review_cycle_id);
CREATE INDEX idx_pay_reviews_employee ON pay_reviews(employee_id);
CREATE INDEX idx_compensation_audit_tenant ON compensation_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_compensation_audit_employee ON compensation_audit_log(employee_id, created_at DESC);
CREATE INDEX idx_pay_slips_employee ON pay_slips(employee_id, period_end DESC);
CREATE INDEX idx_pay_bands_tenant ON pay_bands(tenant_id);
CREATE INDEX idx_review_cycles_tenant ON review_cycles(tenant_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE compensation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_audit_log ENABLE ROW LEVEL SECURITY;

-- Notification types used by compensation module (stored as type column in notifications table):
-- pay_review_submitted, pay_review_approved, pay_review_rejected,
-- salary_change_applied, review_cycle_opened, benefit_added
