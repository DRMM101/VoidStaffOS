-- Simplify reviews: remove overall_rating and status fields
-- These are now derived from KPIs (Velocity, Friction, Cohesion)

-- Remove the columns
ALTER TABLE reviews DROP COLUMN IF EXISTS overall_rating;
ALTER TABLE reviews DROP COLUMN IF EXISTS status;

-- Remove period_start and period_end as they're redundant
-- The week_ending_date now represents the review period (7 days prior)
ALTER TABLE reviews DROP COLUMN IF EXISTS period_start;
ALTER TABLE reviews DROP COLUMN IF EXISTS period_end;

-- Rename review_date to week_ending_date if needed, or keep both
-- Actually, let's consolidate: review_date becomes the week ending date
-- Drop the separate week_ending_date column and use review_date
ALTER TABLE reviews DROP COLUMN IF EXISTS week_ending_date;

-- Rename review_date to clarify it's the week ending
-- Note: We'll keep the column name as review_date for compatibility
-- but treat it as the week ending date in the application

-- Add index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);

-- Add is_self_assessment column to track manager vs self reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_self_assessment BOOLEAN DEFAULT false;
