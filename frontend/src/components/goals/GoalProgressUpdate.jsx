// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GoalProgressUpdate Component
 * Quick update modal with a progress slider and comment textarea.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

function GoalProgressUpdate({ goal, onClose, onSave }) {
  // Initialise slider at the goal's current progress
  const [progress, setProgress] = useState(goal.progress);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /** Submit the progress update */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(goal.id, progress, comment);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update progress');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Update progress">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>Update Progress</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Goal title for context */}
        <p className="goal-progress-modal__title">{goal.title}</p>

        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Progress slider */}
          <div className="form-group">
            <label htmlFor="progress-slider">
              Progress: <strong>{progress}%</strong>
            </label>
            <input
              id="progress-slider"
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="goal-progress-slider"
              aria-label={`Progress: ${progress}%`}
            />
            {/* Visual tick marks */}
            <div className="goal-progress-slider__ticks">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Comment */}
          <div className="form-group">
            <label htmlFor="progress-comment">Comment (optional)</label>
            <textarea
              id="progress-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What progress have you made?"
              rows={3}
              className="form-textarea"
            />
          </div>

          {/* Actions */}
          <div className="modal-dialog__footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Update Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GoalProgressUpdate;
