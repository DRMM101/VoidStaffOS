/**
 * VoidStaffOS - Candidate Form Component
 * Form for creating and editing candidates.
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

function CandidateForm({ candidate, onClose, onSave }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    dob: '',
    proposed_start_date: '',
    proposed_role_id: '',
    proposed_tier: '',
    proposed_salary: '',
    proposed_hours: '40',
    skills_experience: '',
    notes: '',
    contract_signed: false,
    contract_signed_date: ''
  });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRoles();
    if (candidate) {
      setFormData({
        full_name: candidate.full_name || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        address_line1: candidate.address_line1 || '',
        address_line2: candidate.address_line2 || '',
        city: candidate.city || '',
        postcode: candidate.postcode || '',
        dob: candidate.dob ? candidate.dob.split('T')[0] : '',
        proposed_start_date: candidate.proposed_start_date ? candidate.proposed_start_date.split('T')[0] : '',
        proposed_role_id: candidate.proposed_role_id || '',
        proposed_tier: candidate.proposed_tier || '',
        proposed_salary: candidate.proposed_salary || '',
        proposed_hours: candidate.proposed_hours || '40',
        skills_experience: candidate.skills_experience || '',
        notes: candidate.notes || '',
        contract_signed: candidate.contract_signed || false,
        contract_signed_date: candidate.contract_signed_date ? candidate.contract_signed_date.split('T')[0] : ''
      });
    }
  }, [candidate]);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/users/roles', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Failed to fetch roles');
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

    try {
      const url = candidate
        ? `/api/onboarding/candidates/${candidate.id}`
        : '/api/onboarding/candidates';
      const method = candidate ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...formData,
          proposed_role_id: formData.proposed_role_id || null,
          proposed_tier: formData.proposed_tier || null,
          proposed_salary: formData.proposed_salary || null,
          contract_signed_date: formData.contract_signed ? formData.contract_signed_date || null : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save candidate');
      }

      onSave(data.candidate);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large candidate-form">
        <div className="modal-header">
          <h3>{candidate ? 'Edit Candidate' : 'New Candidate'}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h4>Personal Details</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="full_name">Full Name *</label>
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
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="dob">Date of Birth</label>
                <input
                  type="date"
                  id="dob"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="address_line1">Address Line 1</label>
                <input
                  type="text"
                  id="address_line1"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="address_line2">Address Line 2</label>
                <input
                  type="text"
                  id="address_line2"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">City</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="postcode">Postcode</label>
                <input
                  type="text"
                  id="postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Proposed Employment</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="proposed_role_id">Role</label>
                <select
                  id="proposed_role_id"
                  name="proposed_role_id"
                  value={formData.proposed_role_id}
                  onChange={handleChange}
                >
                  <option value="">Select role...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.role_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="proposed_tier">Tier</label>
                <select
                  id="proposed_tier"
                  name="proposed_tier"
                  value={formData.proposed_tier}
                  onChange={handleChange}
                >
                  <option value="">Select tier...</option>
                  <option value="1">Tier 1 (Executive)</option>
                  <option value="2">Tier 2 (Senior)</option>
                  <option value="3">Tier 3 (Mid-Level)</option>
                  <option value="4">Tier 4 (Junior)</option>
                  <option value="5">Tier 5 (Entry)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="proposed_salary">Annual Salary</label>
                <input
                  type="number"
                  id="proposed_salary"
                  name="proposed_salary"
                  value={formData.proposed_salary}
                  onChange={handleChange}
                  min="0"
                  step="100"
                />
              </div>
              <div className="form-group">
                <label htmlFor="proposed_hours">Weekly Hours</label>
                <input
                  type="number"
                  id="proposed_hours"
                  name="proposed_hours"
                  value={formData.proposed_hours}
                  onChange={handleChange}
                  min="0"
                  max="60"
                  step="0.5"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="proposed_start_date">Proposed Start Date</label>
                <input
                  type="date"
                  id="proposed_start_date"
                  name="proposed_start_date"
                  value={formData.proposed_start_date}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Contract Status</h4>
            <div className="form-row">
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="contract_signed"
                    checked={formData.contract_signed}
                    onChange={handleChange}
                  />
                  Contract Signed
                </label>
              </div>
              {formData.contract_signed && (
                <div className="form-group">
                  <label htmlFor="contract_signed_date">Signed Date</label>
                  <input
                    type="date"
                    id="contract_signed_date"
                    name="contract_signed_date"
                    value={formData.contract_signed_date}
                    onChange={handleChange}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h4>Additional Information</h4>
            <div className="form-group">
              <label htmlFor="skills_experience">Skills & Experience</label>
              <textarea
                id="skills_experience"
                name="skills_experience"
                value={formData.skills_experience}
                onChange={handleChange}
                rows="4"
                placeholder="Relevant skills, qualifications, and experience..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Internal notes about this candidate..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Saving...' : (candidate ? 'Update Candidate' : 'Create Candidate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CandidateForm;
