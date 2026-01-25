/**
 * VoidStaffOS - Self Reflection Form Component
 * Weekly self-assessment form for employees.
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

function RatingSlider({ label, name, value, onChange }) {
  return (
    <div className="rating-slider-group">
      <div className="rating-slider-header">
        <label>{label}</label>
        <span className="rating-slider-value">{value || '-'}</span>
      </div>
      <div className="rating-slider-container">
        <input
          type="range"
          min="1"
          max="10"
          value={value || 1}
          onChange={(e) => onChange(name, parseInt(e.target.value))}
          className="rating-slider"
        />
        <div className="rating-slider-labels">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
            <span key={num} className={value >= num ? 'active' : ''}>{num}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Get the most recent Friday
function getMostRecentFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 5 ? 0 : (day < 5 ? day + 2 : day - 5);
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

function SelfReflectionForm({ onSubmit, onClose, previousQuarterAverages }) {
  const defaultWeekEnding = getMostRecentFriday();

  const [formData, setFormData] = useState({
    review_date: defaultWeekEnding,
    goals: '',
    achievements: '',
    areas_for_improvement: '',
    tasks_completed: null,
    work_volume: null,
    problem_solving: null,
    communication: null,
    leadership: null
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRatingChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate that all ratings are provided
    const ratings = ['tasks_completed', 'work_volume', 'problem_solving', 'communication', 'leadership'];
    const missingRatings = ratings.filter(r => !formData[r]);
    if (missingRatings.length > 0) {
      setError('Please provide all 5 ratings before submitting.');
      setLoading(false);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate period covered (7 days prior to week ending)
  const getWeekPeriod = (weekEndingDate) => {
    if (!weekEndingDate) return '';
    const end = new Date(weekEndingDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h3>Weekly Self-Reflection</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Week Selection */}
          <div className="form-group">
            <label htmlFor="review_date">Week Ending (Friday)</label>
            <input
              type="date"
              id="review_date"
              name="review_date"
              value={formData.review_date}
              onChange={handleChange}
              required
            />
            <small className="field-hint">
              Period covered: {getWeekPeriod(formData.review_date)}
            </small>
          </div>

          {/* Previous Quarter Context - NO real-time KPIs shown */}
          {previousQuarterAverages && (
            <div className="previous-quarter-context">
              <h4>Your {previousQuarterAverages.quarter} Averages (for context)</h4>
              <div className="quarter-averages">
                <div className="avg-item">
                  <span className="avg-label">Velocity</span>
                  <span className="avg-value">{previousQuarterAverages.velocity}</span>
                </div>
                <div className="avg-item">
                  <span className="avg-label">Friction</span>
                  <span className="avg-value">{previousQuarterAverages.friction}</span>
                </div>
                <div className="avg-item">
                  <span className="avg-label">Cohesion</span>
                  <span className="avg-value">{previousQuarterAverages.cohesion}</span>
                </div>
              </div>
              <p className="context-hint">
                Based on {previousQuarterAverages.review_count} manager reviews
              </p>
            </div>
          )}

          {/* Blind Assessment Notice */}
          <div className="blind-assessment-notice">
            <div className="notice-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </div>
            <div className="notice-content">
              <strong>Blind Assessment</strong>
              <p>Your KPIs will be hidden until both you and your manager commit your reviews for this week. This ensures honest, unbiased assessments.</p>
            </div>
          </div>

          {/* Core Ratings - NO KPI preview */}
          <div className="metrics-section">
            <h4>Rate Your Performance This Week</h4>
            <p className="section-hint">Be honest - your manager cannot see your ratings until you both commit.</p>

            <RatingSlider
              label="Tasks Completed"
              name="tasks_completed"
              value={formData.tasks_completed}
              onChange={handleRatingChange}
            />

            <RatingSlider
              label="Work Volume"
              name="work_volume"
              value={formData.work_volume}
              onChange={handleRatingChange}
            />

            <RatingSlider
              label="Problem Solving"
              name="problem_solving"
              value={formData.problem_solving}
              onChange={handleRatingChange}
            />

            <RatingSlider
              label="Communication"
              name="communication"
              value={formData.communication}
              onChange={handleRatingChange}
            />

            <RatingSlider
              label="Leadership"
              name="leadership"
              value={formData.leadership}
              onChange={handleRatingChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="achievements">What did you achieve this week?</label>
            <textarea
              id="achievements"
              name="achievements"
              value={formData.achievements}
              onChange={handleChange}
              rows="3"
              placeholder="List your accomplishments and completed tasks..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="goals">Goals for next week</label>
            <textarea
              id="goals"
              name="goals"
              value={formData.goals}
              onChange={handleChange}
              rows="3"
              placeholder="What do you plan to focus on next week?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="areas_for_improvement">Areas you want to improve</label>
            <textarea
              id="areas_for_improvement"
              name="areas_for_improvement"
              value={formData.areas_for_improvement}
              onChange={handleChange}
              rows="3"
              placeholder="What areas would you like to work on?"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="commit-btn">
              {loading ? 'Submitting...' : 'Submit & Commit Reflection'}
            </button>
          </div>

          <p className="commit-warning">
            Once committed, your reflection cannot be edited. Your manager will not see your ratings until they also commit their review.
          </p>
        </form>
      </div>
    </div>
  );
}

export default SelfReflectionForm;
