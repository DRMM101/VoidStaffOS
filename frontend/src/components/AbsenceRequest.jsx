/**
 * VoidStaffOS - Absence Request Component
 * Form for requesting statutory and other leave types.
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

const LEAVE_TYPE_INFO = {
  maternity: {
    title: 'Maternity Leave',
    description: 'Up to 52 weeks of maternity leave. Statutory Maternity Pay (SMP) for up to 39 weeks if eligible.',
    fields: ['expected_date'],
    notice: '15 weeks before due date'
  },
  paternity: {
    title: 'Paternity Leave',
    description: '1 or 2 weeks of statutory paternity leave within 56 days of birth.',
    fields: ['expected_date'],
    notice: '15 weeks before due date'
  },
  adoption: {
    title: 'Adoption Leave',
    description: 'Up to 52 weeks of adoption leave. Similar to maternity leave entitlements.',
    fields: ['expected_date'],
    notice: '28 days before placement'
  },
  shared_parental: {
    title: 'Shared Parental Leave',
    description: 'Share up to 50 weeks of leave and 37 weeks of pay between parents.',
    fields: ['expected_date', 'weeks_requested'],
    notice: '8 weeks before each block'
  },
  parental: {
    title: 'Parental Leave',
    description: '18 weeks unpaid leave per child (under 18). Maximum 4 weeks per year.',
    fields: [],
    notice: '21 days'
  },
  bereavement: {
    title: 'Bereavement Leave',
    description: 'Time off following the death of a close relative. Statutory parental bereavement leave available for loss of a child.',
    fields: [],
    notice: 'None required'
  },
  jury_duty: {
    title: 'Jury Duty',
    description: 'Time off for jury service. You must attend unless excused by the court.',
    fields: [],
    notice: 'As soon as summoned'
  },
  public_duties: {
    title: 'Public Duties',
    description: 'Reasonable time off for duties as a magistrate, councillor, school governor, etc.',
    fields: [],
    notice: 'As much as possible'
  },
  compassionate: {
    title: 'Compassionate Leave',
    description: 'Paid leave for family emergencies or serious personal circumstances.',
    fields: [],
    notice: 'None required'
  },
  toil: {
    title: 'Time Off In Lieu (TOIL)',
    description: 'Time off earned from working overtime or additional hours.',
    fields: [],
    notice: 'Manager approval required'
  },
  unpaid: {
    title: 'Unpaid Leave',
    description: 'Approved unpaid absence for personal reasons.',
    fields: [],
    notice: 'As much as possible'
  }
};

function AbsenceRequest({ onClose, onSubmit, initialCategory = null }) {
  const [step, setStep] = useState(initialCategory ? 2 : 1);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    absence_category: initialCategory || '',
    start_date: '',
    end_date: '',
    expected_date: '',
    weeks_requested: '',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/sick-leave/categories', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        // Filter out 'annual' and 'sick' - they have their own flows
        const filtered = data.categories.filter(c =>
          !['annual', 'sick'].includes(c.category)
        );
        setCategories(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategorySelect = (category) => {
    setFormData(prev => ({ ...prev, absence_category: category }));
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await apiFetch('/api/sick-leave/statutory', {
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
      setSubmitting(false);
    }
  };

  const selectedType = LEAVE_TYPE_INFO[formData.absence_category];
  const categoryConfig = categories.find(c => c.category === formData.absence_category);

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return null;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    let workingDays = 0;
    const current = new Date(start);
    while (current <= end) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    return workingDays;
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-medium">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h3>{step === 1 ? 'Request Leave' : selectedType?.title || 'Request Leave'}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {/* Step 1: Choose Leave Type */}
        {step === 1 && (
          <div className="leave-type-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {categories.map(cat => {
              const info = LEAVE_TYPE_INFO[cat.category];
              return (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => handleCategorySelect(cat.category)}
                  className="leave-type-card"
                  style={{
                    padding: '16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    background: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '4px' }}>
                    {cat.display_name}
                  </strong>
                  <small style={{ color: '#666' }}>
                    {info?.description?.substring(0, 80)}...
                  </small>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Leave Details Form */}
        {step === 2 && selectedType && (
          <form onSubmit={handleSubmit}>
            <div className="info-box" style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: 0 }}>{selectedType.description}</p>
              {selectedType.notice !== 'None required' && (
                <p style={{ margin: '8px 0 0', fontSize: '14px' }}>
                  <strong>Notice required:</strong> {selectedType.notice}
                </p>
              )}
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="start_date">Start Date</label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_date">End Date</label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  min={formData.start_date}
                  required
                />
              </div>
            </div>

            {/* Expected date for maternity/paternity/adoption */}
            {selectedType.fields?.includes('expected_date') && (
              <div className="form-group">
                <label htmlFor="expected_date">
                  {formData.absence_category === 'adoption' ? 'Expected Placement Date' : 'Expected Due Date'}
                </label>
                <input
                  type="date"
                  id="expected_date"
                  name="expected_date"
                  value={formData.expected_date}
                  onChange={handleChange}
                />
              </div>
            )}

            {/* Weeks requested for shared parental */}
            {selectedType.fields?.includes('weeks_requested') && (
              <div className="form-group">
                <label htmlFor="weeks_requested">Weeks Requested</label>
                <input
                  type="number"
                  id="weeks_requested"
                  name="weeks_requested"
                  value={formData.weeks_requested}
                  onChange={handleChange}
                  min="1"
                  max="50"
                  placeholder="e.g., 12"
                />
                <small className="form-hint">Maximum 50 weeks total shared between parents</small>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="notes">Additional Information</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional details to support your request..."
              />
            </div>

            {formData.start_date && formData.end_date && (
              <div className="leave-summary" style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Working days requested:</span>
                  <strong>{calculateDays()} days</strong>
                </div>
                {categoryConfig?.requires_approval && (
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                    This request requires manager/HR approval
                  </div>
                )}
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button type="button" onClick={() => setStep(1)} className="cancel-btn">
                ← Back
              </button>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="form-actions">
            <button onClick={onClose} className="cancel-btn">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AbsenceRequest;
