-- Add commit workflow columns
ALTER TABLE reviews ADD COLUMN is_committed BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN committed_at TIMESTAMP;

-- Add week ending date for tracking review freshness
ALTER TABLE reviews ADD COLUMN week_ending_date DATE;

-- Create index for committed status queries
CREATE INDEX idx_reviews_committed ON reviews(is_committed);
