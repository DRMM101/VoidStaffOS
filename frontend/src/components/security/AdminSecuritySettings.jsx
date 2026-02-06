// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Admin Security Settings
 * Admin-only panel for tenant-level security policy management:
 * MFA policy, password policy, session timeout, MFA adoption stats,
 * inactive account detection, and security audit log.
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Clock, AlertCircle, Check, Lock, Activity } from 'lucide-react';
import api from '../../utils/api';

/* Session timeout dropdown options (in minutes) */
const TIMEOUT_OPTIONS = [
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '8 hours (default)', value: 480 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 }
];

function AdminSecuritySettings({ user, onNavigate }) {
  // Policy state
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // MFA adoption stats
  const [mfaStats, setMfaStats] = useState(null);

  // Inactive accounts
  const [inactiveAccounts, setInactiveAccounts] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [selectedInactive, setSelectedInactive] = useState([]);
  const [disablingAccounts, setDisablingAccounts] = useState(false);

  // Audit log
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  /**
   * Fetch current security policy
   */
  const fetchPolicy = useCallback(async () => {
    try {
      const data = await api.get('/security/admin/security-policy');
      setPolicy(data.policy);
    } catch (err) {
      console.error('Failed to fetch security policy:', err);
      setError('Failed to load security settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch MFA adoption stats
   */
  const fetchMfaStats = useCallback(async () => {
    try {
      const data = await api.get('/security/admin/mfa-stats');
      setMfaStats(data);
    } catch (err) {
      console.error('Failed to fetch MFA stats:', err);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchPolicy();
    fetchMfaStats();
  }, [fetchPolicy, fetchMfaStats]);

  /**
   * Save updated policy to server
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      await api.put('/security/admin/security-policy', policy);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save security policy:', err);
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update a policy field locally (optimistic UI)
   */
  const updatePolicy = (field, value) => {
    setPolicy(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Fetch inactive accounts (90+ days since last login)
   */
  const fetchInactiveAccounts = async () => {
    try {
      setInactiveLoading(true);
      const data = await api.get('/security/admin/inactive-accounts');
      setInactiveAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch inactive accounts:', err);
    } finally {
      setInactiveLoading(false);
    }
  };

  /**
   * Toggle selection of an inactive account for bulk disable
   */
  const toggleInactiveSelect = (userId) => {
    setSelectedInactive(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  /**
   * Bulk disable selected inactive accounts
   */
  const handleBulkDisable = async () => {
    if (selectedInactive.length === 0) return;
    try {
      setDisablingAccounts(true);
      await api.post('/security/admin/bulk-disable', {
        user_ids: selectedInactive
      });
      setSelectedInactive([]);
      await fetchInactiveAccounts();
    } catch (err) {
      console.error('Failed to disable accounts:', err);
      setError(err.message || 'Failed to disable accounts.');
    } finally {
      setDisablingAccounts(false);
    }
  };

  /**
   * Fetch security audit log with optional event type filter
   */
  const fetchAuditLog = async () => {
    try {
      setAuditLoading(true);
      const params = auditFilter ? `?event_type=${auditFilter}` : '';
      const data = await api.get(`/security/admin/security-audit${params}`);
      setAuditLog(data.events || []);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="admin-security">
        <div className="loading">Loading security settings…</div>
      </div>
    );
  }

  return (
    <div className="admin-security">
      {/* Page header */}
      <div className="admin-security__header">
        <h2 className="admin-security__title">
          <Shield size={24} aria-hidden="true" />
          Security Settings
        </h2>
        <p className="admin-security__subtitle">
          Configure organisation-wide security policies
        </p>
      </div>

      {/* Error / success banners */}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="error-banner__dismiss" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      {success && (
        <div className="success-banner" role="status">
          <Check size={16} aria-hidden="true" /> Settings saved successfully.
        </div>
      )}

      {policy && (
        <>
          {/* ===== MFA Policy Section ===== */}
          <section className="admin-security__section" aria-label="MFA policy">
            <h3 className="admin-security__section-title">
              <Lock size={18} aria-hidden="true" /> MFA Policy
            </h3>
            <div className="admin-security__field">
              <label htmlFor="mfa-policy" className="form-label">MFA Requirement</label>
              <select
                id="mfa-policy"
                className="form-select"
                value={policy.mfa_policy}
                onChange={(e) => updatePolicy('mfa_policy', e.target.value)}
              >
                <option value="off">Off (hidden from users)</option>
                <option value="optional">Optional (user choice)</option>
                <option value="required">Required (mandatory)</option>
              </select>
            </div>
            {policy.mfa_policy === 'required' && (
              <div className="admin-security__field">
                <label htmlFor="mfa-grace" className="form-label">
                  Grace Period (days before enforcement)
                </label>
                <input
                  id="mfa-grace"
                  type="number"
                  className="form-input form-input--sm"
                  value={policy.mfa_grace_period_days}
                  onChange={(e) => updatePolicy('mfa_grace_period_days', parseInt(e.target.value) || 0)}
                  min={0}
                  max={90}
                />
              </div>
            )}

            {/* MFA Adoption Stats */}
            {mfaStats && (
              <div className="admin-security__stats">
                <h4 className="admin-security__stats-title">MFA Adoption</h4>
                <div className="admin-security__stats-bar">
                  <div
                    className="admin-security__stats-fill"
                    style={{ width: `${mfaStats.percentage || 0}%` }}
                    aria-label={`${mfaStats.percentage}% of users have MFA enabled`}
                  />
                </div>
                <span className="admin-security__stats-label">
                  {mfaStats.mfa_enabled_count} / {mfaStats.total_users} users ({mfaStats.percentage}%)
                </span>
              </div>
            )}
          </section>

          {/* ===== Password Policy Section ===== */}
          <section className="admin-security__section" aria-label="Password policy">
            <h3 className="admin-security__section-title">
              <Lock size={18} aria-hidden="true" /> Password Policy
            </h3>
            <div className="admin-security__field">
              <label htmlFor="pass-min-length" className="form-label">
                Minimum Length: {policy.password_min_length}
              </label>
              <input
                id="pass-min-length"
                type="range"
                className="form-range"
                value={policy.password_min_length}
                onChange={(e) => updatePolicy('password_min_length', parseInt(e.target.value))}
                min={6}
                max={32}
                aria-label="Minimum password length"
              />
            </div>
            <div className="admin-security__toggles">
              <label className="admin-security__toggle">
                <input
                  type="checkbox"
                  checked={policy.password_require_uppercase}
                  onChange={(e) => updatePolicy('password_require_uppercase', e.target.checked)}
                />
                Require uppercase letter
              </label>
              <label className="admin-security__toggle">
                <input
                  type="checkbox"
                  checked={policy.password_require_number}
                  onChange={(e) => updatePolicy('password_require_number', e.target.checked)}
                />
                Require number
              </label>
              <label className="admin-security__toggle">
                <input
                  type="checkbox"
                  checked={policy.password_require_special}
                  onChange={(e) => updatePolicy('password_require_special', e.target.checked)}
                />
                Require special character
              </label>
            </div>
          </section>

          {/* ===== Session Timeout Section ===== */}
          <section className="admin-security__section" aria-label="Session timeout">
            <h3 className="admin-security__section-title">
              <Clock size={18} aria-hidden="true" /> Session Timeout
            </h3>
            <div className="admin-security__field">
              <label htmlFor="session-timeout" className="form-label">Auto-logout after inactivity</label>
              <select
                id="session-timeout"
                className="form-select"
                value={policy.session_timeout_minutes}
                onChange={(e) => updatePolicy('session_timeout_minutes', parseInt(e.target.value))}
              >
                {TIMEOUT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Save button */}
          <button
            className="btn-primary admin-security__save"
            onClick={handleSave}
            disabled={saving}
            aria-label="Save security settings"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </>
      )}

      {/* ===== Inactive Accounts Section ===== */}
      <section className="admin-security__section" aria-label="Inactive accounts">
        <h3 className="admin-security__section-title">
          <Users size={18} aria-hidden="true" /> Inactive Accounts
        </h3>
        <p className="admin-security__description">
          Users who have not logged in for 90+ days.
        </p>
        <button
          className="btn-secondary btn-secondary--sm"
          onClick={fetchInactiveAccounts}
          disabled={inactiveLoading}
          aria-label="Load inactive accounts"
        >
          {inactiveLoading ? 'Loading…' : 'Check Inactive Accounts'}
        </button>

        {inactiveAccounts.length > 0 && (
          <>
            <table className="admin-security__table" aria-label="Inactive accounts">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInactive(inactiveAccounts.map(a => a.id));
                        } else {
                          setSelectedInactive([]);
                        }
                      }}
                      checked={selectedInactive.length === inactiveAccounts.length}
                      aria-label="Select all"
                    />
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Last Login</th>
                  <th scope="col">Days Inactive</th>
                </tr>
              </thead>
              <tbody>
                {inactiveAccounts.map(account => (
                  <tr key={account.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedInactive.includes(account.id)}
                        onChange={() => toggleInactiveSelect(account.id)}
                        aria-label={`Select ${account.full_name}`}
                      />
                    </td>
                    <td>{account.full_name}</td>
                    <td>{account.email}</td>
                    <td>
                      {account.last_login_at
                        ? new Date(account.last_login_at).toLocaleDateString('en-GB')
                        : 'Never'}
                    </td>
                    <td>{account.days_inactive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedInactive.length > 0 && (
              <button
                className="btn-danger"
                onClick={handleBulkDisable}
                disabled={disablingAccounts}
                aria-label={`Disable ${selectedInactive.length} selected accounts`}
              >
                {disablingAccounts ? 'Disabling…' : `Disable ${selectedInactive.length} Account${selectedInactive.length > 1 ? 's' : ''}`}
              </button>
            )}
          </>
        )}
      </section>

      {/* ===== Security Audit Log Section ===== */}
      <section className="admin-security__section" aria-label="Security audit log">
        <h3 className="admin-security__section-title">
          <Activity size={18} aria-hidden="true" /> Security Audit Log
        </h3>
        <div className="admin-security__audit-controls">
          <select
            className="form-select form-select--sm"
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            aria-label="Filter by event type"
          >
            <option value="">All Events</option>
            <option value="login_success">Login Success</option>
            <option value="login_failed">Login Failed</option>
            <option value="account_locked">Account Locked</option>
            <option value="mfa_enabled">MFA Enabled</option>
            <option value="mfa_disabled">MFA Disabled</option>
            <option value="mfa_verified">MFA Verified</option>
            <option value="mfa_failed">MFA Failed</option>
            <option value="backup_code_used">Backup Code Used</option>
            <option value="password_changed">Password Changed</option>
            <option value="session_terminated">Session Terminated</option>
            <option value="security_policy_updated">Policy Updated</option>
          </select>
          <button
            className="btn-secondary btn-secondary--sm"
            onClick={fetchAuditLog}
            disabled={auditLoading}
            aria-label="Load audit log"
          >
            {auditLoading ? 'Loading…' : 'Load Log'}
          </button>
        </div>

        {auditLog.length > 0 && (
          <table className="admin-security__table" aria-label="Security events">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Event</th>
                <th scope="col">User</th>
                <th scope="col">IP</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(event => (
                <tr key={event.id}>
                  <td>
                    {new Date(event.created_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <span className={`security-event-badge security-event-badge--${event.event_type}`}>
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{event.user_name || `User #${event.user_id}`}</td>
                  <td>{event.ip_address || '—'}</td>
                  <td>{event.metadata ? JSON.stringify(event.metadata) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default AdminSecuritySettings;
