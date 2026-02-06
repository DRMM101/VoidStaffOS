// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — AnnouncementCard Component
 * Displays an individual announcement as a card with category badge,
 * priority indicator, pinned icon, read/unread state, and content preview.
 */

import { Pin, AlertTriangle } from 'lucide-react';

/** Map category to CSS modifier class for badge colour */
const CATEGORY_CLASS = {
  general: 'announcement-badge--grey',
  urgent: 'announcement-badge--red',
  policy: 'announcement-badge--indigo',
  event: 'announcement-badge--teal',
  celebration: 'announcement-badge--amber'
};

/** Human-readable category labels */
const CATEGORY_LABEL = {
  general: 'General',
  urgent: 'Urgent',
  policy: 'Policy',
  event: 'Event',
  celebration: 'Celebration'
};

/** Format date to en-GB locale */
function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

/** Truncate text to a max length, adding ellipsis if needed */
function truncate(text, maxLen = 120) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + '…';
}

function AnnouncementCard({ announcement, onClick }) {
  const isUrgent = announcement.priority === 'urgent';
  const isHigh = announcement.priority === 'high';
  const isUnread = !announcement.read;

  return (
    <div
      className={`announcement-card ${isUrgent ? 'announcement-card--urgent' : ''} ${isUnread ? 'announcement-card--unread' : ''}`}
      role="article"
      aria-label={`Announcement: ${announcement.title}`}
      onClick={() => onClick(announcement)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(announcement); }}
    >
      {/* Header: category badge + priority + pinned */}
      <div className="announcement-card__header">
        <div className="announcement-card__badges">
          {/* Category badge */}
          <span className={`announcement-badge ${CATEGORY_CLASS[announcement.category] || 'announcement-badge--grey'}`}>
            {CATEGORY_LABEL[announcement.category] || announcement.category}
          </span>

          {/* Priority indicator for high/urgent */}
          {(isUrgent || isHigh) && (
            <span className={`announcement-priority ${isUrgent ? 'announcement-priority--urgent' : 'announcement-priority--high'}`}>
              {isUrgent && <AlertTriangle size={12} aria-hidden="true" />}
              {announcement.priority}
            </span>
          )}
        </div>

        {/* Pinned icon */}
        {announcement.pinned && (
          <span className="announcement-card__pin" title="Pinned" aria-label="Pinned announcement">
            <Pin size={14} aria-hidden="true" />
          </span>
        )}
      </div>

      {/* Title with unread dot */}
      <h3 className="announcement-card__title">
        {isUnread && <span className="announcement-card__unread-dot" aria-label="Unread" />}
        {announcement.title}
      </h3>

      {/* Content preview */}
      {announcement.content && (
        <p className="announcement-card__preview">
          {truncate(announcement.content)}
        </p>
      )}

      {/* Footer: author + published date */}
      <div className="announcement-card__footer">
        {announcement.author_name && (
          <span className="announcement-card__author">{announcement.author_name}</span>
        )}
        {announcement.published_at && (
          <span className="announcement-card__date">{formatDate(announcement.published_at)}</span>
        )}
      </div>
    </div>
  );
}

export default AnnouncementCard;
