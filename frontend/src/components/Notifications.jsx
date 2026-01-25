/**
 * VoidStaffOS - Notifications Component
 * Full notifications list view.
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

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function Notifications({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=100', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setNotifications(data.notifications);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiFetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', {
        method: 'PUT'
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      setError('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await apiFetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification');
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'manager_snapshot_committed': '📊',
      'snapshot_overdue': '⚠️',
      'self_reflection_overdue': '⚠️',
      'leave_request_pending': '🏖️',
      'leave_request_approved': '✅',
      'leave_request_rejected': '❌',
      'employee_transferred': '👥',
      'new_direct_report': '👥',
      'kpi_revealed': '📊'
    };
    return icons[type] || '🔔';
  };

  const getNotificationCategory = (type) => {
    if (['manager_snapshot_committed', 'snapshot_overdue', 'self_reflection_overdue', 'kpi_revealed'].includes(type)) {
      return 'performance';
    }
    if (['leave_request_pending', 'leave_request_approved', 'leave_request_rejected'].includes(type)) {
      return 'leave';
    }
    if (['employee_transferred', 'new_direct_report'].includes(type)) {
      return 'team';
    }
    return 'other';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return getNotificationCategory(n.type) === filter;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          <div className="loading">Loading notifications...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large notifications-page">
        <div className="modal-header">
          <h3>Notifications {unreadCount > 0 && <span className="header-badge">{unreadCount} unread</span>}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="notifications-toolbar">
          <div className="notification-filters">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
            <button
              className={`filter-btn ${filter === 'performance' ? 'active' : ''}`}
              onClick={() => setFilter('performance')}
            >
              📊 Performance
            </button>
            <button
              className={`filter-btn ${filter === 'leave' ? 'active' : ''}`}
              onClick={() => setFilter('leave')}
            >
              🏖️ Leave
            </button>
            <button
              className={`filter-btn ${filter === 'team' ? 'active' : ''}`}
              onClick={() => setFilter('team')}
            >
              👥 Team
            </button>
          </div>

          {unreadCount > 0 && (
            <button className="mark-all-read-btn" onClick={markAllAsRead}>
              Mark All as Read
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="notifications-list">
          {filteredNotifications.length === 0 ? (
            <div className="no-notifications">
              <div className="no-notifications-icon">🔔</div>
              <p>No notifications to display</p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-card ${!notification.is_read ? 'unread' : ''}`}
              >
                <div className="notification-card-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-card-content">
                  <div className="notification-card-header">
                    <span className="notification-card-title">{notification.title}</span>
                    <span className="notification-card-time">{formatDate(notification.created_at)}</span>
                  </div>
                  <div className="notification-card-message">{notification.message}</div>
                  <div className="notification-card-category">
                    {getNotificationCategory(notification.type)}
                  </div>
                </div>
                <div className="notification-card-actions">
                  {!notification.is_read && (
                    <button
                      className="notification-action-btn read"
                      onClick={() => markAsRead(notification.id)}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    className="notification-action-btn delete"
                    onClick={() => deleteNotification(notification.id)}
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="form-actions">
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>
    </div>
  );
}

export default Notifications;
