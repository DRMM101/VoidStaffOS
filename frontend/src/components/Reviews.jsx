import { useState, useEffect } from 'react';
import ReviewForm from './ReviewForm';
import ReviewDetail from './ReviewDetail';

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
      const token = localStorage.getItem('token');
      const response = await fetch('/api/reviews', {
        headers: { 'Authorization': `Bearer ${token}` }
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
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/my-team', {
        headers: { 'Authorization': `Bearer ${token}` }
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
    const token = localStorage.getItem('token');
    const isEdit = !!editingReview;
    const url = isEdit ? `/api/reviews/${editingReview.id}` : '/api/reviews';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getRatingDisplay = (rating) => {
    if (!rating) return '-';
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    return <span className="rating-stars">{stars}</span>;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'draft': return 'status-badge draft';
      case 'submitted': return 'status-badge submitted';
      case 'acknowledged': return 'status-badge acknowledged';
      default: return 'status-badge';
    }
  };

  if (loading) {
    return <div className="loading">Loading reviews...</div>;
  }

  if (selectedReview) {
    return (
      <ReviewDetail
        review={selectedReview}
        onClose={handleDetailClose}
        onEdit={canCreate ? handleEditReview : null}
        canEdit={canCreate && selectedReview.reviewer_id === user.id}
      />
    );
  }

  return (
    <div className="reviews-container">
      <div className="reviews-header">
        <h2>Performance Reviews</h2>
        {canCreate && (
          <button onClick={handleNewReview} className="add-btn">
            New Review
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="table-container">
        <table className="reviews-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Reviewer</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map(review => (
              <tr key={review.id}>
                <td>{formatDate(review.review_date)}</td>
                <td>{review.employee_name}</td>
                <td>{review.reviewer_name}</td>
                <td>{getRatingDisplay(review.overall_rating)}</td>
                <td>
                  <span className={getStatusBadgeClass(review.status)}>
                    {review.status}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleViewReview(review)}
                    className="view-btn"
                  >
                    View
                  </button>
                  {canCreate && review.reviewer_id === user.id && (
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
                  No reviews found
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
