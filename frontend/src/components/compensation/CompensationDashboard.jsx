// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — CompensationDashboard
 * Main compensation landing page for HR/Finance/Admin.
 * Shows stat cards in bento grid and quick links to sub-pages.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import StatCard from '../layout/StatCard';
import PageHeader from '../layout/PageHeader';

function CompensationDashboard({ user, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({
    enable_bonus_schemes: false,
    enable_responsibility_allowances: false
  });

  const isAdmin = user?.role_name === 'Admin';

  // Fetch dashboard statistics and settings on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiFetch('/api/compensation/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          setError('Failed to load compensation statistics');
        }
      } catch (err) {
        console.error('Dashboard stats error:', err);
        setError('Failed to load compensation statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    // Fetch feature settings (non-blocking)
    apiFetch('/api/compensation/settings').then(async r => {
      if (r.ok) setSettings(await r.json());
    }).catch(() => {});
  }, []);

  // Format currency for display
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return <div className="loading">Loading compensation data...</div>;
  }

  return (
    <div className="compensation-dashboard">
      <PageHeader
        title="Compensation"
        subtitle="Pay bands, salary tracking, and review cycles"
      />

      {/* Error state */}
      {error && <div className="alert alert--warning">{error}</div>}

      {/* Stats bento grid */}
      <div className="bento-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard
          label="Total Annual Payroll"
          value={stats ? formatCurrency(stats.total_payroll) : '—'}
          subtitle={stats ? `${stats.employee_count} employees` : ''}
        />
        <StatCard
          label="Average Salary"
          value={stats ? formatCurrency(stats.average_salary) : '—'}
        />
        <StatCard
          label="Active Review Cycles"
          value={stats ? stats.active_review_cycles : '—'}
          onClick={() => onNavigate('compensation-reviews')}
        />
        <StatCard
          label="Upcoming Changes"
          value={stats ? stats.upcoming_changes : '—'}
          subtitle="Next 30 days"
        />
        <StatCard
          label="Pending Reviews"
          value={stats ? stats.pending_reviews : '—'}
          onClick={() => onNavigate('compensation-reviews')}
        />
      </div>

      {/* Quick links grid */}
      <h2 className="comp-section-title">Manage</h2>
      <div className="comp-quick-links">
        <button className="comp-link-card" onClick={() => onNavigate('compensation-pay-bands')}>
          <span className="comp-link-card__title">Pay Bands</span>
          <span className="comp-link-card__desc">Manage salary bands and grades</span>
        </button>
        <button className="comp-link-card" onClick={() => onNavigate('compensation-reviews')}>
          <span className="comp-link-card__title">Pay Reviews</span>
          <span className="comp-link-card__desc">Review cycles and salary proposals</span>
        </button>
        <button className="comp-link-card" onClick={() => onNavigate('compensation-reports')}>
          <span className="comp-link-card__title">Reports</span>
          <span className="comp-link-card__desc">Gender pay gap and department costs</span>
        </button>
        <button className="comp-link-card" onClick={() => onNavigate('compensation-audit')}>
          <span className="comp-link-card__title">Audit Log</span>
          <span className="comp-link-card__desc">View all compensation data access</span>
        </button>
        {/* Conditional links based on enabled features */}
        {settings.enable_bonus_schemes && (
          <button className="comp-link-card" onClick={() => onNavigate('compensation-bonus-schemes')}>
            <span className="comp-link-card__title">Bonus Schemes</span>
            <span className="comp-link-card__desc">Manage bonus calculations and assignments</span>
          </button>
        )}
        {settings.enable_responsibility_allowances && (
          <button className="comp-link-card" onClick={() => onNavigate('compensation-allowances')}>
            <span className="comp-link-card__title">Allowances</span>
            <span className="comp-link-card__desc">Responsibility allowances and assignments</span>
          </button>
        )}
        {isAdmin && (
          <button className="comp-link-card" onClick={() => onNavigate('compensation-settings')}>
            <span className="comp-link-card__title">Settings</span>
            <span className="comp-link-card__desc">Configure compensation features</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default CompensationDashboard;
