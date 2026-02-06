// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — AnnouncementDetailModal Component
 * Full announcement view modal. Auto-marks as read when opened.
 * Shows title, content, author, date, category, and priority.
 */

import { useState, useEffect } from 'react';
import { X, Clock, User } from 'lucide-react';
import api from '../../utils/api';

/** Map category to badge CSS modifier */
const CATEGORY_CLASS = {
  general: 'announcement-badge--grey',
  urgent: 'announcement-badge--red',
  policy: 'announcement-badge--indigo',
  event: 'announcement-badge--teal',
  celebration: 'announcement-badge--amber'
};

const CATEGORY_LABEL = {
  general: 'General',
  urgent: 'Urgent',
  policy: 'Policy',
  event: 'Event',
  celebration: 'Celebration'
};

/** Format date+time to en-GB locale */
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function AnnouncementDetailModal({ announcementId, onClose, onMarkedRead }) {
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Fetch announcement detail and auto-mark as read */
  useEffect(() => {
    const fetchAndMarkRead = async () => {
      try {
        setError(null);

        // Fetch the full announcement
        const data = await api.get(`/announcements/${announcementId}`);
        setAnnouncement(data.announcement);

        // Auto-mark as read (fire and forget — don't block UI)
        api.post(`/announcements/${announcementId}/read`).then(() => {
          // Notify parent to update read status in the list
          if (onMarkedRead) onMarkedRead(announcementId);
        }).catch(() => {
          // Silent fail — marking read is non-critical
        });
      } catch (err) {
        console.error('Failed to fetch announcement:', err);
        setError('Failed to load announcement.');
      } finally {
        setLoading(false);
      }
    };

    fetchAndMarkRead();
  }, [announcementId, onMarkedRead]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Announcement details">
      <div className="modal-dialog modal--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>Announcement</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading" style={{ padding: 'var(--space-lg)' }}>Loading…</div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        {/* Content */}
        {announcement && !loading && (
          <div className="announcement-detail">
            {/* Meta row: category + priority */}
            <div className="announcement-detail__meta">
              <span className={`announcement-badge ${CATEGORY_CLASS[announcement.category] || 'announcement-badge--grey'}`}>
                {CATEGORY_LABEL[announcement.category] || announcement.category}
              </span>
              {(announcement.priority === 'urgent' || announcement.priority === 'high') && (
                <span className={`announcement-priority announcement-priority--${announcement.priority}`}>
                  {announcement.priority}
                </span>
              )}
              {announcement.pinned && (
                <span className="announcement-detail__pinned">Pinned</span>
              )}
            </div>

            {/* Title */}
            <h2 className="announcement-detail__title">{announcement.title}</h2>

            {/* Author + date info */}
            <div className="announcement-detail__info">
              <span className="announcement-detail__info-item">
                <User size={14} aria-hidden="true" />
                {announcement.author_name}
              </span>
              <span className="announcement-detail__info-item">
                <Clock size={14} aria-hidden="true" />
                {formatDateTime(announcement.published_at || announcement.created_at)}
              </span>
            </div>

            {/* Full content body */}
            {announcement.content ? (
              <div className="announcement-detail__content">
                {announcement.content}
              </div>
            ) : (
              <p className="announcement-detail__no-content">No additional content.</p>
            )}

            {/* Expiry notice if set */}
            {announcement.expires_at && (
              <p className="announcement-detail__expiry">
                This announcement expires on {formatDateTime(announcement.expires_at)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnnouncementDetailModal;
