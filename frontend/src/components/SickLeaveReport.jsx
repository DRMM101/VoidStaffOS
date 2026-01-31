/**
 * VoidStaffOS - Sick Leave Report Component
 * Employee self-service form for reporting sick leave.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 30/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: LeaveOS
 */

import { useState } from 'react';
import { apiFetch } from '../utils/api';

const SICK_REASONS = [
  { value: 'illness', label: 'Illness (cold, flu, etc.)' },
  { value: 'medical_appointment', label: 'Medical Appointment' },
  { value: 'injury', label: 'Injury' },
  { value: 'mental_health', label: 'Mental Health Day' },
  { value: 'hospital', label: 'Hospital Visit/Stay' },
  { value: 'covid', label: 'COVID-19' },
  { value: 'other', label: 'Other' }
];

function SickLeaveReport({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    sick_reason: 'illness',
    sick_notes: '',
    is_ongoing: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch('/api/sick-leave/report', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          end_date: formData.is_ongoing ? null : formData.end_date
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      setSuccess(data);
      if (onSubmit) onSubmit(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = () => {
    if (formData.is_ongoing || !formData.end_date) return null;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diffTime = end - start;
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  const days = calculateDays();
  const fitNoteRequired = days && days > 7;

  if (success) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-medium">
          <div className="modal-header">
            <h3>Sick Leave Reported</h3>
            <button onClick={onClose} className="close-btn">&times;</button>
          </div>

          <div className="success-message" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h4>Your sick leave has been recorded</h4>
            <p style={{ color: '#424242', marginTop: '12px' }}>
              Your manager has been notified. Focus on getting better.
            </p>

            {success.fit_note_required && (
              <div className="warning-box" style={{ marginTop: '20px', padding: '16px', background: '#fff3cd', borderRadius: '8px', color: '#5d4200' }}>
                <strong>Fit Note Required</strong>
                <p style={{ margin: '8px 0 0' }}>
                  {success.fit_note_message}
                </p>
              </div>
            )}

            {formData.is_ongoing && (
              <p style={{ color: '#424242', marginTop: '16px', fontSize: '14px' }}>
                Remember to update your sick leave when you're ready to return.
              </p>
            )}
          </div>

          <div className="form-actions">
            <button onClick={onClose} className="primary-btn">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-medium">
        <div className="modal-header">
          <h3>Report Sick Leave</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="info-banner" style={{ background: '#e3f2fd', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#0d47a1' }}>
            <strong>No approval needed</strong> — your manager will be notified automatically.
            Focus on your recovery.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="start_date">First Day of Sickness</label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
              required
            />
            <small className="form-hint">You can report sick leave up to 7 days in the past</small>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_ongoing"
                checked={formData.is_ongoing}
                onChange={handleChange}
              />
              <span>I'm still off sick (don't know return date yet)</span>
            </label>
          </div>

          {!formData.is_ongoing && (
            <div className="form-group">
              <label htmlFor="end_date">Last Day of Sickness</label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                min={formData.start_date}
                required={!formData.is_ongoing}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="sick_reason">Reason (optional)</label>
            <select
              id="sick_reason"
              name="sick_reason"
              value={formData.sick_reason}
              onChange={handleChange}
            >
              {SICK_REASONS.map(reason => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
            <small className="form-hint">This helps us track absence patterns and support you</small>
          </div>

          <div className="form-group">
            <label htmlFor="sick_notes">Additional Notes (optional)</label>
            <textarea
              id="sick_notes"
              name="sick_notes"
              value={formData.sick_notes}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional information you'd like to share..."
            />
          </div>

          {days && (
            <div className="leave-preview" style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '16px', color: '#212121' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Duration:</span>
                <strong>{days} day{days !== 1 ? 's' : ''}</strong>
              </div>

              {fitNoteRequired && (
                <div className="warning-box" style={{ marginTop: '12px', padding: '12px', background: '#fff3cd', borderRadius: '4px', color: '#5d4200' }}>
                  <strong>⚠️ Fit Note Required</strong>
                  <p style={{ margin: '8px 0 0', fontSize: '14px' }}>
                    UK law requires a GP fit note for absences over 7 days.
                    You can upload this after submitting.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Report Sick Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SickLeaveReport;
