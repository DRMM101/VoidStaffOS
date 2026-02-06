// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — MFA Verify Modal (Login Challenge)
 * Shown during login when the server returns mfa_required: true.
 * Accepts a 6-digit TOTP code or an 8-character backup code.
 */

import { useState, useRef } from 'react';
import { Shield, Key, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

const CODE_LENGTH = 6;

function MFAVerifyModal({ userId, onVerified, onCancel }) {
  // Toggle between TOTP and backup code mode
  const [useBackup, setUseBackup] = useState(false);

  // TOTP 6-digit input
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const digitRefs = useRef([]);

  // Backup code input
  const [backupCode, setBackupCode] = useState('');

  // Shared state
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle individual digit input — auto-advance to next field
   */
  const handleDigitChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto-advance to next input
    if (value && index < CODE_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === CODE_LENGTH - 1 && newDigits.every(d => d !== '')) {
      submitCode(newDigits.join(''));
    }
  };

  /**
   * Handle backspace navigation between digit fields
   */
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handle paste — distribute across digit inputs
   */
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length === CODE_LENGTH) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      digitRefs.current[CODE_LENGTH - 1]?.focus();
      submitCode(pasted);
    }
  };

  /**
   * Submit the code (TOTP or backup) to the MFA validate endpoint
   */
  const submitCode = async (code) => {
    if (!code) return;
    try {
      setVerifying(true);
      setError(null);
      const data = await api.post('/auth/mfa/validate', {
        user_id: userId,
        code: code
      });
      // Login complete — pass user data up
      onVerified(data);
    } catch (err) {
      console.error('MFA verify error:', err);
      setError(err.message || 'Invalid code. Please try again.');
      // Clear TOTP inputs on failure
      if (!useBackup) {
        setDigits(Array(CODE_LENGTH).fill(''));
        digitRefs.current[0]?.focus();
      }
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Handle backup code form submission
   */
  const handleBackupSubmit = (e) => {
    e.preventDefault();
    if (backupCode.trim()) {
      submitCode(backupCode.trim());
    }
  };

  /**
   * Toggle between TOTP and backup code mode
   */
  const toggleMode = () => {
    setUseBackup(!useBackup);
    setError(null);
    setDigits(Array(CODE_LENGTH).fill(''));
    setBackupCode('');
  };

  return (
    <div className="modal-backdrop">
      <div
        className="mfa-verify"
        role="dialog"
        aria-modal="true"
        aria-label="Two-factor authentication"
      >
        <div className="mfa-verify__header">
          <Shield size={24} aria-hidden="true" />
          <h3 className="mfa-verify__title">Two-Factor Authentication</h3>
        </div>

        {/* Error banner */}
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {error}
          </div>
        )}

        {/* TOTP code mode */}
        {!useBackup ? (
          <div className="mfa-verify__body">
            <p className="mfa-verify__instruction">
              Enter the 6-digit code from your authenticator app:
            </p>
            <div className="mfa-wizard__digits" role="group" aria-label="Verification code">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (digitRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="mfa-wizard__digit-input"
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  aria-label={`Digit ${i + 1}`}
                  autoFocus={i === 0}
                  disabled={verifying}
                />
              ))}
            </div>
            {verifying && <p className="mfa-verify__verifying">Verifying…</p>}
          </div>
        ) : (
          /* Backup code mode */
          <form className="mfa-verify__body" onSubmit={handleBackupSubmit}>
            <p className="mfa-verify__instruction">
              Enter one of your 8-character backup codes:
            </p>
            <input
              type="text"
              className="mfa-verify__backup-input"
              placeholder="XXXX-XXXX"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              aria-label="Backup code"
              autoFocus
              disabled={verifying}
              maxLength={9}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={verifying || !backupCode.trim()}
              aria-label="Verify backup code"
            >
              {verifying ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        )}

        {/* Mode toggle + cancel */}
        <div className="mfa-verify__footer">
          <button className="btn-link" onClick={toggleMode} aria-label={useBackup ? 'Use authenticator code' : 'Use backup code instead'}>
            <Key size={14} aria-hidden="true" />
            {useBackup ? 'Use authenticator code' : 'Use a backup code instead'}
          </button>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default MFAVerifyModal;
