/**
 * VoidStaffOS - Offer Form Component
 * Create job offers for candidates.
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
import './OfferForm.css';

export default function OfferForm({ candidateId, candidate, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    offer_salary: candidate?.proposed_salary || '',
    offer_start_date: candidate?.proposed_start_date || '',
    offer_expiry_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/pipeline/candidates/${candidateId}/offer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to make offer');
      }

      onSubmit();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Calculate default expiry (2 weeks from today)
  const getDefaultExpiry = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="offer-overlay" onClick={onClose}>
      <div className="offer-modal" onClick={e => e.stopPropagation()}>
        <div className="offer-header">
          <h3>Make Offer</h3>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        <div className="candidate-summary">
          <p><strong>Candidate:</strong> {candidate?.full_name}</p>
          <p><strong>Role:</strong> {candidate?.proposed_role_name || 'Not specified'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Annual Salary (GBP)</label>
            <div className="salary-input">
              <span className="currency">£</span>
              <input
                type="number"
                value={formData.offer_salary}
                onChange={e => setFormData({ ...formData, offer_salary: e.target.value })}
                placeholder="e.g., 45000"
                required
                min="0"
                step="100"
              />
            </div>
            {candidate?.proposed_salary && (
              <span className="helper-text">
                Proposed: £{Number(candidate.proposed_salary).toLocaleString()}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={formData.offer_start_date}
              onChange={e => setFormData({ ...formData, offer_start_date: e.target.value })}
              required
              min={new Date().toISOString().split('T')[0]}
            />
            {candidate?.proposed_start_date && (
              <span className="helper-text">
                Proposed: {new Date(candidate.proposed_start_date).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Offer Expiry Date</label>
            <input
              type="date"
              value={formData.offer_expiry_date}
              onChange={e => setFormData({ ...formData, offer_expiry_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              placeholder={getDefaultExpiry()}
            />
            <span className="helper-text">
              Recommended: 2 weeks from today
            </span>
          </div>

          <div className="offer-summary">
            <h4>Offer Summary</h4>
            <div className="summary-item">
              <span>Role:</span>
              <span>{candidate?.proposed_role_name || 'TBC'}</span>
            </div>
            <div className="summary-item">
              <span>Salary:</span>
              <span>£{Number(formData.offer_salary || 0).toLocaleString()} per annum</span>
            </div>
            <div className="summary-item">
              <span>Start Date:</span>
              <span>{formData.offer_start_date ? new Date(formData.offer_start_date).toLocaleDateString() : 'TBC'}</span>
            </div>
            <div className="summary-item">
              <span>Hours:</span>
              <span>{candidate?.proposed_hours || 40} hours/week</span>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
