/**
 * HeadOfficeOS - Comprehensive Audit Trail Utility
 * Tracks all system changes with WHO, WHAT, WHEN, WHERE, BEFORE, AFTER.
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

const pool = require('../config/database');
const crypto = require('crypto');

/**
 * Fields that should never be logged (contain sensitive data)
 */
const NEVER_LOG_FIELDS = [
  'password',
  'password_hash',
  'new_password',
  'old_password',
  'token',
  'secret',
  'api_key',
  'private_key'
];

/**
 * Fields that should be masked in logs (show that they changed but not values)
 */
const MASK_FIELDS = [
  'bank_account_number',
  'bank_sort_code',
  'national_insurance_number',
  'ni_number',
  'tax_code',
  'salary',
  'ssn',
  'social_security',
  'credit_card',
  'card_number',
  'cvv',
  'pin',
  'date_of_birth',
  'dob'
];

/**
 * Human-readable action descriptions
 */
const ACTION_DESCRIPTIONS = {
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
  VIEW_SENSITIVE: 'viewed sensitive data',
  BULK_UPDATE: 'bulk updated',
  BULK_DELETE: 'bulk deleted',
  RESTORE: 'restored',
  ARCHIVE: 'archived'
};

/**
 * Generate a unique request ID for correlating multiple audit entries
 */
const generateRequestId = () => {
  return crypto.randomUUID();
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
  if (!req) return null;
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         null;
};

/**
 * Get user agent from request
 */
const getUserAgent = (req) => {
  return req?.headers?.['user-agent'] || null;
};

/**
 * Get session ID from request
 */
const getSessionId = (req) => {
  return req?.sessionID || req?.session?.id || null;
};

/**
 * Check if a field should be completely excluded from logging
 */
const shouldExcludeField = (fieldName) => {
  const lowerField = fieldName.toLowerCase();
  return NEVER_LOG_FIELDS.some(f => lowerField.includes(f));
};

/**
 * Check if a field should be masked in logging
 */
const shouldMaskField = (fieldName) => {
  const lowerField = fieldName.toLowerCase();
  return MASK_FIELDS.some(f => lowerField.includes(f));
};

/**
 * Mask a sensitive value
 */
const maskValue = (value) => {
  if (value === null || value === undefined) return '[EMPTY]';
  if (typeof value === 'string') {
    if (value.length <= 4) return '****';
    return value.substring(0, 2) + '****' + value.substring(value.length - 2);
  }
  return '[MASKED]';
};

/**
 * Sanitize an object for logging (remove sensitive fields, mask others)
 */
const sanitizeForLogging = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (shouldExcludeField(key)) {
      continue; // Skip entirely
    }
    if (shouldMaskField(key)) {
      sanitized[key] = maskValue(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Calculate the diff between two objects
 * Returns {field: {old: x, new: y}} for changed fields only
 */
const calculateChanges = (oldObj, newObj) => {
  if (!oldObj && !newObj) return null;
  if (!oldObj) return null; // For creates, we don't show changes
  if (!newObj) return null; // For deletes, we don't show changes

  const changes = {};
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    // Skip fields that shouldn't be logged
    if (shouldExcludeField(key)) continue;

    const oldValue = oldObj[key];
    const newValue = newObj[key];

    // Check if values are different
    if (!deepEqual(oldValue, newValue)) {
      if (shouldMaskField(key)) {
        changes[key] = {
          old: maskValue(oldValue),
          new: maskValue(newValue)
        };
      } else {
        changes[key] = {
          old: oldValue,
          new: newValue
        };
      }
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
};

/**
 * Deep equality check for two values
 */
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
};

/**
 * Main audit trail module
 */
const auditTrail = {
  /**
   * Log a change to the audit trail
   *
   * @param {Object} tenantContext - {tenantId, userId, roles}
   * @param {Object} req - Express request object
   * @param {Object} options - Audit details
   * @param {string} options.action - CREATE, UPDATE, DELETE, VIEW_SENSITIVE
   * @param {string} options.resourceType - 'user', 'review', 'leave_request', etc.
   * @param {number} options.resourceId - ID of the affected record
   * @param {string} options.resourceName - Human readable name
   * @param {Object} options.previousValues - Record before change
   * @param {Object} options.newValues - Record after change
   * @param {string} options.reason - Optional reason for change
   * @param {Object} options.metadata - Additional context
   * @param {string} options.requestId - Optional request ID for correlation
   * @returns {Object} Created audit record
   */
  async logChange(tenantContext, req, {
    action,
    resourceType,
    resourceId,
    resourceName,
    previousValues = null,
    newValues = null,
    reason = null,
    metadata = null,
    requestId = null
  }) {
    try {
      // Get user info from session or request
      const userId = tenantContext?.userId || req?.session?.userId || req?.user?.id || null;
      const userEmail = req?.session?.email || req?.user?.email || null;
      const userRole = req?.session?.roles?.[0] || req?.user?.role_name || null;
      const tenantId = tenantContext?.tenantId || req?.session?.tenantId || null;

      // Calculate changes for updates
      const changes = (action === 'UPDATE' || action === 'BULK_UPDATE')
        ? calculateChanges(previousValues, newValues)
        : null;

      // Sanitize values for logging
      const sanitizedPrevious = previousValues ? sanitizeForLogging(previousValues) : null;
      const sanitizedNew = newValues ? sanitizeForLogging(newValues) : null;

      const query = `
        INSERT INTO audit_trail (
          tenant_id, user_id, user_email, user_role,
          action, resource_type, resource_id, resource_name,
          changes, previous_values, new_values,
          ip_address, user_agent, session_id, request_id,
          reason, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;

      const values = [
        tenantId,
        userId,
        userEmail,
        userRole,
        action,
        resourceType,
        resourceId,
        resourceName,
        changes ? JSON.stringify(changes) : null,
        sanitizedPrevious ? JSON.stringify(sanitizedPrevious) : null,
        sanitizedNew ? JSON.stringify(sanitizedNew) : null,
        getClientIp(req),
        getUserAgent(req),
        getSessionId(req),
        requestId || generateRequestId(),
        reason,
        metadata ? JSON.stringify(metadata) : null
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      // Log error but don't throw - audit failures shouldn't break the application
      console.error('Audit trail logging error:', error);
      return null;
    }
  },

  /**
   * Log a CREATE operation
   */
  async logCreate(tenantContext, req, resourceType, resourceId, resourceName, newValues, options = {}) {
    return this.logChange(tenantContext, req, {
      action: 'CREATE',
      resourceType,
      resourceId,
      resourceName,
      newValues,
      ...options
    });
  },

  /**
   * Log an UPDATE operation
   */
  async logUpdate(tenantContext, req, resourceType, resourceId, resourceName, previousValues, newValues, options = {}) {
    return this.logChange(tenantContext, req, {
      action: 'UPDATE',
      resourceType,
      resourceId,
      resourceName,
      previousValues,
      newValues,
      ...options
    });
  },

  /**
   * Log a DELETE operation
   */
  async logDelete(tenantContext, req, resourceType, resourceId, resourceName, deletedRecord, options = {}) {
    return this.logChange(tenantContext, req, {
      action: 'DELETE',
      resourceType,
      resourceId,
      resourceName,
      previousValues: deletedRecord,
      ...options
    });
  },

  /**
   * Log viewing of sensitive data
   */
  async logViewSensitive(tenantContext, req, resourceType, resourceId, resourceName, fields = [], options = {}) {
    return this.logChange(tenantContext, req, {
      action: 'VIEW_SENSITIVE',
      resourceType,
      resourceId,
      resourceName,
      metadata: { viewed_fields: fields, ...options.metadata },
      ...options
    });
  },

  /**
   * Log a bulk UPDATE operation
   */
  async logBulkUpdate(tenantContext, req, resourceType, affectedCount, criteria, options = {}) {
    return this.logChange(tenantContext, req, {
      action: 'BULK_UPDATE',
      resourceType,
      resourceId: null,
      resourceName: `${affectedCount} ${resourceType} records`,
      metadata: { affected_count: affectedCount, criteria, ...options.metadata },
      ...options
    });
  },

  /**
   * Log a bulk DELETE operation
   */
  async logBulkDelete(tenantContext, req, resourceType, affectedCount, criteria, options = {}) {
    return this.logChange(tenantContext, req, {
      action: 'BULK_DELETE',
      resourceType,
      resourceId: null,
      resourceName: `${affectedCount} ${resourceType} records`,
      metadata: { affected_count: affectedCount, criteria, ...options.metadata },
      ...options
    });
  },

  /**
   * Get audit trail entries with filtering
   */
  async getAuditTrail(tenantId, filters = {}) {
    const {
      resourceType,
      resourceId,
      userId,
      action,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = filters;

    let query = `
      SELECT
        at.*,
        u.full_name as user_full_name
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      WHERE at.tenant_id = $1
    `;
    const values = [tenantId];
    let paramCount = 1;

    if (resourceType) {
      paramCount++;
      query += ` AND at.resource_type = $${paramCount}`;
      values.push(resourceType);
    }

    if (resourceId) {
      paramCount++;
      query += ` AND at.resource_id = $${paramCount}`;
      values.push(resourceId);
    }

    if (userId) {
      paramCount++;
      query += ` AND at.user_id = $${paramCount}`;
      values.push(userId);
    }

    if (action) {
      paramCount++;
      query += ` AND at.action = $${paramCount}`;
      values.push(action);
    }

    if (startDate) {
      paramCount++;
      query += ` AND at.created_at >= $${paramCount}`;
      values.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND at.created_at <= $${paramCount}`;
      values.push(endDate);
    }

    query += ` ORDER BY at.created_at DESC`;

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    values.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    values.push(offset);

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Get audit trail count for pagination
   */
  async getAuditTrailCount(tenantId, filters = {}) {
    const {
      resourceType,
      resourceId,
      userId,
      action,
      startDate,
      endDate
    } = filters;

    let query = `SELECT COUNT(*) FROM audit_trail WHERE tenant_id = $1`;
    const values = [tenantId];
    let paramCount = 1;

    if (resourceType) {
      paramCount++;
      query += ` AND resource_type = $${paramCount}`;
      values.push(resourceType);
    }

    if (resourceId) {
      paramCount++;
      query += ` AND resource_id = $${paramCount}`;
      values.push(resourceId);
    }

    if (userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      values.push(userId);
    }

    if (action) {
      paramCount++;
      query += ` AND action = $${paramCount}`;
      values.push(action);
    }

    if (startDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      values.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      values.push(endDate);
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Get audit history for a specific resource
   */
  async getResourceHistory(tenantId, resourceType, resourceId, limit = 50) {
    const query = `
      SELECT
        at.*,
        u.full_name as user_full_name
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      WHERE at.tenant_id = $1
        AND at.resource_type = $2
        AND at.resource_id = $3
      ORDER BY at.created_at DESC
      LIMIT $4
    `;

    const result = await pool.query(query, [tenantId, resourceType, resourceId, limit]);
    return result.rows;
  },

  /**
   * Get recent activity by a user
   */
  async getUserActivity(tenantId, userId, limit = 50) {
    const query = `
      SELECT * FROM audit_trail
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    const result = await pool.query(query, [tenantId, userId, limit]);
    return result.rows;
  },

  // Export utilities for testing
  calculateChanges,
  sanitizeForLogging,
  shouldMaskField,
  shouldExcludeField,
  generateRequestId
};

module.exports = auditTrail;
