// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GoalsDashboardPage Component
 * Main goals page showing summary stats, filter tabs, category filter,
 * and a grid of goal cards. Users manage their own goals here.
 */

import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, CheckCircle, AlertTriangle, Plus } from 'lucide-react';
import api from '../../utils/api';
import GoalCard from './GoalCard';
import GoalForm from './GoalForm';
import GoalProgressUpdate from './GoalProgressUpdate';
import GoalDetailModal from './GoalDetailModal';

/** Status filter tabs — "all" shows everything except cancelled */
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' }
];

/** Category filter options */
const CATEGORIES = [
  { key: '', label: 'All Categories' },
  { key: 'performance', label: 'Performance' },
  { key: 'development', label: 'Development' },
  { key: 'project', label: 'Project' },
  { key: 'personal', label: 'Personal' }
];

function GoalsDashboardPage({ user, onNavigate }) {
  // Data state
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [progressGoal, setProgressGoal] = useState(null);
  const [viewGoal, setViewGoal] = useState(null);

  // Role checks
  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';

  /** Fetch goals and stats from the API */
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Build query params for the goals list
      const params = new URLSearchParams();
      if (statusFilter !== 'all' && statusFilter !== 'overdue') {
        params.set('status', statusFilter);
      }
      if (categoryFilter) {
        params.set('category', categoryFilter);
      }

      // Fetch goals and stats in parallel
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const [goalsData, statsData] = await Promise.all([
        api.get(`/goals${queryString}`),
        api.get('/goals/stats')
      ]);

      let filteredGoals = goalsData.goals || [];

      // Client-side overdue filter (API doesn't have a status=overdue param)
      if (statusFilter === 'overdue') {
        const today = new Date(new Date().toDateString());
        filteredGoals = filteredGoals.filter(
          g => g.status === 'active' && g.target_date && new Date(g.target_date) < today
        );
      }

      setGoals(filteredGoals);
      setStats(statsData.own || statsData);
    } catch (err) {
      console.error('Failed to fetch goals data:', err);
      setError('Failed to load goals. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Save a new or edited goal via the API */
  const handleSaveGoal = async (payload, goalId) => {
    if (goalId) {
      // Edit existing goal
      await api.put(`/goals/${goalId}`, payload);
    } else {
      // Create new goal
      await api.post('/goals', payload);
    }
    // Refresh data after save
    await fetchData();
  };

  /** Handle progress update via the API */
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

  /** Open goal detail modal */
  const handleViewGoal = (goal) => {
    setViewGoal(goal);
  };

  /** Open progress update modal */
  const handleOpenProgress = (goal) => {
    setProgressGoal(goal);
  };

  // Loading state
  if (loading) {
    return (
      <div className="goals-dashboard">
        <div className="loading">Loading goals…</div>
      </div>
    );
  }

  return (
    <div className="goals-dashboard">
      {/* Page header with title and create button */}
      <div className="goals-dashboard__header">
        <div>
          <h2 className="goals-dashboard__title">My Goals</h2>
          <p className="goals-dashboard__subtitle">
            Track your progress and manage your goals
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreateForm(true)}
          aria-label="Create new goal"
        >
          <Plus size={16} aria-hidden="true" />
          Add Goal
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">{error}</div>
      )}

      {/* Summary stats cards */}
      {stats && (
        <div className="goals-stats" role="region" aria-label="Goal statistics">
          <div className="goals-stats__card">
            <Target size={24} className="goals-stats__icon goals-stats__icon--total" aria-hidden="true" />
            <div className="goals-stats__info">
              <span className="goals-stats__number">{stats.total}</span>
              <span className="goals-stats__label">Total Goals</span>
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

      {/* Filter bar: status tabs + category dropdown */}
      <div className="goals-filters">
        {/* Status tab buttons */}
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

        {/* Category dropdown */}
        <select
          className="goals-filters__category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.key} value={cat.key}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Goals grid */}
      {goals.length === 0 ? (
        <div className="goals-empty" role="status">
          <Target size={48} className="goals-empty__icon" aria-hidden="true" />
          <h3 className="goals-empty__title">No goals found</h3>
          <p className="goals-empty__text">
            {statusFilter === 'all'
              ? 'Create your first goal to get started.'
              : `No ${statusFilter} goals to display.`}
          </p>
          {statusFilter === 'all' && (
            <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
              <Plus size={16} aria-hidden="true" />
              Create Goal
            </button>
          )}
        </div>
      ) : (
        <div className="goals-grid" role="list">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onView={handleViewGoal}
              onUpdateProgress={handleOpenProgress}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit goal modal */}
      {(showCreateForm || editingGoal) && (
        <GoalForm
          goal={editingGoal}
          onClose={() => { setShowCreateForm(false); setEditingGoal(null); }}
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
          onEdit={(goal) => { setViewGoal(null); setEditingGoal(goal); }}
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

export default GoalsDashboardPage;
