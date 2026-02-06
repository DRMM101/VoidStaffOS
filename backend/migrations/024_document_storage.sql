/**
 * HeadOfficeOS - Migration 024: Document Storage
 * Secure employee document management with expiry tracking and access logging.
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
 * Module: Document Storage
 */

BEGIN;

-- ===========================================
-- CREATE TYPES
-- ===========================================

DO $$ BEGIN
    CREATE TYPE document_category AS ENUM (
        'cv',
        'certificate',
        'contract',
        'reference',
        'rtw',           -- Right to Work
        'dbs',           -- DBS Check (CQC critical)
        'supervision',
        'responsibility_pack'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_status AS ENUM (
        'active',
        'archived',
        'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_access_type AS ENUM (
        'view',
        'download',
        'preview'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add notification types for document expiry
DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'document_expiry_90';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'document_expiry_60';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'document_expiry_30';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'document_expired';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- EMPLOYEE DOCUMENTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS employee_documents (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),

    -- Document metadata
    category document_category NOT NULL,
    document_type VARCHAR(100),  -- Sub-type within category (e.g., 'Enhanced DBS', 'Basic DBS')
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- File information
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,

    -- Visibility controls
    visible_to_employee BOOLEAN DEFAULT true,
    visible_to_manager BOOLEAN DEFAULT true,

    -- Expiry tracking
    expiry_date DATE,
    expiry_notified_90 BOOLEAN DEFAULT false,
    expiry_notified_60 BOOLEAN DEFAULT false,
    expiry_notified_30 BOOLEAN DEFAULT false,
    expiry_notified_expired BOOLEAN DEFAULT false,

    -- Status and archiving
    status document_status DEFAULT 'active',
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by INTEGER REFERENCES users(id),
    archive_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT document_file_size_limit CHECK (file_size <= 20971520),  -- 20MB max
    CONSTRAINT document_expiry_logic CHECK (
        (expiry_date IS NULL) OR
        (expiry_date IS NOT NULL AND category IN ('dbs', 'rtw', 'certificate', 'contract'))
    )
);

-- ===========================================
-- DOCUMENT ACCESS LOG TABLE (Immutable audit)
-- ===========================================

CREATE TABLE IF NOT EXISTS document_access_log (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
    document_id INTEGER NOT NULL REFERENCES employee_documents(id) ON DELETE CASCADE,
    accessed_by INTEGER NOT NULL REFERENCES users(id),
    access_type document_access_type NOT NULL,
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent modification of access logs (immutable audit trail)
CREATE OR REPLACE FUNCTION prevent_access_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Document access logs cannot be modified or deleted. This is a compliance requirement.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_access_no_update ON document_access_log;
CREATE TRIGGER document_access_no_update
    BEFORE UPDATE ON document_access_log
    FOR EACH ROW EXECUTE FUNCTION prevent_access_log_modification();

DROP TRIGGER IF EXISTS document_access_no_delete ON document_access_log;
CREATE TRIGGER document_access_no_delete
    BEFORE DELETE ON document_access_log
    FOR EACH ROW EXECUTE FUNCTION prevent_access_log_modification();

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON employee_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON employee_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_category ON employee_documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_status ON employee_documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_employee ON employee_documents(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiring ON employee_documents(expiry_date, status)
    WHERE status = 'active' AND expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_log_document ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_access_log_accessed_by ON document_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_access_log_date ON document_access_log(accessed_at DESC);

-- ===========================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ===========================================

CREATE OR REPLACE FUNCTION update_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_timestamp_trigger ON employee_documents;
CREATE TRIGGER document_timestamp_trigger
    BEFORE UPDATE ON employee_documents
    FOR EACH ROW EXECUTE FUNCTION update_document_timestamp();

-- ===========================================
-- AUTO-EXPIRE DOCUMENTS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION check_document_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically set status to expired if past expiry date
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE AND NEW.status = 'active' THEN
        NEW.status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_expiry_check ON employee_documents;
CREATE TRIGGER document_expiry_check
    BEFORE INSERT OR UPDATE ON employee_documents
    FOR EACH ROW EXECUTE FUNCTION check_document_expiry();

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE employee_documents IS 'Secure storage for employee documents with expiry tracking and visibility controls';
COMMENT ON TABLE document_access_log IS 'Immutable audit trail for all document access';
COMMENT ON COLUMN employee_documents.visible_to_employee IS 'If false, employee cannot see this document (e.g., references)';
COMMENT ON COLUMN employee_documents.visible_to_manager IS 'If false, only HR can see this document';
COMMENT ON COLUMN employee_documents.category IS 'Document category - dbs and rtw are CQC critical';
COMMENT ON COLUMN employee_documents.expiry_notified_90 IS 'True if 90-day expiry notification has been sent';

COMMIT;
