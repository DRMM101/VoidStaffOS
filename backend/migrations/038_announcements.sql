-- Migration 038: Announcements
-- Company announcements system. HR/Admin post announcements;
-- all employees see published ones. Supports read tracking,
-- pinning, expiry, and priority levels.
--
-- Copyright © 2026 D.R.M. Manthorpe. All rights reserved.

-- Announcements table: stores company announcements
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  author_id INTEGER NOT NULL REFERENCES users(id),          -- Who created/posted the announcement
  title VARCHAR(255) NOT NULL,
  content TEXT,                                               -- Full announcement body
  category VARCHAR(50) NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'urgent', 'policy', 'event', 'celebration')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,                                   -- When moved to published status
  expires_at TIMESTAMPTZ,                                     -- Optional: auto-hide after this date
  pinned BOOLEAN NOT NULL DEFAULT false,                      -- Pinned announcements show first
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track who has read each announcement
CREATE TABLE IF NOT EXISTS announcement_reads (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)                            -- One read record per user per announcement
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_status ON announcements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(pinned DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);
