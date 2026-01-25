/**
 * VoidStaffOS - Audit Trail Viewer Component
 * Read-only view of system audit trail for administrators.
 *
 * SECURITY NOTICE:
 * - This component is ONLY accessible to Admin role
 * - All data is READ-ONLY - no modification capabilities
 * - Audit trail is tamper-proof evidence
 * - Requires re-authentication before viewing (15-minute window)
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 25/01/2026
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

import { useState, useEffect, useCallback } from 'react';

const AuditTrailViewer = ({ user }) => {
  // Verification state
  const [isVerified, setIsVerified] = useState(false);
  const [verificationExpiry, setVerificationExpiry] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Audit trail state
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    resource_type: '',
    action: '',
    user_id: '',
    start_date: '',
    end_date: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    actions: [],
    resource_types: [],
    users: []
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  });
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [stats, setStats] = useState(null);

  // Security check - only Admin can access
  if (user?.role_name !== 'Admin') {
    return (
      <div className="error-container">
        <h2>Access Denied</h2>
        <p>The Audit Trail is only accessible to System Administrators.</p>
      </div>
    );
  }

  // Check current verification status on mount
  useEffect(() => {
    checkVerificationStatus();
  }, []);

  // Fetch data when verified
  useEffect(() => {
    if (isVerified) {
      fetchFilterOptions();
      fetchStats();
      fetchAuditTrail();
    }
  }, [isVerified]);

  // Refetch when filters or pagination change
  useEffect(() => {
    if (isVerified) {
      fetchAuditTrail();
    }
  }, [filters, pagination.offset, isVerified]);

  // Set up expiry timer
  useEffect(() => {
    if (verificationExpiry) {
      const timeout = setTimeout(() => {
        setIsVerified(false);
        setVerificationExpiry(null);
        setShowPasswordModal(true);
      }, verificationExpiry - Date.now());

      return () => clearTimeout(timeout);
    }
  }, [verificationExpiry]);

  const checkVerificationStatus = async () => {
    setCheckingAccess(true);
    try {
      const response = await fetch('/api/auth/audit-access', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.verified) {
          setIsVerified(true);
          setVerificationExpiry(new Date(data.expiresAt).getTime());
        } else {
          setShowPasswordModal(true);
        }
      } else {
        setShowPasswordModal(true);
      }
    } catch (err) {
      console.error('Failed to check verification status:', err);
      setShowPasswordModal(true);
    } finally {
      setCheckingAccess(false);
    }
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setVerifyError('');

    try {
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok) {
        setIsVerified(true);
        setVerificationExpiry(new Date(data.expiresAt).getTime());
        setShowPasswordModal(false);
        setPassword('');
      } else {
        setVerifyError(data.error || 'Verification failed');
      }
    } catch (err) {
      setVerifyError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleApiError = (response) => {
    // Check if re-authentication is required
    if (response.status === 403) {
      return response.json().then(data => {
        if (data.code === 'AUDIT_REAUTH_REQUIRED' || data.code === 'AUDIT_REAUTH_EXPIRED') {
          setIsVerified(false);
          setVerificationExpiry(null);
          setShowPasswordModal(true);
          return null;
        }
        throw new Error(data.error || 'Access denied');
      });
    }
    if (!response.ok) {
      throw new Error('Request failed');
    }
    return response.json();
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/audit-trail/filters', {
        credentials: 'include'
      });
      const data = await handleApiError(response);
      if (data) {
        setFilterOptions(data);
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/audit-trail/stats', {
        credentials: 'include'
      });
      const data = await handleApiError(response);
      if (data) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchAuditTrail = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.action) params.append('action', filters.action);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', pagination.limit);
      params.append('offset', pagination.offset);

      const response = await fetch(`/api/audit-trail?${params}`, {
        credentials: 'include'
      });

      const data = await handleApiError(response);
      if (data) {
        setEntries(data.audit_trail);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters({
      resource_type: '',
      action: '',
      user_id: '',
      start_date: '',
      end_date: ''
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTimeRemaining = () => {
    if (!verificationExpiry) return '';
    const remaining = Math.max(0, verificationExpiry - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'CREATE': return 'badge-success';
      case 'UPDATE': return 'badge-warning';
      case 'DELETE': return 'badge-danger';
      case 'VIEW_SENSITIVE': return 'badge-info';
      case 'AUDIT_ACCESS_VERIFIED': return 'badge-info';
      case 'AUDIT_ACCESS_DENIED': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  const renderChanges = (changes) => {
    if (!changes) return null;
    return (
      <div className="changes-list">
        {Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
          <div key={field} className="change-item">
            <span className="change-field">{field}:</span>
            <span className="change-old">{JSON.stringify(oldVal)}</span>
            <span className="change-arrow">&rarr;</span>
            <span className="change-new">{JSON.stringify(newVal)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Show loading while checking verification status
  if (checkingAccess) {
    return (
      <div className="audit-trail-viewer">
        <div className="loading">Checking access permissions...</div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="audit-trail-viewer">
      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content verify-modal">
            <div className="modal-header">
              <h3>Re-authentication Required</h3>
            </div>
            <div className="modal-body">
              <div className="security-notice">
                <div className="security-icon">&#128274;</div>
                <p>
                  The Audit Trail contains sensitive information about all system changes.
                  For security purposes, please verify your identity by entering your password.
                </p>
              </div>

              <form onSubmit={handleVerifyPassword}>
                <div className="form-group">
                  <label htmlFor="verify-password">Your Password</label>
                  <input
                    id="verify-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your current password"
                    autoFocus
                    required
                  />
                </div>

                {verifyError && (
                  <div className="verify-error">{verifyError}</div>
                )}

                <div className="verify-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={verifying || !password}
                  >
                    {verifying ? 'Verifying...' : 'Verify & Access Audit Trail'}
                  </button>
                </div>

                <p className="verify-note">
                  Access will be granted for 15 minutes after verification.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}

      {isVerified && (
        <>
          <div className="page-header">
            <div className="header-row">
              <div>
                <h2>Audit Trail</h2>
                <p className="subtitle">Read-only view of all system changes</p>
              </div>
              <div className="session-timer">
                <span className="timer-label">Session expires in:</span>
                <span className="timer-value">{formatTimeRemaining()}</span>
              </div>
            </div>
          </div>

          {/* Statistics Summary */}
          {stats && (
            <div className="stats-summary">
              <div className="stat-card">
                <h4>Last 24 Hours</h4>
                <div className="stat-value">{stats.last_24_hours?.total || 0}</div>
                <div className="stat-breakdown">
                  <span className="stat-create">{stats.last_24_hours?.creates || 0} creates</span>
                  <span className="stat-update">{stats.last_24_hours?.updates || 0} updates</span>
                  <span className="stat-delete">{stats.last_24_hours?.deletes || 0} deletes</span>
                </div>
              </div>
              <div className="stat-card">
                <h4>Unique Users (24h)</h4>
                <div className="stat-value">{stats.last_24_hours?.unique_users || 0}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filters-section">
            <h3>Filters</h3>
            <div className="filters-grid">
              <div className="filter-group">
                <label>Resource Type</label>
                <select
                  name="resource_type"
                  value={filters.resource_type}
                  onChange={handleFilterChange}
                >
                  <option value="">All Resources</option>
                  {filterOptions.resource_types.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Action</label>
                <select
                  name="action"
                  value={filters.action}
                  onChange={handleFilterChange}
                >
                  <option value="">All Actions</option>
                  {filterOptions.actions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>User</label>
                <select
                  name="user_id"
                  value={filters.user_id}
                  onChange={handleFilterChange}
                >
                  <option value="">All Users</option>
                  {filterOptions.users.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name || u.user_email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="filter-group">
                <label>End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="filter-group">
                <button className="btn-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Loading audit trail...</div>
          ) : (
            <>
              {/* Results Count */}
              <div className="results-info">
                Showing {entries.length} of {pagination.total} entries
              </div>

              {/* Audit Trail Table */}
              <div className="table-container">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>User</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => (
                      <tr key={entry.id} onClick={() => setSelectedEntry(entry)}>
                        <td className="timestamp">{formatDate(entry.created_at)}</td>
                        <td>
                          <span className={`badge ${getActionBadgeClass(entry.action)}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td>
                          <div className="resource-info">
                            <span className="resource-type">{entry.resource_type}</span>
                            {entry.resource_id && (
                              <span className="resource-id">#{entry.resource_id}</span>
                            )}
                            {entry.resource_name && (
                              <span className="resource-name">{entry.resource_name}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="user-info">
                            <span className="user-name">{entry.user_full_name || entry.user_email || 'System'}</span>
                            {entry.user_role && (
                              <span className="user-role">{entry.user_role}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {entry.changes && (
                            <span className="changes-preview">
                              {Object.keys(entry.changes).length} field(s) changed
                            </span>
                          )}
                          {entry.reason && (
                            <span className="reason">{entry.reason}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination">
                <button
                  className="btn-secondary"
                  disabled={pagination.offset === 0}
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {Math.floor(pagination.offset / pagination.limit) + 1} of {Math.ceil(pagination.total / pagination.limit) || 1}
                </span>
                <button
                  className="btn-secondary"
                  disabled={!pagination.has_more}
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* Detail Modal */}
          {selectedEntry && (
            <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Audit Entry Details</h3>
                  <button className="close-btn" onClick={() => setSelectedEntry(null)}>&times;</button>
                </div>
                <div className="modal-body">
                  <div className="detail-section">
                    <h4>When</h4>
                    <p>{formatDate(selectedEntry.created_at)}</p>
                  </div>

                  <div className="detail-section">
                    <h4>Who</h4>
                    <p>
                      <strong>User:</strong> {selectedEntry.user_full_name || selectedEntry.user_email || 'System'}<br />
                      <strong>Role:</strong> {selectedEntry.user_role || '-'}<br />
                      <strong>IP Address:</strong> {selectedEntry.ip_address || '-'}<br />
                      <strong>Session:</strong> {selectedEntry.session_id ? '...' + selectedEntry.session_id.slice(-8) : '-'}
                    </p>
                  </div>

                  <div className="detail-section">
                    <h4>What</h4>
                    <p>
                      <strong>Action:</strong> <span className={`badge ${getActionBadgeClass(selectedEntry.action)}`}>{selectedEntry.action}</span><br />
                      <strong>Resource:</strong> {selectedEntry.resource_type} #{selectedEntry.resource_id}<br />
                      <strong>Name:</strong> {selectedEntry.resource_name || '-'}
                    </p>
                  </div>

                  {selectedEntry.reason && (
                    <div className="detail-section">
                      <h4>Reason</h4>
                      <p>{selectedEntry.reason}</p>
                    </div>
                  )}

                  {selectedEntry.changes && (
                    <div className="detail-section">
                      <h4>Changes</h4>
                      {renderChanges(selectedEntry.changes)}
                    </div>
                  )}

                  {selectedEntry.previous_values && (
                    <div className="detail-section">
                      <h4>Before</h4>
                      <pre className="json-display">{JSON.stringify(selectedEntry.previous_values, null, 2)}</pre>
                    </div>
                  )}

                  {selectedEntry.new_values && (
                    <div className="detail-section">
                      <h4>After</h4>
                      <pre className="json-display">{JSON.stringify(selectedEntry.new_values, null, 2)}</pre>
                    </div>
                  )}

                  {selectedEntry.user_agent && (
                    <div className="detail-section">
                      <h4>User Agent</h4>
                      <p className="user-agent">{selectedEntry.user_agent}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .audit-trail-viewer {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .page-header h2 {
    margin: 0 0 8px 0;
    color: #fff;
  }

  .subtitle {
    color: #888;
    margin: 0;
  }

  .session-timer {
    background: #252540;
    padding: 12px 16px;
    border-radius: 8px;
    text-align: center;
  }

  .timer-label {
    display: block;
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .timer-value {
    font-size: 24px;
    font-weight: bold;
    color: #ffa500;
    font-family: monospace;
  }

  .stats-summary {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: #252540;
    border-radius: 8px;
    padding: 16px 24px;
    flex: 1;
  }

  .stat-card h4 {
    margin: 0 0 8px 0;
    color: #888;
    font-size: 12px;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: 32px;
    font-weight: bold;
    color: #7f5af0;
  }

  .stat-breakdown {
    margin-top: 8px;
    font-size: 12px;
  }

  .stat-breakdown span {
    margin-right: 12px;
  }

  .stat-create { color: #2ed573; }
  .stat-update { color: #ffa500; }
  .stat-delete { color: #ff4757; }

  .filters-section {
    background: #252540;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .filters-section h3 {
    margin: 0 0 16px 0;
    color: #fff;
    font-size: 14px;
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    align-items: end;
  }

  .filter-group label {
    display: block;
    color: #888;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .filter-group select,
  .filter-group input {
    width: 100%;
    padding: 8px 12px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
    font-size: 14px;
  }

  .btn-secondary {
    padding: 8px 16px;
    background: #333;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #444;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    padding: 12px 24px;
    background: #7f5af0;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    width: 100%;
  }

  .btn-primary:hover:not(:disabled) {
    background: #9171f8;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .results-info {
    color: #888;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .table-container {
    overflow-x: auto;
  }

  .audit-table {
    width: 100%;
    border-collapse: collapse;
    background: #252540;
    border-radius: 8px;
    overflow: hidden;
  }

  .audit-table th,
  .audit-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #333;
  }

  .audit-table th {
    background: #1a1a2e;
    color: #888;
    font-size: 12px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .audit-table tbody tr {
    cursor: pointer;
    transition: background 0.2s;
  }

  .audit-table tbody tr:hover {
    background: #2a2a4a;
  }

  .timestamp {
    font-family: monospace;
    font-size: 13px;
    color: #aaa;
  }

  .badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-success { background: #2ed573; color: #000; }
  .badge-warning { background: #ffa500; color: #000; }
  .badge-danger { background: #ff4757; color: #fff; }
  .badge-info { background: #17a2b8; color: #fff; }
  .badge-secondary { background: #666; color: #fff; }

  .resource-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .resource-type {
    font-weight: 600;
    color: #fff;
  }

  .resource-id {
    color: #7f5af0;
    font-size: 12px;
  }

  .resource-name {
    color: #888;
    font-size: 12px;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-name {
    color: #fff;
  }

  .user-role {
    color: #888;
    font-size: 12px;
  }

  .changes-preview {
    color: #7f5af0;
    font-size: 12px;
  }

  .reason {
    color: #888;
    font-size: 12px;
    font-style: italic;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
  }

  .page-info {
    color: #888;
    font-size: 14px;
  }

  .error-message {
    background: #ff475733;
    border: 1px solid #ff4757;
    color: #ff4757;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
  }

  .error-container {
    text-align: center;
    padding: 48px;
    color: #ff4757;
  }

  .loading {
    text-align: center;
    padding: 48px;
    color: #888;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: #1a1a2e;
    border-radius: 8px;
    width: 90%;
    max-width: 700px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .verify-modal {
    max-width: 450px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #333;
  }

  .modal-header h3 {
    margin: 0;
    color: #fff;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
  }

  .close-btn:hover {
    color: #fff;
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
  }

  .security-notice {
    text-align: center;
    margin-bottom: 24px;
    padding: 16px;
    background: #252540;
    border-radius: 8px;
  }

  .security-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .security-notice p {
    margin: 0;
    color: #aaa;
    font-size: 14px;
    line-height: 1.6;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    color: #888;
    font-size: 12px;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .form-group input {
    width: 100%;
    padding: 12px 16px;
    background: #252540;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
    font-size: 16px;
  }

  .form-group input:focus {
    outline: none;
    border-color: #7f5af0;
  }

  .verify-error {
    background: #ff475733;
    border: 1px solid #ff4757;
    color: #ff4757;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    text-align: center;
  }

  .verify-actions {
    margin-bottom: 16px;
  }

  .verify-note {
    text-align: center;
    color: #666;
    font-size: 12px;
    margin: 0;
  }

  .detail-section {
    margin-bottom: 20px;
  }

  .detail-section h4 {
    margin: 0 0 8px 0;
    color: #888;
    font-size: 12px;
    text-transform: uppercase;
  }

  .detail-section p {
    margin: 0;
    color: #fff;
    line-height: 1.6;
  }

  .changes-list {
    background: #252540;
    border-radius: 4px;
    padding: 12px;
  }

  .change-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
  }

  .change-item:last-child {
    margin-bottom: 0;
  }

  .change-field {
    color: #7f5af0;
    font-weight: 600;
  }

  .change-old {
    color: #ff4757;
    text-decoration: line-through;
  }

  .change-arrow {
    color: #888;
  }

  .change-new {
    color: #2ed573;
  }

  .json-display {
    background: #252540;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
    color: #aaa;
  }

  .user-agent {
    font-size: 12px;
    color: #666;
    word-break: break-all;
  }
`;

export default AuditTrailViewer;
