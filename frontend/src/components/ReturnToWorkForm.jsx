/**
 * HeadOfficeOS - Return to Work Interview Form
 * Wellbeing-focused RTW conversation form for managers.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 30/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: LeaveOS
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function ReturnToWorkForm({ leaveRequestId, employeeName, onClose, onComplete }) {
  const [rtw, setRtw] = useState(null);
  const [formData, setFormData] = useState({
    feeling_ready: null,
    ready_notes: '',
    ongoing_concerns: '',
    workplace_adjustments: '',
    support_required: '',
    wellbeing_notes: '',
    follow_up_required: false,
    follow_up_date: '',
    follow_up_notes: '',
    oh_referral_recommended: false,
    oh_referral_reason: '',
    manager_notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    initializeRTW();
  }, [leaveRequestId]);

  const initializeRTW = async () => {
    try {
      // Create or get existing RTW interview
      const response = await apiFetch('/api/sick-leave/rtw', {
        method: 'POST',
        body: JSON.stringify({ leave_request_id: leaveRequestId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      setRtw(data.rtw_interview);

      // If RTW already has data, populate form
      if (data.existing && data.rtw_interview) {
        const r = data.rtw_interview;
        setFormData({
          feeling_ready: r.feeling_ready,
          ready_notes: r.ready_notes || '',
          ongoing_concerns: r.ongoing_concerns || '',
          workplace_adjustments: r.workplace_adjustments || '',
          support_required: r.support_required || '',
          wellbeing_notes: r.wellbeing_notes || '',
          follow_up_required: r.follow_up_required || false,
          follow_up_date: r.follow_up_date || '',
          follow_up_notes: r.follow_up_notes || '',
          oh_referral_recommended: r.oh_referral_recommended || false,
          oh_referral_reason: r.oh_referral_reason || '',
          manager_notes: r.manager_notes || ''
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRadioChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/sick-leave/rtw/${rtw.id}/complete`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      if (onComplete) onComplete(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          <div className="loading">Loading RTW interview...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h3>Return to Work Conversation</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="rtw-intro" style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', marginBottom: '20px', color: '#1b5e20' }}>
          <p style={{ margin: 0 }}>
            <strong>Employee:</strong> {employeeName || 'Employee'}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#2e7d32' }}>
            This is a supportive wellbeing conversation to help ensure a smooth return to work.
            It is <strong>not</strong> a disciplinary process.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="rtw-progress" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          {['Readiness', 'Support', 'Follow-up', 'Summary'].map((label, idx) => (
            <div
              key={label}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px',
                background: step > idx ? '#4caf50' : step === idx + 1 ? '#2196f3' : '#e0e0e0',
                color: step >= idx + 1 ? '#fff' : '#666',
                borderRadius: idx === 0 ? '4px 0 0 4px' : idx === 3 ? '0 4px 4px 0' : '0'
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Readiness */}
          {step === 1 && (
            <div className="rtw-step">
              <h4>How are they feeling?</h4>

              <div className="form-group">
                <label>Does the employee feel ready to return to work?</label>
                <div className="radio-group" style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="feeling_ready_yes"
                      checked={formData.feeling_ready === true}
                      onChange={() => handleRadioChange('feeling_ready', true)}
                    />
                    Yes, feeling ready
                  </label>
                  <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="feeling_ready_no"
                      checked={formData.feeling_ready === false}
                      onChange={() => handleRadioChange('feeling_ready', false)}
                    />
                    Has some concerns
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="ready_notes">Notes on their readiness</label>
                <textarea
                  id="ready_notes"
                  name="ready_notes"
                  value={formData.ready_notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="How did they describe how they're feeling?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="wellbeing_notes">General wellbeing check</label>
                <textarea
                  id="wellbeing_notes"
                  name="wellbeing_notes"
                  value={formData.wellbeing_notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any observations about their wellbeing, energy levels, etc."
                />
              </div>
            </div>
          )}

          {/* Step 2: Support */}
          {step === 2 && (
            <div className="rtw-step">
              <h4>Support & Adjustments</h4>

              <div className="form-group">
                <label htmlFor="ongoing_concerns">Any ongoing concerns?</label>
                <textarea
                  id="ongoing_concerns"
                  name="ongoing_concerns"
                  value={formData.ongoing_concerns}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Are there any health concerns that might affect their work?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="workplace_adjustments">Workplace adjustments needed?</label>
                <textarea
                  id="workplace_adjustments"
                  name="workplace_adjustments"
                  value={formData.workplace_adjustments}
                  onChange={handleChange}
                  rows={3}
                  placeholder="E.g., phased return, reduced hours, ergonomic equipment, task modifications..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="support_required">Additional support required?</label>
                <textarea
                  id="support_required"
                  name="support_required"
                  value={formData.support_required}
                  onChange={handleChange}
                  rows={3}
                  placeholder="E.g., training refresh, workload review, team support..."
                />
              </div>
            </div>
          )}

          {/* Step 3: Follow-up */}
          {step === 3 && (
            <div className="rtw-step">
              <h4>Follow-up & Referrals</h4>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="follow_up_required"
                    checked={formData.follow_up_required}
                    onChange={handleChange}
                  />
                  <span>Schedule a follow-up check-in</span>
                </label>
              </div>

              {formData.follow_up_required && (
                <>
                  <div className="form-group">
                    <label htmlFor="follow_up_date">Follow-up date</label>
                    <input
                      type="date"
                      id="follow_up_date"
                      name="follow_up_date"
                      value={formData.follow_up_date}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="follow_up_notes">Follow-up focus areas</label>
                    <textarea
                      id="follow_up_notes"
                      name="follow_up_notes"
                      value={formData.follow_up_notes}
                      onChange={handleChange}
                      rows={2}
                      placeholder="What should be discussed at the follow-up?"
                    />
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginTop: '24px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="oh_referral_recommended"
                    checked={formData.oh_referral_recommended}
                    onChange={handleChange}
                  />
                  <span>Recommend Occupational Health referral</span>
                </label>
              </div>

              {formData.oh_referral_recommended && (
                <div className="form-group">
                  <label htmlFor="oh_referral_reason">Reason for OH referral</label>
                  <textarea
                    id="oh_referral_reason"
                    name="oh_referral_reason"
                    value={formData.oh_referral_reason}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Why is an OH referral being recommended?"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Summary */}
          {step === 4 && (
            <div className="rtw-step">
              <h4>Summary & Manager Notes</h4>

              <div className="rtw-summary" style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '16px', color: '#212121' }}>
                <div className="summary-row" style={{ marginBottom: '12px' }}>
                  <strong>Feeling Ready:</strong>{' '}
                  {formData.feeling_ready === true ? '✓ Yes' : formData.feeling_ready === false ? '⚠️ Has concerns' : 'Not recorded'}
                </div>

                {formData.workplace_adjustments && (
                  <div className="summary-row" style={{ marginBottom: '12px' }}>
                    <strong>Adjustments:</strong> {formData.workplace_adjustments}
                  </div>
                )}

                {formData.follow_up_required && (
                  <div className="summary-row" style={{ marginBottom: '12px' }}>
                    <strong>Follow-up:</strong> Scheduled for {formData.follow_up_date || 'TBC'}
                  </div>
                )}

                {formData.oh_referral_recommended && (
                  <div className="summary-row" style={{ color: '#f57c00' }}>
                    <strong>OH Referral:</strong> Recommended
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="manager_notes">Manager's overall notes</label>
                <textarea
                  id="manager_notes"
                  name="manager_notes"
                  value={formData.manager_notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Any additional notes or observations from this conversation..."
                />
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {step > 1 && (
                <button type="button" onClick={prevStep} className="cancel-btn">
                  ← Previous
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={onClose} className="cancel-btn">
                Cancel
              </button>
              {step < 4 ? (
                <button type="button" onClick={nextStep} className="primary-btn">
                  Next →
                </button>
              ) : (
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Completing...' : 'Complete RTW Interview'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReturnToWorkForm;
