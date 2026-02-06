// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — AnnouncementsPage Component
 * Employee view of company announcements. Shows published announcements
 * with filter tabs (All / Unread / Pinned) and category filter.
 * Clicking a card opens the detail modal and auto-marks as read.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bell, Settings } from 'lucide-react';
import api from '../../utils/api';
import AnnouncementCard from './AnnouncementCard';
import AnnouncementDetailModal from './AnnouncementDetailModal';

/** Filter tab options */
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'pinned', label: 'Pinned' }
];

/** Category filter options */
const CATEGORIES = [
  { key: '', label: 'All Categories' },
  { key: 'general', label: 'General' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'policy', label: 'Policy' },
  { key: 'event', label: 'Event' },
  { key: 'celebration', label: 'Celebration' }
];

function AnnouncementsPage({ user, onNavigate }) {
  // Data state
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [activeTab, setActiveTab] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal state
  const [viewAnnouncement, setViewAnnouncement] = useState(null);

  // Role check for admin link
  const isAdmin = user.role_name === 'Admin';

  /** Fetch announcements from the API */
  const fetchAnnouncements = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/announcements');
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      setError('Failed to load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  /** Filter announcements by tab + category */
  const filteredAnnouncements = announcements.filter(ann => {
    // Tab filter
    if (activeTab === 'unread' && ann.read) return false;
    if (activeTab === 'pinned' && !ann.pinned) return false;

    // Category filter
    if (categoryFilter && ann.category !== categoryFilter) return false;

    return true;
  });

  /** Unread count for the badge */
  const unreadCount = announcements.filter(a => !a.read).length;

  /** Handle marking as read — update local state to avoid refetch */
  const handleMarkedRead = useCallback((announcementId) => {
    setAnnouncements(prev =>
      prev.map(a => a.id === announcementId ? { ...a, read: true } : a)
    );
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="announcements-page">
        <div className="loading">Loading announcements…</div>
      </div>
    );
  }

  return (
    <div className="announcements-page">
      {/* Page header */}
      <div className="announcements-page__header">
        <div>
          <h2 className="announcements-page__title">
            <Bell size={24} aria-hidden="true" />
            Announcements
          </h2>
          <p className="announcements-page__subtitle">
            Company news and updates
            {unreadCount > 0 && (
              <span className="announcements-page__unread-badge">{unreadCount} unread</span>
            )}
          </p>
        </div>

        {/* Admin link to manage announcements */}
        {isAdmin && (
          <button
            className="btn-secondary"
            onClick={() => onNavigate('announcements-admin')}
            aria-label="Manage announcements"
          >
            <Settings size={16} aria-hidden="true" />
            Manage
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">{error}</div>
      )}

      {/* Filter bar: tabs + category */}
      <div className="goals-filters">
        <div className="goals-filters__tabs" role="tablist" aria-label="Filter announcements">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`goals-filters__tab ${activeTab === tab.key ? 'goals-filters__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {/* Show unread count on Unread tab */}
              {tab.key === 'unread' && unreadCount > 0 && (
                <span className="announcements-tab__count">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        <select
          className="goals-filters__category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.key} value={cat.key}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Announcements grid */}
      {filteredAnnouncements.length === 0 ? (
        <div className="goals-empty" role="status">
          <Bell size={48} className="goals-empty__icon" aria-hidden="true" />
          <h3 className="goals-empty__title">No announcements</h3>
          <p className="goals-empty__text">
            {activeTab === 'unread'
              ? 'You\'ve read all announcements!'
              : 'No announcements to display.'}
          </p>
        </div>
      ) : (
        <div className="announcements-grid" role="list">
          {filteredAnnouncements.map(ann => (
            <AnnouncementCard
              key={ann.id}
              announcement={ann}
              onClick={(a) => setViewAnnouncement(a)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {viewAnnouncement && (
        <AnnouncementDetailModal
          announcementId={viewAnnouncement.id}
          onClose={() => setViewAnnouncement(null)}
          onMarkedRead={handleMarkedRead}
        />
      )}
    </div>
  );
}

export default AnnouncementsPage;
