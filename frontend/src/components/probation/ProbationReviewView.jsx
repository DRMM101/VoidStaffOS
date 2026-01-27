/**
 * VoidStaffOS - Probation Review View
 * View completed review with sign-off status.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

function ProbationReviewView({ reviewId, isEmployee, onClose, onAcknowledge, onSign }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledgeComment, setAcknowledgeComment] = useState('');
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState(false);

  useEffect(() => {
    fetchReview();
  }, [reviewId]);

  const fetchReview = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/probation/reviews/${reviewId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setReview(data);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load review');
      }
    } catch (err) {
      console.error('Error fetching review:', err);
      setError('Failed to load review');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    try {
      const response = await apiFetch(`/api/probation/reviews/${reviewId}/sign`, {
        method: 'PUT'
      });
      if (response.ok) {
        fetchReview();
        onSign && onSign();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to sign review');
      }
    } catch (err) {
      console.error('Error signing review:', err);
      alert('Failed to sign review');
    }
  };

  const handleAcknowledge = () => {
    onAcknowledge && onAcknowledge(reviewId, acknowledgeComment);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReviewTypeLabel = (type) => {
    const labels = {
      '1_month': '1 Month Review',
      '3_month': '3 Month Review',
      '6_month': '6 Month Review',
      'final': 'Final Review',
      'extension': 'Extension Review'
    };
    return labels[type] || type;
  };

  const getRecommendationLabel = (rec) => {
    const labels = {
      'continue': 'Continue Probation',
      'extend': 'Extend Probation',
      'pass': 'Pass Probation',
      'fail': 'Fail Probation'
    };
    return labels[rec] || rec;
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal review-view-modal">
          <div className="loading">Loading review...</div>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="modal-overlay">
        <div className="modal review-view-modal">
          <div className="error-message">{error || 'Review not found'}</div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal review-view-modal">
        <div className="modal-header">
          <h3>{getReviewTypeLabel(review.review_type)}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="review-view-content">
          {/* Review Info */}
          <div className="review-info-section">
            <div className="info-row">
              <span className="info-label">Employee:</span>
              <span className="info-value">{review.employee_name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Completed:</span>
              <span className="info-value">{formatDate(review.completed_date)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Completed by:</span>
              <span className="info-value">{review.completed_by_name || review.manager_name}</span>
            </div>
          </div>

          {/* Performance Rating */}
          <div className="review-section">
            <h4>Performance Rating</h4>
            <div className="rating-display">
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    className={`star ${star <= review.performance_rating ? 'filled' : ''}`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="rating-number">{review.performance_rating}/5</span>
            </div>
            <div className={`expectations-badge ${review.meeting_expectations ? 'meeting' : 'not-meeting'}`}>
              {review.meeting_expectations ? 'Meeting Expectations' : 'Not Meeting Expectations'}
            </div>
          </div>

          {/* Review Content */}
          {review.areas_of_strength && (
            <div className="review-section">
              <h4>Areas of Strength</h4>
              <p>{review.areas_of_strength}</p>
            </div>
          )}

          {review.areas_for_improvement && (
            <div className="review-section">
              <h4>Areas for Improvement</h4>
              <p>{review.areas_for_improvement}</p>
            </div>
          )}

          {review.support_provided && (
            <div className="review-section">
              <h4>Support Provided</h4>
              <p>{review.support_provided}</p>
            </div>
          )}

          {review.support_needed && (
            <div className="review-section">
              <h4>Support Needed</h4>
              <p>{review.support_needed}</p>
            </div>
          )}

          {review.objectives_for_next_period && (
            <div className="review-section">
              <h4>Objectives for Next Period</h4>
              <p>{review.objectives_for_next_period}</p>
            </div>
          )}

          {/* Recommendation */}
          <div className="review-section recommendation">
            <h4>Recommendation</h4>
            <div className={`recommendation-badge ${review.recommendation}`}>
              {getRecommendationLabel(review.recommendation)}
            </div>
          </div>

          {/* Sign-off Status */}
          <div className="signoff-section">
            <h4>Sign-off Status</h4>
            <div className="signoff-items">
              <div className={`signoff-item ${review.manager_signed ? 'signed' : 'pending'}`}>
                <span className="signoff-icon">{review.manager_signed ? '✓' : '○'}</span>
                <span className="signoff-label">Manager Sign-off</span>
                {review.manager_signed && (
                  <span className="signoff-date">{formatDateTime(review.manager_signed_at)}</span>
                )}
              </div>
              <div className={`signoff-item ${review.employee_acknowledged ? 'signed' : 'pending'}`}>
                <span className="signoff-icon">{review.employee_acknowledged ? '✓' : '○'}</span>
                <span className="signoff-label">Employee Acknowledgment</span>
                {review.employee_acknowledged && (
                  <span className="signoff-date">{formatDateTime(review.employee_acknowledged_at)}</span>
                )}
              </div>
            </div>

            {review.employee_comments && (
              <div className="employee-comments">
                <h5>Employee Comments</h5>
                <p>{review.employee_comments}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="review-view-actions">
          {/* Manager can sign if not signed */}
          {!isEmployee && !review.manager_signed && (
            <button className="btn-primary" onClick={handleSign}>
              Sign Review
            </button>
          )}

          {/* Employee can acknowledge if manager signed but not acknowledged */}
          {isEmployee && review.manager_signed && !review.employee_acknowledged && (
            <>
              {showAcknowledgeForm ? (
                <div className="acknowledge-form">
                  <textarea
                    value={acknowledgeComment}
                    onChange={(e) => setAcknowledgeComment(e.target.value)}
                    placeholder="Optional comments..."
                    rows="2"
                  />
                  <div className="acknowledge-actions">
                    <button className="btn-secondary" onClick={() => setShowAcknowledgeForm(false)}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={handleAcknowledge}>
                      Acknowledge Review
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-primary" onClick={() => setShowAcknowledgeForm(true)}>
                  Acknowledge Review
                </button>
              )}
            </>
          )}

          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProbationReviewView;
