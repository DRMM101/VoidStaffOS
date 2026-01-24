function ReviewDetail({ review, onClose, onEdit, canEdit }) {
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getRatingDisplay = (rating) => {
    if (!rating) return 'Not rated';
    const labels = {
      1: 'Needs Improvement',
      2: 'Below Expectations',
      3: 'Meets Expectations',
      4: 'Exceeds Expectations',
      5: 'Outstanding'
    };
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    return (
      <span className="rating-display">
        <span className="rating-stars">{stars}</span>
        <span className="rating-label">{labels[rating]}</span>
      </span>
    );
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'draft': return 'status-badge draft';
      case 'submitted': return 'status-badge submitted';
      case 'acknowledged': return 'status-badge acknowledged';
      default: return 'status-badge';
    }
  };

  return (
    <div className="review-detail-container">
      <div className="review-detail-header">
        <h2>Performance Review</h2>
        <div className="review-detail-actions">
          {canEdit && (
            <button onClick={() => onEdit(review)} className="edit-btn">
              Edit Review
            </button>
          )}
          <button onClick={onClose} className="back-btn">
            Back to List
          </button>
        </div>
      </div>

      <div className="review-detail-card">
        <div className="review-meta">
          <div className="meta-row">
            <div className="meta-item">
              <label>Employee</label>
              <span>{review.employee_name}</span>
            </div>
            <div className="meta-item">
              <label>Reviewer</label>
              <span>{review.reviewer_name}</span>
            </div>
          </div>
          <div className="meta-row">
            <div className="meta-item">
              <label>Review Date</label>
              <span>{formatDate(review.review_date)}</span>
            </div>
            <div className="meta-item">
              <label>Review Period</label>
              <span>{formatDate(review.period_start)} - {formatDate(review.period_end)}</span>
            </div>
          </div>
          <div className="meta-row">
            <div className="meta-item">
              <label>Overall Rating</label>
              {getRatingDisplay(review.overall_rating)}
            </div>
            <div className="meta-item">
              <label>Status</label>
              <span className={getStatusBadgeClass(review.status)}>
                {review.status}
              </span>
            </div>
          </div>
        </div>

        <div className="review-section">
          <h3>Goals</h3>
          <p>{review.goals || 'No goals specified'}</p>
        </div>

        <div className="review-section">
          <h3>Achievements</h3>
          <p>{review.achievements || 'No achievements recorded'}</p>
        </div>

        <div className="review-section">
          <h3>Areas for Improvement</h3>
          <p>{review.areas_for_improvement || 'No areas for improvement noted'}</p>
        </div>

        <div className="review-timestamps">
          <span>Created: {formatDate(review.created_at)}</span>
          {review.updated_at && review.updated_at !== review.created_at && (
            <span>Last Updated: {formatDate(review.updated_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewDetail;
