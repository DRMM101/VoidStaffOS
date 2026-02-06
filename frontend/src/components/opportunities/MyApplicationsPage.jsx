// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

/**
 * MyApplicationsPage — displays the current user's submitted opportunity applications.
 * Shows a table of all applications with status badges and withdraw functionality.
 *
 * Props:
 *   - user: the currently authenticated user object
 *   - onNavigate: callback for page navigation (pageKey, params)
 */
const MyApplicationsPage = ({ user, onNavigate }) => {
  // State for the list of applications fetched from the API
  const [applications, setApplications] = useState([]);
  // Loading flag — true while the initial fetch is in progress
  const [loading, setLoading] = useState(true);
  // Error message string, null when no error
  const [error, setError] = useState(null);
  // Tracks which application ID is currently being withdrawn (for button disable)
  const [withdrawingId, setWithdrawingId] = useState(null);

  /**
   * Fetch all of the current user's applications on component mount.
   * Hits GET /api/opportunities/applications/mine via apiFetch.
   */
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch the user's own applications from the API
        const response = await apiFetch('/api/opportunities/applications/mine');
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to load applications');
        }
        const data = await response.json();
        // API returns an array directly
        setApplications(Array.isArray(data) ? data : []);
      } catch (err) {
        // Store error message for display in the UI
        setError(err.message || 'Failed to load your applications.');
      } finally {
        // Always clear loading state regardless of success or failure
        setLoading(false);
      }
    };

    fetchApplications();
  }, []); // Empty dependency array — run once on mount only

  /**
   * Format a status string for display.
   * Capitalises the first letter and replaces underscores with spaces.
   * e.g. "under_review" => "Under review"
   *
   * @param {string} status - raw status value from the API
   * @returns {string} human-readable status text
   */
  const formatStatus = (status) => {
    if (!status) return '';
    // Replace underscores with spaces, then capitalise the first character
    const text = status.replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  /**
   * Format an ISO date string into a readable locale date.
   * Returns a dash if no date is provided.
   *
   * @param {string} dateStr - ISO date string
   * @returns {string} formatted date or '-'
   */
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      // Fallback if date parsing fails
      return dateStr;
    }
  };

  /**
   * Handle withdrawing an application.
   * Confirms with the user first, then calls PUT /api/opportunities/applications/:id/withdraw.
   * On success, updates the local state to reflect the withdrawn status.
   *
   * @param {number|string} applicationId - ID of the application to withdraw
   */
  const handleWithdraw = async (applicationId) => {
    // Confirm before proceeding — bail out if user cancels
    if (!window.confirm('Are you sure you want to withdraw your application?')) {
      return;
    }

    try {
      // Mark this application as in-progress for UI feedback (disable button)
      setWithdrawingId(applicationId);
      // Call the withdraw endpoint
      const response = await apiFetch(`/api/opportunities/applications/${applicationId}/withdraw`, {
        method: 'PUT',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to withdraw');
      }
      // Update the local applications list to reflect withdrawn status
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId ? { ...app, status: 'withdrawn' } : app
        )
      );
    } catch (err) {
      // Alert the user if the withdrawal request fails
      setError(err.message || 'Failed to withdraw application.');
    } finally {
      // Clear the withdrawing indicator regardless of outcome
      setWithdrawingId(null);
    }
  };

  /**
   * Navigate to the opportunity detail page when the user clicks an opportunity title.
   *
   * @param {number|string} opportunityId - ID of the opportunity to view
   */
  const handleOpportunityClick = (opportunityId) => {
    onNavigate('opportunity-detail', { opportunityId });
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="my-applications-page">
        <h1>My Applications</h1>
        <div className="loading-state">Loading your applications...</div>
      </div>
    );
  }

  // --- Error state ---
  if (error && applications.length === 0) {
    return (
      <div className="my-applications-page">
        <h1>My Applications</h1>
        <div className="error-state">
          <p>{error}</p>
          {/* Allow user to retry by reloading the page or re-triggering fetch */}
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // --- Empty state — user has no applications ---
  if (applications.length === 0) {
    return (
      <div className="my-applications-page">
        <h1>My Applications</h1>
        <div className="empty-state">
          <p>You have not submitted any applications yet.</p>
        </div>
      </div>
    );
  }

  // --- Main render — table of applications ---
  return (
    <div className="my-applications-page">
      <h1>My Applications</h1>

      {/* Display a non-blocking error banner if a withdraw failed */}
      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      <table className="applications-table">
        <thead>
          <tr>
            <th>Opportunity</th>
            <th>Department</th>
            <th>Applied Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id}>
              {/* Opportunity title — clickable to navigate to the detail page */}
              <td>
                <button
                  className="link-button"
                  onClick={() => handleOpportunityClick(app.opportunity_id)}
                  aria-label={`View details for ${app.opportunity_title || 'opportunity'}`}
                >
                  {app.opportunity_title || 'Untitled Opportunity'}
                </button>
              </td>

              {/* Department the opportunity belongs to */}
              <td>{app.opportunity_department || '-'}</td>

              {/* Date the application was submitted */}
              <td>{formatDate(app.applied_date || app.created_at)}</td>

              {/* Status badge with dynamic CSS class based on the status value */}
              <td>
                <span className={`status-badge status-badge--${app.status}`}>
                  {formatStatus(app.status)}
                </span>
              </td>

              {/* Actions column — withdraw button shown unless already accepted or withdrawn */}
              <td>
                {app.status !== 'accepted' && app.status !== 'withdrawn' ? (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleWithdraw(app.id)}
                    disabled={withdrawingId === app.id}
                    aria-label={`Withdraw application for ${app.opportunity_title || 'opportunity'}`}
                  >
                    {withdrawingId === app.id ? 'Withdrawing...' : 'Withdraw'}
                  </button>
                ) : (
                  // No action available for accepted or withdrawn applications
                  <span className="no-action">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MyApplicationsPage;
