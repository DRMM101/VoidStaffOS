// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Data Deletion Request Modal
 * HR/Admin creates a GDPR deletion request on behalf of an employee.
 * Requires employee selection, reason, and confirmation before submission.
 */

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';

function DataDeletionModal({ user, onClose, onSuccess }) {
  // Form state
  const [employeeId, setEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Action state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Submit the deletion request
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate inputs
    if (!employeeId || !employeeId.trim()) {
      setError('Employee ID is required.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required for deletion requests.');
      return;
    }
    if (!confirmed) {
      setError('Please confirm you have verified this deletion request.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post('/gdpr/deletion-request', {
        employee_id: parseInt(employeeId),
        reason: reason.trim()
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to create deletion request:', err);
      setError(err.message || 'Failed to create deletion request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Create deletion request">
      <div className="modal-dialog modal--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>Create Data Deletion Request</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Warning box */}
        <div className="gdpr-deletion__warning" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>Permanent data deletion</strong>
            <p>
              This creates a request to permanently delete an employee's personal data
              from VoidStaffOS. Once approved and executed, this action cannot be undone.
              Ensure you have complied with all legal retention requirements before proceeding.
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && <div className="error-banner" role="alert">{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="opportunity-form__grid">
            {/* Employee ID */}
            <div className="opportunity-form__field opportunity-form__field--full">
              <label htmlFor="del-employee-id">Employee ID *</label>
              <input
                id="del-employee-id"
                type="number"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Enter the employee's user ID"
                required
                min="1"
              />
            </div>

            {/* Reason */}
            <div className="opportunity-form__field opportunity-form__field--full">
              <label htmlFor="del-reason">Reason for Deletion *</label>
              <textarea
                id="del-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this employee's data should be deleted (e.g. employee request, retention period expired, etc.)"
                rows={4}
                required
                maxLength={1000}
              />
            </div>

            {/* Confirmation checkbox */}
            <div className="opportunity-form__field opportunity-form__field--full">
              <label className="gdpr-deletion__confirm-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I confirm this deletion request has been verified and complies with
                our data retention policy and UK GDPR requirements.
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="opportunity-form__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={saving || !confirmed || !reason.trim() || !employeeId}
            >
              {saving ? 'Creating…' : 'Create Deletion Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DataDeletionModal;
