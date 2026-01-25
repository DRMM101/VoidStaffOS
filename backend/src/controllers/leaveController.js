/**
 * VoidStaffOS - Leave Controller
 * Handles leave requests, approvals, and balance tracking.
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
const {
  notifyLeaveRequestPending,
  notifyLeaveRequestApproved,
  notifyLeaveRequestRejected
} = require('./notificationController');
const auditTrail = require('../utils/auditTrail');

/**
 * Calculate working days between two dates (excluding weekends)
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Number of working days (excludes Saturdays and Sundays)
 * @example
 * calculateWorkingDays('2024-01-15', '2024-01-19') // 5 (Mon-Fri)
 * calculateWorkingDays('2024-01-15', '2024-01-21') // 5 (Mon-Fri, excludes Sat-Sun)
 */
function calculateWorkingDays(startDate, endDate) {
  let workingDays = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
}

/**
 * Calculate required notice days based on company policy
 *
 * Policy:
 * - 1-4 days leave: notice = days × 2
 * - 5+ days leave: notice = 30 days (1 month)
 *
 * @param {number} totalDays - Total leave days requested
 * @returns {number} Required notice days
 * @example
 * calculateRequiredNotice(2)  // 4 days notice
 * calculateRequiredNotice(5)  // 30 days notice
 * calculateRequiredNotice(10) // 30 days notice
 */
function calculateRequiredNotice(totalDays) {
  if (totalDays >= 5) {
    return 30;
  }
  return Math.ceil(totalDays) * 2;
}

/**
 * Calculate actual notice days between request and leave start
 * @param {string|Date} requestDate - When request was submitted
 * @param {string|Date} leaveStartDate - First day of leave
 * @returns {number} Days between request and leave start
 */
function calculateNoticeDays(requestDate, leaveStartDate) {
  const request = new Date(requestDate);
  const start = new Date(leaveStartDate);
  const diffTime = start - request;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Create a new leave request
 *
 * Validates:
 * - Dates are valid and not in past
 * - Employee has sufficient leave balance
 * - No overlapping requests exist
 * - Half day requests have same start/end date
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.body - Request body
 * @param {string} req.body.leave_start_date - First day of leave (YYYY-MM-DD)
 * @param {string} req.body.leave_end_date - Last day of leave (YYYY-MM-DD)
 * @param {string} [req.body.leave_type='full_day'] - full_day|half_day_am|half_day_pm
 * @param {string} [req.body.notes] - Employee notes
 * @param {Object} res - Express response
 * @returns {Object} Created leave request with notice warning if applicable
 * @authorization Any authenticated user
 */
async function createLeaveRequest(req, res) {
  try {
    const { id: userId } = req.user;
    const { leave_start_date, leave_end_date, leave_type, notes } = req.body;

    if (!leave_start_date || !leave_end_date) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    // Validate dates
    const startDate = new Date(leave_start_date);
    const endDate = new Date(leave_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return res.status(400).json({ error: 'Leave start date cannot be in the past' });
    }

    if (endDate < startDate) {
      return res.status(400).json({ error: 'End date must be on or after start date' });
    }

    // Get employee's manager
    const userResult = await pool.query(
      'SELECT manager_id, annual_leave_entitlement FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const managerId = userResult.rows[0].manager_id;
    const entitlement = parseFloat(userResult.rows[0].annual_leave_entitlement);

    // Calculate total days
    let totalDays;
    const workingDays = calculateWorkingDays(leave_start_date, leave_end_date);

    if (leave_type === 'half_day_am' || leave_type === 'half_day_pm') {
      totalDays = 0.5;
      if (leave_start_date !== leave_end_date) {
        return res.status(400).json({ error: 'Half day requests must have same start and end date' });
      }
    } else {
      totalDays = workingDays;
    }

    if (totalDays === 0) {
      return res.status(400).json({ error: 'No working days in the selected range' });
    }

    // Calculate notice
    const requestDate = new Date().toISOString().split('T')[0];
    const noticeDays = calculateNoticeDays(requestDate, leave_start_date);
    const requiredNoticeDays = calculateRequiredNotice(totalDays);
    const meetsNoticeRequirement = noticeDays >= requiredNoticeDays;

    // Check if employee has enough remaining leave
    const usedLeaveResult = await pool.query(
      `SELECT COALESCE(SUM(total_days), 0) as used_days
       FROM leave_requests
       WHERE employee_id = $1
       AND status = 'approved'
       AND EXTRACT(YEAR FROM leave_start_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [userId]
    );
    const usedDays = parseFloat(usedLeaveResult.rows[0].used_days);
    const remainingDays = entitlement - usedDays;

    if (totalDays > remainingDays) {
      return res.status(400).json({
        error: `Insufficient leave balance. You have ${remainingDays} days remaining but requested ${totalDays} days.`
      });
    }

    // Check for overlapping approved leave requests
    const overlapResult = await pool.query(
      `SELECT id FROM leave_requests
       WHERE employee_id = $1
       AND status IN ('pending', 'approved')
       AND leave_start_date <= $3
       AND leave_end_date >= $2`,
      [userId, leave_start_date, leave_end_date]
    );

    if (overlapResult.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a leave request overlapping with these dates' });
    }

    // Create the request
    const leaveTypeValue = leave_type || 'full_day';
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO leave_requests (
        tenant_id, employee_id, manager_id, request_date, leave_start_date, leave_end_date,
        leave_type, total_days, notice_days, required_notice_days, meets_notice_requirement, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::leave_type_enum, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId, userId, managerId, requestDate, leave_start_date, leave_end_date,
        leaveTypeValue, totalDays, noticeDays, requiredNoticeDays,
        meetsNoticeRequirement, notes || null
      ]
    );

    const leaveRequest = result.rows[0];

    // Audit trail: log leave request creation
    await auditTrail.logCreate(
      { tenantId: req.session?.tenantId, userId },
      req,
      'leave_request',
      leaveRequest.id,
      `Leave request ${leave_start_date} to ${leave_end_date}`,
      { leave_start_date, leave_end_date, leave_type: leave_type || 'full_day', total_days: totalDays, status: 'pending' }
    );

    // Notify manager of pending leave request
    if (managerId) {
      await notifyLeaveRequestPending(
        managerId,
        userId,
        leaveRequest.id,
        leave_start_date,
        leave_end_date,
        totalDays
      );
    }

    res.status(201).json({
      message: 'Leave request submitted successfully',
      leave_request: leaveRequest,
      notice_warning: !meetsNoticeRequirement
        ? `Notice period is ${noticeDays} days, but policy requires ${requiredNoticeDays} days for ${totalDays} days of leave`
        : null
    });
  } catch (error) {
    console.error('=== CREATE LEAVE REQUEST ERROR ===');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
}

// Get current user's leave requests
async function getMyLeaveRequests(req, res) {
  try {
    const { id: userId } = req.user;

    const result = await pool.query(
      `SELECT lr.*,
              m.full_name as manager_name,
              a.full_name as approved_by_name
       FROM leave_requests lr
       LEFT JOIN users m ON lr.manager_id = m.id
       LEFT JOIN users a ON lr.approved_by = a.id
       WHERE lr.employee_id = $1
       ORDER BY lr.created_at DESC`,
      [userId]
    );

    // Get leave balance
    const balanceResult = await pool.query(
      `SELECT
        u.annual_leave_entitlement,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' AND EXTRACT(YEAR FROM lr.leave_start_date) = EXTRACT(YEAR FROM CURRENT_DATE) THEN lr.total_days ELSE 0 END), 0) as used_days,
        COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN lr.total_days ELSE 0 END), 0) as pending_days
       FROM users u
       LEFT JOIN leave_requests lr ON lr.employee_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, u.annual_leave_entitlement`,
      [userId]
    );

    const balance = balanceResult.rows[0] || { annual_leave_entitlement: 28, used_days: 0, pending_days: 0 };
    const remainingDays = parseFloat(balance.annual_leave_entitlement) - parseFloat(balance.used_days);

    res.json({
      leave_requests: result.rows,
      balance: {
        entitlement: parseFloat(balance.annual_leave_entitlement),
        used: parseFloat(balance.used_days),
        pending: parseFloat(balance.pending_days),
        remaining: remainingDays
      }
    });
  } catch (error) {
    console.error('Get my leave requests error:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

// Get pending leave requests for manager's team
async function getPendingLeaveRequests(req, res) {
  try {
    const { role_name, id: userId } = req.user;

    if (role_name !== 'Admin' && role_name !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    let query;
    let params = [];

    if (role_name === 'Admin') {
      query = `
        SELECT lr.*,
               e.full_name as employee_name,
               e.employee_number,
               m.full_name as manager_name
        FROM leave_requests lr
        JOIN users e ON lr.employee_id = e.id
        LEFT JOIN users m ON lr.manager_id = m.id
        WHERE lr.status = 'pending'
        ORDER BY lr.created_at ASC
      `;
    } else {
      query = `
        SELECT lr.*,
               e.full_name as employee_name,
               e.employee_number,
               m.full_name as manager_name
        FROM leave_requests lr
        JOIN users e ON lr.employee_id = e.id
        LEFT JOIN users m ON lr.manager_id = m.id
        WHERE lr.manager_id = $1 AND lr.status = 'pending'
        ORDER BY lr.created_at ASC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    res.json({ pending_requests: result.rows });
  } catch (error) {
    console.error('Get pending leave requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending leave requests' });
  }
}

// Get all leave requests for manager's team (all statuses)
async function getTeamLeaveRequests(req, res) {
  try {
    const { role_name, id: userId } = req.user;

    if (role_name !== 'Admin' && role_name !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    let query;
    let params = [];

    if (role_name === 'Admin') {
      query = `
        SELECT lr.*,
               e.full_name as employee_name,
               e.employee_number,
               m.full_name as manager_name,
               a.full_name as approved_by_name
        FROM leave_requests lr
        JOIN users e ON lr.employee_id = e.id
        LEFT JOIN users m ON lr.manager_id = m.id
        LEFT JOIN users a ON lr.approved_by = a.id
        ORDER BY lr.created_at DESC
        LIMIT 100
      `;
    } else {
      query = `
        SELECT lr.*,
               e.full_name as employee_name,
               e.employee_number,
               m.full_name as manager_name,
               a.full_name as approved_by_name
        FROM leave_requests lr
        JOIN users e ON lr.employee_id = e.id
        LEFT JOIN users m ON lr.manager_id = m.id
        LEFT JOIN users a ON lr.approved_by = a.id
        WHERE lr.manager_id = $1
        ORDER BY lr.created_at DESC
        LIMIT 100
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    res.json({ leave_requests: result.rows });
  } catch (error) {
    console.error('Get team leave requests error:', error);
    res.status(500).json({ error: 'Failed to fetch team leave requests' });
  }
}

// Approve a leave request
async function approveLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;

    // Get the leave request
    const requestResult = await pool.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leaveRequest = requestResult.rows[0];

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This leave request has already been processed' });
    }

    // Check permissions
    if (role_name !== 'Admin' && leaveRequest.manager_id !== userId) {
      return res.status(403).json({ error: 'You can only approve leave requests for your team' });
    }

    // Approve the request
    const result = await pool.query(
      `UPDATE leave_requests
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    // If leave is more than 2 consecutive working days, mark any reviews for that period as skip_week
    if (leaveRequest.total_days > 2) {
      await markReviewsAsSkipped(leaveRequest.employee_id, leaveRequest.leave_start_date, leaveRequest.leave_end_date);
    }

    // Audit trail: log leave request approval
    await auditTrail.logUpdate(
      { tenantId: req.session?.tenantId, userId },
      req,
      'leave_request',
      parseInt(id),
      `Leave request ${leaveRequest.leave_start_date} to ${leaveRequest.leave_end_date}`,
      { status: 'pending' },
      { status: 'approved', approved_by: userId },
      { reason: 'Leave request approved' }
    );

    // Notify employee of approval
    await notifyLeaveRequestApproved(
      leaveRequest.employee_id,
      leaveRequest.id,
      leaveRequest.leave_start_date,
      leaveRequest.leave_end_date
    );

    res.json({ message: 'Leave request approved', leave_request: result.rows[0] });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
}

// Reject a leave request
async function rejectLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const { role_name, id: userId } = req.user;

    // Get the leave request
    const requestResult = await pool.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leaveRequest = requestResult.rows[0];

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This leave request has already been processed' });
    }

    // Check permissions
    if (role_name !== 'Admin' && leaveRequest.manager_id !== userId) {
      return res.status(403).json({ error: 'You can only reject leave requests for your team' });
    }

    // Reject the request
    const result = await pool.query(
      `UPDATE leave_requests
       SET status = 'rejected', rejection_reason = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [rejection_reason || null, userId, id]
    );

    // Audit trail: log leave request rejection
    await auditTrail.logUpdate(
      { tenantId: req.session?.tenantId, userId },
      req,
      'leave_request',
      parseInt(id),
      `Leave request ${leaveRequest.leave_start_date} to ${leaveRequest.leave_end_date}`,
      { status: 'pending' },
      { status: 'rejected', rejection_reason },
      { reason: 'Leave request rejected' }
    );

    // Notify employee of rejection
    await notifyLeaveRequestRejected(
      leaveRequest.employee_id,
      leaveRequest.id,
      leaveRequest.leave_start_date,
      leaveRequest.leave_end_date,
      rejection_reason
    );

    res.json({ message: 'Leave request rejected', leave_request: result.rows[0] });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({ error: 'Failed to reject leave request' });
  }
}

// Cancel a leave request (employee can cancel their own pending requests)
async function cancelLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;

    // Get the leave request
    const requestResult = await pool.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leaveRequest = requestResult.rows[0];

    // Only the employee can cancel their own request, and only if pending
    if (leaveRequest.employee_id !== userId) {
      return res.status(403).json({ error: 'You can only cancel your own leave requests' });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }

    // Cancel the request
    const result = await pool.query(
      `UPDATE leave_requests
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Audit trail: log leave request cancellation
    await auditTrail.logUpdate(
      { tenantId: req.session?.tenantId, userId },
      req,
      'leave_request',
      parseInt(id),
      `Leave request ${leaveRequest.leave_start_date} to ${leaveRequest.leave_end_date}`,
      { status: 'pending' },
      { status: 'cancelled' },
      { reason: 'Leave request cancelled by employee' }
    );

    res.json({ message: 'Leave request cancelled', leave_request: result.rows[0] });
  } catch (error) {
    console.error('Cancel leave request error:', error);
    res.status(500).json({ error: 'Failed to cancel leave request' });
  }
}

// Helper function to mark reviews as skipped for employees on leave
async function markReviewsAsSkipped(employeeId, startDate, endDate) {
  try {
    // Find any reviews that fall within the leave period
    await pool.query(
      `UPDATE reviews
       SET skip_week = true, skip_reason = 'Employee on approved leave (>2 days)'
       WHERE employee_id = $1
       AND review_date >= $2
       AND review_date <= $3`,
      [employeeId, startDate, endDate]
    );
  } catch (error) {
    console.error('Error marking reviews as skipped:', error);
  }
}

// Get employee's leave balance
async function getLeaveBalance(req, res) {
  try {
    const { id } = req.params || { id: req.user.id };
    const { role_name, id: userId } = req.user;

    // Check permissions - user can see their own, manager can see team's
    const targetId = id || userId;

    if (parseInt(targetId) !== userId && role_name !== 'Admin') {
      const teamCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [targetId, userId]
      );
      if (teamCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You can only view leave balance for your team' });
      }
    }

    const result = await pool.query(
      `SELECT
        u.id,
        u.full_name,
        u.annual_leave_entitlement,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' AND EXTRACT(YEAR FROM lr.leave_start_date) = EXTRACT(YEAR FROM CURRENT_DATE) THEN lr.total_days ELSE 0 END), 0) as used_days,
        COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN lr.total_days ELSE 0 END), 0) as pending_days
       FROM users u
       LEFT JOIN leave_requests lr ON lr.employee_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, u.full_name, u.annual_leave_entitlement`,
      [targetId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const balance = result.rows[0];
    const entitlement = parseFloat(balance.annual_leave_entitlement);
    const used = parseFloat(balance.used_days);
    const pending = parseFloat(balance.pending_days);

    res.json({
      balance: {
        employee_id: balance.id,
        employee_name: balance.full_name,
        entitlement,
        used,
        pending,
        remaining: entitlement - used,
        available: entitlement - used - pending
      }
    });
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  }
}

// Get pending leave count for dashboard badge
async function getPendingLeaveCount(req, res) {
  try {
    const { role_name, id: userId } = req.user;

    if (role_name !== 'Admin' && role_name !== 'Manager') {
      return res.json({ pending_count: 0 });
    }

    let query;
    let params = [];

    if (role_name === 'Admin') {
      query = `SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'`;
    } else {
      query = `SELECT COUNT(*) as count FROM leave_requests WHERE manager_id = $1 AND status = 'pending'`;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json({ pending_count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get pending leave count error:', error);
    res.status(500).json({ error: 'Failed to fetch pending count' });
  }
}

module.exports = {
  createLeaveRequest,
  getMyLeaveRequests,
  getPendingLeaveRequests,
  getTeamLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveBalance,
  getPendingLeaveCount
};
