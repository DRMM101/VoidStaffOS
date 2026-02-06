/**
 * HeadOfficeOS - Login Component
 * User authentication form.
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

import { useState } from 'react';
import MFAVerifyModal from './security/MFAVerifyModal';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA challenge state — set when login returns mfa_required: true
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle account lockout (423 status)
        if (response.status === 423 && data.locked_until) {
          const lockedUntil = new Date(data.locked_until);
          const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
          throw new Error(`Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
        }
        throw new Error(data.error || 'Login failed');
      }

      // Check if MFA verification is required
      if (data.mfa_required) {
        setMfaRequired(true);
        setMfaUserId(data.user_id);
        return;
      }

      // Session cookie is set automatically by the server
      // Pass MFA policy info alongside user so App can enforce MFA setup if required
      onLogin(data.user, {
        mfa_policy: data.mfa_policy,
        mfa_enabled: data.mfa_enabled
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Called when MFA verification succeeds — receives full login response
   */
  const handleMfaVerified = (data) => {
    setMfaRequired(false);
    setMfaUserId(null);
    // MFA already verified — user has MFA enabled, pass that info
    onLogin(data.user, {
      mfa_policy: data.mfa_policy,
      mfa_enabled: true
    });
  };

  /**
   * Cancel MFA verification — return to password form
   */
  const handleMfaCancel = () => {
    setMfaRequired(false);
    setMfaUserId(null);
    setError('');
  };

  // Show MFA verify modal if MFA challenge is active
  if (mfaRequired && mfaUserId) {
    return (
      <div className="login-container">
        <MFAVerifyModal
          userId={mfaUserId}
          onVerified={handleMfaVerified}
          onCancel={handleMfaCancel}
        />
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>HeadOfficeOS</h1>
        <h2>Sign In</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
