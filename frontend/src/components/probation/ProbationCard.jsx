/**
 * HeadOfficeOS - Probation Card
 * Summary card showing employee probation status.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

function ProbationCard({ probation, statusColor, onSelect, onExtend, onOutcome }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysRemaining = () => {
    const today = new Date();
    const endDate = new Date(probation.end_date);
    const days = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getProgress = () => {
    const start = new Date(probation.start_date);
    const end = new Date(probation.end_date);
    const today = new Date();
    const total = end - start;
    const elapsed = today - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const daysRemaining = getDaysRemaining();
  const progress = getProgress();

  return (
    <div className={`probation-card status-${statusColor}`}>
      <div className="probation-card-header">
        <div className="employee-info">
          <h4>{probation.employee_name}</h4>
          {probation.employee_number && (
            <span className="employee-number">#{probation.employee_number}</span>
          )}
        </div>
        <div className={`status-light ${statusColor}`} title={
          statusColor === 'red' ? 'Attention needed' :
          statusColor === 'amber' ? 'Ending soon' : 'On track'
        } />
      </div>

      <div className="probation-card-body">
        <div className="probation-dates">
          <div className="date-item">
            <span className="date-label">Started</span>
            <span className="date-value">{formatDate(probation.start_date)}</span>
          </div>
          <div className="date-item">
            <span className="date-label">Ends</span>
            <span className="date-value">{formatDate(probation.end_date)}</span>
          </div>
        </div>

        <div className="probation-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">
            {daysRemaining > 0 ? (
              <span>{daysRemaining} days remaining</span>
            ) : (
              <span className="overdue">Overdue by {Math.abs(daysRemaining)} days</span>
            )}
          </div>
        </div>

        <div className="probation-meta">
          {probation.extended && (
            <span className="badge extended">Extended</span>
          )}
          {probation.manager_name && (
            <span className="manager-info">Manager: {probation.manager_name}</span>
          )}
        </div>

        <div className="review-status">
          <span className="reviews-completed">
            {probation.completed_reviews || 0}/{probation.total_reviews || 0} reviews completed
          </span>
          {probation.next_review_date && (
            <span className={`next-review ${new Date(probation.next_review_date) < new Date() ? 'overdue' : ''}`}>
              Next: {formatDate(probation.next_review_date)}
            </span>
          )}
        </div>
      </div>

      <div className="probation-card-actions">
        <button className="btn-small" onClick={onSelect}>
          View Details
        </button>
        <button className="btn-small" onClick={onExtend}>
          Extend
        </button>
        <button className="btn-small btn-primary" onClick={onOutcome}>
          Record Outcome
        </button>
      </div>
    </div>
  );
}

export default ProbationCard;
