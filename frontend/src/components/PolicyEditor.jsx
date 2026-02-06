/**
 * HeadOfficeOS - Policy Editor Component
 * Create and edit policies with rich text support.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: PolicyOS
 */

import { useState, useEffect, useRef } from 'react';
import api, { apiFetch, getCSRFToken } from '../utils/api';

const CATEGORIES = ['HR', 'Health & Safety', 'Safeguarding', 'Compliance', 'IT', 'Operational'];
const FREQUENCIES = [
  { value: 'once', label: 'Once (one-time acknowledgment)' },
  { value: 'annual', label: 'Annual (yearly re-acknowledgment)' },
  { value: 'biannual', label: 'Biannual (every 6 months)' },
  { value: 'quarterly', label: 'Quarterly (every 3 months)' }
];

const ASSIGNMENT_TYPES = [
  { value: 'all', label: 'All Employees' },
  { value: 'role', label: 'Specific Role' },
  { value: 'tier_min', label: 'Minimum Tier' },
  { value: 'tier_max', label: 'Maximum Tier' },
  { value: 'department', label: 'Department' }
];

function PolicyEditor({ policy, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'HR',
    summary: '',
    content: '',
    requires_acknowledgment: true,
    acknowledgment_frequency: 'once',
    acknowledgment_deadline_days: '',
    assignments: [{ type: 'all', value: '' }]
  });

  const [pdfFile, setPdfFile] = useState(null);
  const [existingPdf, setExistingPdf] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (policy) {
      setFormData({
        title: policy.title || '',
        category: policy.category || 'HR',
        summary: policy.summary || '',
        content: policy.content || '',
        requires_acknowledgment: policy.requires_acknowledgment ?? true,
        acknowledgment_frequency: policy.acknowledgment_frequency || 'once',
        acknowledgment_deadline_days: policy.acknowledgment_deadline_days || '',
        assignments: policy.assignments?.length > 0
          ? policy.assignments.map(a => ({ type: a.assignment_type, value: a.assignment_value || '' }))
          : [{ type: 'all', value: '' }]
      });

      if (policy.pdf_filename) {
        setExistingPdf({
          filename: policy.pdf_filename,
          original_name: policy.pdf_original_name,
          size: policy.pdf_size
        });
      }
    }
  }, [policy]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAssignmentChange = (index, field, value) => {
    setFormData(prev => {
      const newAssignments = [...prev.assignments];
      newAssignments[index] = { ...newAssignments[index], [field]: value };
      // Clear value when type changes to 'all'
      if (field === 'type' && value === 'all') {
        newAssignments[index].value = '';
      }
      return { ...prev, assignments: newAssignments };
    });
  };

  const addAssignment = () => {
    setFormData(prev => ({
      ...prev,
      assignments: [...prev.assignments, { type: 'role', value: '' }]
    }));
  };

  const removeAssignment = (index) => {
    if (formData.assignments.length === 1) return;
    setFormData(prev => ({
      ...prev,
      assignments: prev.assignments.filter((_, i) => i !== index)
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit');
        return;
      }
      setPdfFile(file);
      setError(null);
    }
  };

  const handleRemovePdf = async () => {
    if (existingPdf && policy) {
      if (!confirm('Remove the attached PDF?')) return;

      try {
        await api.delete(`/policies/${policy.id}/pdf`);
        setExistingPdf(null);
      } catch (err) {
        setError('Failed to remove PDF: ' + err.message);
      }
    } else {
      setPdfFile(null);
    }
  };

  const uploadPdf = async (policyId) => {
    if (!pdfFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);

      const response = await apiFetch(`/api/policies/${policyId}/upload-pdf`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': getCSRFToken()
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }
    } catch (err) {
      throw new Error('PDF upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Validate
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.content.trim()) {
        throw new Error('Content is required');
      }

      // Prepare data
      const submitData = {
        ...formData,
        acknowledgment_deadline_days: formData.acknowledgment_deadline_days
          ? parseInt(formData.acknowledgment_deadline_days)
          : null,
        assignments: formData.assignments.map(a => ({
          type: a.type,
          value: a.type === 'all' ? null : a.value
        }))
      };

      let savedPolicy;

      if (policy) {
        // Update existing
        const response = await api.put(`/policies/${policy.id}`, submitData);
        savedPolicy = response.policy;
      } else {
        // Create new
        const response = await api.post('/policies', submitData);
        savedPolicy = response.policy;
      }

      // Upload PDF if selected
      if (pdfFile && savedPolicy) {
        await uploadPdf(savedPolicy.id);
      }

      onSave(savedPolicy);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="policy-editor">
      <div className="editor-header">
        <h2>{policy ? 'Edit Policy' : 'Create New Policy'}</h2>
        <button className="btn-close" onClick={onCancel}>&times;</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group flex-2">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Policy title"
              required
            />
          </div>

          <div className="form-group flex-1">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="summary">Summary</label>
          <textarea
            id="summary"
            name="summary"
            value={formData.summary}
            onChange={handleChange}
            placeholder="Brief description for policy listings"
            rows={2}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content *</label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            placeholder="Full policy content (supports Markdown)"
            rows={15}
            required
          />
          <span className="help-text">Supports Markdown formatting</span>
        </div>

        <div className="form-section">
          <h3>PDF Attachment</h3>
          <div className="pdf-upload-area">
            {existingPdf ? (
              <div className="existing-pdf">
                <span className="pdf-icon">&#128196;</span>
                <span className="pdf-name">{existingPdf.original_name}</span>
                <span className="pdf-size">({formatFileSize(existingPdf.size)})</span>
                <button type="button" className="btn-remove" onClick={handleRemovePdf}>
                  Remove
                </button>
              </div>
            ) : pdfFile ? (
              <div className="selected-pdf">
                <span className="pdf-icon">&#128196;</span>
                <span className="pdf-name">{pdfFile.name}</span>
                <span className="pdf-size">({formatFileSize(pdfFile.size)})</span>
                <button type="button" className="btn-remove" onClick={handleRemovePdf}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="upload-prompt" onClick={() => fileInputRef.current?.click()}>
                <span className="upload-icon">&#128206;</span>
                <span>Click to upload PDF (max 10MB)</span>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Acknowledgment Settings</h3>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="requires_acknowledgment"
                checked={formData.requires_acknowledgment}
                onChange={handleChange}
              />
              Requires acknowledgment
            </label>
          </div>

          {formData.requires_acknowledgment && (
            <>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="acknowledgment_frequency">Frequency</label>
                  <select
                    id="acknowledgment_frequency"
                    name="acknowledgment_frequency"
                    value={formData.acknowledgment_frequency}
                    onChange={handleChange}
                  >
                    {FREQUENCIES.map(freq => (
                      <option key={freq.value} value={freq.value}>{freq.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="acknowledgment_deadline_days">Deadline (days)</label>
                  <input
                    type="number"
                    id="acknowledgment_deadline_days"
                    name="acknowledgment_deadline_days"
                    value={formData.acknowledgment_deadline_days}
                    onChange={handleChange}
                    placeholder="Optional"
                    min="1"
                    max="365"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="form-section">
          <h3>Assign To</h3>
          {formData.assignments.map((assignment, index) => (
            <div key={index} className="assignment-row">
              <select
                value={assignment.type}
                onChange={(e) => handleAssignmentChange(index, 'type', e.target.value)}
              >
                {ASSIGNMENT_TYPES.map(at => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>

              {assignment.type !== 'all' && (
                <input
                  type={assignment.type.startsWith('tier') ? 'number' : 'text'}
                  value={assignment.value}
                  onChange={(e) => handleAssignmentChange(index, 'value', e.target.value)}
                  placeholder={
                    assignment.type === 'role' ? 'e.g., Manager' :
                    assignment.type === 'department' ? 'e.g., Engineering' :
                    assignment.type === 'tier_min' ? 'Min tier (10-100)' :
                    'Max tier (10-100)'
                  }
                />
              )}

              {formData.assignments.length > 1 && (
                <button
                  type="button"
                  className="btn-remove-assignment"
                  onClick={() => removeAssignment(index)}
                >
                  &times;
                </button>
              )}
            </div>
          ))}

          <button type="button" className="btn-add-assignment" onClick={addAssignment}>
            + Add Assignment Rule
          </button>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
            {saving || uploading ? 'Saving...' : (policy ? 'Update Policy' : 'Create Policy')}
          </button>
        </div>
      </form>

      <style>{`
        .policy-editor {
          background: #ffffff;
          border-radius: 12px;
          max-width: 900px;
          margin: 0 auto;
          max-height: 90vh;
          overflow-y: auto;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 25px;
          border-bottom: 1px solid #e8e2d9;
          position: sticky;
          top: 0;
          background: #ffffff;
          z-index: 10;
        }

        .editor-header h2 {
          margin: 0;
          color: #e0e0e0;
        }

        .btn-close {
          background: none;
          border: none;
          color: #5c6b63;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 5px 10px;
        }

        .btn-close:hover {
          color: #e0e0e0;
        }

        form {
          padding: 25px;
        }

        .form-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e8e2d9;
        }

        .form-section h3 {
          color: #e0e0e0;
          margin: 0 0 15px 0;
          font-size: 1.1rem;
        }

        .form-row {
          display: flex;
          gap: 20px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .flex-1 { flex: 1; }
        .flex-2 { flex: 2; }

        .form-group label {
          display: block;
          color: #a0a0a0;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 12px 15px;
          background: #f9f6f2;
          border: 1px solid #e8e2d9;
          border-radius: 8px;
          color: #e0e0e0;
          font-size: 0.95rem;
          font-family: inherit;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 100px;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #134e4a;
        }

        .help-text {
          display: block;
          color: #5c6b63;
          font-size: 0.8rem;
          margin-top: 5px;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          color: #e0e0e0;
        }

        .checkbox-group input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .assignment-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }

        .assignment-row select {
          flex: 1;
          padding: 10px 12px;
          background: #f9f6f2;
          border: 1px solid #e8e2d9;
          border-radius: 8px;
          color: #e0e0e0;
        }

        .assignment-row input {
          flex: 1;
          padding: 10px 12px;
          background: #f9f6f2;
          border: 1px solid #e8e2d9;
          border-radius: 8px;
          color: #e0e0e0;
        }

        .btn-remove-assignment {
          background: #e8e2d9;
          border: none;
          color: #ff6b6b;
          width: 36px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.2rem;
        }

        .btn-add-assignment {
          background: none;
          border: 1px dashed #e8e2d9;
          color: #134e4a;
          padding: 10px 15px;
          border-radius: 8px;
          cursor: pointer;
          width: 100%;
          margin-top: 10px;
        }

        .btn-add-assignment:hover {
          border-color: #134e4a;
          background: rgba(19, 78, 74, 0.08);
        }

        .pdf-upload-area {
          background: #f9f6f2;
          border: 2px dashed #e8e2d9;
          border-radius: 8px;
          padding: 20px;
        }

        .upload-prompt {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          color: #5c6b63;
        }

        .upload-prompt:hover {
          color: #134e4a;
        }

        .upload-icon {
          font-size: 2rem;
        }

        .existing-pdf,
        .selected-pdf {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pdf-icon {
          font-size: 1.5rem;
        }

        .pdf-name {
          color: #e0e0e0;
          flex: 1;
        }

        .pdf-size {
          color: #5c6b63;
          font-size: 0.9rem;
        }

        .btn-remove {
          background: #e8e2d9;
          border: none;
          color: #ff6b6b;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-remove:hover {
          background: #ff6b6b;
          color: #fff;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e8e2d9;
        }

        .btn {
          padding: 12px 25px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #134e4a;
          color: #fff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0f3d38;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #e8e2d9;
          color: #e0e0e0;
        }

        .btn-secondary:hover {
          background: #3a3a5a;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          padding: 15px 25px;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default PolicyEditor;
