import { useState } from 'react';

function ReviewForm({ review, employees, onSubmit, onClose }) {
  const isEdit = !!review;
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    employee_id: review?.employee_id || '',
    review_date: review?.review_date ? review.review_date.split('T')[0] : today,
    period_start: review?.period_start ? review.period_start.split('T')[0] : '',
    period_end: review?.period_end ? review.period_end.split('T')[0] : '',
    goals: review?.goals || '',
    achievements: review?.achievements || '',
    areas_for_improvement: review?.areas_for_improvement || '',
    overall_rating: review?.overall_rating || '',
    status: review?.status || 'draft'
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        overall_rating: formData.overall_rating ? parseInt(formData.overall_rating) : null
      };
      await onSubmit(submitData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Review' : 'New Performance Review'}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="employee_id">Employee</label>
              <select
                id="employee_id"
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                disabled={isEdit}
              >
                <option value="">Select an employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="review_date">Review Date</label>
              <input
                type="date"
                id="review_date"
                name="review_date"
                value={formData.review_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="period_start">Period Start</label>
              <input
                type="date"
                id="period_start"
                name="period_start"
                value={formData.period_start}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="period_end">Period End</label>
              <input
                type="date"
                id="period_end"
                name="period_end"
                value={formData.period_end}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="goals">Goals</label>
            <textarea
              id="goals"
              name="goals"
              value={formData.goals}
              onChange={handleChange}
              rows="3"
              placeholder="What were the goals for this review period?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="achievements">Achievements</label>
            <textarea
              id="achievements"
              name="achievements"
              value={formData.achievements}
              onChange={handleChange}
              rows="3"
              placeholder="What did the employee achieve during this period?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="areas_for_improvement">Areas for Improvement</label>
            <textarea
              id="areas_for_improvement"
              name="areas_for_improvement"
              value={formData.areas_for_improvement}
              onChange={handleChange}
              rows="3"
              placeholder="What areas need improvement?"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="overall_rating">Overall Rating</label>
              <select
                id="overall_rating"
                name="overall_rating"
                value={formData.overall_rating}
                onChange={handleChange}
              >
                <option value="">Select rating</option>
                <option value="1">1 - Needs Improvement</option>
                <option value="2">2 - Below Expectations</option>
                <option value="3">3 - Meets Expectations</option>
                <option value="4">4 - Exceeds Expectations</option>
                <option value="5">5 - Outstanding</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="acknowledged">Acknowledged</option>
              </select>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Update Review' : 'Create Review')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReviewForm;
