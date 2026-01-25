/**
 * VoidStaffOS - Pre-Colleague Portal Component
 * Self-service portal for pre-colleagues completing onboarding.
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

function PreColleaguePortal({ user, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  const fetchOnboardingData = async () => {
    try {
      const response = await fetch('/api/onboarding/my-tasks', {
        credentials: 'include'
      });
      const result = await response.json();
      if (response.ok) {
        setData(result);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load onboarding data');
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId) => {
    try {
      const response = await apiFetch(`/api/onboarding/tasks/${taskId}/complete`, {
        method: 'PUT'
      });
      if (response.ok) {
        fetchOnboardingData();
      }
    } catch (err) {
      console.error('Failed to complete task');
    }
  };

  const acknowledgePolicy = async (policyId) => {
    try {
      const response = await apiFetch(`/api/onboarding/policies/${policyId}/acknowledge`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchOnboardingData();
      }
    } catch (err) {
      console.error('Failed to acknowledge policy');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTaskIcon = (type) => {
    const icons = {
      'document_read': '📖',
      'form_submit': '📝',
      'check_complete': '✓',
      'meeting': '👥',
      'training': '🎓'
    };
    return icons[type] || '📋';
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          <div className="loading">Loading your onboarding portal...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="error-message">{error}</div>
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>
    );
  }

  const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
  const acknowledgedPolicies = data.policies.filter(p => p.acknowledged).length;

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-xlarge pre-colleague-portal">
        <div className="modal-header">
          <h3>Welcome, {user.full_name}!</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="welcome-message">
            <h2>Your Onboarding Journey</h2>
            <p>Complete your tasks and read through the company policies before your start date.</p>
          </div>
          <div className="countdown-box">
            <span className="countdown-number">
              {data.days_until_start > 0 ? data.days_until_start : 0}
            </span>
            <span className="countdown-label">
              {data.days_until_start > 0 ? 'Days until you start' : 'Starting soon!'}
            </span>
            <span className="start-date">{formatDate(data.start_date)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-section">
          <div className="progress-header">
            <span>Onboarding Progress</span>
            <span className="progress-percentage">{data.progress.percentage}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${data.progress.percentage}%` }}
            />
          </div>
          <div className="progress-details">
            <span>{completedTasks} of {data.tasks.length} tasks complete</span>
            <span>{acknowledgedPolicies} of {data.policies.length} policies acknowledged</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="portal-tabs">
          <button
            className={`portal-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks ({completedTasks}/{data.tasks.length})
          </button>
          <button
            className={`portal-tab ${activeTab === 'policies' ? 'active' : ''}`}
            onClick={() => setActiveTab('policies')}
          >
            Policies ({acknowledgedPolicies}/{data.policies.length})
          </button>
          <button
            className={`portal-tab ${activeTab === 'day-one' ? 'active' : ''}`}
            onClick={() => setActiveTab('day-one')}
          >
            Day One Plan
          </button>
        </div>

        {/* Tab Content */}
        <div className="portal-content">
          {activeTab === 'tasks' && (
            <div className="tasks-section">
              <h4>Complete these tasks before your start date</h4>
              <div className="task-list">
                {data.tasks.map(task => (
                  <div
                    key={task.id}
                    className={`task-card ${task.status === 'completed' ? 'completed' : ''}`}
                  >
                    <div className="task-icon">{getTaskIcon(task.task_type)}</div>
                    <div className="task-info">
                      <h5>
                        {task.task_name}
                        {task.required_before_start && (
                          <span className="required-badge">Required</span>
                        )}
                      </h5>
                      {task.task_description && (
                        <p className="task-description">{task.task_description}</p>
                      )}
                      <span className="task-type">{task.task_type.replace('_', ' ')}</span>
                    </div>
                    <div className="task-action">
                      {task.status === 'completed' ? (
                        <span className="completed-badge">
                          ✓ Completed
                        </span>
                      ) : (
                        <button
                          className="btn-complete"
                          onClick={() => completeTask(task.id)}
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'policies' && (
            <div className="policies-section">
              <h4>Read and acknowledge these policies</h4>
              <p className="section-note">
                Please read each policy carefully. By acknowledging, you confirm you have read and understood the content.
              </p>
              <div className="policy-list">
                {data.policies.map(policy => (
                  <div
                    key={policy.id}
                    className={`policy-card ${policy.acknowledged ? 'acknowledged' : ''}`}
                  >
                    <div className="policy-info">
                      <h5>{policy.policy_name}</h5>
                      <span className="policy-version">Version {policy.policy_version}</span>
                      {policy.policy_content && (
                        <p className="policy-summary">{policy.policy_content}</p>
                      )}
                    </div>
                    <div className="policy-action">
                      {policy.acknowledged ? (
                        <span className="acknowledged-badge">
                          ✓ Acknowledged
                          <small>{new Date(policy.acknowledged_at).toLocaleDateString()}</small>
                        </span>
                      ) : (
                        <button
                          className="btn-acknowledge"
                          onClick={() => acknowledgePolicy(policy.id)}
                        >
                          I have read and understood this policy
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'day-one' && (
            <div className="day-one-section">
              <h4>Your First Day Schedule</h4>
              <p className="section-note">
                Here's what to expect on {formatDate(data.start_date)}
              </p>

              {data.day_one_plan.length === 0 ? (
                <div className="no-plan">
                  <p>Your Day One plan is being prepared. Check back soon!</p>
                </div>
              ) : (
                <div className="day-one-timeline">
                  {data.day_one_plan.map((item, idx) => (
                    <div key={item.id || idx} className="timeline-item">
                      <div className="timeline-time">{item.time_slot}</div>
                      <div className="timeline-content">
                        <h5>{item.activity}</h5>
                        {item.location && (
                          <div className="timeline-detail">
                            <span className="detail-icon">📍</span>
                            {item.location}
                          </div>
                        )}
                        {item.meeting_with && (
                          <div className="timeline-detail">
                            <span className="detail-icon">👤</span>
                            {item.meeting_with}
                          </div>
                        )}
                        {item.notes && (
                          <p className="timeline-notes">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="day-one-reminders">
                <h5>What to Bring</h5>
                <ul>
                  <li>Valid photo ID (passport or driving licence)</li>
                  <li>Proof of right to work documents</li>
                  <li>Bank details for payroll</li>
                  <li>Emergency contact information</li>
                  <li>Any completed pre-start paperwork</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>
    </div>
  );
}

export default PreColleaguePortal;
