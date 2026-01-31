/**
 * VoidStaffOS - Absence Insights API Routes
 * Pattern detection and reporting for HR wellbeing review.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Absence Insights
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const patternService = require('../services/absencePatternService');
const { logAction } = require('../utils/auditLog');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/absence-insights
 * Get insights for HR dashboard with filtering
 */
router.get('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const { status, priority, pattern_type, employee_id, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE ai.tenant_id = $1';
    const params = [req.session?.tenantId || 1];
    let paramIndex = 2;

    // Managers can only see their direct reports' insights
    if (user.role_name === 'Manager') {
      whereClause += ` AND ai.employee_id IN (
        SELECT id FROM users WHERE manager_id = $${paramIndex}
      )`;
      params.push(user.id);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND ai.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      whereClause += ` AND ai.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (pattern_type) {
      whereClause += ` AND ai.pattern_type = $${paramIndex}`;
      params.push(pattern_type);
      paramIndex++;
    }

    if (employee_id) {
      whereClause += ` AND ai.employee_id = $${paramIndex}`;
      params.push(parseInt(employee_id));
      paramIndex++;
    }

    const result = await db.query(`
      SELECT
        ai.*,
        u.full_name as employee_name,
        u.employee_number,
        reviewer.full_name as reviewed_by_name
      FROM absence_insights ai
      JOIN users u ON ai.employee_id = u.id
      LEFT JOIN users reviewer ON ai.reviewed_by = reviewer.id
      ${whereClause}
      ORDER BY
        CASE ai.status
          WHEN 'new' THEN 1
          WHEN 'pending_review' THEN 2
          WHEN 'reviewed' THEN 3
          WHEN 'action_taken' THEN 4
          ELSE 5
        END,
        CASE ai.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        ai.detection_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get counts by status
    const countsResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM absence_insights ai
      ${whereClause}
      GROUP BY status
    `, params.slice(0, paramIndex - 1));

    const counts = {};
    countsResult.rows.forEach(row => {
      counts[row.status] = parseInt(row.count);
    });

    res.json({
      insights: result.rows,
      counts,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: Object.values(counts).reduce((a, b) => a + b, 0)
      }
    });
  } catch (err) {
    console.error('Error fetching insights:', err);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/**
 * GET /api/absence-insights/dashboard
 * Get dashboard summary for insights
 */
router.get('/dashboard', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;

    let managerFilter = '';
    const params = [req.session?.tenantId || 1];

    if (user.role_name === 'Manager') {
      managerFilter = `AND ai.employee_id IN (SELECT id FROM users WHERE manager_id = $2)`;
      params.push(user.id);
    }

    // Get overview counts
    const overviewResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('new', 'pending_review')) as pending_count,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE priority = 'high' AND status NOT IN ('dismissed', 'action_taken')) as high_priority_count,
        COUNT(*) FILTER (WHERE detection_date >= CURRENT_DATE - INTERVAL '7 days') as recent_count
      FROM absence_insights ai
      WHERE ai.tenant_id = $1 ${managerFilter}
    `, params);

    // Get pattern type breakdown
    const patternBreakdown = await db.query(`
      SELECT pattern_type, COUNT(*) as count
      FROM absence_insights ai
      WHERE ai.tenant_id = $1
        AND status NOT IN ('dismissed', 'action_taken')
        ${managerFilter}
      GROUP BY pattern_type
      ORDER BY count DESC
    `, params);

    // Get recent high priority insights
    const recentHighPriority = await db.query(`
      SELECT
        ai.id, ai.pattern_type, ai.priority, ai.summary, ai.detection_date,
        u.full_name as employee_name
      FROM absence_insights ai
      JOIN users u ON ai.employee_id = u.id
      WHERE ai.tenant_id = $1
        AND ai.priority = 'high'
        AND ai.status NOT IN ('dismissed', 'action_taken')
        ${managerFilter}
      ORDER BY ai.detection_date DESC
      LIMIT 5
    `, params);

    // Get employees with highest Bradford factors
    const topBradford = await db.query(`
      SELECT
        s.employee_id, s.bradford_factor, s.total_absences_12m, s.total_sick_days_12m,
        u.full_name as employee_name, u.employee_number
      FROM absence_summaries s
      JOIN users u ON s.employee_id = u.id
      WHERE s.tenant_id = $1
        AND s.bradford_factor > 0
        ${user.role_name === 'Manager' ? `AND s.employee_id IN (SELECT id FROM users WHERE manager_id = $2)` : ''}
      ORDER BY s.bradford_factor DESC
      LIMIT 10
    `, params);

    res.json({
      overview: overviewResult.rows[0],
      pattern_breakdown: patternBreakdown.rows,
      high_priority_insights: recentHighPriority.rows,
      top_bradford_scores: topBradford.rows
    });
  } catch (err) {
    console.error('Error fetching insights dashboard:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/absence-insights/:id
 * Get single insight with full details
 */
router.get('/:id', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        ai.*,
        u.full_name as employee_name,
        u.employee_number,
        u.email as employee_email,
        reviewer.full_name as reviewed_by_name,
        actioner.full_name as action_by_name
      FROM absence_insights ai
      JOIN users u ON ai.employee_id = u.id
      LEFT JOIN users reviewer ON ai.reviewed_by = reviewer.id
      LEFT JOIN users actioner ON ai.action_by = actioner.id
      WHERE ai.id = $1 AND ai.tenant_id = $2
    `, [id, req.session?.tenantId || 1]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const insight = result.rows[0];

    // Check manager access
    if (user.role_name === 'Manager') {
      const accessCheck = await db.query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [insight.employee_id, user.id]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get related absences
    if (insight.related_absence_ids && insight.related_absence_ids.length > 0) {
      const absencesResult = await db.query(`
        SELECT id, leave_start_date, leave_end_date, absence_category, sick_reason, notice_days
        FROM leave_requests
        WHERE id = ANY($1)
        ORDER BY leave_start_date DESC
      `, [insight.related_absence_ids]);
      insight.related_absences = absencesResult.rows;
    }

    // Get review history
    const historyResult = await db.query(`
      SELECT h.*, u.full_name as changed_by_name
      FROM insight_review_history h
      JOIN users u ON h.changed_by = u.id
      WHERE h.insight_id = $1
      ORDER BY h.created_at DESC
    `, [id]);
    insight.review_history = historyResult.rows;

    // Get employee summary
    const summaryResult = await db.query(`
      SELECT * FROM absence_summaries
      WHERE tenant_id = $1 AND employee_id = $2
    `, [req.session?.tenantId || 1, insight.employee_id]);
    insight.employee_summary = summaryResult.rows[0] || null;

    res.json({ insight });
  } catch (err) {
    console.error('Error fetching insight:', err);
    res.status(500).json({ error: 'Failed to fetch insight' });
  }
});

/**
 * PUT /api/absence-insights/:id/review
 * Mark insight as reviewed with notes
 */
router.put('/:id/review', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { notes } = req.body;

    // Get current insight
    const current = await db.query(
      'SELECT * FROM absence_insights WHERE id = $1 AND tenant_id = $2',
      [id, req.session?.tenantId || 1]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const insight = current.rows[0];

    // Record history
    await db.query(`
      INSERT INTO insight_review_history (insight_id, previous_status, new_status, changed_by, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, insight.status, 'reviewed', user.id, notes]);

    // Update insight
    const result = await db.query(`
      UPDATE absence_insights
      SET status = 'reviewed',
          reviewed_by = $1,
          reviewed_at = NOW(),
          review_notes = $2
      WHERE id = $3
      RETURNING *
    `, [user.id, notes, id]);

    await logAction(db, req.session?.tenantId || 1, user.id, 'INSIGHT_REVIEWED', 'absence_insights', id, insight, result.rows[0]);

    res.json({ insight: result.rows[0], message: 'Insight marked as reviewed' });
  } catch (err) {
    console.error('Error reviewing insight:', err);
    res.status(500).json({ error: 'Failed to update insight' });
  }
});

/**
 * PUT /api/absence-insights/:id/action
 * Record action taken on an insight
 */
router.put('/:id/action', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { action_taken, follow_up_date } = req.body;

    if (!action_taken) {
      return res.status(400).json({ error: 'Action description required' });
    }

    const current = await db.query(
      'SELECT * FROM absence_insights WHERE id = $1 AND tenant_id = $2',
      [id, req.session?.tenantId || 1]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const insight = current.rows[0];

    // Record history
    await db.query(`
      INSERT INTO insight_review_history (insight_id, previous_status, new_status, changed_by, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, insight.status, 'action_taken', user.id, action_taken]);

    // Update insight
    const result = await db.query(`
      UPDATE absence_insights
      SET status = 'action_taken',
          action_taken = $1,
          action_by = $2,
          action_at = NOW(),
          follow_up_date = $3
      WHERE id = $4
      RETURNING *
    `, [action_taken, user.id, follow_up_date || null, id]);

    await logAction(db, req.session?.tenantId || 1, user.id, 'INSIGHT_ACTION_TAKEN', 'absence_insights', id, insight, result.rows[0]);

    res.json({ insight: result.rows[0], message: 'Action recorded' });
  } catch (err) {
    console.error('Error recording action:', err);
    res.status(500).json({ error: 'Failed to record action' });
  }
});

/**
 * PUT /api/absence-insights/:id/dismiss
 * Dismiss an insight as not concerning
 */
router.put('/:id/dismiss', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { reason } = req.body;

    const current = await db.query(
      'SELECT * FROM absence_insights WHERE id = $1 AND tenant_id = $2',
      [id, req.session?.tenantId || 1]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const insight = current.rows[0];

    // Record history
    await db.query(`
      INSERT INTO insight_review_history (insight_id, previous_status, new_status, changed_by, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, insight.status, 'dismissed', user.id, reason || 'Dismissed by reviewer']);

    // Update insight
    const result = await db.query(`
      UPDATE absence_insights
      SET status = 'dismissed',
          reviewed_by = $1,
          reviewed_at = NOW(),
          review_notes = $2
      WHERE id = $3
      RETURNING *
    `, [user.id, reason || 'Dismissed by reviewer', id]);

    await logAction(db, req.session?.tenantId || 1, user.id, 'INSIGHT_DISMISSED', 'absence_insights', id, insight, result.rows[0]);

    res.json({ insight: result.rows[0], message: 'Insight dismissed' });
  } catch (err) {
    console.error('Error dismissing insight:', err);
    res.status(500).json({ error: 'Failed to dismiss insight' });
  }
});

/**
 * GET /api/absence-insights/employee/:employeeId
 * Get all insights for a specific employee
 */
router.get('/employee/:employeeId', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const { employeeId } = req.params;

    // Check access
    if (user.role_name === 'Manager') {
      const accessCheck = await db.query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [employeeId, user.id]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const insightsResult = await db.query(`
      SELECT ai.*, reviewer.full_name as reviewed_by_name
      FROM absence_insights ai
      LEFT JOIN users reviewer ON ai.reviewed_by = reviewer.id
      WHERE ai.tenant_id = $1 AND ai.employee_id = $2
      ORDER BY ai.detection_date DESC
    `, [req.session?.tenantId || 1, employeeId]);

    const summaryResult = await db.query(`
      SELECT * FROM absence_summaries
      WHERE tenant_id = $1 AND employee_id = $2
    `, [req.session?.tenantId || 1, employeeId]);

    res.json({
      insights: insightsResult.rows,
      summary: summaryResult.rows[0] || null
    });
  } catch (err) {
    console.error('Error fetching employee insights:', err);
    res.status(500).json({ error: 'Failed to fetch employee insights' });
  }
});

/**
 * POST /api/absence-insights/run-detection/:employeeId
 * Manually trigger pattern detection for an employee (admin only)
 */
router.post('/run-detection/:employeeId', authorize('Admin'), async (req, res) => {
  try {
    const { user } = req;
    const { employeeId } = req.params;

    // Verify employee exists in tenant
    const empCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
      [employeeId, req.session?.tenantId || 1]
    );

    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const insights = await patternService.analyzeAfterAbsence(req.session?.tenantId || 1, parseInt(employeeId));

    res.json({
      message: `Pattern detection complete. ${insights.length} new insight(s) generated.`,
      insights
    });
  } catch (err) {
    console.error('Error running detection:', err);
    res.status(500).json({ error: 'Failed to run pattern detection' });
  }
});

/**
 * GET /api/absence-insights/follow-ups
 * Get insights with pending follow-up dates
 */
router.get('/follow-ups/pending', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;

    let managerFilter = '';
    const params = [req.session?.tenantId || 1];

    if (user.role_name === 'Manager') {
      managerFilter = `AND ai.employee_id IN (SELECT id FROM users WHERE manager_id = $2)`;
      params.push(user.id);
    }

    const result = await db.query(`
      SELECT
        ai.*,
        u.full_name as employee_name,
        u.employee_number,
        actioner.full_name as action_by_name
      FROM absence_insights ai
      JOIN users u ON ai.employee_id = u.id
      LEFT JOIN users actioner ON ai.action_by = actioner.id
      WHERE ai.tenant_id = $1
        AND ai.follow_up_date IS NOT NULL
        AND ai.follow_up_date <= CURRENT_DATE + INTERVAL '7 days'
        AND ai.status = 'action_taken'
        ${managerFilter}
      ORDER BY ai.follow_up_date ASC
    `, params);

    res.json({ follow_ups: result.rows });
  } catch (err) {
    console.error('Error fetching follow-ups:', err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

module.exports = router;
