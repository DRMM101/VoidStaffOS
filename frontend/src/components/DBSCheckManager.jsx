/**
 * HeadOfficeOS - DBS Check Manager
 * DBS certificate verification management.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function DBSCheckManager({ user, onRefresh }) {
  const [checks, setChecks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpdateCheck, setShowUpdateCheck] = useState(null);
  const [editingCheck, setEditingCheck] = useState(null);
  const [filter, setFilter] = useState({ employee_id: '', status: '' });

  const isHR = user && (user.role_name === 'Admin' || user.role_name === 'HR Manager');

  const dbsLevels = [
    { value: 'basic', label: 'Basic' },
    { value: 'standard', label: 'Standard' },
    { value: 'enhanced', label: 'Enhanced' },
    { value: 'enhanced_barred', label: 'Enhanced + Barred List' }
  ];

  const statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'valid', label: 'Valid' },
    { value: 'expired', label: 'Expired' },
    { value: 'action_required', label: 'Action Required' }
  ];

  const workforceTypes = [
    { value: 'adult', label: 'Adult Workforce' },
    { value: 'child', label: 'Child Workforce' },
    { value: 'adult_and_child', label: 'Adult & Child Workforce' }
  ];

  const [formData, setFormData] = useState({
    employee_id: '',
    dbs_level: 'enhanced',
    certificate_number: '',
    issue_date: '',
    renewal_period_years: 3,
    update_service_registered: false,
    update_service_id: '',
    last_update_check: '',
    workforce: '',
    notes: ''
  });

  const [updateCheckData, setUpdateCheckData] = useState({
    check_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchChecks();
    fetchEmployees();
  }, [filter]);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.employee_id) params.append('employee_id', filter.employee_id);
      if (filter.status) params.append('status', filter.status);

      const response = await fetch(`/api/compliance/dbs?${params}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setChecks(data);
      }
    } catch (error) {
      console.error('Error fetching DBS checks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/users?status=active', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Handle both array and object response formats
        const userList = Array.isArray(data) ? data : (data.users || []);
        setEmployees(userList);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingCheck
        ? `/api/compliance/dbs/${editingCheck.id}`
        : '/api/compliance/dbs';
      const method = editingCheck ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowForm(false);
        setEditingCheck(null);
        resetForm();
        fetchChecks();
        if (onRefresh) onRefresh();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save DBS check');
      }
    } catch (error) {
      console.error('Error saving DBS check:', error);
      alert('Failed to save DBS check');
    }
  };

  const handleUpdateServiceCheck = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/api/compliance/dbs/${showUpdateCheck.id}/update-check`, {
        method: 'POST',
        body: JSON.stringify(updateCheckData)
      });

      if (response.ok) {
        setShowUpdateCheck(null);
        setUpdateCheckData({ check_date: new Date().toISOString().split('T')[0], notes: '' });
        fetchChecks();
        if (onRefresh) onRefresh();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to record update check');
      }
    } catch (error) {
      console.error('Error recording update check:', error);
      alert('Failed to record update check');
    }
  };

  const handleEdit = (check) => {
    setEditingCheck(check);
    setFormData({
      employee_id: check.employee_id,
      dbs_level: check.dbs_level,
      certificate_number: check.certificate_number || '',
      issue_date: check.issue_date?.split('T')[0] || '',
      renewal_period_years: check.renewal_period_years || 3,
      update_service_registered: check.update_service_registered || false,
      update_service_id: check.update_service_id || '',
      last_update_check: check.last_update_check?.split('T')[0] || '',
      workforce: check.workforce || '',
      status: check.status,
      notes: check.notes || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      dbs_level: 'enhanced',
      certificate_number: '',
      issue_date: '',
      renewal_period_years: 3,
      update_service_registered: false,
      update_service_id: '',
      last_update_check: '',
      workforce: '',
      notes: ''
    });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'valid': return 'status-compliant';
      case 'pending': return 'status-warning';
      case 'expired': return 'status-danger';
      case 'action_required': return 'status-danger';
      default: return '';
    }
  };

  const isUpdateDue = (check) => {
    if (!check.update_service_registered || !check.next_update_check) return false;
    const nextCheck = new Date(check.next_update_check);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return nextCheck <= thirtyDaysFromNow;
  };

  return (
    <div className="dbs-manager">
      <div className="manager-header">
        <h2>DBS Checks</h2>
        {isHR && (
          <button
            className="btn-primary"
            onClick={() => {
              setEditingCheck(null);
              resetForm();
              setShowForm(true);
            }}
          >
            + New DBS Check
          </button>
        )}
      </div>

      <div className="manager-filters">
        <select
          value={filter.employee_id}
          onChange={(e) => setFilter({ ...filter, employee_id: e.target.value })}
        >
          <option value="">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {statuses.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal dbs-form-modal">
            <h3>{editingCheck ? 'Edit DBS Check' : 'New DBS Check'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Employee *</label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    required
                    disabled={editingCheck}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>DBS Level *</label>
                  <select
                    value={formData.dbs_level}
                    onChange={(e) => setFormData({ ...formData, dbs_level: e.target.value })}
                    required
                  >
                    {dbsLevels.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Certificate Number</label>
                  <input
                    type="text"
                    value={formData.certificate_number}
                    onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
                    placeholder="DBS certificate number"
                  />
                </div>
                <div className="form-group">
                  <label>Issue Date *</label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Renewal Period *</label>
                  <select
                    value={formData.renewal_period_years}
                    onChange={(e) => setFormData({ ...formData, renewal_period_years: parseInt(e.target.value) })}
                    required
                  >
                    <option value={1}>1 Year</option>
                    <option value={2}>2 Years</option>
                    <option value={3}>3 Years</option>
                  </select>
                  <small>When should this DBS be renewed?</small>
                </div>
                <div className="form-group">
                  <label>Workforce</label>
                  <select
                    value={formData.workforce}
                    onChange={(e) => setFormData({ ...formData, workforce: e.target.value })}
                  >
                    <option value="">Select Workforce</option>
                    {workforceTypes.map(w => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group update-service-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.update_service_registered}
                    onChange={(e) => setFormData({ ...formData, update_service_registered: e.target.checked })}
                  />
                  Registered with DBS Update Service
                </label>
              </div>

              {formData.update_service_registered && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Update Service ID</label>
                    <input
                      type="text"
                      value={formData.update_service_id}
                      onChange={(e) => setFormData({ ...formData, update_service_id: e.target.value })}
                      placeholder="Update service reference"
                      required={formData.update_service_registered}
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Update Check</label>
                    <input
                      type="date"
                      value={formData.last_update_check}
                      onChange={(e) => setFormData({ ...formData, last_update_check: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {editingCheck && (
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {statuses.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCheck ? 'Update' : 'Create'} DBS Check
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpdateCheck && (
        <div className="modal-overlay">
          <div className="modal update-check-modal">
            <h3>Record Update Service Check</h3>
            <p>Recording annual update check for {showUpdateCheck.employee_name}</p>
            <form onSubmit={handleUpdateServiceCheck}>
              <div className="form-group">
                <label>Check Date *</label>
                <input
                  type="date"
                  value={updateCheckData.check_date}
                  onChange={(e) => setUpdateCheckData({ ...updateCheckData, check_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={updateCheckData.notes}
                  onChange={(e) => setUpdateCheckData({ ...updateCheckData, notes: e.target.value })}
                  rows="2"
                  placeholder="Optional notes about this check"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUpdateCheck(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Record Check
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading DBS checks...</div>
      ) : (
        <div className="dbs-table-container">
          <table className="dbs-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Level</th>
                <th>Certificate #</th>
                <th>Issue Date</th>
                <th>Renewal</th>
                <th>Expiry</th>
                <th>Update Service</th>
                <th>Status</th>
                {isHR && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={isHR ? "9" : "8"} className="no-data">
                    No DBS checks found
                  </td>
                </tr>
              ) : (
                checks.map(check => (
                  <tr key={check.id} className={isUpdateDue(check) ? 'update-due-row' : ''}>
                    <td>
                      <div>{check.employee_name}</div>
                      <small className="employee-number">{check.employee_number}</small>
                    </td>
                    <td>{dbsLevels.find(l => l.value === check.dbs_level)?.label || check.dbs_level}</td>
                    <td>{check.certificate_number || '-'}</td>
                    <td>{formatDate(check.issue_date)}</td>
                    <td>{check.renewal_period_years} yr{check.renewal_period_years > 1 ? 's' : ''}</td>
                    <td>{formatDate(check.calculated_expiry_date)}</td>
                    <td>
                      {check.update_service_registered ? (
                        <div className="update-service-info">
                          <span className="update-service-badge">Yes</span>
                          {check.next_update_check && (
                            <small className={isUpdateDue(check) ? 'due-warning' : ''}>
                              Next: {formatDate(check.next_update_check)}
                            </small>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(check.status)}`}>
                        {check.status.replace('_', ' ')}
                      </span>
                    </td>
                    {isHR && (
                      <td className="actions-cell">
                        <button
                          className="btn-small"
                          onClick={() => handleEdit(check)}
                        >
                          Edit
                        </button>
                        {check.update_service_registered && (
                          <button
                            className="btn-small btn-update-check"
                            onClick={() => setShowUpdateCheck(check)}
                          >
                            Record Check
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DBSCheckManager;
