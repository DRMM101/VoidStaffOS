// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Security Settings Page (User Hub)
 * Allows all users to manage their MFA, view active sessions,
 * and change their password with live policy validation.
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, Smartphone, Key, LogOut, RefreshCw, Check, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import MFASetupWizard from './MFASetupWizard';
import MFADisableModal from './MFADisableModal';
import BackupCodesModal from './BackupCodesModal';

function SecuritySettingsPage({ user, onNavigate }) {
  // MFA state
  const [mfaStatus, setMfaStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal visibility flags
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Session state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /**
   * Fetch MFA status for the current user
   */
  const fetchMfaStatus = useCallback(async () => {
    try {
      const data = await api.get('/security/mfa/status');
      setMfaStatus(data);
    } catch (err) {
      console.error('Failed to fetch MFA status:', err);
      setError('Failed to load security settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch active sessions for the current user
   */
  const fetchSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const data = await api.get('/security/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  /**
   * Fetch tenant password policy for live validation
   */
  const fetchPasswordPolicy = useCallback(async () => {
    try {
      const data = await api.get('/security/password-policy');
      setPasswordPolicy(data.policy);
    } catch (err) {
      console.error('Failed to fetch password policy:', err);
    }
  }, []);

  // Load all data on mount
  useEffect(() => {
    fetchMfaStatus();
    fetchSessions();
    fetchPasswordPolicy();
  }, [fetchMfaStatus, fetchSessions, fetchPasswordPolicy]);

  /**
   * Validate new password against policy in real-time
   */
  useEffect(() => {
    if (!passwordPolicy || !newPassword) {
      setPasswordErrors([]);
      return;
    }
    const errors = [];
    if (newPassword.length < passwordPolicy.min_length) {
      errors.push(`At least ${passwordPolicy.min_length} characters`);
    }
    if (passwordPolicy.require_uppercase && !/[A-Z]/.test(newPassword)) {
      errors.push('At least one uppercase letter');
    }
    if (passwordPolicy.require_number && !/\d/.test(newPassword)) {
      errors.push('At least one number');
    }
    if (passwordPolicy.require_special && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      errors.push('At least one special character');
    }
    setPasswordErrors(errors);
  }, [newPassword, passwordPolicy]);

  /**
   * Submit password change
   */
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordErrors.length > 0 || newPassword !== confirmPassword) return;

    try {
      setChangingPassword(true);
      setPasswordSuccess(false);
      await api.post('/security/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  /**
   * Terminate a specific session
   */
  const handleTerminateSession = async (sessionId) => {
    try {
      setTerminatingId(sessionId);
      await api.delete(`/security/sessions/${sessionId}`);
      await fetchSessions();
    } catch (err) {
      console.error('Failed to terminate session:', err);
    } finally {
      setTerminatingId(null);
    }
  };

  /**
   * Terminate all other sessions
   */
  const handleTerminateOthers = async () => {
    try {
      setTerminatingId('all');
      await api.delete('/security/sessions/other');
      await fetchSessions();
    } catch (err) {
      console.error('Failed to terminate other sessions:', err);
    } finally {
      setTerminatingId(null);
    }
  };

  /**
   * Callback after MFA setup completes — refresh status
   */
  const onMfaSetupComplete = () => {
    setShowSetupWizard(false);
    fetchMfaStatus();
  };

  /**
   * Callback after MFA disable — refresh status
   */
  const onMfaDisabled = () => {
    setShowDisableModal(false);
    fetchMfaStatus();
  };

  // Loading state
  if (loading) {
    return (
      <div className="security-page">
        <div className="loading">Loading security settings…</div>
      </div>
    );
  }

  return (
    <div className="security-page">
      {/* Page header */}
      <div className="security-page__header">
        <h2 className="security-page__title">
          <Shield size={24} aria-hidden="true" />
          Security Settings
        </h2>
        <p className="security-page__subtitle">
          Manage your two-factor authentication, active sessions, and password
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="error-banner__dismiss" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* ===== MFA Section ===== */}
      <section className="security-section" aria-label="Two-factor authentication">
        <h3 className="security-section__title">
          <Smartphone size={20} aria-hidden="true" />
          Two-Factor Authentication
        </h3>

        <div className="security-section__content">
          {/* MFA status badge */}
          <div className="security-mfa__status">
            <span className={`security-badge ${mfaStatus?.mfa_enabled ? 'security-badge--enabled' : 'security-badge--disabled'}`}>
              {mfaStatus?.mfa_enabled ? 'Enabled' : 'Disabled'}
            </span>
            {mfaStatus?.mfa_enabled && mfaStatus?.mfa_enabled_at && (
              <span className="security-mfa__enabled-date">
                Since {new Date(mfaStatus.mfa_enabled_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </span>
            )}
          </div>

          {/* MFA description */}
          <p className="security-mfa__description">
            {mfaStatus?.mfa_enabled
              ? 'Your account is protected with two-factor authentication. You will need your authenticator app to sign in.'
              : 'Add an extra layer of security to your account by requiring a verification code from your authenticator app when signing in.'
            }
          </p>

          {/* MFA action buttons */}
          <div className="security-mfa__actions">
            {mfaStatus?.mfa_enabled ? (
              <>
                {/* Backup codes info + actions */}
                <div className="security-mfa__backup-info">
                  <Key size={16} aria-hidden="true" />
                  <span>
                    {mfaStatus.backup_codes_remaining} backup code{mfaStatus.backup_codes_remaining !== 1 ? 's' : ''} remaining
                  </span>
                  <button
                    className="btn-secondary btn-secondary--sm"
                    onClick={() => setShowBackupCodes(true)}
                    aria-label="Manage backup codes"
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Manage Codes
                  </button>
                </div>
                <button
                  className="btn-danger btn-danger--sm"
                  onClick={() => setShowDisableModal(true)}
                  aria-label="Disable two-factor authentication"
                >
                  Disable 2FA
                </button>
              </>
            ) : (
              <button
                className="btn-primary"
                onClick={() => setShowSetupWizard(true)}
                aria-label="Enable two-factor authentication"
              >
                <Shield size={16} aria-hidden="true" />
                Enable 2FA
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ===== Active Sessions Section ===== */}
      <section className="security-section" aria-label="Active sessions">
        <h3 className="security-section__title">
          <LogOut size={20} aria-hidden="true" />
          Active Sessions
        </h3>

        <div className="security-section__content">
          {sessionsLoading ? (
            <div className="loading">Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <p className="security-sessions__empty">No active sessions found.</p>
          ) : (
            <>
              {/* Terminate all other sessions button */}
              {sessions.length > 1 && (
                <button
                  className="btn-secondary btn-secondary--sm security-sessions__terminate-all"
                  onClick={handleTerminateOthers}
                  disabled={terminatingId === 'all'}
                  aria-label="Log out all other sessions"
                >
                  <LogOut size={14} aria-hidden="true" />
                  {terminatingId === 'all' ? 'Terminating…' : 'Log Out All Other Sessions'}
                </button>
              )}

              {/* Session device cards */}
              <div className="security-sessions__list">
                {sessions.map((session) => (
                  <div key={session.id} className="security-session-card">
                    <div className="security-session-card__info">
                      <span className="security-session-card__device">
                        {session.device_name || 'Unknown Device'}
                      </span>
                      <span className="security-session-card__ip">{session.ip_address}</span>
                      <span className="security-session-card__time">
                        Last active: {new Date(session.last_active).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                      {session.is_current && (
                        <span className="security-badge security-badge--current">Current</span>
                      )}
                    </div>
                    {!session.is_current && (
                      <button
                        className="btn-danger btn-danger--sm"
                        onClick={() => handleTerminateSession(session.id)}
                        disabled={terminatingId === session.id}
                        aria-label={`Log out session on ${session.device_name || 'unknown device'}`}
                      >
                        {terminatingId === session.id ? 'Terminating…' : 'Log Out'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ===== Change Password Section ===== */}
      <section className="security-section" aria-label="Change password">
        <h3 className="security-section__title">
          <Key size={20} aria-hidden="true" />
          Change Password
        </h3>

        <div className="security-section__content">
          {passwordSuccess && (
            <div className="success-banner" role="status">
              <Check size={16} aria-hidden="true" />
              Password changed successfully.
            </div>
          )}

          <form className="security-password-form" onSubmit={handlePasswordChange}>
            {/* Current password */}
            <div className="form-group">
              <label htmlFor="current-password" className="form-label">Current Password</label>
              <input
                id="current-password"
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {/* New password with live validation */}
            <div className="form-group">
              <label htmlFor="new-password" className="form-label">New Password</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {/* Live policy feedback */}
              {passwordPolicy && newPassword && (
                <ul className="security-password-rules" aria-label="Password requirements">
                  {passwordErrors.map((err, i) => (
                    <li key={i} className="security-password-rules__item security-password-rules__item--fail">
                      <AlertCircle size={12} aria-hidden="true" /> {err}
                    </li>
                  ))}
                  {passwordErrors.length === 0 && (
                    <li className="security-password-rules__item security-password-rules__item--pass">
                      <Check size={12} aria-hidden="true" /> Password meets all requirements
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Confirm password */}
            <div className="form-group">
              <label htmlFor="confirm-password" className="form-label">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <span className="form-error">Passwords do not match</span>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={
                changingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword ||
                passwordErrors.length > 0
              }
              aria-label="Change password"
            >
              {changingPassword ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </div>
      </section>

      {/* ===== Modals ===== */}
      {showSetupWizard && (
        <MFASetupWizard
          onComplete={onMfaSetupComplete}
          onCancel={() => setShowSetupWizard(false)}
        />
      )}

      {showDisableModal && (
        <MFADisableModal
          onDisabled={onMfaDisabled}
          onCancel={() => setShowDisableModal(false)}
        />
      )}

      {showBackupCodes && (
        <BackupCodesModal
          mfaEnabled={mfaStatus?.mfa_enabled}
          onClose={() => setShowBackupCodes(false)}
        />
      )}
    </div>
  );
}

export default SecuritySettingsPage;
