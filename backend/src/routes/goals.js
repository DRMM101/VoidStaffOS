// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Goals Routes
 * API routes for goal-setting and tracking.
 * Employees create/update their own goals; managers can assign goals
 * to direct reports and view team goals; Admin/HR see all.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/* All routes require authentication */
router.use(authenticate);

// =====================================================
// STATS
// =====================================================

/**
 * GET /api/goals/stats
 * Dashboard summary statistics for the current user's goals.
 * Managers also get team stats.
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;
    const isAdmin = role_name === 'Admin';
    const isManager = role_name === 'Manager';

    // Own goal stats
    const ownResult = await db.query(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'active' AND target_date < CURRENT_DATE) AS overdue
       FROM goals
       WHERE tenant_id = $1 AND user_id = $2 AND status != 'cancelled'`,
      [tenantId, userId]
    );

    const stats = {
      own: {
        total: parseInt(ownResult.rows[0].total),
        active: parseInt(ownResult.rows[0].active),
        completed: parseInt(ownResult.rows[0].completed),
        overdue: parseInt(ownResult.rows[0].overdue)
      }
    };

    // Team stats for managers/admins
    if (isAdmin || isManager) {
      let teamQuery;
      let teamParams;

      if (isAdmin) {
        // Admin sees all goals across the tenant
        teamQuery = `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'active') AS active,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'active' AND target_date < CURRENT_DATE) AS overdue
           FROM goals
           WHERE tenant_id = $1 AND status != 'cancelled'`;
        teamParams = [tenantId];
      } else {
        // Manager sees only direct reports' goals
        teamQuery = `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE g.status = 'active') AS active,
            COUNT(*) FILTER (WHERE g.status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE g.status = 'active' AND g.target_date < CURRENT_DATE) AS overdue
           FROM goals g
           JOIN users u ON g.user_id = u.id
           WHERE g.tenant_id = $1 AND u.manager_id = $2 AND g.status != 'cancelled'`;
        teamParams = [tenantId, userId];
      }

      const teamResult = await db.query(teamQuery, teamParams);
      stats.team = {
        total: parseInt(teamResult.rows[0].total),
        active: parseInt(teamResult.rows[0].active),
        completed: parseInt(teamResult.rows[0].completed),
        overdue: parseInt(teamResult.rows[0].overdue)
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Get goal stats error:', error);
    res.status(500).json({ error: 'Failed to fetch goal statistics' });
  }
});

// =====================================================
// TEAM GOALS (before /:id catch-all)
// =====================================================

/**
 * GET /api/goals/team
 * List direct reports' goals. Managers see their team; Admin sees all.
 */
router.get('/team', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;
    const isAdmin = role_name === 'Admin';

    let query;
    let params;

    if (isAdmin) {
      // Admin sees all goals across tenant
      query = `
        SELECT g.*, u.full_name AS owner_name, u.employee_number,
               a.full_name AS assigned_by_name
        FROM goals g
        JOIN users u ON g.user_id = u.id
        LEFT JOIN users a ON g.assigned_by = a.id
        WHERE g.tenant_id = $1
        ORDER BY
          CASE g.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 WHEN 'completed' THEN 3 WHEN 'cancelled' THEN 4 END,
          g.target_date ASC NULLS LAST, g.created_at DESC`;
      params = [tenantId];
    } else {
      // Manager sees direct reports' goals only
      query = `
        SELECT g.*, u.full_name AS owner_name, u.employee_number,
               a.full_name AS assigned_by_name
        FROM goals g
        JOIN users u ON g.user_id = u.id
        LEFT JOIN users a ON g.assigned_by = a.id
        WHERE g.tenant_id = $1 AND u.manager_id = $2
        ORDER BY
          CASE g.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 WHEN 'completed' THEN 3 WHEN 'cancelled' THEN 4 END,
          g.target_date ASC NULLS LAST, g.created_at DESC`;
      params = [tenantId, userId];
    }

    const result = await db.query(query, params);
    res.json({ goals: result.rows });
  } catch (error) {
    console.error('Get team goals error:', error);
    res.status(500).json({ error: 'Failed to fetch team goals' });
  }
});

// =====================================================
// OWN GOALS
// =====================================================

/**
 * GET /api/goals
 * List the current user's own goals.
 * Optional query params: ?status=active&category=performance
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { status, category } = req.query;

    let query = `
      SELECT g.*, a.full_name AS assigned_by_name
      FROM goals g
      LEFT JOIN users a ON g.assigned_by = a.id
      WHERE g.tenant_id = $1 AND g.user_id = $2`;
    const params = [tenantId, userId];
    let paramIdx = 3;

    // Optional status filter
    if (status) {
      query += ` AND g.status = $${paramIdx++}`;
      params.push(status);
    }

    // Optional category filter
    if (category) {
      query += ` AND g.category = $${paramIdx++}`;
      params.push(category);
    }

    query += ` ORDER BY
      CASE g.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 WHEN 'completed' THEN 3 WHEN 'cancelled' THEN 4 END,
      g.target_date ASC NULLS LAST, g.created_at DESC`;

    const result = await db.query(query, params);
    res.json({ goals: result.rows });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// =====================================================
// GOAL DETAIL
// =====================================================

/**
 * GET /api/goals/:id
 * Get a single goal with its update history.
 * Access: owner, owner's manager, or Admin.
 */
router.get('/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    // Fetch the goal with owner and assigner names
    const goalResult = await db.query(
      `SELECT g.*, u.full_name AS owner_name, u.employee_number, u.manager_id AS owner_manager_id,
              a.full_name AS assigned_by_name
       FROM goals g
       JOIN users u ON g.user_id = u.id
       LEFT JOIN users a ON g.assigned_by = a.id
       WHERE g.id = $1 AND g.tenant_id = $2`,
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goalResult.rows[0];

    // Access check: owner, owner's manager, or Admin
    const isOwner = goal.user_id === userId;
    const isOwnerManager = goal.owner_manager_id === userId;
    const isAdmin = role_name === 'Admin';

    if (!isOwner && !isOwnerManager && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to view this goal' });
    }

    // Fetch update history
    const updatesResult = await db.query(
      `SELECT gu.*, u.full_name AS author_name
       FROM goal_updates gu
       JOIN users u ON gu.user_id = u.id
       WHERE gu.goal_id = $1
       ORDER BY gu.created_at DESC`,
      [goalId]
    );

    res.json({ goal, updates: updatesResult.rows });
  } catch (error) {
    console.error('Get goal detail error:', error);
    res.status(500).json({ error: 'Failed to fetch goal details' });
  }
});

// =====================================================
// CREATE GOAL
// =====================================================

/**
 * POST /api/goals
 * Create a new goal. If assigned_to is provided (and user is a manager),
 * creates the goal for that employee. Otherwise, creates for self.
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;
    const { title, description, category, priority, target_date, assigned_to } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Validate category if provided
    const validCategories = ['performance', 'development', 'project', 'personal'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate priority if provided
    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    let goalUserId = userId;
    let assignedBy = null;

    // If assigning to someone else, check manager permissions
    if (assigned_to && parseInt(assigned_to) !== userId) {
      const isAdmin = role_name === 'Admin';
      const isManager = role_name === 'Manager';

      if (!isAdmin && !isManager) {
        return res.status(403).json({ error: 'Only managers and admins can assign goals to others' });
      }

      // Verify the target is a direct report (or admin can assign to anyone)
      if (!isAdmin) {
        const reportCheck = await db.query(
          'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
          [assigned_to, userId]
        );
        if (reportCheck.rows.length === 0) {
          return res.status(403).json({ error: 'You can only assign goals to your direct reports' });
        }
      }

      goalUserId = parseInt(assigned_to);
      assignedBy = userId;
    }

    // Insert the goal
    const result = await db.query(
      `INSERT INTO goals (tenant_id, user_id, assigned_by, title, description, category, priority, target_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenantId, goalUserId, assignedBy, title.trim(), description || null,
       category || 'performance', priority || 'medium', target_date || null]
    );

    const goal = result.rows[0];

    // If manager-assigned, add an automatic first update
    if (assignedBy) {
      await db.query(
        `INSERT INTO goal_updates (tenant_id, goal_id, user_id, comment)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, goal.id, assignedBy, `Goal assigned by manager.`]
      );
    }

    res.status(201).json({ message: 'Goal created successfully', goal });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// =====================================================
// UPDATE GOAL
// =====================================================

/**
 * PUT /api/goals/:id
 * Update goal fields (title, description, category, priority, target_date, status).
 * Access: owner or Admin.
 */
router.put('/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    // Fetch existing goal for ownership check
    const existing = await db.query(
      'SELECT * FROM goals WHERE id = $1 AND tenant_id = $2',
      [goalId, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = existing.rows[0];
    const isOwner = goal.user_id === userId;
    const isAdmin = role_name === 'Admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own goals' });
    }

    const { title, description, category, priority, target_date, status } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (title !== undefined) { updates.push(`title = $${paramIdx++}`); values.push(title.trim()); }
    if (description !== undefined) { updates.push(`description = $${paramIdx++}`); values.push(description); }
    if (category !== undefined) { updates.push(`category = $${paramIdx++}`); values.push(category); }
    if (priority !== undefined) { updates.push(`priority = $${paramIdx++}`); values.push(priority); }
    if (target_date !== undefined) { updates.push(`target_date = $${paramIdx++}`); values.push(target_date || null); }
    if (status !== undefined) { updates.push(`status = $${paramIdx++}`); values.push(status); }

    // Always update the timestamp
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      // Only updated_at — nothing else to change
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(goalId, tenantId);
    const query = `UPDATE goals SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx} RETURNING *`;

    const result = await db.query(query, values);
    res.json({ message: 'Goal updated', goal: result.rows[0] });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// =====================================================
// PROGRESS UPDATE
// =====================================================

/**
 * PUT /api/goals/:id/progress
 * Quick progress update with optional comment.
 * Access: owner, owner's manager, or Admin.
 */
router.put('/:id/progress', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;
    const { progress, comment } = req.body;

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ error: 'Progress must be between 0 and 100' });
    }

    // Fetch goal for access check
    const goalResult = await db.query(
      `SELECT g.*, u.manager_id AS owner_manager_id
       FROM goals g JOIN users u ON g.user_id = u.id
       WHERE g.id = $1 AND g.tenant_id = $2`,
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    const isOwner = goal.user_id === userId;
    const isOwnerManager = goal.owner_manager_id === userId;
    const isAdmin = role_name === 'Admin';

    if (!isOwner && !isOwnerManager && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to update this goal' });
    }

    // Calculate progress change for the update record
    const progressChange = progress - goal.progress;

    // Update progress on the goal
    const updateResult = await db.query(
      `UPDATE goals SET progress = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [progress, goalId, tenantId]
    );

    // Record the update with optional comment
    if (comment || progressChange !== 0) {
      const updateComment = comment || `Progress updated to ${progress}%`;
      await db.query(
        `INSERT INTO goal_updates (tenant_id, goal_id, user_id, comment, progress_change)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, goalId, userId, updateComment, progressChange]
      );
    }

    res.json({ message: 'Progress updated', goal: updateResult.rows[0] });
  } catch (error) {
    console.error('Update goal progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// =====================================================
// COMPLETE GOAL
// =====================================================

/**
 * POST /api/goals/:id/complete
 * Mark a goal as completed. Sets progress to 100 and status to 'completed'.
 * Access: owner or Admin.
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    // Fetch goal
    const goalResult = await db.query(
      'SELECT * FROM goals WHERE id = $1 AND tenant_id = $2',
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    const isOwner = goal.user_id === userId;
    const isAdmin = role_name === 'Admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the goal owner or admin can complete a goal' });
    }

    if (goal.status === 'completed') {
      return res.status(400).json({ error: 'Goal is already completed' });
    }

    // Mark as completed
    const result = await db.query(
      `UPDATE goals SET status = 'completed', progress = 100, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [goalId, tenantId]
    );

    // Log completion update
    await db.query(
      `INSERT INTO goal_updates (tenant_id, goal_id, user_id, comment, progress_change)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, goalId, userId, 'Goal completed!', 100 - goal.progress]
    );

    res.json({ message: 'Goal completed', goal: result.rows[0] });
  } catch (error) {
    console.error('Complete goal error:', error);
    res.status(500).json({ error: 'Failed to complete goal' });
  }
});

// =====================================================
// DELETE / CANCEL GOAL
// =====================================================

/**
 * DELETE /api/goals/:id
 * Cancel a goal. Sets status to 'cancelled' (soft delete).
 * Access: owner or Admin.
 */
router.delete('/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    const goalResult = await db.query(
      'SELECT * FROM goals WHERE id = $1 AND tenant_id = $2',
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    const isOwner = goal.user_id === userId;
    const isAdmin = role_name === 'Admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the goal owner or admin can cancel a goal' });
    }

    // Soft delete — set status to cancelled
    await db.query(
      `UPDATE goals SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [goalId, tenantId]
    );

    res.json({ message: 'Goal cancelled' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to cancel goal' });
  }
});

// =====================================================
// GOAL UPDATES (COMMENTS)
// =====================================================

/**
 * GET /api/goals/:id/updates
 * Get update history for a goal.
 * Access: same as goal detail (owner, manager, admin).
 */
router.get('/:id/updates', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    // Verify access — fetch goal to check ownership
    const goalResult = await db.query(
      `SELECT g.user_id, u.manager_id AS owner_manager_id
       FROM goals g JOIN users u ON g.user_id = u.id
       WHERE g.id = $1 AND g.tenant_id = $2`,
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    const isOwner = goal.user_id === userId;
    const isOwnerManager = goal.owner_manager_id === userId;
    const isAdmin = role_name === 'Admin';

    if (!isOwner && !isOwnerManager && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `SELECT gu.*, u.full_name AS author_name
       FROM goal_updates gu
       JOIN users u ON gu.user_id = u.id
       WHERE gu.goal_id = $1
       ORDER BY gu.created_at DESC`,
      [goalId]
    );

    res.json({ updates: result.rows });
  } catch (error) {
    console.error('Get goal updates error:', error);
    res.status(500).json({ error: 'Failed to fetch goal updates' });
  }
});

/**
 * POST /api/goals/:id/updates
 * Add a comment/update to a goal.
 * Access: owner, owner's manager, or Admin.
 */
router.post('/:id/updates', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { role_name } = req.user;
    const { comment } = req.body;

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Verify access
    const goalResult = await db.query(
      `SELECT g.user_id, u.manager_id AS owner_manager_id
       FROM goals g JOIN users u ON g.user_id = u.id
       WHERE g.id = $1 AND g.tenant_id = $2`,
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    const isOwner = goal.user_id === userId;
    const isOwnerManager = goal.owner_manager_id === userId;
    const isAdmin = role_name === 'Admin';

    if (!isOwner && !isOwnerManager && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `INSERT INTO goal_updates (tenant_id, goal_id, user_id, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, goalId, userId, comment.trim()]
    );

    // Get author name for the response
    const update = result.rows[0];
    update.author_name = req.user.full_name;

    res.status(201).json({ message: 'Comment added', update });
  } catch (error) {
    console.error('Add goal update error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;
