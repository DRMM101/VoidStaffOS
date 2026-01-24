import { useState, useEffect } from 'react';
import EmployeeForm from './EmployeeForm';
import QuarterlyReport from './QuarterlyReport';
import ReviewForm from './ReviewForm';

function Employees({ user }) {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [error, setError] = useState('');
  const [reportEmployeeId, setReportEmployeeId] = useState(null);
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);
  const [snapshotEmployee, setSnapshotEmployee] = useState(null);
  const [currentWeekFriday, setCurrentWeekFriday] = useState('');
  const [isFriday, setIsFriday] = useState(false);

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';
  const canCreateSnapshots = isAdmin || isManager;
  const canViewReports = ['Admin', 'Manager', 'Compliance Officer'].includes(user.role_name);

  const handleViewReport = (employeeId) => {
    setReportEmployeeId(employeeId);
  };

  const handleCloseReport = () => {
    setReportEmployeeId(null);
  };

  useEffect(() => {
    fetchEmployeesWithStatus();
    fetchRoles();
  }, []);

  const fetchEmployeesWithStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/with-review-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.users);
        setCurrentWeekFriday(data.current_week_friday);
        setIsFriday(data.is_friday);
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
      fetchEmployeesWithStatus();
    } catch (err) {
      throw err;
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  // Snapshot handlers
  const handleCreateSnapshot = (employee) => {
    setSnapshotEmployee(employee);
    setShowSnapshotForm(true);
  };

  const handleSnapshotSubmit = async (formData) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          employee_id: snapshotEmployee.id
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      setShowSnapshotForm(false);
      setSnapshotEmployee(null);
      fetchEmployeesWithStatus();
    } catch (err) {
      throw err;
    }
  };

  const handleSnapshotClose = () => {
    setShowSnapshotForm(false);
    setSnapshotEmployee(null);
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

  const getSnapshotButtonContent = (emp) => {
    if (emp.has_current_week_review) {
      return {
        text: 'Week Complete',
        icon: '✓',
        className: 'snapshot-btn complete',
        disabled: true
      };
    }

    const statusClasses = {
      due_today: 'snapshot-btn due-today',
      upcoming: 'snapshot-btn upcoming',
      overdue: 'snapshot-btn overdue'
    };

    return {
      text: 'Create Snapshot',
      icon: '📝',
      className: statusClasses[emp.review_status] || 'snapshot-btn',
      disabled: false
    };
  };

  if (loading) {
    return <div className="loading">Loading employees...</div>;
  }

  if (reportEmployeeId) {
    return (
      <QuarterlyReport
        employeeId={reportEmployeeId}
        onClose={handleCloseReport}
        user={user}
      />
    );
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
              <th>Last Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => {
              const snapshotBtn = getSnapshotButtonContent(emp);
              return (
                <tr key={emp.id}>
                  <td>{emp.full_name}</td>
                  <td>{emp.email}</td>
                  <td><span className="role-badge">{emp.role_name}</span></td>
                  <td>
                    <span className={`status-badge ${emp.employment_status}`}>
                      {emp.employment_status}
                    </span>
                  </td>
                  <td>
                    <div className="last-review-cell">
                      <span className="last-review-date">
                        {formatDate(emp.last_review_date)}
                      </span>
                      {emp.missed_weeks > 0 && (
                        <span className="missed-weeks-badge" title={`${emp.missed_weeks} week(s) without review`}>
                          {emp.missed_weeks}w missed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    {canCreateSnapshots && emp.id !== user.id && (
                      <button
                        onClick={() => !snapshotBtn.disabled && handleCreateSnapshot(emp)}
                        className={snapshotBtn.className}
                        disabled={snapshotBtn.disabled}
                        title={snapshotBtn.disabled ? 'Snapshot already exists for this week' : `Create weekly snapshot for ${emp.full_name}`}
                      >
                        <span className="snapshot-btn-icon">{snapshotBtn.icon}</span>
                        {snapshotBtn.text}
                      </button>
                    )}
                    {canViewReports && (
                      <button
                        onClick={() => handleViewReport(emp.id)}
                        className="report-btn"
                      >
                        <span className="report-btn-icon">📊</span>
                        Report
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleEditEmployee(emp)}
                        className="edit-btn"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan="6" className="no-results">
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

      {showSnapshotForm && snapshotEmployee && (
        <ReviewForm
          review={null}
          employees={[{ id: snapshotEmployee.id, full_name: snapshotEmployee.full_name }]}
          onSubmit={handleSnapshotSubmit}
          onClose={handleSnapshotClose}
          defaultEmployeeId={snapshotEmployee.id}
        />
      )}
    </div>
  );
}

export default Employees;
