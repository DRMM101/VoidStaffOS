/**
 * VoidStaffOS - Input Validation Middleware
 * Provides validation and sanitization functions for user input.
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

/**
 * Sanitize string input - trim whitespace, remove dangerous characters
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one letter
 * - At least one number
 *
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, message: string }
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true, message: null };
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid date format
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate integer ID
 * @param {any} id - Value to validate as positive integer
 * @returns {boolean} True if valid positive integer
 */
function isValidId(id) {
  const num = parseInt(id, 10);
  return !isNaN(num) && num > 0 && String(num) === String(id);
}

/**
 * Validate rating value (1-10 scale)
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid rating
 */
function isValidRating(value) {
  if (value === null || value === undefined || value === '') return true; // Optional
  const num = parseFloat(value);
  return !isNaN(num) && num >= 1 && num <= 10;
}

/**
 * Validate tier value (1-5 or null for admin)
 * @param {any} tier - Tier value to validate
 * @returns {boolean} True if valid tier
 */
function isValidTier(tier) {
  if (tier === null || tier === undefined || tier === '') return true;
  const num = parseInt(tier, 10);
  return !isNaN(num) && num >= 1 && num <= 5;
}

/**
 * Middleware: Validate login request
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  req.body.email = sanitizeString(email).toLowerCase();

  if (!isValidEmail(req.body.email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  next();
}

/**
 * Middleware: Validate user creation/update
 */
function validateUser(req, res, next) {
  const { email, password, full_name, role_id, tier } = req.body;
  const isCreate = req.method === 'POST';

  // Sanitize strings
  if (email) req.body.email = sanitizeString(email).toLowerCase();
  if (full_name) req.body.full_name = sanitizeString(full_name);

  // Required fields for creation
  if (isCreate) {
    if (!email || !password || !full_name || !role_id) {
      return res.status(400).json({ error: 'Missing required fields: email, password, full_name, role_id' });
    }

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }
  }

  // Validate email format
  if (email && !isValidEmail(req.body.email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate tier
  if (tier !== undefined && !isValidTier(tier)) {
    return res.status(400).json({ error: 'Invalid tier value (must be 1-5 or empty)' });
  }

  // Validate role_id
  if (role_id && !isValidId(role_id)) {
    return res.status(400).json({ error: 'Invalid role_id' });
  }

  next();
}

/**
 * Middleware: Validate leave request
 */
function validateLeaveRequest(req, res, next) {
  const { leave_start_date, leave_end_date, leave_type } = req.body;

  if (!leave_start_date || !leave_end_date) {
    return res.status(400).json({ error: 'Start and end dates are required' });
  }

  if (!isValidDate(leave_start_date) || !isValidDate(leave_end_date)) {
    return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' });
  }

  if (leave_type && !['full_day', 'half_day_am', 'half_day_pm'].includes(leave_type)) {
    return res.status(400).json({ error: 'Invalid leave type' });
  }

  next();
}

/**
 * Middleware: Validate review data
 */
function validateReview(req, res, next) {
  const { employee_id, tasks_completed, work_volume, problem_solving, communication, leadership } = req.body;

  if (!employee_id || !isValidId(employee_id)) {
    return res.status(400).json({ error: 'Valid employee_id is required' });
  }

  // Validate ratings
  const ratings = { tasks_completed, work_volume, problem_solving, communication, leadership };
  for (const [field, value] of Object.entries(ratings)) {
    if (value !== undefined && value !== null && value !== '' && !isValidRating(value)) {
      return res.status(400).json({ error: `Invalid ${field} (must be 1-10)` });
    }
  }

  next();
}

/**
 * Middleware: Validate ID parameter
 */
function validateIdParam(req, res, next) {
  const { id, employeeId } = req.params;
  const idToValidate = id || employeeId;

  if (idToValidate && !isValidId(idToValidate)) {
    return res.status(400).json({ error: 'Invalid ID parameter' });
  }

  next();
}

module.exports = {
  sanitizeString,
  isValidEmail,
  validatePassword,
  isValidDate,
  isValidId,
  isValidRating,
  isValidTier,
  validateLogin,
  validateUser,
  validateLeaveRequest,
  validateReview,
  validateIdParam
};
