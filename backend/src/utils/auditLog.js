/**
 * HeadOfficeOS - Audit Logger
 * Comprehensive security audit trail.
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
 * Standardized audit action types
 */
const AuditActions = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',

  // Authorization
  ROLE_CHANGE: 'ROLE_CHANGE',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',

  // Data Access
  DATA_EXPORT: 'DATA_EXPORT',
  GDPR_DATA_REQUEST: 'GDPR_DATA_REQUEST',
  GDPR_DELETION_REQUEST: 'GDPR_DELETION_REQUEST',

  // HR Actions
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_TERMINATED: 'EMPLOYEE_TERMINATED',
  DISCIPLINARY_CREATED: 'DISCIPLINARY_CREATED',
  GRIEVANCE_SUBMITTED: 'GRIEVANCE_SUBMITTED',
  PIP_CREATED: 'PIP_CREATED',

  // Sensitive Operations
  SALARY_VIEWED: 'SALARY_VIEWED',
  SALARY_CHANGED: 'SALARY_CHANGED',
  DOCUMENT_ACCESSED: 'DOCUMENT_ACCESSED',

  // Records
  RECORD_CREATE: 'RECORD_CREATE',
  RECORD_UPDATE: 'RECORD_UPDATE',
  RECORD_DELETE: 'RECORD_DELETE',

  // Admin
  TENANT_SETTINGS_CHANGED: 'TENANT_SETTINGS_CHANGED',
  ADMIN_ACTION: 'ADMIN_ACTION'
};

/**
 * Audit logger utility
 */
const auditLog = {
  /**
   * Log an audit event
   * @param {number|null} tenantId - Tenant ID (null for system-wide events)
   * @param {number|null} userId - User ID (null for anonymous/system actions)
   * @param {string} action - Action type from AuditActions
   * @param {string|null} resourceType - Entity type affected
   * @param {number|null} resourceId - ID of affected entity
   * @param {Object} details - Additional context
   * @param {Object} req - Express request object for IP/user agent
   */
  async log(tenantId, userId, action, resourceType, resourceId, details, req) {
    try {
      await pool.query(
        `INSERT INTO audit_logs
         (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          action,
          resourceType,
          resourceId,
          JSON.stringify(details || {}),
          req?.ip || req?.connection?.remoteAddress || null,
          req?.headers?.['user-agent'] || null
        ]
      );
    } catch (error) {
      // Log to console but don't throw - audit failure shouldn't break the operation
      console.error('Audit log failed:', error);
    }
  },

  // =========================================
  // Convenience methods for common actions
  // =========================================

  /**
   * Log successful login
   */
  loginSuccess: (tenantId, userId, req) =>
    auditLog.log(tenantId, userId, AuditActions.LOGIN_SUCCESS, 'session', null, {}, req),

  /**
   * Log failed login attempt
   */
  loginFailure: (email, req) =>
    auditLog.log(null, null, AuditActions.LOGIN_FAILURE, 'auth', null, { email }, req),

  /**
   * Log logout
   */
  logout: (tenantId, userId, req) =>
    auditLog.log(tenantId, userId, AuditActions.LOGOUT, 'session', null, {}, req),

  /**
   * Log password change
   */
  passwordChange: (tenantId, userId, req) =>
    auditLog.log(tenantId, userId, AuditActions.PASSWORD_CHANGE, 'user', userId, {}, req),

  /**
   * Log role change
   */
  roleChange: (tenantId, userId, targetUserId, oldRoles, newRoles, req) =>
    auditLog.log(tenantId, userId, AuditActions.ROLE_CHANGE, 'user', targetUserId,
      { oldRoles, newRoles }, req),

  /**
   * Log data export
   */
  dataExport: (tenantId, userId, exportType, recordCount, req) =>
    auditLog.log(tenantId, userId, AuditActions.DATA_EXPORT, exportType, null,
      { recordCount }, req),

  /**
   * Log sensitive document access
   */
  sensitiveAccess: (tenantId, userId, resourceType, resourceId, req) =>
    auditLog.log(tenantId, userId, AuditActions.DOCUMENT_ACCESSED, resourceType, resourceId, {}, req),

  /**
   * Log employee creation
   */
  employeeCreated: (tenantId, userId, employeeId, req) =>
    auditLog.log(tenantId, userId, AuditActions.EMPLOYEE_CREATED, 'user', employeeId, {}, req),

  /**
   * Log employee update
   */
  employeeUpdated: (tenantId, userId, employeeId, changes, req) =>
    auditLog.log(tenantId, userId, AuditActions.EMPLOYEE_UPDATED, 'user', employeeId, { changes }, req),

  /**
   * Log employee termination
   */
  employeeTerminated: (tenantId, userId, employeeId, reason, req) =>
    auditLog.log(tenantId, userId, AuditActions.EMPLOYEE_TERMINATED, 'user', employeeId, { reason }, req),

  /**
   * Log salary viewed
   */
  salaryViewed: (tenantId, userId, employeeId, req) =>
    auditLog.log(tenantId, userId, AuditActions.SALARY_VIEWED, 'user', employeeId, {}, req),

  /**
   * Log salary changed
   */
  salaryChanged: (tenantId, userId, employeeId, oldSalary, newSalary, req) =>
    auditLog.log(tenantId, userId, AuditActions.SALARY_CHANGED, 'user', employeeId,
      { oldSalary: '[REDACTED]', newSalary: '[REDACTED]', changed: true }, req),

  /**
   * Log admin action
   */
  adminAction: (tenantId, userId, action, details, req) =>
    auditLog.log(tenantId, userId, AuditActions.ADMIN_ACTION, 'system', null,
      { action, ...details }, req),

  /**
   * Log GDPR data request
   */
  gdprDataRequest: (tenantId, userId, subjectUserId, req) =>
    auditLog.log(tenantId, userId, AuditActions.GDPR_DATA_REQUEST, 'user', subjectUserId, {}, req),

  /**
   * Log GDPR deletion request
   */
  gdprDeletionRequest: (tenantId, userId, subjectUserId, req) =>
    auditLog.log(tenantId, userId, AuditActions.GDPR_DELETION_REQUEST, 'user', subjectUserId, {}, req)
};

module.exports = { auditLog, AuditActions };
