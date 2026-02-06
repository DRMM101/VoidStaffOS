// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GoalForm Component
 * Create or edit a goal. Managers can assign goals to direct reports
 * via an "Assign to" dropdown.
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../utils/api';

function GoalForm({ goal, onClose, onSave, isAdmin, isManager }) {
  const isEditing = !!goal;

  // Form state — pre-populate for edit mode
  const [title, setTitle] = useState(goal?.title || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [category, setCategory] = useState(goal?.category || 'performance');
  const [priority, setPriority] = useState(goal?.priority || 'medium');
  const [targetDate, setTargetDate] = useState(goal?.target_date?.split('T')[0] || '');
  const [assignedTo, setAssignedTo] = useState('');
  const [directReports, setDirectReports] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fetch direct reports if the user is a manager/admin (for assign dropdown)
  useEffect(() => {
    if (!isEditing && (isAdmin || isManager)) {
      const fetchReports = async () => {
        try {
          const data = await api.get('/users/my-team');
          setDirectReports(data.employees || []);
        } catch (err) {
          console.error('Failed to fetch direct reports:', err);
        }
      };
      fetchReports();
    }
  }, [isAdmin, isManager, isEditing]);

  /** Submit the form */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        priority,
        target_date: targetDate || null
      };

      // If assigning to someone else (create mode only)
      if (!isEditing && assignedTo) {
        payload.assigned_to = parseInt(assignedTo);
      }

      await onSave(payload, goal?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit goal' : 'Create goal'}>
      <div className="modal-dialog modal--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>{isEditing ? 'Edit Goal' : 'Create Goal'}</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="opportunity-form__grid">
            {/* Title */}
            <div className="opportunity-form__field opportunity-form__field--full">
              <label htmlFor="goal-title">Title *</label>
              <input
                id="goal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Complete leadership training"
                required
                maxLength={255}
              />
            </div>

            {/* Description */}
            <div className="opportunity-form__field opportunity-form__field--full">
              <label htmlFor="goal-desc">Description</label>
              <textarea
                id="goal-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what success looks like for this goal"
                rows={3}
              />
            </div>

            {/* Category */}
            <div className="opportunity-form__field">
              <label htmlFor="goal-category">Category</label>
              <select
                id="goal-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="performance">Performance</option>
                <option value="development">Development</option>
                <option value="project">Project</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            {/* Priority */}
            <div className="opportunity-form__field">
              <label htmlFor="goal-priority">Priority</label>
              <select
                id="goal-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Target date */}
            <div className="opportunity-form__field">
              <label htmlFor="goal-target">Target Date</label>
              <input
                id="goal-target"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            {/* Assign to (manager/admin only, create mode only) */}
            {!isEditing && (isAdmin || isManager) && directReports.length > 0 && (
              <div className="opportunity-form__field">
                <label htmlFor="goal-assign">Assign To</label>
                <select
                  id="goal-assign"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">Myself</option>
                  {directReports.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="opportunity-form__actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GoalForm;
