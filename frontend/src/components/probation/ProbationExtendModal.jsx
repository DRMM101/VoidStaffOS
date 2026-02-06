/**
 * HeadOfficeOS - Probation Extend Modal
 * Modal to extend a probation period.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState } from 'react';
import { apiFetch } from '../../utils/api';

function ProbationExtendModal({ probation, onClose, onSuccess }) {
  const [extensionWeeks, setExtensionWeeks] = useState(4);
  const [extensionReason, setExtensionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!extensionReason.trim()) {
      setError('Please provide a reason for the extension');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/probation/${probation.id}/extend`, {
        method: 'PUT',
        body: JSON.stringify({
          extension_weeks: extensionWeeks,
          extension_reason: extensionReason
        })
      });

      if (response.ok) {
        onSuccess && onSuccess();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to extend probation');
      }
    } catch (err) {
      console.error('Error extending probation:', err);
      setError('Failed to extend probation');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateNewEndDate = () => {
    const currentEnd = new Date(probation.end_date);
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + (extensionWeeks * 7));
    return formatDate(newEnd);
  };

  return (
    <div className="modal-overlay">
      <div className="modal extend-modal">
        <div className="modal-header">
          <h3>Extend Probation</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="extend-info">
          <p><strong>Employee:</strong> {probation.employee_name}</p>
          <p><strong>Current End Date:</strong> {formatDate(probation.end_date)}</p>
          {probation.extended && (
            <p className="already-extended">
              <strong>Note:</strong> This probation has already been extended by {probation.extension_weeks} weeks.
            </p>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Extension Period (Weeks) *</label>
            <select
              value={extensionWeeks}
              onChange={(e) => setExtensionWeeks(parseInt(e.target.value))}
              required
            >
              <option value={1}>1 week</option>
              <option value={2}>2 weeks</option>
              <option value={4}>4 weeks (1 month)</option>
              <option value={6}>6 weeks</option>
              <option value={8}>8 weeks (2 months)</option>
              <option value={12}>12 weeks (3 months)</option>
            </select>
          </div>

          <div className="new-end-date">
            <span className="label">New End Date:</span>
            <span className="date">{calculateNewEndDate()}</span>
          </div>

          <div className="form-group">
            <label>Reason for Extension *</label>
            <textarea
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              rows="4"
              placeholder="Explain why the probation is being extended..."
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Extending...' : 'Extend Probation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProbationExtendModal;
