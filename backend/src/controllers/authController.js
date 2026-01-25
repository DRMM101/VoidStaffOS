/**
 * VoidStaffOS - Authentication Controller
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
const { auditLog } = require('../utils/auditLog');

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

    // Create session (secure cookie-based auth)
    req.session.userId = user.id;
    req.session.tenantId = user.tenant_id || 1; // Default tenant for migration
    req.session.roles = [user.role_name];
    req.session.permissions = user.permissions_json || [];
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
          employee_number: user.employee_number
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
    res.clearCookie('staffos_sid');
    res.clearCookie('staffos_csrf');

    res.json({ success: true, message: 'Logged out successfully' });
  });
}

module.exports = {
  register,
  login,
  logout,
  getMe
};
