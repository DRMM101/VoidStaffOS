import { useState, useEffect } from 'react';
import './MyRecruitmentRequests.css';

const STATUS_LABELS = {
  draft: { label: 'Draft', color: '#6b7280' },
  pending_approval: { label: 'Pending Approval', color: '#f59e0b' },
  approved: { label: 'Approved', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  filled: { label: 'Filled', color: '#3b82f6' },
  cancelled: { label: 'Cancelled', color: '#9ca3af' }
};

export default function MyRecruitmentRequests({ onClose }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/recruitment/requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      } else {
        throw new Error('Failed to fetch requests');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      <div className="my-requests-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>My Recruitment Requests</h2>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading">Loading requests...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <p>You haven't submitted any recruitment requests yet.</p>
            </div>
          ) : (
            <div className="requests-list">
              {requests.map(request => {
                const statusInfo = STATUS_LABELS[request.status] || { label: request.status, color: '#6b7280' };
                return (
                  <div key={request.id} className="request-card">
                    <div className="request-header">
                      <h3>{request.role_title}</h3>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="request-details">
                      <div className="detail-row">
                        <span className="label">Department:</span>
                        <span>{request.department || 'Not specified'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Tier:</span>
                        <span>{request.role_tier ? `Tier ${request.role_tier}` : 'Not specified'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Salary Range:</span>
                        <span>{formatSalary(request.proposed_salary_min, request.proposed_salary_max)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Hours:</span>
                        <span className="capitalize">{request.proposed_hours || 'Full-time'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Requested:</span>
                        <span>{formatDate(request.created_at)}</span>
                      </div>
                      {request.approver_name && (
                        <div className="detail-row">
                          <span className="label">Approver:</span>
                          <span>{request.approver_name}</span>
                        </div>
                      )}
                    </div>

                    {request.justification && (
                      <div className="request-justification">
                        <strong>Justification:</strong>
                        <p>{request.justification}</p>
                      </div>
                    )}

                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="rejection-reason">
                        <strong>Rejection Reason:</strong>
                        <p>{request.rejection_reason}</p>
                      </div>
                    )}

                    {request.status === 'approved' && (
                      <div className="approved-info">
                        <span>Approved on {formatDate(request.approved_at)}</span>
                        {request.approved_by_name && (
                          <span> by {request.approved_by_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
