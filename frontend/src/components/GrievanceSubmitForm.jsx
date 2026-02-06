/**
 * HeadOfficeOS - Grievance Submit Form
 * Employee self-service form to submit grievances confidentially.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: HR Cases
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function GrievanceSubmitForm({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [myGrievances, setMyGrievances] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    summary: '',
    background: ''
  });

  useEffect(() => {
    fetchMyGrievances();
  }, []);

  const fetchMyGrievances = async () => {
    try {
      const response = await apiFetch('/api/hr-cases/grievance/my-grievances');
      if (response.ok) {
        const data = await response.json();
        setMyGrievances(data.grievances || []);
      }
    } catch (err) {
      console.error('Fetch grievances error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/hr-cases/grievance/submit', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit grievance');
      }

      const data = await response.json();
      setSuccess(true);
      setFormData({ summary: '', background: '' });
      setShowForm(false);
      fetchMyGrievances();

      // Show success message
      alert(`Grievance submitted successfully.\nReference: ${data.case_reference}\n\nHR will review your grievance and contact you to arrange a meeting.`);
    } catch (err) {
      console.error('Submit grievance error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Draft',
      open: 'Under Review',
      investigation: 'Investigation',
      hearing_scheduled: 'Meeting Scheduled',
      awaiting_decision: 'Awaiting Decision',
      appeal: 'Appeal',
      closed: 'Closed'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#2196f3';
      case 'investigation': return '#ff9800';
      case 'hearing_scheduled': return '#9c27b0';
      case 'awaiting_decision': return '#f44336';
      case 'appeal': return '#e91e63';
      case 'closed': return '#4caf50';
      default: return '#666';
    }
  };

  const getOutcomeLabel = (outcome) => {
    if (!outcome) return null;
    const labels = {
      upheld: 'Upheld',
      partially_upheld: 'Partially Upheld',
      not_upheld: 'Not Upheld',
      withdrawn: 'Withdrawn',
      appeal_upheld: 'Appeal Upheld',
      appeal_rejected: 'Appeal Rejected'
    };
    return labels[outcome] || outcome;
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    color: '#111',
    background: '#fff'
  };

  return (
    <div>
      {/* My Grievances */}
      {myGrievances.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#424242' }}>My Grievances</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myGrievances.map(grievance => (
              <div
                key={grievance.id}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: '600', color: '#111' }}>{grievance.case_reference}</span>
                    <span style={{ marginLeft: '12px', fontSize: '13px', color: '#666' }}>
                      Submitted {new Date(grievance.opened_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: getStatusColor(grievance.status) + '20',
                    color: getStatusColor(grievance.status)
                  }}>
                    {getStatusLabel(grievance.status)}
                  </span>
                </div>

                <p style={{ margin: '0 0 8px', color: '#424242', fontSize: '14px' }}>
                  {grievance.summary}
                </p>

                {grievance.status === 'closed' && grievance.grievance_outcome && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#e8f5e9',
                    borderRadius: '8px'
                  }}>
                    <strong style={{ color: '#2e7d32' }}>Outcome:</strong>
                    <span style={{ marginLeft: '8px', color: '#424242' }}>
                      {getOutcomeLabel(grievance.grievance_outcome)}
                    </span>
                    {grievance.appeal_requested && (
                      <span style={{ marginLeft: '12px', padding: '2px 8px', background: '#ffb74d', color: '#fff', borderRadius: '4px', fontSize: '11px' }}>
                        Appeal Submitted
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit New Grievance */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: '#9c27b0',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Submit New Grievance
        </button>
      ) : (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e0e0e0'
        }}>
          <h3 style={{ margin: '0 0 8px', color: '#111' }}>Submit a Grievance</h3>
          <p style={{ margin: '0 0 24px', color: '#666', fontSize: '14px' }}>
            Please describe your grievance clearly and factually. This will be handled confidentially by HR.
          </p>

          {error && (
            <div style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#424242'
              }}>
                What is your grievance about? *
              </label>
              <textarea
                name="summary"
                value={formData.summary}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Briefly describe the nature of your complaint..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#424242'
              }}>
                Background and Details
              </label>
              <textarea
                name="background"
                value={formData.background}
                onChange={handleChange}
                rows={5}
                placeholder="Provide relevant details, dates, people involved, and any steps you've already taken to resolve this..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Information Box */}
            <div style={{
              background: '#e8f5e9',
              border: '1px solid #81c784',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 8px', color: '#2e7d32' }}>What happens next?</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#424242', fontSize: '14px' }}>
                <li>Your grievance will be reviewed by HR</li>
                <li>You will be invited to a meeting to discuss your concerns</li>
                <li>You have the right to be accompanied by a colleague or union rep</li>
                <li>A decision will be made and communicated to you in writing</li>
                <li>If you disagree with the outcome, you have the right to appeal</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError('');
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  color: '#424242',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading ? '#bdbdbd' : '#9c27b0',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                {loading ? 'Submitting...' : 'Submit Grievance'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default GrievanceSubmitForm;
