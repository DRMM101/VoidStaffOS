/**
 * HeadOfficeOS - Probation Status
 * Employee view of their own probation timeline.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import ProbationReviewView from './ProbationReviewView';

function ProbationStatus({ user }) {
  const [probation, setProbation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);

  useEffect(() => {
    fetchMyProbation();
  }, []);

  const fetchMyProbation = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/probation/my', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setProbation(data);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load probation status');
      }
    } catch (err) {
      console.error('Error fetching probation:', err);
      setError('Failed to load probation status');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (reviewId, comments) => {
    try {
      const response = await apiFetch(`/api/probation/reviews/${reviewId}/acknowledge`, {
        method: 'PUT',
        body: JSON.stringify({ employee_comments: comments })
      });

      if (response.ok) {
        fetchMyProbation();
        setSelectedReview(null);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to acknowledge review');
      }
    } catch (err) {
      console.error('Error acknowledging review:', err);
      alert('Failed to acknowledge review');
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

  const getReviewStatusClass = (review) => {
    if (review.status === 'completed') {
      if (review.manager_signed && review.employee_acknowledged) {
        return 'completed';
      }
      return 'awaiting-action';
    }
    if (review.status === 'pending') {
      const scheduled = new Date(review.scheduled_date);
      if (scheduled < new Date()) {
        return 'overdue';
      }
      return 'upcoming';
    }
    return review.status;
  };

  if (loading) {
    return <div className="loading">Loading probation status...</div>;
  }

  if (!probation) {
    return (
      <div className="probation-status">
        <div className="no-probation">
          <h3>No Active Probation</h3>
          <p>You do not currently have an active probation period.</p>
        </div>
      </div>
    );
  }

  const getDaysRemaining = () => {
    const today = new Date();
    const endDate = new Date(probation.end_date);
    return Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  };

  const getProgress = () => {
    const start = new Date(probation.start_date);
    const end = new Date(probation.end_date);
    const today = new Date();
    const total = end - start;
    const elapsed = today - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const daysRemaining = getDaysRemaining();
  const progress = getProgress();
  const reviews = probation.reviews || [];

  return (
    <div className="probation-status">
      <div className="probation-status-header">
        <h2>My Probation</h2>
        <div className={`probation-status-badge ${probation.status}`}>
          {probation.status.charAt(0).toUpperCase() + probation.status.slice(1)}
        </div>
      </div>

      {/* Progress Overview */}
      <div className="probation-overview">
        <div className="overview-dates">
          <div className="date-block">
            <span className="date-label">Start Date</span>
            <span className="date-value">{formatDate(probation.start_date)}</span>
          </div>
          <div className="date-block">
            <span className="date-label">End Date</span>
            <span className="date-value">{formatDate(probation.end_date)}</span>
          </div>
          <div className="date-block">
            <span className="date-label">Duration</span>
            <span className="date-value">{probation.duration_months} months</span>
          </div>
        </div>

        <div className="probation-progress-large">
          <div className="progress-bar-large">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-labels">
            <span>{progress}% complete</span>
            <span>
              {daysRemaining > 0
                ? `${daysRemaining} days remaining`
                : `${Math.abs(daysRemaining)} days overdue`
              }
            </span>
          </div>
        </div>

        {probation.extended && (
          <div className="extension-notice">
            <strong>Probation Extended:</strong> {probation.extension_weeks} weeks
            {probation.extension_reason && (
              <p>{probation.extension_reason}</p>
            )}
          </div>
        )}
      </div>

      {/* Review Timeline */}
      <div className="review-timeline">
        <h3>Review Milestones</h3>
        <div className="timeline">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className={`timeline-item ${getReviewStatusClass(review)}`}
              onClick={() => review.status === 'completed' && setSelectedReview(review)}
            >
              <div className="timeline-marker">
                {review.status === 'completed' ? (
                  <span className="checkmark">✓</span>
                ) : (
                  <span className="number">{index + 1}</span>
                )}
              </div>
              <div className="timeline-content">
                <h4>{getReviewTypeLabel(review.review_type)}</h4>
                <p className="scheduled-date">
                  {review.status === 'completed'
                    ? `Completed ${formatDate(review.completed_date)}`
                    : `Scheduled ${formatDate(review.scheduled_date)}`
                  }
                </p>
                {review.status === 'completed' && (
                  <div className="review-summary">
                    {review.performance_rating && (
                      <span className="rating">Rating: {review.performance_rating}/5</span>
                    )}
                    {review.manager_signed && !review.employee_acknowledged && (
                      <span className="action-needed">Action needed: Please acknowledge</span>
                    )}
                    {review.employee_acknowledged && (
                      <span className="acknowledged">Acknowledged</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Review Modal */}
      {selectedReview && (
        <ProbationReviewView
          reviewId={selectedReview.id}
          isEmployee={true}
          onClose={() => setSelectedReview(null)}
          onAcknowledge={handleAcknowledge}
        />
      )}
    </div>
  );
}

export default ProbationStatus;
