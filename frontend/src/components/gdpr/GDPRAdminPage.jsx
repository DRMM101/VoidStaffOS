// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — GDPR Admin Page (HR/Admin Management)
 * Lists all data requests across the tenant with filtering.
 * Allows HR/Admin to process, reject, and create deletion requests.
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import GDPRRequestDetail from './GDPRRequestDetail';
import DataDeletionModal from './DataDeletionModal';

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
  completed: 'Completed',
  rejected: 'Rejected',
  expired: 'Expired'
};

/**
 * Format a date string to en-GB locale
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function GDPRAdminPage({ user, onNavigate }) {
  // Data state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  // Cleanup state
  const [cleaning, setCleaning] = useState(false);

  /**
   * Fetch all data requests with current filters
   */
  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      // Build query params from active filters
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const queryStr = params.toString();
      const data = await api.get(`/gdpr/requests${queryStr ? '?' + queryStr : ''}`);
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch GDPR requests:', err);
      setError('Failed to load data requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  /**
   * Clean up expired export files
   */
  const handleCleanup = async () => {
    try {
      setCleaning(true);
      const data = await api.post('/gdpr/cleanup-expired');
      alert(`Cleaned up ${data.cleaned} expired export(s).`);
      await fetchRequests();
    } catch (err) {
      console.error('Failed to cleanup expired exports:', err);
      setError('Failed to clean up expired exports.');
    } finally {
      setCleaning(false);
    }
  };

  /**
   * Called when a deletion request is successfully created from the modal
   */
  const handleDeletionCreated = () => {
    setShowDeletionModal(false);
    fetchRequests();
  };

  /**
   * Called when a request is processed/rejected from the detail modal
   */
  const handleRequestUpdated = () => {
    setSelectedRequestId(null);
    fetchRequests();
  };

  // Loading state
  if (loading) {
    return (
      <div className="gdpr-admin">
        <div className="loading">Loading data requests…</div>
      </div>
    );
  }

  return (
    <div className="gdpr-admin">
      {/* Page header */}
      <div className="gdpr-page__header">
        <div>
          <h2 className="gdpr-page__title">
            <Shield size={24} aria-hidden="true" />
            Data Requests
          </h2>
          <p className="gdpr-page__subtitle">
            Manage GDPR data export and deletion requests across the organisation
          </p>
        </div>
        <div className="gdpr-page__header-actions">
          {/* Navigate to employee view */}
          <button
            className="btn-secondary"
            onClick={() => onNavigate('gdpr')}
          >
            Employee View
          </button>
          {/* Cleanup expired exports */}
          <button
            className="btn-secondary"
            onClick={handleCleanup}
            disabled={cleaning}
            aria-label="Clean up expired exports"
          >
            <RefreshCw size={16} aria-hidden="true" />
            {cleaning ? 'Cleaning…' : 'Cleanup Expired'}
          </button>
          {/* Create deletion request */}
          <button
            className="btn-primary"
            onClick={() => setShowDeletionModal(true)}
            aria-label="Create deletion request"
          >
            <Trash2 size={16} aria-hidden="true" />
            Deletion Request
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && <div className="error-banner" role="alert">{error}</div>}

      {/* Filters */}
      <div className="gdpr-admin__filters">
        {/* Status filter */}
        <select
          className="gdpr-admin__filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>

        {/* Type filter */}
        <select
          className="gdpr-admin__filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          <option value="export">Export</option>
          <option value="deletion">Deletion</option>
        </select>

        {/* Search by employee name */}
        <input
          type="text"
          className="gdpr-admin__search"
          placeholder="Search employee name or email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search by employee name or email"
        />
      </div>

      {/* Requests table */}
      {requests.length === 0 ? (
        <div className="goals-empty">
          <Shield size={48} className="goals-empty__icon" aria-hidden="true" />
          <h3 className="goals-empty__title">No data requests found</h3>
          <p className="goals-empty__text">
            {statusFilter || typeFilter || searchQuery
              ? 'No requests match your current filters.'
              : 'No GDPR data requests have been made yet.'}
          </p>
        </div>
      ) : (
        <table className="gdpr-admin__table" aria-label="Data requests list">
          <thead>
            <tr>
              <th scope="col">Employee</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Requested</th>
              <th scope="col">Processed By</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr
                key={req.id}
                className="gdpr-admin__row"
                onClick={() => setSelectedRequestId(req.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedRequestId(req.id); }}
                aria-label={`View request ${req.id} for ${req.employee_name}`}
              >
                {/* Employee info */}
                <td className="gdpr-admin__cell">
                  <div className="gdpr-admin__employee">
                    <span className="gdpr-admin__employee-name">{req.employee_name}</span>
                    <span className="gdpr-admin__employee-id">{req.employee_number || req.employee_email}</span>
                  </div>
                </td>
                {/* Request type */}
                <td className="gdpr-admin__cell">
                  <span className={`gdpr-type gdpr-type--${req.request_type}`}>
                    {req.request_type === 'export' ? 'Export' : 'Deletion'}
                  </span>
                </td>
                {/* Status badge */}
                <td className="gdpr-admin__cell">
                  <span className={`gdpr-status ${STATUS_CLASS[req.status] || ''}`}>
                    {STATUS_LABEL[req.status] || req.status}
                  </span>
                </td>
                {/* Created date */}
                <td className="gdpr-admin__cell">{formatDate(req.created_at)}</td>
                {/* Processed by */}
                <td className="gdpr-admin__cell">{req.processed_by_name || '—'}</td>
                {/* Quick actions */}
                <td className="gdpr-admin__cell">
                  <button
                    className="btn-secondary btn-secondary--sm"
                    onClick={(e) => { e.stopPropagation(); setSelectedRequestId(req.id); }}
                    aria-label={`View details for request ${req.id}`}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Request detail modal */}
      {selectedRequestId && (
        <GDPRRequestDetail
          requestId={selectedRequestId}
          user={user}
          onClose={() => setSelectedRequestId(null)}
          onUpdated={handleRequestUpdated}
        />
      )}

      {/* Deletion request modal */}
      {showDeletionModal && (
        <DataDeletionModal
          user={user}
          onClose={() => setShowDeletionModal(false)}
          onSuccess={handleDeletionCreated}
        />
      )}
    </div>
  );
}

export default GDPRAdminPage;
