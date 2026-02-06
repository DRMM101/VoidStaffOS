/**
 * HeadOfficeOS - Authentication Controller
 * Handles user authentication: login, registration, and session management.
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

const bcrypt = require('bcrypt');
const User = require('../models/User');
const pool = require('../config/database');
const { auditLog } = require('../utils/auditLog');
const auditTrail = require('../utils/auditTrail');

/**
 * Register a new user
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password (will be hashed)
 * @param {string} req.body.full_name - User's full name
 * @param {number} req.body.role_id - Role ID
 * @param {Object} res - Express response
 * @returns {Object} Created user (without sensitive data)
 * @authorization Public (but typically disabled in production)
 */
async function register(req, res) {
  try {
    const { email, password, full_name, role_id } = req.body;

    if (!email || !password || !full_name || !role_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({ email, password, full_name, role_id });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role_id: user.role_id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * Authenticate user and issue JWT token
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response
 * @returns {Object} JWT token and user data
 * @authorization Public
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.employment_status !== 'active') {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Log failed login attempt
      auditLog.loginFailure(email, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fetch user's additional roles and their permissions
    const additionalRolesResult = await pool.query(
      `SELECT ar.role_code, ar.permissions_json
       FROM user_additional_roles uar
       JOIN additional_roles ar ON uar.additional_role_id = ar.id
       WHERE uar.user_id = $1
         AND ar.is_active = TRUE
         AND (uar.expires_at IS NULL OR uar.expires_at > CURRENT_TIMESTAMP)`,
      [user.id]
    );

    // Extract role codes and merge permissions
    const additionalRoleCodes = additionalRolesResult.rows.map(r => r.role_code);
    const additionalPermissions = additionalRolesResult.rows
      .flatMap(r => r.permissions_json || []);

    // Combine base permissions with additional role permissions
    const basePermissions = Array.isArray(user.permissions_json) ? user.permissions_json : [];
    const allPermissions = [...new Set([...basePermissions, ...additionalPermissions])];

    // Create session (secure cookie-based auth)
    req.session.userId = user.id;
    req.session.tenantId = user.tenant_id || 1; // Default tenant for migration
    req.session.roles = [user.role_name];
    req.session.tier = user.tier; // Store tier in session for tier-based auth
    req.session.permissions = allPermissions;
    req.session.additionalRoles = additionalRoleCodes;
    req.session.email = user.email;
    req.session.fullName = user.full_name;

    // Save session explicitly to ensure cookie is set before response
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }

      // Log successful login
      auditLog.loginSuccess(user.tenant_id || 1, user.id, req);

      // Return safe user data (no password hash, internal fields)
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role_name: user.role_name,
          tier: user.tier,
          employee_number: user.employee_number,
          additionalRoles: additionalRoleCodes
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Get current authenticated user's profile
 *
 * @async
 * @param {Object} req - Express request (with user from auth middleware)
 * @param {Object} res - Express response
 * @returns {Object} Current user data
 * @authorization Any authenticated user
 */
async function getMe(req, res) {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      full_name: req.user.full_name,
      role_id: req.user.role_id,
      role_name: req.user.role_name,
      tier: req.user.tier,
      employee_number: req.user.employee_number,
      employment_status: req.user.employment_status,
      start_date: req.user.start_date
    }
  });
}

/**
 * Logout user and destroy session
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Object} Success message
 * @authorization Any authenticated user
 */
async function logout(req, res) {
  const { tenantId, userId } = req.session || {};

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }

    // Log logout
    if (tenantId && userId) {
      auditLog.logout(tenantId, userId, req);
    }

    // Clear cookies
    res.clearCookie('HeadOfficeOS_sid');
    res.clearCookie('HeadOfficeOS_csrf');

    res.json({ success: true, message: 'Logged out successfully' });
  });
}

/**
 * Verify password for re-authentication (sensitive operations)
 * Used before accessing highly sensitive data like audit trail
 *
 * SECURITY:
 * - Only Admin can use this endpoint
 * - Sets auditTrailVerifiedAt timestamp in session
 * - Verification expires after 15 minutes
 * - All attempts (success/failure) are logged
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.body.password - Current password to verify
 * @param {Object} res - Express response
 * @returns {Object} Success status
 * @authorization Admin only
 */
async function verifyPassword(req, res) {
  try {
    const { password } = req.body;
    const { role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // SECURITY: Only System Administrators can verify for audit access
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrator role required.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Log failed re-authentication attempt
      await auditTrail.logChange(
        { tenantId, userId: req.user.id },
        req,
        {
          action: 'AUDIT_ACCESS_DENIED',
          resourceType: 'audit_trail',
          resourceId: null,
          resourceName: 'Audit Trail Re-authentication',
          reason: 'Re-authentication failed - invalid password'
        }
      );

      return res.status(401).json({ error: 'Invalid password' });
    }

    // Set verification timestamp in session (expires after 15 minutes)
    req.session.auditTrailVerifiedAt = Date.now();

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Verification failed' });
      }

      // Log successful re-authentication
      auditTrail.logChange(
        { tenantId, userId: req.user.id },
        req,
        {
          action: 'AUDIT_ACCESS_VERIFIED',
          resourceType: 'audit_trail',
          resourceId: null,
          resourceName: 'Audit Trail Re-authentication',
          reason: 'Re-authentication successful - audit trail access granted'
        }
      );

      res.json({
        success: true,
        message: 'Password verified. Audit trail access granted for 15 minutes.',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    });
  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ error: 'Password verification failed' });
  }
}

/**
 * Check if audit trail access is still valid
 * Returns the expiry time if verified, or error if not
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Object} Verification status
 * @authorization Admin only
 */
async function checkAuditAccess(req, res) {
  try {
    const { role_name } = req.user;

    // SECURITY: Only System Administrators can check
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrator role required.' });
    }

    const verifiedAt = req.session?.auditTrailVerifiedAt;
    const EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

    if (!verifiedAt) {
      return res.json({ verified: false, message: 'Re-authentication required' });
    }

    const now = Date.now();
    const expiresAt = verifiedAt + EXPIRY_MS;

    if (now > expiresAt) {
      // Clear expired verification
      req.session.auditTrailVerifiedAt = null;
      return res.json({ verified: false, message: 'Verification expired. Re-authentication required.' });
    }

    res.json({
      verified: true,
      expiresAt: new Date(expiresAt).toISOString(),
      remainingMs: expiresAt - now
    });
  } catch (error) {
    console.error('Check audit access error:', error);
    res.status(500).json({ error: 'Failed to check verification status' });
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  verifyPassword,
  checkAuditAccess
};
