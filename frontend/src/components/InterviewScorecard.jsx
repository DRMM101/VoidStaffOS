import { useState } from 'react';
import './InterviewScorecard.css';

export default function InterviewScorecard({ interview, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    status: 'completed',
    score: 5,
    notes: '',
    recommend_next_stage: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/pipeline/interviews/${interview.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update interview');
      }

      onSubmit();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getScoreLabel(score) {
    if (score <= 2) return 'Poor';
    if (score <= 4) return 'Below Average';
    if (score <= 6) return 'Average';
    if (score <= 8) return 'Good';
    return 'Excellent';
  }

  return (
    <div className="scorecard-overlay" onClick={onClose}>
      <div className="scorecard-modal" onClick={e => e.stopPropagation()}>
        <div className="scorecard-header">
          <h3>Interview Scorecard</h3>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        <div className="interview-info">
          <p><strong>Type:</strong> {interview.interview_type.replace('_', ' ')}</p>
          <p><strong>Date:</strong> {new Date(interview.scheduled_date).toLocaleDateString()}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Outcome</label>
            <div className="status-options">
              <label className={formData.status === 'completed' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="status"
                  value="completed"
                  checked={formData.status === 'completed'}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                />
                Completed
              </label>
              <label className={formData.status === 'no_show' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="status"
                  value="no_show"
                  checked={formData.status === 'no_show'}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                />
                No Show
              </label>
              <label className={formData.status === 'cancelled' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="status"
                  value="cancelled"
                  checked={formData.status === 'cancelled'}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                />
                Cancelled
              </label>
            </div>
          </div>

          {formData.status === 'completed' && (
            <>
              <div className="form-group">
                <label>Overall Score: {formData.score}/10 ({getScoreLabel(formData.score)})</label>
                <div className="score-slider">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.score}
                    onChange={e => setFormData({ ...formData, score: parseInt(e.target.value) })}
                  />
                  <div className="score-labels">
                    <span>1</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Interview Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Key observations, strengths, concerns..."
                  rows={5}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.recommend_next_stage}
                    onChange={e => setFormData({ ...formData, recommend_next_stage: e.target.checked })}
                  />
                  Recommend for next stage
                </label>
              </div>

              {!formData.recommend_next_stage && (
                <div className="warning-box">
                  Candidate will be flagged for further assessment
                </div>
              )}
            </>
          )}

          {formData.status === 'no_show' && (
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional context..."
                rows={3}
              />
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Saving...' : 'Submit Scorecard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
