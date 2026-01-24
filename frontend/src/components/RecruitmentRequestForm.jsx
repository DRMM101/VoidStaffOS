import { useState, useEffect } from 'react';
import './RecruitmentRequestForm.css';

export default function RecruitmentRequestForm({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    role_title: '',
    role_tier: '',
    department: '',
    role_description: '',
    justification: '',
    proposed_salary_min: '',
    proposed_salary_max: '',
    proposed_hours: 'full-time',
    proposed_start_date: ''
  });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRoles();
  }, []);

  async function fetchRoles() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Failed to fetch roles');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      // Create the request
      const createResponse = await fetch('/api/recruitment/requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!createResponse.ok) {
        const data = await createResponse.json();
        throw new Error(data.error || 'Failed to create request');
      }

      const createData = await createResponse.json();

      // Submit for approval
      const submitResponse = await fetch(`/api/recruitment/requests/${createData.request.id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!submitResponse.ok) {
        const data = await submitResponse.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      onSubmit();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="recruitment-request-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request New Team Member</h2>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h3>Role Details</h3>

            <div className="form-group">
              <label>Role Title *</label>
              <input
                type="text"
                value={formData.role_title}
                onChange={e => setFormData({ ...formData, role_title: e.target.value })}
                placeholder="e.g., Senior Developer"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Tier Level</label>
                <select
                  value={formData.role_tier}
                  onChange={e => setFormData({ ...formData, role_tier: e.target.value })}
                >
                  <option value="">Select tier...</option>
                  <option value="1">Tier 1 - Entry</option>
                  <option value="2">Tier 2 - Junior</option>
                  <option value="3">Tier 3 - Mid</option>
                  <option value="4">Tier 4 - Senior</option>
                  <option value="5">Tier 5 - Lead/Principal</option>
                </select>
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g., Engineering"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Role Description</label>
              <textarea
                value={formData.role_description}
                onChange={e => setFormData({ ...formData, role_description: e.target.value })}
                placeholder="Key responsibilities and requirements..."
                rows={4}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Justification</h3>
            <div className="form-group">
              <label>Why is this role needed? *</label>
              <textarea
                value={formData.justification}
                onChange={e => setFormData({ ...formData, justification: e.target.value })}
                placeholder="Business case, workload increase, team expansion, replacement..."
                rows={4}
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Proposed Terms</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Salary Range (Min)</label>
                <div className="salary-input">
                  <span>£</span>
                  <input
                    type="number"
                    value={formData.proposed_salary_min}
                    onChange={e => setFormData({ ...formData, proposed_salary_min: e.target.value })}
                    placeholder="30000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Salary Range (Max)</label>
                <div className="salary-input">
                  <span>£</span>
                  <input
                    type="number"
                    value={formData.proposed_salary_max}
                    onChange={e => setFormData({ ...formData, proposed_salary_max: e.target.value })}
                    placeholder="45000"
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Hours</label>
                <select
                  value={formData.proposed_hours}
                  onChange={e => setFormData({ ...formData, proposed_hours: e.target.value })}
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                </select>
              </div>

              <div className="form-group">
                <label>Ideal Start Date</label>
                <input
                  type="date"
                  value={formData.proposed_start_date}
                  onChange={e => setFormData({ ...formData, proposed_start_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="form-info">
            This request will be sent to your manager for approval.
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
