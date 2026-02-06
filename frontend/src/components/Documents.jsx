/**
 * HeadOfficeOS - Documents Page Component
 * Main documents page with role-based views.
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

import { useState } from 'react';
import DocumentList from './DocumentList';
import DocumentUpload from './DocumentUpload';
import DocumentManager from './DocumentManager';

function Documents({ user }) {
  const [view, setView] = useState('list'); // 'list', 'upload', 'manager'
  const [showUpload, setShowUpload] = useState(false);

  const isHR = user.tier >= 60 || user.role_name === 'HR Manager';

  const handleUploadSuccess = () => {
    setShowUpload(false);
    setView('list');
  };

  // HR gets the full manager view
  if (isHR && view === 'manager') {
    return <DocumentManager user={user} />;
  }

  return (
    <div className="documents-page">
      {/* Header with tabs for HR */}
      {isHR && (
        <div className="page-tabs">
          <button
            className={`tab-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            My Documents
          </button>
          <button
            className={`tab-btn ${view === 'manager' ? 'active' : ''}`}
            onClick={() => setView('manager')}
          >
            Document Manager
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <DocumentUpload
              user={user}
              onClose={() => setShowUpload(false)}
              onSuccess={handleUploadSuccess}
            />
          </div>
        </div>
      )}

      {/* Document List (default view) */}
      <DocumentList
        user={user}
        onUpload={() => setShowUpload(true)}
      />

      <style>{`
        .documents-page {
          min-height: 100%;
        }

        .page-tabs {
          display: flex;
          gap: 10px;
          padding: 20px 20px 0 20px;
          border: 1px solid #e8e2d9;
          margin-bottom: 0;
        }

        .tab-btn {
          padding: 12px 24px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          color: #a0a0a0;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
          margin-bottom: -1px;
        }

        .tab-btn:hover {
          color: #e0e0e0;
        }

        .tab-btn.active {
          color: #134e4a;
          border-bottom-color: #134e4a;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}

export default Documents;
