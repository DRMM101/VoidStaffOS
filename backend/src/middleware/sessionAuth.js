/**
 * VoidStaffOS - Session Authentication Middleware
 * Secure cookie-based sessions (no localStorage tokens).
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

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('../config/database');

/**
 * Session configuration
 * Uses PostgreSQL for session storage
 */
const sessionConfig = {
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  name: 'staffos_sid',
  secret: process.env.SESSION_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // 'lax' allows cross-origin in dev; use 'strict' in production with same domain
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    path: '/'
  },
  rolling: true // Reset expiry on activity
};

/**
 * Session middleware instance
 */
const sessionMiddleware = session(sessionConfig);

/**
 * Authentication check middleware
 * Returns 401 if no valid session exists
 */
const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Derive tenant context from session
 * Makes tenantContext available on req object
 */
const deriveTenantContext = (req, res, next) => {
  if (req.session?.userId) {
    req.tenantContext = {
      tenantId: req.session.tenantId,
      userId: req.session.userId,
      roles: req.session.roles || [],
      permissions: req.session.permissions || []
    };
  }
  next();
};

/**
 * Role-based authorization middleware factory
 * @param {...string} allowedRoles - Roles that are allowed access
 * @returns {Function} Express middleware
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = req.session.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware factory
 * @param {...string} requiredPermissions - Permissions required for access
 * @returns {Function} Express middleware
 */
const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPermissions = req.session.permissions || [];
    const hasPermission = requiredPermissions.every(perm =>
      userPermissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  sessionMiddleware,
  requireAuth,
  deriveTenantContext,
  requireRole,
  requirePermission
};
