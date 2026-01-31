-- Migration 030: Add urgent notification support
-- Created: 2026-01-31
-- Description: Add is_urgent flag to notifications for short-notice sickness/absence

-- Add is_urgent column to notifications
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false;

-- Add urgent notification type
DO $$
BEGIN
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'urgent_sick_leave';
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'urgent_absence_request';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create index for urgent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_urgent
ON notifications(user_id, is_urgent)
WHERE is_urgent = true AND is_read = false;

COMMENT ON COLUMN notifications.is_urgent IS 'Urgent flag for short-notice sickness/absence notifications';
