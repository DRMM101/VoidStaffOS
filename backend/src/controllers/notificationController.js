/**
 * VoidStaffOS - Notification Controller
 * Handles notification CRUD and automated system notifications.
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

/**
 * Create a notification record
 * @async
 * @param {number} userId - ID of user to receive notification
 * @param {string} type - Notification type enum value
 * @param {string} title - Short notification title
 * @param {string} message - Detailed notification message
 * @param {number} [relatedId] - ID of related entity (review, user, etc.)
 * @param {string} [relatedType] - Type of related entity ('review', 'leave_request', 'user')
 * @param {number} [tenantId] - Tenant ID (defaults to 1)
 * @returns {Object|null} Created notification or null on error
 */
const createNotification = async (userId, type, title, message, relatedId = null, relatedType = null, tenantId = 1) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, message, related_id, related_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, userId, type, title, message, relatedId, relatedType]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get user's notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only = false } = req.query;

    let query = `
      SELECT id, type, title, message, related_id, related_type, is_read, created_at, read_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params = [userId];

    if (unread_only === 'true') {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY is_read ASC, created_at DESC LIMIT $2 OFFSET $3`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get unread count
    const countResult = await pool.query(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(countResult.rows[0].unread_count),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get unread count only (for badge)
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    res.json({ unread_count: parseInt(result.rows[0].unread_count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId]
    );

    res.json({
      message: 'All notifications marked as read',
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// === Notification trigger functions ===
// All helper functions use default tenantId = 1 for system-generated notifications

// Notify employee when manager commits their weekly snapshot
const notifyManagerSnapshotCommitted = async (employeeId, managerId, reviewId, weekEnding, tenantId = 1) => {
  const managerResult = await pool.query(
    `SELECT full_name FROM users WHERE id = $1`,
    [managerId]
  );
  const managerName = managerResult.rows[0]?.full_name || 'Your manager';

  return createNotification(
    employeeId,
    'manager_snapshot_committed',
    'Manager Snapshot Submitted',
    `${managerName} has submitted their weekly snapshot for you (week ending ${weekEnding}).`,
    reviewId,
    'review',
    tenantId
  );
};

// Notify when KPIs are revealed (both committed)
const notifyKPIsRevealed = async (employeeId, managerId, reviewId, weekEnding, tenantId = 1) => {
  // Notify employee
  await createNotification(
    employeeId,
    'kpi_revealed',
    'Weekly KPIs Revealed',
    `Both you and your manager have submitted snapshots for week ending ${weekEnding}. KPIs are now visible.`,
    reviewId,
    'review',
    tenantId
  );

  // Notify manager
  const employeeResult = await pool.query(
    `SELECT full_name FROM users WHERE id = $1`,
    [employeeId]
  );
  const employeeName = employeeResult.rows[0]?.full_name || 'Your employee';

  return createNotification(
    managerId,
    'kpi_revealed',
    'Weekly KPIs Revealed',
    `Both you and ${employeeName} have submitted snapshots for week ending ${weekEnding}. KPIs are now visible.`,
    reviewId,
    'review',
    tenantId
  );
};

// Notify manager when employee submits leave request
const notifyLeaveRequestPending = async (managerId, employeeId, leaveRequestId, startDate, endDate, totalDays, tenantId = 1) => {
  const employeeResult = await pool.query(
    `SELECT full_name FROM users WHERE id = $1`,
    [employeeId]
  );
  const employeeName = employeeResult.rows[0]?.full_name || 'An employee';

  const dateRange = startDate === endDate
    ? startDate
    : `${startDate} to ${endDate}`;

  return createNotification(
    managerId,
    'leave_request_pending',
    'New Leave Request',
    `${employeeName} has requested ${totalDays} day(s) of leave (${dateRange}).`,
    leaveRequestId,
    'leave_request',
    tenantId
  );
};

// Notify employee when leave approved
const notifyLeaveRequestApproved = async (employeeId, leaveRequestId, startDate, endDate, tenantId = 1) => {
  const dateRange = startDate === endDate
    ? startDate
    : `${startDate} to ${endDate}`;

  return createNotification(
    employeeId,
    'leave_request_approved',
    'Leave Request Approved',
    `Your leave request for ${dateRange} has been approved.`,
    leaveRequestId,
    'leave_request',
    tenantId
  );
};

// Notify employee when leave rejected
const notifyLeaveRequestRejected = async (employeeId, leaveRequestId, startDate, endDate, reason = null, tenantId = 1) => {
  const dateRange = startDate === endDate
    ? startDate
    : `${startDate} to ${endDate}`;

  let message = `Your leave request for ${dateRange} has been rejected.`;
  if (reason) {
    message += ` Reason: ${reason}`;
  }

  return createNotification(
    employeeId,
    'leave_request_rejected',
    'Leave Request Rejected',
    message,
    leaveRequestId,
    'leave_request',
    tenantId
  );
};

// Notify when employee is transferred
const notifyEmployeeTransferred = async (employeeId, oldManagerId, newManagerId, employeeName, tenantId = 1) => {
  const notifications = [];

  // Notify old manager
  if (oldManagerId) {
    const newManagerResult = newManagerId ? await pool.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [newManagerId]
    ) : null;
    const newManagerName = newManagerResult?.rows[0]?.full_name || 'no manager';

    notifications.push(createNotification(
      oldManagerId,
      'employee_transferred',
      'Employee Transferred',
      `${employeeName} has been transferred to ${newManagerId ? newManagerName : 'no manager (orphaned)'}.`,
      employeeId,
      'user',
      tenantId
    ));
  }

  // Notify new manager
  if (newManagerId) {
    notifications.push(createNotification(
      newManagerId,
      'new_direct_report',
      'New Direct Report',
      `${employeeName} has been transferred to you.`,
      employeeId,
      'user',
      tenantId
    ));
  }

  // Notify employee
  if (newManagerId) {
    const newManagerResult = await pool.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [newManagerId]
    );
    const newManagerName = newManagerResult.rows[0]?.full_name || 'a new manager';

    notifications.push(createNotification(
      employeeId,
      'employee_transferred',
      'Manager Changed',
      `You have been transferred to ${newManagerName}.`,
      newManagerId,
      'user',
      tenantId
    ));
  } else {
    notifications.push(createNotification(
      employeeId,
      'employee_transferred',
      'Manager Removed',
      `You no longer have an assigned manager.`,
      null,
      'user',
      tenantId
    ));
  }

  return Promise.all(notifications);
};

// Notify manager when new direct report assigned/adopted
const notifyNewDirectReport = async (managerId, employeeId, employeeName, isAdoption = false, tenantId = 1) => {
  const action = isAdoption ? 'adopted' : 'assigned to';

  return createNotification(
    managerId,
    'new_direct_report',
    'New Direct Report',
    `${employeeName} has been ${action} you.`,
    employeeId,
    'user',
    tenantId
  );
};

// Notify about overdue snapshots (to be called by cron or on login)
const checkAndNotifyOverdueSnapshots = async (userId = null) => {
  try {
    // Get the previous Friday (week ending date)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysFromFriday = dayOfWeek === 0 ? 2 : dayOfWeek === 6 ? 1 : dayOfWeek + 2;
    const previousFriday = new Date(today);
    previousFriday.setDate(today.getDate() - daysFromFriday);
    const weekEnding = previousFriday.toISOString().split('T')[0];

    // Only check on Monday or later
    if (dayOfWeek !== 0 && dayOfWeek !== 1) {
      return [];
    }

    let userFilter = '';
    const params = [weekEnding];

    if (userId) {
      userFilter = 'AND (u.id = $2 OR u.manager_id = $2)';
      params.push(userId);
    }

    // Find employees missing self-reflection
    const missingReflections = await pool.query(
      `SELECT u.id, u.full_name, u.manager_id
       FROM users u
       WHERE u.employment_status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM reviews r
         WHERE r.employee_id = u.id
         AND r.review_date = $1
         AND r.is_self_assessment = true
         AND r.is_committed = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.user_id = u.id
         AND n.type = 'self_reflection_overdue'
         AND DATE(n.created_at) = CURRENT_DATE
       )
       ${userFilter}`,
      params
    );

    const notifications = [];

    const tenantId = 1; // Default tenant for system notifications

    for (const emp of missingReflections.rows) {
      // Notify employee about their overdue self-reflection
      notifications.push(createNotification(
        emp.id,
        'self_reflection_overdue',
        'Self-Reflection Overdue',
        `Your self-reflection for week ending ${weekEnding} is overdue. Please submit it as soon as possible.`,
        null,
        'review',
        tenantId
      ));

      // Notify manager about overdue team member
      if (emp.manager_id) {
        // Check if we already notified manager today
        const existingNotif = await pool.query(
          `SELECT 1 FROM notifications
           WHERE user_id = $1
           AND type = 'snapshot_overdue'
           AND related_id = $2
           AND DATE(created_at) = CURRENT_DATE`,
          [emp.manager_id, emp.id]
        );

        if (existingNotif.rows.length === 0) {
          notifications.push(createNotification(
            emp.manager_id,
            'snapshot_overdue',
            'Team Snapshot Overdue',
            `${emp.full_name}'s weekly snapshot for week ending ${weekEnding} is overdue.`,
            emp.id,
            'user',
            tenantId
          ));
        }
      }
    }

    return Promise.all(notifications.filter(n => n));
  } catch (error) {
    console.error('Error checking overdue snapshots:', error);
    return [];
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  // Trigger functions for use by other controllers
  createNotification,
  notifyManagerSnapshotCommitted,
  notifyKPIsRevealed,
  notifyLeaveRequestPending,
  notifyLeaveRequestApproved,
  notifyLeaveRequestRejected,
  notifyEmployeeTransferred,
  notifyNewDirectReport,
  checkAndNotifyOverdueSnapshots
};
