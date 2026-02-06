// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS -- OpportunitiesPage
 * Employee-facing browse page for internal job opportunities.
 * Displays a filterable bento-grid of opportunity cards with status badges,
 * salary ranges, and closing deadlines.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

/* ---------- Employment type display mapping ---------- */
// Converts snake_case DB values to human-readable labels
const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  temporary: 'Temporary',
};

/**
 * Format a number as GBP currency (e.g. 35000 -> "35,000")
 * @param {number} value - Raw numeric salary value
 * @returns {string} Formatted string without the pound sign
 */
const formatSalary = (value) => {
  return Number(value).toLocaleString('en-GB');
};

/**
 * Calculate the number of whole days between now and a target date.
 * Returns null if the target date is falsy.
 * @param {string} dateStr - ISO date string for the closing date
 * @returns {number|null} Days remaining (negative means past)
 */
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  // Strip time portion for a clean day diff
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
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

function OpportunitiesPage({ user, onNavigate }) {
  /* ----- State ----- */
  // Raw opportunities fetched from the API
  const [opportunities, setOpportunities] = useState([]);
  // Loading flag for initial fetch
  const [loading, setLoading] = useState(true);
  // Error message to display if fetch fails
  const [error, setError] = useState(null);
  // Client-side filter state
  const [filters, setFilters] = useState({
    search: '',          // Free-text title search
    department: '',      // Department filter (extracted from data)
    employment_type: '', // Employment type filter
  });

  /* ----- Fetch opportunities on mount ----- */
  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use apiFetch which returns a raw Response with CSRF + credentials
        const response = await apiFetch('/api/opportunities');

        // Guard against non-OK responses
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Failed to load opportunities (${response.status})`);
        }

        // Parse the JSON body
        const data = await response.json();
        // API may return { opportunities: [...] } or a plain array
        const list = Array.isArray(data) ? data : (data.opportunities || []);
        setOpportunities(list);
      } catch (err) {
        console.error('[OpportunitiesPage] Fetch error:', err);
        setError(err.message || 'Unable to load opportunities. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  /* ----- Derive unique departments from fetched data for the filter select ----- */
  const departments = [...new Set(
    opportunities
      .map((opp) => opp.department)
      .filter(Boolean) // Remove nulls/undefined
  )].sort();

  /* ----- Derive unique employment types from fetched data ----- */
  const employmentTypes = [...new Set(
    opportunities
      .map((opp) => opp.employment_type)
      .filter(Boolean)
  )].sort();

  /* ----- Client-side filtering ----- */
  const filtered = opportunities.filter((opp) => {
    // Search filter: case-insensitive title match
    if (filters.search) {
      const query = filters.search.toLowerCase();
      if (!opp.title?.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Department filter: exact match
    if (filters.department && opp.department !== filters.department) {
      return false;
    }

    // Employment type filter: exact match
    if (filters.employment_type && opp.employment_type !== filters.employment_type) {
      return false;
    }

    return true;
  });

  /* ----- Filter change handler ----- */
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  /* ----- Card click handler: navigate to opportunity detail ----- */
  const handleCardClick = (opp) => {
    onNavigate('opportunity-detail', { opportunityId: opp.id });
  };

  /* ----- Render: Loading state ----- */
  if (loading) {
    return (
      <div className="opportunities-page" role="status" aria-label="Loading opportunities">
        <div className="opportunities-page__loading">
          {/* Simple CSS spinner — styled via components.css */}
          <div className="opportunities-page__spinner" aria-hidden="true" />
          <p>Loading opportunities...</p>
        </div>
      </div>
    );
  }

  /* ----- Render: Error state ----- */
  if (error) {
    return (
      <div className="opportunities-page">
        <div className="opportunities-page__error" role="alert">
          <p>{error}</p>
          <button
            className="opportunities-page__retry-btn"
            onClick={() => window.location.reload()}
            aria-label="Retry loading opportunities"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ----- Render: Main page ----- */
  return (
    <div className="opportunities-page">
      {/* Page header */}
      <div className="opportunities-page__header">
        <h2>Internal Opportunities</h2>
        <p className="opportunities-page__subtitle">
          Browse open roles and career development opportunities within the organisation.
        </p>
      </div>

      {/* ---------- Filter bar ---------- */}
      <div className="opportunities-page__filters" role="search" aria-label="Filter opportunities">
        {/* Free-text search input */}
        <input
          type="text"
          className="opportunities-page__search"
          placeholder="Search by title..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          aria-label="Search opportunities by title"
        />

        {/* Department select — options extracted from fetched data */}
        <select
          className="opportunities-page__select"
          value={filters.department}
          onChange={(e) => handleFilterChange('department', e.target.value)}
          aria-label="Filter by department"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        {/* Employment type select */}
        <select
          className="opportunities-page__select"
          value={filters.employment_type}
          onChange={(e) => handleFilterChange('employment_type', e.target.value)}
          aria-label="Filter by employment type"
        >
          <option value="">All Types</option>
          {employmentTypes.map((type) => (
            <option key={type} value={type}>
              {EMPLOYMENT_TYPE_LABELS[type] || type}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- Results ---------- */}
      {filtered.length === 0 ? (
        /* Empty state — no opportunities match the current filters */
        <div className="opportunities-page__empty" role="status">
          <p>No opportunities available</p>
        </div>
      ) : (
        /* Bento grid of opportunity cards */
        <div className="opportunities-page__grid">
          {filtered.map((opp) => {
            // Calculate days remaining until the closing date
            const remaining = daysUntil(opp.closes_at);
            // Determine the status badge text
            let badgeText = 'No deadline';
            let badgeClass = 'opportunity-card__badge--open';
            if (remaining !== null) {
              if (remaining < 0) {
                badgeText = 'Closed';
                badgeClass = 'opportunity-card__badge--closed';
              } else if (remaining === 0) {
                badgeText = 'Closes today';
                badgeClass = 'opportunity-card__badge--urgent';
              } else if (remaining <= 7) {
                badgeText = `${remaining} day${remaining === 1 ? '' : 's'} left`;
                badgeClass = 'opportunity-card__badge--urgent';
              } else {
                badgeText = `${remaining} days left`;
                badgeClass = 'opportunity-card__badge--open';
              }
            }

            return (
              <button
                key={opp.id}
                className="opportunity-card"
                onClick={() => handleCardClick(opp)}
                aria-label={`View opportunity: ${opp.title}`}
                type="button"
              >
                {/* Status badge — shows days until closing */}
                <span className={`opportunity-card__badge ${badgeClass}`}>
                  {badgeText}
                </span>

                {/* Opportunity title */}
                <h3 className="opportunity-card__title">{opp.title}</h3>

                {/* Department */}
                {opp.department && (
                  <p className="opportunity-card__department">{opp.department}</p>
                )}

                {/* Meta row: location and employment type */}
                <div className="opportunity-card__meta">
                  {opp.location && (
                    <span className="opportunity-card__location">{opp.location}</span>
                  )}
                  {opp.employment_type && (
                    <span className="opportunity-card__type">
                      {EMPLOYMENT_TYPE_LABELS[opp.employment_type] || opp.employment_type}
                    </span>
                  )}
                </div>

                {/* Salary range — only shown when show_salary is true and values exist */}
                {opp.show_salary && opp.salary_range_min != null && opp.salary_range_max != null && (
                  <p className="opportunity-card__salary">
                    {`\u00A3${formatSalary(opp.salary_range_min)} \u2013 \u00A3${formatSalary(opp.salary_range_max)}`}
                  </p>
                )}

                {/* Date information: posted and closing dates */}
                <div className="opportunity-card__dates">
                  {opp.posted_at && (
                    <span className="opportunity-card__posted">
                      Posted: {formatDate(opp.posted_at)}
                    </span>
                  )}
                  {opp.closes_at && (
                    <span className="opportunity-card__closes">
                      Closes: {formatDate(opp.closes_at)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OpportunitiesPage;
