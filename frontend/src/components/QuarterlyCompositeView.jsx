/**
 * HeadOfficeOS - Quarterly Composite View Component
 * Displays employee's quarterly composite KPIs.
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
 * TRADE SECRET: Contains proprietary algorithms.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import './QuarterlyCompositeView.css';

function getStatusClass(value) {
  if (value == null) return 'none';
  if (value >= 6.5) return 'green';
  if (value >= 5) return 'amber';
  return 'red';
}

function getStatusEmoji(value) {
  if (value == null) return '';
  if (value >= 6.5) return '\u{1F7E2}';
  if (value >= 5) return '\u{1F7E0}';
  return '\u{1F534}';
}

function KPIBar({ label, value, sources }) {
  const maxValue = 10;
  const percentage = value ? (value / maxValue) * 100 : 0;

  return (
    <div className="kpi-bar-container">
      <div className="kpi-bar-header">
        <span className="kpi-label">{label}</span>
        <span className={`kpi-value ${getStatusClass(value)}`}>
          {getStatusEmoji(value)} {value?.toFixed(2) || '-'}
        </span>
      </div>
      <div className="kpi-bar-track">
        <div
          className={`kpi-bar-fill ${getStatusClass(value)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {sources && (
        <div className="kpi-sources">
          {sources.manager !== undefined && (
            <span className="source-item">
              Manager: <strong>{sources.manager?.toFixed(1) || '-'}</strong>
            </span>
          )}
          {sources.skip_level !== undefined && sources.skip_level !== null && (
            <span className="source-item">
              Skip-level: <strong>{sources.skip_level?.toFixed(1) || '-'}</strong>
            </span>
          )}
          {sources.direct_reports !== undefined && sources.direct_reports !== null && (
            <span className="source-item">
              Reports: <strong>{sources.direct_reports?.toFixed(1) || '-'}</strong>
            </span>
          )}
          {sources.self !== undefined && (
            <span className="source-item self">
              Self: <strong>{sources.self?.toFixed(1) || '-'}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PerceptionGap({ selfValue, othersAvg, label }) {
  if (selfValue == null || othersAvg == null) return null;

  const gap = selfValue - othersAvg;
  const absGap = Math.abs(gap);

  if (absGap < 0.5) return null; // No significant gap

  const isHigher = gap > 0;

  return (
    <div className={`perception-gap ${isHigher ? 'over' : 'under'}`}>
      <span className="gap-icon">{isHigher ? '\u{2B06}' : '\u{2B07}'}</span>
      <span className="gap-text">
        {label}: Self-rating {isHigher ? 'higher' : 'lower'} by {absGap.toFixed(1)} points
      </span>
    </div>
  );
}

export default function QuarterlyCompositeView({ employeeId, quarter, employeeName, onClose }) {
  const [composite, setComposite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    fetchComposite();
  }, [employeeId, quarter]);

  const fetchComposite = async () => {
    try {
      const response = await fetch(`/api/feedback/composite/${employeeId}/${quarter}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setComposite(data.composite);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const response = await apiFetch(`/api/feedback/composite/${employeeId}/${quarter}/sign`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setComposite(data.composite);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  const calculateOthersAvg = (managerVal, skipVal, reportsVal) => {
    const values = [managerVal, skipVal, reportsVal].filter(v => v != null);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="composite-view-modal" onClick={e => e.stopPropagation()}>
          <div className="loading">Loading composite results...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="composite-view-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>360 Feedback Results</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="error-state">
            <p>{error}</p>
            <p className="hint">The composite may not be ready yet if feedback is still pending.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="composite-view-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-info">
            <h2>{employeeName || composite.employee_name}</h2>
            <span className="quarter-badge">{quarter} 360 Feedback</span>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="composite-content">
          <div className="composite-summary">
            <h3>Final Composite KPIs</h3>
            <p className="summary-note">
              Calculated from manager, skip-level, direct reports, and self-assessment
            </p>

            <div className="kpi-bars">
              <KPIBar
                label="Velocity"
                value={composite.velocity}
                sources={{
                  manager: composite.manager_velocity,
                  skip_level: composite.skip_level_velocity,
                  self: composite.self_velocity
                }}
              />

              <KPIBar
                label="Friction"
                value={composite.friction}
                sources={{
                  manager: composite.manager_friction,
                  direct_reports: composite.direct_reports_friction,
                  self: composite.self_friction
                }}
              />

              <KPIBar
                label="Cohesion"
                value={composite.cohesion}
                sources={{
                  manager: composite.manager_cohesion,
                  direct_reports: composite.direct_reports_cohesion,
                  self: composite.self_cohesion
                }}
              />
            </div>
          </div>

          {/* Perception Gaps */}
          <div className="perception-gaps-section">
            <h3>Perception Gaps</h3>
            <PerceptionGap
              label="Velocity"
              selfValue={composite.self_velocity}
              othersAvg={calculateOthersAvg(
                composite.manager_velocity,
                composite.skip_level_velocity,
                null
              )}
            />
            <PerceptionGap
              label="Friction"
              selfValue={composite.self_friction}
              othersAvg={calculateOthersAvg(
                composite.manager_friction,
                null,
                composite.direct_reports_friction
              )}
            />
            <PerceptionGap
              label="Cohesion"
              selfValue={composite.self_cohesion}
              othersAvg={calculateOthersAvg(
                composite.manager_cohesion,
                null,
                composite.direct_reports_cohesion
              )}
            />
            {!composite.self_velocity && (
              <p className="no-gaps-note">No significant perception gaps detected.</p>
            )}
          </div>

          {/* Sign-off Section */}
          <div className="signoff-section">
            <h3>Sign-off</h3>
            <div className="signoff-status">
              <div className={`signoff-item ${composite.employee_signed_at ? 'signed' : ''}`}>
                <span className="signoff-icon">
                  {composite.employee_signed_at ? '\u{2705}' : '\u{23F3}'}
                </span>
                <span>Employee</span>
                {composite.employee_signed_at && (
                  <span className="signed-date">
                    {new Date(composite.employee_signed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className={`signoff-item ${composite.manager_signed_at ? 'signed' : ''}`}>
                <span className="signoff-icon">
                  {composite.manager_signed_at ? '\u{2705}' : '\u{23F3}'}
                </span>
                <span>Manager</span>
                {composite.manager_signed_at && (
                  <span className="signed-date">
                    {new Date(composite.manager_signed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {(!composite.employee_signed_at || !composite.manager_signed_at) && (
              <button
                className="btn-sign"
                onClick={handleSign}
                disabled={signing}
              >
                {signing ? 'Signing...' : 'Sign Off'}
              </button>
            )}
          </div>

          <div className="calculated-info">
            Calculated: {new Date(composite.calculated_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
