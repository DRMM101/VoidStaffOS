import { useState, useEffect } from 'react';

function EmployeeForm({ employee, roles, onSubmit, onClose }) {
  const isEdit = !!employee;

  const [formData, setFormData] = useState({
    full_name: employee?.full_name || '',
    email: employee?.email || '',
    password: '',
    role_id: employee?.role_id || '',
    start_date: employee?.start_date ? employee.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
    employment_status: employee?.employment_status || 'active',
    employee_number: employee?.employee_number || '',
    manager_id: employee?.manager_id || '',
    tier: employee?.tier ?? ''
  });

  const [managers, setManagers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/managers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setManagers(data.managers);
      }
    } catch (err) {
      console.error('Failed to fetch managers');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = { ...formData };
      if (isEdit && !submitData.password) {
        delete submitData.password;
      }
      // Convert empty strings to null for optional fields
      if (!submitData.employee_number) submitData.employee_number = null;
      if (!submitData.manager_id) submitData.manager_id = null;
      // Convert tier to integer or undefined (let backend decide)
      if (submitData.tier === '') {
        delete submitData.tier; // Let backend auto-assign based on role
      } else {
        submitData.tier = parseInt(submitData.tier, 10);
      }

      await onSubmit(submitData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Employee' : 'Add Employee'}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="full_name">Full Name</label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="employee_number">
                Employee Number
                <span className="field-hint-inline">(auto-generated if blank)</span>
              </label>
              <input
                type="text"
                id="employee_number"
                name="employee_number"
                value={formData.employee_number}
                onChange={handleChange}
                placeholder="EMP001"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password {isEdit && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={!isEdit}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="role_id">Role</label>
              <select
                id="role_id"
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
                required
              >
                <option value="">Select a role</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.role_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="manager_id">Line Manager</label>
              <select
                id="manager_id"
                name="manager_id"
                value={formData.manager_id}
                onChange={handleChange}
              >
                <option value="">No manager assigned</option>
                {managers.filter(m => m.id !== employee?.id).map(mgr => (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.full_name} ({mgr.role_name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tier">
                Tier
                <span className="field-hint-inline">(1=Executive, 5=Entry)</span>
              </label>
              <select
                id="tier"
                name="tier"
                value={formData.tier}
                onChange={handleChange}
              >
                <option value="">Auto (based on role)</option>
                <option value="1">Tier 1 - Executive</option>
                <option value="2">Tier 2 - Senior</option>
                <option value="3">Tier 3 - Mid-Level</option>
                <option value="4">Tier 4 - Junior</option>
                <option value="5">Tier 5 - Entry Level</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="start_date">Start Date</label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            {isEdit && (
              <div className="form-group">
                <label htmlFor="employment_status">Status</label>
                <select
                  id="employment_status"
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeForm;
