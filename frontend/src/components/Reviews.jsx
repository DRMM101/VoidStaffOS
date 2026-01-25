/**
 * VoidStaffOS - Reviews Component
 * Performance review list and management.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

import { useState, useEffect } from 'react';
import ReviewForm from './ReviewForm';
import ReviewDetail from './ReviewDetail';

function TrafficLight({ status }) {
  if (!status) return <span className="traffic-light neutral"></span>;
  return <span className={`traffic-light ${status}`}></span>;
}

function TrafficLights({ velocity, friction, cohesion }) {
  return (
    <div className="traffic-lights">
      <TrafficLight status={velocity} />
      <TrafficLight status={friction} />
      <TrafficLight status={cohesion} />
    </div>
  );
}

function Reviews({ user, canCreate }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [teamEmployees, setTeamEmployees] = useState([]);

  useEffect(() => {
    fetchReviews();
    if (canCreate) {
      fetchTeamEmployees();
    }
  }, [canCreate]);

  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/reviews', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setReviews(data.reviews);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamEmployees = async () => {
    try {
      const response = await fetch('/api/users/my-team', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setTeamEmployees(data.employees);
      }
    } catch (err) {
      console.error('Failed to fetch team employees');
    }
  };

  const handleNewReview = () => {
    setEditingReview(null);
    setShowForm(true);
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
    setShowForm(true);
  };

  const handleViewReview = (review) => {
    setSelectedReview(review);
  };

  const handleFormSubmit = async (formData) => {
    const isEdit = !!editingReview;
    const url = isEdit ? `/api/reviews/${editingReview.id}` : '/api/reviews';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      setShowForm(false);
      setEditingReview(null);
      fetchReviews();
    } catch (err) {
      throw err;
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingReview(null);
  };

  const handleDetailClose = () => {
    setSelectedReview(null);
  };

  const handleDetailRefresh = async () => {
    try {
      const response = await fetch(`/api/reviews/${selectedReview.id}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setSelectedReview(data.review);
      }
      fetchReviews();
    } catch (err) {
      console.error('Failed to refresh review');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStalenessClass = (status) => {
    if (!status) return 'staleness-badge';
    return `staleness-badge ${status}`;
  };

  if (loading) {
    return <div className="loading">Loading snapshots...</div>;
  }

  if (selectedReview) {
    return (
      <ReviewDetail
        review={selectedReview}
        onClose={handleDetailClose}
        onEdit={canCreate ? handleEditReview : null}
        canEdit={canCreate && selectedReview.reviewer_id === user.id && !selectedReview.is_committed}
        user={user}
        onRefresh={handleDetailRefresh}
      />
    );
  }

  return (
    <div className="reviews-container">
      <div className="reviews-header">
        <h2>Performance Snapshots</h2>
        {canCreate && (
          <button onClick={handleNewReview} className="add-btn">
            New Snapshot
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="table-container">
        <table className="reviews-table">
          <thead>
            <tr>
              <th>Week Ending</th>
              <th>Employee</th>
              <th>KPIs</th>
              <th>Freshness</th>
              <th>Committed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map(review => (
              <tr key={review.id}>
                <td>{formatDate(review.review_date)}</td>
                <td>
                  {review.employee_name}
                  {review.is_self_assessment && (
                    <span className="self-badge" title="Self Assessment">S</span>
                  )}
                </td>
                <td>
                  <TrafficLights
                    velocity={review.velocity_status}
                    friction={review.friction_status}
                    cohesion={review.cohesion_status}
                  />
                </td>
                <td>
                  <span className={getStalenessClass(review.staleness_status)}>
                    {review.weeks_since_review != null ? `${review.weeks_since_review}w` : '-'}
                  </span>
                </td>
                <td>
                  {review.is_committed ? (
                    <span className="committed-badge" title="Committed">✓</span>
                  ) : (
                    <span className="not-committed">-</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => handleViewReview(review)}
                    className="view-btn"
                  >
                    View
                  </button>
                  {canCreate && review.reviewer_id === user.id && !review.is_committed && (
                    <button
                      onClick={() => handleEditReview(review)}
                      className="edit-btn"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan="6" className="no-results">
                  No snapshots found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ReviewForm
          review={editingReview}
          employees={teamEmployees}
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}

export default Reviews;
