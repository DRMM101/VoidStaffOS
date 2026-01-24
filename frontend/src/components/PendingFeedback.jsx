import { useState, useEffect } from 'react';
import FeedbackRequest from './FeedbackRequest';
import './PendingFeedback.css';

export default function PendingFeedback({ onClose }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/feedback/pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setPendingRequests(data.pending_feedback || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmitted = () => {
    setSelectedRequest(null);
    fetchPendingRequests();
  };

  const getReviewerTypeLabel = (type) => {
    switch (type) {
      case 'self': return 'Self-Assessment';
      case 'manager': return 'Manager Review';
      case 'skip_level': return 'Skip-Level Review';
      case 'direct_report': return 'Direct Report (Anonymous)';
      default: return type;
    }
  };

  const getReviewerTypeIcon = (type) => {
    switch (type) {
      case 'self': return '\u{1F9D1}';
      case 'manager': return '\u{1F464}';
      case 'skip_level': return '\u{1F465}';
      case 'direct_report': return '\u{1F4AC}';
      default: return '\u{2753}';
    }
  };

  const formatDeadline = (dateStr) => {
    if (!dateStr) return 'No deadline';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays} days left`;
  };

  const getDeadlineClass = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'urgent';
    return '';
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="pending-feedback-modal" onClick={e => e.stopPropagation()}>
          <div className="loading">Loading pending feedback...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pending-feedback-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Pending Feedback Requests</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {pendingRequests.length === 0 ? (
          <div className="no-pending">
            <span className="check-icon">{'\u{2705}'}</span>
            <p>No pending feedback requests!</p>
            <p className="hint">You're all caught up.</p>
          </div>
        ) : (
          <div className="requests-list">
            <p className="requests-count">
              You have <strong>{pendingRequests.length}</strong> feedback request{pendingRequests.length !== 1 ? 's' : ''} to complete
            </p>

            {pendingRequests.map(request => (
              <div key={request.id} className="request-card">
                <div className="request-icon">
                  {getReviewerTypeIcon(request.reviewer_type)}
                </div>
                <div className="request-details">
                  <div className="request-header">
                    <span className="employee-name">
                      {request.reviewer_type === 'self' ? 'Self-Assessment' : request.employee_name}
                    </span>
                    <span className={`deadline ${getDeadlineClass(request.deadline)}`}>
                      {formatDeadline(request.deadline)}
                    </span>
                  </div>
                  <div className="request-meta">
                    <span className={`type-badge ${request.reviewer_type}`}>
                      {getReviewerTypeLabel(request.reviewer_type)}
                    </span>
                    <span className="quarter">{request.quarter}</span>
                    {request.employee_role && request.reviewer_type !== 'self' && (
                      <span className="role">{request.employee_role}</span>
                    )}
                  </div>
                </div>
                <button
                  className="btn-provide-feedback"
                  onClick={() => setSelectedRequest(request)}
                >
                  Provide Feedback
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Feedback Form Modal */}
        {selectedRequest && (
          <FeedbackRequest
            request={selectedRequest}
            onSubmit={handleFeedbackSubmitted}
            onClose={() => setSelectedRequest(null)}
          />
        )}
      </div>
    </div>
  );
}
