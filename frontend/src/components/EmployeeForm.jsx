import { useState } from 'react';

function EmployeeForm({ employee, roles, onSubmit, onClose }) {
  const isEdit = !!employee;

  const [formData, setFormData] = useState({
    full_name: employee?.full_name || '',
    email: employee?.email || '',
    password: '',
    role_id: employee?.role_id || '',
    start_date: employee?.start_date ? employee.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
    employment_status: employee?.employment_status || 'active'
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
      const submitData = { ...formData };
      if (isEdit && !submitData.password) {
        delete submitData.password;
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
