/**
 * VoidStaffOS - Probation Dashboard
 * HR view of all probations with filters and status overview.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import ProbationCard from './ProbationCard';
import ProbationExtendModal from './ProbationExtendModal';
import ProbationOutcomeModal from './ProbationOutcomeModal';

function ProbationDashboard({ user, onSelectProbation }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [extendModal, setExtendModal] = useState(null);
  const [outcomeModal, setOutcomeModal] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/probation/dashboard', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load dashboard');
      }
    } catch (err) {
      console.error('Error fetching probation dashboard:', err);
      setError('Failed to load probation dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredProbations = () => {
    if (!dashboard) return [];

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    switch (filter) {
      case 'ending-soon':
        return dashboard.probations.filter(p => {
          const endDate = new Date(p.end_date);
          return endDate <= thirtyDaysFromNow;
        });
      case 'overdue':
        return dashboard.probations.filter(p =>
          p.next_review_date && new Date(p.next_review_date) < today
        );
      case 'extended':
        return dashboard.probations.filter(p => p.extended);
      default:
        return dashboard.probations;
    }
  };

  const getStatusColor = (probation) => {
    const today = new Date();
    const endDate = new Date(probation.end_date);
    const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    if (probation.next_review_date && new Date(probation.next_review_date) < today) {
      return 'red'; // Overdue review
    }
    if (daysUntilEnd <= 14) {
      return 'red'; // Ending very soon
    }
    if (daysUntilEnd <= 30) {
      return 'amber'; // Ending soon
    }
    return 'green'; // On track
  };

  if (loading) {
    return <div className="loading">Loading probation dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const filteredProbations = getFilteredProbations();

  return (
    <div className="probation-dashboard">
      {/* Stats Summary */}
      <div className="probation-stats">
        <div className="stat-card">
          <h3>Active</h3>
          <div className="stat-value">{dashboard.stats.active_count || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Extended</h3>
          <div className="stat-value warning">{dashboard.stats.extended_count || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Passed (30d)</h3>
          <div className="stat-value success">{dashboard.stats.passed_last_30 || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Failed (30d)</h3>
          <div className="stat-value danger">{dashboard.stats.failed_last_30 || 0}</div>
        </div>
      </div>

      {/* Alerts */}
      {dashboard.overdueReviews.length > 0 && (
        <div className="probation-alert danger">
          <strong>Overdue Reviews:</strong> {dashboard.overdueReviews.length} review(s) are overdue
        </div>
      )}
      {dashboard.endingSoon.length > 0 && (
        <div className="probation-alert warning">
          <strong>Ending Soon:</strong> {dashboard.endingSoon.length} probation(s) ending within 30 days
        </div>
      )}

      {/* Filters */}
      <div className="probation-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({dashboard.probations.length})
        </button>
        <button
          className={`filter-btn ${filter === 'ending-soon' ? 'active' : ''}`}
          onClick={() => setFilter('ending-soon')}
        >
          Ending Soon ({dashboard.endingSoon.length})
        </button>
        <button
          className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilter('overdue')}
        >
          Overdue Reviews ({dashboard.overdueReviews.length})
        </button>
        <button
          className={`filter-btn ${filter === 'extended' ? 'active' : ''}`}
          onClick={() => setFilter('extended')}
        >
          Extended ({dashboard.stats.extended_count || 0})
        </button>
      </div>

      {/* Probation Cards */}
      <div className="probation-cards">
        {filteredProbations.length === 0 ? (
          <div className="no-data-message">
            No probations match the selected filter.
          </div>
        ) : (
          filteredProbations.map(probation => (
            <ProbationCard
              key={probation.id}
              probation={probation}
              statusColor={getStatusColor(probation)}
              onSelect={() => onSelectProbation && onSelectProbation(probation)}
              onExtend={() => setExtendModal(probation)}
              onOutcome={() => setOutcomeModal(probation)}
            />
          ))
        )}
      </div>

      {/* Extend Modal */}
      {extendModal && (
        <ProbationExtendModal
          probation={extendModal}
          onClose={() => setExtendModal(null)}
          onSuccess={() => {
            setExtendModal(null);
            fetchDashboard();
          }}
        />
      )}

      {/* Outcome Modal */}
      {outcomeModal && (
        <ProbationOutcomeModal
          probation={outcomeModal}
          onClose={() => setOutcomeModal(null)}
          onSuccess={() => {
            setOutcomeModal(null);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}

export default ProbationDashboard;
