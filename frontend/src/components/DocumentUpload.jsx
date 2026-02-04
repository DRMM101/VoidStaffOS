/**
 * VoidStaffOS - Document Upload Component
 * Drag & drop document upload with metadata.
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
 * Module: Document Storage
 */

import { useState, useRef, useCallback } from 'react';
import api from '../utils/api';

const CATEGORIES = [
  { value: 'cv', label: 'CV/Resume', hasExpiry: false },
  { value: 'certificate', label: 'Certificate', hasExpiry: true },
  { value: 'contract', label: 'Contract', hasExpiry: true },
  { value: 'reference', label: 'Reference', hasExpiry: false },
  { value: 'rtw', label: 'Right to Work', hasExpiry: true },
  { value: 'dbs', label: 'DBS Check', hasExpiry: true },
  { value: 'supervision', label: 'Supervision', hasExpiry: false },
  { value: 'responsibility_pack', label: 'Responsibility Pack', hasExpiry: false }
];

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function DocumentUpload({ user, employeeId, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    document_type: '',
    title: '',
    description: '',
    expiry_date: '',
    visible_to_employee: true,
    visible_to_manager: true
  });

  const fileInputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'File type not allowed. Allowed: PDF, images, Word, Excel';
    }
    if (file.size > MAX_SIZE) {
      return 'File size exceeds 20MB limit';
    }
    return null;
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(droppedFile);

      // Auto-fill title if empty
      if (!formData.title) {
        const nameWithoutExt = droppedFile.name.replace(/\.[^/.]+$/, '');
        setFormData(prev => ({ ...prev, title: nameWithoutExt }));
      }
    }
  }, [formData.title]);

  const handleFileSelect = (e) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);

      if (!formData.title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        setFormData(prev => ({ ...prev, title: nameWithoutExt }));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!formData.category) {
      setError('Please select a document category');
      return;
    }

    if (!formData.title.trim()) {
      setError('Please enter a document title');
      return;
    }

    setUploading(true);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('employee_id', employeeId || user.id);
      uploadData.append('category', formData.category);
      uploadData.append('title', formData.title.trim());

      if (formData.document_type) {
        uploadData.append('document_type', formData.document_type);
      }
      if (formData.description) {
        uploadData.append('description', formData.description);
      }
      if (formData.expiry_date) {
        uploadData.append('expiry_date', formData.expiry_date);
      }
      uploadData.append('visible_to_employee', formData.visible_to_employee);
      uploadData.append('visible_to_manager', formData.visible_to_manager);

      await api.upload('/documents/upload', uploadData);

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const selectedCategory = CATEGORIES.find(c => c.value === formData.category);

  return (
    <div className="document-upload">
      <div className="upload-header">
        <h3>Upload Document</h3>
        {onClose && (
          <button className="btn-close" onClick={onClose}>&times;</button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Drag & Drop Zone */}
        <div
          className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            style={{ display: 'none' }}
          />

          {file ? (
            <div className="file-preview">
              <span className="file-icon">&#128196;</span>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatFileSize(file.size)}</span>
              </div>
              <button
                type="button"
                className="btn-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                &times;
              </button>
            </div>
          ) : (
            <div className="drop-content">
              <span className="drop-icon">&#128206;</span>
              <p>Drag & drop a file here or click to browse</p>
              <span className="drop-hint">PDF, Word, Excel, or images (max 20MB)</span>
            </div>
          )}
        </div>

        {/* Category Selection */}
        <div className="form-group">
          <label>Category *</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            required
          >
            <option value="">Select category...</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Document Type (sub-category) */}
        <div className="form-group">
          <label>Document Type (optional)</label>
          <input
            type="text"
            name="document_type"
            value={formData.document_type}
            onChange={handleInputChange}
            placeholder="e.g., Enhanced DBS, Level 3 Certificate"
          />
        </div>

        {/* Title */}
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Document title"
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label>Description (optional)</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Additional notes or description"
            rows={3}
          />
        </div>

        {/* Expiry Date - only show for categories that expire */}
        {selectedCategory?.hasExpiry && (
          <div className="form-group">
            <label>Expiry Date</label>
            <input
              type="date"
              name="expiry_date"
              value={formData.expiry_date}
              onChange={handleInputChange}
            />
            <span className="form-hint">
              You'll receive notifications at 90, 60, and 30 days before expiry
            </span>
          </div>
        )}

        {/* Visibility Controls - only for HR */}
        {user.tier >= 60 && (
          <div className="visibility-controls">
            <h4>Visibility</h4>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="visible_to_employee"
                checked={formData.visible_to_employee}
                onChange={handleInputChange}
              />
              Visible to employee
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="visible_to_manager"
                checked={formData.visible_to_manager}
                onChange={handleInputChange}
              />
              Visible to manager
            </label>
            {formData.category === 'reference' && (
              <span className="form-hint">
                References are typically HR-only (not visible to employee or manager)
              </span>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="form-actions">
          {onClose && (
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </form>

      <style>{`
        .document-upload {
          background: #ffffff;
          border-radius: 12px;
          padding: 25px;
          max-width: 600px;
          margin: 0 auto;
        }

        .upload-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .upload-header h3 {
          margin: 0;
          color: #e0e0e0;
        }

        .btn-close {
          background: none;
          border: none;
          color: #808080;
          font-size: 1.5rem;
          cursor: pointer;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .drop-zone {
          border: 2px dashed #3a3a5a;
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 20px;
        }

        .drop-zone:hover,
        .drop-zone.active {
          border-color: #134e4a;
          background: rgba(19, 78, 74, 0.08);
        }

        .drop-zone.has-file {
          border-style: solid;
          border-color: #2cb67d;
          background: rgba(44, 182, 125, 0.1);
        }

        .drop-content {
          color: #808080;
        }

        .drop-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 10px;
        }

        .drop-hint {
          font-size: 0.85rem;
          color: #555;
        }

        .file-preview {
          display: flex;
          align-items: center;
          gap: 15px;
          text-align: left;
        }

        .file-icon {
          font-size: 2.5rem;
        }

        .file-info {
          flex: 1;
        }

        .file-name {
          display: block;
          color: #e0e0e0;
          font-weight: 500;
          word-break: break-all;
        }

        .file-size {
          color: #808080;
          font-size: 0.85rem;
        }

        .btn-remove {
          background: #ff6b6b;
          border: none;
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          line-height: 1;
        }

        .form-group {
          margin-bottom: 20px;
        }

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
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #134e4a;
        }

        .form-hint {
          display: block;
          margin-top: 6px;
          font-size: 0.8rem;
          color: #808080;
        }

        .visibility-controls {
          background: #f9f6f2;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .visibility-controls h4 {
          margin: 0 0 12px 0;
          color: #a0a0a0;
          font-size: 0.9rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #e0e0e0;
          margin-bottom: 8px;
          cursor: pointer;
        }

        .checkbox-label input {
          width: auto;
        }

        .form-actions {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
          margin-top: 25px;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #134e4a;
          color: #fff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0f3d38;
        }

        .btn-secondary {
          background: #e8e2d9;
          color: #e0e0e0;
        }

        .btn-secondary:hover {
          background: #3a3a5a;
        }
      `}</style>
    </div>
  );
}

export default DocumentUpload;
