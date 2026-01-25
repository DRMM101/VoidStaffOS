/**
 * VoidStaffOS - Review Form Component
 * Form for creating and editing performance reviews.
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

function getMetricStatus(value) {
  if (value == null) return null;
  if (value < 5) return 'red';
  if (value < 6.5) return 'amber';
  return 'green';
}

function MetricCard({ label, value, status, tooltip }) {
  return (
    <div className={`metric-card ${status || 'neutral'}`}>
      <div className="metric-card-label">
        {label}
        <span className="tooltip-icon" title={tooltip}>?</span>
      </div>
      <div className="metric-card-value">{value !== null ? value : '-'}</div>
      {status && <div className={`metric-card-indicator ${status}`}></div>}
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

function ReviewForm({ review, employees, onSubmit, onClose, defaultEmployeeId }) {
  const isEdit = !!review;
  const defaultWeekEnding = getMostRecentFriday();

  const [formData, setFormData] = useState({
    employee_id: review?.employee_id || defaultEmployeeId || '',
    review_date: review?.review_date ? review.review_date.split('T')[0] : defaultWeekEnding,
    goals: review?.goals || '',
    achievements: review?.achievements || '',
    areas_for_improvement: review?.areas_for_improvement || '',
    tasks_completed: review?.tasks_completed || null,
    work_volume: review?.work_volume || null,
    problem_solving: review?.problem_solving || null,
    communication: review?.communication || null,
    leadership: review?.leadership || null
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Calculate metrics
  const velocity = (formData.tasks_completed && formData.work_volume && formData.problem_solving)
    ? Math.round((formData.tasks_completed + formData.work_volume + formData.problem_solving) / 3 * 100) / 100
    : null;

  const friction = (velocity && formData.communication)
    ? Math.round((velocity + formData.communication) / 2 * 100) / 100
    : null;

  const cohesion = (formData.problem_solving && formData.communication && formData.leadership)
    ? Math.round((formData.problem_solving + formData.communication + formData.leadership) / 3 * 100) / 100
    : null;

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
          <h3>{isEdit ? 'Edit Review' : 'New Performance Snapshot'}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="employee_id">Employee</label>
              <select
                id="employee_id"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                disabled={isEdit}
              >
                <option value="">Select an employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

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
          </div>

          {/* Key Performance Indicators */}
          <div className="kpi-section">
            <h4>Key Performance Indicators</h4>
            <div className="kpi-cards">
              <MetricCard
                label="Velocity"
                value={velocity}
                status={getMetricStatus(velocity)}
                tooltip="Velocity = (Tasks + Volume + Problem Solving) / 3"
              />
              <MetricCard
                label="Friction"
                value={friction}
                status={getMetricStatus(friction)}
                tooltip="Friction = (Velocity + Communication) / 2"
              />
              <MetricCard
                label="Cohesion"
                value={cohesion}
                status={getMetricStatus(cohesion)}
                tooltip="Cohesion = (Problem Solving + Communication + Leadership) / 3"
              />
            </div>
          </div>

          {/* Core Ratings */}
          <div className="metrics-section secondary">
            <h4>Core Ratings</h4>

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
            <label htmlFor="goals">Goals</label>
            <textarea
              id="goals"
              name="goals"
              value={formData.goals}
              onChange={handleChange}
              rows="3"
              placeholder="What were the goals for this week?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="achievements">Achievements</label>
            <textarea
              id="achievements"
              name="achievements"
              value={formData.achievements}
              onChange={handleChange}
              rows="3"
              placeholder="What did the employee achieve this week?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="areas_for_improvement">Areas for Improvement</label>
            <textarea
              id="areas_for_improvement"
              name="areas_for_improvement"
              value={formData.areas_for_improvement}
              onChange={handleChange}
              rows="3"
              placeholder="What areas need improvement?"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Update Snapshot' : 'Create Snapshot')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReviewForm;
