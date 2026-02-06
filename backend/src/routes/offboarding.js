/**
 * HeadOfficeOS - Offboarding Routes
 * API routes for employee offboarding workflow management.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: Offboarding
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../controllers/notificationController');
const { logAction } = require('../utils/auditLog');

// All routes require authentication
router.use(authenticate);

// Default checklist template
const DEFAULT_CHECKLIST = [
  { type: 'equipment_return', name: 'Return laptop/computer', role: 'IT', order: 1 },
  { type: 'equipment_return', name: 'Return mobile phone', role: 'IT', order: 2 },
  { type: 'it_access_revoke', name: 'Revoke system access', role: 'IT', order: 3 },
  { type: 'it_access_revoke', name: 'Disable email account', role: 'IT', order: 4 },
  { type: 'badge_collection', name: 'Collect ID badge', role: 'HR', order: 5 },
  { type: 'key_return', name: 'Return office keys', role: 'Manager', order: 6 },
  { type: 'handover_docs', name: 'Complete handover documentation', role: 'Employee', order: 7 },
  { type: 'exit_interview', name: 'Conduct exit interview', role: 'HR', order: 8 },
  { type: 'final_pay', name: 'Process final pay', role: 'Payroll', order: 9 },
  { type: 'p45_issued', name: 'Issue P45', role: 'Payroll', order: 10 },
  { type: 'data_retention', name: 'Flag records for GDPR retention', role: 'HR', order: 11 },
  { type: 'manager_signoff', name: 'Manager sign-off', role: 'Manager', order: 12 },
  { type: 'hr_signoff', name: 'HR sign-off', role: 'HR', order: 13 }
];

// =====================================================
// Workflow Management
// =====================================================

/**
 * POST /api/offboarding
 * Initiate offboarding workflow
 */
router.post('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    console.log('Offboarding POST - body:', req.body);
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    console.log('Offboarding POST - user:', user?.id, 'tenant:', tenantId);
    const {
      employee_id,
      termination_type,
      notice_date,
      last_working_day,
      reason,
      eligible_for_rehire,
      reference_agreed
    } = req.body;

    // Validate required fields
    if (!employee_id || !termination_type || !notice_date || !last_working_day) {
      return res.status(400).json({
        error: 'Missing required fields: employee_id, termination_type, notice_date, last_working_day'
      });
    }

    // Get employee details
    const empResult = await db.query(
      'SELECT id, full_name, manager_id, employment_status FROM users WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = empResult.rows[0];

    if (employee.employment_status === 'offboarded') {
      return res.status(400).json({ error: 'Employee is already offboarded' });
    }

    // Check for existing active workflow
    const existingResult = await db.query(
      `SELECT id FROM offboarding_workflows
       WHERE tenant_id = $1 AND employee_id = $2 AND status NOT IN ('completed', 'cancelled')`,
      [tenantId, employee_id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Active offboarding workflow already exists for this employee',
        existing_workflow_id: existingResult.rows[0].id
      });
    }

    // Create workflow
    const result = await db.query(`
      INSERT INTO offboarding_workflows (
        tenant_id, employee_id, termination_type, notice_date, last_working_day,
        reason, eligible_for_rehire, reference_agreed, initiated_by, manager_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      RETURNING *
    `, [
      tenantId, employee_id, termination_type, notice_date, last_working_day,
      reason, eligible_for_rehire, reference_agreed !== false, user.id, employee.manager_id
    ]);

    const workflow = result.rows[0];

    // Create default checklist items
    for (const item of DEFAULT_CHECKLIST) {
      await db.query(`
        INSERT INTO offboarding_checklist_items (
          tenant_id, workflow_id, item_type, item_name, assigned_role, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [tenantId, workflow.id, item.type, item.name, item.role, item.order]);
    }

    // Create exit interview placeholder
    await db.query(`
      INSERT INTO exit_interviews (tenant_id, workflow_id, employee_id)
      VALUES ($1, $2, $3)
    `, [tenantId, workflow.id, employee_id]);

    // Audit log
    await logAction(db, tenantId, user.id, 'OFFBOARDING_INITIATED', 'offboarding_workflows', workflow.id, null, workflow);

    // Send notifications
    if (employee.manager_id) {
      await createNotification(
        employee.manager_id,
        'offboarding_initiated',
        `Offboarding initiated for ${employee.full_name}`,
        `${employee.full_name} is leaving. Last working day: ${formatDate(last_working_day)}. Please review handover requirements.`,
        workflow.id,
        'offboarding',
        tenantId
      );
    }

    res.status(201).json({
      message: 'Offboarding workflow initiated',
      workflow: workflow,
      checklist_items_created: DEFAULT_CHECKLIST.length
    });
  } catch (err) {
    console.error('Initiate offboarding error:', err);
    res.status(500).json({ error: 'Failed to initiate offboarding' });
  }
});

/**
 * GET /api/offboarding/stats
 * Get offboarding statistics for dashboard
 * IMPORTANT: Must be defined BEFORE /:id route
 */
router.get('/stats', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;

    let managerFilter = '';
    const params = [tenantId];

    if (user.role_name === 'Manager') {
      managerFilter = ' AND manager_id = $2';
      params.push(user.id);
    }

    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '30 days') as completed_this_month,
        COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND last_working_day <= CURRENT_DATE + INTERVAL '7 days' AND last_working_day >= CURRENT_DATE) as leaving_this_week
      FROM offboarding_workflows
      WHERE tenant_id = $1 ${managerFilter}
    `, params);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/offboarding/upcoming
 * Get list of employees with upcoming last working days
 * IMPORTANT: Must be defined BEFORE /:id route
 */
router.get('/upcoming', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT
        ow.id,
        ow.employee_id,
        ow.termination_type,
        ow.last_working_day,
        ow.status,
        u.full_name as employee_name,
        u.email,
        u.employee_number,
        (ow.last_working_day::date - CURRENT_DATE) as days_until
      FROM offboarding_workflows ow
      JOIN users u ON ow.employee_id = u.id
      WHERE ow.tenant_id = $1
        AND ow.status IN ('pending', 'in_progress')
        AND ow.last_working_day >= CURRENT_DATE
        AND ow.last_working_day <= CURRENT_DATE + INTERVAL '1 day' * $2
      ORDER BY ow.last_working_day ASC
    `, [tenantId, parseInt(days)]);

    res.json({ upcoming: result.rows });
  } catch (err) {
    console.error('Get upcoming error:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming offboardings' });
  }
});

/**
 * GET /api/offboarding
 * List all offboarding workflows
 */
router.get('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    let { status, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE ow.tenant_id = $1';
    const params = [tenantId];
    let paramIndex = 2;

    // Managers see only their team's offboarding
    if (user.role_name === 'Manager') {
      whereClause += ` AND ow.manager_id = $${paramIndex}`;
      params.push(user.id);
      paramIndex++;
    }

    // Handle status filter - can be single value or array
    if (status) {
      // Convert to array if it's a string
      const statusArray = Array.isArray(status) ? status : [status];
      const placeholders = statusArray.map((_, i) => `$${paramIndex + i}`).join(', ');
      whereClause += ` AND ow.status IN (${placeholders})`;
      params.push(...statusArray);
      paramIndex += statusArray.length;
    }

    const result = await db.query(`
      SELECT
        ow.*,
        u.full_name as employee_name,
        u.employee_number,
        u.email as employee_email,
        m.full_name as manager_name,
        initiator.full_name as initiated_by_name,
        (SELECT COUNT(*) FROM offboarding_checklist_items WHERE workflow_id = ow.id) as total_items,
        (SELECT COUNT(*) FROM offboarding_checklist_items WHERE workflow_id = ow.id AND completed = true) as completed_items
      FROM offboarding_workflows ow
      JOIN users u ON ow.employee_id = u.id
      LEFT JOIN users m ON ow.manager_id = m.id
      LEFT JOIN users initiator ON ow.initiated_by = initiator.id
      ${whereClause}
      ORDER BY
        CASE ow.status
          WHEN 'in_progress' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'completed' THEN 3
          ELSE 4
        END,
        ow.last_working_day ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), parseInt(offset)]);

    res.json({ workflows: result.rows });
  } catch (err) {
    console.error('List offboarding error:', err);
    res.status(500).json({ error: 'Failed to fetch offboarding workflows' });
  }
});

/**
 * GET /api/offboarding/:id
 * Get single workflow with full details
 */
router.get('/:id', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT
        ow.*,
        u.full_name as employee_name,
        u.employee_number,
        u.email as employee_email,
        u.start_date as employee_start_date,
        m.full_name as manager_name,
        initiator.full_name as initiated_by_name,
        hr.full_name as hr_owner_name,
        completer.full_name as completed_by_name
      FROM offboarding_workflows ow
      JOIN users u ON ow.employee_id = u.id
      LEFT JOIN users m ON ow.manager_id = m.id
      LEFT JOIN users initiator ON ow.initiated_by = initiator.id
      LEFT JOIN users hr ON ow.hr_owner_id = hr.id
      LEFT JOIN users completer ON ow.completed_by = completer.id
      WHERE ow.id = $1 AND ow.tenant_id = $2
    `, [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = result.rows[0];

    // Get checklist items
    const checklistResult = await db.query(`
      SELECT ci.*, u.full_name as assigned_to_name, c.full_name as completed_by_name
      FROM offboarding_checklist_items ci
      LEFT JOIN users u ON ci.assigned_to = u.id
      LEFT JOIN users c ON ci.completed_by = c.id
      WHERE ci.workflow_id = $1
      ORDER BY ci.sort_order
    `, [id]);
    workflow.checklist = checklistResult.rows;

    // Get exit interview
    const exitResult = await db.query(`
      SELECT ei.*, i.full_name as interviewer_name
      FROM exit_interviews ei
      LEFT JOIN users i ON ei.interviewer_id = i.id
      WHERE ei.workflow_id = $1
    `, [id]);
    workflow.exit_interview = exitResult.rows[0] || null;

    // Get handovers
    const handoverResult = await db.query(`
      SELECT h.*, u.full_name as handover_to_name
      FROM offboarding_handovers h
      LEFT JOIN users u ON h.handover_to = u.id
      WHERE h.workflow_id = $1
      ORDER BY h.priority DESC, h.created_at
    `, [id]);
    workflow.handovers = handoverResult.rows;

    res.json({ workflow });
  } catch (err) {
    console.error('Get offboarding error:', err);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

/**
 * PUT /api/offboarding/:id
 * Update workflow
 */
router.put('/:id', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const {
      status,
      last_working_day,
      reason,
      eligible_for_rehire,
      reference_agreed,
      hr_owner_id
    } = req.body;

    const current = await db.query(
      'SELECT * FROM offboarding_workflows WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = current.rows[0];

    if (workflow.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify completed workflow' });
    }

    const result = await db.query(`
      UPDATE offboarding_workflows SET
        status = COALESCE($1, status),
        last_working_day = COALESCE($2, last_working_day),
        reason = COALESCE($3, reason),
        eligible_for_rehire = COALESCE($4, eligible_for_rehire),
        reference_agreed = COALESCE($5, reference_agreed),
        hr_owner_id = COALESCE($6, hr_owner_id)
      WHERE id = $7
      RETURNING *
    `, [status, last_working_day, reason, eligible_for_rehire, reference_agreed, hr_owner_id, id]);

    await logAction(db, tenantId, user.id, 'OFFBOARDING_UPDATED', 'offboarding_workflows', id, workflow, result.rows[0]);

    res.json({ workflow: result.rows[0], message: 'Workflow updated' });
  } catch (err) {
    console.error('Update offboarding error:', err);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

/**
 * DELETE /api/offboarding/:id
 * Cancel workflow
 */
router.delete('/:id', authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;

    const current = await db.query(
      'SELECT * FROM offboarding_workflows WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (current.rows[0].status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel completed workflow' });
    }

    await db.query(
      `UPDATE offboarding_workflows SET status = 'cancelled' WHERE id = $1`,
      [id]
    );

    await logAction(db, tenantId, user.id, 'OFFBOARDING_CANCELLED', 'offboarding_workflows', id, current.rows[0], { status: 'cancelled' });

    res.json({ message: 'Workflow cancelled' });
  } catch (err) {
    console.error('Cancel offboarding error:', err);
    res.status(500).json({ error: 'Failed to cancel workflow' });
  }
});

// =====================================================
// Checklist Management
// =====================================================

/**
 * GET /api/offboarding/:id/checklist
 * Get checklist items
 */
router.get('/:id/checklist', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT ci.*, u.full_name as assigned_to_name, c.full_name as completed_by_name
      FROM offboarding_checklist_items ci
      LEFT JOIN users u ON ci.assigned_to = u.id
      LEFT JOIN users c ON ci.completed_by = c.id
      WHERE ci.workflow_id = $1 AND ci.tenant_id = $2
      ORDER BY ci.sort_order
    `, [id, tenantId]);

    res.json({ checklist: result.rows });
  } catch (err) {
    console.error('Get checklist error:', err);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

/**
 * PUT /api/offboarding/:id/checklist/:itemId
 * Update checklist item (complete/assign)
 */
router.put('/:id/checklist/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const { completed, assigned_to, due_date, completion_notes } = req.body;

    const current = await db.query(
      'SELECT * FROM offboarding_checklist_items WHERE id = $1 AND workflow_id = $2 AND tenant_id = $3',
      [itemId, id, tenantId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    let updateFields = [];
    let params = [];
    let paramIndex = 1;

    if (completed !== undefined) {
      updateFields.push(`completed = $${paramIndex}`);
      params.push(completed);
      paramIndex++;

      if (completed) {
        updateFields.push(`completed_by = $${paramIndex}`);
        params.push(user.id);
        paramIndex++;
        updateFields.push(`completed_at = NOW()`);
      } else {
        updateFields.push(`completed_by = NULL, completed_at = NULL`);
      }
    }

    if (assigned_to !== undefined) {
      updateFields.push(`assigned_to = $${paramIndex}`);
      params.push(assigned_to);
      paramIndex++;
    }

    if (due_date !== undefined) {
      updateFields.push(`due_date = $${paramIndex}`);
      params.push(due_date);
      paramIndex++;
    }

    if (completion_notes !== undefined) {
      updateFields.push(`completion_notes = $${paramIndex}`);
      params.push(completion_notes);
      paramIndex++;
    }

    params.push(itemId);

    const result = await db.query(`
      UPDATE offboarding_checklist_items
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    // Check if all items complete - update workflow status
    const allComplete = await db.query(`
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE completed = true) as done
      FROM offboarding_checklist_items WHERE workflow_id = $1
    `, [id]);

    if (parseInt(allComplete.rows[0].total) === parseInt(allComplete.rows[0].done)) {
      await db.query(
        `UPDATE offboarding_workflows SET status = 'in_progress' WHERE id = $1 AND status = 'pending'`,
        [id]
      );
    }

    res.json({ item: result.rows[0], message: 'Checklist item updated' });
  } catch (err) {
    console.error('Update checklist error:', err);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

/**
 * POST /api/offboarding/:id/checklist
 * Add custom checklist item
 */
router.post('/:id/checklist', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;
    const { item_name, description, assigned_to, due_date } = req.body;

    if (!item_name) {
      return res.status(400).json({ error: 'Item name required' });
    }

    // Get max sort order
    const maxOrder = await db.query(
      'SELECT MAX(sort_order) as max FROM offboarding_checklist_items WHERE workflow_id = $1',
      [id]
    );

    const result = await db.query(`
      INSERT INTO offboarding_checklist_items (
        tenant_id, workflow_id, item_type, item_name, description, assigned_to, due_date, sort_order
      ) VALUES ($1, $2, 'custom', $3, $4, $5, $6, $7)
      RETURNING *
    `, [tenantId, id, item_name, description, assigned_to, due_date, (maxOrder.rows[0].max || 0) + 1]);

    res.status(201).json({ item: result.rows[0], message: 'Custom item added' });
  } catch (err) {
    console.error('Add checklist item error:', err);
    res.status(500).json({ error: 'Failed to add checklist item' });
  }
});

// =====================================================
// Exit Interview
// =====================================================

/**
 * GET /api/offboarding/:id/exit-interview
 * Get exit interview
 */
router.get('/:id/exit-interview', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT ei.*, i.full_name as interviewer_name, u.full_name as employee_name
      FROM exit_interviews ei
      JOIN users u ON ei.employee_id = u.id
      LEFT JOIN users i ON ei.interviewer_id = i.id
      WHERE ei.workflow_id = $1 AND ei.tenant_id = $2
    `, [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exit interview not found' });
    }

    const interview = result.rows[0];

    // Hide HR notes from non-HR users
    if (user.role_name !== 'Admin' && user.role_name !== 'HR Manager') {
      delete interview.hr_notes;
    }

    res.json({ exit_interview: interview });
  } catch (err) {
    console.error('Get exit interview error:', err);
    res.status(500).json({ error: 'Failed to fetch exit interview' });
  }
});

/**
 * PUT /api/offboarding/:id/exit-interview
 * Update exit interview (schedule or complete)
 */
router.put('/:id/exit-interview', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;
    const {
      scheduled_date,
      scheduled_time,
      interviewer_id,
      overall_experience,
      would_recommend_employer,
      would_consider_return,
      reason_for_leaving,
      feedback_management,
      feedback_role,
      feedback_culture,
      feedback_improvements,
      additional_comments,
      hr_notes,
      completed
    } = req.body;

    const current = await db.query(
      'SELECT * FROM exit_interviews WHERE workflow_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Exit interview not found' });
    }

    const interview = current.rows[0];

    // Build update query dynamically
    const updates = [];
    const params = [];
    let idx = 1;

    const addUpdate = (field, value) => {
      if (value !== undefined) {
        updates.push(`${field} = $${idx}`);
        params.push(value);
        idx++;
      }
    };

    addUpdate('scheduled_date', scheduled_date);
    addUpdate('scheduled_time', scheduled_time);
    addUpdate('interviewer_id', interviewer_id);
    addUpdate('overall_experience', overall_experience);
    addUpdate('would_recommend_employer', would_recommend_employer);
    addUpdate('would_consider_return', would_consider_return);
    addUpdate('reason_for_leaving', reason_for_leaving);
    addUpdate('feedback_management', feedback_management);
    addUpdate('feedback_role', feedback_role);
    addUpdate('feedback_culture', feedback_culture);
    addUpdate('feedback_improvements', feedback_improvements);
    addUpdate('additional_comments', additional_comments);

    // Only HR can update hr_notes
    if (hr_notes !== undefined && (user.role_name === 'Admin' || user.role_name === 'HR Manager')) {
      addUpdate('hr_notes', hr_notes);
    }

    if (completed) {
      updates.push(`completed = true, completed_at = NOW()`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    const result = await db.query(`
      UPDATE exit_interviews SET ${updates.join(', ')}
      WHERE workflow_id = $${idx}
      RETURNING *
    `, params);

    // Send notification if scheduling
    if (scheduled_date && interviewer_id && !interview.scheduled_date) {
      const empResult = await db.query('SELECT full_name FROM users WHERE id = $1', [interview.employee_id]);
      await createNotification(
        interview.employee_id,
        'exit_interview_scheduled',
        'Exit Interview Scheduled',
        `Your exit interview has been scheduled for ${formatDate(scheduled_date)}`,
        id,
        'exit_interview',
        tenantId
      );
    }

    res.json({ exit_interview: result.rows[0], message: 'Exit interview updated' });
  } catch (err) {
    console.error('Update exit interview error:', err);
    res.status(500).json({ error: 'Failed to update exit interview' });
  }
});

// =====================================================
// Handovers
// =====================================================

/**
 * GET /api/offboarding/:id/handovers
 * Get handover items
 */
router.get('/:id/handovers', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;

    const result = await db.query(`
      SELECT h.*, u.full_name as handover_to_name
      FROM offboarding_handovers h
      LEFT JOIN users u ON h.handover_to = u.id
      WHERE h.workflow_id = $1 AND h.tenant_id = $2
      ORDER BY
        CASE h.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        h.created_at
    `, [id, tenantId]);

    res.json({ handovers: result.rows });
  } catch (err) {
    console.error('Get handovers error:', err);
    res.status(500).json({ error: 'Failed to fetch handovers' });
  }
});

/**
 * POST /api/offboarding/:id/handovers
 * Add handover item
 */
router.post('/:id/handovers', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;
    const { item_name, item_type, description, priority, handover_to } = req.body;

    if (!item_name || !item_type) {
      return res.status(400).json({ error: 'Item name and type required' });
    }

    const result = await db.query(`
      INSERT INTO offboarding_handovers (
        tenant_id, workflow_id, item_name, item_type, description, priority, handover_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [tenantId, id, item_name, item_type, description, priority || 'medium', handover_to]);

    // Notify recipient
    if (handover_to) {
      const workflow = await db.query(
        'SELECT employee_id FROM offboarding_workflows WHERE id = $1',
        [id]
      );
      const emp = await db.query(
        'SELECT full_name FROM users WHERE id = $1',
        [workflow.rows[0].employee_id]
      );

      await createNotification(
        handover_to,
        'handover_assigned',
        'Handover Assigned',
        `You have been assigned to receive handover of "${item_name}" from ${emp.rows[0].full_name}`,
        result.rows[0].id,
        'handover',
        tenantId
      );
    }

    res.status(201).json({ handover: result.rows[0], message: 'Handover item added' });
  } catch (err) {
    console.error('Add handover error:', err);
    res.status(500).json({ error: 'Failed to add handover item' });
  }
});

/**
 * PUT /api/offboarding/:id/handovers/:itemId
 * Update handover status
 */
router.put('/:id/handovers/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const tenantId = req.session?.tenantId || 1;
    const { status, notes, handover_to } = req.body;

    const result = await db.query(`
      UPDATE offboarding_handovers SET
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        handover_to = COALESCE($3, handover_to),
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
      WHERE id = $4 AND workflow_id = $5 AND tenant_id = $6
      RETURNING *
    `, [status, notes, handover_to, itemId, id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Handover item not found' });
    }

    res.json({ handover: result.rows[0], message: 'Handover updated' });
  } catch (err) {
    console.error('Update handover error:', err);
    res.status(500).json({ error: 'Failed to update handover' });
  }
});

// =====================================================
// Workflow Actions
// =====================================================

/**
 * POST /api/offboarding/:id/complete
 * Mark workflow as complete
 */
router.post('/:id/complete', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;

    const workflow = await db.query(
      'SELECT * FROM offboarding_workflows WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (workflow.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.rows[0].status === 'completed') {
      return res.status(400).json({ error: 'Workflow already completed' });
    }

    // Check incomplete checklist items
    const incomplete = await db.query(`
      SELECT COUNT(*) as count FROM offboarding_checklist_items
      WHERE workflow_id = $1 AND completed = false
    `, [id]);

    if (parseInt(incomplete.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot complete workflow with incomplete checklist items',
        incomplete_items: parseInt(incomplete.rows[0].count)
      });
    }

    // Update workflow
    const result = await db.query(`
      UPDATE offboarding_workflows SET
        status = 'completed',
        completed_at = NOW(),
        completed_by = $1
      WHERE id = $2
      RETURNING *
    `, [user.id, id]);

    // Update employee status to offboarded
    await db.query(`
      UPDATE users SET
        employment_status = 'offboarded',
        end_date = $1
      WHERE id = $2
    `, [workflow.rows[0].last_working_day, workflow.rows[0].employee_id]);

    await logAction(db, tenantId, user.id, 'OFFBOARDING_COMPLETED', 'offboarding_workflows', id, workflow.rows[0], result.rows[0]);

    // Notify manager
    if (workflow.rows[0].manager_id) {
      const emp = await db.query('SELECT full_name FROM users WHERE id = $1', [workflow.rows[0].employee_id]);
      await createNotification(
        workflow.rows[0].manager_id,
        'offboarding_completed',
        'Offboarding Complete',
        `Offboarding for ${emp.rows[0].full_name} has been completed.`,
        id,
        'offboarding',
        tenantId
      );
    }

    res.json({
      workflow: result.rows[0],
      message: 'Offboarding workflow completed. Employee status updated to offboarded.'
    });
  } catch (err) {
    console.error('Complete offboarding error:', err);
    res.status(500).json({ error: 'Failed to complete workflow' });
  }
});

/**
 * GET /api/offboarding/my-tasks
 * Get current user's assigned offboarding tasks
 */
router.get('/my-tasks/pending', async (req, res) => {
  try {
    const { user } = req;
    const tenantId = req.session?.tenantId || 1;

    // Get checklist items assigned to user
    const checklistResult = await db.query(`
      SELECT
        ci.*,
        ow.employee_id,
        u.full_name as employee_name,
        ow.last_working_day
      FROM offboarding_checklist_items ci
      JOIN offboarding_workflows ow ON ci.workflow_id = ow.id
      JOIN users u ON ow.employee_id = u.id
      WHERE ci.assigned_to = $1
        AND ci.tenant_id = $2
        AND ci.completed = false
        AND ow.status NOT IN ('completed', 'cancelled')
      ORDER BY ow.last_working_day ASC
    `, [user.id, tenantId]);

    // Get handovers assigned to user
    const handoverResult = await db.query(`
      SELECT
        h.*,
        ow.employee_id,
        u.full_name as employee_name,
        ow.last_working_day
      FROM offboarding_handovers h
      JOIN offboarding_workflows ow ON h.workflow_id = ow.id
      JOIN users u ON ow.employee_id = u.id
      WHERE h.handover_to = $1
        AND h.tenant_id = $2
        AND h.status != 'completed'
        AND ow.status NOT IN ('completed', 'cancelled')
      ORDER BY ow.last_working_day ASC
    `, [user.id, tenantId]);

    res.json({
      checklist_items: checklistResult.rows,
      handovers: handoverResult.rows
    });
  } catch (err) {
    console.error('Get my tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// =====================================================
// Deadline Notifications
// =====================================================

/**
 * POST /api/offboarding/check-deadlines
 * Check for upcoming last working days and create notifications
 * Should be called daily by a scheduled job
 */
router.post('/check-deadlines', authorize('Admin'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Milestones to check (days before last working day)
    const milestones = [
      { days: 14, label: '2 weeks', urgent: false },
      { days: 7, label: '1 week', urgent: false },
      { days: 2, label: '2 days', urgent: true },
      { days: 1, label: 'tomorrow', urgent: true },
      { days: 0, label: 'today', urgent: true }
    ];

    const notifications = [];

    for (const milestone of milestones) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + milestone.days);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Find workflows with last_working_day matching this milestone
      const workflows = await db.query(`
        SELECT
          ow.id,
          ow.employee_id,
          ow.manager_id,
          ow.hr_owner_id,
          ow.last_working_day,
          ow.termination_type,
          u.full_name as employee_name
        FROM offboarding_workflows ow
        JOIN users u ON ow.employee_id = u.id
        WHERE ow.tenant_id = $1
          AND ow.status IN ('pending', 'in_progress')
          AND ow.last_working_day::date = $2::date
      `, [tenantId, dateStr]);

      for (const workflow of workflows.rows) {
        const title = milestone.days === 0
          ? `Last Day: ${workflow.employee_name}`
          : `Offboarding Reminder: ${workflow.employee_name}`;

        const message = milestone.days === 0
          ? `Today is ${workflow.employee_name}'s last working day. Ensure all offboarding tasks are complete.`
          : `${workflow.employee_name}'s last working day is ${milestone.label} away (${formatDate(workflow.last_working_day)}).`;

        // Notify HR owner
        if (workflow.hr_owner_id) {
          await createNotification(
            workflow.hr_owner_id,
            'offboarding_reminder',
            title,
            message,
            workflow.id,
            'offboarding',
            tenantId,
            milestone.urgent
          );
          notifications.push({ user: 'HR Owner', employee: workflow.employee_name, milestone: milestone.label });
        }

        // Notify manager
        if (workflow.manager_id) {
          await createNotification(
            workflow.manager_id,
            'offboarding_reminder',
            title,
            message,
            workflow.id,
            'offboarding',
            tenantId,
            milestone.urgent
          );
          notifications.push({ user: 'Manager', employee: workflow.employee_name, milestone: milestone.label });
        }
      }
    }

    res.json({
      message: `Checked ${milestones.length} milestones`,
      notifications_created: notifications.length,
      details: notifications
    });
  } catch (err) {
    console.error('Check deadlines error:', err);
    res.status(500).json({ error: 'Failed to check deadlines' });
  }
});

// =====================================================
// Helper Functions
// =====================================================

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

module.exports = router;
