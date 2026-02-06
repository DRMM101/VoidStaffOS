/**
 * HeadOfficeOS - Medical Info
 * Employee medical information management.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const bloodTypes = [
  { value: 'unknown', label: 'Unknown / Prefer not to say' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' }
];

function MedicalInfo({ user }) {
  const [medicalInfo, setMedicalInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    allergies: '',
    medical_conditions: '',
    medications: '',
    blood_type: 'unknown',
    gp_name: '',
    gp_practice_name: '',
    gp_phone: '',
    gp_address: '',
    hr_only_notes: '',
    additional_notes: ''
  });

  useEffect(() => {
    fetchMedicalInfo();
  }, []);

  const fetchMedicalInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/emergency/medical', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setMedicalInfo(data);
          setFormData({
            allergies: data.allergies || '',
            medical_conditions: data.medical_conditions || '',
            medications: data.medications || '',
            blood_type: data.blood_type || 'unknown',
            gp_name: data.gp_name || '',
            gp_practice_name: data.gp_practice_name || '',
            gp_phone: data.gp_phone || '',
            gp_address: data.gp_address || '',
            hr_only_notes: data.hr_only_notes || '',
            additional_notes: data.additional_notes || ''
          });
        }
      }
    } catch (err) {
      console.error('Error fetching medical info:', err);
      setError('Failed to load medical information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const response = await apiFetch('/api/emergency/medical', {
        method: 'PUT',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        setMedicalInfo(data);
        setSuccess('Medical information saved successfully');
        setIsEditing(false);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to save medical information');
      }
    } catch (err) {
      console.error('Error saving medical info:', err);
      setError('Failed to save medical information');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (medicalInfo) {
      setFormData({
        allergies: medicalInfo.allergies || '',
        medical_conditions: medicalInfo.medical_conditions || '',
        medications: medicalInfo.medications || '',
        blood_type: medicalInfo.blood_type || 'unknown',
        gp_name: medicalInfo.gp_name || '',
        gp_practice_name: medicalInfo.gp_practice_name || '',
        gp_phone: medicalInfo.gp_phone || '',
        gp_address: medicalInfo.gp_address || '',
        hr_only_notes: medicalInfo.hr_only_notes || '',
        additional_notes: medicalInfo.additional_notes || ''
      });
    }
    setIsEditing(false);
    setError(null);
  };

  if (loading) {
    return <div className="loading">Loading medical information...</div>;
  }

  return (
    <div className="medical-info">
      <div className="medical-header">
        <div>
          <h2>Medical Information</h2>
          <p className="medical-subtitle">
            This information is kept confidential and only shared in emergencies.
          </p>
        </div>
        {!isEditing && (
          <button className="btn-primary" onClick={() => setIsEditing(true)}>
            {medicalInfo ? 'Edit Information' : 'Add Information'}
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="medical-form">
          <div className="form-section">
            <h3>Medical Details</h3>

            <div className="form-group">
              <label>Allergies</label>
              <textarea
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                rows="3"
                placeholder="List any allergies (food, medication, environmental, etc.)"
              />
            </div>

            <div className="form-group">
              <label>Medical Conditions</label>
              <textarea
                value={formData.medical_conditions}
                onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
                rows="3"
                placeholder="List any medical conditions we should be aware of"
              />
            </div>

            <div className="form-group">
              <label>Current Medications</label>
              <textarea
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                rows="3"
                placeholder="List any medications you take regularly"
              />
            </div>

            <div className="form-group">
              <label>Blood Type</label>
              <select
                value={formData.blood_type}
                onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
              >
                {bloodTypes.map(bt => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>GP Details (Optional)</h3>

            <div className="form-row">
              <div className="form-group">
                <label>GP Name</label>
                <input
                  type="text"
                  value={formData.gp_name}
                  onChange={(e) => setFormData({ ...formData, gp_name: e.target.value })}
                  placeholder="Dr. Smith"
                />
              </div>
              <div className="form-group">
                <label>Practice Name</label>
                <input
                  type="text"
                  value={formData.gp_practice_name}
                  onChange={(e) => setFormData({ ...formData, gp_practice_name: e.target.value })}
                  placeholder="Example Medical Centre"
                />
              </div>
            </div>

            <div className="form-group">
              <label>GP Phone</label>
              <input
                type="tel"
                value={formData.gp_phone}
                onChange={(e) => setFormData({ ...formData, gp_phone: e.target.value })}
                placeholder="Practice phone number"
              />
            </div>

            <div className="form-group">
              <label>GP Address</label>
              <textarea
                value={formData.gp_address}
                onChange={(e) => setFormData({ ...formData, gp_address: e.target.value })}
                rows="2"
                placeholder="Practice address"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Additional Notes</h3>

            <div className="form-group">
              <label>Additional Notes</label>
              <textarea
                value={formData.additional_notes}
                onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                rows="3"
                placeholder="Any other information emergency responders should know"
              />
            </div>

            <div className="form-group">
              <label>HR-Only Notes</label>
              <textarea
                value={formData.hr_only_notes}
                onChange={(e) => setFormData({ ...formData, hr_only_notes: e.target.value })}
                rows="3"
                placeholder="Sensitive information visible only to HR"
              />
              <p className="setting-help">
                This information is only visible to HR staff and will not be shown to managers.
              </p>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Medical Information'}
            </button>
          </div>
        </form>
      ) : (
        <div className="medical-display">
          {!medicalInfo ? (
            <div className="no-data-message">
              <p>No medical information on file.</p>
              <p className="help-text">
                Adding your medical information helps ensure you receive appropriate care in an emergency.
              </p>
            </div>
          ) : (
            <div className="medical-sections">
              <div className="medical-section">
                <h3>Medical Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Allergies:</span>
                    <span className="info-value">{medicalInfo.allergies || 'None specified'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Medical Conditions:</span>
                    <span className="info-value">{medicalInfo.medical_conditions || 'None specified'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Medications:</span>
                    <span className="info-value">{medicalInfo.medications || 'None specified'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Blood Type:</span>
                    <span className="info-value">
                      {medicalInfo.blood_type === 'unknown' ? 'Not specified' : medicalInfo.blood_type}
                    </span>
                  </div>
                </div>
              </div>

              {(medicalInfo.gp_name || medicalInfo.gp_practice_name) && (
                <div className="medical-section">
                  <h3>GP Details</h3>
                  <div className="info-grid">
                    {medicalInfo.gp_name && (
                      <div className="info-item">
                        <span className="info-label">GP Name:</span>
                        <span className="info-value">{medicalInfo.gp_name}</span>
                      </div>
                    )}
                    {medicalInfo.gp_practice_name && (
                      <div className="info-item">
                        <span className="info-label">Practice:</span>
                        <span className="info-value">{medicalInfo.gp_practice_name}</span>
                      </div>
                    )}
                    {medicalInfo.gp_phone && (
                      <div className="info-item">
                        <span className="info-label">Phone:</span>
                        <span className="info-value">{medicalInfo.gp_phone}</span>
                      </div>
                    )}
                    {medicalInfo.gp_address && (
                      <div className="info-item">
                        <span className="info-label">Address:</span>
                        <span className="info-value">{medicalInfo.gp_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {medicalInfo.additional_notes && (
                <div className="medical-section">
                  <h3>Additional Notes</h3>
                  <p>{medicalInfo.additional_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MedicalInfo;
