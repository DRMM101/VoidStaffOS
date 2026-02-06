// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Session Timeout Warning
 * Rendered globally in App.jsx. Tracks user activity (mouse, keyboard,
 * scroll, touch) and shows a warning modal 5 minutes before session
 * timeout. Auto-logs out on expiry. "Stay logged in" pings /api/auth/me.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

/* Warning shown this many ms before timeout */
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes

/* Activity debounce — don't update on every event, batch at 60s */
const ACTIVITY_DEBOUNCE_MS = 60 * 1000;

function SessionTimeoutWarning({ timeoutMinutes, onLogout }) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Track the absolute time when session expires
  const expiryRef = useRef(Date.now() + timeoutMinutes * 60 * 1000);
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef(null);
  const countdownRef = useRef(null);

  // Total timeout in ms
  const timeoutMs = timeoutMinutes * 60 * 1000;

  /**
   * Reset the timeout — called on user activity
   */
  const resetTimeout = useCallback(() => {
    const now = Date.now();
    // Debounce: only reset if enough time has passed since last reset
    if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) return;
    lastActivityRef.current = now;

    // Push expiry forward
    expiryRef.current = now + timeoutMs;

    // Clear any existing warning
    setShowWarning(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Set new warning timer
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      // Show warning and start countdown
      setShowWarning(true);
      startCountdown();
    }, timeoutMs - WARNING_BEFORE_MS);
  }, [timeoutMs]);

  /**
   * Start a per-second countdown to expiry
   */
  const startCountdown = () => {
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiryRef.current - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        // Session expired — auto-logout
        clearInterval(countdownRef.current);
        onLogout();
      }
    };
    tick(); // Initial tick
    countdownRef.current = setInterval(tick, 1000);
  };

  /**
   * "Stay logged in" — ping the server and reset timeout
   */
  const handleStayLoggedIn = async () => {
    try {
      await api.get('/auth/me');
      // Force-reset timeout (bypass debounce)
      lastActivityRef.current = 0;
      resetTimeout();
    } catch (err) {
      console.error('Stay logged in ping failed:', err);
      onLogout();
    }
  };

  /**
   * Register activity listeners on mount, clean up on unmount
   */
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimeout, { passive: true }));

    // Start the initial warning timer
    resetTimeout();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimeout));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimeout]);

  // Don't render anything if no warning needed
  if (!showWarning) return null;

  // Format remaining time as M:SS
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="modal-backdrop session-timeout-backdrop">
      <div
        className="session-timeout-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="Session timeout warning"
      >
        <div className="session-timeout-modal__header">
          <Clock size={24} aria-hidden="true" />
          <h3 className="session-timeout-modal__title">Session Expiring Soon</h3>
        </div>
        <div className="session-timeout-modal__body">
          <AlertCircle size={18} aria-hidden="true" />
          <p>
            Your session will expire in <strong>{timeStr}</strong> due to inactivity.
            Would you like to stay logged in?
          </p>
        </div>
        <div className="session-timeout-modal__actions">
          <button className="btn-secondary" onClick={onLogout}>
            Log Out Now
          </button>
          <button className="btn-primary" onClick={handleStayLoggedIn} aria-label="Stay logged in">
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeoutWarning;
