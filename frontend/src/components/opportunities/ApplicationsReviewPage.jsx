// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS - Applications Review Page
 * HR view for reviewing applications submitted to a specific opportunity.
 * Displays applicant table, detail panel with cover letter, internal notes,
 * and status workflow transitions.
 *
 * Author: D.R.M. Manthorpe
 * Module: Opportunities
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

/**
 * Valid status transitions map.
 * Each key is a current status; value is an array of statuses it can move to.
 * Follows the recruitment pipeline: submitted -> reviewing -> shortlisted/rejected -> etc.
 */
const STATUS_TRANSITIONS = {
  submitted: ['reviewing'],
  reviewing: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['offered', 'rejected'],
  offered: ['accepted', 'rejected']
};

/**
 * Human-readable labels for each application status.
 */
const STATUS_LABELS = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  interview: 'Interview',
  offered: 'Offered',
  accepted: 'Accepted'
};

/**
 * ApplicationsReviewPage
 * Renders the full HR review interface for a single opportunity's applications.
 *
 * @param {Object} props
 * @param {Object} props.user - Current authenticated user object
 * @param {string|number} props.opportunityId - ID of the opportunity to review
 * @param {Function} props.onNavigate - Navigation callback for page transitions
 */
function ApplicationsReviewPage({ user, opportunityId, onNavigate }) {
  // -- State: opportunity details fetched from the API --
  const [opportunity, setOpportunity] = useState(null);

  // -- State: list of applications for this opportunity --
  const [applications, setApplications] = useState([]);

  // -- State: loading indicator for initial data fetch --
  const [loading, setLoading] = useState(true);

  // -- State: error message string, empty when no error --
  const [error, setError] = useState('');

  // -- State: the currently selected application (expanded detail panel) --
  const [selectedApplication, setSelectedApplication] = useState(null);

  // -- State: tracks the new status chosen from the dropdown in the detail panel --
  const [statusUpdate, setStatusUpdate] = useState({});

  // -- State: internal HR notes text for the selected application --
  const [notesText, setNotesText] = useState('');

  /**
   * Fetch opportunity details from the API.
   * Called on mount and stores the result in state.
   */
  const fetchOpportunity = async () => {
    try {
      const response = await apiFetch(`/api/opportunities/${opportunityId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch opportunity details');
      }
      const data = await response.json();
      // Store the opportunity object (may be nested under a key or returned directly)
      setOpportunity(data.opportunity || data);
    } catch (err) {
      console.error('Fetch opportunity error:', err);
      setError('Failed to load opportunity details');
    }
  };

  /**
   * Fetch the list of applications for this opportunity.
   * Called on mount and after any status update to keep the list current.
   */
  const fetchApplications = async () => {
    try {
      const response = await apiFetch(`/api/opportunities/${opportunityId}/applications`);
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }
      const data = await response.json();
      // Applications may be at data.applications or returned as a top-level array
      setApplications(data.applications || data || []);
    } catch (err) {
      console.error('Fetch applications error:', err);
      setError('Failed to load applications');
    }
  };

  /**
   * On mount: fetch both opportunity details and applications in parallel.
   * Sets loading to false once both requests have settled.
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        await Promise.all([fetchOpportunity(), fetchApplications()]);
      } catch (err) {
        // Individual fetchers handle their own errors
        console.error('Load data error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [opportunityId]);

  /**
   * Handle clicking a table row to select/deselect an application.
   * When selecting, pre-populate the notes field and reset the status dropdown.
   *
   * @param {Object} application - The application object from the row
   */
  const handleSelectApplication = (application) => {
    // If clicking the same application, deselect (toggle off)
    if (selectedApplication && selectedApplication.id === application.id) {
      setSelectedApplication(null);
      setStatusUpdate({});
      setNotesText('');
      return;
    }

    // Select the new application and populate its existing notes
    setSelectedApplication(application);
    setNotesText(application.internal_notes || '');
    setStatusUpdate({});
  };

  /**
   * Handle the status + notes save action.
   * Sends a PUT to update the application's status and internal notes,
   * then refreshes the applications list to reflect changes.
   */
  const handleSaveStatusUpdate = async () => {
    // Guard: must have an application selected
    if (!selectedApplication) return;

    // Build the payload — include status only if one was chosen
    const payload = {
      notes: notesText
    };
    if (statusUpdate.newStatus) {
      payload.status = statusUpdate.newStatus;
    }

    try {
      const response = await apiFetch(
        `/api/opportunities/applications/${selectedApplication.id}/status`,
        {
          method: 'PUT',
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update application status');
      }

      // Refresh the applications list to show the updated status
      await fetchApplications();

      // Update the selected application in-place so the detail panel reflects changes
      const updatedStatus = statusUpdate.newStatus || selectedApplication.status;
      setSelectedApplication((prev) => ({
        ...prev,
        status: updatedStatus,
        internal_notes: notesText
      }));

      // Reset the dropdown after a successful save
      setStatusUpdate({});
    } catch (err) {
      console.error('Status update error:', err);
      setError(err.message || 'Failed to update application');
    }
  };

  /**
   * Compute a summary of application statuses for the header display.
   * Returns an object mapping each status to its count.
   */
  const getStatusSummary = () => {
    const summary = {};
    applications.forEach((app) => {
      const status = app.status || 'unknown';
      summary[status] = (summary[status] || 0) + 1;
    });
    return summary;
  };

  /**
   * Format an ISO date string into a user-friendly locale date.
   *
   * @param {string} dateStr - ISO date string
   * @returns {string} Formatted date or fallback text
   */
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  /**
   * Get the list of valid next statuses for a given current status.
   *
   * @param {string} currentStatus - The application's current status
   * @returns {string[]} Array of valid target statuses, or empty array
   */
  const getValidTransitions = (currentStatus) => {
    return STATUS_TRANSITIONS[currentStatus] || [];
  };

  // -- Render: Loading state --
  if (loading) {
    return (
      <div className="applications-review applications-review--loading">
        <p>Loading applications...</p>
      </div>
    );
  }

  // -- Render: Error state (fatal, no data loaded) --
  if (error && !opportunity && applications.length === 0) {
    return (
      <div className="applications-review applications-review--error">
        <p className="applications-review__error-message">{error}</p>
        <button
          className="applications-review__back-btn"
          onClick={() => onNavigate('opportunities-admin')}
        >
          Back to Opportunities
        </button>
      </div>
    );
  }

  // -- Compute status summary for the header section --
  const statusSummary = getStatusSummary();

  return (
    <div className="applications-review">
      {/* -- Header section: back button, opportunity title, applicant stats -- */}
      <div className="applications-review__header">
        <button
          className="applications-review__back-btn"
          onClick={() => onNavigate('opportunities-admin')}
          aria-label="Back to opportunities admin"
        >
          &larr; Back to Opportunities
        </button>

        <h1 className="applications-review__title">
          {opportunity ? opportunity.title : 'Opportunity'}
        </h1>

        {/* -- Applicant count and per-status breakdown -- */}
        <div className="applications-review__summary">
          <span className="applications-review__count">
            {applications.length} applicant{applications.length !== 1 ? 's' : ''}
          </span>

          {/* -- Status summary badges showing count per status -- */}
          <div className="applications-review__status-summary">
            {Object.entries(statusSummary).map(([status, count]) => (
              <span
                key={status}
                className={`status-badge status-badge--${status}`}
              >
                {STATUS_LABELS[status] || status}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* -- Non-fatal error banner (e.g. after a failed status update) -- */}
      {error && (
        <div className="applications-review__error-banner" role="alert">
          {error}
        </div>
      )}

      {/* -- Empty state: no applications yet -- */}
      {applications.length === 0 && !loading && (
        <div className="applications-review__empty">
          <p>No applications have been submitted for this opportunity yet.</p>
        </div>
      )}

      {/* -- Applications table -- */}
      {applications.length > 0 && (
        <div className="applications-review__table-wrapper">
          <table className="applications-review__table" aria-label="Applications list">
            <thead>
              <tr>
                <th>Applicant Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Applied Date</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className={`applications-review__row ${
                    selectedApplication && selectedApplication.id === app.id
                      ? 'applications-review__row--selected'
                      : ''
                  }`}
                  onClick={() => handleSelectApplication(app)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View application from ${app.applicant_name || 'Unknown'}`}
                  onKeyDown={(e) => {
                    // Allow keyboard activation with Enter or Space
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectApplication(app);
                    }
                  }}
                >
                  <td>{app.applicant_name || 'Unknown'}</td>
                  <td>{app.email || 'N/A'}</td>
                  <td>{app.role || opportunity?.title || 'N/A'}</td>
                  <td>{formatDate(app.applied_date || app.created_at)}</td>
                  <td>
                    <span className={`status-badge status-badge--${app.status}`}>
                      {STATUS_LABELS[app.status] || app.status}
                    </span>
                  </td>
                  <td>{app.reviewed_by_name || app.reviewed_by || '--'}</td>
                  <td>
                    <button
                      className="applications-review__view-btn"
                      onClick={(e) => {
                        // Prevent the row click from also firing
                        e.stopPropagation();
                        handleSelectApplication(app);
                      }}
                      aria-label={`Review application from ${app.applicant_name || 'Unknown'}`}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* -- Detail panel: shown when an application is selected -- */}
      {selectedApplication && (
        <div className="application-detail-panel" role="region" aria-label="Application detail">
          <div className="application-detail-panel__header">
            <h2 className="application-detail-panel__name">
              {selectedApplication.applicant_name || 'Unknown Applicant'}
            </h2>
            <span
              className={`status-badge status-badge--${selectedApplication.status}`}
            >
              {STATUS_LABELS[selectedApplication.status] || selectedApplication.status}
            </span>
            {/* -- Close button to collapse the detail panel -- */}
            <button
              className="application-detail-panel__close-btn"
              onClick={() => {
                setSelectedApplication(null);
                setStatusUpdate({});
                setNotesText('');
              }}
              aria-label="Close detail panel"
            >
              X
            </button>
          </div>

          {/* -- Applicant metadata -- */}
          <div className="application-detail-panel__meta">
            <p><strong>Email:</strong> {selectedApplication.email || 'N/A'}</p>
            <p><strong>Role:</strong> {selectedApplication.role || opportunity?.title || 'N/A'}</p>
            <p>
              <strong>Applied:</strong>{' '}
              {formatDate(selectedApplication.applied_date || selectedApplication.created_at)}
            </p>
            <p>
              <strong>Reviewed By:</strong>{' '}
              {selectedApplication.reviewed_by_name || selectedApplication.reviewed_by || 'Not yet reviewed'}
            </p>
          </div>

          {/* -- Cover letter section: displays the full text of the applicant's cover letter -- */}
          <div className="application-detail-panel__section">
            <h3 className="application-detail-panel__section-title">Cover Letter</h3>
            <div className="application-detail-panel__cover-letter">
              {selectedApplication.cover_letter
                ? selectedApplication.cover_letter
                : 'No cover letter provided.'}
            </div>
          </div>

          {/* -- Internal notes: HR-only textarea for private annotations -- */}
          <div className="application-detail-panel__section">
            <h3 className="application-detail-panel__section-title">
              Internal Notes (HR Only)
            </h3>
            <textarea
              className="application-detail-panel__notes"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add internal notes about this applicant..."
              rows={4}
              aria-label="Internal notes for this application"
            />
          </div>

          {/* -- Status update section: dropdown for valid transitions + save button -- */}
          <div className="application-detail-panel__section">
            <h3 className="application-detail-panel__section-title">Update Status</h3>

            {getValidTransitions(selectedApplication.status).length > 0 ? (
              <div className="application-detail-panel__status-update">
                {/* -- Dropdown listing only the valid next statuses -- */}
                <select
                  className="application-detail-panel__status-select"
                  value={statusUpdate.newStatus || ''}
                  onChange={(e) =>
                    setStatusUpdate({ newStatus: e.target.value })
                  }
                  aria-label="Select new status"
                >
                  <option value="">-- Select new status --</option>
                  {getValidTransitions(selectedApplication.status).map(
                    (targetStatus) => (
                      <option key={targetStatus} value={targetStatus}>
                        {STATUS_LABELS[targetStatus] || targetStatus}
                      </option>
                    )
                  )}
                </select>

                {/* -- Save button: submits status change and notes to the API -- */}
                <button
                  className="application-detail-panel__save-btn"
                  onClick={handleSaveStatusUpdate}
                  aria-label="Save status update and notes"
                >
                  Save
                </button>
              </div>
            ) : (
              /* -- No transitions available: application is in a terminal state -- */
              <p className="application-detail-panel__no-transitions">
                No further status transitions available.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApplicationsReviewPage;
