import { useState, useEffect } from 'react';
import EmployeeForm from './EmployeeForm';

function Employees({ user }) {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [error, setError] = useState('');

  const isAdmin = user.role_name === 'Admin';

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.users);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setRoles(data.roles);
      }
    } catch (err) {
      console.error('Failed to fetch roles');
    }
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setShowForm(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData) => {
    const token = localStorage.getItem('token');
    const isEdit = !!editingEmployee;
    const url = isEdit ? `/api/users/${editingEmployee.id}` : '/api/users';
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
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      throw err;
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase()) ||
    emp.role_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="loading">Loading employees...</div>;
  }

  return (
    <div className="employees-container">
      <div className="employees-header">
        <h2>Employees</h2>
        <div className="employees-actions">
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          {isAdmin && (
            <button onClick={handleAddEmployee} className="add-btn">
              Add Employee
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="table-container">
        <table className="employees-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Start Date</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => (
              <tr key={emp.id}>
                <td>{emp.full_name}</td>
                <td>{emp.email}</td>
                <td><span className="role-badge">{emp.role_name}</span></td>
                <td>
                  <span className={`status-badge ${emp.employment_status}`}>
                    {emp.employment_status}
                  </span>
                </td>
                <td>{formatDate(emp.start_date)}</td>
                {isAdmin && (
                  <td>
                    <button
                      onClick={() => handleEditEmployee(emp)}
                      className="edit-btn"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="no-results">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          roles={roles}
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}

export default Employees;
