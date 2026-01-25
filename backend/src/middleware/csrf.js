/**
 * VoidStaffOS - CSRF Protection Middleware
 * Prevents cross-site request forgery attacks.
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

const crypto = require('crypto');

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'staffos_csrf';

/**
 * CSRF protection middleware
 *
 * - Generates CSRF token for authenticated sessions
 * - Sets token as readable cookie for frontend
 * - Validates token on state-changing requests (POST, PUT, PATCH, DELETE)
 * - Skips validation for safe methods (GET, HEAD, OPTIONS)
 */
const csrfProtection = (req, res, next) => {
  // Generate CSRF token if session exists but no token
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Set CSRF token cookie (readable by frontend JS)
  if (req.session?.csrfToken) {
    res.cookie(CSRF_COOKIE, req.session.csrfToken, {
      httpOnly: false, // Frontend needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
  }

  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for auth endpoints (login, register, logout)
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Skip if no session (public endpoints)
  if (!req.session?.userId) {
    return next();
  }

  // Validate CSRF token
  const clientToken = req.headers[CSRF_HEADER];
  if (!clientToken || clientToken !== req.session.csrfToken) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  next();
};

/**
 * Generate a new CSRF token
 * @returns {string} Random token
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware to explicitly refresh CSRF token
 * Useful after sensitive operations
 */
const refreshCsrfToken = (req, res, next) => {
  if (req.session) {
    req.session.csrfToken = generateToken();
    res.cookie(CSRF_COOKIE, req.session.csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
  }
  next();
};

module.exports = {
  csrfProtection,
  refreshCsrfToken,
  CSRF_HEADER,
  CSRF_COOKIE
};
