/**
 * HeadOfficeOS - Team Performance Component
 * Displays team performance metrics for managers.
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
import './TeamPerformance.css';

function KPIBadge({ value, status }) {
  if (value === null) {
    return <span className="kpi-badge none">-</span>;
  }

  const emoji = status === 'green' ? '\u{1F7E2}' :
                status === 'amber' ? '\u{1F7E0}' :
                status === 'red' ? '\u{1F534}' : '';

  return (
    <span className={`kpi-badge ${status}`}>
      {emoji} {value.toFixed(1)}
    </span>
  );
}

function StalenessIndicator({ status, daysSince }) {
  if (status === 'current') {
    return <span className="staleness current" title="Up to date">✓</span>;
  }
  if (status === 'stale') {
    return <span className="staleness stale" title={`${daysSince} days ago`}>⚠️</span>;
  }
  return <span className="staleness overdue" title={`${daysSince || 'No'} review`}>!</span>;
}

export default function TeamPerformance({ user, onCreateSnapshot, onViewMember }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTeamSummary();
  }, []);

  async function fetchTeamSummary() {
    try {
      const response = await fetch('/api/users/team-summary', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch team data');
      }

      const data = await response.json();
      setTeamData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function getTierBadge(tier) {
    if (tier === null) return 'Admin';
    return `T${tier}`;
  }

  if (loading) {
    return (
      <div className="team-performance">
        <div className="loading-small">Loading team data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-performance">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!teamData || teamData.team_members.length === 0) {
    return (
      <div className="team-performance">
        <div className="card-header">
          <h3>My Team Performance</h3>
        </div>
        <div className="no-team-message">
          <p>No direct reports found.</p>
        </div>
      </div>
    );
  }

  const { team_members, team_averages, summary } = teamData;

  return (
    <div className="team-performance">
      <div className="card-header">
        <h3>My Team Performance</h3>
        <span className="team-count">{summary.total_members} members</span>
      </div>

      {/* Team Summary Card */}
      <div className="team-summary-card">
        <div className="summary-kpis">
          <div className="summary-kpi">
            <span className="kpi-label">Team Velocity</span>
            <KPIBadge value={team_averages.velocity.value} status={team_averages.velocity.status} />
          </div>
          <div className="summary-kpi">
            <span className="kpi-label">Team Friction</span>
            <KPIBadge value={team_averages.friction.value} status={team_averages.friction.status} />
          </div>
          <div className="summary-kpi">
            <span className="kpi-label">Team Cohesion</span>
            <KPIBadge value={team_averages.cohesion.value} status={team_averages.cohesion.status} />
          </div>
        </div>

        <div className="summary-alerts">
          {summary.needs_attention > 0 && (
            <div className="alert-item attention">
              <span className="alert-icon">{'\u{1F534}'}</span>
              <span>{summary.needs_attention} need{summary.needs_attention !== 1 ? '' : 's'} attention</span>
            </div>
          )}
          {summary.overdue_reviews > 0 && (
            <div className="alert-item overdue">
              <span className="alert-icon">!</span>
              <span>{summary.overdue_reviews} overdue review{summary.overdue_reviews !== 1 ? 's' : ''}</span>
            </div>
          )}
          {summary.needs_attention === 0 && summary.overdue_reviews === 0 && (
            <div className="alert-item good">
              <span className="alert-icon">{'\u{2705}'}</span>
              <span>All team members on track</span>
            </div>
          )}
        </div>
      </div>

      {/* Team Members Table */}
      <div className="team-table-container">
        <table className="team-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Tier</th>
              <th>Velocity</th>
              <th>Friction</th>
              <th>Cohesion</th>
              <th>Last Review</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {team_members.map(member => {
              const hasRedKpi =
                member.kpis.velocity.status === 'red' ||
                member.kpis.friction.status === 'red' ||
                member.kpis.cohesion.status === 'red';

              return (
                <tr
                  key={member.id}
                  className={`${hasRedKpi ? 'needs-attention' : ''} ${member.is_overdue ? 'overdue' : ''}`}
                >
                  <td className="member-name">
                    <span className="name">{member.full_name}</span>
                    <span className="role">{member.role_name}</span>
                  </td>
                  <td>
                    <span className="tier-badge">{getTierBadge(member.tier)}</span>
                  </td>
                  <td>
                    <KPIBadge
                      value={member.kpis.velocity.value}
                      status={member.kpis.velocity.status}
                    />
                  </td>
                  <td>
                    <KPIBadge
                      value={member.kpis.friction.value}
                      status={member.kpis.friction.status}
                    />
                  </td>
                  <td>
                    <KPIBadge
                      value={member.kpis.cohesion.value}
                      status={member.kpis.cohesion.status}
                    />
                  </td>
                  <td>
                    <div className="review-date">
                      <span className="date">{formatDate(member.last_review_date)}</span>
                      <StalenessIndicator
                        status={member.staleness_status}
                        daysSince={member.days_since_review}
                      />
                    </div>
                  </td>
                  <td className="actions">
                    {member.is_overdue ? (
                      <button
                        className="btn-snapshot"
                        onClick={() => onCreateSnapshot && onCreateSnapshot(member)}
                        title="Create snapshot"
                      >
                        Snapshot
                      </button>
                    ) : (
                      <button
                        className="btn-view"
                        onClick={() => onViewMember && onViewMember(member)}
                        title="View details"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* KPI Legend */}
      <div className="kpi-legend">
        <span className="legend-item">
          <span className="legend-color green">{'\u{1F7E2}'}</span> 6.5+ Good
        </span>
        <span className="legend-item">
          <span className="legend-color amber">{'\u{1F7E0}'}</span> 5-6.5 Needs work
        </span>
        <span className="legend-item">
          <span className="legend-color red">{'\u{1F534}'}</span> &lt;5 Attention
        </span>
      </div>
    </div>
  );
}
