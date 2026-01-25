/**
 * VoidStaffOS - Manager Leave Approvals Component
 * Interface for managers to approve leave requests.
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
import { apiFetch } from '../utils/api';

function ManagerLeaveApprovals({ user, onClose }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {

      const [pendingRes, allRes] = await Promise.all([
        fetch('/api/leave/pending', {
          credentials: 'include'
        }),
        fetch('/api/leave/team', {
          credentials: 'include'
        })
      ]);

      const pendingData = await pendingRes.json();
      const allData = await allRes.json();

      if (pendingRes.ok) {
        setPendingRequests(pendingData.pending_requests);
      }
      if (allRes.ok) {
        setAllRequests(allData.leave_requests);
      }
    } catch (err) {
      setError('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    try {
      const response = await apiFetch(`/api/leave/${requestId}/approve`, {
        method: 'PUT'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      fetchRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;

    setProcessingId(rejectModal);
    try {
      const response = await apiFetch(`/api/leave/${rejectModal}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ rejection_reason: rejectReason })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      setRejectModal(null);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getLeaveTypeDisplay = (type) => {
    const types = {
      'full_day': 'Full Day',
      'half_day_am': 'Half Day (AM)',
      'half_day_pm': 'Half Day (PM)'
    };
    return types[type] || type;
  };

  const getStatusBadge = (status) => {
    const styles = {
      'pending': 'status-pending',
      'approved': 'status-approved',
      'rejected': 'status-rejected',
      'cancelled': 'status-cancelled'
    };
    return <span className={`leave-status-badge ${styles[status]}`}>{status}</span>;
  };

  const getNoticeBadge = (request) => {
    if (request.meets_notice_requirement) {
      return <span className="notice-badge good">OK</span>;
    }
    return (
      <span className="notice-badge warning" title={`Required: ${request.required_notice_days} days`}>
        Short
      </span>
    );
  };

  const requests = activeTab === 'pending' ? pendingRequests : allRequests;

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          <div className="loading">Loading leave requests...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h3>Team Leave Requests</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="leave-tabs">
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingRequests.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Requests
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="leave-requests-list">
          {requests.length === 0 ? (
            <div className="no-requests">
              {activeTab === 'pending' ? 'No pending leave requests' : 'No leave requests found'}
            </div>
          ) : (
            <table className="leave-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Days</th>
                  <th>Notice</th>
                  <th>Status</th>
                  {activeTab === 'pending' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div className="employee-cell">
                        <span className="employee-name">{req.employee_name}</span>
                        <span className="employee-number">{req.employee_number}</span>
                      </div>
                    </td>
                    <td>
                      <div className="date-range">
                        <span>{formatDate(req.leave_start_date)}</span>
                        {req.leave_start_date !== req.leave_end_date && (
                          <>
                            <span className="date-separator">-</span>
                            <span>{formatDate(req.leave_end_date)}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>{getLeaveTypeDisplay(req.leave_type)}</td>
                    <td className="days-cell">{req.total_days}</td>
                    <td>
                      <div className="notice-cell">
                        <span>{req.notice_days}d</span>
                        {getNoticeBadge(req)}
                      </div>
                    </td>
                    <td>{getStatusBadge(req.status)}</td>
                    {activeTab === 'pending' && (
                      <td className="actions-cell">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="approve-btn"
                          disabled={processingId === req.id}
                        >
                          {processingId === req.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setRejectModal(req.id)}
                          className="reject-btn"
                          disabled={processingId === req.id}
                        >
                          Reject
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="form-actions">
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>

        {/* Reject Modal */}
        {rejectModal && (
          <div className="modal-overlay inner-modal">
            <div className="modal-content modal-small">
              <div className="modal-header">
                <h3>Reject Leave Request</h3>
                <button onClick={() => setRejectModal(null)} className="close-btn">&times;</button>
              </div>
              <div className="form-group">
                <label>Reason for rejection (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason..."
                />
              </div>
              <div className="form-actions">
                <button onClick={() => setRejectModal(null)} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={handleReject} className="reject-btn">
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManagerLeaveApprovals;
