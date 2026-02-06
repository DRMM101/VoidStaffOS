/**
 * HeadOfficeOS - Employee Form Component
 * Create and edit employee details.
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
  const [additionalRoles, setAdditionalRoles] = useState([]);
  const [userAdditionalRoles, setUserAdditionalRoles] = useState([]);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchManagers();
    fetchAdditionalRoles();
    if (isEdit && employee?.id) {
      fetchUserAdditionalRoles();
    }
  }, []);

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/users/managers', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setManagers(data.managers);
      }
    } catch (err) {
      console.error('Failed to fetch managers');
    }
  };

  const fetchAdditionalRoles = async () => {
    try {
      const response = await fetch('/api/roles/additional', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setAdditionalRoles(data.roles.filter(r => r.is_active));
      }
    } catch (err) {
      console.error('Failed to fetch additional roles');
    }
  };

  const fetchUserAdditionalRoles = async () => {
    try {
      const response = await fetch(`/api/roles/user/${employee.id}/additional`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setUserAdditionalRoles(data.additional_roles);
      }
    } catch (err) {
      console.error('Failed to fetch user additional roles');
    }
  };

  const handleAddAdditionalRole = async () => {
    if (!selectedRoleToAdd || !employee?.id) return;

    try {
      const response = await apiFetch(`/api/roles/user/${employee.id}/additional`, {
        method: 'POST',
        body: JSON.stringify({ additional_role_id: parseInt(selectedRoleToAdd) })
      });
      const data = await response.json();
      if (response.ok) {
        fetchUserAdditionalRoles();
        setSelectedRoleToAdd('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to assign role');
    }
  };

  const handleRemoveAdditionalRole = async (assignmentId) => {
    if (!employee?.id) return;

    try {
      const response = await apiFetch(`/api/roles/user/${employee.id}/additional/${assignmentId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (response.ok) {
        fetchUserAdditionalRoles();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to remove role');
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
                <span className="field-hint-inline">(100=Chair/CEO, 10=Contractor)</span>
              </label>
              <select
                id="tier"
                name="tier"
                value={formData.tier}
                onChange={handleChange}
              >
                <option value="">Auto (based on role)</option>
                <option value="100">100 - Chair/CEO</option>
                <option value="90">90 - Director</option>
                <option value="80">80 - Executive</option>
                <option value="70">70 - Senior Manager</option>
                <option value="60">60 - Manager</option>
                <option value="50">50 - Team Lead</option>
                <option value="40">40 - Senior Employee</option>
                <option value="30">30 - Employee</option>
                <option value="20">20 - Trainee</option>
                <option value="10">10 - Contractor</option>
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

          {isEdit && (
            <div className="additional-roles-section">
              <label className="section-label">Additional Roles</label>
              <div className="assigned-roles">
                {userAdditionalRoles.length > 0 ? (
                  userAdditionalRoles.map(role => (
                    <div key={role.id} className="role-chip">
                      <span className="role-chip-name">{role.role_name}</span>
                      <span className="role-chip-category">{role.category}</span>
                      <button
                        type="button"
                        className="role-chip-remove"
                        onClick={() => handleRemoveAdditionalRole(role.id)}
                        title="Remove role"
                      >
                        &times;
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="no-roles-text">No additional roles assigned</span>
                )}
              </div>
              <div className="add-role-row">
                <select
                  value={selectedRoleToAdd}
                  onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                  className="add-role-select"
                >
                  <option value="">Select role to add...</option>
                  {additionalRoles
                    .filter(r => !userAdditionalRoles.some(ur => ur.additional_role_id === r.id))
                    .map(role => (
                      <option key={role.id} value={role.id}>
                        {role.role_name} ({role.category})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="add-role-btn"
                  onClick={handleAddAdditionalRole}
                  disabled={!selectedRoleToAdd}
                >
                  Add Role
                </button>
              </div>
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
