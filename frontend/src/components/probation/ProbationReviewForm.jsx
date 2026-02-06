/**
 * HeadOfficeOS - Probation Review Form
 * Form to complete a probation review with rating and recommendation.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

function ProbationReviewForm({ reviewId, onClose, onSuccess }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    performance_rating: 3,
    meeting_expectations: true,
    areas_of_strength: '',
    areas_for_improvement: '',
    support_provided: '',
    support_needed: '',
    objectives_for_next_period: '',
    manager_notes: '',
    recommendation: 'continue'
  });

  useEffect(() => {
    fetchReview();
  }, [reviewId]);

  const fetchReview = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/probation/reviews/${reviewId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setReview(data);
        // Pre-fill form if review has existing data
        if (data.performance_rating) {
          setFormData({
            performance_rating: data.performance_rating || 3,
            meeting_expectations: data.meeting_expectations ?? true,
            areas_of_strength: data.areas_of_strength || '',
            areas_for_improvement: data.areas_for_improvement || '',
            support_provided: data.support_provided || '',
            support_needed: data.support_needed || '',
            objectives_for_next_period: data.objectives_for_next_period || '',
            manager_notes: data.manager_notes || '',
            recommendation: data.recommendation || 'continue'
          });
        }
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load review');
      }
    } catch (err) {
      console.error('Error fetching review:', err);
      setError('Failed to load review');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/probation/reviews/${reviewId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess && onSuccess();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to save review');
      }
    } catch (err) {
      console.error('Error saving review:', err);
      setError('Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  const getReviewTypeLabel = (type) => {
    const labels = {
      '1_month': '1 Month Review',
      '3_month': '3 Month Review',
      '6_month': '6 Month Review',
      'final': 'Final Review',
      'extension': 'Extension Review'
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal probation-review-modal">
          <div className="loading">Loading review...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal probation-review-modal">
        <div className="modal-header">
          <h3>Complete Probation Review</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {review && (
          <div className="review-info">
            <p><strong>Employee:</strong> {review.employee_name}</p>
            <p><strong>Review Type:</strong> {getReviewTypeLabel(review.review_type)}</p>
            <p><strong>Scheduled:</strong> {formatDate(review.scheduled_date)}</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="review-form">
          {/* Performance Rating */}
          <div className="form-group">
            <label>Performance Rating *</label>
            <div className="rating-selector">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  className={`rating-btn ${formData.performance_rating === rating ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, performance_rating: rating })}
                >
                  {rating}
                </button>
              ))}
            </div>
            <p className="rating-labels">
              <span>Poor</span>
              <span>Excellent</span>
            </p>
          </div>

          {/* Meeting Expectations */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.meeting_expectations}
                onChange={(e) => setFormData({ ...formData, meeting_expectations: e.target.checked })}
              />
              Meeting overall expectations
            </label>
          </div>

          {/* Areas of Strength */}
          <div className="form-group">
            <label>Areas of Strength</label>
            <textarea
              value={formData.areas_of_strength}
              onChange={(e) => setFormData({ ...formData, areas_of_strength: e.target.value })}
              rows="3"
              placeholder="What is the employee doing well?"
            />
          </div>

          {/* Areas for Improvement */}
          <div className="form-group">
            <label>Areas for Improvement</label>
            <textarea
              value={formData.areas_for_improvement}
              onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
              rows="3"
              placeholder="Where does the employee need to develop?"
            />
          </div>

          {/* Support Provided */}
          <div className="form-group">
            <label>Support Provided</label>
            <textarea
              value={formData.support_provided}
              onChange={(e) => setFormData({ ...formData, support_provided: e.target.value })}
              rows="2"
              placeholder="What support has been provided during this period?"
            />
          </div>

          {/* Support Needed */}
          <div className="form-group">
            <label>Support Needed</label>
            <textarea
              value={formData.support_needed}
              onChange={(e) => setFormData({ ...formData, support_needed: e.target.value })}
              rows="2"
              placeholder="What additional support does the employee need?"
            />
          </div>

          {/* Objectives for Next Period */}
          <div className="form-group">
            <label>Objectives for Next Period</label>
            <textarea
              value={formData.objectives_for_next_period}
              onChange={(e) => setFormData({ ...formData, objectives_for_next_period: e.target.value })}
              rows="3"
              placeholder="What should the employee focus on going forward?"
            />
          </div>

          {/* Manager Notes */}
          <div className="form-group">
            <label>Manager Notes (Private)</label>
            <textarea
              value={formData.manager_notes}
              onChange={(e) => setFormData({ ...formData, manager_notes: e.target.value })}
              rows="2"
              placeholder="Internal notes (not visible to employee)"
            />
          </div>

          {/* Recommendation */}
          <div className="form-group">
            <label>Recommendation *</label>
            <select
              value={formData.recommendation}
              onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
              required
            >
              <option value="continue">Continue Probation</option>
              <option value="extend">Extend Probation</option>
              <option value="pass">Pass Probation</option>
              <option value="fail">Fail Probation</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Complete Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProbationReviewForm;
