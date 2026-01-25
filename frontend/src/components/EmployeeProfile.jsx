/**
 * VoidStaffOS - Employee Profile Component
 * Displays detailed employee information.
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

import { useState, useEffect } from 'react';

function EmployeeProfile({ employeeId, user, onClose, onAdopt, onAssignManager, onTransfer }) {
  const [profile, setProfile] = useState(null);
  const [managers, setManagers] = useState([]);
  const [transferTargets, setTransferTargets] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedTransferTarget, setSelectedTransferTarget] = useState('');
  const [transferOrphan, setTransferOrphan] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager' || isAdmin;

  // Tier display helper
  const getTierDisplay = (tier) => {
    if (tier === null) return 'Admin';
    const tierNames = {
      1: 'Tier 1 - Executive',
      2: 'Tier 2 - Senior',
      3: 'Tier 3 - Mid-Level',
      4: 'Tier 4 - Junior',
      5: 'Tier 5 - Entry Level'
    };
    return tierNames[tier] || `Tier ${tier}`;
  };

  useEffect(() => {
    fetchProfile();
    fetchLeaveBalance();
    if (isManager) {
      fetchManagers();
    }
  }, [employeeId]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/users/${employeeId}/profile`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setProfile(data.profile);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await fetch(`/api/leave/balance/${employeeId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setLeaveBalance(data.balance);
      }
    } catch (err) {
      console.error('Failed to fetch leave balance');
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/users/managers', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setManagers(data.managers);
      }
    } catch (err) {
      console.error('Failed to fetch managers');
    }
  };

  const fetchTransferTargets = async () => {
    try {
      const response = await fetch(`/api/users/${employeeId}/transfer-targets`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setTransferTargets(data.eligible_managers);
      }
    } catch (err) {
      console.error('Failed to fetch transfer targets');
    }
  };

  const handleTransfer = async () => {
    if (!transferOrphan && !selectedTransferTarget) {
      setError('Please select a new manager or choose to orphan');
      return;
    }

    setTransferring(true);
    try {
      const body = transferOrphan
        ? { orphan: true }
        : { new_manager_id: parseInt(selectedTransferTarget) };

      const response = await fetch(`/api/users/${employeeId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (response.ok) {
        setShowTransferModal(false);
        setSelectedTransferTarget('');
        setTransferOrphan(false);
        fetchProfile();
        if (onTransfer) onTransfer();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to transfer employee');
    } finally {
      setTransferring(false);
    }
  };

  const openTransferModal = () => {
    fetchTransferTargets();
    setShowTransferModal(true);
  };

  const handleAdopt = async () => {
    try {
      const response = await fetch(`/api/users/adopt-employee/${employeeId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        fetchProfile();
        if (onAdopt) onAdopt();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to adopt employee');
    }
  };

  const handleAssignManager = async () => {
    if (!selectedManager && !isAdmin) {
      setError('Please select a manager');
      return;
    }

    setAssigning(true);
    try {
      const response = await fetch(`/api/users/${employeeId}/assign-manager`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ manager_id: selectedManager || null })
      });
      const data = await response.json();
      if (response.ok) {
        setShowAssignModal(false);
        setSelectedManager('');
        fetchProfile();
        if (onAssignManager) onAssignManager();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to assign manager');
    } finally {
      setAssigning(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="error-message">{error || 'Profile not found'}</div>
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>
    );
  }

  // Can adopt if: manager/admin, no current manager, not self, and employee is lower tier
  const userTier = user.tier;
  const canAdopt = isManager && !profile.has_manager && profile.id !== user.id &&
    (isAdmin || (profile.tier !== null && userTier !== null && profile.tier > userTier));
  const canAssignManager = isAdmin && profile.id !== user.id;
  // Can transfer if: admin, or current manager of this employee
  const canTransfer = profile.id !== user.id && (isAdmin || profile.manager?.id === user.id);

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h3>Employee Profile</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="profile-content">
          {/* Basic Info */}
          <div className="profile-section">
            <div className="profile-header">
              <div className="profile-avatar">
                {profile.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="profile-name-section">
                <div className="name-tier-row">
                  <h2>{profile.full_name}</h2>
                  <span className={`tier-badge tier-${profile.tier || 'admin'} prominent`}>
                    {getTierDisplay(profile.tier)}
                  </span>
                </div>
                <span className="employee-number">{profile.employee_number}</span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="profile-grid">
            <div className="profile-field">
              <label>Email</label>
              <span>{profile.email}</span>
            </div>
            <div className="profile-field">
              <label>Role</label>
              <span className="role-badge">{profile.role_name}</span>
            </div>
            <div className="profile-field">
              <label>Tier</label>
              <span className={`tier-badge tier-${profile.tier || 'admin'}`}>{getTierDisplay(profile.tier)}</span>
            </div>
            <div className="profile-field">
              <label>Employee Number</label>
              <span>{profile.employee_number || '-'}</span>
            </div>
            <div className="profile-field">
              <label>Status</label>
              <span className={`status-badge ${profile.employment_status}`}>
                {profile.employment_status}
              </span>
            </div>
            <div className="profile-field">
              <label>Start Date</label>
              <span>{formatDate(profile.start_date)}</span>
            </div>
            <div className="profile-field">
              <label>Tenure</label>
              <span>{profile.tenure?.display || '-'}</span>
            </div>
          </div>

          {/* Leave Balance Section */}
          {leaveBalance && (
            <div className="profile-section leave-section">
              <h4>Annual Leave</h4>
              <div className="leave-balance-grid">
                <div className="leave-stat">
                  <span className="leave-value">{leaveBalance.remaining}</span>
                  <span className="leave-label">Days Remaining</span>
                </div>
                <div className="leave-stat secondary">
                  <span className="leave-value">{leaveBalance.used}</span>
                  <span className="leave-label">Used</span>
                </div>
                <div className="leave-stat secondary">
                  <span className="leave-value">{leaveBalance.pending}</span>
                  <span className="leave-label">Pending</span>
                </div>
                <div className="leave-stat secondary">
                  <span className="leave-value">{leaveBalance.entitlement}</span>
                  <span className="leave-label">Entitlement</span>
                </div>
              </div>
            </div>
          )}

          {/* Manager Section */}
          <div className="profile-section manager-section">
            <h4>Line Manager</h4>
            {profile.manager ? (
              <div className="manager-card">
                <div className="manager-avatar">
                  {profile.manager.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="manager-details">
                  <div className="manager-name">{profile.manager.name}</div>
                  <div className="manager-info">
                    <span className="manager-email">{profile.manager.email}</span>
                    {profile.manager.phone && (
                      <span className="manager-phone">{profile.manager.phone}</span>
                    )}
                  </div>
                  {profile.manager.employee_number && (
                    <div className="manager-emp-num">{profile.manager.employee_number}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="no-manager-warning">
                <span className="warning-icon">&#9888;</span>
                <span>No manager assigned</span>
              </div>
            )}

            {/* Manager Actions */}
            <div className="manager-actions">
              {canAdopt && (
                <button onClick={handleAdopt} className="adopt-btn">
                  Adopt as Direct Report
                </button>
              )}
              {canAssignManager && (
                <button onClick={() => setShowAssignModal(true)} className="assign-btn">
                  {profile.manager ? 'Change Manager' : 'Assign Manager'}
                </button>
              )}
              {canTransfer && profile.has_manager && (
                <button onClick={openTransferModal} className="transfer-btn">
                  Transfer Employee
                </button>
              )}
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button onClick={onClose} className="cancel-btn">Close</button>
          </div>
        </div>

        {/* Assign Manager Modal */}
        {showAssignModal && (
          <div className="modal-overlay inner-modal">
            <div className="modal-content modal-small">
              <div className="modal-header">
                <h3>Assign Manager</h3>
                <button onClick={() => setShowAssignModal(false)} className="close-btn">&times;</button>
              </div>
              <div className="form-group">
                <label>Select Manager</label>
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                >
                  <option value="">Remove manager</option>
                  {managers.filter(m => m.id !== profile.id).map(mgr => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.full_name} ({mgr.role_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button onClick={() => setShowAssignModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={handleAssignManager} disabled={assigning}>
                  {assigning ? 'Assigning...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Employee Modal */}
        {showTransferModal && (
          <div className="modal-overlay inner-modal">
            <div className="modal-content modal-small">
              <div className="modal-header">
                <h3>Transfer Employee</h3>
                <button onClick={() => setShowTransferModal(false)} className="close-btn">&times;</button>
              </div>
              <p className="transfer-info">
                Transfer {profile.full_name} to a new manager or remove their current manager.
              </p>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={transferOrphan}
                    onChange={(e) => {
                      setTransferOrphan(e.target.checked);
                      if (e.target.checked) setSelectedTransferTarget('');
                    }}
                  />
                  {' '}Orphan employee (remove manager)
                </label>
              </div>
              {!transferOrphan && (
                <div className="form-group">
                  <label>Transfer to Manager</label>
                  <select
                    value={selectedTransferTarget}
                    onChange={(e) => setSelectedTransferTarget(e.target.value)}
                  >
                    <option value="">Select a manager...</option>
                    {transferTargets.filter(m => m.id !== profile.manager?.id).map(mgr => (
                      <option key={mgr.id} value={mgr.id}>
                        {mgr.full_name} (T{mgr.tier || 'Admin'} - {mgr.role_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-actions">
                <button onClick={() => setShowTransferModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={transferring || (!transferOrphan && !selectedTransferTarget)}
                  className="transfer-btn"
                >
                  {transferring ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeProfile;
