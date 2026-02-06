// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

/**
 * OpportunitiesAdminPage
 *
 * HR/Admin management page for job opportunities.
 * Allows creating, editing, publishing, closing, filling, and deleting
 * opportunity listings. Displays all opportunities in a filterable table
 * with status-based action buttons.
 *
 * Props:
 *   - user: current authenticated user object
 *   - onNavigate: function to navigate to other pages (key, params)
 */
const OpportunitiesAdminPage = ({ user, onNavigate }) => {
  // -- State declarations --

  // Main list of opportunities fetched from the API
  const [opportunities, setOpportunities] = useState([]);
  // Loading indicator for initial fetch and actions
  const [loading, setLoading] = useState(true);
  // Error message to display to the user
  const [error, setError] = useState(null);
  // Controls visibility of the create/edit form
  const [showCreateForm, setShowCreateForm] = useState(false);
  // When editing, holds the opportunity object; null when creating new
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  // Filter opportunities by status (empty string means show all)
  const [filterStatus, setFilterStatus] = useState('');

  // -- Form field state --
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    employment_type: 'full_time',
    description: '',
    requirements: '',
    salary_range_min: '',
    salary_range_max: '',
    show_salary: false,
    closes_at: ''
  });

  // -- Data fetching --

  /**
   * Fetch all opportunities from the admin endpoint.
   * Called on mount and after every create/edit/action to refresh the list.
   */
  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch('/api/opportunities/all');

      // Check for non-OK HTTP status
      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to fetch opportunities');
      }

      const data = await response.json();
      // API may return an array directly or wrapped in a property
      setOpportunities(Array.isArray(data) ? data : data.opportunities || []);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError(err.message || 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  // Fetch opportunities on component mount
  useEffect(() => {
    fetchOpportunities();
  }, []);

  // -- Form helpers --

  /**
   * Reset form fields to their default empty state.
   */
  const resetForm = () => {
    setFormData({
      title: '',
      department: '',
      location: '',
      employment_type: 'full_time',
      description: '',
      requirements: '',
      salary_range_min: '',
      salary_range_max: '',
      show_salary: false,
      closes_at: ''
    });
  };

  /**
   * Open the create form with empty fields.
   */
  const handleOpenCreateForm = () => {
    setEditingOpportunity(null);
    resetForm();
    setShowCreateForm(true);
  };

  /**
   * Open the edit form pre-populated with the selected opportunity's data.
   */
  const handleOpenEditForm = (opp) => {
    setEditingOpportunity(opp);
    setFormData({
      title: opp.title || '',
      department: opp.department || '',
      location: opp.location || '',
      employment_type: opp.employment_type || 'full_time',
      description: opp.description || '',
      requirements: opp.requirements || '',
      salary_range_min: opp.salary_range_min || '',
      salary_range_max: opp.salary_range_max || '',
      show_salary: opp.show_salary || false,
      // Format date for the date input (YYYY-MM-DD)
      closes_at: opp.closes_at ? opp.closes_at.substring(0, 10) : ''
    });
    setShowCreateForm(true);
  };

  /**
   * Close the create/edit form and clear editing state.
   */
  const handleCloseForm = () => {
    setShowCreateForm(false);
    setEditingOpportunity(null);
    resetForm();
  };

  /**
   * Handle changes to form input fields.
   * Supports text, number, checkbox, select, and textarea inputs.
   */
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // -- Form submission --

  /**
   * Submit the create or edit form.
   * POSTs to /api/opportunities for new, PUTs to /api/opportunities/:id for edits.
   */
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Title is required — validate before sending
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setError(null);

      // Build the request body, converting numeric fields
      const body = {
        ...formData,
        salary_range_min: formData.salary_range_min
          ? Number(formData.salary_range_min)
          : null,
        salary_range_max: formData.salary_range_max
          ? Number(formData.salary_range_max)
          : null,
        closes_at: formData.closes_at || null
      };

      let response;

      if (editingOpportunity) {
        // Editing an existing opportunity — PUT request
        response = await apiFetch(`/api/opportunities/${editingOpportunity.id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
      } else {
        // Creating a new opportunity — POST request
        response = await apiFetch('/api/opportunities', {
          method: 'POST',
          body: JSON.stringify(body)
        });
      }

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to save opportunity');
      }

      // Close form and refresh the list
      handleCloseForm();
      await fetchOpportunities();
    } catch (err) {
      console.error('Error saving opportunity:', err);
      setError(err.message || 'Failed to save opportunity');
    }
  };

  // -- Action handlers --

  /**
   * Publish a draft opportunity.
   * Calls POST /api/opportunities/:id/publish
   */
  const handlePublish = async (id) => {
    try {
      setError(null);
      const response = await apiFetch(`/api/opportunities/${id}/publish`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to publish opportunity');
      }

      await fetchOpportunities();
    } catch (err) {
      console.error('Error publishing opportunity:', err);
      setError(err.message || 'Failed to publish opportunity');
    }
  };

  /**
   * Close an open opportunity.
   * Calls POST /api/opportunities/:id/close
   */
  const handleClose = async (id) => {
    try {
      setError(null);
      const response = await apiFetch(`/api/opportunities/${id}/close`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to close opportunity');
      }

      await fetchOpportunities();
    } catch (err) {
      console.error('Error closing opportunity:', err);
      setError(err.message || 'Failed to close opportunity');
    }
  };

  /**
   * Mark an open opportunity as filled.
   * Calls POST /api/opportunities/:id/close with { filled: true }
   */
  const handleMarkFilled = async (id) => {
    try {
      setError(null);
      const response = await apiFetch(`/api/opportunities/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ filled: true })
      });

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to mark opportunity as filled');
      }

      await fetchOpportunities();
    } catch (err) {
      console.error('Error marking opportunity as filled:', err);
      setError(err.message || 'Failed to mark opportunity as filled');
    }
  };

  /**
   * Delete a draft opportunity after user confirmation.
   * Calls DELETE /api/opportunities/:id
   */
  const handleDelete = async (id) => {
    // Confirm with user before destructive action
    if (!window.confirm('Are you sure you want to delete this opportunity? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      const response = await apiFetch(`/api/opportunities/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to delete opportunity');
      }

      await fetchOpportunities();
    } catch (err) {
      console.error('Error deleting opportunity:', err);
      setError(err.message || 'Failed to delete opportunity');
    }
  };

  /**
   * Navigate to the applications review page for a given opportunity.
   */
  const handleViewApplicants = (opp) => {
    onNavigate('applications-review', { opportunityId: opp.id });
  };

  // -- Filtering --

  /**
   * Filter the opportunities list by the selected status.
   * Returns all opportunities if no filter is set.
   */
  const filteredOpportunities = filterStatus
    ? opportunities.filter((opp) => opp.status === filterStatus)
    : opportunities;

  // -- Date formatting helper --

  /**
   * Format an ISO date string to a readable short date (DD/MM/YYYY).
   * Returns a dash if the date is null/undefined.
   */
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  // -- Render: action buttons per status --

  /**
   * Render the appropriate action buttons based on the opportunity's status.
   * - draft: Edit, Publish, Delete
   * - open: Edit, Close, Mark Filled
   * - closed/filled: View only (navigate to detail)
   */
  const renderActions = (opp) => {
    switch (opp.status) {
      case 'draft':
        return (
          <div className="opportunity-actions">
            <button
              className="opportunity-actions__btn opportunity-actions__btn--edit"
              onClick={() => handleOpenEditForm(opp)}
              aria-label={`Edit ${opp.title}`}
            >
              Edit
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--publish"
              onClick={() => handlePublish(opp.id)}
              aria-label={`Publish ${opp.title}`}
            >
              Publish
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--delete"
              onClick={() => handleDelete(opp.id)}
              aria-label={`Delete ${opp.title}`}
            >
              Delete
            </button>
          </div>
        );

      case 'open':
        return (
          <div className="opportunity-actions">
            <button
              className="opportunity-actions__btn opportunity-actions__btn--edit"
              onClick={() => handleOpenEditForm(opp)}
              aria-label={`Edit ${opp.title}`}
            >
              Edit
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--close"
              onClick={() => handleClose(opp.id)}
              aria-label={`Close ${opp.title}`}
            >
              Close
            </button>
            <button
              className="opportunity-actions__btn opportunity-actions__btn--filled"
              onClick={() => handleMarkFilled(opp.id)}
              aria-label={`Mark ${opp.title} as filled`}
            >
              Mark Filled
            </button>
          </div>
        );

      case 'closed':
      case 'filled':
        return (
          <div className="opportunity-actions">
            <button
              className="opportunity-actions__btn opportunity-actions__btn--view"
              onClick={() => handleViewApplicants(opp)}
              aria-label={`View ${opp.title}`}
            >
              View
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // -- Render: loading state --
  if (loading && opportunities.length === 0) {
    return (
      <div className="opportunities-admin">
        <p className="opportunities-admin__loading">Loading opportunities...</p>
      </div>
    );
  }

  // -- Render: main component --
  return (
    <div className="opportunities-admin">
      {/* Page header with title and create button */}
      <div className="opportunities-admin__header">
        <h1 className="opportunities-admin__title">Opportunities Management</h1>
        <button
          className="opportunities-admin__create-btn"
          onClick={handleOpenCreateForm}
          aria-label="Create new opportunity"
        >
          Create Opportunity
        </button>
      </div>

      {/* Error banner — shown when any API call fails */}
      {error && (
        <div className="opportunities-admin__error" role="alert">
          <p>{error}</p>
          <button
            className="opportunities-admin__error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status filter dropdown */}
      <div className="opportunities-admin__filters">
        <label htmlFor="status-filter" className="opportunities-admin__filter-label">
          Filter by status:
        </label>
        <select
          id="status-filter"
          className="opportunities-admin__filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter opportunities by status"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="filled">Filled</option>
        </select>
      </div>

      {/* Inline create/edit form — shown when showCreateForm is true */}
      {showCreateForm && (
        <div className="opportunity-form">
          <h2 className="opportunity-form__title">
            {editingOpportunity ? 'Edit Opportunity' : 'Create New Opportunity'}
          </h2>
          <form onSubmit={handleFormSubmit} className="opportunity-form__body">
            {/* Title — required field */}
            <div className="opportunity-form__field">
              <label htmlFor="opp-title" className="opportunity-form__label">
                Title <span className="opportunity-form__required">*</span>
              </label>
              <input
                id="opp-title"
                name="title"
                type="text"
                className="opportunity-form__input"
                value={formData.title}
                onChange={handleFormChange}
                required
                aria-required="true"
                placeholder="e.g. Senior Software Engineer"
              />
            </div>

            {/* Department */}
            <div className="opportunity-form__field">
              <label htmlFor="opp-department" className="opportunity-form__label">
                Department
              </label>
              <input
                id="opp-department"
                name="department"
                type="text"
                className="opportunity-form__input"
                value={formData.department}
                onChange={handleFormChange}
                placeholder="e.g. Engineering"
              />
            </div>

            {/* Location */}
            <div className="opportunity-form__field">
              <label htmlFor="opp-location" className="opportunity-form__label">
                Location
              </label>
              <input
                id="opp-location"
                name="location"
                type="text"
                className="opportunity-form__input"
                value={formData.location}
                onChange={handleFormChange}
                placeholder="e.g. London, Remote"
              />
            </div>

            {/* Employment type — select dropdown */}
            <div className="opportunity-form__field">
              <label htmlFor="opp-employment-type" className="opportunity-form__label">
                Employment Type
              </label>
              <select
                id="opp-employment-type"
                name="employment_type"
                className="opportunity-form__select"
                value={formData.employment_type}
                onChange={handleFormChange}
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="internship">Internship</option>
              </select>
            </div>

            {/* Description — multiline textarea */}
            <div className="opportunity-form__field">
              <label htmlFor="opp-description" className="opportunity-form__label">
                Description
              </label>
              <textarea
                id="opp-description"
                name="description"
                className="opportunity-form__textarea"
                value={formData.description}
                onChange={handleFormChange}
                rows={5}
                placeholder="Describe the role, responsibilities, and team..."
              />
            </div>

            {/* Requirements — multiline textarea */}
            <div className="opportunity-form__field">
              <label htmlFor="opp-requirements" className="opportunity-form__label">
                Requirements
              </label>
              <textarea
                id="opp-requirements"
                name="requirements"
                className="opportunity-form__textarea"
                value={formData.requirements}
                onChange={handleFormChange}
                rows={5}
                placeholder="List required skills, experience, qualifications..."
              />
            </div>

            {/* Salary range — min and max side by side */}
            <div className="opportunity-form__field-row">
              <div className="opportunity-form__field">
                <label htmlFor="opp-salary-min" className="opportunity-form__label">
                  Salary Range Min
                </label>
                <input
                  id="opp-salary-min"
                  name="salary_range_min"
                  type="number"
                  className="opportunity-form__input"
                  value={formData.salary_range_min}
                  onChange={handleFormChange}
                  min="0"
                  placeholder="e.g. 35000"
                />
              </div>
              <div className="opportunity-form__field">
                <label htmlFor="opp-salary-max" className="opportunity-form__label">
                  Salary Range Max
                </label>
                <input
                  id="opp-salary-max"
                  name="salary_range_max"
                  type="number"
                  className="opportunity-form__input"
                  value={formData.salary_range_max}
                  onChange={handleFormChange}
                  min="0"
                  placeholder="e.g. 55000"
                />
              </div>
            </div>

            {/* Show salary checkbox */}
            <div className="opportunity-form__field opportunity-form__field--checkbox">
              <label htmlFor="opp-show-salary" className="opportunity-form__label opportunity-form__label--checkbox">
                <input
                  id="opp-show-salary"
                  name="show_salary"
                  type="checkbox"
                  className="opportunity-form__checkbox"
                  checked={formData.show_salary}
                  onChange={handleFormChange}
                />
                Show salary on listing
              </label>
            </div>

            {/* Closing date — date picker */}
            <div className="opportunity-form__field">
              <label htmlFor="opp-closes-at" className="opportunity-form__label">
                Closes At
              </label>
              <input
                id="opp-closes-at"
                name="closes_at"
                type="date"
                className="opportunity-form__input"
                value={formData.closes_at}
                onChange={handleFormChange}
              />
            </div>

            {/* Form action buttons */}
            <div className="opportunity-form__actions">
              <button
                type="submit"
                className="opportunity-form__submit-btn"
              >
                {editingOpportunity ? 'Save Changes' : 'Create Opportunity'}
              </button>
              <button
                type="button"
                className="opportunity-form__cancel-btn"
                onClick={handleCloseForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Opportunities table — main data display */}
      {filteredOpportunities.length === 0 ? (
        <p className="opportunities-admin__empty">
          {filterStatus
            ? `No opportunities with status "${filterStatus}" found.`
            : 'No opportunities found. Create one to get started.'}
        </p>
      ) : (
        <div className="opportunities-admin__table-wrapper">
          <table className="opportunities-admin__table" aria-label="Opportunities list">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Department</th>
                <th scope="col">Status</th>
                <th scope="col">Applicants</th>
                <th scope="col">Posted</th>
                <th scope="col">Closes</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpportunities.map((opp) => (
                <tr key={opp.id} className="opportunities-admin__row">
                  {/* Title — clickable to view applicants */}
                  <td className="opportunities-admin__cell">
                    <button
                      className="opportunities-admin__title-link"
                      onClick={() => handleViewApplicants(opp)}
                      aria-label={`View applicants for ${opp.title}`}
                    >
                      {opp.title}
                    </button>
                  </td>

                  {/* Department */}
                  <td className="opportunities-admin__cell">
                    {opp.department || '-'}
                  </td>

                  {/* Status badge — class varies by status */}
                  <td className="opportunities-admin__cell">
                    <span className={`status-badge status-badge--${opp.status}`}>
                      {opp.status}
                    </span>
                  </td>

                  {/* Applicant count */}
                  <td className="opportunities-admin__cell">
                    {opp.applicant_count ?? opp.applicants ?? 0}
                  </td>

                  {/* Posted date */}
                  <td className="opportunities-admin__cell">
                    {formatDate(opp.published_at || opp.created_at)}
                  </td>

                  {/* Closing date */}
                  <td className="opportunities-admin__cell">
                    {formatDate(opp.closes_at)}
                  </td>

                  {/* Action buttons — vary by status */}
                  <td className="opportunities-admin__cell">
                    {renderActions(opp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesAdminPage;
