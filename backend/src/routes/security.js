// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Security Routes
 * Handles MFA (TOTP), backup codes, session management, password policy,
 * account lockout, admin security settings, and security audit log.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const otplib = require('otplib');
const QRCode = require('qrcode');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication (except MFA validate, handled separately)
router.use(authenticate);

// =============================================
// HELPERS
// =============================================

/**
 * Log a security event to the dedicated security audit table
 */
async function logSecurityEvent(tenantId, userId, eventType, req, metadata = {}) {
  try {
    await db.query(
      `INSERT INTO security_audit_log (tenant_id, user_id, event_type, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, userId, eventType, req.ip || req.connection?.remoteAddress, req.headers?.['user-agent'], metadata]
    );
  } catch (err) {
    // Non-blocking — audit failures should not break the request
    console.error('Security audit log error:', err.message);
  }
}

/**
 * Generate 10 backup codes — returns { plaintext: [...], hashes: [...] }
 */
async function generateBackupCodes(count = 10) {
  const codes = [];
  const hashes = [];

  for (let i = 0; i < count; i++) {
    // Generate 8 hex chars, format as XXXX-XXXX
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = raw.slice(0, 4) + '-' + raw.slice(4);
    codes.push(formatted);
    // Hash each code with bcrypt for secure storage
    const hash = await bcrypt.hash(formatted, 10);
    hashes.push(hash);
  }

  return { plaintext: codes, hashes };
}

/**
 * Parse device name from User-Agent string (simple regex, no external dep)
 */
function parseDeviceName(userAgent) {
  if (!userAgent) return 'Unknown device';

  // Extract browser name
  let browser = 'Unknown browser';
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/Chrome\//i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/Safari\//i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(userAgent)) browser = 'Internet Explorer';

  // Extract OS name
  let os = 'Unknown OS';
  if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Macintosh|Mac OS/i.test(userAgent)) os = 'macOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad/i.test(userAgent)) os = 'iOS';

  return `${browser} on ${os}`;
}

/**
 * Validate a password against tenant policy — returns array of error strings
 */
function validatePassword(password, policy) {
  const errors = [];
  if (password.length < (policy.password_min_length || 8)) {
    errors.push(`At least ${policy.password_min_length || 8} characters`);
  }
  if (policy.password_require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter');
  }
  if (policy.password_require_number && !/[0-9]/.test(password)) {
    errors.push('At least one number');
  }
  if (policy.password_require_special && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('At least one special character');
  }
  return errors;
}

// =============================================
// MFA STATUS
// =============================================

/**
 * GET /mfa/status — Current user's MFA status + backup code count
 */
router.get('/mfa/status', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT mfa_enabled, mfa_enabled_at FROM users WHERE id = $1 AND tenant_id = $2`,
      [req.user.id, req.user.tenant_id]
    );

    // Count remaining backup codes
    const codesResult = await db.query(
      `SELECT COUNT(*) AS remaining FROM user_backup_codes
       WHERE user_id = $1 AND tenant_id = $2 AND used_at IS NULL`,
      [req.user.id, req.user.tenant_id]
    );

    // Get tenant MFA policy
    const tenantResult = await db.query(
      `SELECT mfa_policy, mfa_grace_period_days FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );

    res.json({
      mfa_enabled: rows[0]?.mfa_enabled || false,
      mfa_enabled_at: rows[0]?.mfa_enabled_at || null,
      backup_codes_remaining: parseInt(codesResult.rows[0]?.remaining || 0),
      mfa_policy: tenantResult.rows[0]?.mfa_policy || 'optional',
      mfa_grace_period_days: tenantResult.rows[0]?.mfa_grace_period_days || 7
    });
  } catch (err) {
    console.error('MFA status error:', err);
    res.status(500).json({ error: 'Failed to fetch MFA status' });
  }
});

// =============================================
// MFA ENROLL (Start Setup)
// =============================================

/**
 * POST /mfa/enroll — Generate TOTP secret + QR code, store in session
 */
router.post('/mfa/enroll', async (req, res) => {
  try {
    // Check tenant policy allows MFA
    const { rows: tenantRows } = await db.query(
      `SELECT mfa_policy FROM tenants WHERE id = $1`, [req.user.tenant_id]
    );
    if (tenantRows[0]?.mfa_policy === 'off') {
      return res.status(403).json({ error: 'MFA is disabled for your organisation' });
    }

    // Check user doesn't already have MFA enabled
    const { rows: userRows } = await db.query(
      `SELECT mfa_enabled FROM users WHERE id = $1`, [req.user.id]
    );
    if (userRows[0]?.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is already enabled' });
    }

    // Generate TOTP secret
    const secret = otplib.generateSecret();

    // Build the otpauth URI for QR code
    const otpauthUrl = otplib.generateURI({
      issuer: 'HeadOfficeOS',
      accountName: req.user.email,
      secret
    });

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily in session until verified
    req.session.pendingMfaSecret = secret;

    res.json({
      secret,
      qr_code_url: qrCodeUrl,
      manual_code: secret.match(/.{1,4}/g).join(' ') // Space-separated for readability
    });
  } catch (err) {
    console.error('MFA enroll error:', err);
    res.status(500).json({ error: 'Failed to start MFA setup' });
  }
});

// =============================================
// MFA VERIFY SETUP (Confirm + Enable)
// =============================================

/**
 * POST /mfa/verify-setup — Verify TOTP code, enable MFA, generate backup codes
 */
router.post('/mfa/verify-setup', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'A 6-digit code is required' });
    }

    // Retrieve pending secret from session
    const secret = req.session.pendingMfaSecret;
    if (!secret) {
      return res.status(400).json({ error: 'No MFA setup in progress. Please start again.' });
    }

    // Verify the TOTP code against the pending secret
    const isValid = otplib.verifySync({ token: code, secret, window: 1 }).valid;
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid code. Please check your authenticator app and try again.' });
    }

    // Save secret to user record, enable MFA
    await db.query(
      `UPDATE users SET mfa_secret = $1, mfa_enabled = true, mfa_enabled_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [secret, req.user.id, req.user.tenant_id]
    );

    // Generate 10 backup codes
    const { plaintext, hashes } = await generateBackupCodes();

    // Delete any existing backup codes for this user
    await db.query(
      `DELETE FROM user_backup_codes WHERE user_id = $1 AND tenant_id = $2`,
      [req.user.id, req.user.tenant_id]
    );

    // Insert new backup codes
    for (const hash of hashes) {
      await db.query(
        `INSERT INTO user_backup_codes (tenant_id, user_id, code_hash) VALUES ($1, $2, $3)`,
        [req.user.tenant_id, req.user.id, hash]
      );
    }

    // Clear pending secret from session
    delete req.session.pendingMfaSecret;

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'mfa_enabled', req);

    res.json({
      message: 'MFA enabled successfully',
      backup_codes: plaintext
    });
  } catch (err) {
    console.error('MFA verify-setup error:', err);
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

// =============================================
// MFA DISABLE
// =============================================

/**
 * DELETE /mfa — Disable MFA (requires current TOTP code)
 */
router.delete('/mfa', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Current 6-digit code required to disable MFA' });
    }

    // Get user's MFA secret
    const { rows } = await db.query(
      `SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1 AND tenant_id = $2`,
      [req.user.id, req.user.tenant_id]
    );

    if (!rows[0]?.mfa_enabled || !rows[0]?.mfa_secret) {
      return res.status(400).json({ error: 'MFA is not currently enabled' });
    }

    // Verify the TOTP code
    const isValid = otplib.verifySync({ token: code, secret: rows[0].mfa_secret, window: 1 }).valid;
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid code. MFA was not disabled.' });
    }

    // Disable MFA and clear secret
    await db.query(
      `UPDATE users SET mfa_secret = NULL, mfa_enabled = false, mfa_enabled_at = NULL
       WHERE id = $1 AND tenant_id = $2`,
      [req.user.id, req.user.tenant_id]
    );

    // Delete backup codes
    await db.query(
      `DELETE FROM user_backup_codes WHERE user_id = $1 AND tenant_id = $2`,
      [req.user.id, req.user.tenant_id]
    );

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'mfa_disabled', req);

    res.json({ message: 'MFA has been disabled' });
  } catch (err) {
    console.error('MFA disable error:', err);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

// =============================================
// BACKUP CODES
// =============================================

/**
 * GET /mfa/backup-codes — Count of remaining unused backup codes
 */
router.get('/mfa/backup-codes', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS remaining FROM user_backup_codes
       WHERE user_id = $1 AND tenant_id = $2 AND used_at IS NULL`,
      [req.user.id, req.user.tenant_id]
    );
    res.json({ remaining: parseInt(rows[0]?.remaining || 0) });
  } catch (err) {
    console.error('Backup codes count error:', err);
    res.status(500).json({ error: 'Failed to fetch backup code count' });
  }
});

/**
 * POST /mfa/backup-codes/regenerate — Generate new backup codes (requires TOTP code)
 */
router.post('/mfa/backup-codes/regenerate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Current 6-digit code required' });
    }

    // Verify TOTP code
    const { rows } = await db.query(
      `SELECT mfa_secret FROM users WHERE id = $1 AND tenant_id = $2`,
      [req.user.id, req.user.tenant_id]
    );

    if (!rows[0]?.mfa_secret) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    const isValid = otplib.verifySync({ token: code, secret: rows[0].mfa_secret, window: 1 }).valid;
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Delete old backup codes
    await db.query(
      `DELETE FROM user_backup_codes WHERE user_id = $1 AND tenant_id = $2`,
      [req.user.id, req.user.tenant_id]
    );

    // Generate new backup codes
    const { plaintext, hashes } = await generateBackupCodes();
    for (const hash of hashes) {
      await db.query(
        `INSERT INTO user_backup_codes (tenant_id, user_id, code_hash) VALUES ($1, $2, $3)`,
        [req.user.tenant_id, req.user.id, hash]
      );
    }

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'backup_codes_regenerated', req);

    res.json({ backup_codes: plaintext });
  } catch (err) {
    console.error('Backup codes regenerate error:', err);
    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
});

// =============================================
// MFA VALIDATE (Login Challenge — special auth)
// =============================================

/**
 * POST /mfa/validate — Validate TOTP or backup code during login
 * This endpoint does NOT require authenticate middleware since the user
 * hasn't completed login yet. It's handled in authController.js instead.
 * This route is registered WITHOUT the router-level authenticate.
 */

// =============================================
// PASSWORD POLICY
// =============================================

/**
 * GET /password-policy — Get tenant password requirements
 */
router.get('/password-policy', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT password_min_length, password_require_uppercase,
              password_require_number, password_require_special
       FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    res.json(rows[0] || {
      password_min_length: 8,
      password_require_uppercase: true,
      password_require_number: true,
      password_require_special: false
    });
  } catch (err) {
    console.error('Password policy error:', err);
    res.status(500).json({ error: 'Failed to fetch password policy' });
  }
});

/**
 * POST /change-password — Change current user's password with policy validation
 */
router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    // Verify current password
    const { rows: userRows } = await db.query(
      `SELECT password_hash FROM users WHERE id = $1`, [req.user.id]
    );
    const validCurrent = await bcrypt.compare(current_password, userRows[0].password_hash);
    if (!validCurrent) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Fetch and validate against tenant password policy
    const { rows: policyRows } = await db.query(
      `SELECT password_min_length, password_require_uppercase,
              password_require_number, password_require_special
       FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    const policy = policyRows[0] || {};
    const errors = validatePassword(new_password, policy);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet requirements', details: errors });
    }

    // Hash and save new password
    const hash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hash, req.user.id]
    );

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'password_changed', req);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// =============================================
// SESSION MANAGEMENT
// =============================================

/**
 * GET /sessions — List current user's active session devices
 */
router.get('/sessions', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT sd.id, sd.session_sid, sd.device_name, sd.ip_address, sd.last_active, sd.created_at
       FROM session_devices sd
       WHERE sd.user_id = $1 AND sd.tenant_id = $2
       ORDER BY sd.last_active DESC`,
      [req.user.id, req.user.tenant_id]
    );

    // Mark the current session
    const currentSid = req.sessionID;
    const sessions = rows.map(row => ({
      ...row,
      is_current: row.session_sid === currentSid
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * DELETE /sessions/:id — Terminate a specific session
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);

    // Get the session SID before deleting the device record
    const { rows } = await db.query(
      `SELECT session_sid FROM session_devices WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
      [deviceId, req.user.id, req.user.tenant_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Don't allow terminating the current session via this endpoint
    if (rows[0].session_sid === req.sessionID) {
      return res.status(400).json({ error: 'Cannot terminate your current session. Use logout instead.' });
    }

    // Delete from session_devices
    await db.query(
      `DELETE FROM session_devices WHERE id = $1 AND user_id = $2`,
      [deviceId, req.user.id]
    );

    // Destroy the matching session from connect-pg-simple store
    if (rows[0].session_sid) {
      await db.query(
        `DELETE FROM user_sessions WHERE sid = $1`,
        [rows[0].session_sid]
      );
    }

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'session_terminated', req, {
      terminated_device: rows[0].session_sid
    });

    res.json({ message: 'Session terminated' });
  } catch (err) {
    console.error('Terminate session error:', err);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

/**
 * DELETE /sessions/other — Terminate all sessions except current
 */
router.delete('/sessions/other', async (req, res) => {
  try {
    const currentSid = req.sessionID;

    // Get all other session SIDs
    const { rows } = await db.query(
      `SELECT session_sid FROM session_devices
       WHERE user_id = $1 AND tenant_id = $2 AND session_sid != $3`,
      [req.user.id, req.user.tenant_id, currentSid]
    );

    // Delete other devices
    await db.query(
      `DELETE FROM session_devices
       WHERE user_id = $1 AND tenant_id = $2 AND session_sid != $3`,
      [req.user.id, req.user.tenant_id, currentSid]
    );

    // Destroy matching sessions from connect-pg-simple store
    const sids = rows.map(r => r.session_sid).filter(Boolean);
    if (sids.length > 0) {
      await db.query(
        `DELETE FROM user_sessions WHERE sid = ANY($1)`,
        [sids]
      );
    }

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'all_sessions_terminated', req, {
      terminated_count: sids.length
    });

    res.json({ message: `Logged out ${sids.length} other session(s)` });
  } catch (err) {
    console.error('Terminate other sessions error:', err);
    res.status(500).json({ error: 'Failed to terminate other sessions' });
  }
});

// =============================================
// ADMIN SECURITY ENDPOINTS
// =============================================

/**
 * GET /admin/security-policy — Get tenant security settings
 */
router.get('/admin/security-policy', authorize('Admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT mfa_policy, mfa_grace_period_days, password_min_length,
              password_require_uppercase, password_require_number,
              password_require_special, session_timeout_minutes
       FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    res.json(rows[0] || {});
  } catch (err) {
    console.error('Get security policy error:', err);
    res.status(500).json({ error: 'Failed to fetch security policy' });
  }
});

/**
 * PUT /admin/security-policy — Update tenant security settings
 */
router.put('/admin/security-policy', authorize('Admin'), async (req, res) => {
  try {
    const {
      mfa_policy, mfa_grace_period_days,
      password_min_length, password_require_uppercase,
      password_require_number, password_require_special,
      session_timeout_minutes
    } = req.body;

    // Validate MFA policy value
    if (mfa_policy && !['off', 'optional', 'required'].includes(mfa_policy)) {
      return res.status(400).json({ error: 'Invalid MFA policy value' });
    }

    // Validate password min length range (8-16)
    if (password_min_length !== undefined && (password_min_length < 8 || password_min_length > 16)) {
      return res.status(400).json({ error: 'Password minimum length must be 8-16' });
    }

    // Validate session timeout (15-480 minutes)
    if (session_timeout_minutes !== undefined && (session_timeout_minutes < 15 || session_timeout_minutes > 480)) {
      return res.status(400).json({ error: 'Session timeout must be 15-480 minutes' });
    }

    await db.query(
      `UPDATE tenants SET
         mfa_policy = COALESCE($1, mfa_policy),
         mfa_grace_period_days = COALESCE($2, mfa_grace_period_days),
         password_min_length = COALESCE($3, password_min_length),
         password_require_uppercase = COALESCE($4, password_require_uppercase),
         password_require_number = COALESCE($5, password_require_number),
         password_require_special = COALESCE($6, password_require_special),
         session_timeout_minutes = COALESCE($7, session_timeout_minutes),
         updated_at = NOW()
       WHERE id = $8`,
      [mfa_policy, mfa_grace_period_days, password_min_length,
       password_require_uppercase, password_require_number,
       password_require_special, session_timeout_minutes,
       req.user.tenant_id]
    );

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'security_policy_updated', req, req.body);

    res.json({ message: 'Security policy updated' });
  } catch (err) {
    console.error('Update security policy error:', err);
    res.status(500).json({ error: 'Failed to update security policy' });
  }
});

/**
 * GET /admin/mfa-stats — MFA adoption statistics
 */
router.get('/admin/mfa-stats', authorize('Admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) AS total_users,
         COUNT(*) FILTER (WHERE mfa_enabled = true) AS mfa_enabled_count
       FROM users
       WHERE tenant_id = $1 AND employment_status = 'active'`,
      [req.user.tenant_id]
    );
    const total = parseInt(rows[0].total_users) || 0;
    const enabled = parseInt(rows[0].mfa_enabled_count) || 0;
    res.json({
      total_users: total,
      mfa_enabled_count: enabled,
      percentage: total > 0 ? Math.round((enabled / total) * 100) : 0
    });
  } catch (err) {
    console.error('MFA stats error:', err);
    res.status(500).json({ error: 'Failed to fetch MFA stats' });
  }
});

/**
 * GET /admin/security-audit — Paginated security audit log
 */
router.get('/admin/security-audit', authorize('Admin'), async (req, res) => {
  try {
    const { event_type, user_id, limit = 50, offset = 0 } = req.query;

    let sql = `SELECT sal.*, u.full_name AS user_name, u.email AS user_email
               FROM security_audit_log sal
               JOIN users u ON sal.user_id = u.id
               WHERE sal.tenant_id = $1`;
    const params = [req.user.tenant_id];
    let paramIndex = 2;

    // Optional filters
    if (event_type) {
      sql += ` AND sal.event_type = $${paramIndex++}`;
      params.push(event_type);
    }
    if (user_id) {
      sql += ` AND sal.user_id = $${paramIndex++}`;
      params.push(parseInt(user_id));
    }

    // Count total for pagination
    const countSql = sql.replace('SELECT sal.*, u.full_name AS user_name, u.email AS user_email', 'SELECT COUNT(*) AS total');
    const countResult = await db.query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Fetch page
    sql += ` ORDER BY sal.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Math.min(parseInt(limit), 200), parseInt(offset));

    const { rows } = await db.query(sql, params);

    res.json({ events: rows, total });
  } catch (err) {
    console.error('Security audit log error:', err);
    res.status(500).json({ error: 'Failed to fetch security audit log' });
  }
});

/**
 * GET /admin/inactive-accounts — Users with no login in 90+ days
 */
router.get('/admin/inactive-accounts', authorize('Admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, full_name, email, employee_number, role_name, last_login_at, employment_status
       FROM users
       WHERE tenant_id = $1
         AND employment_status = 'active'
         AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '90 days')
       ORDER BY last_login_at ASC NULLS FIRST`,
      [req.user.tenant_id]
    );
    res.json({ accounts: rows });
  } catch (err) {
    console.error('Inactive accounts error:', err);
    res.status(500).json({ error: 'Failed to fetch inactive accounts' });
  }
});

/**
 * POST /admin/bulk-disable — Disable selected inactive accounts
 */
router.post('/admin/bulk-disable', authorize('Admin'), async (req, res) => {
  try {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'User IDs array required' });
    }

    // Don't allow disabling yourself
    if (user_ids.includes(req.user.id)) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }

    const result = await db.query(
      `UPDATE users SET employment_status = 'inactive'
       WHERE id = ANY($1) AND tenant_id = $2 AND employment_status = 'active'
       RETURNING id`,
      [user_ids, req.user.tenant_id]
    );

    // Log security event
    await logSecurityEvent(req.user.tenant_id, req.user.id, 'bulk_accounts_disabled', req, {
      disabled_ids: result.rows.map(r => r.id),
      count: result.rowCount
    });

    res.json({ message: `${result.rowCount} account(s) disabled`, disabled: result.rows.map(r => r.id) });
  } catch (err) {
    console.error('Bulk disable error:', err);
    res.status(500).json({ error: 'Failed to disable accounts' });
  }
});

// Export the router, helper functions, and security event logger
module.exports = router;
module.exports.logSecurityEvent = logSecurityEvent;
module.exports.parseDeviceName = parseDeviceName;
module.exports.validatePassword = validatePassword;
