/**
 * VoidStaffOS - RTW Check Manager
 * Right to Work verification management.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function RTWCheckManager({ user, onRefresh }) {
  const [checks, setChecks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCheck, setEditingCheck] = useState(null);
  const [filter, setFilter] = useState({ employee_id: '', status: '' });

  const isHR = user && (user.role_name === 'Admin' || user.role_name === 'HR Manager');

  const checkTypes = [
    { value: 'passport_uk', label: 'UK Passport' },
    { value: 'passport_foreign', label: 'Foreign Passport' },
    { value: 'visa', label: 'Visa' },
    { value: 'share_code', label: 'Share Code' },
    { value: 'brp', label: 'BRP (Biometric Residence Permit)' },
    { value: 'euss', label: 'EUSS (EU Settlement Scheme)' },
    { value: 'other', label: 'Other' }
  ];

  const statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'verified', label: 'Verified' },
    { value: 'expired', label: 'Expired' },
    { value: 'action_required', label: 'Action Required' }
  ];

  const [formData, setFormData] = useState({
    employee_id: '',
    check_type: 'passport_uk',
    document_reference: '',
    immigration_status: '',
    check_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    followup_date: '',
    verification_method: '',
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

      const response = await fetch(`/api/compliance/rtw?${params}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setChecks(data);
      }
    } catch (error) {
      console.error('Error fetching RTW checks:', error);
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
        ? `/api/compliance/rtw/${editingCheck.id}`
        : '/api/compliance/rtw';
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
        alert(error.error || 'Failed to save RTW check');
      }
    } catch (error) {
      console.error('Error saving RTW check:', error);
      alert('Failed to save RTW check');
    }
  };

  const handleEdit = (check) => {
    setEditingCheck(check);
    setFormData({
      employee_id: check.employee_id,
      check_type: check.check_type,
      document_reference: check.document_reference || '',
      immigration_status: check.immigration_status || '',
      check_date: check.check_date?.split('T')[0] || '',
      expiry_date: check.expiry_date?.split('T')[0] || '',
      followup_date: check.followup_date?.split('T')[0] || '',
      verification_method: check.verification_method || '',
      status: check.status,
      notes: check.notes || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      check_type: 'passport_uk',
      document_reference: '',
      immigration_status: '',
      check_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      followup_date: '',
      verification_method: '',
      notes: ''
    });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'verified': return 'status-compliant';
      case 'pending': return 'status-warning';
      case 'expired': return 'status-danger';
      case 'action_required': return 'status-danger';
      default: return '';
    }
  };

  return (
    <div className="rtw-manager">
      <div className="manager-header">
        <h2>Right to Work Checks</h2>
        {isHR && (
          <button
            className="btn-primary"
            onClick={() => {
              setEditingCheck(null);
              resetForm();
              setShowForm(true);
            }}
          >
            + New RTW Check
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
          <div className="modal rtw-form-modal">
            <h3>{editingCheck ? 'Edit RTW Check' : 'New RTW Check'}</h3>
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
                  <label>Check Type *</label>
                  <select
                    value={formData.check_type}
                    onChange={(e) => setFormData({ ...formData, check_type: e.target.value })}
                    required
                  >
                    {checkTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Document Reference</label>
                  <input
                    type="text"
                    value={formData.document_reference}
                    onChange={(e) => setFormData({ ...formData, document_reference: e.target.value })}
                    placeholder="e.g., Passport number"
                  />
                </div>
                <div className="form-group">
                  <label>Immigration Status</label>
                  <input
                    type="text"
                    value={formData.immigration_status}
                    onChange={(e) => setFormData({ ...formData, immigration_status: e.target.value })}
                    placeholder="e.g., Indefinite Leave to Remain"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Check Date *</label>
                  <input
                    type="date"
                    value={formData.check_date}
                    onChange={(e) => setFormData({ ...formData, check_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Follow-up Date</label>
                  <input
                    type="date"
                    value={formData.followup_date}
                    onChange={(e) => setFormData({ ...formData, followup_date: e.target.value })}
                  />
                  <small>For time-limited RTW requiring repeat verification</small>
                </div>
                <div className="form-group">
                  <label>Verification Method</label>
                  <select
                    value={formData.verification_method}
                    onChange={(e) => setFormData({ ...formData, verification_method: e.target.value })}
                  >
                    <option value="">Select Method</option>
                    <option value="online_check">Online Check</option>
                    <option value="manual_document">Manual Document Check</option>
                    <option value="employer_checking_service">Employer Checking Service</option>
                  </select>
                </div>
              </div>

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
                  {editingCheck ? 'Update' : 'Create'} RTW Check
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading RTW checks...</div>
      ) : (
        <div className="rtw-table-container">
          <table className="rtw-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Check Type</th>
                <th>Document Ref</th>
                <th>Check Date</th>
                <th>Expiry</th>
                <th>Follow-up</th>
                <th>Status</th>
                <th>Checked By</th>
                {isHR && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={isHR ? "9" : "8"} className="no-data">
                    No RTW checks found
                  </td>
                </tr>
              ) : (
                checks.map(check => (
                  <tr key={check.id}>
                    <td>
                      <div>{check.employee_name}</div>
                      <small className="employee-number">{check.employee_number}</small>
                    </td>
                    <td>{checkTypes.find(t => t.value === check.check_type)?.label || check.check_type}</td>
                    <td>{check.document_reference || '-'}</td>
                    <td>{formatDate(check.check_date)}</td>
                    <td>{formatDate(check.expiry_date)}</td>
                    <td>{formatDate(check.followup_date)}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(check.status)}`}>
                        {check.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{check.checked_by_name}</td>
                    {isHR && (
                      <td>
                        <button
                          className="btn-small"
                          onClick={() => handleEdit(check)}
                        >
                          Edit
                        </button>
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

export default RTWCheckManager;
