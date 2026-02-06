/**
 * HeadOfficeOS - Probation Outcome Modal
 * Modal to record pass/fail outcome for probation.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState } from 'react';
import { apiFetch } from '../../utils/api';

function ProbationOutcomeModal({ probation, onClose, onSuccess }) {
  const [outcome, setOutcome] = useState('passed');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmFail, setConfirmFail] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Require confirmation for fail
    if (outcome === 'failed' && !confirmFail) {
      setConfirmFail(true);
      return;
    }

    if (!outcomeNotes.trim()) {
      setError('Please provide notes for the outcome');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/probation/${probation.id}/outcome`, {
        method: 'PUT',
        body: JSON.stringify({
          outcome,
          outcome_notes: outcomeNotes
        })
      });

      if (response.ok) {
        onSuccess && onSuccess();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to record outcome');
      }
    } catch (err) {
      console.error('Error recording outcome:', err);
      setError('Failed to record outcome');
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

  return (
    <div className="modal-overlay">
      <div className="modal outcome-modal">
        <div className="modal-header">
          <h3>Record Probation Outcome</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="outcome-info">
          <p><strong>Employee:</strong> {probation.employee_name}</p>
          <p><strong>Probation Period:</strong> {formatDate(probation.start_date)} - {formatDate(probation.end_date)}</p>
          <p><strong>Duration:</strong> {probation.duration_months} months {probation.extended && `(extended by ${probation.extension_weeks} weeks)`}</p>
          <p><strong>Reviews Completed:</strong> {probation.completed_reviews || 0}/{probation.total_reviews || 0}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {confirmFail && (
          <div className="confirm-fail-warning">
            <strong>Warning:</strong> You are about to fail this employee's probation. This action cannot be undone and will have HR implications.
            <p>Click "Record Outcome" again to confirm.</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Outcome *</label>
            <div className="outcome-buttons">
              <button
                type="button"
                className={`outcome-btn passed ${outcome === 'passed' ? 'selected' : ''}`}
                onClick={() => {
                  setOutcome('passed');
                  setConfirmFail(false);
                }}
              >
                <span className="outcome-icon">✓</span>
                <span className="outcome-label">Pass</span>
                <span className="outcome-desc">Employee has successfully completed probation</span>
              </button>
              <button
                type="button"
                className={`outcome-btn failed ${outcome === 'failed' ? 'selected' : ''}`}
                onClick={() => {
                  setOutcome('failed');
                  setConfirmFail(false);
                }}
              >
                <span className="outcome-icon">✗</span>
                <span className="outcome-label">Fail</span>
                <span className="outcome-desc">Employee has not met probation requirements</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Outcome Notes *</label>
            <textarea
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              rows="5"
              placeholder={outcome === 'passed'
                ? 'Summarize the employee\'s performance and achievements during probation...'
                : 'Document the reasons for failing probation and any support that was provided...'
              }
              required
            />
            <p className="form-help">
              {outcome === 'failed' && 'Please ensure all performance concerns have been documented and communicated to the employee prior to recording this outcome.'}
            </p>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-primary ${outcome === 'failed' ? 'btn-danger' : ''}`}
              disabled={saving}
            >
              {saving ? 'Recording...' : confirmFail ? 'Confirm Fail' : 'Record Outcome'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProbationOutcomeModal;
