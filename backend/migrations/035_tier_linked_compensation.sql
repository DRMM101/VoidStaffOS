-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
-- Proprietary and confidential. Unauthorised copying, modification,
-- or distribution is strictly prohibited.

-- Migration 035: Tier-linked pay bands with optional bonus & responsibility calculations
-- Adds tier-band linking, bonus scheme engine, responsibility allowances,
-- and per-tenant feature toggles.

-- 1. Add optional tier link to pay_bands
ALTER TABLE pay_bands ADD COLUMN tier_level INTEGER
  REFERENCES tier_definitions(tier_level);
CREATE INDEX idx_pay_bands_tier ON pay_bands(tier_level);

-- 2. Per-tenant feature toggles for optional compensation features
CREATE TABLE compensation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    enable_tier_band_linking BOOLEAN DEFAULT FALSE,
    enable_bonus_schemes BOOLEAN DEFAULT FALSE,
    enable_responsibility_allowances BOOLEAN DEFAULT FALSE,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- 3. Bonus scheme templates (configuration, not individual awards)
CREATE TABLE bonus_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    scheme_name VARCHAR(150) NOT NULL,
    description TEXT,
    -- 'percentage' applies calculation_value as % of basis; 'fixed' is a flat amount
    calculation_type VARCHAR(20) NOT NULL
      CHECK (calculation_type IN ('percentage', 'fixed')),
    calculation_value DECIMAL(12,2) NOT NULL,
    -- What the percentage applies to (ignored for fixed type)
    basis VARCHAR(30) DEFAULT 'base_salary'
      CHECK (basis IN ('base_salary', 'total_compensation')),
    frequency VARCHAR(20) DEFAULT 'annual'
      CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'one-off')),
    -- Optional tier/band targeting (NULL = applies to all)
    tier_level INTEGER REFERENCES tier_definitions(tier_level),
    pay_band_id UUID REFERENCES pay_bands(id),
    -- Eligibility: minimum months of service required
    min_service_months INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, scheme_name)
);
CREATE INDEX idx_bonus_schemes_tenant ON bonus_schemes(tenant_id);
CREATE INDEX idx_bonus_schemes_tier ON bonus_schemes(tier_level);
CREATE INDEX idx_bonus_schemes_band ON bonus_schemes(pay_band_id);

-- 4. Responsibility allowance templates (linked to tier/band/additional role)
CREATE TABLE responsibility_allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    allowance_name VARCHAR(150) NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    frequency VARCHAR(20) DEFAULT 'monthly'
      CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
    -- Optional targeting: tier, band, or additional role (e.g. Fire Warden)
    tier_level INTEGER REFERENCES tier_definitions(tier_level),
    pay_band_id UUID REFERENCES pay_bands(id),
    additional_role_id INTEGER REFERENCES additional_roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, allowance_name)
);
CREATE INDEX idx_resp_allowances_tenant ON responsibility_allowances(tenant_id);
CREATE INDEX idx_resp_allowances_tier ON responsibility_allowances(tier_level);

-- 5. Per-employee bonus assignments (calculated instances from schemes)
CREATE TABLE employee_bonus_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    bonus_scheme_id UUID NOT NULL REFERENCES bonus_schemes(id),
    -- The salary/comp base used for the calculation
    base_amount DECIMAL(12,2) NOT NULL,
    -- The actual calculated bonus amount
    calculated_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'applied', 'rejected')),
    effective_date DATE NOT NULL,
    approved_by INTEGER REFERENCES users(id),
    -- FK to benefits record once the bonus is committed
    applied_benefit_id UUID REFERENCES benefits(id),
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bonus_assignments_employee ON employee_bonus_assignments(employee_id);
CREATE INDEX idx_bonus_assignments_scheme ON employee_bonus_assignments(bonus_scheme_id);
CREATE INDEX idx_bonus_assignments_tenant ON employee_bonus_assignments(tenant_id);
CREATE INDEX idx_bonus_assignments_status ON employee_bonus_assignments(tenant_id, status);

-- 6. Per-employee responsibility allowance assignments
CREATE TABLE employee_allowance_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    allowance_id UUID NOT NULL REFERENCES responsibility_allowances(id),
    amount DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    -- FK to benefits record for traceability
    applied_benefit_id UUID REFERENCES benefits(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, allowance_id, start_date)
);
CREATE INDEX idx_allowance_assignments_employee ON employee_allowance_assignments(employee_id);
CREATE INDEX idx_allowance_assignments_tenant ON employee_allowance_assignments(tenant_id);

-- Row Level Security on all new tables
ALTER TABLE compensation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsibility_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_bonus_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_allowance_assignments ENABLE ROW LEVEL SECURITY;
