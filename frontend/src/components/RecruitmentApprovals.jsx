/**
 * VoidStaffOS - Recruitment Approvals Component
 * Interface for approving recruitment requests.
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
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

import { useState, useEffect } from 'react';
import './RecruitmentApprovals.css';

export default function RecruitmentApprovals({ onClose }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    try {
      const response = await fetch('/api/recruitment/my-approvals', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setApprovals(data.pending_approvals || []);
      } else {
        throw new Error('Failed to fetch approvals');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(requestId) {
    setProcessing(requestId);
    try {
      const response = await fetch(`/api/recruitment/requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve');
      }

      fetchApprovals();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(requestId) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessing(requestId);
    try {
      const response = await fetch(`/api/recruitment/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rejection_reason: reason })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject');
      }

      fetchApprovals();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(null);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  }

  function formatSalary(min, max) {
    if (!min && !max) return 'Not specified';
    if (min && max) return `£${Number(min).toLocaleString()} - £${Number(max).toLocaleString()}`;
    if (min) return `From £${Number(min).toLocaleString()}`;
    return `Up to £${Number(max).toLocaleString()}`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="approvals-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Pending Recruitment Approvals</h2>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : approvals.length === 0 ? (
            <div className="empty-state">
              <p>No pending recruitment approvals.</p>
            </div>
          ) : (
            <div className="approvals-list">
              {approvals.map(request => (
                <div key={request.id} className="approval-card">
                  <div className="approval-header">
                    <div>
                      <h3>{request.role_title}</h3>
                      <span className="requester">
                        Requested by {request.requested_by_name}
                      </span>
                    </div>
                    <span className="submitted-date">
                      {formatDate(request.submitted_at)}
                    </span>
                  </div>

                  <div className="approval-details">
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="label">Department</span>
                        <span className="value">{request.department || '-'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Tier</span>
                        <span className="value">{request.role_tier ? `Tier ${request.role_tier}` : '-'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Salary Range</span>
                        <span className="value">{formatSalary(request.proposed_salary_min, request.proposed_salary_max)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Hours</span>
                        <span className="value capitalize">{request.proposed_hours || 'Full-time'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Start Date</span>
                        <span className="value">{request.proposed_start_date ? formatDate(request.proposed_start_date) : 'ASAP'}</span>
                      </div>
                    </div>

                    {request.role_description && (
                      <div className="description-section">
                        <h4>Role Description</h4>
                        <p>{request.role_description}</p>
                      </div>
                    )}

                    <div className="justification-section">
                      <h4>Justification</h4>
                      <p>{request.justification}</p>
                    </div>
                  </div>

                  <div className="approval-actions">
                    <button
                      className="btn-reject"
                      onClick={() => handleReject(request.id)}
                      disabled={processing === request.id}
                    >
                      Reject
                    </button>
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(request.id)}
                      disabled={processing === request.id}
                    >
                      {processing === request.id ? 'Processing...' : 'Approve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
