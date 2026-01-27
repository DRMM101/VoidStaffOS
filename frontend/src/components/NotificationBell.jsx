/**
 * VoidStaffOS - Notification Bell Component
 * Notification icon with unread count badge.
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

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';

function NotificationBell({ onViewAll, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingPolicies, setPendingPolicies] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    fetchPendingPolicies();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchPendingPolicies();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setUnreadCount(data.unread_count);
      }
    } catch (err) {
      console.error('Failed to fetch unread count');
    }
  };

  const fetchPendingPolicies = async () => {
    try {
      const response = await fetch('/api/policies/my-stats', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setPendingPolicies(data.pending || 0);
      }
    } catch (err) {
      console.error('Failed to fetch pending policies');
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=10', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      }
    } catch (err) {
      console.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiFetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
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
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read');
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
      'kpi_revealed': '📊',
      'policy_requires_acknowledgment': '📋',
      'pending_policies': '📋'
    };
    return icons[type] || '🔔';
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button className="notification-bell-btn" onClick={handleBellClick}>
        <span className="bell-icon">🔔</span>
        {(unreadCount + pendingPolicies) > 0 && (
          <span className="notification-badge">
            {(unreadCount + pendingPolicies) > 99 ? '99+' : (unreadCount + pendingPolicies)}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-dropdown-body">
            {pendingPolicies > 0 && (
              <div
                className="notification-item unread policy-alert"
                onClick={() => {
                  setIsOpen(false);
                  if (onNavigate) onNavigate('policies');
                }}
              >
                <span className="notification-icon">📋</span>
                <div className="notification-content">
                  <div className="notification-title">Policies Pending</div>
                  <div className="notification-message">
                    You have {pendingPolicies} {pendingPolicies === 1 ? 'policy' : 'policies'} requiring acknowledgment
                  </div>
                </div>
                <span className="notification-unread-dot"></span>
              </div>
            )}
            {loading ? (
              <div className="notification-loading">Loading...</div>
            ) : notifications.length === 0 && pendingPolicies === 0 ? (
              <div className="notification-empty">No notifications</div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <span className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{formatTime(notification.created_at)}</div>
                  </div>
                  {!notification.is_read && (
                    <span className="notification-unread-dot"></span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="notification-dropdown-footer">
            <button
              className="view-all-btn"
              onClick={() => {
                setIsOpen(false);
                if (onViewAll) onViewAll();
              }}
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
