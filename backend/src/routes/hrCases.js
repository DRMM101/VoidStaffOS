/**
 * VoidStaffOS - HR Cases Routes
 * API routes for PIP, Disciplinary, and Grievance management.
 * ACAS-compliant workflows with full audit trails.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: HR Cases
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../controllers/notificationController');
const { logAction } = require('../utils/auditLog');

// All routes require authentication
router.use(authenticate);

// ACAS Guidance for each case type and stage
const ACAS_GUIDANCE = {
  disciplinary: {
    investigation: "Gather all facts before taking action. Interview witnesses, collect evidence. Do not pre-judge the outcome.",
    notification: "Inform employee in writing of allegations and their right to be accompanied at any hearing.",
    hearing: "Allow employee to respond fully. They may bring a workplace colleague or trade union representative.",
    decision: "Confirm decision in writing within a reasonable timeframe. State clearly the right to appeal.",
    appeal: "Employee has right to appeal any formal decision. A different, more senior manager should hear the appeal."
  },
  grievance: {
    submission: "Employee should raise their grievance formally in writing, stating the nature of their complaint.",
    investigation: "Investigate promptly and thoroughly. Gather all relevant information before the meeting.",
    meeting: "Meet with employee to discuss their grievance. Allow them to bring a companion if requested.",
    decision: "Respond in writing with your decision and the reasons for it. Be clear and specific.",
    appeal: "If not satisfied, employee may appeal to a more senior manager. Handle appeal without unreasonable delay."
  },
  pip: {
    initiation: "Clearly explain performance concerns and give employee opportunity to respond before starting PIP.",
    objectives: "Set SMART objectives: Specific, Measurable, Achievable, Relevant, Time-bound.",
    support: "Provide adequate support, training, and regular review meetings throughout the PIP period.",
    review: "Review progress against objectives fairly. Document all conversations and feedback.",
    outcome: "At end of PIP, confirm outcome clearly. If unsuccessful, follow appropriate next steps."
  }
};

// =====================================================
// Access Control Middleware
// =====================================================

/**
 * Check if user can access a specific case
 * HR and Admin can access all, managers can access their team's cases,
 * employees can only see their own grievances (limited view)
 */
const canAccessCase = async (req, res, next) => {
  try {
    const { id: caseId } = req.params;
    const { id: userId, role_name: role, tier } = req.user;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(
      `SELECT c.*, u.full_name as employee_name
       FROM hr_cases c
       JOIN users u ON c.employee_id = u.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [caseId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const hrCase = result.rows[0];
    req.hrCase = hrCase;

    // HR can access all
    if (role === 'Admin' || role === 'HR') {
      return next();
    }

    // Manager can access their team's cases
    if (hrCase.manager_id === userId || hrCase.case_owner_id === userId) {
      return next();
    }

    // Employee can only see own grievances with limited view
    if (hrCase.employee_id === userId && hrCase.case_type === 'grievance') {
      req.limitedView = true;
      return next();
    }

    return res.status(403).json({ error: 'Access denied to this case' });
  } catch (error) {
    console.error('Case access check error:', error);
    return res.status(500).json({ error: 'Failed to verify case access' });
  }
};

// =====================================================
// Dashboard & Statistics
// =====================================================

/**
 * GET /api/hr-cases/stats
 * Dashboard statistics
 */
router.get('/stats', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const { role_name: role, id: userId } = req.user;

    let whereClause = 'WHERE c.tenant_id = $1';
    const params = [tenantId];

    // Managers only see cases where they are manager or owner
    if (role !== 'Admin' && role !== 'HR') {
      whereClause += ' AND (c.manager_id = $2 OR c.case_owner_id = $2)';
      params.push(userId);
    }

    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE c.status NOT IN ('closed', 'draft')) as active_cases,
        COUNT(*) FILTER (WHERE c.case_type = 'pip' AND c.status NOT IN ('closed', 'draft')) as active_pips,
        COUNT(*) FILTER (WHERE c.case_type = 'disciplinary' AND c.status NOT IN ('closed', 'draft')) as active_disciplinary,
        COUNT(*) FILTER (WHERE c.case_type = 'grievance' AND c.status NOT IN ('closed', 'draft')) as active_grievances,
        COUNT(*) FILTER (WHERE c.status = 'draft') as draft_cases,
        COUNT(*) FILTER (WHERE c.status = 'closed' AND c.closed_date >= CURRENT_DATE - INTERVAL '30 days') as closed_this_month,
        COUNT(*) FILTER (WHERE c.appeal_requested = true AND c.status = 'appeal') as pending_appeals
      FROM hr_cases c
      ${whereClause}
    `, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get HR case stats error:', error);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

/**
 * GET /api/hr-cases/my-cases
 * Cases for current user's team (manager view)
 */
router.get('/my-cases', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const { id: userId, role_name: role } = req.user;

    let whereClause = 'WHERE c.tenant_id = $1 AND c.status NOT IN (\'closed\')';
    const params = [tenantId];

    // Unless HR/Admin, only see cases where user is manager or owner
    if (role !== 'Admin' && role !== 'HR') {
      whereClause += ' AND (c.manager_id = $2 OR c.case_owner_id = $2)';
      params.push(userId);
    }

    const result = await db.query(`
      SELECT c.*,
        u.full_name as employee_name,
        owner.full_name as case_owner_name,
        mgr.full_name as manager_name
      FROM hr_cases c
      JOIN users u ON c.employee_id = u.id
      LEFT JOIN users owner ON c.case_owner_id = owner.id
      LEFT JOIN users mgr ON c.manager_id = mgr.id
      ${whereClause}
      ORDER BY
        CASE c.status
          WHEN 'appeal' THEN 1
          WHEN 'hearing_scheduled' THEN 2
          WHEN 'awaiting_decision' THEN 3
          WHEN 'investigation' THEN 4
          WHEN 'open' THEN 5
          ELSE 6
        END,
        c.opened_date DESC
    `, params);

    res.json({ cases: result.rows });
  } catch (error) {
    console.error('Get my cases error:', error);
    res.status(500).json({ error: 'Failed to load cases' });
  }
});

/**
 * GET /api/hr-cases/guidance/:caseType/:stage
 * Get ACAS guidance for a specific case type and stage
 */
router.get('/guidance/:caseType/:stage', (req, res) => {
  const { caseType, stage } = req.params;
  const guidance = ACAS_GUIDANCE[caseType]?.[stage];

  if (!guidance) {
    return res.status(404).json({ error: 'Guidance not found for this case type and stage' });
  }

  res.json({ guidance, caseType, stage });
});

// =====================================================
// Employee Grievance Self-Service
// IMPORTANT: These routes must come BEFORE /:id routes
// =====================================================

/**
 * POST /api/hr-cases/grievance/submit
 * Employee submits grievance (confidential)
 */
router.post('/grievance/submit', async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const { summary, background } = req.body;

    if (!summary) {
      return res.status(400).json({ error: 'Grievance summary is required' });
    }

    // Create grievance case
    const result = await db.query(`
      INSERT INTO hr_cases (
        tenant_id, employee_id, case_type, summary, background,
        opened_by, manager_id, status, confidential
      )
      VALUES ($1, $2, 'grievance', $3, $4, $5, $6, 'open', true)
      RETURNING *
    `, [tenantId, user.id, summary, background, user.id, user.manager_id]);

    const newCase = result.rows[0];

    // Add initial note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by, visible_to_employee)
      VALUES ($1, $2, 'general', 'Grievance submitted by employee', $3, true)
    `, [tenantId, newCase.id, user.id]);

    // Notify HR (find HR users)
    const hrUsers = await db.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role_name = 'Admin'`,
      [tenantId]
    );

    for (const hr of hrUsers.rows) {
      await createNotification(
        hr.id,
        'grievance_submitted',
        'Grievance Submitted',
        `A new grievance (${newCase.case_reference}) has been submitted and requires review.`,
        newCase.id,
        'hr_case',
        tenantId
      );
    }

    // Log the action
    await logAction(tenantId, user.id, 'grievance_submitted', {
      case_id: newCase.id,
      case_reference: newCase.case_reference
    });

    res.status(201).json({
      message: 'Grievance submitted successfully',
      case_reference: newCase.case_reference
    });
  } catch (error) {
    console.error('Submit grievance error:', error);
    res.status(500).json({ error: 'Failed to submit grievance' });
  }
});

/**
 * GET /api/hr-cases/grievance/my-grievances
 * Employee views own grievances
 */
router.get('/grievance/my-grievances', async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT
        id,
        case_reference,
        status,
        summary,
        opened_date,
        grievance_outcome,
        outcome_date,
        appeal_requested
      FROM hr_cases
      WHERE tenant_id = $1
        AND employee_id = $2
        AND case_type = 'grievance'
      ORDER BY created_at DESC
    `, [tenantId, user.id]);

    res.json({ grievances: result.rows });
  } catch (error) {
    console.error('Get my grievances error:', error);
    res.status(500).json({ error: 'Failed to load grievances' });
  }
});

// =====================================================
// Case CRUD
// =====================================================

/**
 * GET /api/hr-cases
 * List all cases with filtering
 */
router.get('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const { role_name: role, id: userId } = req.user;
    const { case_type, status, employee_id, include_closed } = req.query;

    let whereClause = 'WHERE c.tenant_id = $1';
    const params = [tenantId];
    let paramIndex = 2;

    // Managers only see their team's cases
    if (role !== 'Admin' && role !== 'HR') {
      whereClause += ` AND (c.manager_id = $${paramIndex} OR c.case_owner_id = $${paramIndex})`;
      params.push(userId);
      paramIndex++;
    }

    if (case_type) {
      whereClause += ` AND c.case_type = $${paramIndex}`;
      params.push(case_type);
      paramIndex++;
    }

    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      const placeholders = statusArray.map((_, i) => `$${paramIndex + i}`).join(', ');
      whereClause += ` AND c.status IN (${placeholders})`;
      params.push(...statusArray);
      paramIndex += statusArray.length;
    } else if (include_closed !== 'true') {
      whereClause += ` AND c.status != 'closed'`;
    }

    if (employee_id) {
      whereClause += ` AND c.employee_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }

    const result = await db.query(`
      SELECT c.*,
        u.full_name as employee_name,
        owner.full_name as case_owner_name,
        mgr.full_name as manager_name
      FROM hr_cases c
      JOIN users u ON c.employee_id = u.id
      LEFT JOIN users owner ON c.case_owner_id = owner.id
      LEFT JOIN users mgr ON c.manager_id = mgr.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `, params);

    res.json({ cases: result.rows });
  } catch (error) {
    console.error('Get HR cases error:', error);
    res.status(500).json({ error: 'Failed to load cases' });
  }
});

/**
 * POST /api/hr-cases
 * Create new case (PIP/Disciplinary/Grievance)
 */
router.post('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const {
      employee_id,
      case_type,
      summary,
      background,
      target_close_date,
      case_owner_id
    } = req.body;

    // Validate required fields
    if (!employee_id || !case_type || !summary) {
      return res.status(400).json({
        error: 'Missing required fields: employee_id, case_type, summary'
      });
    }

    // Validate case type
    if (!['pip', 'disciplinary', 'grievance'].includes(case_type)) {
      return res.status(400).json({ error: 'Invalid case type' });
    }

    // Get employee details
    const empResult = await db.query(
      'SELECT id, full_name, manager_id FROM users WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = empResult.rows[0];

    // Create the case
    const result = await db.query(`
      INSERT INTO hr_cases (
        tenant_id, employee_id, case_type, summary, background,
        target_close_date, opened_by, case_owner_id, manager_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
      RETURNING *
    `, [
      tenantId,
      employee_id,
      case_type,
      summary,
      background || null,
      target_close_date || null,
      user.id,
      case_owner_id || user.id,
      employee.manager_id
    ]);

    const newCase = result.rows[0];

    // Log the action
    await logAction(tenantId, user.id, 'hr_case_created', {
      case_id: newCase.id,
      case_reference: newCase.case_reference,
      case_type,
      employee_id
    });

    // Add initial note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
      VALUES ($1, $2, 'general', $3, $4)
    `, [tenantId, newCase.id, `Case created: ${summary}`, user.id]);

    res.status(201).json(newCase);
  } catch (error) {
    console.error('Create HR case error:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

/**
 * GET /api/hr-cases/:id
 * Get case details
 */
router.get('/:id', canAccessCase, async (req, res) => {
  try {
    const hrCase = req.hrCase;

    // If limited view (employee viewing own grievance), remove sensitive data
    if (req.limitedView) {
      delete hrCase.background;
      delete hrCase.outcome_notes;
    }

    // Get counts
    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM pip_objectives WHERE case_id = $1) as objectives_count,
        (SELECT COUNT(*) FROM hr_case_meetings WHERE case_id = $1) as meetings_count,
        (SELECT COUNT(*) FROM hr_case_notes WHERE case_id = $1) as notes_count,
        (SELECT COUNT(*) FROM hr_case_milestones WHERE case_id = $1) as milestones_count,
        (SELECT COUNT(*) FROM hr_case_witnesses WHERE case_id = $1) as witnesses_count
    `, [hrCase.id]);

    res.json({
      ...hrCase,
      ...counts.rows[0],
      guidance: ACAS_GUIDANCE[hrCase.case_type]
    });
  } catch (error) {
    console.error('Get HR case error:', error);
    res.status(500).json({ error: 'Failed to load case' });
  }
});

/**
 * PUT /api/hr-cases/:id
 * Update case
 */
router.put('/:id', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const {
      summary,
      background,
      target_close_date,
      case_owner_id,
      confidential,
      legal_hold
    } = req.body;

    // Cannot update closed cases
    if (hrCase.status === 'closed') {
      return res.status(400).json({ error: 'Cannot update closed cases' });
    }

    // Cannot update cases on legal hold (except to change legal_hold itself)
    if (hrCase.legal_hold && !legal_hold) {
      return res.status(400).json({ error: 'Case is on legal hold. Cannot modify.' });
    }

    const result = await db.query(`
      UPDATE hr_cases SET
        summary = COALESCE($1, summary),
        background = COALESCE($2, background),
        target_close_date = COALESCE($3, target_close_date),
        case_owner_id = COALESCE($4, case_owner_id),
        confidential = COALESCE($5, confidential),
        legal_hold = COALESCE($6, legal_hold),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
    `, [
      summary,
      background,
      target_close_date,
      case_owner_id,
      confidential,
      legal_hold,
      hrCase.id,
      tenantId
    ]);

    // Log the update
    await logAction(tenantId, user.id, 'hr_case_updated', {
      case_id: hrCase.id,
      case_reference: hrCase.case_reference
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update HR case error:', error);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

/**
 * DELETE /api/hr-cases/:id
 * Delete draft case only
 */
router.delete('/:id', authorize('Admin'), canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;

    // Can only delete draft cases
    if (hrCase.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete draft cases' });
    }

    // Cannot delete if on legal hold
    if (hrCase.legal_hold) {
      return res.status(400).json({ error: 'Case is on legal hold. Cannot delete.' });
    }

    await db.query('DELETE FROM hr_cases WHERE id = $1 AND tenant_id = $2', [hrCase.id, tenantId]);

    // Log deletion
    await logAction(tenantId, user.id, 'hr_case_deleted', {
      case_id: hrCase.id,
      case_reference: hrCase.case_reference
    });

    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Delete HR case error:', error);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

// =====================================================
// Status Management
// =====================================================

/**
 * POST /api/hr-cases/:id/open
 * Open case (from draft)
 */
router.post('/:id/open', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;

    if (hrCase.status !== 'draft') {
      return res.status(400).json({ error: 'Can only open draft cases' });
    }

    const result = await db.query(`
      UPDATE hr_cases SET
        status = 'open',
        opened_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [hrCase.id, tenantId]);

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by, visible_to_employee)
      VALUES ($1, $2, 'general', 'Case formally opened', $3, true)
    `, [tenantId, hrCase.id, user.id]);

    // Notify case owner
    if (hrCase.case_owner_id && hrCase.case_owner_id !== user.id) {
      await createNotification(
        hrCase.case_owner_id,
        'hr_case_opened',
        `${hrCase.case_type.toUpperCase()} Case Opened`,
        `Case ${hrCase.case_reference} has been formally opened and requires your attention.`,
        hrCase.id,
        'hr_case',
        tenantId
      );
    }

    // Log the action
    await logAction(tenantId, user.id, 'hr_case_opened', {
      case_id: hrCase.id,
      case_reference: hrCase.case_reference
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Open HR case error:', error);
    res.status(500).json({ error: 'Failed to open case' });
  }
});

/**
 * POST /api/hr-cases/:id/status
 * Update case status
 */
router.post('/:id/status', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { status, notes } = req.body;

    const validStatuses = ['open', 'investigation', 'hearing_scheduled', 'awaiting_decision', 'appeal'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Cannot change status of closed cases
    if (hrCase.status === 'closed') {
      return res.status(400).json({ error: 'Cannot change status of closed cases' });
    }

    const result = await db.query(`
      UPDATE hr_cases SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `, [status, hrCase.id, tenantId]);

    // Add note about status change
    if (notes) {
      await db.query(`
        INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
        VALUES ($1, $2, 'general', $3, $4)
      `, [tenantId, hrCase.id, `Status changed to ${status}: ${notes}`, user.id]);
    }

    // Log the action
    await logAction(tenantId, user.id, 'hr_case_status_changed', {
      case_id: hrCase.id,
      case_reference: hrCase.case_reference,
      old_status: hrCase.status,
      new_status: status
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update HR case status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * POST /api/hr-cases/:id/close
 * Close case with outcome
 */
router.post('/:id/close', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { outcome, outcome_notes } = req.body;

    if (!outcome) {
      return res.status(400).json({ error: 'Outcome is required to close case' });
    }

    // Validate outcome based on case type
    let outcomeField;
    switch (hrCase.case_type) {
      case 'pip':
        outcomeField = 'pip_outcome';
        if (!['passed', 'extended', 'failed', 'cancelled'].includes(outcome)) {
          return res.status(400).json({ error: 'Invalid PIP outcome' });
        }
        break;
      case 'disciplinary':
        outcomeField = 'disciplinary_outcome';
        if (!['no_action', 'verbal_warning', 'written_warning', 'final_warning', 'dismissal', 'appeal_upheld', 'appeal_rejected'].includes(outcome)) {
          return res.status(400).json({ error: 'Invalid disciplinary outcome' });
        }
        break;
      case 'grievance':
        outcomeField = 'grievance_outcome';
        if (!['upheld', 'partially_upheld', 'not_upheld', 'withdrawn', 'appeal_upheld', 'appeal_rejected'].includes(outcome)) {
          return res.status(400).json({ error: 'Invalid grievance outcome' });
        }
        break;
    }

    const result = await db.query(`
      UPDATE hr_cases SET
        status = 'closed',
        ${outcomeField} = $1,
        outcome_notes = $2,
        outcome_date = CURRENT_DATE,
        outcome_by = $3,
        closed_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5
      RETURNING *
    `, [outcome, outcome_notes, user.id, hrCase.id, tenantId]);

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by, visible_to_employee)
      VALUES ($1, $2, 'decision', $3, $4, true)
    `, [tenantId, hrCase.id, `Case closed with outcome: ${outcome}. ${outcome_notes || ''}`, user.id]);

    // Notify employee
    await createNotification(
      hrCase.employee_id,
      'hr_case_outcome_recorded',
      `${hrCase.case_type.toUpperCase()} Case Outcome`,
      `Case ${hrCase.case_reference} has been closed. The outcome has been recorded.`,
      hrCase.id,
      'hr_case',
      tenantId
    );

    // Log the action
    await logAction(tenantId, user.id, 'hr_case_closed', {
      case_id: hrCase.id,
      case_reference: hrCase.case_reference,
      outcome
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Close HR case error:', error);
    res.status(500).json({ error: 'Failed to close case' });
  }
});

/**
 * POST /api/hr-cases/:id/appeal
 * Record appeal request
 */
router.post('/:id/appeal', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { appeal_reason, appeal_heard_by } = req.body;

    // Can only appeal closed cases
    if (hrCase.status !== 'closed') {
      return res.status(400).json({ error: 'Can only appeal closed cases' });
    }

    const result = await db.query(`
      UPDATE hr_cases SET
        status = 'appeal',
        appeal_requested = true,
        appeal_date = CURRENT_DATE,
        appeal_heard_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `, [appeal_heard_by, hrCase.id, tenantId]);

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by, visible_to_employee)
      VALUES ($1, $2, 'appeal', $3, $4, true)
    `, [tenantId, hrCase.id, `Appeal submitted: ${appeal_reason || 'No reason provided'}`, user.id]);

    // Notify appeal hearer
    if (appeal_heard_by) {
      await createNotification(
        appeal_heard_by,
        'hr_case_appeal_submitted',
        'Appeal Submitted',
        `An appeal has been submitted for case ${hrCase.case_reference}. Your review is required.`,
        hrCase.id,
        'hr_case',
        tenantId
      );
    }

    // Log the action
    await logAction(tenantId, user.id, 'hr_case_appeal_submitted', {
      case_id: hrCase.id,
      case_reference: hrCase.case_reference
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Submit HR case appeal error:', error);
    res.status(500).json({ error: 'Failed to submit appeal' });
  }
});

// =====================================================
// PIP Objectives
// =====================================================

/**
 * GET /api/hr-cases/:id/objectives
 * Get PIP objectives
 */
router.get('/:id/objectives', canAccessCase, async (req, res) => {
  try {
    const hrCase = req.hrCase;
    const tenantId = req.session?.tenantId || 1;

    if (hrCase.case_type !== 'pip') {
      return res.status(400).json({ error: 'Objectives are only available for PIP cases' });
    }

    const result = await db.query(`
      SELECT o.*, r.full_name as reviewed_by_name
      FROM pip_objectives o
      LEFT JOIN users r ON o.reviewed_by = r.id
      WHERE o.case_id = $1 AND o.tenant_id = $2
      ORDER BY o.target_date ASC
    `, [hrCase.id, tenantId]);

    res.json({ objectives: result.rows });
  } catch (error) {
    console.error('Get PIP objectives error:', error);
    res.status(500).json({ error: 'Failed to load objectives' });
  }
});

/**
 * POST /api/hr-cases/:id/objectives
 * Add PIP objective
 */
router.post('/:id/objectives', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { objective, success_criteria, support_provided, target_date } = req.body;

    if (hrCase.case_type !== 'pip') {
      return res.status(400).json({ error: 'Objectives are only available for PIP cases' });
    }

    if (!objective || !success_criteria || !target_date) {
      return res.status(400).json({
        error: 'Missing required fields: objective, success_criteria, target_date'
      });
    }

    const result = await db.query(`
      INSERT INTO pip_objectives (tenant_id, case_id, objective, success_criteria, support_provided, target_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [tenantId, hrCase.id, objective, success_criteria, support_provided, target_date]);

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
      VALUES ($1, $2, 'general', $3, $4)
    `, [tenantId, hrCase.id, `PIP objective added: ${objective}`, user.id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add PIP objective error:', error);
    res.status(500).json({ error: 'Failed to add objective' });
  }
});

/**
 * PUT /api/hr-cases/:id/objectives/:objId
 * Update/review PIP objective
 */
router.put('/:id/objectives/:objId', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { objId } = req.params;
    const { status, review_notes, objective, success_criteria, support_provided, target_date } = req.body;

    if (hrCase.case_type !== 'pip') {
      return res.status(400).json({ error: 'Objectives are only available for PIP cases' });
    }

    const result = await db.query(`
      UPDATE pip_objectives SET
        objective = COALESCE($1, objective),
        success_criteria = COALESCE($2, success_criteria),
        support_provided = COALESCE($3, support_provided),
        target_date = COALESCE($4, target_date),
        status = COALESCE($5, status),
        review_notes = COALESCE($6, review_notes),
        reviewed_date = CASE WHEN $5 IS NOT NULL THEN CURRENT_DATE ELSE reviewed_date END,
        reviewed_by = CASE WHEN $5 IS NOT NULL THEN $7 ELSE reviewed_by END
      WHERE id = $8 AND case_id = $9 AND tenant_id = $10
      RETURNING *
    `, [
      objective,
      success_criteria,
      support_provided,
      target_date,
      status,
      review_notes,
      user.id,
      objId,
      hrCase.id,
      tenantId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    // Add note if status changed
    if (status) {
      await db.query(`
        INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
        VALUES ($1, $2, 'general', $3, $4)
      `, [tenantId, hrCase.id, `PIP objective status updated to ${status}: ${review_notes || ''}`, user.id]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update PIP objective error:', error);
    res.status(500).json({ error: 'Failed to update objective' });
  }
});

/**
 * DELETE /api/hr-cases/:id/objectives/:objId
 * Delete PIP objective
 */
router.delete('/:id/objectives/:objId', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { objId } = req.params;

    if (hrCase.case_type !== 'pip') {
      return res.status(400).json({ error: 'Objectives are only available for PIP cases' });
    }

    const result = await db.query(`
      DELETE FROM pip_objectives
      WHERE id = $1 AND case_id = $2 AND tenant_id = $3
      RETURNING objective
    `, [objId, hrCase.id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
      VALUES ($1, $2, 'general', $3, $4)
    `, [tenantId, hrCase.id, `PIP objective removed: ${result.rows[0].objective}`, user.id]);

    res.json({ message: 'Objective deleted successfully' });
  } catch (error) {
    console.error('Delete PIP objective error:', error);
    res.status(500).json({ error: 'Failed to delete objective' });
  }
});

// =====================================================
// Milestones
// =====================================================

/**
 * GET /api/hr-cases/:id/milestones
 * Get case milestones
 */
router.get('/:id/milestones', canAccessCase, async (req, res) => {
  try {
    const hrCase = req.hrCase;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT m.*, c.full_name as completed_by_name
      FROM hr_case_milestones m
      LEFT JOIN users c ON m.completed_by = c.id
      WHERE m.case_id = $1 AND m.tenant_id = $2
      ORDER BY m.milestone_date ASC
    `, [hrCase.id, tenantId]);

    res.json({ milestones: result.rows });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ error: 'Failed to load milestones' });
  }
});

/**
 * POST /api/hr-cases/:id/milestones
 * Add milestone
 */
router.post('/:id/milestones', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { milestone_type, milestone_date, description } = req.body;

    if (!milestone_type || !milestone_date) {
      return res.status(400).json({
        error: 'Missing required fields: milestone_type, milestone_date'
      });
    }

    const result = await db.query(`
      INSERT INTO hr_case_milestones (tenant_id, case_id, milestone_type, milestone_date, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [tenantId, hrCase.id, milestone_type, milestone_date, description]);

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
      VALUES ($1, $2, 'general', $3, $4)
    `, [tenantId, hrCase.id, `Milestone added: ${milestone_type} scheduled for ${milestone_date}`, user.id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add milestone error:', error);
    res.status(500).json({ error: 'Failed to add milestone' });
  }
});

/**
 * PUT /api/hr-cases/:id/milestones/:mId
 * Update milestone
 */
router.put('/:id/milestones/:mId', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { mId } = req.params;
    const { completed, description, milestone_date } = req.body;

    const result = await db.query(`
      UPDATE hr_case_milestones SET
        completed = COALESCE($1, completed),
        completed_date = CASE WHEN $1 = true THEN CURRENT_DATE ELSE completed_date END,
        completed_by = CASE WHEN $1 = true THEN $2 ELSE completed_by END,
        description = COALESCE($3, description),
        milestone_date = COALESCE($4, milestone_date)
      WHERE id = $5 AND case_id = $6 AND tenant_id = $7
      RETURNING *
    `, [completed, user.id, description, milestone_date, mId, hrCase.id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// =====================================================
// Meetings
// =====================================================

/**
 * GET /api/hr-cases/:id/meetings
 * Get case meetings
 */
router.get('/:id/meetings', canAccessCase, async (req, res) => {
  try {
    const hrCase = req.hrCase;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT *
      FROM hr_case_meetings
      WHERE case_id = $1 AND tenant_id = $2
      ORDER BY scheduled_date DESC
    `, [hrCase.id, tenantId]);

    // For each meeting, get attendee names
    for (const meeting of result.rows) {
      if (meeting.attendees && meeting.attendees.length > 0) {
        const attendeeResult = await db.query(
          'SELECT id, full_name FROM users WHERE id = ANY($1)',
          [meeting.attendees]
        );
        meeting.attendee_details = attendeeResult.rows;
      }
    }

    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to load meetings' });
  }
});

/**
 * POST /api/hr-cases/:id/meetings
 * Schedule meeting
 */
router.post('/:id/meetings', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const {
      meeting_type,
      scheduled_date,
      scheduled_time,
      location,
      attendees,
      companion_name,
      companion_type
    } = req.body;

    if (!meeting_type || !scheduled_date) {
      return res.status(400).json({
        error: 'Missing required fields: meeting_type, scheduled_date'
      });
    }

    const result = await db.query(`
      INSERT INTO hr_case_meetings (
        tenant_id, case_id, meeting_type, scheduled_date, scheduled_time,
        location, attendees, companion_name, companion_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      tenantId,
      hrCase.id,
      meeting_type,
      scheduled_date,
      scheduled_time,
      location,
      attendees || [],
      companion_name,
      companion_type
    ]);

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by, visible_to_employee)
      VALUES ($1, $2, 'general', $3, $4, true)
    `, [tenantId, hrCase.id, `${meeting_type} meeting scheduled for ${scheduled_date}`, user.id]);

    // Notify attendees
    if (attendees && attendees.length > 0) {
      for (const attendeeId of attendees) {
        if (attendeeId !== user.id) {
          await createNotification(
            attendeeId,
            'hr_case_meeting_scheduled',
            'Meeting Scheduled',
            `A ${meeting_type} meeting has been scheduled for ${scheduled_date} regarding case ${hrCase.case_reference}.`,
            hrCase.id,
            'hr_case',
            tenantId
          );
        }
      }
    }

    // Notify employee
    await createNotification(
      hrCase.employee_id,
      'hr_case_meeting_scheduled',
      'Meeting Scheduled',
      `A ${meeting_type} meeting has been scheduled for ${scheduled_date}. You have the right to be accompanied by a workplace colleague or trade union representative.`,
      hrCase.id,
      'hr_case',
      tenantId
    );

    // Update case status if appropriate
    if (meeting_type === 'hearing') {
      await db.query(`
        UPDATE hr_cases SET status = 'hearing_scheduled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND tenant_id = $2
      `, [hrCase.id, tenantId]);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

/**
 * PUT /api/hr-cases/:id/meetings/:mId
 * Update meeting
 */
router.put('/:id/meetings/:mId', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { mId } = req.params;
    const {
      held,
      held_date,
      minutes,
      outcome_summary,
      adjourned,
      adjourn_reason,
      scheduled_date,
      scheduled_time,
      location
    } = req.body;

    const result = await db.query(`
      UPDATE hr_case_meetings SET
        held = COALESCE($1, held),
        held_date = COALESCE($2, held_date),
        minutes = COALESCE($3, minutes),
        outcome_summary = COALESCE($4, outcome_summary),
        adjourned = COALESCE($5, adjourned),
        adjourn_reason = COALESCE($6, adjourn_reason),
        scheduled_date = COALESCE($7, scheduled_date),
        scheduled_time = COALESCE($8, scheduled_time),
        location = COALESCE($9, location),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND case_id = $11 AND tenant_id = $12
      RETURNING *
    `, [
      held,
      held_date,
      minutes,
      outcome_summary,
      adjourned,
      adjourn_reason,
      scheduled_date,
      scheduled_time,
      location,
      mId,
      hrCase.id,
      tenantId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // If meeting was held, add note
    if (held) {
      await db.query(`
        INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
        VALUES ($1, $2, 'general', $3, $4)
      `, [tenantId, hrCase.id, `Meeting held: ${outcome_summary || 'See minutes'}`, user.id]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// =====================================================
// Notes
// =====================================================

/**
 * GET /api/hr-cases/:id/notes
 * Get case notes
 */
router.get('/:id/notes', canAccessCase, async (req, res) => {
  try {
    const hrCase = req.hrCase;
    const tenantId = req.session?.tenantId || 1;

    let query = `
      SELECT n.*, c.full_name as created_by_name
      FROM hr_case_notes n
      JOIN users c ON n.created_by = c.id
      WHERE n.case_id = $1 AND n.tenant_id = $2
    `;

    // If employee viewing own grievance, only show notes visible to employee
    if (req.limitedView) {
      query += ' AND n.visible_to_employee = true';
    }

    query += ' ORDER BY n.created_at DESC';

    const result = await db.query(query, [hrCase.id, tenantId]);

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

/**
 * POST /api/hr-cases/:id/notes
 * Add note
 */
router.post('/:id/notes', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { note_type, content, visible_to_employee } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const result = await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, visible_to_employee, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [tenantId, hrCase.id, note_type || 'general', content, visible_to_employee || false, user.id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// =====================================================
// Witnesses
// =====================================================

/**
 * GET /api/hr-cases/:id/witnesses
 * Get case witnesses
 */
router.get('/:id/witnesses', canAccessCase, async (req, res) => {
  try {
    const hrCase = req.hrCase;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT w.*, u.full_name as witness_employee_name
      FROM hr_case_witnesses w
      LEFT JOIN users u ON w.witness_id = u.id
      WHERE w.case_id = $1 AND w.tenant_id = $2
      ORDER BY w.created_at DESC
    `, [hrCase.id, tenantId]);

    res.json({ witnesses: result.rows });
  } catch (error) {
    console.error('Get witnesses error:', error);
    res.status(500).json({ error: 'Failed to load witnesses' });
  }
});

/**
 * POST /api/hr-cases/:id/witnesses
 * Add witness
 */
router.post('/:id/witnesses', canAccessCase, async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { witness_name, witness_id, relationship, statement, statement_date } = req.body;

    if (!witness_name) {
      return res.status(400).json({ error: 'Witness name is required' });
    }

    const result = await db.query(`
      INSERT INTO hr_case_witnesses (
        tenant_id, case_id, witness_name, witness_id, relationship, statement, statement_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [tenantId, hrCase.id, witness_name, witness_id, relationship, statement, statement_date]);

    // Add note
    await db.query(`
      INSERT INTO hr_case_notes (tenant_id, case_id, note_type, content, created_by)
      VALUES ($1, $2, 'investigation', $3, $4)
    `, [tenantId, hrCase.id, `Witness added: ${witness_name} (${relationship || 'unspecified'})`, user.id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add witness error:', error);
    res.status(500).json({ error: 'Failed to add witness' });
  }
});

/**
 * PUT /api/hr-cases/:id/witnesses/:wId
 * Update witness statement
 */
router.put('/:id/witnesses/:wId', canAccessCase, async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const hrCase = req.hrCase;
    const { wId } = req.params;
    const { statement, statement_date, document_id } = req.body;

    const result = await db.query(`
      UPDATE hr_case_witnesses SET
        statement = COALESCE($1, statement),
        statement_date = COALESCE($2, statement_date),
        document_id = COALESCE($3, document_id)
      WHERE id = $4 AND case_id = $5 AND tenant_id = $6
      RETURNING *
    `, [statement, statement_date, document_id, wId, hrCase.id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Witness not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update witness error:', error);
    res.status(500).json({ error: 'Failed to update witness' });
  }
});

module.exports = router;
