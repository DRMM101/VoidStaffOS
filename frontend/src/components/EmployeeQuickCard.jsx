// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — EmployeeQuickCard Component
 * Overlay modal showing employee details from an org chart node click.
 * Allows manager reassignment (Admin/Manager) and profile navigation.
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../utils/api';

function EmployeeQuickCard({ employee, onClose, onNavigate, onRefresh, isAdmin, isManager }) {
  // Manager reassignment state
  const [managers, setManagers] = useState([]);
  const [showReassign, setShowReassign] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available managers when reassign panel is opened
  useEffect(() => {
    if (!showReassign) return;
    const fetchManagers = async () => {
      try {
        const data = await api.get('/users/managers');
        // Filter out the employee themselves from manager options
        setManagers((data.managers || []).filter(m => m.id !== employee.id));
      } catch (err) {
        console.error('Failed to fetch managers:', err);
        setError('Failed to load managers list');
      }
    };
    fetchManagers();
  }, [showReassign, employee.id]);

  /** Submit manager reassignment */
  const handleReassign = async () => {
    if (!selectedManagerId) return;
    setReassigning(true);
    setError(null);
    try {
      await api.put(`/users/${employee.id}/assign-manager`, {
        manager_id: parseInt(selectedManagerId)
      });
      // Refresh the org chart tree and close the card
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Reassign manager error:', err);
      setError(err.message || 'Failed to reassign manager');
    } finally {
      setReassigning(false);
    }
  };

  /** Navigate to the employees page to view full profile */
  const handleViewProfile = () => {
    if (onNavigate) onNavigate('employees');
    onClose();
  };

  // Determine tier display label
  const tierLabel = employee.tier === null || employee.tier === undefined
    ? 'Admin'
    : `Tier ${employee.tier}`;

  return (
    // Overlay backdrop — click outside to close
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${employee.full_name} details`}>
      <div className="modal-dialog quick-card" onClick={(e) => e.stopPropagation()}>
        {/* Header with close button */}
        <div className="modal-dialog__header">
          <h3>{employee.full_name}</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Employee details grid */}
        <div className="quick-card__details">
          <div className="quick-card__row">
            <span className="quick-card__label">Role</span>
            <span className="quick-card__value">{employee.role_name || 'Employee'}</span>
          </div>
          <div className="quick-card__row">
            <span className="quick-card__label">Email</span>
            <span className="quick-card__value">{employee.email}</span>
          </div>
          {employee.employee_number && (
            <div className="quick-card__row">
              <span className="quick-card__label">Employee #</span>
              <span className="quick-card__value">{employee.employee_number}</span>
            </div>
          )}
          <div className="quick-card__row">
            <span className="quick-card__label">Tier</span>
            <span className="quick-card__value">{tierLabel}</span>
          </div>
          <div className="quick-card__row">
            <span className="quick-card__label">Direct Reports</span>
            <span className="quick-card__value">{employee.direct_reports || 0}</span>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">&times;</button>
          </div>
        )}

        {/* Reassign manager panel (Admin/Manager only) */}
        {showReassign && (isAdmin || isManager) && (
          <div className="quick-card__reassign">
            <label htmlFor="reassign-manager" className="quick-card__label">New Manager</label>
            <select
              id="reassign-manager"
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              aria-label="Select new manager"
            >
              <option value="">-- Select manager --</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role_name})
                </option>
              ))}
            </select>
            <div className="quick-card__reassign-actions">
              <button
                className="btn-primary"
                onClick={handleReassign}
                disabled={!selectedManagerId || reassigning}
              >
                {reassigning ? 'Reassigning…' : 'Confirm'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowReassign(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="modal-dialog__footer">
          <button className="btn-secondary" onClick={handleViewProfile}>
            View Profile
          </button>
          {(isAdmin || isManager) && !showReassign && (
            <button className="btn-primary" onClick={() => setShowReassign(true)}>
              Reassign Manager
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeQuickCard;
