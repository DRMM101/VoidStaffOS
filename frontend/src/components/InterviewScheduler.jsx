/**
 * VoidStaffOS - Interview Scheduler Component
 * Schedule and manage candidate interviews.
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
import './InterviewScheduler.css';

const INTERVIEW_TYPES = [
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'first_interview', label: 'First Interview' },
  { value: 'second_interview', label: 'Second Interview' },
  { value: 'technical', label: 'Technical Interview' },
  { value: 'panel', label: 'Panel Interview' },
  { value: 'final', label: 'Final Interview' }
];

export default function InterviewScheduler({ candidateId, onClose, onScheduled }) {
  const [formData, setFormData] = useState({
    interview_type: 'first_interview',
    scheduled_date: '',
    scheduled_time: '10:00',
    duration_minutes: 60,
    location: '',
    interviewer_ids: []
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(`/api/pipeline/candidates/${candidateId}/interviews`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to schedule interview');
      }

      onScheduled();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleInterviewerChange(userId) {
    setFormData(prev => {
      const ids = [...prev.interviewer_ids];
      const index = ids.indexOf(userId);
      if (index === -1) {
        ids.push(userId);
      } else {
        ids.splice(index, 1);
      }
      return { ...prev, interviewer_ids: ids };
    });
  }

  return (
    <div className="scheduler-overlay" onClick={onClose}>
      <div className="scheduler-modal" onClick={e => e.stopPropagation()}>
        <div className="scheduler-header">
          <h3>Schedule Interview</h3>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Interview Type</label>
            <select
              value={formData.interview_type}
              onChange={e => setFormData({ ...formData, interview_type: e.target.value })}
              required
            >
              {INTERVIEW_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={e => setFormData({ ...formData, scheduled_time: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Duration (mins)</label>
              <select
                value={formData.duration_minutes}
                onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              >
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Location / Video Link</label>
            <input
              type="text"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Meeting Room 3 or https://zoom.us/..."
            />
          </div>

          <div className="form-group">
            <label>Interviewers</label>
            <div className="interviewer-list">
              {users.filter(u => u.role_name === 'Manager' || u.role_name === 'Admin' || u.role_name === 'HR Manager').map(user => (
                <label key={user.id} className="interviewer-option">
                  <input
                    type="checkbox"
                    checked={formData.interviewer_ids.includes(user.id)}
                    onChange={() => handleInterviewerChange(user.id)}
                  />
                  <span>{user.full_name}</span>
                  <span className="role-badge">{user.role_name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Interview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
