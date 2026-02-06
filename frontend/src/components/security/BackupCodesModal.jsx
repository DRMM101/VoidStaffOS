// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Backup Codes Modal
 * Shows remaining backup code count, allows regeneration with TOTP confirmation.
 * New codes displayed with copy/download options.
 */

import { useState } from 'react';
import { Key, Copy, Download, RefreshCw, Check, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

function BackupCodesModal({ mfaEnabled, onClose }) {
  // Regeneration flow
  const [confirmCode, setConfirmCode] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [newCodes, setNewCodes] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  /**
   * Format an 8-char code as XXXX-XXXX
   */
  const formatCode = (code) => {
    if (code.length === 8) return `${code.slice(0, 4)}-${code.slice(4)}`;
    return code;
  };

  /**
   * Regenerate backup codes — requires current TOTP code for security
   */
  const handleRegenerate = async () => {
    if (!confirmCode.trim()) return;
    try {
      setRegenerating(true);
      setError(null);
      const data = await api.post('/security/mfa/backup-codes/regenerate', {
        code: confirmCode.trim()
      });
      setNewCodes(data.backup_codes || []);
    } catch (err) {
      console.error('Regenerate backup codes error:', err);
      setError(err.message || 'Failed to regenerate codes. Check your TOTP code.');
    } finally {
      setRegenerating(false);
    }
  };

  /**
   * Copy all codes to clipboard
   */
  const handleCopy = async () => {
    if (!newCodes) return;
    const text = newCodes.map(formatCode).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  /**
   * Download codes as .txt file
   */
  const handleDownload = () => {
    if (!newCodes) return;
    const text = [
      'HeadOfficeOS — MFA Backup Codes',
      '================================',
      'Keep these codes in a safe place.',
      'Each code can only be used once.',
      '',
      ...newCodes.map((code, i) => `${i + 1}. ${formatCode(code)}`),
      '',
      `Generated: ${new Date().toLocaleDateString('en-GB')}`
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'headofficeos-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="backup-codes-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Manage backup codes"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="backup-codes-modal__title">
          <Key size={20} aria-hidden="true" />
          Backup Codes
        </h3>

        {/* Error banner */}
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {error}
          </div>
        )}

        {/* Show new codes if just regenerated */}
        {newCodes ? (
          <>
            <p className="backup-codes-modal__text">
              Your new backup codes are below. Previous codes have been invalidated.
            </p>
            <div className="mfa-wizard__codes" aria-label="New backup codes">
              {newCodes.map((code, i) => (
                <span key={i} className="mfa-wizard__code">{formatCode(code)}</span>
              ))}
            </div>
            <div className="mfa-wizard__code-actions">
              <button className="btn-secondary btn-secondary--sm" onClick={handleCopy} aria-label="Copy all backup codes">
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy All</>}
              </button>
              <button className="btn-secondary btn-secondary--sm" onClick={handleDownload} aria-label="Download backup codes">
                <Download size={14} /> Download .txt
              </button>
            </div>
            <div className="backup-codes-modal__actions">
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          /* Regeneration form — requires TOTP code */
          <>
            <p className="backup-codes-modal__text">
              Regenerating will invalidate all existing backup codes and create 10 new ones.
              Enter your current authenticator code to confirm:
            </p>
            <input
              type="text"
              className="form-input"
              placeholder="6-digit code"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              aria-label="Enter authenticator code to regenerate"
              autoFocus
            />
            <div className="backup-codes-modal__actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleRegenerate}
                disabled={regenerating || !confirmCode.trim()}
                aria-label="Regenerate backup codes"
              >
                <RefreshCw size={14} aria-hidden="true" />
                {regenerating ? 'Regenerating…' : 'Regenerate Codes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BackupCodesModal;
