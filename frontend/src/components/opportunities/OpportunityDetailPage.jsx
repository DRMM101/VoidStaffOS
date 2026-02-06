// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS -- OpportunityDetailPage
 * Full detail view for a single internal opportunity.
 * Displays title, metadata, description, requirements, salary (when visible),
 * and either the user's existing application status or an Apply Now action.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import ApplicationForm from './ApplicationForm';

/* ---------- Employment type display mapping ---------- */
// Converts snake_case DB values to human-readable labels
const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  temporary: 'Temporary',
};

/**
 * Format a number as GBP currency string (e.g. 35000 -> "35,000")
 * @param {number} value - Raw numeric salary value
 * @returns {string} Formatted string without the pound sign
 */
const formatSalary = (value) => {
  return Number(value).toLocaleString('en-GB');
};

/**
 * Format an ISO date string to a short UK-style date (e.g. "06 Feb 2026")
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date or empty string
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* ========== Main Component ========== */

function OpportunityDetailPage({ user, opportunityId, onNavigate }) {
  /* ----- State ----- */
  // The full opportunity object fetched from the API
  const [opportunity, setOpportunity] = useState(null);
  // Loading flag for initial fetch
  const [loading, setLoading] = useState(true);
  // Error message to display if fetch fails
  const [error, setError] = useState(null);
  // Controls visibility of the ApplicationForm modal
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  /* ----- Fetch opportunity detail on mount or when opportunityId changes ----- */
  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use apiFetch which returns a raw Response with CSRF + credentials
        const response = await apiFetch(`/api/opportunities/${opportunityId}`);

        // Guard against non-OK responses
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(
            errBody.error || `Failed to load opportunity (${response.status})`
          );
        }

        // Parse the JSON body — API returns the opportunity object directly
        const data = await response.json();
        setOpportunity(data);
      } catch (err) {
        console.error('[OpportunityDetailPage] Fetch error:', err);
        setError(
          err.message || 'Unable to load opportunity. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have a valid opportunityId
    if (opportunityId) {
      fetchOpportunity();
    }
  }, [opportunityId]);

  /* ----- Handler: navigate back to opportunities list ----- */
  const handleBack = () => {
    onNavigate('opportunities');
  };

  /* ----- Handler: open the application form modal ----- */
  const handleApplyClick = () => {
    setShowApplicationForm(true);
  };

  /* ----- Handler: close the application form modal ----- */
  const handleApplicationClose = () => {
    setShowApplicationForm(false);
  };

  /**
   * Handler: called when an application is successfully submitted.
   * Re-fetches the opportunity to pick up the new my_application object.
   */
  const handleApplicationSubmitted = async () => {
    setShowApplicationForm(false);
    try {
      // Re-fetch the opportunity to get updated my_application data
      const response = await apiFetch(`/api/opportunities/${opportunityId}`);
      if (response.ok) {
        const data = await response.json();
        setOpportunity(data);
      }
    } catch (err) {
      console.error('[OpportunityDetailPage] Re-fetch after apply error:', err);
    }
  };

  /**
   * Render multi-line text as separate <p> elements.
   * Splits on newline characters and filters out empty lines.
   * @param {string} text - Raw text with \n delimiters
   * @returns {JSX.Element[]} Array of paragraph elements
   */
  const renderParagraphs = (text) => {
    if (!text) return null;
    return text.split('\n').filter(Boolean).map((paragraph, index) => (
      <p key={index}>{paragraph}</p>
    ));
  };

  /* ----- Render: Loading state ----- */
  if (loading) {
    return (
      <div className="opportunity-detail" role="status" aria-label="Loading opportunity">
        <div className="opportunity-detail__loading">
          {/* Simple CSS spinner — styled via components.css */}
          <div className="opportunity-detail__spinner" aria-hidden="true" />
          <p>Loading opportunity details...</p>
        </div>
      </div>
    );
  }

  /* ----- Render: Error state ----- */
  if (error) {
    return (
      <div className="opportunity-detail">
        <div className="opportunity-detail__error" role="alert">
          <p>{error}</p>
          {/* Back button allows the user to return to the list */}
          <button
            className="opportunity-detail__back-btn"
            onClick={handleBack}
            aria-label="Back to opportunities list"
            type="button"
          >
            Back to Opportunities
          </button>
        </div>
      </div>
    );
  }

  /* ----- Render: No data guard (shouldn't happen but defensive) ----- */
  if (!opportunity) {
    return (
      <div className="opportunity-detail">
        <div className="opportunity-detail__error" role="alert">
          <p>Opportunity not found.</p>
          <button
            className="opportunity-detail__back-btn"
            onClick={handleBack}
            aria-label="Back to opportunities list"
            type="button"
          >
            Back to Opportunities
          </button>
        </div>
      </div>
    );
  }

  /* ----- Determine whether the opportunity is still open for applications ----- */
  const isOpen = opportunity.status === 'open';

  /* ----- Extract the user's existing application, if any ----- */
  const myApplication = opportunity.my_application || null;

  /* ----- Render: Full detail page ----- */
  return (
    <div className="opportunity-detail">
      {/* ---------- Header section ---------- */}
      <div className="opportunity-detail__header">
        {/* Back navigation button */}
        <button
          className="opportunity-detail__back-btn"
          onClick={handleBack}
          aria-label="Back to opportunities list"
          type="button"
        >
          &larr; Back to Opportunities
        </button>

        {/* Opportunity title */}
        <h2>{opportunity.title}</h2>
      </div>

      {/* ---------- Metadata row ---------- */}
      <div className="opportunity-detail__meta">
        {/* Department */}
        {opportunity.department && (
          <span className="opportunity-detail__meta-item">
            <strong>Department:</strong> {opportunity.department}
          </span>
        )}

        {/* Location */}
        {opportunity.location && (
          <span className="opportunity-detail__meta-item">
            <strong>Location:</strong> {opportunity.location}
          </span>
        )}

        {/* Employment type — formatted via the label map */}
        {opportunity.employment_type && (
          <span className="opportunity-detail__meta-item">
            <strong>Type:</strong>{' '}
            {EMPLOYMENT_TYPE_LABELS[opportunity.employment_type] ||
              opportunity.employment_type}
          </span>
        )}

        {/* Posted date */}
        {opportunity.posted_at && (
          <span className="opportunity-detail__meta-item">
            <strong>Posted:</strong> {formatDate(opportunity.posted_at)}
          </span>
        )}

        {/* Closing date */}
        {opportunity.closes_at && (
          <span className="opportunity-detail__meta-item">
            <strong>Closes:</strong> {formatDate(opportunity.closes_at)}
          </span>
        )}

        {/* Salary range — only shown when show_salary flag is true and range exists */}
        {opportunity.show_salary &&
          opportunity.salary_range_min != null &&
          opportunity.salary_range_max != null && (
            <span className="opportunity-detail__meta-item opportunity-detail__salary">
              <strong>Salary:</strong>{' '}
              {`\u00A3${formatSalary(opportunity.salary_range_min)} \u2013 \u00A3${formatSalary(opportunity.salary_range_max)}`}
            </span>
          )}
      </div>

      {/* ---------- Body content ---------- */}
      <div className="opportunity-detail__body">
        {/* Description section */}
        {opportunity.description && (
          <section className="opportunity-detail__section">
            <h3>Description</h3>
            {renderParagraphs(opportunity.description)}
          </section>
        )}

        {/* Requirements section */}
        {opportunity.requirements && (
          <section className="opportunity-detail__section">
            <h3>Requirements</h3>
            {renderParagraphs(opportunity.requirements)}
          </section>
        )}
      </div>

      {/* ---------- Actions section ---------- */}
      <div className="opportunity-detail__actions">
        {myApplication ? (
          /* User has already applied — show application status */
          <div
            className="opportunity-detail__application-status"
            role="status"
            aria-label="Your application status"
          >
            <p>
              You applied on {formatDate(myApplication.applied_at || myApplication.created_at)}{' '}
              &mdash; Status:{' '}
              <span
                className={`opportunity-detail__status-badge opportunity-detail__status-badge--${myApplication.status}`}
              >
                {myApplication.status}
              </span>
            </p>
          </div>
        ) : isOpen ? (
          /* Opportunity is open and user has not applied — show apply button */
          <button
            className="opportunity-detail__apply-btn"
            onClick={handleApplyClick}
            aria-label="Apply for this opportunity"
            type="button"
          >
            Apply Now
          </button>
        ) : (
          /* Opportunity is closed — inform the user */
          <p className="opportunity-detail__closed-notice">
            This opportunity is no longer accepting applications.
          </p>
        )}
      </div>

      {/* ---------- Application Form Modal ---------- */}
      {/* Rendered conditionally when the user clicks Apply Now */}
      {showApplicationForm && (
        <ApplicationForm
          user={user}
          opportunityId={opportunityId}
          onClose={handleApplicationClose}
          onSubmitted={handleApplicationSubmitted}
        />
      )}
    </div>
  );
}

export default OpportunityDetailPage;
