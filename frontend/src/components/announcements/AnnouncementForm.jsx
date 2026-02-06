// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — AnnouncementForm Component
 * Create or edit an announcement. Supports Save as Draft and Publish actions.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

function AnnouncementForm({ announcement, onClose, onSave }) {
  const isEditing = !!announcement;

  // Form state — pre-populate for edit mode
  const [title, setTitle] = useState(announcement?.title || '');
  const [content, setContent] = useState(announcement?.content || '');
  const [category, setCategory] = useState(announcement?.category || 'general');
  const [priority, setPriority] = useState(announcement?.priority || 'normal');
  const [expiresAt, setExpiresAt] = useState(announcement?.expires_at?.split('T')[0] || '');
  const [pinned, setPinned] = useState(announcement?.pinned || false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /** Submit the form with a given publish action */
  const handleSubmit = async (e, publishImmediately = false) => {
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
        content: content.trim() || null,
        category,
        priority,
        expires_at: expiresAt || null,
        pinned
      };

      await onSave(payload, announcement?.id, publishImmediately);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit announcement' : 'Create announcement'}>
      <div className="modal-dialog modal--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>{isEditing ? 'Edit Announcement' : 'Create Announcement'}</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div className="opportunity-form__grid">
            {/* Title */}
            <div className="opportunity-form__field opportunity-form__field--full">
              <label htmlFor="ann-title">Title *</label>
              <input
                id="ann-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Office closure notice"
                required
                maxLength={255}
              />
            </div>

            {/* Content */}
            <div className="opportunity-form__field opportunity-form__field--full">
              <label htmlFor="ann-content">Content</label>
              <textarea
                id="ann-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Full announcement text…"
                rows={6}
              />
            </div>

            {/* Category */}
            <div className="opportunity-form__field">
              <label htmlFor="ann-category">Category</label>
              <select
                id="ann-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="general">General</option>
                <option value="urgent">Urgent</option>
                <option value="policy">Policy</option>
                <option value="event">Event</option>
                <option value="celebration">Celebration</option>
              </select>
            </div>

            {/* Priority */}
            <div className="opportunity-form__field">
              <label htmlFor="ann-priority">Priority</label>
              <select
                id="ann-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Expires at */}
            <div className="opportunity-form__field">
              <label htmlFor="ann-expires">Expires At (optional)</label>
              <input
                id="ann-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            {/* Pinned toggle */}
            <div className="opportunity-form__field">
              <label className="announcement-form__toggle-label">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                Pin this announcement
              </label>
              <span className="opportunity-form__hint">Pinned announcements appear first and in the dashboard ticker.</span>
            </div>

            {/* Actions: Save Draft + Publish */}
            <div className="opportunity-form__actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-secondary" disabled={saving}>
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={(e) => handleSubmit(e, true)}
              >
                {saving ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AnnouncementForm;
