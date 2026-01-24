/**
 * @fileoverview Authentication and Authorization Middleware
 *
 * Provides JWT token verification and role-based access control.
 *
 * @module middleware/auth
 */

const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Authenticate request using JWT token
 *
 * Extracts token from Authorization header, verifies it,
 * and attaches user object to request.
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 * @returns {void}
 *
 * @example
 * // Header format
 * Authorization: Bearer <jwt_token>
 *
 * // After middleware, access user via
 * req.user.id
 * req.user.role_name
 * req.user.tier
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify user is still active (prevents use of old tokens after deactivation)
    if (user.employment_status !== 'active') {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
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
