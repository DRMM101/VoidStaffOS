-- Add manager_id to users table for team hierarchy
ALTER TABLE users ADD COLUMN manager_id INTEGER REFERENCES users(id);
CREATE INDEX idx_users_manager ON users(manager_id);

-- Create reviews table for performance reviews
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES users(id),
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  review_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  goals TEXT,
  achievements TEXT,
  areas_for_improvement TEXT,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_employee ON reviews(employee_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_status ON reviews(status);
