/**
 * VoidStaffOS - Review Detail Component
 * Displays detailed review information and KPIs.
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

function MetricBar({ label, value }) {
  return (
    <div className="metric-bar-display">
      <div className="metric-bar-header">
        <span className="metric-bar-label">{label}</span>
        <span className="metric-bar-value">{value || '-'}</span>
      </div>
      <div className="metric-bar-track">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
          <div
            key={num}
            className={`metric-bar-segment ${value >= num ? 'filled' : ''}`}
          >
            {num}
          </div>
        ))}
      </div>
    </div>
  );
}

function KPICard({ label, value, status, tooltip }) {
  return (
    <div className={`kpi-card ${status || 'neutral'}`}>
      <div className="kpi-card-header">
        <span className="kpi-card-label">{label}</span>
        <span className="tooltip-icon" title={tooltip}>?</span>
      </div>
      <div className="kpi-card-value">{value !== null ? value : '-'}</div>
      <div className={`kpi-card-status ${status || ''}`}>
        {status === 'green' && 'On Track'}
        {status === 'amber' && 'Needs Attention'}
        {status === 'red' && 'Critical'}
        {!status && 'Pending'}
      </div>
    </div>
  );
}

function ReviewDetail({ review, onClose, onEdit, canEdit, user, onRefresh }) {
  const [committing, setCommitting] = useState(false);
  const [uncommitting, setUncommitting] = useState(false);
  const [showUncommitConfirm, setShowUncommitConfirm] = useState(false);

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const response = await fetch(`/api/reviews/${review.id}/commit`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setCommitting(false);
    }
  };

  const handleUncommit = async () => {
    setUncommitting(true);
    try {
      const response = await fetch(`/api/reviews/${review.id}/uncommit`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }
      setShowUncommitConfirm(false);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setUncommitting(false);
    }
  };

  const canCommit = !review.is_committed && (review.reviewer_id === user?.id || user?.role_name === 'Admin');
  const canUncommit = review.is_committed && user?.role_name === 'Admin';

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  // Calculate week period (7 days before week ending)
  const getWeekPeriod = (weekEndingDate) => {
    if (!weekEndingDate) return '-';
    const end = new Date(weekEndingDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const getStalenessLabel = (weeks, status) => {
    if (weeks == null) return null;
    const labels = {
      green: 'Fresh',
      amber: 'Aging',
      red: 'Stale'
    };
    return `${labels[status] || ''} (${weeks}w)`;
  };

  return (
    <div className="review-detail-container">
      <div className="review-detail-header">
        <h2>
          Performance Snapshot
          {review.is_committed && <span className="committed-indicator"> (Committed)</span>}
          {review.is_self_assessment && <span className="self-assessment-indicator"> - Self Assessment</span>}
        </h2>
        <div className="review-detail-actions">
          {canCommit && (
            <button
              onClick={handleCommit}
              className="commit-btn"
              disabled={committing}
            >
              {committing ? 'Committing...' : 'Commit Snapshot'}
            </button>
          )}
          {canUncommit && (
            <button
              onClick={() => setShowUncommitConfirm(true)}
              className="uncommit-btn"
              disabled={uncommitting}
            >
              Uncommit
            </button>
          )}
          {canEdit && !review.is_committed && (
            <button onClick={() => onEdit(review)} className="edit-btn">
              Edit Snapshot
            </button>
          )}
          <button onClick={onClose} className="back-btn">
            Back to List
          </button>
        </div>
      </div>

      {showUncommitConfirm && (
        <div className="confirm-dialog">
          <div className="confirm-content">
            <h4>Confirm Uncommit</h4>
            <p>Are you sure you want to uncommit this snapshot? This action will be logged in the audit trail.</p>
            <div className="confirm-actions">
              <button onClick={() => setShowUncommitConfirm(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleUncommit} className="danger-btn" disabled={uncommitting}>
                {uncommitting ? 'Uncommitting...' : 'Confirm Uncommit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="review-detail-card">
        <div className="review-meta">
          <div className="meta-row">
            <div className="meta-item">
              <label>Employee</label>
              <span>{review.employee_name}</span>
            </div>
            <div className="meta-item">
              <label>Reviewer</label>
              <span>{review.reviewer_name}</span>
            </div>
          </div>
          <div className="meta-row">
            <div className="meta-item">
              <label>Week Ending</label>
              <span>{formatDate(review.review_date)}</span>
            </div>
            <div className="meta-item">
              <label>Period Covered</label>
              <span>{getWeekPeriod(review.review_date)}</span>
            </div>
          </div>
          <div className="meta-row">
            <div className="meta-item">
              <label>Snapshot Freshness</label>
              <span className={`staleness-badge ${review.staleness_status || ''}`}>
                {getStalenessLabel(review.weeks_since_review, review.staleness_status) || 'N/A'}
              </span>
            </div>
            {review.is_committed && (
              <div className="meta-item">
                <label>Committed At</label>
                <span>{formatDate(review.committed_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="kpi-detail-section">
          <h3>Key Performance Indicators</h3>
          <div className="kpi-cards-row">
            <KPICard
              label="Velocity"
              value={review.velocity}
              status={review.velocity_status}
              tooltip="Velocity = (Tasks + Volume + Problem Solving) / 3"
            />
            <KPICard
              label="Friction"
              value={review.friction}
              status={review.friction_status}
              tooltip="Friction = (Velocity + Communication) / 2"
            />
            <KPICard
              label="Cohesion"
              value={review.cohesion}
              status={review.cohesion_status}
              tooltip="Cohesion = (Problem Solving + Communication + Leadership) / 3"
            />
          </div>
        </div>

        {/* Core Metrics */}
        <div className="metrics-detail-section">
          <h3>Core Ratings</h3>
          <div className="metrics-grid">
            <MetricBar label="Tasks Completed" value={review.tasks_completed} />
            <MetricBar label="Work Volume" value={review.work_volume} />
            <MetricBar label="Problem Solving" value={review.problem_solving} />
            <MetricBar label="Communication" value={review.communication} />
            <MetricBar label="Leadership" value={review.leadership} />
          </div>
        </div>

        <div className="review-section">
          <h3>Goals</h3>
          <p>{review.goals || 'No goals specified'}</p>
        </div>

        <div className="review-section">
          <h3>Achievements</h3>
          <p>{review.achievements || 'No achievements recorded'}</p>
        </div>

        <div className="review-section">
          <h3>Areas for Improvement</h3>
          <p>{review.areas_for_improvement || 'No areas for improvement noted'}</p>
        </div>

        <div className="review-timestamps">
          <span>Created: {formatDate(review.created_at)}</span>
          {review.updated_at && review.updated_at !== review.created_at && (
            <span>Last Updated: {formatDate(review.updated_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewDetail;
