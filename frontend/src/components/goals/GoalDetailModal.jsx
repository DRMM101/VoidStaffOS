// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GoalDetailModal Component
 * Full goal view with all fields, progress indicator, update history
 * timeline, add comment form, and edit/delete/complete actions.
 */

import { useState, useEffect } from 'react';
import { X, Edit3, Trash2, CheckCircle, Clock, MessageSquare, TrendingUp } from 'lucide-react';
import api from '../../utils/api';

/** Map category to badge CSS modifier */
const CATEGORY_CLASS = {
  performance: 'goal-badge--teal',
  development: 'goal-badge--indigo',
  project: 'goal-badge--blue',
  personal: 'goal-badge--grey'
};

/** Human-readable labels */
const CATEGORY_LABEL = {
  performance: 'Performance',
  development: 'Development',
  project: 'Project',
  personal: 'Personal'
};

/** Determine progress bar fill colour */
function getProgressClass(progress) {
  if (progress >= 100) return 'goal-progress__fill--green';
  if (progress >= 76) return 'goal-progress__fill--teal';
  if (progress >= 51) return 'goal-progress__fill--blue';
  if (progress >= 26) return 'goal-progress__fill--amber';
  return 'goal-progress__fill--grey';
}

/** Format ISO date string to en-GB locale */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

/** Format date+time for update timeline */
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function GoalDetailModal({ goalId, onClose, onEdit, onProgressUpdate, onComplete, onRefresh, isAdmin }) {
  // Data state
  const [goal, setGoal] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Comment form state
  const [comment, setComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** Fetch goal detail and updates from API */
  useEffect(() => {
    const fetchGoal = async () => {
      try {
        setError(null);
        const data = await api.get(`/goals/${goalId}`);
        setGoal(data.goal);
        setUpdates(data.updates || []);
      } catch (err) {
        console.error('Failed to fetch goal detail:', err);
        setError('Failed to load goal details.');
      } finally {
        setLoading(false);
      }
    };

    fetchGoal();
  }, [goalId]);

  /** Submit a new comment */
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setAddingComment(true);
    try {
      const data = await api.post(`/goals/${goalId}/updates`, { comment: comment.trim() });
      // Prepend the new update to the timeline
      setUpdates(prev => [data.update, ...prev]);
      setComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setAddingComment(false);
    }
  };

  /** Delete (cancel) the goal */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/goals/${goalId}`);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to cancel goal:', err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Goal details">
      <div className="modal-dialog modal--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>Goal Details</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="loading" style={{ padding: 'var(--space-lg)' }}>Loading goal…</div>
        )}

        {/* Error state */}
        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        {/* Goal content */}
        {goal && !loading && (
          <div className="goal-detail">
            {/* Title + category + priority row */}
            <div className="goal-detail__header">
              <div className="goal-detail__meta">
                <span className={`goal-badge ${CATEGORY_CLASS[goal.category] || 'goal-badge--grey'}`}>
                  {CATEGORY_LABEL[goal.category] || goal.category}
                </span>
                <span className={`goal-priority goal-priority--${goal.priority}`}>
                  {goal.priority}
                </span>
                <span className={`goal-status-badge goal-status-badge--${goal.status}`}>
                  {goal.status}
                </span>
              </div>
              <h2 className="goal-detail__title">{goal.title}</h2>
            </div>

            {/* Description */}
            {goal.description && (
              <p className="goal-detail__description">{goal.description}</p>
            )}

            {/* Progress bar */}
            <div className="goal-detail__progress">
              <div className="goal-detail__progress-header">
                <span>Progress</span>
                <strong>{goal.progress}%</strong>
              </div>
              <div className="goal-progress__bar goal-progress__bar--lg">
                <div
                  className={`goal-progress__fill ${getProgressClass(goal.progress)}`}
                  style={{ width: `${Math.min(goal.progress, 100)}%` }}
                />
              </div>
            </div>

            {/* Info grid: dates, owner, assigner */}
            <div className="goal-detail__info">
              <div className="goal-detail__info-item">
                <Clock size={14} aria-hidden="true" />
                <span>Target: {formatDate(goal.target_date)}</span>
              </div>
              <div className="goal-detail__info-item">
                <Clock size={14} aria-hidden="true" />
                <span>Created: {formatDate(goal.created_at)}</span>
              </div>
              {goal.completed_at && (
                <div className="goal-detail__info-item">
                  <CheckCircle size={14} aria-hidden="true" />
                  <span>Completed: {formatDate(goal.completed_at)}</span>
                </div>
              )}
              {goal.owner_name && (
                <div className="goal-detail__info-item">
                  <span>Owner: {goal.owner_name}</span>
                </div>
              )}
              {goal.assigned_by_name && (
                <div className="goal-detail__info-item">
                  <span>Assigned by: {goal.assigned_by_name}</span>
                </div>
              )}
            </div>

            {/* Action buttons (only for active goals) */}
            {goal.status === 'active' && (
              <div className="goal-detail__actions">
                <button
                  className="btn-secondary"
                  onClick={() => onEdit(goal)}
                  aria-label="Edit goal"
                >
                  <Edit3 size={16} aria-hidden="true" />
                  Edit
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => onProgressUpdate(goal)}
                  aria-label="Update progress"
                >
                  <TrendingUp size={16} aria-hidden="true" />
                  Update Progress
                </button>
                <button
                  className="btn-primary"
                  onClick={() => { onComplete(goal); onClose(); }}
                  aria-label="Mark as complete"
                >
                  <CheckCircle size={16} aria-hidden="true" />
                  Complete
                </button>
                {/* Delete / Cancel button */}
                {!confirmDelete ? (
                  <button
                    className="btn-danger"
                    onClick={() => setConfirmDelete(true)}
                    aria-label="Cancel goal"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Cancel Goal
                  </button>
                ) : (
                  <div className="goal-detail__confirm-delete">
                    <span>Are you sure?</span>
                    <button className="btn-danger btn--sm" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Cancelling…' : 'Yes, Cancel'}
                    </button>
                    <button className="btn-secondary btn--sm" onClick={() => setConfirmDelete(false)}>
                      No
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Update timeline */}
            <div className="goal-detail__timeline">
              <h4 className="goal-detail__timeline-title">
                <MessageSquare size={16} aria-hidden="true" />
                Updates & Comments ({updates.length})
              </h4>

              {/* Add comment form (only for active goals) */}
              {goal.status === 'active' && (
                <form className="goal-detail__comment-form" onSubmit={handleAddComment}>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment or update…"
                    rows={2}
                    className="form-textarea"
                    aria-label="Add comment"
                  />
                  <button
                    type="submit"
                    className="btn-primary btn--sm"
                    disabled={addingComment || !comment.trim()}
                  >
                    {addingComment ? 'Posting…' : 'Post'}
                  </button>
                </form>
              )}

              {/* Timeline entries */}
              {updates.length === 0 ? (
                <p className="goal-detail__no-updates">No updates yet.</p>
              ) : (
                <ul className="goal-detail__updates-list">
                  {updates.map(update => (
                    <li key={update.id} className="goal-detail__update-item">
                      <div className="goal-detail__update-header">
                        <strong>{update.author_name}</strong>
                        <time className="goal-detail__update-time">
                          {formatDateTime(update.created_at)}
                        </time>
                      </div>
                      {/* Progress change indicator */}
                      {update.progress_change !== null && update.progress_change !== 0 && (
                        <span className={`goal-detail__progress-change ${update.progress_change > 0 ? 'goal-detail__progress-change--up' : 'goal-detail__progress-change--down'}`}>
                          {update.progress_change > 0 ? '+' : ''}{update.progress_change}%
                        </span>
                      )}
                      <p className="goal-detail__update-comment">{update.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GoalDetailModal;
