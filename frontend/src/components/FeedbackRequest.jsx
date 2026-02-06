/**
 * HeadOfficeOS - Feedback Request Component
 * Form for submitting 360 feedback.
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
import './FeedbackRequest.css';

const RATING_LABELS = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Needs Improvement',
  4: 'Developing',
  5: 'Adequate',
  6: 'Satisfactory',
  7: 'Good',
  8: 'Very Good',
  9: 'Excellent',
  10: 'Outstanding'
};

function RatingSlider({ label, value, onChange, description }) {
  return (
    <div className="rating-slider-group">
      <div className="rating-header">
        <label>{label}</label>
        <span className="rating-value">
          {value} - {RATING_LABELS[value]}
        </span>
      </div>
      {description && <p className="rating-description">{description}</p>}
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="rating-slider"
      />
      <div className="rating-scale">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

export default function FeedbackRequest({ request, onSubmit, onClose }) {
  const [ratings, setRatings] = useState({
    tasks_completed: 5,
    work_volume: 5,
    problem_solving: 5,
    communication: 5,
    leadership: 5
  });
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDirectReport = request.reviewer_type === 'direct_report';
  const isSelf = request.reviewer_type === 'self';

  const handleRatingChange = (field, value) => {
    setRatings(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await apiFetch('/api/feedback/quarterly', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: request.employee_id,
          quarter: request.quarter,
          ...ratings,
          comments
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      onSubmit && onSubmit(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getContextMessage = () => {
    if (isSelf) {
      return 'Rate your own performance for this quarter. Be honest - your self-assessment will be compared with other perspectives.';
    }
    if (isDirectReport) {
      return 'Your feedback will be anonymous. Please provide honest feedback about your manager\'s performance.';
    }
    if (request.reviewer_type === 'skip_level') {
      return 'As a skip-level manager, focus on strategic thinking and cross-team collaboration.';
    }
    return 'Provide balanced feedback based on your direct observations this quarter.';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="feedback-request-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {isSelf ? 'Self-Assessment' : `Feedback for ${request.employee_name}`}
          </h2>
          <span className="quarter-badge">{request.quarter}</span>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="feedback-context">
          <div className={`reviewer-type-badge ${request.reviewer_type}`}>
            {request.reviewer_type === 'direct_report' ? 'Direct Report (Anonymous)' :
             request.reviewer_type === 'skip_level' ? 'Skip-Level Review' :
             request.reviewer_type === 'self' ? 'Self-Assessment' : 'Manager Review'}
          </div>
          <p>{getContextMessage()}</p>
        </div>

        {isDirectReport && (
          <div className="anonymous-notice">
            <span className="notice-icon">&#128274;</span>
            <span>Your identity will not be revealed. Only aggregated feedback from all direct reports will be shown.</span>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="ratings-section">
            <RatingSlider
              label="Tasks Completed"
              value={ratings.tasks_completed}
              onChange={(v) => handleRatingChange('tasks_completed', v)}
              description="Quality and timeliness of work deliverables"
            />

            <RatingSlider
              label="Work Volume"
              value={ratings.work_volume}
              onChange={(v) => handleRatingChange('work_volume', v)}
              description="Amount of work handled relative to expectations"
            />

            <RatingSlider
              label="Problem Solving"
              value={ratings.problem_solving}
              onChange={(v) => handleRatingChange('problem_solving', v)}
              description="Ability to identify issues and develop solutions"
            />

            <RatingSlider
              label="Communication"
              value={ratings.communication}
              onChange={(v) => handleRatingChange('communication', v)}
              description="Clarity, responsiveness, and collaboration"
            />

            <RatingSlider
              label="Leadership"
              value={ratings.leadership}
              onChange={(v) => handleRatingChange('leadership', v)}
              description="Initiative, mentoring, and team influence"
            />
          </div>

          <div className="comments-section">
            <label>Comments (Optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={isSelf ?
                "Reflect on your achievements and areas for growth..." :
                "Provide specific examples or additional context..."}
              rows={4}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
