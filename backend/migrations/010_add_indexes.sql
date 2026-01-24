-- Migration: 010_add_indexes.sql
-- Description: Add indexes for query performance optimization

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_employment_status ON users(employment_status);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Reviews table indexes
CREATE INDEX IF NOT EXISTS idx_reviews_employee_id ON reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_employee_date ON reviews(employee_id, review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_committed ON reviews(is_committed) WHERE is_committed = true;
CREATE INDEX IF NOT EXISTS idx_reviews_self_assessment ON reviews(employee_id, review_date, is_self_assessment);

-- Leave requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_manager_id ON leave_requests(manager_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(leave_start_date, leave_end_date);
CREATE INDEX IF NOT EXISTS idx_leave_pending ON leave_requests(manager_id, status) WHERE status = 'pending';

-- Notifications indexes (already created in 009, but ensure they exist)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);

-- Comment
COMMENT ON INDEX idx_reviews_employee_date IS 'Optimizes weekly review lookups for employees';
COMMENT ON INDEX idx_leave_pending IS 'Optimizes pending leave approval queries for managers';
COMMENT ON INDEX idx_notifications_user_unread IS 'Optimizes unread notification count queries';
