/**
 * VoidStaffOS - My Leave Requests Component
 * Displays user's own leave requests.
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
import LeaveRequest from './LeaveRequest';

function MyLeaveRequests({ onClose }) {
  const [requests, setRequests] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/leave/my-requests', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setRequests(data.leave_requests);
        setBalance(data.balance);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId) => {
    setCancellingId(requestId);
    try {
      const response = await apiFetch(`/api/leave/${requestId}/cancel`, {
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
      setCancellingId(null);
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
          <h3>My Leave Requests</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {balance && (
          <div className="leave-balance-bar">
            <div className="balance-stat">
              <span className="stat-value">{balance.entitlement}</span>
              <span className="stat-label">Entitlement</span>
            </div>
            <div className="balance-stat used">
              <span className="stat-value">{balance.used}</span>
              <span className="stat-label">Used</span>
            </div>
            <div className="balance-stat pending">
              <span className="stat-value">{balance.pending}</span>
              <span className="stat-label">Pending</span>
            </div>
            <div className="balance-stat remaining">
              <span className="stat-value">{balance.remaining}</span>
              <span className="stat-label">Remaining</span>
            </div>
            <button onClick={() => setShowNewRequest(true)} className="new-request-btn">
              + New Request
            </button>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="leave-requests-list">
          {requests.length === 0 ? (
            <div className="no-requests">
              <p>You have no leave requests.</p>
              <button onClick={() => setShowNewRequest(true)} className="primary-btn">
                Request Leave
              </button>
            </div>
          ) : (
            <table className="leave-table">
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Manager</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} className={req.status === 'cancelled' ? 'cancelled-row' : ''}>
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
                      {getStatusBadge(req.status)}
                      {req.rejection_reason && (
                        <div className="rejection-reason" title={req.rejection_reason}>
                          Reason: {req.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td>{req.manager_name || '-'}</td>
                    <td>
                      {req.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(req.id)}
                          className="cancel-request-btn"
                          disabled={cancellingId === req.id}
                        >
                          {cancellingId === req.id ? '...' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="form-actions">
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>

        {showNewRequest && (
          <LeaveRequest
            onClose={() => setShowNewRequest(false)}
            onSubmit={() => {
              setShowNewRequest(false);
              fetchRequests();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default MyLeaveRequests;
