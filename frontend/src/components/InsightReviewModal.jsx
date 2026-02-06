/**
 * HeadOfficeOS - Insight Review Modal
 * Modal for reviewing and actioning absence insights.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: Absence Insights
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function InsightReviewModal({ insight, onClose, getPatternLabel, getPatternIcon, getPriorityColor }) {
  const [loading, setLoading] = useState(true);
  const [fullInsight, setFullInsight] = useState(null);
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFullInsight();
  }, [insight.id]);

  const fetchFullInsight = async () => {
    try {
      const data = await apiFetch(`/api/absence-insights/${insight.id}`);
      setFullInsight(data.insight);
    } catch (err) {
      setError('Failed to load insight details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleReview = async () => {
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/absence-insights/${insight.id}/review`, {
        method: 'PUT',
        body: JSON.stringify({ notes })
      });
      onClose();
    } catch (err) {
      setError('Failed to mark as reviewed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async () => {
    if (!action.trim()) {
      setError('Please describe the action taken');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/absence-insights/${insight.id}/action`, {
        method: 'PUT',
        body: JSON.stringify({
          action_taken: action,
          follow_up_date: followUpDate || null
        })
      });
      onClose();
    } catch (err) {
      setError('Failed to record action');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/absence-insights/${insight.id}/dismiss`, {
        method: 'PUT',
        body: JSON.stringify({ reason: notes || 'Not concerning' })
      });
      onClose();
    } catch (err) {
      setError('Failed to dismiss insight');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPatternData = () => {
    if (!fullInsight?.pattern_data) return null;
    const data = fullInsight.pattern_data;

    switch (fullInsight.pattern_type) {
      case 'frequency':
        return (
          <div className="pattern-details">
            <div className="detail-row">
              <span className="label">Absences:</span>
              <span className="value">{data.count} in {data.period_days} days</span>
            </div>
            <div className="detail-row">
              <span className="label">Threshold:</span>
              <span className="value">{data.threshold} absences</span>
            </div>
          </div>
        );

      case 'monday_friday':
        return (
          <div className="pattern-details">
            <div className="detail-row">
              <span className="label">Monday absences:</span>
              <span className="value">{data.monday_count}</span>
            </div>
            <div className="detail-row">
              <span className="label">Friday absences:</span>
              <span className="value">{data.friday_count}</span>
            </div>
            <div className="detail-row">
              <span className="label">Total absences:</span>
              <span className="value">{data.total_absences}</span>
            </div>
            <div className="detail-row">
              <span className="label">Percentage:</span>
              <span className="value">{data.percentage}%</span>
            </div>
          </div>
        );

      case 'post_holiday':
        return (
          <div className="pattern-details">
            <div className="detail-row">
              <span className="label">Occurrences:</span>
              <span className="value">{data.occurrences?.length || 0}</span>
            </div>
            {data.occurrences?.map((occ, i) => (
              <div key={i} className="detail-row" style={{ fontSize: '13px', color: '#111' }}>
                Holiday ended {formatDate(occ.holiday_end)} → Absent {formatDate(occ.absence_start)}
              </div>
            ))}
          </div>
        );

      case 'duration_trend':
        return (
          <div className="pattern-details">
            <div className="detail-row">
              <span className="label">First period avg:</span>
              <span className="value">{data.first_period_avg} days</span>
            </div>
            <div className="detail-row">
              <span className="label">Last period avg:</span>
              <span className="value">{data.last_period_avg} days</span>
            </div>
            <div className="detail-row">
              <span className="label">Increase:</span>
              <span className="value" style={{ color: '#f44336' }}>+{data.increase_percentage}%</span>
            </div>
          </div>
        );

      case 'short_notice':
        return (
          <div className="pattern-details">
            <div className="detail-row">
              <span className="label">Same-day reports:</span>
              <span className="value">{data.same_day_count}</span>
            </div>
            <div className="detail-row">
              <span className="label">Total absences:</span>
              <span className="value">{data.total_absences}</span>
            </div>
            <div className="detail-row">
              <span className="label">Percentage:</span>
              <span className="value">{data.percentage}%</span>
            </div>
          </div>
        );

      case 'recurring_reason':
        return (
          <div className="pattern-details">
            <div className="detail-row">
              <span className="label">Reason:</span>
              <span className="value">{data.reason_label}</span>
            </div>
            <div className="detail-row">
              <span className="label">Count:</span>
              <span className="value">{data.count} times</span>
            </div>
          </div>
        );

      default:
        return (
          <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '12px', borderRadius: '6px', overflow: 'auto' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content modal-large" style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>{getPatternIcon(insight.pattern_type)}</span>
            Insight Review
          </h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#111' }}>
            Loading insight details...
          </div>
        ) : fullInsight ? (
          <div style={{ padding: '0 20px 20px' }}>
            {/* Employee Info */}
            <div style={{
              background: '#f5f5f5',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#111' }}>{fullInsight.employee_name}</h4>
                  <div style={{ fontSize: '14px', color: '#111' }}>{fullInsight.employee_number}</div>
                  {fullInsight.employee_email && (
                    <div style={{ fontSize: '14px', color: '#111' }}>{fullInsight.employee_email}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: `${getPriorityColor(fullInsight.priority)}15`,
                    color: getPriorityColor(fullInsight.priority),
                    fontWeight: '500',
                    textTransform: 'capitalize'
                  }}>
                    {fullInsight.priority} Priority
                  </span>
                </div>
              </div>
            </div>

            {/* Pattern Summary */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'inline-block',
                background: '#e8f5e9',
                color: '#2e7d32',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '12px'
              }}>
                {getPatternLabel(fullInsight.pattern_type)}
              </div>
              <p style={{ margin: '0', color: '#111', fontSize: '15px', lineHeight: 1.6 }}>
                {fullInsight.summary}
              </p>
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#111' }}>
                Period: {formatDate(fullInsight.period_start)} - {formatDate(fullInsight.period_end)}
              </div>
            </div>

            {/* Pattern Details */}
            <div style={{
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#111' }}>Pattern Details</h4>
              <style>{`
                .pattern-details .detail-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 8px 0;
                  border-bottom: 1px solid #f0f0f0;
                }
                .pattern-details .detail-row:last-child {
                  border-bottom: none;
                }
                .pattern-details .label {
                  color: #111;
                }
                .pattern-details .value {
                  color: #111;
                  font-weight: 500;
                }
              `}</style>
              {renderPatternData()}
            </div>

            {/* Related Absences */}
            {fullInsight.related_absences && fullInsight.related_absences.length > 0 && (
              <div style={{
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#111' }}>
                  Related Absences ({fullInsight.related_absences.length})
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <th style={{ textAlign: 'left', padding: '8px', color: '#111' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px', color: '#111' }}>Category</th>
                      <th style={{ textAlign: 'left', padding: '8px', color: '#111' }}>Reason</th>
                      <th style={{ textAlign: 'center', padding: '8px', color: '#111' }}>Notice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullInsight.related_absences.map(absence => (
                      <tr key={absence.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px', color: '#111' }}>
                          {formatDate(absence.leave_start_date)}
                          {absence.leave_end_date !== absence.leave_start_date && (
                            <> - {formatDate(absence.leave_end_date)}</>
                          )}
                        </td>
                        <td style={{ padding: '8px', color: '#111', textTransform: 'capitalize' }}>
                          {absence.absence_category?.replace('_', ' ')}
                        </td>
                        <td style={{ padding: '8px', color: '#111', textTransform: 'capitalize' }}>
                          {absence.sick_reason?.replace('_', ' ') || '-'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#111' }}>
                          {absence.notice_days != null ? `${absence.notice_days}d` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Employee Summary */}
            {fullInsight.employee_summary && (
              <div style={{
                background: '#e3f2fd',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#1565c0' }}>
                  12-Month Summary
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#1565c0' }}>
                      {fullInsight.employee_summary.total_sick_days_12m}
                    </div>
                    <div style={{ fontSize: '13px', color: '#1565c0' }}>Total sick days</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#1565c0' }}>
                      {fullInsight.employee_summary.total_absences_12m}
                    </div>
                    <div style={{ fontSize: '13px', color: '#1565c0' }}>Absence spells</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#1565c0' }}>
                      {fullInsight.employee_summary.avg_duration_12m}
                    </div>
                    <div style={{ fontSize: '13px', color: '#1565c0' }}>Avg duration (days)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#1565c0' }}>
                      {fullInsight.employee_summary.bradford_factor}
                    </div>
                    <div style={{ fontSize: '13px', color: '#1565c0' }}>Bradford Factor</div>
                  </div>
                </div>
              </div>
            )}

            {/* Review History */}
            {fullInsight.review_history && fullInsight.review_history.length > 0 && (
              <div style={{
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#111' }}>Review History</h4>
                {fullInsight.review_history.map((entry, i) => (
                  <div key={i} style={{
                    padding: '8px 0',
                    borderBottom: i < fullInsight.review_history.length - 1 ? '1px solid #f0f0f0' : 'none',
                    fontSize: '13px'
                  }}>
                    <div style={{ color: '#111' }}>
                      <strong>{entry.changed_by_name}</strong> changed status from{' '}
                      <em>{entry.previous_status}</em> to <em>{entry.new_status}</em>
                    </div>
                    {entry.notes && (
                      <div style={{ color: '#111', marginTop: '4px' }}>{entry.notes}</div>
                    )}
                    <div style={{ color: '#555', marginTop: '4px', fontSize: '12px' }}>
                      {formatDate(entry.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            {fullInsight.status !== 'dismissed' && fullInsight.status !== 'action_taken' && (
              <div style={{
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: '#111' }}>Take Action</h4>

                {error && (
                  <div style={{
                    background: '#ffebee',
                    color: '#c62828',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#111' }}>
                    Notes / Action Taken
                  </label>
                  <textarea
                    value={notes || action}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setAction(e.target.value);
                    }}
                    placeholder="Describe any notes or actions taken (e.g., wellbeing conversation scheduled, OH referral made)..."
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #e0e0e0',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#111' }}>
                    Follow-up Date (optional)
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e0e0e0',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleReview}
                    disabled={submitting}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#2196f3',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1
                    }}
                  >
                    Mark as Reviewed
                  </button>
                  <button
                    onClick={handleAction}
                    disabled={submitting}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#4caf50',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1
                    }}
                  >
                    Record Action Taken
                  </button>
                  <button
                    onClick={handleDismiss}
                    disabled={submitting}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      background: '#fff',
                      color: '#111',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Already actioned message */}
            {(fullInsight.status === 'action_taken' || fullInsight.status === 'dismissed') && (
              <div style={{
                background: '#f5f5f5',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#111' }}>
                  This insight has been {fullInsight.status === 'action_taken' ? 'actioned' : 'dismissed'}.
                </div>
                {fullInsight.action_taken && (
                  <div style={{ marginTop: '8px', color: '#111' }}>
                    <strong>Action:</strong> {fullInsight.action_taken}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#f44336' }}>
            {error || 'Failed to load insight'}
          </div>
        )}

        <div className="form-actions" style={{ borderTop: '1px solid #e0e0e0', padding: '16px 20px' }}>
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>
    </div>
  );
}

export default InsightReviewModal;
