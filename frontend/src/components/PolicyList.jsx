/**
 * VoidStaffOS - Policy List Component
 * Admin view for managing all policies.
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

const CATEGORIES = ['HR', 'Health & Safety', 'Safeguarding', 'Compliance', 'IT', 'Operational'];
const STATUSES = ['draft', 'published', 'archived'];

const CATEGORY_COLORS = {
  'HR': '#134e4a',
  'Health & Safety': '#2cb67d',
  'Safeguarding': '#ff6b6b',
  'Compliance': '#4ecdc4',
  'IT': '#45b7d1',
  'Operational': '#f7b731'
};

const FREQUENCY_LABELS = {
  'once': 'One-time',
  'annual': 'Annual',
  'biannual': 'Bi-annual',
  'quarterly': 'Quarterly'
};

const FREQUENCY_MONTHS = {
  'once': null,
  'annual': 12,
  'biannual': 6,
  'quarterly': 3
};

const STATUS_COLORS = {
  'draft': '#808080',
  'published': '#2cb67d',
  'archived': '#555'
};

function PolicyList({ user, onCreateNew, onEdit, onView, onViewCompliance }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    fetchPolicies();
  }, [filterStatus, filterCategory]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      let endpoint = '/policies';
      const params = [];

      if (filterStatus) params.push(`status=${filterStatus}`);
      if (filterCategory) params.push(`category=${encodeURIComponent(filterCategory)}`);

      if (params.length > 0) {
        endpoint += '?' + params.join('&');
      }

      const data = await api.get(endpoint);
      setPolicies(data.policies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (policy) => {
    if (!confirm(`Publish "${policy.title}"? This will make it visible to assigned employees.`)) {
      return;
    }

    try {
      await api.post(`/policies/${policy.id}/publish`);
      fetchPolicies();
    } catch (err) {
      alert('Failed to publish: ' + err.message);
    }
  };

  const handleArchive = async (policy) => {
    if (!confirm(`Archive "${policy.title}"? Employees will no longer need to acknowledge it.`)) {
      return;
    }

    try {
      await api.post(`/policies/${policy.id}/archive`);
      fetchPolicies();
    } catch (err) {
      alert('Failed to archive: ' + err.message);
    }
  };

  const handleDelete = async (policy) => {
    if (!confirm(`Delete "${policy.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/policies/${policy.id}`);
      fetchPolicies();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
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

  const getNextReviewDate = (policy) => {
    if (!policy.published_at || policy.acknowledgment_frequency === 'once') {
      return null;
    }

    const months = FREQUENCY_MONTHS[policy.acknowledgment_frequency];
    if (!months) return null;

    const publishedDate = new Date(policy.published_at);
    const nextReview = new Date(publishedDate);
    nextReview.setMonth(nextReview.getMonth() + months);

    // If next review is in the past, calculate next upcoming one
    const now = new Date();
    while (nextReview < now) {
      nextReview.setMonth(nextReview.getMonth() + months);
    }

    return nextReview;
  };

  const isReviewDueSoon = (nextReview) => {
    if (!nextReview) return false;
    const now = new Date();
    const daysUntil = Math.ceil((nextReview - now) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30;
  };

  if (loading && policies.length === 0) {
    return <div className="loading">Loading policies...</div>;
  }

  return (
    <div className="policy-list">
      <div className="page-header">
        <h2>Policy Management</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={onViewCompliance}>
            Compliance Report
          </button>
          <button className="btn btn-primary" onClick={onCreateNew}>
            + New Policy
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(status => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {policies.length === 0 ? (
        <div className="empty-state">
          <h3>No policies found</h3>
          <p>Create your first policy to get started.</p>
          <button className="btn btn-primary" onClick={onCreateNew}>
            Create Policy
          </button>
        </div>
      ) : (
        <div className="policies-table-container">
          <table className="policies-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Version</th>
                <th>Frequency</th>
                <th>Next Review</th>
                <th>Acknowledgments</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(policy => (
                <tr key={policy.id} className={`status-${policy.status}`}>
                  <td>
                    <div className="policy-title-cell">
                      <span className="policy-name">{policy.title}</span>
                      {policy.pdf_filename && (
                        <span className="pdf-badge" title="Has PDF attachment">PDF</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className="category-badge"
                      style={{ backgroundColor: CATEGORY_COLORS[policy.category] }}
                    >
                      {policy.category}
                    </span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: STATUS_COLORS[policy.status] }}
                    >
                      {policy.status}
                    </span>
                  </td>
                  <td className="version-cell">v{policy.version}</td>
                  <td className="frequency-cell">
                    <span className={`frequency-badge freq-${policy.acknowledgment_frequency}`}>
                      {FREQUENCY_LABELS[policy.acknowledgment_frequency] || 'One-time'}
                    </span>
                  </td>
                  <td className="review-cell">
                    {(() => {
                      const nextReview = getNextReviewDate(policy);
                      if (!nextReview) return <span className="review-na">-</span>;
                      const dueSoon = isReviewDueSoon(nextReview);
                      return (
                        <span className={`review-date ${dueSoon ? 'due-soon' : ''}`}>
                          {formatDate(nextReview)}
                          {dueSoon && <span className="due-badge">Soon</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="ack-cell">
                    {policy.status === 'published' ? (
                      <span className="ack-count">{policy.acknowledgment_count || 0}</span>
                    ) : (
                      <span className="ack-na">-</span>
                    )}
                  </td>
                  <td className="date-cell">{formatDate(policy.updated_at)}</td>
                  <td className="actions-cell">
                    <button
                      className="btn-icon"
                      onClick={() => onView(policy)}
                      title="View"
                    >
                      &#128065;
                    </button>

                    {policy.status === 'draft' && (
                      <>
                        <button
                          className="btn-icon"
                          onClick={() => onEdit(policy)}
                          title="Edit"
                        >
                          &#9998;
                        </button>
                        <button
                          className="btn-icon btn-publish"
                          onClick={() => handlePublish(policy)}
                          title="Publish"
                        >
                          &#10003;
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(policy)}
                          title="Delete"
                        >
                          &#128465;
                        </button>
                      </>
                    )}

                    {policy.status === 'published' && (
                      <button
                        className="btn-icon btn-archive"
                        onClick={() => handleArchive(policy)}
                        title="Archive"
                      >
                        &#128230;
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .policy-list {
          padding: 20px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .page-header h2 {
          margin: 0;
          color: #e0e0e0;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #134e4a;
          color: #fff;
        }

        .btn-primary:hover {
          background: #0f3d38;
        }

        .btn-secondary {
          background: #e8e2d9;
          color: #e0e0e0;
        }

        .btn-secondary:hover {
          background: #3a3a5a;
        }

        .filters {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }

        .filter-select {
          padding: 10px 15px;
          background: #ffffff;
          border: 1px solid #e8e2d9;
          border-radius: 8px;
          color: #e0e0e0;
          font-size: 0.95rem;
          min-width: 150px;
        }

        .filter-select:focus {
          outline: none;
          border-color: #134e4a;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: #ffffff;
          border-radius: 12px;
        }

        .empty-state h3 {
          color: #e0e0e0;
          margin-bottom: 10px;
        }

        .empty-state p {
          color: #a0a0a0;
          margin-bottom: 20px;
        }

        .policies-table-container {
          overflow-x: auto;
        }

        .policies-table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
        }

        .policies-table th {
          text-align: left;
          padding: 15px;
          background: #f9f6f2;
          color: #a0a0a0;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
        }

        .policies-table td {
          padding: 15px;
          border-top: 1px solid #e8e2d9;
          color: #e0e0e0;
        }

        .policies-table tr:hover {
          background: #f9f6f2;
        }

        .policies-table tr.status-archived {
          opacity: 0.6;
        }

        .policy-title-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .policy-name {
          font-weight: 500;
        }

        .pdf-badge {
          background: #ff6b6b;
          color: #fff;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .category-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
          text-transform: capitalize;
        }

        .version-cell {
          font-family: monospace;
          color: #5c6b63;
        }

        .frequency-cell {
          text-align: center;
        }

        .frequency-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
          background: #e8e2d9;
          color: #a0a0a0;
        }

        .frequency-badge.freq-annual {
          background: rgba(127, 90, 240, 0.2);
          color: #a990ff;
        }

        .frequency-badge.freq-biannual {
          background: rgba(78, 205, 196, 0.2);
          color: #4ecdc4;
        }

        .frequency-badge.freq-quarterly {
          background: rgba(247, 183, 49, 0.2);
          color: #f7b731;
        }

        .review-cell {
          text-align: center;
        }

        .review-date {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.9rem;
          color: #a0a0a0;
        }

        .review-date.due-soon {
          color: #f7b731;
        }

        .due-badge {
          background: #f7b731;
          color: #f9f6f2;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .review-na {
          color: #555;
        }

        .ack-cell {
          text-align: center;
        }

        .ack-count {
          background: #e8e2d9;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.9rem;
        }

        .ack-na {
          color: #555;
        }

        .date-cell {
          color: #5c6b63;
          font-size: 0.9rem;
        }

        .actions-cell {
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          background: #e8e2d9;
          border: none;
          color: #e0e0e0;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: #3a3a5a;
        }

        .btn-publish:hover {
          background: #2cb67d;
        }

        .btn-archive:hover {
          background: #f7b731;
          color: #f9f6f2;
        }

        .btn-delete:hover {
          background: #ff6b6b;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
}

export default PolicyList;
