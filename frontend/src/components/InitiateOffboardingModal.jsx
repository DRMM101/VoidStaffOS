/**
 * HeadOfficeOS - Initiate Offboarding Modal
 * Form to start a new offboarding workflow.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: Offboarding
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function InitiateOffboardingModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [canClose, setCanClose] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    termination_type: 'resignation',
    notice_date: new Date().toISOString().split('T')[0],
    last_working_day: '',
    reason: '',
    eligible_for_rehire: null,
    reference_agreed: true
  });

  useEffect(() => {
    fetchEmployees();
    // Prevent immediate close from click event bubbling
    const timer = setTimeout(() => setCanClose(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await apiFetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }
      const data = await response.json();
      setEmployees(data.users || []);
    } catch (err) {
      console.error('Fetch employees error:', err);
      setError('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.employee_id) {
      setError('Please select an employee');
      setLoading(false);
      return;
    }

    if (!formData.last_working_day) {
      setError('Please specify the last working day');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        employee_id: parseInt(formData.employee_id),
        eligible_for_rehire: formData.eligible_for_rehire === 'true' ? true :
                            formData.eligible_for_rehire === 'false' ? false : null
      };

      const response = await apiFetch('/api/offboarding', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to initiate offboarding';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      onSuccess();
    } catch (err) {
      console.error('Initiate offboarding error:', err);
      setError(err.message || 'Failed to initiate offboarding');
    } finally {
      setLoading(false);
    }
  };

  const terminationTypes = [
    { value: 'resignation', label: 'Resignation' },
    { value: 'termination', label: 'Termination' },
    { value: 'redundancy', label: 'Redundancy' },
    { value: 'retirement', label: 'Retirement' },
    { value: 'end_of_contract', label: 'End of Contract' },
    { value: 'tupe_transfer', label: 'TUPE Transfer' },
    { value: 'death_in_service', label: 'Death in Service' }
  ];

  return (
    <div
      className="modal-overlay"
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
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: '#111' }}>Initiate Offboarding</h2>
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
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Employee Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#111', fontWeight: '500' }}>
              Employee *
            </label>
            {loadingEmployees ? (
              <div style={{ color: '#666', padding: '8px' }}>Loading employees...</div>
            ) : (
              <select
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  color: '#111',
                  background: '#fff'
                }}
              >
                <option value="">Select an employee...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Termination Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#111', fontWeight: '500' }}>
              Termination Type *
            </label>
            <select
              name="termination_type"
              value={formData.termination_type}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                color: '#111',
                background: '#fff'
              }}
            >
              {terminationTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notice Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#111', fontWeight: '500' }}>
              Notice Date *
            </label>
            <input
              type="date"
              name="notice_date"
              value={formData.notice_date}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                color: '#111',
                background: '#fff',
                boxSizing: 'border-box',
                colorScheme: 'light'
              }}
            />
          </div>

          {/* Last Working Day */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#111', fontWeight: '500' }}>
              Last Working Day *
            </label>
            <input
              type="date"
              name="last_working_day"
              value={formData.last_working_day}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                color: '#111',
                background: '#fff',
                boxSizing: 'border-box',
                colorScheme: 'light'
              }}
            />
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#111', fontWeight: '500' }}>
              Reason (Optional)
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description of the reason for leaving..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                color: '#111',
                background: '#fff',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Eligible for Rehire */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#111', fontWeight: '500' }}>
              Eligible for Rehire
            </label>
            <select
              name="eligible_for_rehire"
              value={formData.eligible_for_rehire === null ? '' : formData.eligible_for_rehire}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                color: '#111',
                background: '#fff'
              }}
            >
              <option value="">Not determined</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          {/* Reference Agreed */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="reference_agreed"
                checked={formData.reference_agreed}
                onChange={handleChange}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ color: '#111' }}>Reference agreed</span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                background: '#fff',
                color: '#111',
                cursor: 'pointer',
                fontSize: '14px'
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
                background: '#1976d2',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Initiating...' : 'Initiate Offboarding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InitiateOffboardingModal;
