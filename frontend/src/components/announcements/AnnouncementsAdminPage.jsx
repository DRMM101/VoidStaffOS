// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — AnnouncementsAdminPage Component
 * Admin management view for announcements. Table layout with
 * create/edit/publish/archive actions and read count tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus } from 'lucide-react';
import api from '../../utils/api';
import AnnouncementForm from './AnnouncementForm';
import AnnouncementReadReceipts from './AnnouncementReadReceipts';

/** Status filter options */
const STATUS_FILTERS = [
  { key: '', label: 'All Statuses' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' }
];

/** Format date to en-GB locale */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function AnnouncementsAdminPage({ user, onNavigate }) {
  // Data state
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [viewingReceipts, setViewingReceipts] = useState(null);

  /** Fetch all announcements (admin view) */
  const fetchAnnouncements = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/announcements/all');
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      setError('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  /** Filter announcements by status */
  const filteredAnnouncements = statusFilter
    ? announcements.filter(a => a.status === statusFilter)
    : announcements;

  /** Save a new or edited announcement */
  const handleSave = async (payload, announcementId, publishImmediately) => {
    if (announcementId) {
      // Update existing
      await api.put(`/announcements/${announcementId}`, payload);
    } else {
      // Create new
      const data = await api.post('/announcements', payload);

      // If publishing immediately, publish after creation
      if (publishImmediately && data.announcement) {
        await api.post(`/announcements/${data.announcement.id}/publish`);
      }
    }
    await fetchAnnouncements();
  };

  /** Publish a draft announcement */
  const handlePublish = async (id) => {
    try {
      await api.post(`/announcements/${id}/publish`);
      await fetchAnnouncements();
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  };

  /** Archive a published announcement */
  const handleArchive = async (id) => {
    try {
      await api.post(`/announcements/${id}/archive`);
      await fetchAnnouncements();
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  /** Delete an announcement */
  const handleDelete = async (id) => {
    try {
      await api.delete(`/announcements/${id}`);
      await fetchAnnouncements();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  /** Render action buttons based on announcement status */
  const renderActions = (ann) => {
    switch (ann.status) {
      case 'draft':
        return (
          <div className="opportunity-actions">
            <button
              className="opportunity-actions__btn opportunity-actions__btn--edit"
              onClick={() => setEditingAnnouncement(ann)}
            >
              Edit
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--publish"
              onClick={() => handlePublish(ann.id)}
            >
              Publish
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--delete"
              onClick={() => handleDelete(ann.id)}
            >
              Delete
            </button>
          </div>
        );
      case 'published':
        return (
          <div className="opportunity-actions">
            <button
              className="opportunity-actions__btn opportunity-actions__btn--edit"
              onClick={() => setEditingAnnouncement(ann)}
            >
              Edit
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--view"
              onClick={() => setViewingReceipts(ann)}
            >
              Reads ({ann.read_count || 0})
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--close"
              onClick={() => handleArchive(ann.id)}
            >
              Archive
            </button>
          </div>
        );
      case 'archived':
        return (
          <div className="opportunity-actions">
            <button
              className="opportunity-actions__btn opportunity-actions__btn--view"
              onClick={() => setViewingReceipts(ann)}
            >
              Reads ({ann.read_count || 0})
            </button>
          </div>
        );
      default:
        return null;
    }
  };

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
            Manage Announcements
          </h2>
          <p className="announcements-page__subtitle">
            Create, publish, and manage company announcements
          </p>
        </div>
        <div className="announcements-page__header-actions">
          <button
            className="btn-secondary"
            onClick={() => onNavigate('announcements')}
          >
            Employee View
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowCreateForm(true)}
            aria-label="Create new announcement"
          >
            <Plus size={16} aria-hidden="true" />
            New Announcement
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner" role="alert">{error}</div>
      )}

      {/* Status filter */}
      <div className="goals-filters">
        <select
          className="goals-filters__category"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map(sf => (
            <option key={sf.key} value={sf.key}>{sf.label}</option>
          ))}
        </select>
      </div>

      {/* Announcements table */}
      {filteredAnnouncements.length === 0 ? (
        <div className="goals-empty" role="status">
          <Bell size={48} className="goals-empty__icon" aria-hidden="true" />
          <h3 className="goals-empty__title">No announcements</h3>
          <p className="goals-empty__text">Create your first announcement to get started.</p>
        </div>
      ) : (
        <div className="announcements-admin__table-wrapper">
          <table className="announcements-admin__table" aria-label="Announcements list">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Category</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Reads</th>
                <th scope="col">Published</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnnouncements.map(ann => (
                <tr key={ann.id} className="announcements-admin__row">
                  {/* Title */}
                  <td className="announcements-admin__cell">
                    <span className="announcements-admin__title">
                      {ann.pinned && <span className="announcements-admin__pin-icon" title="Pinned">📌</span>}
                      {ann.title}
                    </span>
                  </td>
                  {/* Category badge */}
                  <td className="announcements-admin__cell">
                    <span className={`announcement-badge announcement-badge--${ann.category === 'general' ? 'grey' : ann.category === 'urgent' ? 'red' : ann.category === 'policy' ? 'indigo' : ann.category === 'event' ? 'teal' : 'amber'}`}>
                      {ann.category}
                    </span>
                  </td>
                  {/* Priority */}
                  <td className="announcements-admin__cell">
                    <span className={`announcement-priority ${ann.priority === 'urgent' ? 'announcement-priority--urgent' : ann.priority === 'high' ? 'announcement-priority--high' : ''}`}>
                      {ann.priority}
                    </span>
                  </td>
                  {/* Status badge */}
                  <td className="announcements-admin__cell">
                    <span className={`status-badge status-badge--${ann.status}`}>
                      {ann.status}
                    </span>
                  </td>
                  {/* Read count */}
                  <td className="announcements-admin__cell">
                    {ann.read_count || 0}
                  </td>
                  {/* Published date */}
                  <td className="announcements-admin__cell">
                    {formatDate(ann.published_at)}
                  </td>
                  {/* Actions */}
                  <td className="announcements-admin__cell">
                    {renderActions(ann)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit form modal */}
      {(showCreateForm || editingAnnouncement) && (
        <AnnouncementForm
          announcement={editingAnnouncement}
          onClose={() => { setShowCreateForm(false); setEditingAnnouncement(null); }}
          onSave={handleSave}
        />
      )}

      {/* Read receipts modal */}
      {viewingReceipts && (
        <AnnouncementReadReceipts
          announcement={viewingReceipts}
          onClose={() => setViewingReceipts(null)}
        />
      )}
    </div>
  );
}

export default AnnouncementsAdminPage;
