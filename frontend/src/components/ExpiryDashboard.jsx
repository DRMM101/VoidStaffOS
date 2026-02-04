/**
 * VoidStaffOS - Expiry Dashboard Component
 * Shows expiring and expired documents with escalation levels.
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
 * Module: Document Storage
 */

import { useState, useEffect } from 'react';
import api from '../utils/api';

const CATEGORY_LABELS = {
  cv: 'CV/Resume',
  certificate: 'Certificate',
  contract: 'Contract',
  reference: 'Reference',
  rtw: 'Right to Work',
  dbs: 'DBS Check',
  supervision: 'Supervision',
  responsibility_pack: 'Responsibility Pack'
};

const ESCALATION_CONFIG = {
  expired: {
    label: 'EXPIRED',
    color: '#ff6b6b',
    bgColor: 'rgba(255, 107, 107, 0.15)',
    description: 'Requires immediate action - notifies employee, manager, and HR'
  },
  critical: {
    label: '30 Days or Less',
    color: '#f7b731',
    bgColor: 'rgba(247, 183, 49, 0.15)',
    description: 'Critical - notifies employee, manager, and HR'
  },
  warning: {
    label: '31-60 Days',
    color: '#4ecdc4',
    bgColor: 'rgba(78, 205, 196, 0.15)',
    description: 'Warning - notifies employee and manager'
  },
  notice: {
    label: '61-90 Days',
    color: '#134e4a',
    bgColor: 'rgba(19, 78, 74, 0.08)',
    description: 'Notice - notifies employee only'
  }
};

function ExpiryDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLevel, setExpandedLevel] = useState('expired');
  const [processingNotifications, setProcessingNotifications] = useState(false);

  useEffect(() => {
    fetchExpiringDocuments();
  }, []);

  const fetchExpiringDocuments = async () => {
    try {
      setLoading(true);
      const result = await api.get('/documents/expiring');
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessNotifications = async () => {
    try {
      setProcessingNotifications(true);
      const result = await api.post('/documents/process-expiry-notifications');
      alert(`Notifications processed: ${result.notifications_sent} sent`);
      fetchExpiringDocuments();
    } catch (err) {
      alert('Failed to process notifications: ' + err.message);
    } finally {
      setProcessingNotifications(false);
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

  if (loading) {
    return <div className="loading">Loading expiry dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  const { documents, summary, by_category } = data;

  return (
    <div className="expiry-dashboard">
      {/* Summary Cards */}
      <div className="summary-cards">
        {Object.entries(ESCALATION_CONFIG).map(([level, config]) => (
          <div
            key={level}
            className={`summary-card ${level} ${expandedLevel === level ? 'active' : ''}`}
            style={{ borderColor: config.color }}
            onClick={() => setExpandedLevel(level)}
          >
            <div className="card-count" style={{ color: config.color }}>
              {summary[level]}
            </div>
            <div className="card-label">{config.label}</div>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {by_category && by_category.length > 0 && (
        <div className="category-breakdown">
          <h3>By Category</h3>
          <div className="category-grid">
            {by_category.map(cat => (
              <div key={cat.category} className="category-stat">
                <span className="cat-name">{CATEGORY_LABELS[cat.category] || cat.category}</span>
                <div className="cat-counts">
                  {cat.expired_count > 0 && (
                    <span className="cat-count expired" title="Expired">{cat.expired_count}</span>
                  )}
                  {cat.critical_count > 0 && (
                    <span className="cat-count critical" title="30 days">{cat.critical_count}</span>
                  )}
                  {cat.warning_count > 0 && (
                    <span className="cat-count warning" title="60 days">{cat.warning_count}</span>
                  )}
                  {cat.notice_count > 0 && (
                    <span className="cat-count notice" title="90 days">{cat.notice_count}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Process Notifications Button */}
      <div className="notifications-action">
        <button
          className="btn btn-secondary"
          onClick={handleProcessNotifications}
          disabled={processingNotifications}
        >
          {processingNotifications ? 'Processing...' : 'Send Expiry Notifications'}
        </button>
        <span className="action-hint">
          Sends notifications to employees, managers, and HR based on escalation levels
        </span>
      </div>

      {/* Document Lists by Escalation Level */}
      {Object.entries(ESCALATION_CONFIG).map(([level, config]) => (
        <div
          key={level}
          className={`escalation-section ${expandedLevel === level ? 'expanded' : 'collapsed'}`}
        >
          <div
            className="section-header"
            style={{ backgroundColor: config.bgColor, borderColor: config.color }}
            onClick={() => setExpandedLevel(expandedLevel === level ? null : level)}
          >
            <div className="section-title">
              <span className="level-indicator" style={{ backgroundColor: config.color }}></span>
              <h4>{config.label}</h4>
              <span className="doc-count">{documents[level]?.length || 0} documents</span>
            </div>
            <p className="section-description">{config.description}</p>
          </div>

          {expandedLevel === level && documents[level]?.length > 0 && (
            <div className="documents-table-container">
              <table className="documents-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Document</th>
                    <th>Category</th>
                    <th>Expiry Date</th>
                    <th>Days</th>
                    <th>Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {documents[level].map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div className="employee-cell">
                          <span className="emp-name">{doc.employee_name}</span>
                          <span className="emp-number">{doc.employee_number}</span>
                        </div>
                      </td>
                      <td className="doc-title">{doc.title}</td>
                      <td>
                        <span className="category-badge">
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </span>
                      </td>
                      <td className="date-cell">{formatDate(doc.expiry_date)}</td>
                      <td className="days-cell">
                        <span className={`days-badge ${level}`}>
                          {doc.days_until_expiry < 0
                            ? `${Math.abs(doc.days_until_expiry)} overdue`
                            : `${doc.days_until_expiry} days`
                          }
                        </span>
                      </td>
                      <td className="manager-cell">
                        {doc.manager_name || (
                          <span className="no-manager">No manager</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {expandedLevel === level && (!documents[level] || documents[level].length === 0) && (
            <div className="empty-section">
              No documents in this category
            </div>
          )}
        </div>
      ))}

      <style>{`
        .expiry-dashboard {
          padding: 20px;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }

        .summary-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .summary-card:hover,
        .summary-card.active {
          transform: translateY(-2px);
        }

        .summary-card.active {
          border-width: 2px;
        }

        .card-count {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .card-label {
          color: #a0a0a0;
          font-size: 0.9rem;
        }

        .category-breakdown {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .category-breakdown h3 {
          margin: 0 0 15px 0;
          color: #e0e0e0;
          font-size: 1rem;
        }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }

        .category-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: #f9f6f2;
          border-radius: 8px;
        }

        .cat-name {
          color: #e0e0e0;
          font-size: 0.9rem;
        }

        .cat-counts {
          display: flex;
          gap: 5px;
        }

        .cat-count {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .cat-count.expired { background: #ff6b6b; color: #fff; }
        .cat-count.critical { background: #f7b731; color: #134e4a; }
        .cat-count.warning { background: #4ecdc4; color: #134e4a; }
        .cat-count.notice { background: #134e4a; color: #fff; }

        .notifications-action {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
          padding: 15px;
          background: #ffffff;
          border-radius: 12px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #e8e2d9;
          color: #e0e0e0;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #3a3a5a;
        }

        .action-hint {
          color: #808080;
          font-size: 0.85rem;
        }

        .escalation-section {
          margin-bottom: 15px;
          border-radius: 12px;
          overflow: hidden;
        }

        .section-header {
          padding: 15px 20px;
          cursor: pointer;
          border-left: 4px solid;
          transition: all 0.2s;
        }

        .section-header:hover {
          opacity: 0.9;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .level-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .section-title h4 {
          margin: 0;
          color: #e0e0e0;
          flex: 1;
        }

        .doc-count {
          background: rgba(0,0,0,0.2);
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85rem;
          color: #e0e0e0;
        }

        .section-description {
          margin: 8px 0 0 24px;
          color: #a0a0a0;
          font-size: 0.85rem;
        }

        .documents-table-container {
          overflow-x: auto;
          background: #ffffff;
        }

        .documents-table {
          width: 100%;
          border-collapse: collapse;
        }

        .documents-table th {
          text-align: left;
          padding: 12px 15px;
          background: #f9f6f2;
          color: #a0a0a0;
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
        }

        .documents-table td {
          padding: 12px 15px;
          border: 1px solid #e8e2d9;
          color: #e0e0e0;
        }

        .employee-cell {
          display: flex;
          flex-direction: column;
        }

        .emp-name {
          font-weight: 500;
        }

        .emp-number {
          font-size: 0.8rem;
          color: #808080;
          font-family: monospace;
        }

        .doc-title {
          font-weight: 500;
        }

        .category-badge {
          background: #e8e2d9;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 0.8rem;
        }

        .date-cell {
          color: #a0a0a0;
        }

        .days-cell {
          text-align: center;
        }

        .days-badge {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .days-badge.expired { background: #ff6b6b; color: #fff; }
        .days-badge.critical { background: #f7b731; color: #134e4a; }
        .days-badge.warning { background: #4ecdc4; color: #134e4a; }
        .days-badge.notice { background: #134e4a; color: #fff; }

        .manager-cell {
          color: #a0a0a0;
        }

        .no-manager {
          font-style: italic;
          color: #555;
        }

        .empty-section {
          padding: 30px;
          text-align: center;
          color: #808080;
          background: #ffffff;
        }

        .loading, .error-message {
          text-align: center;
          padding: 40px;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          border-radius: 8px;
        }

        @media (max-width: 768px) {
          .summary-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

export default ExpiryDashboard;
