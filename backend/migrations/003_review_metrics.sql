-- Add assessment metric columns to reviews table
ALTER TABLE reviews ADD COLUMN tasks_completed INTEGER CHECK (tasks_completed >= 1 AND tasks_completed <= 10);
ALTER TABLE reviews ADD COLUMN work_volume INTEGER CHECK (work_volume >= 1 AND work_volume <= 10);
ALTER TABLE reviews ADD COLUMN problem_solving INTEGER CHECK (problem_solving >= 1 AND problem_solving <= 10);
ALTER TABLE reviews ADD COLUMN communication INTEGER CHECK (communication >= 1 AND communication <= 10);
ALTER TABLE reviews ADD COLUMN leadership INTEGER CHECK (leadership >= 1 AND leadership <= 10);
