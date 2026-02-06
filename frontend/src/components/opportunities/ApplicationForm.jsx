// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

import { useState } from 'react';
import { apiFetch } from '../../utils/api';

/**
 * ApplicationForm — Modal form for submitting a job application.
 * Displays a cover letter textarea and handles POST submission
 * with conflict (409) and generic error handling.
 *
 * @param {Object} props
 * @param {number|string} props.opportunityId - ID of the opportunity being applied to
 * @param {string} props.opportunityTitle - Display title for the modal header
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onSubmitted - Callback fired after successful submission
 */
const ApplicationForm = ({ opportunityId, opportunityTitle, onClose, onSubmitted }) => {
  // Cover letter text entered by the user (optional field)
  const [cover_letter, setCoverLetter] = useState('');
  // Tracks whether a submission request is in-flight to prevent double-submit
  const [submitting, setSubmitting] = useState(false);
  // Stores any error message to display to the user
  const [error, setError] = useState('');

  /**
   * handleSubmit — Sends the application to the backend API.
   * On success (201), notifies parent components via callbacks.
   * On 409 conflict, shows a specific "already applied" message.
   * On other errors, parses and displays the server error message.
   */
  const handleSubmit = async (e) => {
    // Prevent default form submission behaviour
    e.preventDefault();
    // Clear any previous error before attempting submission
    setError('');
    // Mark as submitting to disable the button and prevent duplicates
    setSubmitting(true);

    try {
      // POST the application payload to the opportunities applications endpoint
      const response = await apiFetch('/api/opportunities/applications', {
        method: 'POST',
        body: JSON.stringify({
          opportunity_id: opportunityId,
          cover_letter
        })
      });

      // Check for successful creation (HTTP 201)
      if (response.status === 201) {
        // Notify parent that application was submitted successfully
        onSubmitted();
        // Close the modal
        onClose();
        return;
      }

      // Handle 409 Conflict — user has already applied to this opportunity
      if (response.status === 409) {
        const data = await response.json();
        setError(data.error || 'You have already applied for this opportunity.');
        return;
      }

      // Handle all other non-OK responses by parsing the error body
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to submit application. Please try again.');
        return;
      }
    } catch (err) {
      // Network errors or JSON parse failures fall through here
      console.error('Application submission error:', err);
      setError('An unexpected error occurred. Please check your connection and try again.');
    } finally {
      // Always re-enable the submit button regardless of outcome
      setSubmitting(false);
    }
  };

  /**
   * handleOverlayClick — Closes the modal when the backdrop overlay is clicked.
   * The dialog itself stops propagation to prevent accidental closure.
   */
  const handleOverlayClick = () => {
    onClose();
  };

  /**
   * handleDialogClick — Stops click events from bubbling up to the overlay.
   * This prevents the modal from closing when clicking inside the dialog.
   */
  const handleDialogClick = (e) => {
    e.stopPropagation();
  };

  return (
    // Modal backdrop overlay — clicking it closes the modal
    <div className="modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      {/* Modal dialog container — click propagation stopped here */}
      <div className="modal-dialog" onClick={handleDialogClick}>

        {/* Modal header with title and close button */}
        <div className="modal-header">
          <h2>Apply for {opportunityTitle}</h2>
          {/* Close button (X) in the top-right corner */}
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close application form"
            type="button"
          >
            &times;
          </button>
        </div>

        {/* Application form — uses onSubmit handler for submission */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Display error message if present */}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            {/* Cover letter textarea — optional field */}
            <div className="form-group">
              <label htmlFor="cover-letter">Cover Letter (optional)</label>
              <textarea
                id="cover-letter"
                className="form-textarea"
                value={cover_letter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell us why you're interested in this role..."
                rows={6}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Modal footer with action buttons */}
          <div className="modal-footer">
            {/* Cancel button — simply closes the modal without submitting */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            {/* Submit button — disabled while the request is in-flight */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplicationForm;
