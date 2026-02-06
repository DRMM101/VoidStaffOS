// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — CompensationAuditLog
 * Filterable table showing all compensation data access and changes.
 * HR/Admin only.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import PageHeader from '../layout/PageHeader';

// Audit action types for filter dropdown
const AUDIT_ACTIONS = ['view', 'create', 'update', 'export', 'download'];

function CompensationAuditLog({ user }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    employee_id: '',
    action: '',
    start_date: '',
    end_date: '',
    limit: 50,
    offset: 0
  });

  // Fetch audit entries when filters change
  const fetchEntries = async () => {
    setLoading(true);
    try {
      // Build query string from non-empty filters
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(filters)) {
        if (val !== '' && val !== null) params.append(key, val);
      }

      const response = await apiFetch(`/api/compensation/audit?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.data);
        setTotal(data.total);
      } else {
        setError('Failed to load audit log');
      }
    } catch (err) {
      console.error('Fetch audit log error:', err);
      setError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, [filters.offset]);

  // Format datetime for display
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Handle filter form submission
  const handleFilter = (e) => {
    e.preventDefault();
    setFilters({ ...filters, offset: 0 });
    fetchEntries();
  };

  // Pagination
  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil(total / filters.limit);

  const goToPage = (page) => {
    setFilters({ ...filters, offset: (page - 1) * filters.limit });
  };

  return (
    <div className="compensation-audit-log">
      <PageHeader
        title="Compensation Audit Log"
        subtitle={`${total} entries recorded`}
      />

      {error && <div className="alert alert--error">{error}</div>}

      {/* Filters */}
      <form className="audit-filters" onSubmit={handleFilter}>
        <div className="audit-filters__row">
          <div className="form-group">
            <label htmlFor="audit-action">Action</label>
            <select id="audit-action" value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
              <option value="">All</option>
              {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="audit-employee">Employee ID</label>
            <input id="audit-employee" type="number" placeholder="Filter by employee"
              value={filters.employee_id}
              onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="audit-start">From</label>
            <input id="audit-start" type="date" value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="audit-end">To</label>
            <input id="audit-end" type="date" value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} />
          </div>
          <button type="submit" className="btn btn--primary btn--sm">Filter</button>
        </div>
      </form>

      {/* Audit entries table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Accessed By</th>
              <th>Action</th>
              <th>Table</th>
              <th>Employee</th>
              <th>Field</th>
              <th>Old Value</th>
              <th>New Value</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="text-center">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan="9" className="text-center text-muted">No audit entries found</td></tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-nowrap">{formatDateTime(entry.created_at)}</td>
                  <td>{entry.accessed_by_name}</td>
                  <td>
                    <span className={`audit-action-badge audit-action-badge--${entry.action}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td>{entry.table_name}</td>
                  <td>{entry.employee_name || '—'}</td>
                  <td>{entry.field_changed || '—'}</td>
                  <td className="text-mono">{entry.old_value || '—'}</td>
                  <td className="text-mono">{entry.new_value || '—'}</td>
                  <td className="text-mono">{entry.ip_address || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn--sm btn--secondary"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </button>
          <span className="pagination__info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn--sm btn--secondary"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default CompensationAuditLog;
