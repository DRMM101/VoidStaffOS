-- Migration: 009_notifications.sql
-- Description: Add notifications system

-- Create notification type enum
DO $$ BEGIN
    CREATE TYPE notification_type_enum AS ENUM (
        'manager_snapshot_committed',
        'snapshot_overdue',
        'self_reflection_overdue',
        'leave_request_pending',
        'leave_request_approved',
        'leave_request_rejected',
        'employee_transferred',
        'new_direct_report',
        'kpi_revealed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    related_id INTEGER,
    related_type VARCHAR(50),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Add comment
COMMENT ON TABLE notifications IS 'User notifications for various system events';
