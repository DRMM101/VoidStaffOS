// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GDPR Request Detail Modal
 * Displays full details of a data request including employee info,
 * status, timestamps, and an activity log timeline.
 * Admin can process (approve) or reject pending requests.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, XCircle, Clock, Download, User } from 'lucide-react';
import api from '../../utils/api';

/* Status badge class mapping */
const STATUS_CLASS = {
  pending: 'gdpr-status--pending',
  processing: 'gdpr-status--processing',
  completed: 'gdpr-status--completed',
  rejected: 'gdpr-status--rejected',
  expired: 'gdpr-status--expired'
};

/**
 * Format a date string to en-GB locale with time
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Format file size in bytes to a human-readable string
 */
function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GDPRRequestDetail({ requestId, user, onClose, onUpdated }) {
  // Data state
  const [request, setRequest] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Action state
  const [processing, setProcessing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState(null);

  // Check if user can approve (Admin only for deletions)
  const isAdmin = user.role_name === 'Admin';

  /**
   * Fetch request details and activity log
   */
  const fetchDetail = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get(`/gdpr/requests/${requestId}`);
      setRequest(data.request);
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch request detail:', err);
      setError('Failed to load request details.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  /**
   * Process (approve) a pending request
   */
  const handleProcess = async () => {
    try {
      setProcessing(true);
      setActionError(null);
      await api.post(`/gdpr/requests/${requestId}/process`);
      onUpdated();
    } catch (err) {
      console.error('Failed to process request:', err);
      setActionError(err.message || 'Failed to process request.');
      setProcessing(false);
    }
  };

  /**
   * Reject a pending request with reason
   */
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setActionError('Please provide a reason for rejection.');
      return;
    }
    try {
      setRejecting(true);
      setActionError(null);
      await api.post(`/gdpr/requests/${requestId}/reject`, { reason: rejectReason.trim() });
      onUpdated();
    } catch (err) {
      console.error('Failed to reject request:', err);
      setActionError(err.message || 'Failed to reject request.');
      setRejecting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Request details">
      <div className="modal-dialog modal--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>Data Request Details</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Loading state */}
        {loading && <div className="loading" style={{ padding: '2rem' }}>Loading…</div>}

        {/* Error state */}
        {error && <div className="error-banner" role="alert">{error}</div>}

        {/* Request details */}
        {request && (
          <div className="gdpr-detail">
            {/* Info grid */}
            <div className="gdpr-detail__info">
              <div className="gdpr-detail__field">
                <span className="gdpr-detail__label">Employee</span>
                <span className="gdpr-detail__value">
                  <User size={14} aria-hidden="true" />
                  {request.employee_name} ({request.employee_email})
                </span>
              </div>
              <div className="gdpr-detail__field">
                <span className="gdpr-detail__label">Employee Number</span>
                <span className="gdpr-detail__value">{request.employee_number || '—'}</span>
              </div>
              <div className="gdpr-detail__field">
                <span className="gdpr-detail__label">Request Type</span>
                <span className="gdpr-detail__value">
                  <span className={`gdpr-type gdpr-type--${request.request_type}`}>
                    {request.request_type === 'export' ? 'Data Export' : 'Data Deletion'}
                  </span>
                </span>
              </div>
              <div className="gdpr-detail__field">
                <span className="gdpr-detail__label">Status</span>
                <span className="gdpr-detail__value">
                  <span className={`gdpr-status ${STATUS_CLASS[request.status] || ''}`}>
                    {request.status}
                  </span>
                </span>
              </div>
              <div className="gdpr-detail__field">
                <span className="gdpr-detail__label">Requested By</span>
                <span className="gdpr-detail__value">{request.requested_by_name || '—'}</span>
              </div>
              <div className="gdpr-detail__field">
                <span className="gdpr-detail__label">Requested On</span>
                <span className="gdpr-detail__value">{formatDateTime(request.created_at)}</span>
              </div>
              {request.processed_by_name && (
                <div className="gdpr-detail__field">
                  <span className="gdpr-detail__label">Processed By</span>
                  <span className="gdpr-detail__value">{request.processed_by_name}</span>
                </div>
              )}
              {request.processed_at && (
                <div className="gdpr-detail__field">
                  <span className="gdpr-detail__label">Processed On</span>
                  <span className="gdpr-detail__value">{formatDateTime(request.processed_at)}</span>
                </div>
              )}
              {request.file_size_bytes && (
                <div className="gdpr-detail__field">
                  <span className="gdpr-detail__label">Export Size</span>
                  <span className="gdpr-detail__value">
                    <Download size={14} aria-hidden="true" />
                    {formatFileSize(request.file_size_bytes)}
                  </span>
                </div>
              )}
              {request.expires_at && (
                <div className="gdpr-detail__field">
                  <span className="gdpr-detail__label">Expires</span>
                  <span className="gdpr-detail__value">{formatDateTime(request.expires_at)}</span>
                </div>
              )}
              {request.reason && (
                <div className="gdpr-detail__field gdpr-detail__field--full">
                  <span className="gdpr-detail__label">Reason</span>
                  <span className="gdpr-detail__value">{request.reason}</span>
                </div>
              )}
              {request.rejection_reason && (
                <div className="gdpr-detail__field gdpr-detail__field--full">
                  <span className="gdpr-detail__label">Rejection Reason</span>
                  <span className="gdpr-detail__value gdpr-detail__value--rejected">
                    {request.rejection_reason}
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons for pending requests */}
            {request.status === 'pending' && (
              <div className="gdpr-detail__actions">
                {actionError && <div className="error-banner" role="alert">{actionError}</div>}

                {!showRejectForm ? (
                  <>
                    {isAdmin && (
                      <button
                        className="btn-primary"
                        onClick={handleProcess}
                        disabled={processing}
                      >
                        <CheckCircle size={16} aria-hidden="true" />
                        {processing ? 'Processing…' : (request.request_type === 'export' ? 'Generate Export' : 'Approve Deletion')}
                      </button>
                    )}
                    <button
                      className="btn-danger"
                      onClick={() => setShowRejectForm(true)}
                    >
                      <XCircle size={16} aria-hidden="true" />
                      Reject
                    </button>
                  </>
                ) : (
                  /* Inline reject form */
                  <div className="gdpr-detail__reject-form">
                    <label htmlFor="reject-reason">Rejection Reason *</label>
                    <textarea
                      id="reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Provide a reason for rejecting this request…"
                      rows={3}
                      required
                    />
                    <div className="gdpr-detail__reject-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => { setShowRejectForm(false); setRejectReason(''); setActionError(null); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-danger"
                        onClick={handleReject}
                        disabled={rejecting || !rejectReason.trim()}
                      >
                        {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity log timeline */}
            {logs.length > 0 && (
              <div className="gdpr-detail__timeline">
                <h4 className="gdpr-detail__timeline-title">Activity Log</h4>
                {logs.map((log) => (
                  <div key={log.id} className="gdpr-detail__log-entry">
                    <Clock size={14} className="gdpr-detail__log-icon" aria-hidden="true" />
                    <div className="gdpr-detail__log-content">
                      <span className="gdpr-detail__log-action">{log.action}</span>
                      <span className="gdpr-detail__log-by">by {log.performed_by_name}</span>
                      <span className="gdpr-detail__log-time">{formatDateTime(log.created_at)}</span>
                      {log.details && (
                        <p className="gdpr-detail__log-details">{log.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GDPRRequestDetail;
