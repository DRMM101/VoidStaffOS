/**
 * HeadOfficeOS - Migration 028: Confirm Arrival
 * Adds arrival confirmation fields to candidates table.
 * Pre-colleagues must have arrival confirmed before promotion to active.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 */

-- Add arrival confirmation columns to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS arrival_confirmed BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS arrival_confirmed_by INTEGER REFERENCES users(id);

-- Add index for querying
CREATE INDEX IF NOT EXISTS idx_candidates_arrival ON candidates(arrival_confirmed) WHERE stage = 'pre_colleague';

COMMENT ON COLUMN candidates.arrival_confirmed IS 'Whether the pre-colleague has physically arrived for their first day';
COMMENT ON COLUMN candidates.arrival_confirmed_at IS 'When arrival was confirmed';
COMMENT ON COLUMN candidates.arrival_confirmed_by IS 'Who confirmed the arrival';
