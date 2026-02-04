/**
 * VoidStaffOS - Document List Component
 * Employee's document list with filtering and download.
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

import { useState, useEffect } from 'react';
import api from '../utils/api';

const CATEGORIES = [
  { value: 'cv', label: 'CV/Resume' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'contract', label: 'Contract' },
  { value: 'reference', label: 'Reference' },
  { value: 'rtw', label: 'Right to Work' },
  { value: 'dbs', label: 'DBS Check' },
  { value: 'supervision', label: 'Supervision' },
  { value: 'responsibility_pack', label: 'Responsibility Pack' }
];

const CATEGORY_COLORS = {
  cv: '#134e4a',
  certificate: '#2cb67d',
  contract: '#4ecdc4',
  reference: '#f7b731',
  rtw: '#ff6b6b',
  dbs: '#ff6b6b',
  supervision: '#45b7d1',
  responsibility_pack: '#a855f7'
};

const STATUS_COLORS = {
  active: '#2cb67d',
  expired: '#ff6b6b',
  archived: '#808080'
};

function DocumentList({ user, employeeId, onUpload, isManager = false }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [employeeId, filterCategory, filterStatus]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      let endpoint = '/documents';
      const params = [];

      if (employeeId) params.push(`employee_id=${employeeId}`);
      if (filterCategory) params.push(`category=${filterCategory}`);
      if (filterStatus) params.push(`status=${filterStatus}`);

      if (params.length > 0) {
        endpoint += '?' + params.join('&');
      }

      const data = await api.get(endpoint);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert('Failed to download: ' + err.message);
    }
  };

  const handlePreview = async (doc) => {
    // Open in new tab for preview
    window.open(`/api/documents/${doc.id}/download?preview=true`, '_blank');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getCategoryLabel = (value) => {
    const cat = CATEGORIES.find(c => c.value === value);
    return cat ? cat.label : value;
  };

  const isExpiringSoon = (doc) => {
    if (!doc.expiry_date || doc.status !== 'active') return false;
    const daysUntil = Math.ceil((new Date(doc.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30 && daysUntil >= 0;
  };

  const isExpired = (doc) => {
    if (!doc.expiry_date) return false;
    return new Date(doc.expiry_date) < new Date();
  };

  if (loading && documents.length === 0) {
    return <div className="loading">Loading documents...</div>;
  }

  return (
    <div className="document-list">
      <div className="list-header">
        <h3>{isManager ? 'Employee Documents' : 'My Documents'}</h3>
        {onUpload && (
          <button className="btn btn-primary" onClick={onUpload}>
            + Upload Document
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <h4>No documents found</h4>
          <p>Upload your first document to get started.</p>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map(doc => (
            <div
              key={doc.id}
              className={`document-card ${doc.status} ${isExpiringSoon(doc) ? 'expiring' : ''}`}
            >
              <div className="doc-header">
                <span
                  className="category-badge"
                  style={{ backgroundColor: CATEGORY_COLORS[doc.category] }}
                >
                  {getCategoryLabel(doc.category)}
                </span>
                <span
                  className="status-badge"
                  style={{ backgroundColor: STATUS_COLORS[doc.status] }}
                >
                  {doc.status}
                </span>
              </div>

              <h4 className="doc-title">{doc.title}</h4>

              {doc.description && (
                <p className="doc-description">{doc.description}</p>
              )}

              <div className="doc-meta">
                <div className="meta-row">
                  <span className="meta-label">File:</span>
                  <span className="meta-value">{doc.original_filename}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Size:</span>
                  <span className="meta-value">{formatFileSize(doc.file_size)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Uploaded:</span>
                  <span className="meta-value">{formatDate(doc.created_at)}</span>
                </div>
                {doc.expiry_date && (
                  <div className={`meta-row ${isExpired(doc) ? 'expired' : isExpiringSoon(doc) ? 'warning' : ''}`}>
                    <span className="meta-label">Expires:</span>
                    <span className="meta-value">
                      {formatDate(doc.expiry_date)}
                      {isExpired(doc) && <span className="expired-tag">EXPIRED</span>}
                      {isExpiringSoon(doc) && !isExpired(doc) && <span className="warning-tag">SOON</span>}
                    </span>
                  </div>
                )}
              </div>

              <div className="doc-actions">
                {doc.mime_type === 'application/pdf' && (
                  <button
                    className="btn-icon"
                    onClick={() => handlePreview(doc)}
                    title="Preview"
                  >
                    &#128065;
                  </button>
                )}
                <button
                  className="btn-icon"
                  onClick={() => handleDownload(doc)}
                  title="Download"
                >
                  &#8595;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .document-list {
          padding: 20px;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .list-header h3 {
          margin: 0;
          color: #e0e0e0;
        }

        .btn {
          padding: 10px 20px;
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

        .btn-primary:hover {
          background: #0f3d38;
        }

        .filters {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }

        .filter-select {
          padding: 10px 15px;
          background: #ffffff;
          border: 1px solid #e8e2d9;
          border-radius: 8px;
          color: #e0e0e0;
          font-size: 0.95rem;
          min-width: 150px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: #ffffff;
          border-radius: 12px;
        }

        .empty-state h4 {
          color: #e0e0e0;
          margin-bottom: 10px;
        }

        .empty-state p {
          color: #808080;
        }

        .documents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .document-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e8e2d9;
          transition: all 0.2s;
        }

        .document-card:hover {
          border-color: #134e4a;
        }

        .document-card.expired {
          border-color: #ff6b6b;
          opacity: 0.8;
        }

        .document-card.expiring {
          border-color: #f7b731;
        }

        .document-card.archived {
          opacity: 0.6;
        }

        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .category-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #fff;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 0.7rem;
          font-weight: 600;
          color: #fff;
          text-transform: uppercase;
        }

        .doc-title {
          margin: 0 0 8px 0;
          color: #e0e0e0;
          font-size: 1.1rem;
        }

        .doc-description {
          color: #808080;
          font-size: 0.9rem;
          margin-bottom: 15px;
          line-height: 1.4;
        }

        .doc-meta {
          font-size: 0.85rem;
          margin-bottom: 15px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border: 1px solid #e8e2d9;
        }

        .meta-row:last-child {
          border-bottom: none;
        }

        .meta-label {
          color: #808080;
        }

        .meta-value {
          color: #e0e0e0;
          text-align: right;
          word-break: break-all;
        }

        .meta-row.expired .meta-value {
          color: #ff6b6b;
        }

        .meta-row.warning .meta-value {
          color: #f7b731;
        }

        .expired-tag, .warning-tag {
          margin-left: 8px;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
        }

        .expired-tag {
          background: #ff6b6b;
          color: #fff;
        }

        .warning-tag {
          background: #f7b731;
          color: #134e4a;
        }

        .doc-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .btn-icon {
          background: #e8e2d9;
          border: none;
          color: #e0e0e0;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.1rem;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: #134e4a;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .loading {
          text-align: center;
          color: #808080;
          padding: 40px;
        }
      `}</style>
    </div>
  );
}

export default DocumentList;
