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
const otplib = require('otplib');
const User = require('../models/User');
const pool = require('../config/database');
const { auditLog } = require('../utils/auditLog');
const auditTrail = require('../utils/auditTrail');
const { logSecurityEvent, parseDeviceName, validatePassword } = require('../routes/security');

/* Lockout constants */
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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

    // --- Account lockout check ---
    // If user is locked and lockout period hasn't expired, reject immediately
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await logSecurityEvent(user.tenant_id || 1, user.id, 'login_failed_locked', req, {
        locked_until: user.locked_until
      });
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed attempts.',
        locked_until: user.locked_until
      });
    }

    // --- Password verification ---
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Increment failed attempt counter
      const newAttempts = (user.failed_login_attempts || 0) + 1;

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Lock the account for LOCKOUT_MINUTES
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await pool.query(
          `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
          [newAttempts, lockedUntil, user.id]
        );

        // Log lockout event
        await logSecurityEvent(user.tenant_id || 1, user.id, 'account_locked', req, {
          attempts: newAttempts, locked_until: lockedUntil.toISOString()
        });

        // Insert notification for the user about lockout
        try {
          await pool.query(
            `INSERT INTO notifications (tenant_id, user_id, type, title, message)
             VALUES ($1, $2, 'warning', 'Account Locked',
               'Your account has been temporarily locked due to multiple failed login attempts. It will unlock automatically in ${LOCKOUT_MINUTES} minutes.')`,
            [user.tenant_id || 1, user.id]
          );
        } catch (notifErr) {
          console.error('Failed to create lockout notification:', notifErr);
        }
      } else {
        // Just increment the counter
        await pool.query(
          `UPDATE users SET failed_login_attempts = $1 WHERE id = $2`,
          [newAttempts, user.id]
        );
      }

      // Log failed login attempt
      auditLog.loginFailure(email, req);
      await logSecurityEvent(user.tenant_id || 1, user.id, 'login_failed', req, {
        attempts: newAttempts
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // --- Password valid — reset lockout counters ---
    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1`,
      [user.id]
    );

    // --- MFA challenge check ---
    // If user has MFA enabled, don't create session yet — require TOTP verification
    if (user.mfa_enabled) {
      await logSecurityEvent(user.tenant_id || 1, user.id, 'mfa_challenge_sent', req);
      return res.json({
        mfa_required: true,
        user_id: user.id,
        message: 'MFA verification required'
      });
    }

    // --- No MFA — complete login with full session ---
    await completeLogin(req, res, user);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Complete the login process: create session, track device, return user data.
 * Called after password verification (and MFA verification if enabled).
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} user - User record from database
 */
async function completeLogin(req, res, user) {
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
  req.session.save(async (err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Login failed' });
    }

    // Track session device (device name, IP, session ID)
    try {
      const deviceName = parseDeviceName(req.get('User-Agent') || '');
      await pool.query(
        `INSERT INTO session_devices (tenant_id, user_id, session_sid, device_name, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.tenant_id || 1, user.id, req.sessionID, deviceName, req.ip]
      );
    } catch (deviceErr) {
      // Non-fatal — don't block login if device tracking fails
      console.error('Failed to track session device:', deviceErr);
    }

    // Log successful login
    auditLog.loginSuccess(user.tenant_id || 1, user.id, req);
    await logSecurityEvent(user.tenant_id || 1, user.id, 'login_success', req);

    // Fetch tenant MFA policy for the frontend to know if MFA setup is required
    let mfaPolicy = 'optional';
    let mfaGracePeriodDays = 7;
    try {
      const tenantResult = await pool.query(
        `SELECT mfa_policy, mfa_grace_period_days FROM tenants WHERE id = $1`,
        [user.tenant_id || 1]
      );
      if (tenantResult.rows.length > 0) {
        mfaPolicy = tenantResult.rows[0].mfa_policy || 'optional';
        mfaGracePeriodDays = tenantResult.rows[0].mfa_grace_period_days || 7;
      }
    } catch (policyErr) {
      console.error('Failed to fetch tenant MFA policy:', policyErr);
    }

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
      },
      // Include MFA policy so frontend can enforce setup if required
      mfa_policy: mfaPolicy,
      mfa_grace_period_days: mfaGracePeriodDays,
      mfa_enabled: user.mfa_enabled || false
    });
  });
}

/**
 * Validate MFA code during login — completes the two-step authentication.
 * Called when login returned mfa_required: true.
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.body.user_id - User ID from the MFA challenge response
 * @param {Object} req.body.code - 6-digit TOTP code or 8-char backup code
 * @param {Object} res - Express response
 * @returns {Object} Session + user data on success
 * @authorization Public (but requires prior password verification)
 */
async function validateMFA(req, res) {
  try {
    const { user_id, code } = req.body;

    if (!user_id || !code) {
      return res.status(400).json({ error: 'User ID and code are required' });
    }

    // Fetch the user with MFA secret
    const userResult = await pool.query(
      `SELECT u.*, r.role_name, r.permissions_json
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // User must have MFA enabled
    if (!user.mfa_enabled || !user.mfa_secret) {
      return res.status(400).json({ error: 'MFA is not enabled for this account' });
    }

    const trimmedCode = code.trim();

    // Try TOTP verification first (6-digit code)
    if (/^\d{6}$/.test(trimmedCode)) {
      const isValid = otplib.verifySync({ token: trimmedCode, secret: user.mfa_secret, window: 1 }).valid;
      if (isValid) {
        // TOTP code accepted — complete login
        await logSecurityEvent(user.tenant_id || 1, user.id, 'mfa_verified', req, {
          method: 'totp'
        });
        return await completeLogin(req, res, user);
      }

      // TOTP failed — log and reject
      await logSecurityEvent(user.tenant_id || 1, user.id, 'mfa_failed', req, {
        method: 'totp'
      });
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Try backup code (8-char alphanumeric, possibly with hyphen XXXX-XXXX)
    const cleanCode = trimmedCode.replace(/-/g, '').toUpperCase();
    if (cleanCode.length === 8) {
      // Fetch unused backup codes for this user
      const codesResult = await pool.query(
        `SELECT id, code_hash FROM user_backup_codes
         WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );

      // Check each backup code hash
      for (const row of codesResult.rows) {
        const match = await bcrypt.compare(cleanCode, row.code_hash);
        if (match) {
          // Mark backup code as used
          await pool.query(
            `UPDATE user_backup_codes SET used_at = NOW() WHERE id = $1`,
            [row.id]
          );

          // Log backup code usage
          await logSecurityEvent(user.tenant_id || 1, user.id, 'backup_code_used', req, {
            code_id: row.id
          });

          // Complete login
          return await completeLogin(req, res, user);
        }
      }

      // No matching backup code
      await logSecurityEvent(user.tenant_id || 1, user.id, 'mfa_failed', req, {
        method: 'backup_code'
      });
      return res.status(401).json({ error: 'Invalid backup code' });
    }

    // Code format not recognised
    return res.status(400).json({ error: 'Invalid code format. Enter a 6-digit code or 8-character backup code.' });

  } catch (error) {
    console.error('MFA validation error:', error);
    res.status(500).json({ error: 'MFA validation failed' });
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
  checkAuditAccess,
  validateMFA,
  completeLogin
};
