// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GDPR Data Export Page (Employee Self-Service)
 * Allows employees to request a copy of all their personal data
 * held in HeadOfficeOS (UK GDPR Article 15 — Right of Access).
 * Shows request history with download links and status badges.
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, Download, Clock, AlertCircle, Settings } from 'lucide-react';
import api from '../../utils/api';
import { apiFetch, getCSRFToken } from '../../utils/api';

/* Status badge class mapping */
const STATUS_CLASS = {
  pending: 'gdpr-status--pending',
  processing: 'gdpr-status--processing',
  completed: 'gdpr-status--completed',
  rejected: 'gdpr-status--rejected',
  expired: 'gdpr-status--expired'
};

/* Human-readable status labels */
const STATUS_LABEL = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Ready',
  rejected: 'Rejected',
  expired: 'Expired'
};

/**
 * Format a date string to en-GB locale (e.g. "6 Feb 2026")
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

/**
 * Format file size in bytes to a human-readable string
 */
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GDPRPage({ user, onNavigate }) {
  // Data state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Export action state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Download confirmation modal state
  const [confirmDownloadId, setConfirmDownloadId] = useState(null);
  const [confirmName, setConfirmName] = useState('');

  // Role checks for admin link
  const isAdmin = user.role_name === 'Admin' || user.role_name === 'HR Manager';

  /**
   * Fetch the current user's data requests
   */
  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/gdpr/my-requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch GDPR requests:', err);
      setError('Failed to load your data requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  /**
   * Request a new data export — sends POST and refreshes the list
   */
  const handleExport = async () => {
    try {
      setExporting(true);
      setExportError(null);
      await api.post('/gdpr/export');
      // Refresh the list to show the new request
      await fetchRequests();
    } catch (err) {
      console.error('Failed to request data export:', err);
      setExportError(err.message || 'Failed to create data export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Open confirmation modal before download — user must type their name
   */
  const promptDownload = (requestId) => {
    setConfirmDownloadId(requestId);
    setConfirmName('');
  };

  /**
   * Check if the typed name matches the user's full name (case-insensitive)
   */
  const isNameMatch = confirmName.trim().toLowerCase() === (user.full_name || '').trim().toLowerCase();

  /**
   * Download a completed export ZIP using blob fetch pattern
   */
  const handleDownload = async (requestId) => {
    // Close the confirmation modal
    setConfirmDownloadId(null);
    setConfirmName('');
    try {
      setDownloadingId(requestId);

      // Use raw fetch to get the blob (api.get parses JSON, we need binary)
      const response = await fetch(`/api/gdpr/download/${requestId}`, {
        credentials: 'include',
        headers: {
          'X-CSRF-Token': getCSRFToken()
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Download failed');
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition header or use default
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition && disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `data_export_${requestId}.zip`;
      document.body.appendChild(a);
      a.click();
      // Clean up the object URL and temporary anchor
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download export:', err);
      setExportError(err.message || 'Failed to download export.');
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * Check if a request's download link is still valid (not expired)
   */
  const isDownloadable = (request) => {
    return request.status === 'completed' &&
           request.file_path &&
           request.expires_at &&
           new Date(request.expires_at) > new Date();
  };

  // Loading state
  if (loading) {
    return (
      <div className="gdpr-page">
        <div className="loading">Loading your data requests…</div>
      </div>
    );
  }

  return (
    <div className="gdpr-page">
      {/* Page header with title and action buttons */}
      <div className="gdpr-page__header">
        <div>
          <h2 className="gdpr-page__title">
            <Shield size={24} aria-hidden="true" />
            My Data
          </h2>
          <p className="gdpr-page__subtitle">
            Request a copy of your personal data or manage previous requests
          </p>
        </div>
        <div className="gdpr-page__header-actions">
          {/* Admin/HR link to management page */}
          {isAdmin && (
            <button
              className="btn-secondary"
              onClick={() => onNavigate('gdpr-admin')}
              aria-label="Manage data requests"
            >
              <Settings size={16} aria-hidden="true" />
              Manage Requests
            </button>
          )}
          {/* Export button */}
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting}
            aria-label="Request a copy of your data"
          >
            {exporting ? (
              <>Generating export…</>
            ) : (
              <>
                <Download size={16} aria-hidden="true" />
                Request My Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* GDPR information box */}
      <div className="gdpr-page__info" role="region" aria-label="GDPR information">
        <AlertCircle size={18} aria-hidden="true" />
        <div>
          <strong>Your rights under UK GDPR</strong>
          <p>
            You have the right to request a copy of all personal data we hold about you.
            Your data will be compiled into a downloadable ZIP file containing JSON files
            organised by category. Download links expire after 30 days.
            You can request up to 3 exports per 24-hour period.
          </p>
        </div>
      </div>

      {/* Error banners */}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {exportError && (
        <div className="error-banner" role="alert">
          {exportError}
          <button
            className="error-banner__dismiss"
            onClick={() => setExportError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Request history */}
      <h3 className="gdpr-page__section-title">Request History</h3>

      {requests.length === 0 ? (
        <div className="goals-empty">
          <Shield size={48} className="goals-empty__icon" aria-hidden="true" />
          <h3 className="goals-empty__title">No data requests yet</h3>
          <p className="goals-empty__text">
            Click "Request My Data" to generate a copy of all your personal data.
          </p>
        </div>
      ) : (
        <table className="gdpr-page__table" aria-label="Data request history">
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Requested</th>
              <th scope="col">Expires</th>
              <th scope="col">Size</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} className="gdpr-page__row">
                {/* Request type */}
                <td className="gdpr-page__cell">
                  <span className={`gdpr-type gdpr-type--${req.request_type}`}>
                    {req.request_type === 'export' ? 'Data Export' : 'Data Deletion'}
                  </span>
                </td>
                {/* Status badge */}
                <td className="gdpr-page__cell">
                  <span className={`gdpr-status ${STATUS_CLASS[req.status] || ''}`}>
                    {STATUS_LABEL[req.status] || req.status}
                  </span>
                </td>
                {/* Created date */}
                <td className="gdpr-page__cell">{formatDate(req.created_at)}</td>
                {/* Expiry date */}
                <td className="gdpr-page__cell">
                  {req.expires_at ? formatDate(req.expires_at) : '—'}
                </td>
                {/* File size */}
                <td className="gdpr-page__cell">
                  {req.file_size_bytes ? formatFileSize(req.file_size_bytes) : '—'}
                </td>
                {/* Actions */}
                <td className="gdpr-page__cell">
                  {isDownloadable(req) && (
                    <button
                      className="btn-primary btn-primary--sm"
                      onClick={() => promptDownload(req.id)}
                      disabled={downloadingId === req.id}
                      aria-label={`Download export ${req.id}`}
                    >
                      <Download size={14} aria-hidden="true" />
                      {downloadingId === req.id ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                  {req.status === 'rejected' && req.rejection_reason && (
                    <span className="gdpr-page__rejection" title={req.rejection_reason}>
                      Reason: {req.rejection_reason}
                    </span>
                  )}
                  {req.status === 'expired' && (
                    <span className="gdpr-page__expired-note">Link expired</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Download confirmation modal — user must type their name */}
      {confirmDownloadId && (
        <div className="modal-backdrop" onClick={() => setConfirmDownloadId(null)}>
          <div
            className="gdpr-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm download"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="gdpr-confirm-modal__title">
              <Shield size={20} aria-hidden="true" />
              Confirm Your Identity
            </h3>
            <p className="gdpr-confirm-modal__text">
              This file contains sensitive personal data. To confirm you are the intended
              recipient, please type your full name exactly as it appears below:
            </p>
            <p className="gdpr-confirm-modal__name-hint">
              <strong>{user.full_name}</strong>
            </p>
            <input
              type="text"
              className="gdpr-confirm-modal__input"
              placeholder="Type your full name to confirm"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              aria-label="Type your full name to confirm download"
              autoFocus
            />
            <div className="gdpr-confirm-modal__actions">
              <button
                className="btn-secondary"
                onClick={() => setConfirmDownloadId(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => handleDownload(confirmDownloadId)}
                disabled={!isNameMatch}
                aria-label="Confirm and download"
              >
                <Download size={16} aria-hidden="true" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GDPRPage;
