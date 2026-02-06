// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Compensation Audit Middleware
 * Wraps compensation routes to log every access and change
 * to the compensation_audit_log table (append-only).
 *
 * Salary-related field values are REDACTED in old_value/new_value
 * to protect sensitive compensation data in the audit trail.
 */

const db = require('../config/database');

// Fields that contain sensitive salary data — values are redacted in audit log
const SENSITIVE_FIELDS = new Set([
  'base_salary', 'min_salary', 'mid_salary', 'max_salary',
  'current_salary', 'proposed_salary', 'approved_salary',
  'value', 'employer_contribution', 'employee_contribution',
  'budget_total', 'budget_remaining',
  'calculation_value', 'amount', 'calculated_amount', 'base_amount'
]);

/**
 * Redact sensitive field values for audit logging.
 * Returns 'REDACTED' for salary fields, original value otherwise.
 */
function redactValue(fieldName, value) {
  if (value === null || value === undefined) return null;
  if (SENSITIVE_FIELDS.has(fieldName)) return 'REDACTED';
  return String(value);
}

/**
 * Get the client IP address from the request.
 * Handles proxied requests via X-Forwarded-For header.
 */
function getClientIP(req) {
  // X-Forwarded-For can contain multiple IPs; take the first (client)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    return first || null;
  }
  return req.ip || req.connection?.remoteAddress || null;
}

/**
 * Log a single audit entry to compensation_audit_log.
 * This is append-only — no updates or deletes on this table.
 *
 * @param {object} params
 * @param {string} params.tenantId    - Tenant UUID
 * @param {string} params.employeeId  - Employee whose data was accessed (nullable)
 * @param {string} params.accessedBy  - User who performed the action
 * @param {string} params.action      - 'view' | 'create' | 'update' | 'export' | 'download'
 * @param {string} params.tableName   - Database table affected
 * @param {string} params.recordId    - UUID of the affected record (nullable)
 * @param {string} params.fieldChanged - Name of the field that changed (nullable)
 * @param {string} params.oldValue    - Previous value (redacted for salary fields)
 * @param {string} params.newValue    - New value (redacted for salary fields)
 * @param {string} params.ipAddress   - Client IP address
 */
async function logCompensationAudit({
  tenantId,
  employeeId = null,
  accessedBy,
  action,
  tableName,
  recordId = null,
  fieldChanged = null,
  oldValue = null,
  newValue = null,
  ipAddress = null
}) {
  try {
    // Redact sensitive field values before storing
    const safeOldValue = fieldChanged ? redactValue(fieldChanged, oldValue) : oldValue;
    const safeNewValue = fieldChanged ? redactValue(fieldChanged, newValue) : newValue;

    await db.query(
      `INSERT INTO compensation_audit_log
        (tenant_id, employee_id, accessed_by, action, table_name, record_id,
         field_changed, old_value, new_value, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tenantId,
        employeeId,
        accessedBy,
        action,
        tableName,
        recordId,
        fieldChanged,
        safeOldValue,
        safeNewValue,
        ipAddress
      ]
    );
  } catch (err) {
    // Audit failures must not break the request — log and continue
    console.error('Compensation audit log error:', err.message);
  }
}

/**
 * Middleware factory: wraps a route handler to automatically log audit entries.
 * Use this on routes where you want automatic audit logging.
 *
 * @param {string} action    - Audit action ('view', 'create', 'update', 'export', 'download')
 * @param {string} tableName - Table being accessed
 * @param {Function} [getEmployeeId] - Optional function(req, res) to extract employee ID
 */
function auditMiddleware(action, tableName, getEmployeeId = null) {
  return async (req, res, next) => {
    // Attach audit helper to request for use in route handlers
    req.auditLog = async (overrides = {}) => {
      const tenantId = req.session?.tenantId || 1;
      const accessedBy = req.user?.id;
      const ipAddress = getClientIP(req);
      const employeeId = getEmployeeId ? getEmployeeId(req, res) : null;

      await logCompensationAudit({
        tenantId,
        employeeId: overrides.employeeId || employeeId,
        accessedBy,
        action: overrides.action || action,
        tableName: overrides.tableName || tableName,
        recordId: overrides.recordId || null,
        fieldChanged: overrides.fieldChanged || null,
        oldValue: overrides.oldValue || null,
        newValue: overrides.newValue || null,
        ipAddress
      });
    };

    next();
  };
}

/**
 * Log multiple field changes for a single record update.
 * Compares old and new objects, logging each changed field individually.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.employeeId
 * @param {string} params.accessedBy
 * @param {string} params.tableName
 * @param {string} params.recordId
 * @param {object} params.oldData   - Previous record state
 * @param {object} params.newData   - Updated record state
 * @param {string} params.ipAddress
 */
async function logFieldChanges({
  tenantId,
  employeeId,
  accessedBy,
  tableName,
  recordId,
  oldData,
  newData,
  ipAddress
}) {
  // Compare each field in newData against oldData
  const fieldsToCheck = Object.keys(newData);

  for (const field of fieldsToCheck) {
    const oldVal = oldData[field];
    const newVal = newData[field];

    // Only log if the value actually changed
    if (String(oldVal) !== String(newVal)) {
      await logCompensationAudit({
        tenantId,
        employeeId,
        accessedBy,
        action: 'update',
        tableName,
        recordId,
        fieldChanged: field,
        oldValue: oldVal,
        newValue: newVal,
        ipAddress
      });
    }
  }
}

module.exports = {
  logCompensationAudit,
  auditMiddleware,
  logFieldChanges,
  getClientIP,
  redactValue
};
