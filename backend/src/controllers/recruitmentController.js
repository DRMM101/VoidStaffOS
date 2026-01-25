/**
 * VoidStaffOS - Recruitment Controller
 * Manages the recruitment request workflow.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

const pool = require('../config/database');
const { createNotification } = require('./notificationController');

/**
 * Create a new recruitment request
 */
async function createRequest(req, res) {
  try {
    const { id: userId, manager_id } = req.user;

    const {
      role_title, role_tier, department, role_description, justification,
      proposed_salary_min, proposed_salary_max, proposed_hours, proposed_start_date
    } = req.body;

    if (!role_title || !justification) {
      return res.status(400).json({ error: 'Role title and justification are required' });
    }

    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO recruitment_requests (
        tenant_id, requested_by, approver_id, role_title, role_tier, department,
        role_description, justification, proposed_salary_min, proposed_salary_max,
        proposed_hours, proposed_start_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId, userId, manager_id, role_title, role_tier || null, department || null,
        role_description || null, justification, proposed_salary_min || null,
        proposed_salary_max || null, proposed_hours || 'full-time', proposed_start_date || null
      ]
    );

    res.status(201).json({
      message: 'Recruitment request created as draft',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Create recruitment request error:', error);
    res.status(500).json({ error: 'Failed to create recruitment request' });
  }
}

/**
 * Get recruitment requests (filtered by role)
 */
async function getRequests(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { status } = req.query;

    // Check user's onboarding permissions
    const roleResult = await pool.query(
      `SELECT onboarding_full, onboarding_post_checks FROM roles WHERE role_name = $1`,
      [role_name]
    );
    const permissions = roleResult.rows[0] || {};

    let query;
    let params = [];
    let paramIndex = 1;

    if (role_name === 'Admin' || permissions.onboarding_full) {
      // Admin/HR sees all requests
      query = `
        SELECT rr.*, u.full_name as requested_by_name, a.full_name as approver_name
        FROM recruitment_requests rr
        JOIN users u ON rr.requested_by = u.id
        LEFT JOIN users a ON rr.approver_id = a.id
      `;
    } else {
      // Others see only their own requests
      query = `
        SELECT rr.*, u.full_name as requested_by_name, a.full_name as approver_name
        FROM recruitment_requests rr
        JOIN users u ON rr.requested_by = u.id
        LEFT JOIN users a ON rr.approver_id = a.id
        WHERE rr.requested_by = $${paramIndex}
      `;
      params.push(userId);
      paramIndex++;
    }

    if (status) {
      query += params.length > 0 ? ' AND' : ' WHERE';
      query += ` rr.status = $${paramIndex}`;
      params.push(status);
    }

    query += ' ORDER BY rr.created_at DESC';

    const result = await pool.query(query, params);

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get recruitment requests error:', error);
    res.status(500).json({ error: 'Failed to fetch recruitment requests' });
  }
}

/**
 * Get single recruitment request
 */
async function getRequest(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT rr.*, u.full_name as requested_by_name, a.full_name as approver_name,
              ab.full_name as approved_by_name
       FROM recruitment_requests rr
       JOIN users u ON rr.requested_by = u.id
       LEFT JOIN users a ON rr.approver_id = a.id
       LEFT JOIN users ab ON rr.approved_by = ab.id
       WHERE rr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recruitment request not found' });
    }

    const request = result.rows[0];

    // Check permissions
    const roleResult = await pool.query(
      `SELECT onboarding_full FROM roles WHERE role_name = $1`,
      [role_name]
    );
    const hasFullAccess = role_name === 'Admin' || roleResult.rows[0]?.onboarding_full;

    if (!hasFullAccess && request.requested_by !== userId && request.approver_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get linked candidates count
    const candidatesResult = await pool.query(
      `SELECT COUNT(*) as count FROM candidates WHERE recruitment_request_id = $1`,
      [id]
    );

    res.json({
      request,
      candidates_count: parseInt(candidatesResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get recruitment request error:', error);
    res.status(500).json({ error: 'Failed to fetch recruitment request' });
  }
}

/**
 * Update recruitment request (draft only)
 */
async function updateRequest(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;

    // Check ownership and status
    const existing = await pool.query(
      'SELECT * FROM recruitment_requests WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Recruitment request not found' });
    }

    if (existing.rows[0].requested_by !== userId) {
      return res.status(403).json({ error: 'You can only edit your own requests' });
    }

    if (existing.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Can only edit draft requests' });
    }

    const {
      role_title, role_tier, department, role_description, justification,
      proposed_salary_min, proposed_salary_max, proposed_hours, proposed_start_date
    } = req.body;

    const result = await pool.query(
      `UPDATE recruitment_requests SET
        role_title = COALESCE($1, role_title),
        role_tier = $2,
        department = COALESCE($3, department),
        role_description = $4,
        justification = COALESCE($5, justification),
        proposed_salary_min = $6,
        proposed_salary_max = $7,
        proposed_hours = COALESCE($8, proposed_hours),
        proposed_start_date = $9,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        role_title, role_tier, department, role_description, justification,
        proposed_salary_min, proposed_salary_max, proposed_hours, proposed_start_date, id
      ]
    );

    res.json({
      message: 'Recruitment request updated',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Update recruitment request error:', error);
    res.status(500).json({ error: 'Failed to update recruitment request' });
  }
}

/**
 * Submit request for approval
 */
async function submitRequest(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;

    // Check ownership and status
    const existing = await pool.query(
      'SELECT * FROM recruitment_requests WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Recruitment request not found' });
    }

    if (existing.rows[0].requested_by !== userId) {
      return res.status(403).json({ error: 'You can only submit your own requests' });
    }

    if (existing.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Can only submit draft requests' });
    }

    if (!existing.rows[0].approver_id) {
      return res.status(400).json({ error: 'No approver assigned. Please contact your manager.' });
    }

    const result = await pool.query(
      `UPDATE recruitment_requests SET
        status = 'pending_approval',
        submitted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Notify the approver
    const request = result.rows[0];
    await createNotification(
      request.approver_id,
      'leave_request_pending', // Reusing type, could add specific type
      'Recruitment Request Pending Approval',
      `A recruitment request for "${request.role_title}" requires your approval.`,
      request.id,
      'recruitment_request'
    );

    res.json({
      message: 'Recruitment request submitted for approval',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Submit recruitment request error:', error);
    res.status(500).json({ error: 'Failed to submit recruitment request' });
  }
}

/**
 * Approve recruitment request
 */
async function approveRequest(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { id } = req.params;

    // Check the request exists and is pending
    const existing = await pool.query(
      'SELECT * FROM recruitment_requests WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Recruitment request not found' });
    }

    const request = existing.rows[0];

    if (request.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Request is not pending approval' });
    }

    // Check if user is the approver or admin
    if (role_name !== 'Admin' && request.approver_id !== userId) {
      return res.status(403).json({ error: 'You are not authorized to approve this request' });
    }

    const result = await pool.query(
      `UPDATE recruitment_requests SET
        status = 'approved',
        approved_at = CURRENT_TIMESTAMP,
        approved_by = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    // Notify the requester
    await createNotification(
      request.requested_by,
      'leave_request_approved', // Reusing type
      'Recruitment Request Approved',
      `Your recruitment request for "${request.role_title}" has been approved. You can now begin recruiting.`,
      request.id,
      'recruitment_request'
    );

    // Notify HR (users with onboarding_full permission)
    const hrUsers = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.onboarding_full = true AND u.employment_status = 'active'`
    );

    for (const hr of hrUsers.rows) {
      if (hr.id !== userId && hr.id !== request.requested_by) {
        await createNotification(
          hr.id,
          'leave_request_approved',
          'New Approved Recruitment',
          `A recruitment request for "${request.role_title}" has been approved and is ready for candidate sourcing.`,
          request.id,
          'recruitment_request'
        );
      }
    }

    res.json({
      message: 'Recruitment request approved',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Approve recruitment request error:', error);
    res.status(500).json({ error: 'Failed to approve recruitment request' });
  }
}

/**
 * Reject recruitment request
 */
async function rejectRequest(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Check the request exists and is pending
    const existing = await pool.query(
      'SELECT * FROM recruitment_requests WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Recruitment request not found' });
    }

    const request = existing.rows[0];

    if (request.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Request is not pending approval' });
    }

    // Check if user is the approver or admin
    if (role_name !== 'Admin' && request.approver_id !== userId) {
      return res.status(403).json({ error: 'You are not authorized to reject this request' });
    }

    const result = await pool.query(
      `UPDATE recruitment_requests SET
        status = 'rejected',
        rejection_reason = $1,
        approved_by = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [rejection_reason, userId, id]
    );

    // Notify the requester
    await createNotification(
      request.requested_by,
      'leave_request_rejected', // Reusing type
      'Recruitment Request Rejected',
      `Your recruitment request for "${request.role_title}" has been rejected. Reason: ${rejection_reason}`,
      request.id,
      'recruitment_request'
    );

    res.json({
      message: 'Recruitment request rejected',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Reject recruitment request error:', error);
    res.status(500).json({ error: 'Failed to reject recruitment request' });
  }
}

/**
 * Get requests awaiting user's approval
 */
async function getMyApprovals(req, res) {
  try {
    const { id: userId } = req.user;

    const result = await pool.query(
      `SELECT rr.*, u.full_name as requested_by_name
       FROM recruitment_requests rr
       JOIN users u ON rr.requested_by = u.id
       WHERE rr.approver_id = $1 AND rr.status = 'pending_approval'
       ORDER BY rr.submitted_at ASC`,
      [userId]
    );

    res.json({ pending_approvals: result.rows });
  } catch (error) {
    console.error('Get my approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
}

/**
 * Get approved requests (for candidate creation)
 */
async function getApprovedRequests(req, res) {
  try {
    const result = await pool.query(
      `SELECT rr.*, u.full_name as requested_by_name,
              (SELECT COUNT(*) FROM candidates c WHERE c.recruitment_request_id = rr.id) as candidates_count
       FROM recruitment_requests rr
       JOIN users u ON rr.requested_by = u.id
       WHERE rr.status = 'approved'
       ORDER BY rr.approved_at DESC`
    );

    res.json({ approved_requests: result.rows });
  } catch (error) {
    console.error('Get approved requests error:', error);
    res.status(500).json({ error: 'Failed to fetch approved requests' });
  }
}

/**
 * Mark request as filled (when candidate becomes active)
 */
async function markRequestFilled(requestId) {
  try {
    await pool.query(
      `UPDATE recruitment_requests SET
        status = 'filled',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );
  } catch (error) {
    console.error('Mark request filled error:', error);
  }
}

module.exports = {
  createRequest,
  getRequests,
  getRequest,
  updateRequest,
  submitRequest,
  approveRequest,
  rejectRequest,
  getMyApprovals,
  getApprovedRequests,
  markRequestFilled
};
