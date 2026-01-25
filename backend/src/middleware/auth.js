/**
 * VoidStaffOS - Authentication Middleware
 * Provides JWT token verification and role-based access control.
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

const User = require('../models/User');

/**
 * Authenticate request using session
 *
 * Checks for valid session and attaches user object to request.
 * Falls back to JWT for backwards compatibility during migration.
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 * @returns {void}
 *
 * @example
 * // After middleware, access user via
 * req.user.id
 * req.user.role_name
 * req.user.tier
 */
async function authenticate(req, res, next) {
  // Check for session-based auth first
  if (req.session?.userId) {
    try {
      const user = await User.findById(req.session.userId);

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.employment_status !== 'active') {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('Session auth error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }

  // No valid session
  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Authorize request based on user roles
 *
 * Returns middleware that checks if authenticated user
 * has one of the specified roles.
 *
 * @param {...string} roles - Allowed role names (e.g., 'Admin', 'Manager')
 * @returns {Function} Express middleware function
 *
 * @example
 * // Allow only Admin
 * router.post('/users', authorize('Admin'), createUser);
 *
 * // Allow Admin or Manager
 * router.get('/team', authorize('Admin', 'Manager'), getTeam);
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize
};
