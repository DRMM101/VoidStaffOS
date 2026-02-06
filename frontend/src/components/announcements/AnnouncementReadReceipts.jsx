// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — AnnouncementReadReceipts Component
 * Admin view showing who has read a specific announcement.
 * Displays employee list with read/unread status and timestamps.
 */

import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock } from 'lucide-react';
import api from '../../utils/api';

/** Format date+time to en-GB locale */
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function AnnouncementReadReceipts({ announcement, onClose }) {
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Fetch read receipts for this announcement */
  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        setError(null);
        const data = await api.get(`/announcements/${announcement.id}/reads`);
        setEmployees(data.employees || []);
        setSummary(data.summary || null);
      } catch (err) {
        console.error('Failed to fetch read receipts:', err);
        setError('Failed to load read receipts.');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, [announcement.id]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Read receipts">
      <div className="modal-dialog modal--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-dialog__header">
          <h3>Read Receipts</h3>
          <button className="modal-dialog__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Announcement title for context */}
        <p className="announcement-reads__title">{announcement.title}</p>

        {/* Loading */}
        {loading && (
          <div className="loading" style={{ padding: 'var(--space-lg)' }}>Loading…</div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        {/* Summary stats */}
        {summary && !loading && (
          <div className="announcement-reads__summary">
            <div className="announcement-reads__stat">
              <span className="announcement-reads__stat-number">{summary.read}</span>
              <span className="announcement-reads__stat-label">Read</span>
            </div>
            <div className="announcement-reads__stat">
              <span className="announcement-reads__stat-number">{summary.unread}</span>
              <span className="announcement-reads__stat-label">Unread</span>
            </div>
            <div className="announcement-reads__stat">
              <span className="announcement-reads__stat-number">{summary.percentage}%</span>
              <span className="announcement-reads__stat-label">Coverage</span>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {summary && !loading && (
          <div className="goal-progress__bar goal-progress__bar--lg" style={{ margin: '0 var(--space-5) var(--space-4)' }}>
            <div
              className="goal-progress__fill goal-progress__fill--teal"
              style={{ width: `${summary.percentage}%` }}
            />
          </div>
        )}

        {/* Employee list */}
        {!loading && employees.length > 0 && (
          <div className="announcement-reads__list-wrapper">
            <table className="announcement-reads__table" aria-label="Read receipts">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Read At</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="announcement-reads__row">
                    <td className="announcement-reads__cell">
                      <span className="announcement-reads__name">{emp.full_name}</span>
                      {emp.employee_number && (
                        <span className="announcement-reads__emp-no">#{emp.employee_number}</span>
                      )}
                    </td>
                    <td className="announcement-reads__cell">{emp.role_name}</td>
                    <td className="announcement-reads__cell">
                      {emp.has_read ? (
                        <span className="announcement-reads__status announcement-reads__status--read">
                          <CheckCircle size={14} aria-hidden="true" />
                          Read
                        </span>
                      ) : (
                        <span className="announcement-reads__status announcement-reads__status--unread">
                          <Clock size={14} aria-hidden="true" />
                          Unread
                        </span>
                      )}
                    </td>
                    <td className="announcement-reads__cell">
                      {emp.has_read ? formatDateTime(emp.read_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnnouncementReadReceipts;
