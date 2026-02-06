// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Announcements Routes
 * API routes for company announcements. Admin creates and manages
 * announcements; all employees can view published ones.
 * Supports read tracking, pinning, expiry, and priority levels.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/* All routes require authentication */
router.use(authenticate);

// =====================================================
// PUBLISHED ANNOUNCEMENTS (all employees)
// =====================================================

/**
 * GET /api/announcements
 * List published, non-expired announcements for the current tenant.
 * Includes a `read` boolean indicating if the current user has read each one.
 * Pinned announcements sort first, then by published_at DESC.
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT a.*,
              u.full_name AS author_name,
              CASE WHEN ar.id IS NOT NULL THEN true ELSE false END AS read
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       LEFT JOIN announcement_reads ar
         ON ar.announcement_id = a.id AND ar.user_id = $2
       WHERE a.tenant_id = $1
         AND a.status = 'published'
         AND (a.expires_at IS NULL OR a.expires_at > NOW())
       ORDER BY a.pinned DESC, a.published_at DESC`,
      [tenantId, userId]
    );

    res.json({ announcements: result.rows });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// =====================================================
// ADMIN: ALL ANNOUNCEMENTS (before /:id catch-all)
// =====================================================

/**
 * GET /api/announcements/all
 * List all announcements (draft, published, archived) for admin.
 * Includes read count per announcement.
 */
router.get('/all', authorize('Admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const result = await db.query(
      `SELECT a.*,
              u.full_name AS author_name,
              COALESCE(rc.read_count, 0) AS read_count
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       LEFT JOIN (
         SELECT announcement_id, COUNT(*) AS read_count
         FROM announcement_reads
         GROUP BY announcement_id
       ) rc ON rc.announcement_id = a.id
       WHERE a.tenant_id = $1
       ORDER BY
         CASE a.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 WHEN 'archived' THEN 3 END,
         a.pinned DESC, a.updated_at DESC`,
      [tenantId]
    );

    res.json({ announcements: result.rows });
  } catch (error) {
    console.error('Get all announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// =====================================================
// UNREAD ANNOUNCEMENTS
// =====================================================

/**
 * GET /api/announcements/unread
 * List published, non-expired announcements the current user has NOT read.
 */
router.get('/unread', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT a.*, u.full_name AS author_name
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       LEFT JOIN announcement_reads ar
         ON ar.announcement_id = a.id AND ar.user_id = $2
       WHERE a.tenant_id = $1
         AND a.status = 'published'
         AND (a.expires_at IS NULL OR a.expires_at > NOW())
         AND ar.id IS NULL
       ORDER BY a.pinned DESC, a.published_at DESC`,
      [tenantId, userId]
    );

    res.json({ announcements: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Get unread announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch unread announcements' });
  }
});

// =====================================================
// TICKER ANNOUNCEMENTS
// =====================================================

/**
 * GET /api/announcements/ticker
 * Published, non-expired, pinned OR urgent announcements for the dashboard ticker.
 * Returns a lightweight payload for the scrolling banner.
 */
router.get('/ticker', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT a.id, a.title, a.category, a.priority, a.pinned, a.published_at,
              CASE WHEN ar.id IS NOT NULL THEN true ELSE false END AS read
       FROM announcements a
       LEFT JOIN announcement_reads ar
         ON ar.announcement_id = a.id AND ar.user_id = $2
       WHERE a.tenant_id = $1
         AND a.status = 'published'
         AND (a.expires_at IS NULL OR a.expires_at > NOW())
         AND (a.pinned = true OR a.priority = 'urgent')
       ORDER BY a.pinned DESC, a.published_at DESC`,
      [tenantId, userId]
    );

    res.json({ announcements: result.rows });
  } catch (error) {
    console.error('Get ticker announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch ticker announcements' });
  }
});

// =====================================================
// SINGLE ANNOUNCEMENT
// =====================================================

/**
 * GET /api/announcements/:id
 * Get a single announcement. Employees see published only; Admin sees all.
 */
router.get('/:id', async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const isAdmin = req.user.role_name === 'Admin';

    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Build query — admin sees all statuses, employees see published only
    let query = `
      SELECT a.*, u.full_name AS author_name,
             CASE WHEN ar.id IS NOT NULL THEN true ELSE false END AS read
      FROM announcements a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN announcement_reads ar
        ON ar.announcement_id = a.id AND ar.user_id = $3
      WHERE a.id = $1 AND a.tenant_id = $2`;

    // Non-admin users can only see published, non-expired announcements
    if (!isAdmin) {
      query += ` AND a.status = 'published' AND (a.expires_at IS NULL OR a.expires_at > NOW())`;
    }

    const result = await db.query(query, [announcementId, tenantId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ announcement: result.rows[0] });
  } catch (error) {
    console.error('Get announcement detail error:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

// =====================================================
// CREATE ANNOUNCEMENT
// =====================================================

/**
 * POST /api/announcements
 * Create a new announcement. Admin only.
 */
router.post('/', authorize('Admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const authorId = req.user.id;
    const { title, content, category, priority, expires_at, pinned } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Validate category
    const validCategories = ['general', 'urgent', 'policy', 'event', 'celebration'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const result = await db.query(
      `INSERT INTO announcements (tenant_id, author_id, title, content, category, priority, expires_at, pinned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenantId, authorId, title.trim(), content || null,
       category || 'general', priority || 'normal',
       expires_at || null, pinned || false]
    );

    res.status(201).json({ message: 'Announcement created', announcement: result.rows[0] });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// =====================================================
// UPDATE ANNOUNCEMENT
// =====================================================

/**
 * PUT /api/announcements/:id
 * Update an announcement. Admin only.
 */
router.put('/:id', authorize('Admin'), async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const tenantId = req.user.tenant_id;

    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Check exists
    const existing = await db.query(
      'SELECT * FROM announcements WHERE id = $1 AND tenant_id = $2',
      [announcementId, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const { title, content, category, priority, expires_at, pinned } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (title !== undefined) { updates.push(`title = $${paramIdx++}`); values.push(title.trim()); }
    if (content !== undefined) { updates.push(`content = $${paramIdx++}`); values.push(content); }
    if (category !== undefined) { updates.push(`category = $${paramIdx++}`); values.push(category); }
    if (priority !== undefined) { updates.push(`priority = $${paramIdx++}`); values.push(priority); }
    if (expires_at !== undefined) { updates.push(`expires_at = $${paramIdx++}`); values.push(expires_at || null); }
    if (pinned !== undefined) { updates.push(`pinned = $${paramIdx++}`); values.push(pinned); }

    // Always bump the timestamp
    updates.push('updated_at = NOW()');

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(announcementId, tenantId);
    const query = `UPDATE announcements SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx} RETURNING *`;

    const result = await db.query(query, values);
    res.json({ message: 'Announcement updated', announcement: result.rows[0] });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// =====================================================
// DELETE ANNOUNCEMENT
// =====================================================

/**
 * DELETE /api/announcements/:id
 * Hard delete an announcement. Admin only.
 * Cascade deletes associated read records.
 */
router.delete('/:id', authorize('Admin'), async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const tenantId = req.user.tenant_id;

    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const result = await db.query(
      'DELETE FROM announcements WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [announcementId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// =====================================================
// PUBLISH / ARCHIVE
// =====================================================

/**
 * POST /api/announcements/:id/publish
 * Publish a draft announcement. Sets status=published, published_at=NOW.
 * Admin only.
 */
router.post('/:id/publish', authorize('Admin'), async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const tenantId = req.user.tenant_id;

    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Fetch current status
    const existing = await db.query(
      'SELECT status FROM announcements WHERE id = $1 AND tenant_id = $2',
      [announcementId, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (existing.rows[0].status === 'published') {
      return res.status(400).json({ error: 'Announcement is already published' });
    }

    const result = await db.query(
      `UPDATE announcements
       SET status = 'published', published_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [announcementId, tenantId]
    );

    res.json({ message: 'Announcement published', announcement: result.rows[0] });
  } catch (error) {
    console.error('Publish announcement error:', error);
    res.status(500).json({ error: 'Failed to publish announcement' });
  }
});

/**
 * POST /api/announcements/:id/archive
 * Archive an announcement. Sets status=archived. Admin only.
 */
router.post('/:id/archive', authorize('Admin'), async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const tenantId = req.user.tenant_id;

    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const result = await db.query(
      `UPDATE announcements
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [announcementId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement archived', announcement: result.rows[0] });
  } catch (error) {
    console.error('Archive announcement error:', error);
    res.status(500).json({ error: 'Failed to archive announcement' });
  }
});

// =====================================================
// READ TRACKING
// =====================================================

/**
 * POST /api/announcements/:id/read
 * Mark an announcement as read by the current user.
 * Uses ON CONFLICT to upsert (idempotent).
 */
router.post('/:id/read', async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Upsert — if already read, do nothing
    await db.query(
      `INSERT INTO announcement_reads (tenant_id, announcement_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (announcement_id, user_id) DO NOTHING`,
      [tenantId, announcementId, userId]
    );

    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * GET /api/announcements/:id/reads
 * Get read receipts for an announcement. Admin only.
 * Returns list of employees with read/unread status.
 */
router.get('/:id/reads', authorize('Admin'), async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const tenantId = req.user.tenant_id;

    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Verify announcement exists
    const annCheck = await db.query(
      'SELECT id FROM announcements WHERE id = $1 AND tenant_id = $2',
      [announcementId, tenantId]
    );

    if (annCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Get all active employees with their read status for this announcement
    const result = await db.query(
      `SELECT u.id, u.full_name, u.employee_number, u.role_name,
              ar.read_at,
              CASE WHEN ar.id IS NOT NULL THEN true ELSE false END AS has_read
       FROM users u
       LEFT JOIN announcement_reads ar
         ON ar.user_id = u.id AND ar.announcement_id = $2
       WHERE u.tenant_id = $1 AND u.status = 'active'
       ORDER BY ar.read_at DESC NULLS LAST, u.full_name ASC`,
      [tenantId, announcementId]
    );

    // Calculate summary stats
    const total = result.rows.length;
    const readCount = result.rows.filter(r => r.has_read).length;

    res.json({
      employees: result.rows,
      summary: {
        total,
        read: readCount,
        unread: total - readCount,
        percentage: total > 0 ? Math.round((readCount / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get read receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch read receipts' });
  }
});

module.exports = router;
