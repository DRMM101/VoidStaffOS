/**
 * VoidStaffOS - Employees Component
 * Employee list and management interface.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import EmployeeForm from './EmployeeForm';
import EmployeeProfile from './EmployeeProfile';
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
  const [profileEmployeeId, setProfileEmployeeId] = useState(null);
  const [orphanedEmployees, setOrphanedEmployees] = useState([]);

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';
  const canCreateSnapshots = isAdmin || isManager;
  const canViewReports = ['Admin', 'Manager', 'Compliance Officer'].includes(user.role_name);
  const canViewOrphaned = isAdmin || isManager;

  // Tier display helper (10-100 scale)
  const getTierDisplay = (tier) => {
    if (tier === null) return '-';
    const tierNames = {
      100: 'Chair/CEO',
      90: 'Director',
      80: 'Executive',
      70: 'Sr Manager',
      60: 'Manager',
      50: 'Team Lead',
      40: 'Sr Employee',
      30: 'Employee',
      20: 'Trainee',
      10: 'Contractor'
    };
    return tierNames[tier] || `T${tier}`;
  };

  // Tier CSS class helper (10-100 scale)
  const getTierClass = (tier) => {
    if (tier === null) return 'tier-admin';
    if (tier >= 90) return 'tier-100';
    if (tier >= 70) return 'tier-70';
    if (tier >= 50) return 'tier-50';
    if (tier >= 30) return 'tier-30';
    return 'tier-10';
  };

  const handleViewReport = (employeeId) => {
    setReportEmployeeId(employeeId);
  };

  const handleCloseReport = () => {
    setReportEmployeeId(null);
  };

  const handleViewProfile = (employeeId) => {
    setProfileEmployeeId(employeeId);
  };

  const handleCloseProfile = () => {
    setProfileEmployeeId(null);
  };

  useEffect(() => {
    fetchEmployeesWithStatus();
    fetchRoles();
    if (canViewOrphaned) {
      fetchOrphanedEmployees();
    }
  }, []);

  const fetchEmployeesWithStatus = async () => {
    try {
      const response = await fetch('/api/users/with-review-status', {
        credentials: 'include'
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
      const response = await fetch('/api/users/roles', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setRoles(data.roles);
      }
    } catch (err) {
      console.error('Failed to fetch roles');
    }
  };

  const fetchOrphanedEmployees = async () => {
    try {
      const response = await fetch('/api/users/orphaned', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setOrphanedEmployees(data.orphaned_employees);
      }
    } catch (err) {
      console.error('Failed to fetch orphaned employees');
    }
  };

  const handleAdoptEmployee = async (employeeId) => {
    try {
      const response = await apiFetch(`/api/users/adopt-employee/${employeeId}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        fetchEmployeesWithStatus();
        fetchOrphanedEmployees();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to adopt employee');
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
    const isEdit = !!editingEmployee;
    const url = isEdit ? `/api/users/${editingEmployee.id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      setShowForm(false);
      setEditingEmployee(null);
      fetchEmployeesWithStatus();
      fetchOrphanedEmployees();
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
    try {
      const response = await apiFetch('/api/reviews', {
        method: 'POST',
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
    emp.role_name?.toLowerCase().includes(search.toLowerCase()) ||
    emp.employee_number?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getSnapshotButtonContent = (emp) => {
    if (emp.has_current_week_review) {
      return {
        text: 'Week Complete',
        icon: '\u2713',
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
      icon: '\u{1F4DD}',
      className: statusClasses[emp.review_status] || 'snapshot-btn',
      disabled: false
    };
  };

  const isOrphaned = (emp) => !emp.manager_id && emp.role_name !== 'Admin';

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
            placeholder="Search by name, email, role, or employee #..."
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

      {/* Orphaned Employees Alert */}
      {canViewOrphaned && orphanedEmployees.length > 0 && (
        <div className="orphaned-alert">
          <div className="orphaned-alert-header">
            <span className="warning-icon">&#9888;</span>
            <strong>{orphanedEmployees.length} employee(s) without a manager</strong>
          </div>
          <div className="orphaned-list">
            {orphanedEmployees.slice(0, 5).map(emp => (
              <div key={emp.id} className="orphaned-item">
                <span className="orphaned-name">{emp.full_name}</span>
                <span className="orphaned-tier">T{emp.tier}</span>
                <span className="orphaned-number">{emp.employee_number}</span>
                {(isManager || isAdmin) && (
                  <button
                    onClick={() => handleAdoptEmployee(emp.id)}
                    className="adopt-btn-small"
                  >
                    Adopt
                  </button>
                )}
              </div>
            ))}
            {orphanedEmployees.length > 5 && (
              <div className="orphaned-more">
                +{orphanedEmployees.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="table-container">
        <table className="employees-table">
          <thead>
            <tr>
              <th>Employee #</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Last Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => {
              const snapshotBtn = getSnapshotButtonContent(emp);
              const orphaned = isOrphaned(emp);
              return (
                <tr key={emp.id} className={orphaned ? 'orphaned-row' : ''}>
                  <td>
                    <span className="employee-number-cell">
                      {emp.employee_number || '-'}
                    </span>
                  </td>
                  <td>
                    <div className="name-cell">
                      <span
                        className="employee-name-link"
                        onClick={() => handleViewProfile(emp.id)}
                      >
                        {emp.full_name}
                      </span>
                      {orphaned && (
                        <span className="orphaned-indicator" title="No manager assigned">
                          &#9888;
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{emp.email}</td>
                  <td><span className="role-badge">{emp.role_name}</span></td>
                  <td><span className={`tier-badge ${getTierClass(emp.tier)}`}>{getTierDisplay(emp.tier)}</span></td>
                  <td>
                    {emp.on_probation && emp.employment_status === 'active' ? (
                      <span className="status-badge probation">
                        Probation
                      </span>
                    ) : (
                      <span className={`status-badge ${emp.employment_status}`}>
                        {emp.employment_status}
                      </span>
                    )}
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
                    <button
                      onClick={() => handleViewProfile(emp.id)}
                      className="profile-btn"
                      title="View profile"
                    >
                      Profile
                    </button>
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
                        <span className="report-btn-icon">&#x1F4CA;</span>
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
                <td colSpan="8" className="no-results">
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

      {profileEmployeeId && (
        <EmployeeProfile
          employeeId={profileEmployeeId}
          user={user}
          onClose={handleCloseProfile}
          onAdopt={() => {
            fetchEmployeesWithStatus();
            fetchOrphanedEmployees();
          }}
          onAssignManager={() => {
            fetchEmployeesWithStatus();
            fetchOrphanedEmployees();
          }}
        />
      )}
    </div>
  );
}

export default Employees;
