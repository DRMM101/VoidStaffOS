/**
 * HeadOfficeOS - Policy Viewer Component
 * Read policy with scroll tracking and acknowledgment form.
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

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

const CATEGORY_COLORS = {
  'HR': '#134e4a',
  'Health & Safety': '#2cb67d',
  'Safeguarding': '#ff6b6b',
  'Compliance': '#4ecdc4',
  'IT': '#45b7d1',
  'Operational': '#f7b731'
};

function PolicyViewer({ policy, user, onAcknowledge, onClose, readOnly = false }) {
  const [scrollCompleted, setScrollCompleted] = useState(false);
  const [checkboxConfirmed, setCheckboxConfirmed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [startTime] = useState(Date.now());

  // PDF state
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfPagesViewed, setPdfPagesViewed] = useState(new Set([1]));

  const contentRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // Track scroll progress for text content
  const handleScroll = useCallback(() => {
    if (!contentRef.current || policy.pdf_filename) return;

    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage >= 0.95) {
      setScrollCompleted(true);
    }
  }, [policy.pdf_filename]);

  useEffect(() => {
    const content = contentRef.current;
    if (content && !policy.pdf_filename) {
      content.addEventListener('scroll', handleScroll);
      // Check if content fits without scrolling
      if (content.scrollHeight <= content.clientHeight) {
        setScrollCompleted(true);
      }
      return () => content.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, policy.pdf_filename]);

  // Handle PDF page changes (for embedded PDF viewer)
  const handlePdfPageChange = (newPage) => {
    setCurrentPage(newPage);
    setPdfPagesViewed(prev => new Set([...prev, newPage]));

    // Check if all pages viewed
    if (pdfPagesViewed.size + 1 >= totalPages) {
      setScrollCompleted(true);
    }
  };

  // Handle PDF load
  const handlePdfLoad = () => {
    setPdfLoaded(true);
    // For simplicity, we'll trust the scroll completion for embedded PDFs
    // In a production app, you'd use a PDF.js viewer with page tracking
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!scrollCompleted) {
      setError('Please read the entire policy before acknowledging');
      return;
    }

    if (!checkboxConfirmed) {
      setError('Please check the acknowledgment checkbox');
      return;
    }

    if (!typedName.trim()) {
      setError('Please type your name as a signature');
      return;
    }

    // Validate typed name matches user's name (case-insensitive)
    const normalizedTyped = typedName.trim().toLowerCase();
    const normalizedUser = user.full_name.toLowerCase();
    if (normalizedTyped !== normalizedUser) {
      setError(`Please type your full name exactly as: ${user.full_name}`);
      return;
    }

    setSubmitting(true);

    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      await api.post(`/policies/${policy.id}/acknowledge`, {
        scroll_completed: scrollCompleted,
        checkbox_confirmed: checkboxConfirmed,
        typed_name: typedName.trim(),
        time_spent_seconds: timeSpent,
        pdf_pages_viewed: policy.pdf_filename ? pdfPagesViewed.size : null,
        pdf_total_pages: policy.pdf_filename ? totalPages : null
      });

      onAcknowledge(policy.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Simple markdown-like formatting
  const formatContent = (content) => {
    if (!content) return '';

    return content
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  };

  return (
    <div className="policy-viewer-overlay">
      <div className="policy-viewer">
        <div className="viewer-header">
          <div className="header-info">
            <span
              className="category-badge"
              style={{ backgroundColor: CATEGORY_COLORS[policy.category] }}
            >
              {policy.category}
            </span>
            <span className="version-badge">v{policy.version}</span>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="viewer-title">
          <h1>{policy.title}</h1>
          {policy.summary && <p className="summary">{policy.summary}</p>}
          <div className="meta">
            <span>Published {formatDate(policy.published_at)}</span>
            {policy.created_by_name && <span>by {policy.created_by_name}</span>}
          </div>
        </div>

        <div className="viewer-content" ref={contentRef}>
          {policy.pdf_filename ? (
            <div className="pdf-viewer" ref={pdfContainerRef}>
              <div className="pdf-toolbar">
                <span>PDF Document</span>
                {totalPages > 0 && (
                  <span>Page {currentPage} of {totalPages}</span>
                )}
              </div>
              <iframe
                src={`/api/policies/${policy.id}/pdf#toolbar=0`}
                title="Policy PDF"
                className="pdf-iframe"
                onLoad={handlePdfLoad}
                onError={() => setPdfError(true)}
              />
              {pdfError && (
                <div className="pdf-error">
                  Failed to load PDF. Please try again or contact support.
                </div>
              )}
              <div className="pdf-scroll-notice">
                {scrollCompleted ? (
                  <span className="scroll-complete">&#10003; Document reviewed</span>
                ) : (
                  <span className="scroll-pending">Please scroll through the entire document</span>
                )}
              </div>
            </div>
          ) : (
            <div
              className="text-content"
              dangerouslySetInnerHTML={{ __html: formatContent(policy.content) }}
            />
          )}
        </div>

        <div className="scroll-indicator">
          {scrollCompleted ? (
            <span className="scroll-complete">&#10003; You have read the entire document</span>
          ) : (
            <span className="scroll-pending">&#8595; Scroll down to read the full policy</span>
          )}
        </div>

        {!readOnly && (
          <div className="acknowledgment-section">
            <h3>Acknowledgment</h3>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="checkbox-group">
                <label className={!scrollCompleted ? 'disabled' : ''}>
                  <input
                    type="checkbox"
                    checked={checkboxConfirmed}
                    onChange={(e) => setCheckboxConfirmed(e.target.checked)}
                    disabled={!scrollCompleted}
                  />
                  <span>
                    I confirm that I have read and understood this policy, and I agree to comply with its requirements.
                  </span>
                </label>
              </div>

              <div className="signature-group">
                <label htmlFor="typed-name">
                  Type your full name as signature: <strong>{user.full_name}</strong>
                </label>
                <input
                  type="text"
                  id="typed-name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={user.full_name}
                  disabled={!scrollCompleted || !checkboxConfirmed}
                  autoComplete="off"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!scrollCompleted || !checkboxConfirmed || !typedName.trim() || submitting}
                >
                  {submitting ? 'Submitting...' : 'Acknowledge Policy'}
                </button>
              </div>
            </form>

            <div className="legal-notice">
              By acknowledging this policy, you confirm that you have read and understood its contents.
              Your acknowledgment will be recorded with timestamp, IP address, and digital signature
              for compliance purposes.
            </div>
          </div>
        )}

        {readOnly && (
          <div className="form-actions read-only-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>

      <style>{`
        .policy-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .policy-viewer {
          background: #ffffff;
          border-radius: 12px;
          width: 100%;
          max-width: 900px;
          max-height: 95vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border: 1px solid #e8e2d9;
          background: #f9f6f2;
        }

        .header-info {
          display: flex;
          gap: 10px;
        }

        .category-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
        }

        .version-badge {
          background: #e8e2d9;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8rem;
          color: #a0a0a0;
          font-family: monospace;
        }

        .btn-close {
          background: none;
          border: none;
          color: #808080;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 5px 10px;
        }

        .btn-close:hover {
          color: #e0e0e0;
        }

        .viewer-title {
          padding: 20px 25px;
          border: 1px solid #e8e2d9;
        }

        .viewer-title h1 {
          margin: 0 0 10px 0;
          color: #e0e0e0;
          font-size: 1.5rem;
        }

        .viewer-title .summary {
          color: #a0a0a0;
          margin: 0 0 10px 0;
          line-height: 1.5;
        }

        .viewer-title .meta {
          display: flex;
          gap: 15px;
          font-size: 0.85rem;
          color: #606060;
        }

        .viewer-content {
          flex: 1;
          overflow-y: auto;
          padding: 25px;
          background: #f9f6f2;
          min-height: 300px;
          max-height: 400px;
        }

        .text-content {
          color: #d0d0d0;
          line-height: 1.7;
        }

        .text-content h1,
        .text-content h2,
        .text-content h3 {
          color: #e0e0e0;
          margin-top: 25px;
          margin-bottom: 15px;
        }

        .text-content h1 { font-size: 1.4rem; }
        .text-content h2 { font-size: 1.2rem; }
        .text-content h3 { font-size: 1.1rem; }

        .text-content ul {
          padding-left: 20px;
          margin: 15px 0;
        }

        .text-content li {
          margin-bottom: 8px;
        }

        .text-content strong {
          color: #e0e0e0;
        }

        .pdf-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .pdf-toolbar {
          display: flex;
          justify-content: space-between;
          padding: 10px 15px;
          background: #e8e2d9;
          border-radius: 8px 8px 0 0;
          color: #a0a0a0;
          font-size: 0.9rem;
        }

        .pdf-iframe {
          flex: 1;
          width: 100%;
          min-height: 300px;
          border: none;
          background: #fff;
        }

        .pdf-error {
          text-align: center;
          padding: 40px;
          color: #ff6b6b;
        }

        .pdf-scroll-notice {
          text-align: center;
          padding: 10px;
          background: #f9f6f2;
          border-radius: 0 0 8px 8px;
        }

        .scroll-indicator {
          padding: 12px 25px;
          text-align: center;
          background: #ffffff;
          border: 1px solid #e8e2d9;
        }

        .scroll-complete {
          color: #2cb67d;
        }

        .scroll-pending {
          color: #f7b731;
        }

        .acknowledgment-section {
          padding: 20px 25px;
          border: 1px solid #e8e2d9;
          background: #ffffff;
        }

        .acknowledgment-section h3 {
          margin: 0 0 15px 0;
          color: #e0e0e0;
          font-size: 1.1rem;
        }

        .checkbox-group {
          margin-bottom: 20px;
        }

        .checkbox-group label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          color: #d0d0d0;
          line-height: 1.5;
        }

        .checkbox-group label.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .checkbox-group input[type="checkbox"] {
          margin-top: 3px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .signature-group {
          margin-bottom: 20px;
        }

        .signature-group label {
          display: block;
          color: #a0a0a0;
          margin-bottom: 10px;
          font-size: 0.95rem;
        }

        .signature-group strong {
          color: #e0e0e0;
        }

        .signature-group input {
          width: 100%;
          padding: 12px 15px;
          background: #f9f6f2;
          border: 1px solid #e8e2d9;
          border-radius: 8px;
          color: #e0e0e0;
          font-size: 1rem;
        }

        .signature-group input:focus {
          outline: none;
          border-color: #134e4a;
        }

        .signature-group input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
          margin-top: 20px;
        }

        .read-only-actions {
          padding: 20px 25px;
          border: 1px solid #e8e2d9;
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
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #e8e2d9;
          color: #e0e0e0;
        }

        .btn-secondary:hover {
          background: #3a3a5a;
        }

        .legal-notice {
          margin-top: 20px;
          padding: 15px;
          background: #f9f6f2;
          border-radius: 8px;
          font-size: 0.85rem;
          color: #808080;
          line-height: 1.5;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          padding: 12px 15px;
          border-radius: 8px;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
}

export default PolicyViewer;
