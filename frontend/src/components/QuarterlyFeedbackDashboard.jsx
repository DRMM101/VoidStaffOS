/**
 * VoidStaffOS - Quarterly Feedback Dashboard Component
 * Admin dashboard for managing feedback cycles.
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
import './QuarterlyFeedbackDashboard.css';

function getCurrentQuarter() {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
}

function getQuarterOptions() {
  const options = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  // Current and next quarter
  for (let y = currentYear; y <= currentYear + 1; y++) {
    for (let q = 1; q <= 4; q++) {
      options.push(`Q${q}-${y}`);
    }
  }
  return options;
}

export default function QuarterlyFeedbackDashboard({ onClose }) {
  const [activeCycles, setActiveCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [cycleStatus, setCycleStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const [newQuarter, setNewQuarter] = useState(getCurrentQuarter());
  const [deadline, setDeadline] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchActiveCycles();
  }, []);

  const fetchActiveCycles = async () => {
    try {
      const response = await fetch('/api/feedback/cycles', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setActiveCycles(data.cycles || []);
        if (data.cycles?.length > 0) {
          setSelectedCycle(data.cycles[0].quarter);
        }
      }
    } catch (err) {
      setError('Failed to fetch feedback cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCycle) {
      fetchCycleStatus(selectedCycle);
    }
  }, [selectedCycle]);

  const fetchCycleStatus = async (quarter) => {
    try {
      const response = await fetch(`/api/feedback/cycle-status/${quarter}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setCycleStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch cycle status');
    }
  };

  const handleStartCycle = async () => {
    setStarting(true);
    setError('');
    try {
      const response = await apiFetch(`/api/feedback/request-cycle/${newQuarter}`, {
        method: 'POST',
        body: JSON.stringify({ deadline: deadline || null })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }
      setShowStartModal(false);
      fetchActiveCycles();
      setSelectedCycle(newQuarter);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const handleCloseCycle = async (quarter) => {
    if (!confirm(`Are you sure you want to close the ${quarter} feedback cycle?`)) return;

    try {
      const response = await apiFetch(`/api/feedback/close-cycle/${quarter}`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchActiveCycles();
      }
    } catch (err) {
      setError('Failed to close cycle');
    }
  };

  const getProgressPercentage = () => {
    if (!cycleStatus?.stats) return 0;
    const { total_requests, submitted } = cycleStatus.stats;
    return total_requests > 0 ? Math.round((submitted / total_requests) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="feedback-dashboard-modal" onClick={e => e.stopPropagation()}>
          <div className="loading">Loading feedback dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="feedback-dashboard-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>360 Feedback Dashboard</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="dashboard-actions">
          <button className="btn-start-cycle" onClick={() => setShowStartModal(true)}>
            Start New Feedback Cycle
          </button>
        </div>

        {activeCycles.length === 0 ? (
          <div className="no-cycles">
            <p>No active feedback cycles.</p>
            <p className="hint">Start a new quarterly feedback cycle to collect 360 feedback.</p>
          </div>
        ) : (
          <>
            <div className="cycle-tabs">
              {activeCycles.map(cycle => (
                <button
                  key={cycle.quarter}
                  className={`cycle-tab ${selectedCycle === cycle.quarter ? 'active' : ''}`}
                  onClick={() => setSelectedCycle(cycle.quarter)}
                >
                  {cycle.quarter}
                  <span className="tab-progress">
                    {Math.round((cycle.submitted_requests / cycle.total_requests) * 100)}%
                  </span>
                </button>
              ))}
            </div>

            {cycleStatus && (
              <div className="cycle-details">
                <div className="progress-section">
                  <div className="progress-header">
                    <h3>Collection Progress</h3>
                    <span className="progress-percentage">{getProgressPercentage()}% Complete</span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                  <div className="progress-stats">
                    <div className="stat">
                      <span className="stat-value">{cycleStatus.stats.submitted}</span>
                      <span className="stat-label">Submitted</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{cycleStatus.stats.pending}</span>
                      <span className="stat-label">Pending</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{cycleStatus.stats.total_requests}</span>
                      <span className="stat-label">Total</span>
                    </div>
                  </div>
                </div>

                <div className="deadline-info">
                  {cycleStatus.cycle.deadline ? (
                    <p>Deadline: <strong>{new Date(cycleStatus.cycle.deadline).toLocaleDateString()}</strong></p>
                  ) : (
                    <p>No deadline set</p>
                  )}
                </div>

                <div className="employees-section">
                  <h3>Employee Breakdown</h3>
                  <div className="employees-table-container">
                    <table className="employees-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Progress</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cycleStatus.employees.map(emp => (
                          <tr key={emp.id}>
                            <td className="emp-name">{emp.full_name}</td>
                            <td>
                              <div className="mini-progress">
                                <div
                                  className="mini-progress-fill"
                                  style={{ width: `${(emp.received / emp.total_feedback) * 100}%` }}
                                />
                              </div>
                              <span className="mini-progress-text">
                                {emp.received}/{emp.total_feedback}
                              </span>
                            </td>
                            <td>
                              {emp.composite_ready ? (
                                <span className="status-badge complete">Complete</span>
                              ) : emp.pending === 0 ? (
                                <span className="status-badge processing">Processing</span>
                              ) : (
                                <span className="status-badge pending">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="cycle-actions">
                  <button
                    className="btn-close-cycle"
                    onClick={() => handleCloseCycle(selectedCycle)}
                  >
                    Close Cycle
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Start Cycle Modal */}
        {showStartModal && (
          <div className="sub-modal-overlay" onClick={() => setShowStartModal(false)}>
            <div className="sub-modal" onClick={e => e.stopPropagation()}>
              <h3>Start Feedback Cycle</h3>
              <div className="form-group">
                <label>Quarter</label>
                <select
                  value={newQuarter}
                  onChange={(e) => setNewQuarter(e.target.value)}
                >
                  {getQuarterOptions().map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Deadline (Optional)</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div className="sub-modal-actions">
                <button className="btn-cancel" onClick={() => setShowStartModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn-confirm"
                  onClick={handleStartCycle}
                  disabled={starting}
                >
                  {starting ? 'Starting...' : 'Start Cycle'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
