// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — MFA Disable Modal
 * Confirmation modal to disable two-factor authentication.
 * Requires a current TOTP code for security verification.
 */

import { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

function MFADisableModal({ onDisabled, onCancel }) {
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Submit TOTP code to disable MFA
   */
  const handleDisable = async () => {
    if (!code.trim()) return;
    try {
      setDisabling(true);
      setError(null);
      await api.delete('/security/mfa', {
        data: { code: code.trim() }
      });
      onDisabled();
    } catch (err) {
      console.error('MFA disable error:', err);
      setError(err.message || 'Failed to disable 2FA. Check your code.');
    } finally {
      setDisabling(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="mfa-disable-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Disable two-factor authentication"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mfa-disable-modal__title">
          <Shield size={20} aria-hidden="true" />
          Disable Two-Factor Authentication
        </h3>

        {/* Warning message */}
        <div className="mfa-disable-modal__warning" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <p>
            Disabling 2FA will remove the extra security layer from your account.
            Your backup codes will also be deleted.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {error}
          </div>
        )}

        {/* TOTP code confirmation */}
        <p className="mfa-disable-modal__text">
          Enter your current authenticator code to confirm:
        </p>
        <input
          type="text"
          className="form-input"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          inputMode="numeric"
          aria-label="Enter authenticator code to disable 2FA"
          autoFocus
        />

        <div className="mfa-disable-modal__actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn-danger"
            onClick={handleDisable}
            disabled={disabling || !code.trim()}
            aria-label="Confirm disable 2FA"
          >
            {disabling ? 'Disabling…' : 'Disable 2FA'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MFADisableModal;
