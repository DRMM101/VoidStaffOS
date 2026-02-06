-- Migration 037: Goals Dashboard
-- Goal-setting and tracking system for employees and managers.
-- Supports individual goals, manager-assigned goals, progress tracking,
-- and update comments.
--
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.

-- Goals table: stores individual employee goals
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),            -- Goal owner
  assigned_by INTEGER REFERENCES users(id),                  -- NULL = self-set, otherwise manager-assigned
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'performance'
    CHECK (category IN ('performance', 'development', 'project', 'personal')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  progress INTEGER NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100),
  target_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Goal updates/comments: timestamped progress notes on a goal
CREATE TABLE IF NOT EXISTS goal_updates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),             -- Who posted the update
  comment TEXT NOT NULL,
  progress_change INTEGER,                                    -- e.g. +10 means progress went up by 10
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_goals_tenant_user ON goals(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goal_updates_goal ON goal_updates(goal_id);

-- Notification types for goals (add to enum if notification_type enum exists)
-- These are referenced in notification creation but the column may be a VARCHAR
-- so we just document them here:
-- goal_assigned, goal_completed, goal_comment, goal_overdue
