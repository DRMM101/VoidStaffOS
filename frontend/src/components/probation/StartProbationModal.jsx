/**
 * HeadOfficeOS - Start Probation Modal
 * Modal to start a new probation period for an employee.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

function StartProbationModal({ onClose, onSuccess }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    employee_id: '',
    candidate_id: '',
    start_date: new Date().toISOString().split('T')[0],
    duration_months: 6
  });

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/candidates', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const candidateList = Array.isArray(data) ? data : (data.candidates || []);
        // Filter to candidates ready for probation (promoted to employee or active)
        setCandidates(candidateList);
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
      setError('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateChange = (candidateId) => {
    const candidate = candidates.find(c => c.id === parseInt(candidateId));
    if (candidate) {
      // Auto-fill start date from candidate's proposed start date
      const startDate = candidate.proposed_start_date
        ? new Date(candidate.proposed_start_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      setFormData({
        ...formData,
        candidate_id: candidateId,
        employee_id: candidate.user_id || '', // If already promoted to user
        start_date: startDate
      });
    } else {
      setFormData({
        ...formData,
        candidate_id: '',
        employee_id: ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.candidate_id) {
      setError('Please select a candidate');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch('/api/probation', {
        method: 'POST',
        body: JSON.stringify({
          candidate_id: formData.candidate_id,
          employee_id: formData.employee_id || null,
          start_date: formData.start_date,
          duration_months: formData.duration_months
        })
      });

      if (response.ok) {
        onSuccess && onSuccess();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to start probation');
      }
    } catch (err) {
      console.error('Error starting probation:', err);
      setError('Failed to start probation');
    } finally {
      setSaving(false);
    }
  };

  const calculateEndDate = () => {
    if (!formData.start_date) return '-';
    const start = new Date(formData.start_date);
    const end = new Date(start);
    end.setMonth(end.getMonth() + formData.duration_months);
    return end.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal start-probation-modal">
        <div className="modal-header">
          <h3>Start New Probation</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Pre-Colleague / Candidate *</label>
            {loading ? (
              <div className="loading-small">Loading candidates...</div>
            ) : (
              <select
                value={formData.candidate_id}
                onChange={(e) => handleCandidateChange(e.target.value)}
                required
              >
                <option value="">Select candidate...</option>
                {candidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name}
                    {candidate.proposed_start_date && ` (Start: ${new Date(candidate.proposed_start_date).toLocaleDateString('en-GB')})`}
                  </option>
                ))}
              </select>
            )}
            {candidates.length === 0 && !loading && (
              <p className="help-text">No candidates found. Add candidates in the Pre-Colleague section first.</p>
            )}
          </div>

          <div className="form-group">
            <label>Start Date *</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Duration *</label>
            <select
              value={formData.duration_months}
              onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) })}
              required
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months (standard)</option>
              <option value={9}>9 months</option>
              <option value={12}>12 months</option>
            </select>
          </div>

          <div className="calculated-end-date">
            <span className="label">Calculated End Date:</span>
            <span className="date">{calculateEndDate()}</span>
          </div>

          <div className="info-notice">
            <p>
              <strong>Note:</strong> This will automatically create review milestones at:
            </p>
            <ul>
              {formData.duration_months >= 1 && <li>1 month</li>}
              {formData.duration_months >= 3 && <li>3 months</li>}
              {formData.duration_months >= 6 && <li>6 months</li>}
              <li>Final review (2 weeks before end)</li>
            </ul>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || loading}>
              {saving ? 'Starting...' : 'Start Probation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StartProbationModal;
