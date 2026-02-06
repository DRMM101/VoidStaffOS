// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — PayReviewWorkflow
 * Displays pay reviews within a review cycle as a status-based kanban/card layout.
 * Manager view: own direct reports only.
 * HR/Finance view: all reviews.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import PageHeader from '../layout/PageHeader';

// Status workflow stages in order
const STATUS_ORDER = ['draft', 'submitted', 'hr_review', 'approved', 'rejected', 'applied'];
const STATUS_LABELS = {
  draft: 'Draft', submitted: 'Submitted', hr_review: 'HR Review',
  approved: 'Approved', rejected: 'Rejected', applied: 'Applied'
};

function PayReviewWorkflow({ user }) {
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: '', year: new Date().getFullYear(), budget_total: '', start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);

  const isHR = ['Admin', 'HR', 'Finance'].includes(user.role_name);

  // Fetch review cycles on mount
  useEffect(() => {
    const fetchCycles = async () => {
      try {
        const response = await apiFetch('/api/compensation/review-cycles');
        if (response.ok) {
          const data = await response.json();
          setCycles(data.data);
          // Auto-select the first open/active cycle
          const active = data.data.find(c => c.status === 'open' || c.status === 'in_review');
          if (active) setSelectedCycle(active.id);
          else if (data.data.length > 0) setSelectedCycle(data.data[0].id);
        }
      } catch (err) {
        console.error('Fetch cycles error:', err);
        setError('Failed to load review cycles');
      } finally {
        setLoading(false);
      }
    };
    fetchCycles();
  }, []);

  // Fetch reviews when selected cycle changes
  useEffect(() => {
    if (!selectedCycle) return;
    const fetchReviews = async () => {
      try {
        const response = await apiFetch(`/api/compensation/reviews?review_cycle_id=${selectedCycle}`);
        if (response.ok) {
          const data = await response.json();
          setReviews(data.data);
        }
      } catch (err) {
        console.error('Fetch reviews error:', err);
      }
    };
    fetchReviews();
  }, [selectedCycle]);

  // Format currency for display
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  };

  // Update a review's status
  const handleStatusChange = async (reviewId, newStatus, approvedSalary = null) => {
    try {
      const body = { status: newStatus };
      if (approvedSalary) body.approved_salary = approvedSalary;

      const response = await apiFetch(`/api/compensation/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        // Refresh reviews after status change
        const refreshed = await apiFetch(`/api/compensation/reviews?review_cycle_id=${selectedCycle}`);
        if (refreshed.ok) {
          const data = await refreshed.json();
          setReviews(data.data);
        }
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to update review status');
      }
    } catch (err) {
      console.error('Status change error:', err);
      setError('Failed to update review status');
    }
  };

  // Create a new review cycle
  const handleCreateCycle = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch('/api/compensation/review-cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cycleForm)
      });
      if (response.ok) {
        const data = await response.json();
        setCycles([data.data, ...cycles]);
        setSelectedCycle(data.data.id);
        setShowCycleModal(false);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to create review cycle');
      }
    } catch (err) {
      console.error('Create cycle error:', err);
      setError('Failed to create review cycle');
    } finally {
      setSaving(false);
    }
  };

  // Update review cycle status
  const handleCycleStatusChange = async (status) => {
    if (!selectedCycle) return;
    try {
      const response = await apiFetch(`/api/compensation/review-cycles/${selectedCycle}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        const data = await response.json();
        setCycles(cycles.map(c => c.id === selectedCycle ? data.data : c));
      }
    } catch (err) {
      console.error('Update cycle status error:', err);
    }
  };

  // Group reviews by status for kanban display
  const reviewsByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = reviews.filter(r => r.status === status);
    return acc;
  }, {});

  // Get current cycle details
  const currentCycle = cycles.find(c => c.id === selectedCycle);

  if (loading) return <div className="loading">Loading review cycles...</div>;

  return (
    <div className="pay-review-workflow">
      <PageHeader
        title="Pay Reviews"
        subtitle="Salary review workflow and approvals"
        actions={
          isHR && (
            <button className="btn btn--primary" onClick={() => setShowCycleModal(true)}>
              + New Cycle
            </button>
          )
        }
      />

      {error && <div className="alert alert--error">{error}</div>}

      {/* Cycle selector */}
      <div className="review-cycle-selector">
        <label htmlFor="cycle-select">Review Cycle:</label>
        <select
          id="cycle-select"
          value={selectedCycle || ''}
          onChange={(e) => setSelectedCycle(e.target.value)}
        >
          {cycles.length === 0 && <option value="">No cycles found</option>}
          {cycles.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.year}) — {STATUS_LABELS[c.status] || c.status}
            </option>
          ))}
        </select>

        {/* Cycle status actions for HR */}
        {isHR && currentCycle && (
          <div className="cycle-actions">
            {currentCycle.status === 'planning' && (
              <button className="btn btn--sm btn--primary" onClick={() => handleCycleStatusChange('open')}>
                Open Cycle
              </button>
            )}
            {currentCycle.status === 'open' && (
              <button className="btn btn--sm btn--secondary" onClick={() => handleCycleStatusChange('in_review')}>
                Close Submissions
              </button>
            )}
            {currentCycle.status === 'in_review' && (
              <button className="btn btn--sm btn--primary" onClick={() => handleCycleStatusChange('complete')}>
                Complete Cycle
              </button>
            )}
            {currentCycle.budget_total && (
              <span className="cycle-budget">
                Budget: {formatCurrency(currentCycle.budget_remaining)} / {formatCurrency(currentCycle.budget_total)} remaining
              </span>
            )}
          </div>
        )}
      </div>

      {/* Kanban-style status columns */}
      <div className="review-kanban">
        {STATUS_ORDER.filter(s => reviewsByStatus[s].length > 0 || s === 'draft' || s === 'submitted').map(status => (
          <div key={status} className={`review-column review-column--${status}`}>
            <h3 className="review-column__header">
              {STATUS_LABELS[status]}
              <span className="review-column__count">{reviewsByStatus[status].length}</span>
            </h3>
            <div className="review-column__cards">
              {reviewsByStatus[status].map(review => (
                <div key={review.id} className="review-card">
                  <div className="review-card__name">{review.employee_name}</div>
                  <div className="review-card__salary">
                    <span>Current: {formatCurrency(review.current_salary)}</span>
                    {review.proposed_salary && (
                      <span>Proposed: {formatCurrency(review.proposed_salary)}</span>
                    )}
                    {review.approved_salary && (
                      <span className="review-card__approved">Approved: {formatCurrency(review.approved_salary)}</span>
                    )}
                  </div>
                  {review.manager_name && (
                    <div className="review-card__manager">Manager: {review.manager_name}</div>
                  )}
                  {/* Status actions */}
                  <div className="review-card__actions">
                    {status === 'draft' && (
                      <button className="btn btn--xs btn--primary" onClick={() => handleStatusChange(review.id, 'submitted')}>
                        Submit
                      </button>
                    )}
                    {status === 'submitted' && isHR && (
                      <button className="btn btn--xs btn--primary" onClick={() => handleStatusChange(review.id, 'hr_review')}>
                        Review
                      </button>
                    )}
                    {status === 'hr_review' && isHR && (
                      <>
                        <button className="btn btn--xs btn--primary" onClick={() => handleStatusChange(review.id, 'approved', review.proposed_salary)}>
                          Approve
                        </button>
                        <button className="btn btn--xs btn--danger" onClick={() => handleStatusChange(review.id, 'rejected')}>
                          Reject
                        </button>
                      </>
                    )}
                    {status === 'approved' && isHR && (
                      <button className="btn btn--xs btn--primary" onClick={() => handleStatusChange(review.id, 'applied')}>
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {reviewsByStatus[status].length === 0 && (
                <div className="review-column__empty">No reviews</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Cycle Modal */}
      {showCycleModal && (
        <div className="modal-overlay" onClick={() => setShowCycleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Review Cycle</h2>
              <button className="modal-close" onClick={() => setShowCycleModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateCycle}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="cycle-name">Cycle Name *</label>
                  <input id="cycle-name" type="text" required
                    value={cycleForm.name}
                    onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                    placeholder="e.g. Annual Pay Review 2026"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="cycle-year">Year *</label>
                    <input id="cycle-year" type="number" required
                      value={cycleForm.year}
                      onChange={(e) => setCycleForm({ ...cycleForm, year: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cycle-budget">Budget Total</label>
                    <input id="cycle-budget" type="number" step="0.01" min="0"
                      value={cycleForm.budget_total}
                      onChange={(e) => setCycleForm({ ...cycleForm, budget_total: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="cycle-start">Start Date *</label>
                    <input id="cycle-start" type="date" required
                      value={cycleForm.start_date}
                      onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cycle-end">End Date *</label>
                    <input id="cycle-end" type="date" required
                      value={cycleForm.end_date}
                      onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowCycleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayReviewWorkflow;
