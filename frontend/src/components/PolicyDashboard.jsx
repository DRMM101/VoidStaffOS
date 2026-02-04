/**
 * VoidStaffOS - Policy Dashboard Component
 * Employee view of pending policies requiring acknowledgment.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: PolicyOS
 */

import { useState, useEffect } from 'react';
import api from '../utils/api';

const CATEGORY_COLORS = {
  'HR': '#134e4a',
  'Health & Safety': '#2cb67d',
  'Safeguarding': '#ff6b6b',
  'Compliance': '#4ecdc4',
  'IT': '#45b7d1',
  'Operational': '#f7b731'
};

function PolicyDashboard({ user, onViewPolicy }) {
  const [pendingPolicies, setPendingPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPendingPolicies();
  }, []);

  const fetchPendingPolicies = async () => {
    try {
      setLoading(true);
      const data = await api.get('/policies/pending');
      setPendingPolicies(data.pending_policies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysUntilDeadline = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return <div className="loading">Loading policies...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="policy-dashboard">
      <div className="page-header">
        <h2>Policy Acknowledgments</h2>
        {pendingPolicies.length > 0 && (
          <span className="badge badge-warning">{pendingPolicies.length} pending</span>
        )}
      </div>

      {pendingPolicies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#10003;</div>
          <h3>All caught up!</h3>
          <p>You have no policies pending acknowledgment.</p>
        </div>
      ) : (
        <div className="policy-cards">
          {pendingPolicies.map(policy => {
            const daysLeft = getDaysUntilDeadline(policy.deadline);
            const isOverdue = policy.is_overdue;
            const isUrgent = daysLeft !== null && daysLeft <= 3 && !isOverdue;

            return (
              <div
                key={policy.id}
                className={`policy-card ${isOverdue ? 'overdue' : ''} ${isUrgent ? 'urgent' : ''}`}
              >
                <div className="policy-card-header">
                  <span
                    className="category-badge"
                    style={{ backgroundColor: CATEGORY_COLORS[policy.category] || '#666' }}
                  >
                    {policy.category}
                  </span>
                  {isOverdue && <span className="badge badge-danger">OVERDUE</span>}
                  {isUrgent && <span className="badge badge-warning">Due Soon</span>}
                </div>

                <h3 className="policy-title">{policy.title}</h3>

                {policy.summary && (
                  <p className="policy-summary">{policy.summary}</p>
                )}

                <div className="policy-meta">
                  <span>Version {policy.version}</span>
                  <span>Published {formatDate(policy.published_at)}</span>
                </div>

                {policy.deadline && (
                  <div className={`deadline-info ${isOverdue ? 'overdue' : ''}`}>
                    {isOverdue ? (
                      <span>Was due {formatDate(policy.deadline)}</span>
                    ) : (
                      <span>Due by {formatDate(policy.deadline)} ({daysLeft} days left)</span>
                    )}
                  </div>
                )}

                {policy.last_acknowledged_at && (
                  <div className="reack-notice">
                    Re-acknowledgment required (Last: {formatDate(policy.last_acknowledged_at)})
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={() => onViewPolicy(policy)}
                >
                  Read &amp; Acknowledge
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .policy-dashboard {
          padding: 20px;
        }

        .page-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
        }

        .page-header h2 {
          margin: 0;
          color: #e0e0e0;
        }

        .badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .badge-warning {
          background: #f7b731;
          color: #134e4a;
        }

        .badge-danger {
          background: #ff6b6b;
          color: #fff;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: #ffffff;
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 48px;
          color: #2cb67d;
          margin-bottom: 15px;
        }

        .empty-state h3 {
          color: #e0e0e0;
          margin-bottom: 10px;
        }

        .empty-state p {
          color: #a0a0a0;
        }

        .policy-cards {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        }

        .policy-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e8e2d9;
          transition: border-color 0.2s;
        }

        .policy-card:hover {
          border-color: #134e4a;
        }

        .policy-card.overdue {
          border-color: #ff6b6b;
          background: linear-gradient(135deg, #f9f6f2 0%, #e8e2d9 100%);
        }

        .policy-card.urgent {
          border-color: #f7b731;
        }

        .policy-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }

        .category-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
        }

        .policy-title {
          color: #e0e0e0;
          margin: 0 0 10px 0;
          font-size: 1.2rem;
        }

        .policy-summary {
          color: #a0a0a0;
          font-size: 0.9rem;
          margin-bottom: 15px;
          line-height: 1.5;
        }

        .policy-meta {
          display: flex;
          gap: 15px;
          font-size: 0.85rem;
          color: #808080;
          margin-bottom: 15px;
        }

        .deadline-info {
          background: #f9f6f2;
          padding: 10px 15px;
          border-radius: 8px;
          font-size: 0.9rem;
          color: #f7b731;
          margin-bottom: 15px;
        }

        .deadline-info.overdue {
          color: #ff6b6b;
          background: #2a1a1a;
        }

        .reack-notice {
          background: #1a2a3e;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          color: #4ecdc4;
          margin-bottom: 15px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s;
          width: 100%;
        }

        .btn-primary {
          background: #134e4a;
          color: #fff;
        }

        .btn-primary:hover {
          background: #0f3d38;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

export default PolicyDashboard;
