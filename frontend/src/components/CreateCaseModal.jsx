/**
 * VoidStaffOS - Create Case Modal
 * Form to create new PIP, Disciplinary, or Grievance cases.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: HR Cases
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function CreateCaseModal({ user, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [canClose, setCanClose] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    case_type: 'pip',
    summary: '',
    background: '',
    target_close_date: '',
    case_owner_id: user.id
  });

  useEffect(() => {
    fetchEmployees();
    fetchHRUsers();
    const timer = setTimeout(() => setCanClose(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await apiFetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.users || data || []);
      }
    } catch (err) {
      console.error('Fetch employees error:', err);
    }
  };

  const fetchHRUsers = async () => {
    try {
      const response = await apiFetch('/api/users?role=Admin');
      if (response.ok) {
        const data = await response.json();
        setHrUsers(data.users || data || []);
      }
    } catch (err) {
      console.error('Fetch HR users error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/hr-cases', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create case');
      }

      onSuccess();
    } catch (err) {
      console.error('Create case error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && canClose) {
      onClose();
    }
  };

  const getCaseTypeGuidance = () => {
    switch (formData.case_type) {
      case 'pip':
        return 'A PIP should be used when an employee is underperforming but has the potential to improve. Set clear SMART objectives and provide appropriate support.';
      case 'disciplinary':
        return 'Disciplinary action is appropriate when there has been misconduct. Always investigate fully before starting formal proceedings. Follow the ACAS Code of Practice.';
      case 'grievance':
        return 'A grievance is a formal complaint raised by an employee about their workplace. This should be handled confidentially and investigated thoroughly.';
      default:
        return '';
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    color: '#111',
    background: '#fff',
    colorScheme: 'light'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '500',
    color: '#424242',
    fontSize: '14px'
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, color: '#111' }}>Create New Case</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            &times;
          </button>
        </div>

        {error && (
          <div style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Case Type */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Case Type *</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { value: 'pip', label: 'PIP', color: '#ff9800' },
                { value: 'disciplinary', label: 'Disciplinary', color: '#f44336' },
                { value: 'grievance', label: 'Grievance', color: '#9c27b0' }
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, case_type: type.value }))}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: formData.case_type === type.value ? `2px solid ${type.color}` : '2px solid #e0e0e0',
                    background: formData.case_type === type.value ? type.color + '20' : '#fff',
                    color: formData.case_type === type.value ? type.color : '#666',
                    cursor: 'pointer',
                    fontWeight: formData.case_type === type.value ? '600' : '400',
                    transition: 'all 0.2s'
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Guidance Box */}
          <div style={{
            background: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0, color: '#424242', fontSize: '14px' }}>
              {getCaseTypeGuidance()}
            </p>
          </div>

          {/* Employee Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Employee *</label>
            <select
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              required
              style={inputStyle}
            >
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          {/* Case Owner */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Case Owner</label>
            <select
              name="case_owner_id"
              value={formData.case_owner_id}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value={user.id}>{user.full_name} (You)</option>
              {hrUsers.filter(u => u.id !== user.id).map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>
              {formData.case_type === 'pip' ? 'Performance Concerns' :
               formData.case_type === 'disciplinary' ? 'Allegations / Issues' :
               'Grievance Summary'} *
            </label>
            <textarea
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              required
              rows={3}
              placeholder={
                formData.case_type === 'pip' ? 'Describe the performance concerns that have led to this PIP...' :
                formData.case_type === 'disciplinary' ? 'State the allegations or issues being investigated...' :
                'Brief summary of the grievance...'
              }
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Background */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Background / Context</label>
            <textarea
              name="background"
              value={formData.background}
              onChange={handleChange}
              rows={3}
              placeholder="Any relevant background information, previous discussions, or context..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Target Close Date */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Target Completion Date</label>
            <input
              type="date"
              name="target_close_date"
              value={formData.target_close_date}
              onChange={handleChange}
              style={inputStyle}
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>
              {formData.case_type === 'pip' ? 'Typical PIP duration is 30-90 days' :
               'Estimated date for case resolution'}
            </p>
          </div>

          {/* Confidentiality Notice */}
          <div style={{
            background: '#fff3e0',
            border: '1px solid #ffb74d',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px'
          }}>
            <p style={{ margin: 0, color: '#424242', fontSize: '13px' }}>
              <strong>Confidential:</strong> This case will be marked as confidential by default.
              Access is restricted to HR, the case owner, and the employee's manager.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                background: '#fff',
                color: '#424242',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? '#bdbdbd' : '#c2185b',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {loading ? 'Creating...' : 'Create Case (Draft)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateCaseModal;
