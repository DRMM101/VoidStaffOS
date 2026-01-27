/**
 * VoidStaffOS - Policy Compliance Report Component
 * HR view of policy acknowledgment statistics.
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
  'HR': '#7f5af0',
  'Health & Safety': '#2cb67d',
  'Safeguarding': '#ff6b6b',
  'Compliance': '#4ecdc4',
  'IT': '#45b7d1',
  'Operational': '#f7b731'
};

function PolicyComplianceReport({ onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [acknowledgments, setAcknowledgments] = useState([]);
  const [loadingAcks, setLoadingAcks] = useState(false);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await api.get('/policies/compliance-report');
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewAcknowledgments = async (policy) => {
    setSelectedPolicy(policy);
    setLoadingAcks(true);
    try {
      const data = await api.get(`/policies/${policy.id}/acknowledgments`);
      setAcknowledgments(data.acknowledgments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAcks(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getComplianceColor = (rate) => {
    if (rate >= 90) return '#2cb67d';
    if (rate >= 70) return '#f7b731';
    return '#ff6b6b';
  };

  if (loading) {
    return (
      <div className="compliance-report">
        <div className="loading">Loading compliance report...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="compliance-report">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="compliance-report">
      <div className="report-header">
        <h2>Policy Compliance Report</h2>
        <button className="btn btn-secondary" onClick={onClose}>
          Back to List
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-value">{report.summary.total_employees}</div>
          <div className="card-label">Active Employees</div>
        </div>
        <div className="summary-card">
          <div className="card-value">{report.summary.total_published_policies}</div>
          <div className="card-label">Published Policies</div>
        </div>
        <div className="summary-card">
          <div className="card-value">{report.summary.total_acknowledgments}</div>
          <div className="card-label">Total Acknowledgments</div>
        </div>
        <div className="summary-card warning">
          <div className="card-value">{report.summary.overdue_count}</div>
          <div className="card-label">Overdue</div>
        </div>
      </div>

      {/* Policy Compliance Table */}
      <div className="section">
        <h3>Policy Compliance Rates</h3>
        <div className="table-container">
          <table className="compliance-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Category</th>
                <th>Version</th>
                <th>Acknowledged</th>
                <th>Pending</th>
                <th>Compliance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {report.policies.map(policy => (
                <tr key={policy.id}>
                  <td className="policy-name">{policy.title}</td>
                  <td>
                    <span
                      className="category-badge"
                      style={{ backgroundColor: CATEGORY_COLORS[policy.category] }}
                    >
                      {policy.category}
                    </span>
                  </td>
                  <td className="version">v{policy.version}</td>
                  <td className="count">{policy.acknowledged_count}</td>
                  <td className="count pending">{policy.pending_count}</td>
                  <td>
                    <div className="compliance-bar">
                      <div
                        className="compliance-fill"
                        style={{
                          width: `${policy.compliance_rate}%`,
                          backgroundColor: getComplianceColor(policy.compliance_rate)
                        }}
                      />
                      <span className="compliance-value">{policy.compliance_rate}%</span>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn-view"
                      onClick={() => viewAcknowledgments(policy)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue Section */}
      {report.overdue_acknowledgments.length > 0 && (
        <div className="section overdue-section">
          <h3>Overdue Acknowledgments</h3>
          <div className="table-container">
            <table className="overdue-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Policy</th>
                  <th>Was Due</th>
                </tr>
              </thead>
              <tbody>
                {report.overdue_acknowledgments.map((item, index) => (
                  <tr key={index}>
                    <td>{item.full_name}</td>
                    <td className="email">{item.email}</td>
                    <td>{item.policy_title}</td>
                    <td className="overdue-date">{formatDate(item.deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Acknowledgments Modal */}
      {selectedPolicy && (
        <div className="modal-overlay" onClick={() => setSelectedPolicy(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Acknowledgments: {selectedPolicy.title}</h3>
              <button className="btn-close" onClick={() => setSelectedPolicy(null)}>
                &times;
              </button>
            </div>
            <div className="modal-content">
              {loadingAcks ? (
                <div className="loading">Loading...</div>
              ) : acknowledgments.length === 0 ? (
                <div className="empty">No acknowledgments yet</div>
              ) : (
                <table className="ack-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Email</th>
                      <th>Acknowledged At</th>
                      <th>Version</th>
                      <th>Signed As</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acknowledgments.map(ack => (
                      <tr key={ack.id}>
                        <td>{ack.full_name}</td>
                        <td className="email">{ack.email}</td>
                        <td>{formatDate(ack.acknowledged_at)}</td>
                        <td className="version">v{ack.policy_version}</td>
                        <td className="signature">{ack.typed_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .compliance-report {
          padding: 20px;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .report-header h2 {
          margin: 0;
          color: #e0e0e0;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .summary-card {
          background: #16213e;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          border: 1px solid #2a2a4a;
        }

        .summary-card.warning {
          border-color: #ff6b6b;
        }

        .card-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: #7f5af0;
          margin-bottom: 5px;
        }

        .summary-card.warning .card-value {
          color: #ff6b6b;
        }

        .card-label {
          color: #a0a0a0;
          font-size: 0.9rem;
        }

        .section {
          margin-bottom: 30px;
        }

        .section h3 {
          color: #e0e0e0;
          margin-bottom: 15px;
        }

        .overdue-section h3 {
          color: #ff6b6b;
        }

        .table-container {
          overflow-x: auto;
        }

        .compliance-table,
        .overdue-table,
        .ack-table {
          width: 100%;
          border-collapse: collapse;
          background: #16213e;
          border-radius: 12px;
          overflow: hidden;
        }

        th {
          text-align: left;
          padding: 15px;
          background: #1a1a2e;
          color: #a0a0a0;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
        }

        td {
          padding: 15px;
          border-top: 1px solid #2a2a4a;
          color: #e0e0e0;
        }

        tr:hover {
          background: #1a1a2e;
        }

        .policy-name {
          font-weight: 500;
        }

        .category-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
        }

        .version {
          font-family: monospace;
          color: #808080;
        }

        .count {
          text-align: center;
          font-weight: 600;
        }

        .count.pending {
          color: #f7b731;
        }

        .compliance-bar {
          position: relative;
          background: #1a1a2e;
          border-radius: 10px;
          height: 24px;
          min-width: 120px;
          overflow: hidden;
        }

        .compliance-fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.3s;
        }

        .compliance-value {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.85rem;
          font-weight: 600;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        .btn-view {
          background: #2a2a4a;
          border: none;
          color: #7f5af0;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
        }

        .btn-view:hover {
          background: #3a3a5a;
        }

        .email {
          color: #808080;
          font-size: 0.9rem;
        }

        .overdue-date {
          color: #ff6b6b;
        }

        .signature {
          font-style: italic;
          color: #a0a0a0;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #16213e;
          border-radius: 12px;
          width: 600px;
          max-width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          border: 1px solid #2a2a4a;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 25px;
          border-bottom: 1px solid #2a2a4a;
          background: #1a1a2e;
          border-radius: 12px 12px 0 0;
        }

        .modal-header h3 {
          margin: 0;
          color: #e0e0e0;
          font-size: 1.1rem;
        }

        .btn-close {
          background: none;
          border: none;
          color: #808080;
          font-size: 1.5rem;
          cursor: pointer;
        }

        .modal-content {
          padding: 25px;
          overflow-y: auto;
        }

        .ack-table {
          width: 100%;
          table-layout: fixed;
        }

        .ack-table th,
        .ack-table td {
          padding: 10px 12px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          text-align: center;
        }

        .empty {
          text-align: center;
          color: #808080;
          padding: 40px;
        }

        .loading {
          text-align: center;
          color: #808080;
          padding: 40px;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          padding: 15px;
          border-radius: 8px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .btn-secondary {
          background: #2a2a4a;
          color: #e0e0e0;
        }

        .btn-secondary:hover {
          background: #3a3a5a;
        }
      `}</style>
    </div>
  );
}

export default PolicyComplianceReport;
