// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — TeamGoalsPage Component
 * Manager/Admin view of team goals. Shows direct reports' goals
 * with summary stats, filtering, and ability to assign new goals.
 */

import { useState, useEffect, useCallback } from 'react';
import { Users, Target, TrendingUp, CheckCircle, AlertTriangle, Plus } from 'lucide-react';
import api from '../../utils/api';
import GoalCard from './GoalCard';
import GoalForm from './GoalForm';
import GoalProgressUpdate from './GoalProgressUpdate';
import GoalDetailModal from './GoalDetailModal';

/** Status filter tabs */
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' }
];

function TeamGoalsPage({ user, onNavigate }) {
  // Data state
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [progressGoal, setProgressGoal] = useState(null);
  const [viewGoal, setViewGoal] = useState(null);

  // Role checks
  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';

  /** Fetch team goals and stats from the API */
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch team goals and stats in parallel
      const [goalsData, statsData] = await Promise.all([
        api.get('/goals/team'),
        api.get('/goals/stats')
      ]);

      setGoals(goalsData.goals || []);
      setStats(statsData.team || null);
    } catch (err) {
      console.error('Failed to fetch team goals:', err);
      setError('Failed to load team goals. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Filter goals by status and search query */
  const filteredGoals = goals.filter(goal => {
    // Status filter
    if (statusFilter === 'active' && goal.status !== 'active') return false;
    if (statusFilter === 'completed' && goal.status !== 'completed') return false;
    if (statusFilter === 'overdue') {
      if (goal.status !== 'active' || !goal.target_date) return false;
      if (new Date(goal.target_date) >= new Date(new Date().toDateString())) return false;
    }

    // Search filter — match title or owner name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = goal.title?.toLowerCase().includes(q);
      const matchesOwner = goal.owner_name?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesOwner) return false;
    }

    return true;
  });

  /** Group goals by owner for a grouped view */
  const groupedByOwner = filteredGoals.reduce((acc, goal) => {
    const ownerKey = goal.owner_name || 'Unknown';
    if (!acc[ownerKey]) {
      acc[ownerKey] = { name: ownerKey, employeeNumber: goal.employee_number, goals: [] };
    }
    acc[ownerKey].goals.push(goal);
    return acc;
  }, {});

  /** Save a new goal (assign to team member) */
  const handleSaveGoal = async (payload) => {
    await api.post('/goals', payload);
    await fetchData();
  };

  /** Handle progress update */
  const handleUpdateProgress = async (goalId, progress, comment) => {
    await api.put(`/goals/${goalId}/progress`, { progress, comment: comment || undefined });
    await fetchData();
  };

  /** Mark a goal as complete */
  const handleComplete = async (goal) => {
    try {
      await api.post(`/goals/${goal.id}/complete`);
      await fetchData();
    } catch (err) {
      console.error('Failed to complete goal:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="goals-dashboard">
        <div className="loading">Loading team goals…</div>
      </div>
    );
  }

  return (
    <div className="goals-dashboard">
      {/* Page header */}
      <div className="goals-dashboard__header">
        <div>
          <h2 className="goals-dashboard__title">
            <Users size={24} aria-hidden="true" />
            Team Goals
          </h2>
          <p className="goals-dashboard__subtitle">
            {isAdmin ? 'All employee goals across the organisation' : 'Goals for your direct reports'}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowAssignForm(true)}
          aria-label="Assign new goal"
        >
          <Plus size={16} aria-hidden="true" />
          Assign Goal
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">{error}</div>
      )}

      {/* Team stats cards */}
      {stats && (
        <div className="goals-stats" role="region" aria-label="Team goal statistics">
          <div className="goals-stats__card">
            <Target size={24} className="goals-stats__icon goals-stats__icon--total" aria-hidden="true" />
            <div className="goals-stats__info">
              <span className="goals-stats__number">{stats.total}</span>
              <span className="goals-stats__label">Team Total</span>
            </div>
          </div>
          <div className="goals-stats__card">
            <TrendingUp size={24} className="goals-stats__icon goals-stats__icon--active" aria-hidden="true" />
            <div className="goals-stats__info">
              <span className="goals-stats__number">{stats.active}</span>
              <span className="goals-stats__label">Active</span>
            </div>
          </div>
          <div className="goals-stats__card">
            <CheckCircle size={24} className="goals-stats__icon goals-stats__icon--completed" aria-hidden="true" />
            <div className="goals-stats__info">
              <span className="goals-stats__number">{stats.completed}</span>
              <span className="goals-stats__label">Completed</span>
            </div>
          </div>
          <div className="goals-stats__card">
            <AlertTriangle size={24} className="goals-stats__icon goals-stats__icon--overdue" aria-hidden="true" />
            <div className="goals-stats__info">
              <span className="goals-stats__number">{stats.overdue}</span>
              <span className="goals-stats__label">Overdue</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar: status tabs + search */}
      <div className="goals-filters">
        <div className="goals-filters__tabs" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={statusFilter === tab.key}
              className={`goals-filters__tab ${statusFilter === tab.key ? 'goals-filters__tab--active' : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search by employee name or goal title */}
        <input
          type="search"
          className="goals-filters__search"
          placeholder="Search by name or goal…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search team goals"
        />
      </div>

      {/* Grouped goals by owner */}
      {filteredGoals.length === 0 ? (
        <div className="goals-empty" role="status">
          <Users size={48} className="goals-empty__icon" aria-hidden="true" />
          <h3 className="goals-empty__title">No team goals found</h3>
          <p className="goals-empty__text">
            {searchQuery ? 'Try adjusting your search.' : 'Assign a goal to get started.'}
          </p>
        </div>
      ) : (
        <div className="team-goals-groups">
          {Object.values(groupedByOwner).map(group => (
            <div key={group.name} className="team-goals-group">
              {/* Owner header */}
              <div className="team-goals-group__header">
                <h3 className="team-goals-group__name">{group.name}</h3>
                {group.employeeNumber && (
                  <span className="team-goals-group__emp-no">#{group.employeeNumber}</span>
                )}
                <span className="team-goals-group__count">
                  {group.goals.length} goal{group.goals.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Goals grid for this owner */}
              <div className="goals-grid" role="list">
                {group.goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    showOwner={false}
                    onView={(g) => setViewGoal(g)}
                    onUpdateProgress={(g) => setProgressGoal(g)}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign goal modal (create form with assign-to dropdown) */}
      {showAssignForm && (
        <GoalForm
          goal={null}
          onClose={() => setShowAssignForm(false)}
          onSave={handleSaveGoal}
          isAdmin={isAdmin}
          isManager={isManager}
        />
      )}

      {/* Progress update modal */}
      {progressGoal && (
        <GoalProgressUpdate
          goal={progressGoal}
          onClose={() => setProgressGoal(null)}
          onSave={handleUpdateProgress}
        />
      )}

      {/* Goal detail modal */}
      {viewGoal && (
        <GoalDetailModal
          goalId={viewGoal.id}
          onClose={() => setViewGoal(null)}
          onEdit={() => {}}
          onProgressUpdate={(goal) => { setViewGoal(null); setProgressGoal(goal); }}
          onComplete={handleComplete}
          onRefresh={fetchData}
          isAdmin={isAdmin}
          isManager={isManager}
        />
      )}
    </div>
  );
}

export default TeamGoalsPage;
