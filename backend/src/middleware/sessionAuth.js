/**
 * HeadOfficeOS - Session Authentication Middleware
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
  name: 'HeadOfficeOS_sid',
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

/**
 * Tier-based authorization middleware factory
 * Requires user tier to be at or above the specified level
 * Higher tier number = more senior (100=CEO, 10=Contractor)
 *
 * @param {number} minTier - Minimum tier required for access
 * @returns {Function} Express middleware
 */
const requireTier = (minTier) => {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userTier = req.session.tier;

    // Admin role (null tier) has full access
    if (userTier === null && req.session.roles?.includes('Admin')) {
      return next();
    }

    // Check tier level
    if (userTier === null || userTier === undefined || userTier < minTier) {
      return res.status(403).json({
        error: 'Insufficient tier level',
        required: minTier,
        current: userTier
      });
    }

    next();
  };
};

/**
 * Additional role-based authorization middleware factory
 * Requires user to have at least one of the specified additional roles
 *
 * @param {...string} roleCodes - Additional role codes that are allowed
 * @returns {Function} Express middleware
 */
const requireAdditionalRole = (...roleCodes) => {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userAdditionalRoles = req.session.additionalRoles || [];
    const hasRole = roleCodes.some(code =>
      userAdditionalRoles.includes(code)
    );

    if (!hasRole) {
      return res.status(403).json({
        error: 'Required additional role not assigned',
        required: roleCodes
      });
    }

    next();
  };
};

/**
 * Combined tier OR additional role authorization middleware factory
 * Passes if user meets tier requirement OR has one of the specified roles
 *
 * @param {Object} options - Authorization options
 * @param {number} options.tier - Minimum tier (if met, passes)
 * @param {string[]} options.roles - Additional role codes (if any match, passes)
 * @returns {Function} Express middleware
 */
const requireTierOrRole = ({ tier, roles = [] }) => {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userTier = req.session.tier;
    const userAdditionalRoles = req.session.additionalRoles || [];

    // Admin role (null tier) has full access
    if (userTier === null && req.session.roles?.includes('Admin')) {
      return next();
    }

    // Check tier requirement
    if (tier && userTier !== null && userTier !== undefined && userTier >= tier) {
      return next();
    }

    // Check additional roles
    if (roles.length > 0) {
      const hasRole = roles.some(code => userAdditionalRoles.includes(code));
      if (hasRole) {
        return next();
      }
    }

    return res.status(403).json({
      error: 'Insufficient tier level or missing required role',
      requiredTier: tier,
      currentTier: userTier,
      requiredRoles: roles,
      currentRoles: userAdditionalRoles
    });
  };
};

module.exports = {
  sessionMiddleware,
  requireAuth,
  deriveTenantContext,
  requireRole,
  requirePermission,
  requireTier,
  requireAdditionalRole,
  requireTierOrRole
};
