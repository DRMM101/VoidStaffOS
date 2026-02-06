// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GoalCard Component
 * Displays an individual goal as a card with progress bar,
 * category badge, priority indicator, and quick actions.
 */

import { Target, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

/**
 * Map category to CSS modifier class for badge colour
 * Performance=teal, Development=indigo, Project=blue, Personal=grey
 */
const CATEGORY_CLASS = {
  performance: 'goal-badge--teal',
  development: 'goal-badge--indigo',
  project: 'goal-badge--blue',
  personal: 'goal-badge--grey'
};

/** Human-readable category labels */
const CATEGORY_LABEL = {
  performance: 'Performance',
  development: 'Development',
  project: 'Project',
  personal: 'Personal'
};

/** Priority indicator classes */
const PRIORITY_CLASS = {
  low: 'goal-priority--low',
  medium: 'goal-priority--medium',
  high: 'goal-priority--high'
};

/**
 * Determine progress bar colour class based on percentage:
 * 0-25 grey, 26-50 amber, 51-75 blue, 76-99 teal, 100 green
 */
function getProgressClass(progress) {
  if (progress >= 100) return 'goal-progress__fill--green';
  if (progress >= 76) return 'goal-progress__fill--teal';
  if (progress >= 51) return 'goal-progress__fill--blue';
  if (progress >= 26) return 'goal-progress__fill--amber';
  return 'goal-progress__fill--grey';
}

/** Check if a goal is overdue (active + target_date in the past) */
function isOverdue(goal) {
  if (goal.status !== 'active' || !goal.target_date) return false;
  return new Date(goal.target_date) < new Date(new Date().toDateString());
}

/** Format a date string to en-GB locale */
function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function GoalCard({ goal, onView, onUpdateProgress, onComplete, showOwner = false }) {
  const overdue = isOverdue(goal);

  return (
    <div
      className={`goal-card ${overdue ? 'goal-card--overdue' : ''} ${goal.status === 'completed' ? 'goal-card--completed' : ''}`}
      role="article"
      aria-label={`Goal: ${goal.title}`}
    >
      {/* Header: category badge + priority */}
      <div className="goal-card__header">
        <span className={`goal-badge ${CATEGORY_CLASS[goal.category] || 'goal-badge--grey'}`}>
          {CATEGORY_LABEL[goal.category] || goal.category}
        </span>
        <span className={`goal-priority ${PRIORITY_CLASS[goal.priority] || ''}`}>
          {goal.priority}
        </span>
      </div>

      {/* Title */}
      <h3 className="goal-card__title">{goal.title}</h3>

      {/* Owner name (shown on team goals page) */}
      {showOwner && goal.owner_name && (
        <span className="goal-card__owner">{goal.owner_name}</span>
      )}

      {/* Assigned by (if manager-assigned) */}
      {goal.assigned_by_name && (
        <span className="goal-card__assigned">
          Assigned by {goal.assigned_by_name}
        </span>
      )}

      {/* Progress bar */}
      <div className="goal-progress" aria-label={`Progress: ${goal.progress}%`}>
        <div className="goal-progress__bar">
          <div
            className={`goal-progress__fill ${getProgressClass(goal.progress)}`}
            style={{ width: `${Math.min(goal.progress, 100)}%` }}
          />
        </div>
        <span className="goal-progress__label">{goal.progress}%</span>
      </div>

      {/* Target date + overdue indicator */}
      <div className="goal-card__footer">
        {goal.target_date && (
          <span className={`goal-card__date ${overdue ? 'goal-card__date--overdue' : ''}`}>
            {overdue && <AlertTriangle size={14} aria-hidden="true" />}
            {overdue ? 'Overdue — ' : ''}
            {formatDate(goal.target_date)}
          </span>
        )}

        {goal.status === 'completed' && (
          <span className="goal-card__completed-badge">
            <CheckCircle size={14} aria-hidden="true" />
            Completed
          </span>
        )}
      </div>

      {/* Quick actions */}
      {goal.status === 'active' && (
        <div className="goal-card__actions">
          <button
            className="btn-secondary btn--sm"
            onClick={() => onView(goal)}
            aria-label={`View goal: ${goal.title}`}
          >
            View
          </button>
          <button
            className="btn-secondary btn--sm"
            onClick={() => onUpdateProgress(goal)}
            aria-label={`Update progress for: ${goal.title}`}
          >
            Update
          </button>
          <button
            className="btn-primary btn--sm"
            onClick={() => onComplete(goal)}
            aria-label={`Complete goal: ${goal.title}`}
          >
            Complete
          </button>
        </div>
      )}

      {/* View-only action for completed/cancelled/draft goals */}
      {goal.status !== 'active' && (
        <div className="goal-card__actions">
          <button
            className="btn-secondary btn--sm"
            onClick={() => onView(goal)}
            aria-label={`View goal: ${goal.title}`}
          >
            View
          </button>
        </div>
      )}
    </div>
  );
}

export default GoalCard;
