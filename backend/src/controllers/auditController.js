/**
 * VoidStaffOS - Audit Trail Controller
 * Provides API endpoints for viewing the comprehensive audit trail.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 25/01/2026
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

const auditTrail = require('../utils/auditTrail');

/**
 * Get audit trail entries with filtering
 * SECURITY: Only accessible by Admin role (system administrators)
 * The audit trail is read-only and tamper-proof
 *
 * Query parameters:
 * - resource_type: Filter by resource type (user, review, leave_request)
 * - resource_id: Filter by specific resource ID
 * - user_id: Filter by user who made the change
 * - action: Filter by action type (CREATE, UPDATE, DELETE)
 * - start_date: Filter entries from this date
 * - end_date: Filter entries until this date
 * - limit: Number of entries per page (default 50, max 200)
 * - offset: Pagination offset
 */
async function getAuditTrail(req, res) {
  try {
    const { role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // SECURITY: Only System Administrators can view audit trail
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrator role required.' });
    }

    const {
      resource_type,
      resource_id,
      user_id,
      action,
      start_date,
      end_date,
      limit = 50,
      offset = 0
    } = req.query;

    // Validate and sanitize limit
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 200);
    const safeOffset = Math.max(0, parseInt(offset) || 0);

    const filters = {
      resourceType: resource_type,
      resourceId: resource_id ? parseInt(resource_id) : undefined,
      userId: user_id ? parseInt(user_id) : undefined,
      action: action,
      startDate: start_date,
      endDate: end_date,
      limit: safeLimit,
      offset: safeOffset
    };

    const [entries, totalCount] = await Promise.all([
      auditTrail.getAuditTrail(tenantId, filters),
      auditTrail.getAuditTrailCount(tenantId, filters)
    ]);

    // Log that audit trail was accessed (meta-audit)
    await auditTrail.logViewSensitive(
      { tenantId, userId: req.user.id },
      req,
      'audit_trail',
      null,
      `Audit trail accessed (${entries.length} of ${totalCount} entries)`,
      ['audit_trail_entries'],
      { metadata: { filters, result_count: entries.length, total_count: totalCount } }
    );

    res.json({
      audit_trail: entries,
      pagination: {
        total: totalCount,
        limit: safeLimit,
        offset: safeOffset,
        has_more: safeOffset + entries.length < totalCount
      }
    });
  } catch (error) {
    console.error('Get audit trail error:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
}

/**
 * Get audit history for a specific resource
 * Shows all changes made to a particular record
 * SECURITY: Admin only access
 */
async function getResourceHistory(req, res) {
  try {
    const { role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const { resource_type, resource_id } = req.params;

    // SECURITY: Only System Administrators can view audit trail
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrator role required.' });
    }

    if (!resource_type || !resource_id) {
      return res.status(400).json({ error: 'resource_type and resource_id are required' });
    }

    const history = await auditTrail.getResourceHistory(
      tenantId,
      resource_type,
      parseInt(resource_id)
    );

    // Log that resource history was accessed (meta-audit)
    await auditTrail.logViewSensitive(
      { tenantId, userId: req.user.id },
      req,
      'audit_trail',
      null,
      `Resource history accessed: ${resource_type} #${resource_id}`,
      ['resource_history'],
      { metadata: { resource_type, resource_id: parseInt(resource_id), history_count: history.length } }
    );

    res.json({
      resource_type,
      resource_id: parseInt(resource_id),
      history
    });
  } catch (error) {
    console.error('Get resource history error:', error);
    res.status(500).json({ error: 'Failed to fetch resource history' });
  }
}

/**
 * Get recent activity by a specific user
 * Shows what changes a user has made
 * SECURITY: Admin only access
 */
async function getUserActivity(req, res) {
  try {
    const { role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const { user_id } = req.params;
    const targetUserId = parseInt(user_id);

    // SECURITY: Only System Administrators can view audit trail
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrator role required.' });
    }

    const activity = await auditTrail.getUserActivity(tenantId, targetUserId);

    // Log that user activity was accessed (meta-audit)
    await auditTrail.logViewSensitive(
      { tenantId, userId: req.user.id },
      req,
      'audit_trail',
      null,
      `User activity accessed: user #${targetUserId}`,
      ['user_activity'],
      { metadata: { target_user_id: targetUserId, activity_count: activity.length } }
    );

    res.json({
      user_id: targetUserId,
      activity
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
}

/**
 * Get audit trail statistics/summary
 * Returns counts by action type, resource type, and recent activity
 * SECURITY: Admin only access
 */
async function getAuditStats(req, res) {
  try {
    const { role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const pool = require('../config/database');

    // SECURITY: Only System Administrators can view audit trail
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrator role required.' });
    }

    // Get counts by action type
    const actionCountsResult = await pool.query(
      `SELECT action, COUNT(*) as count
       FROM audit_trail
       WHERE tenant_id = $1
       GROUP BY action
       ORDER BY count DESC`,
      [tenantId]
    );

    // Get counts by resource type
    const resourceCountsResult = await pool.query(
      `SELECT resource_type, COUNT(*) as count
       FROM audit_trail
       WHERE tenant_id = $1
       GROUP BY resource_type
       ORDER BY count DESC`,
      [tenantId]
    );

    // Get recent activity summary (last 24 hours)
    const recentActivityResult = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(DISTINCT user_id) as unique_users,
              COUNT(CASE WHEN action = 'CREATE' THEN 1 END) as creates,
              COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) as updates,
              COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deletes
       FROM audit_trail
       WHERE tenant_id = $1
       AND created_at >= NOW() - INTERVAL '24 hours'`,
      [tenantId]
    );

    // Get top users by activity (last 7 days)
    const topUsersResult = await pool.query(
      `SELECT at.user_id, at.user_email, COUNT(*) as action_count
       FROM audit_trail at
       WHERE at.tenant_id = $1
       AND at.created_at >= NOW() - INTERVAL '7 days'
       GROUP BY at.user_id, at.user_email
       ORDER BY action_count DESC
       LIMIT 10`,
      [tenantId]
    );

    res.json({
      stats: {
        by_action: actionCountsResult.rows,
        by_resource: resourceCountsResult.rows,
        last_24_hours: recentActivityResult.rows[0],
        top_users_7_days: topUsersResult.rows
      }
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
}

/**
 * Get available filter options for audit trail UI
 * Returns distinct values for action types and resource types
 * SECURITY: Admin only access
 */
async function getFilterOptions(req, res) {
  try {
    const { role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const pool = require('../config/database');

    // SECURITY: Only System Administrators can view audit trail
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrator role required.' });
    }

    // Get distinct actions
    const actionsResult = await pool.query(
      `SELECT DISTINCT action FROM audit_trail WHERE tenant_id = $1 ORDER BY action`,
      [tenantId]
    );

    // Get distinct resource types
    const resourceTypesResult = await pool.query(
      `SELECT DISTINCT resource_type FROM audit_trail WHERE tenant_id = $1 ORDER BY resource_type`,
      [tenantId]
    );

    // Get users who have activity
    const usersResult = await pool.query(
      `SELECT DISTINCT at.user_id, at.user_email, u.full_name
       FROM audit_trail at
       LEFT JOIN users u ON at.user_id = u.id
       WHERE at.tenant_id = $1
       ORDER BY u.full_name`,
      [tenantId]
    );

    res.json({
      actions: actionsResult.rows.map(r => r.action),
      resource_types: resourceTypesResult.rows.map(r => r.resource_type),
      users: usersResult.rows
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
}

module.exports = {
  getAuditTrail,
  getResourceHistory,
  getUserActivity,
  getAuditStats,
  getFilterOptions
};
