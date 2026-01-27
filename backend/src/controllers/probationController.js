/**
 * VoidStaffOS - Probation Controller
 * Probation period and review management.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

const pool = require('../config/database');

// ===========================================
// HELPER FUNCTIONS
// ===========================================

const isHR = (user) => user && (user.tier >= 60 || user.role_name === 'Admin' || user.role_name === 'HR Manager');
const isManager = (user) => user && (user.tier >= 50 || user.role_name === 'Admin' || user.role_name === 'HR Manager');

// Check if user can access employee's probation data
const canAccessEmployee = async (user, employeeId, tenantId) => {
  // HR can access anyone
  if (isHR(user)) return true;

  // Own data
  if (user.id === parseInt(employeeId)) return true;

  // Manager can access direct reports
  if (isManager(user)) {
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND manager_id = $2 AND tenant_id = $3',
      [employeeId, user.id, tenantId]
    );
    return result.rows.length > 0;
  }

  return false;
};

// Calculate review milestones based on duration
const calculateReviewMilestones = (startDate, durationMonths) => {
  const milestones = [];
  const start = new Date(startDate);

  if (durationMonths >= 1) {
    const oneMonth = new Date(start);
    oneMonth.setMonth(oneMonth.getMonth() + 1);
    milestones.push({ type: '1_month', date: oneMonth, number: 1 });
  }

  if (durationMonths >= 3) {
    const threeMonth = new Date(start);
    threeMonth.setMonth(threeMonth.getMonth() + 3);
    milestones.push({ type: '3_month', date: threeMonth, number: 2 });
  }

  if (durationMonths >= 6) {
    const sixMonth = new Date(start);
    sixMonth.setMonth(sixMonth.getMonth() + 6);
    milestones.push({ type: '6_month', date: sixMonth, number: 3 });
  }

  // Final review 2 weeks before end
  const finalDate = new Date(start);
  finalDate.setMonth(finalDate.getMonth() + durationMonths);
  finalDate.setDate(finalDate.getDate() - 14);
  milestones.push({ type: 'final', date: finalDate, number: milestones.length + 1 });

  return milestones;
};

// ===========================================
// PROBATION PERIOD CRUD
// ===========================================

/**
 * Create new probation period for employee
 */
const createProbation = async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.user.tenant_id;
    let { employee_id, candidate_id, start_date, duration_months = 6 } = req.body;

    if (!isHR(req.user) && !isManager(req.user)) {
      return res.status(403).json({ error: 'Only HR or managers can create probation periods' });
    }

    // If candidate_id provided, look up associated employee
    if (candidate_id && !employee_id) {
      const candidateCheck = await client.query(
        'SELECT id, user_id, full_name, proposed_start_date FROM candidates WHERE id = $1 AND tenant_id = $2',
        [candidate_id, tenantId]
      );
      if (candidateCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      const candidate = candidateCheck.rows[0];

      // Use candidate's user_id if they've been promoted to employee
      if (candidate.user_id) {
        employee_id = candidate.user_id;
      } else {
        return res.status(400).json({ error: 'Candidate has not been promoted to employee yet. Promote the candidate first.' });
      }

      // Use candidate's proposed start date if not provided
      if (!start_date && candidate.proposed_start_date) {
        start_date = candidate.proposed_start_date;
      }
    }

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Check employee exists
    const empCheck = await client.query(
      'SELECT id, full_name FROM users WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check no active probation exists
    const existingCheck = await client.query(
      `SELECT id FROM probation_periods
       WHERE tenant_id = $1 AND employee_id = $2 AND status IN ('active', 'extended')`,
      [tenantId, employee_id]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Employee already has an active probation period' });
    }

    await client.query('BEGIN');

    // Calculate end date
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(startDateObj);
    endDateObj.setMonth(endDateObj.getMonth() + duration_months);

    // Create probation period
    const probationResult = await client.query(`
      INSERT INTO probation_periods (
        tenant_id, employee_id, start_date, end_date, duration_months,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING *
    `, [tenantId, employee_id, start_date, endDateObj, duration_months, req.user.id]);

    const probation = probationResult.rows[0];

    // Create review milestones
    const milestones = calculateReviewMilestones(start_date, duration_months);
    for (const milestone of milestones) {
      await client.query(`
        INSERT INTO probation_reviews (
          tenant_id, probation_id, employee_id, review_type,
          review_number, scheduled_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      `, [tenantId, probation.id, employee_id, milestone.type, milestone.number, milestone.date]);
    }

    await client.query('COMMIT');

    // Fetch complete probation with reviews
    const fullResult = await client.query(`
      SELECT pp.*, u.full_name as employee_name,
        (SELECT json_agg(pr ORDER BY pr.review_number)
         FROM probation_reviews pr
         WHERE pr.probation_id = pp.id) as reviews
      FROM probation_periods pp
      JOIN users u ON pp.employee_id = u.id
      WHERE pp.id = $1
    `, [probation.id]);

    res.status(201).json(fullResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating probation:', error);
    res.status(500).json({ error: 'Failed to create probation period' });
  } finally {
    client.release();
  }
};

/**
 * Get probation for specific employee
 */
const getProbation = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { employeeId } = req.params;

    const hasAccess = await canAccessEmployee(req.user, employeeId, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT pp.*,
        u.full_name as employee_name,
        m.full_name as outcome_by_name,
        c.full_name as created_by_name,
        (SELECT json_agg(
          json_build_object(
            'id', pr.id,
            'review_type', pr.review_type,
            'review_number', pr.review_number,
            'scheduled_date', pr.scheduled_date,
            'status', pr.status,
            'completed_date', pr.completed_date,
            'performance_rating', pr.performance_rating,
            'meeting_expectations', pr.meeting_expectations,
            'recommendation', pr.recommendation,
            'manager_signed', pr.manager_signed,
            'employee_acknowledged', pr.employee_acknowledged
          ) ORDER BY pr.review_number
        ) FROM probation_reviews pr WHERE pr.probation_id = pp.id) as reviews
      FROM probation_periods pp
      JOIN users u ON pp.employee_id = u.id
      LEFT JOIN users m ON pp.outcome_by = m.id
      LEFT JOIN users c ON pp.created_by = c.id
      WHERE pp.tenant_id = $1 AND pp.employee_id = $2
      ORDER BY pp.created_at DESC
    `, [tenantId, employeeId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching probation:', error);
    res.status(500).json({ error: 'Failed to fetch probation data' });
  }
};

/**
 * Get current user's probation
 */
const getMyProbation = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const employeeId = req.user.id;

    const result = await pool.query(`
      SELECT pp.*,
        u.full_name as employee_name,
        (SELECT json_agg(
          json_build_object(
            'id', pr.id,
            'review_type', pr.review_type,
            'review_number', pr.review_number,
            'scheduled_date', pr.scheduled_date,
            'status', pr.status,
            'completed_date', pr.completed_date,
            'performance_rating', pr.performance_rating,
            'meeting_expectations', pr.meeting_expectations,
            'recommendation', pr.recommendation,
            'manager_signed', pr.manager_signed,
            'employee_acknowledged', pr.employee_acknowledged,
            'employee_comments', pr.employee_comments
          ) ORDER BY pr.review_number
        ) FROM probation_reviews pr WHERE pr.probation_id = pp.id) as reviews
      FROM probation_periods pp
      JOIN users u ON pp.employee_id = u.id
      WHERE pp.tenant_id = $1 AND pp.employee_id = $2
      ORDER BY pp.created_at DESC
      LIMIT 1
    `, [tenantId, employeeId]);

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching my probation:', error);
    res.status(500).json({ error: 'Failed to fetch probation data' });
  }
};

/**
 * Extend probation period
 */
const extendProbation = async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { extension_weeks, extension_reason } = req.body;

    if (!isHR(req.user) && !isManager(req.user)) {
      return res.status(403).json({ error: 'Only HR or managers can extend probation' });
    }

    if (!extension_weeks || extension_weeks < 1) {
      return res.status(400).json({ error: 'Extension weeks must be at least 1' });
    }

    // Get current probation
    const probResult = await client.query(
      `SELECT * FROM probation_periods WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (probResult.rows.length === 0) {
      return res.status(404).json({ error: 'Probation period not found' });
    }

    const probation = probResult.rows[0];

    if (probation.status !== 'active' && probation.status !== 'extended') {
      return res.status(400).json({ error: 'Can only extend active probation periods' });
    }

    await client.query('BEGIN');

    // Store original end date if first extension
    const originalEndDate = probation.original_end_date || probation.end_date;

    // Calculate new end date
    const currentEndDate = new Date(probation.end_date);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + (extension_weeks * 7));

    // Update probation
    await client.query(`
      UPDATE probation_periods
      SET status = 'extended',
          extended = true,
          extension_weeks = COALESCE(extension_weeks, 0) + $1,
          extension_reason = $2,
          original_end_date = $3,
          end_date = $4
      WHERE id = $5
    `, [extension_weeks, extension_reason, originalEndDate, newEndDate, id]);

    // Create extension review
    const reviewCount = await client.query(
      'SELECT COUNT(*) as count FROM probation_reviews WHERE probation_id = $1',
      [id]
    );

    const extensionReviewDate = new Date(newEndDate);
    extensionReviewDate.setDate(extensionReviewDate.getDate() - 14);

    await client.query(`
      INSERT INTO probation_reviews (
        tenant_id, probation_id, employee_id, review_type,
        review_number, scheduled_date, status
      ) VALUES ($1, $2, $3, 'extension', $4, $5, 'pending')
    `, [tenantId, id, probation.employee_id, parseInt(reviewCount.rows[0].count) + 1, extensionReviewDate]);

    await client.query('COMMIT');

    // Fetch updated probation
    const updated = await client.query(`
      SELECT pp.*, u.full_name as employee_name
      FROM probation_periods pp
      JOIN users u ON pp.employee_id = u.id
      WHERE pp.id = $1
    `, [id]);

    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error extending probation:', error);
    res.status(500).json({ error: 'Failed to extend probation' });
  } finally {
    client.release();
  }
};

/**
 * Record probation outcome (pass/fail)
 */
const recordOutcome = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { outcome, outcome_notes } = req.body;

    if (!isHR(req.user) && !isManager(req.user)) {
      return res.status(403).json({ error: 'Only HR or managers can record probation outcome' });
    }

    if (!['passed', 'failed'].includes(outcome)) {
      return res.status(400).json({ error: 'Outcome must be passed or failed' });
    }

    // Get current probation
    const probResult = await pool.query(
      `SELECT * FROM probation_periods WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (probResult.rows.length === 0) {
      return res.status(404).json({ error: 'Probation period not found' });
    }

    const probation = probResult.rows[0];

    if (probation.status !== 'active' && probation.status !== 'extended') {
      return res.status(400).json({ error: 'Can only record outcome for active probation periods' });
    }

    // Update probation with outcome
    const result = await pool.query(`
      UPDATE probation_periods
      SET status = $1,
          outcome = $1,
          outcome_date = CURRENT_DATE,
          outcome_notes = $2,
          outcome_by = $3
      WHERE id = $4
      RETURNING *
    `, [outcome, outcome_notes, req.user.id, id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error recording outcome:', error);
    res.status(500).json({ error: 'Failed to record probation outcome' });
  }
};

// ===========================================
// PROBATION REVIEWS
// ===========================================

/**
 * Get reviews for a probation period
 */
const getReviews = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    // Check access to the probation
    const probation = await pool.query(
      'SELECT employee_id FROM probation_periods WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (probation.rows.length === 0) {
      return res.status(404).json({ error: 'Probation period not found' });
    }

    const hasAccess = await canAccessEmployee(req.user, probation.rows[0].employee_id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT pr.*,
        m.full_name as manager_name,
        c.full_name as completed_by_name
      FROM probation_reviews pr
      LEFT JOIN users m ON pr.manager_id = m.id
      LEFT JOIN users c ON pr.completed_by = c.id
      WHERE pr.probation_id = $1 AND pr.tenant_id = $2
      ORDER BY pr.review_number
    `, [id, tenantId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch probation reviews' });
  }
};

/**
 * Complete a probation review
 */
const completeReview = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { reviewId } = req.params;
    const {
      performance_rating,
      meeting_expectations,
      areas_of_strength,
      areas_for_improvement,
      support_provided,
      support_needed,
      objectives_for_next_period,
      manager_notes,
      recommendation
    } = req.body;

    if (!isHR(req.user) && !isManager(req.user)) {
      return res.status(403).json({ error: 'Only HR or managers can complete reviews' });
    }

    // Verify review exists and check access
    const reviewCheck = await pool.query(
      'SELECT pr.*, pp.employee_id FROM probation_reviews pr JOIN probation_periods pp ON pr.probation_id = pp.id WHERE pr.id = $1 AND pr.tenant_id = $2',
      [reviewId, tenantId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const result = await pool.query(`
      UPDATE probation_reviews
      SET status = 'completed',
          completed_date = CURRENT_DATE,
          completed_by = $1,
          performance_rating = $2,
          meeting_expectations = $3,
          areas_of_strength = $4,
          areas_for_improvement = $5,
          support_provided = $6,
          support_needed = $7,
          objectives_for_next_period = $8,
          manager_notes = $9,
          recommendation = $10,
          manager_id = $1
      WHERE id = $11
      RETURNING *
    `, [
      req.user.id,
      performance_rating,
      meeting_expectations,
      areas_of_strength,
      areas_for_improvement,
      support_provided,
      support_needed,
      objectives_for_next_period,
      manager_notes,
      recommendation,
      reviewId
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error completing review:', error);
    res.status(500).json({ error: 'Failed to complete review' });
  }
};

/**
 * Manager sign-off on review
 */
const signReview = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { reviewId } = req.params;

    if (!isHR(req.user) && !isManager(req.user)) {
      return res.status(403).json({ error: 'Only HR or managers can sign reviews' });
    }

    // Verify review is completed
    const reviewCheck = await pool.query(
      'SELECT * FROM probation_reviews WHERE id = $1 AND tenant_id = $2',
      [reviewId, tenantId]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (reviewCheck.rows[0].status !== 'completed') {
      return res.status(400).json({ error: 'Review must be completed before signing' });
    }

    const result = await pool.query(`
      UPDATE probation_reviews
      SET manager_signed = true,
          manager_signed_at = NOW(),
          manager_id = $1
      WHERE id = $2
      RETURNING *
    `, [req.user.id, reviewId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error signing review:', error);
    res.status(500).json({ error: 'Failed to sign review' });
  }
};

/**
 * Employee acknowledge review
 */
const acknowledgeReview = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { reviewId } = req.params;
    const { employee_comments } = req.body;

    // Verify review exists and belongs to this employee
    const reviewCheck = await pool.query(
      'SELECT * FROM probation_reviews WHERE id = $1 AND tenant_id = $2 AND employee_id = $3',
      [reviewId, tenantId, req.user.id]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found or access denied' });
    }

    if (!reviewCheck.rows[0].manager_signed) {
      return res.status(400).json({ error: 'Review must be signed by manager before acknowledgment' });
    }

    const result = await pool.query(`
      UPDATE probation_reviews
      SET employee_acknowledged = true,
          employee_acknowledged_at = NOW(),
          employee_comments = $1
      WHERE id = $2
      RETURNING *
    `, [employee_comments, reviewId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error acknowledging review:', error);
    res.status(500).json({ error: 'Failed to acknowledge review' });
  }
};

// ===========================================
// DASHBOARD
// ===========================================

/**
 * HR Dashboard - all probations overview
 */
const getDashboard = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'HR access required' });
    }

    // Get all active/extended probations with stats
    const probationsResult = await pool.query(`
      SELECT pp.*,
        u.full_name as employee_name,
        u.employee_number,
        u.email,
        mgr.full_name as manager_name,
        (SELECT COUNT(*) FROM probation_reviews pr
         WHERE pr.probation_id = pp.id AND pr.status = 'completed') as completed_reviews,
        (SELECT COUNT(*) FROM probation_reviews pr
         WHERE pr.probation_id = pp.id) as total_reviews,
        (SELECT MIN(pr.scheduled_date) FROM probation_reviews pr
         WHERE pr.probation_id = pp.id AND pr.status = 'pending') as next_review_date,
        (SELECT pr.id FROM probation_reviews pr
         WHERE pr.probation_id = pp.id AND pr.status = 'pending'
         ORDER BY pr.scheduled_date LIMIT 1) as next_review_id
      FROM probation_periods pp
      JOIN users u ON pp.employee_id = u.id
      LEFT JOIN users mgr ON u.manager_id = mgr.id
      WHERE pp.tenant_id = $1 AND pp.status IN ('active', 'extended')
      ORDER BY pp.end_date ASC
    `, [tenantId]);

    // Get overdue reviews
    const overdueResult = await pool.query(`
      SELECT pr.*,
        u.full_name as employee_name,
        pp.end_date as probation_end_date
      FROM probation_reviews pr
      JOIN probation_periods pp ON pr.probation_id = pp.id
      JOIN users u ON pr.employee_id = u.id
      WHERE pr.tenant_id = $1
        AND pr.status = 'pending'
        AND pr.scheduled_date < CURRENT_DATE
        AND pp.status IN ('active', 'extended')
      ORDER BY pr.scheduled_date ASC
    `, [tenantId]);

    // Get probations ending within 30 days
    const endingSoonResult = await pool.query(`
      SELECT pp.*, u.full_name as employee_name
      FROM probation_periods pp
      JOIN users u ON pp.employee_id = u.id
      WHERE pp.tenant_id = $1
        AND pp.status IN ('active', 'extended')
        AND pp.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY pp.end_date ASC
    `, [tenantId]);

    // Stats summary
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('active', 'extended')) as active_count,
        COUNT(*) FILTER (WHERE status = 'extended') as extended_count,
        COUNT(*) FILTER (WHERE status = 'passed' AND outcome_date >= CURRENT_DATE - INTERVAL '30 days') as passed_last_30,
        COUNT(*) FILTER (WHERE status = 'failed' AND outcome_date >= CURRENT_DATE - INTERVAL '30 days') as failed_last_30
      FROM probation_periods
      WHERE tenant_id = $1
    `, [tenantId]);

    res.json({
      probations: probationsResult.rows,
      overdueReviews: overdueResult.rows,
      endingSoon: endingSoonResult.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch probation dashboard' });
  }
};

/**
 * Get single review details
 */
const getReview = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { reviewId } = req.params;

    const result = await pool.query(`
      SELECT pr.*,
        u.full_name as employee_name,
        m.full_name as manager_name,
        c.full_name as completed_by_name,
        pp.start_date as probation_start,
        pp.end_date as probation_end,
        pp.status as probation_status
      FROM probation_reviews pr
      JOIN probation_periods pp ON pr.probation_id = pp.id
      JOIN users u ON pr.employee_id = u.id
      LEFT JOIN users m ON pr.manager_id = m.id
      LEFT JOIN users c ON pr.completed_by = c.id
      WHERE pr.id = $1 AND pr.tenant_id = $2
    `, [reviewId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check access
    const hasAccess = await canAccessEmployee(req.user, result.rows[0].employee_id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
};

module.exports = {
  createProbation,
  getProbation,
  getMyProbation,
  extendProbation,
  recordOutcome,
  getReviews,
  getReview,
  completeReview,
  signReview,
  acknowledgeReview,
  getDashboard
};
