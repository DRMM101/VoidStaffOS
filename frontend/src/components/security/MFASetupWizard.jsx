// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — MFA Setup Wizard (3-Step Modal)
 * Step 1: QR code + manual secret for authenticator app
 * Step 2: 6-digit verification code input
 * Step 3: Display 10 backup codes with download/copy options
 */

import { useState, useRef, useEffect } from 'react';
import { Shield, Copy, Download, Check, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

/* Number of individual digit inputs for TOTP code */
const CODE_LENGTH = 6;

function MFASetupWizard({ onComplete, onCancel }) {
  // Wizard step: 1 = QR, 2 = verify, 3 = backup codes
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: enrollment data from server
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');

  // Step 2: 6-digit code input
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const digitRefs = useRef([]);

  // Step 3: backup codes returned after verification
  const [backupCodes, setBackupCodes] = useState([]);
  const [codesSaved, setCodesSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * Step 1: Call enroll endpoint to get QR code and secret
   */
  useEffect(() => {
    const enroll = async () => {
      try {
        setLoading(true);
        const data = await api.post('/security/mfa/enroll');
        setQrCodeUrl(data.qr_code_url);
        setManualSecret(data.secret);
      } catch (err) {
        console.error('MFA enroll error:', err);
        setError('Failed to start MFA setup. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    enroll();
  }, []);

  /**
   * Handle individual digit input — auto-advance to next field
   */
  const handleDigitChange = (index, value) => {
    // Only allow single digits
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto-advance to next input on entry
    if (value && index < CODE_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === CODE_LENGTH - 1 && newDigits.every(d => d !== '')) {
      handleVerify(newDigits.join(''));
    }
  };

  /**
   * Handle backspace — move to previous field
   */
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handle paste — distribute pasted code across inputs
   */
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length === CODE_LENGTH) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      digitRefs.current[CODE_LENGTH - 1]?.focus();
      // Auto-submit after paste
      handleVerify(pasted);
    }
  };

  /**
   * Step 2: Verify the TOTP code against the server
   */
  const handleVerify = async (code) => {
    if (!code || code.length !== CODE_LENGTH) return;

    try {
      setVerifying(true);
      setError(null);
      const data = await api.post('/security/mfa/verify-setup', { code });
      // Server returns backup codes on successful verification
      setBackupCodes(data.backup_codes || []);
      setStep(3);
    } catch (err) {
      console.error('MFA verify error:', err);
      setError(err.message || 'Invalid verification code. Please try again.');
      // Clear inputs for retry
      setDigits(Array(CODE_LENGTH).fill(''));
      digitRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Format backup code as XXXX-XXXX
   */
  const formatCode = (code) => {
    if (code.length === 8) return `${code.slice(0, 4)}-${code.slice(4)}`;
    return code;
  };

  /**
   * Copy all backup codes to clipboard
   */
  const handleCopy = async () => {
    const text = backupCodes.map(formatCode).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  /**
   * Download backup codes as a .txt file
   */
  const handleDownload = () => {
    const text = [
      'HeadOfficeOS — MFA Backup Codes',
      '================================',
      'Keep these codes in a safe place.',
      'Each code can only be used once.',
      '',
      ...backupCodes.map((code, i) => `${i + 1}. ${formatCode(code)}`),
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
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="mfa-wizard"
        role="dialog"
        aria-modal="true"
        aria-label="Set up two-factor authentication"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wizard header with step indicator */}
        <div className="mfa-wizard__header">
          <Shield size={20} aria-hidden="true" />
          <h3 className="mfa-wizard__title">Set Up Two-Factor Authentication</h3>
          <div className="mfa-wizard__steps" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`mfa-wizard__step ${s === step ? 'mfa-wizard__step--active' : ''} ${s < step ? 'mfa-wizard__step--done' : ''}`}
              >
                {s < step ? <Check size={12} /> : s}
              </span>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {error}
          </div>
        )}

        {/* Step 1: QR Code + Manual Secret */}
        {step === 1 && (
          <div className="mfa-wizard__body">
            {loading ? (
              <div className="loading">Generating QR code…</div>
            ) : (
              <>
                <p className="mfa-wizard__instruction">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                </p>
                {/* QR code image */}
                {qrCodeUrl && (
                  <div className="mfa-wizard__qr">
                    <img
                      src={qrCodeUrl}
                      alt="Scan this QR code with your authenticator app"
                      className="mfa-wizard__qr-image"
                    />
                  </div>
                )}
                {/* Manual secret for copy-paste */}
                <div className="mfa-wizard__manual">
                  <p className="mfa-wizard__manual-label">Or enter this code manually:</p>
                  <code className="mfa-wizard__secret" aria-label="Manual setup key">
                    {manualSecret}
                  </code>
                </div>
                <div className="mfa-wizard__actions">
                  <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                  <button className="btn-primary" onClick={() => setStep(2)} aria-label="Continue to verification">
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: 6-Digit Verification */}
        {step === 2 && (
          <div className="mfa-wizard__body">
            <p className="mfa-wizard__instruction">
              Enter the 6-digit code from your authenticator app:
            </p>
            {/* Six individual digit inputs */}
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
            {verifying && <p className="mfa-wizard__verifying">Verifying…</p>}
            <div className="mfa-wizard__actions">
              <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button
                className="btn-primary"
                onClick={() => handleVerify(digits.join(''))}
                disabled={verifying || digits.some(d => !d)}
                aria-label="Verify code"
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Backup Codes */}
        {step === 3 && (
          <div className="mfa-wizard__body">
            <p className="mfa-wizard__instruction">
              Save these backup codes in a secure location. Each code can only be used once
              if you lose access to your authenticator app.
            </p>
            {/* 2-column grid of backup codes */}
            <div className="mfa-wizard__codes" aria-label="Backup codes">
              {backupCodes.map((code, i) => (
                <span key={i} className="mfa-wizard__code">{formatCode(code)}</span>
              ))}
            </div>
            {/* Copy + Download actions */}
            <div className="mfa-wizard__code-actions">
              <button className="btn-secondary btn-secondary--sm" onClick={handleCopy} aria-label="Copy all backup codes">
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy All</>}
              </button>
              <button className="btn-secondary btn-secondary--sm" onClick={handleDownload} aria-label="Download backup codes">
                <Download size={14} /> Download .txt
              </button>
            </div>
            {/* Confirmation checkbox */}
            <label className="mfa-wizard__confirm-label">
              <input
                type="checkbox"
                checked={codesSaved}
                onChange={(e) => setCodesSaved(e.target.checked)}
                aria-label="I have saved my backup codes"
              />
              I have saved my backup codes in a safe place
            </label>
            <div className="mfa-wizard__actions">
              <button
                className="btn-primary"
                onClick={onComplete}
                disabled={!codesSaved}
                aria-label="Finish setup"
              >
                <Check size={16} aria-hidden="true" /> Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MFASetupWizard;
