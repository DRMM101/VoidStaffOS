/**
 * HeadOfficeOS - Migration 026: Emergency Contacts & Medical Info
 * Emergency contact management and medical information for employees.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Emergency Contacts
 */

BEGIN;

-- ===========================================
-- CREATE TYPES
-- ===========================================

DO $$ BEGIN
    CREATE TYPE relationship_type AS ENUM (
        'spouse',
        'partner',
        'parent',
        'sibling',
        'child',
        'friend',
        'colleague',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blood_type_enum AS ENUM (
        'A+', 'A-',
        'B+', 'B-',
        'AB+', 'AB-',
        'O+', 'O-',
        'unknown'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- EMERGENCY CONTACTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Contact details
    contact_name VARCHAR(255) NOT NULL,
    relationship relationship_type NOT NULL,
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 5),

    -- Contact methods
    phone VARCHAR(30),
    mobile VARCHAR(30),
    email VARCHAR(255),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    postcode VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United Kingdom',

    -- Special designations
    is_next_of_kin BOOLEAN DEFAULT false,

    -- Notes and metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),

    -- Constraints
    CONSTRAINT emergency_contacts_phone_or_mobile CHECK (
        phone IS NOT NULL OR mobile IS NOT NULL
    )
);

-- Ensure only one next of kin per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_one_next_of_kin
    ON emergency_contacts (tenant_id, employee_id)
    WHERE is_next_of_kin = true;

-- Ensure unique priority per employee (no two contacts with same priority)
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_unique_priority
    ON emergency_contacts (tenant_id, employee_id, priority);

-- ===========================================
-- MEDICAL INFO TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS medical_info (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Medical details
    allergies TEXT,
    medical_conditions TEXT,
    medications TEXT,
    blood_type blood_type_enum DEFAULT 'unknown',

    -- GP Details (optional)
    gp_name VARCHAR(255),
    gp_practice_name VARCHAR(255),
    gp_phone VARCHAR(30),
    gp_address TEXT,

    -- Privacy controls
    hr_only_notes TEXT,  -- Only visible to HR (Tier 60+)

    -- Additional info
    additional_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),

    -- One medical info record per employee
    CONSTRAINT medical_info_one_per_employee UNIQUE (tenant_id, employee_id)
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_emergency_tenant ON emergency_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_employee ON emergency_contacts(employee_id);
CREATE INDEX IF NOT EXISTS idx_emergency_tenant_employee ON emergency_contacts(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_emergency_priority ON emergency_contacts(employee_id, priority);
CREATE INDEX IF NOT EXISTS idx_emergency_next_of_kin ON emergency_contacts(employee_id) WHERE is_next_of_kin = true;

CREATE INDEX IF NOT EXISTS idx_medical_tenant ON medical_info(tenant_id);
CREATE INDEX IF NOT EXISTS idx_medical_employee ON medical_info(employee_id);

-- ===========================================
-- AUTO-UPDATE TIMESTAMP TRIGGERS
-- ===========================================

CREATE OR REPLACE FUNCTION update_emergency_contact_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS emergency_contact_timestamp_trigger ON emergency_contacts;
CREATE TRIGGER emergency_contact_timestamp_trigger
    BEFORE UPDATE ON emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION update_emergency_contact_timestamp();

CREATE OR REPLACE FUNCTION update_medical_info_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS medical_info_timestamp_trigger ON medical_info;
CREATE TRIGGER medical_info_timestamp_trigger
    BEFORE UPDATE ON medical_info
    FOR EACH ROW EXECUTE FUNCTION update_medical_info_timestamp();

-- ===========================================
-- NEXT OF KIN ENFORCEMENT TRIGGER
-- ===========================================
-- When setting a contact as next of kin, unset any previous next of kin

CREATE OR REPLACE FUNCTION enforce_single_next_of_kin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_next_of_kin = true THEN
        UPDATE emergency_contacts
        SET is_next_of_kin = false, updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id
          AND employee_id = NEW.employee_id
          AND id != NEW.id
          AND is_next_of_kin = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_next_of_kin_trigger ON emergency_contacts;
CREATE TRIGGER enforce_next_of_kin_trigger
    BEFORE INSERT OR UPDATE ON emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION enforce_single_next_of_kin();

-- ===========================================
-- PRIORITY REORDER FUNCTION
-- ===========================================
-- Helper function to reorder priorities after delete

CREATE OR REPLACE FUNCTION reorder_emergency_priorities(
    p_tenant_id INTEGER,
    p_employee_id INTEGER
)
RETURNS void AS $$
DECLARE
    contact_record RECORD;
    new_priority INTEGER := 1;
BEGIN
    FOR contact_record IN
        SELECT id FROM emergency_contacts
        WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id
        ORDER BY priority
    LOOP
        UPDATE emergency_contacts
        SET priority = new_priority
        WHERE id = contact_record.id;
        new_priority := new_priority + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE emergency_contacts IS 'Employee emergency contact information with priority ordering';
COMMENT ON TABLE medical_info IS 'Employee medical information - sensitive data with access controls';
COMMENT ON COLUMN emergency_contacts.priority IS 'Contact priority 1-5 (1 is highest/first to call)';
COMMENT ON COLUMN emergency_contacts.is_next_of_kin IS 'Designated next of kin (only one per employee)';
COMMENT ON COLUMN medical_info.hr_only_notes IS 'Sensitive notes visible only to HR (Tier 60+)';

COMMIT;
