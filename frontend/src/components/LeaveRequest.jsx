/**
 * VoidStaffOS - Leave Request Component
 * Form for submitting leave requests.
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
import { apiFetch } from '../utils/api';

function LeaveRequest({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    leave_start_date: '',
    leave_end_date: '',
    leave_type: 'full_day',
    notes: ''
  });
  const [balance, setBalance] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    if (formData.leave_start_date && formData.leave_end_date) {
      calculatePreview();
    } else {
      setPreview(null);
    }
  }, [formData.leave_start_date, formData.leave_end_date, formData.leave_type]);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/leave/my-balance', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setBalance(data.balance);
      }
    } catch (err) {
      console.error('Failed to fetch balance');
    }
  };

  const calculateWorkingDays = (startDate, endDate) => {
    let workingDays = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    return workingDays;
  };

  const calculatePreview = () => {
    const { leave_start_date, leave_end_date, leave_type } = formData;
    const start = new Date(leave_start_date);
    const end = new Date(leave_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      setPreview({ error: 'Start date cannot be in the past' });
      return;
    }

    if (end < start) {
      setPreview({ error: 'End date must be on or after start date' });
      return;
    }

    let totalDays;
    const workingDays = calculateWorkingDays(leave_start_date, leave_end_date);

    if (leave_type === 'half_day_am' || leave_type === 'half_day_pm') {
      if (leave_start_date !== leave_end_date) {
        setPreview({ error: 'Half day requests must have same start and end date' });
        return;
      }
      totalDays = 0.5;
    } else {
      totalDays = workingDays;
    }

    if (totalDays === 0) {
      setPreview({ error: 'No working days in the selected range (weekends excluded)' });
      return;
    }

    // Calculate notice
    const requestDate = new Date();
    const noticeDays = Math.floor((start - requestDate) / (1000 * 60 * 60 * 24));
    const requiredNoticeDays = totalDays >= 5 ? 30 : Math.ceil(totalDays) * 2;
    const meetsNotice = noticeDays >= requiredNoticeDays;

    setPreview({
      totalDays,
      workingDays,
      noticeDays,
      requiredNoticeDays,
      meetsNotice,
      insufficientBalance: balance && totalDays > balance.remaining
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch('/api/leave/request', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      if (onSubmit) onSubmit(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-medium">
        <div className="modal-header">
          <h3>Request Leave</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {balance && (
          <div className="leave-balance-summary">
            <div className="balance-item">
              <span className="balance-label">Annual Entitlement</span>
              <span className="balance-value">{balance.entitlement} days</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">Used</span>
              <span className="balance-value used">{balance.used} days</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">Pending</span>
              <span className="balance-value pending">{balance.pending} days</span>
            </div>
            <div className="balance-item highlight">
              <span className="balance-label">Remaining</span>
              <span className="balance-value remaining">{balance.remaining} days</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="leave_start_date">Start Date</label>
              <input
                type="date"
                id="leave_start_date"
                name="leave_start_date"
                value={formData.leave_start_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="leave_end_date">End Date</label>
              <input
                type="date"
                id="leave_end_date"
                name="leave_end_date"
                value={formData.leave_end_date}
                onChange={handleChange}
                min={formData.leave_start_date || new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="leave_type">Leave Type</label>
            <select
              id="leave_type"
              name="leave_type"
              value={formData.leave_type}
              onChange={handleChange}
            >
              <option value="full_day">Full Day(s)</option>
              <option value="half_day_am">Half Day - Morning</option>
              <option value="half_day_pm">Half Day - Afternoon</option>
            </select>
          </div>

          {preview && !preview.error && (
            <div className="leave-preview">
              <h4>Request Summary</h4>
              <div className="preview-grid">
                <div className="preview-item">
                  <span className="preview-label">Days Requested</span>
                  <span className="preview-value">{preview.totalDays}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Working Days</span>
                  <span className="preview-value">{preview.workingDays}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Notice Given</span>
                  <span className={`preview-value ${preview.meetsNotice ? 'good' : 'warning'}`}>
                    {preview.noticeDays} days
                  </span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Notice Required</span>
                  <span className="preview-value">{preview.requiredNoticeDays} days</span>
                </div>
              </div>

              {!preview.meetsNotice && (
                <div className="notice-warning">
                  <span className="warning-icon">&#9888;</span>
                  <span>Insufficient notice period. Policy requires {preview.requiredNoticeDays} days notice for {preview.totalDays} days of leave.</span>
                </div>
              )}

              {preview.insufficientBalance && (
                <div className="balance-warning">
                  <span className="warning-icon">&#9888;</span>
                  <span>Insufficient leave balance. You have {balance?.remaining} days remaining.</span>
                </div>
              )}
            </div>
          )}

          {preview?.error && (
            <div className="error-message">{preview.error}</div>
          )}

          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional information..."
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || preview?.error || preview?.insufficientBalance}
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeaveRequest;
