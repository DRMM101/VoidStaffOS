// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Compensation Settings Panel
 * Admin-only toggle switches for optional compensation features:
 * tier-band linking, bonus schemes, and responsibility allowances.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

function CompensationSettingsPanel({ user }) {
  const [settings, setSettings] = useState({
    enable_tier_band_linking: false,
    enable_bonus_schemes: false,
    enable_responsibility_allowances: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Only Admin can access this panel
  const isAdmin = user?.role_name === 'Admin';

  // Fetch current settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await apiFetch('/api/compensation/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings({
            enable_tier_band_linking: data.enable_tier_band_linking || false,
            enable_bonus_schemes: data.enable_bonus_schemes || false,
            enable_responsibility_allowances: data.enable_responsibility_allowances || false
          });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Toggle a specific setting
  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setMessage(null); // Clear any previous save message
  };

  // Save settings to API
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/compensation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error — please try again' });
    } finally {
      setSaving(false);
    }
  };

  // Non-admin sees access denied
  if (!isAdmin) {
    return (
      <div className="compensation-settings">
        <p className="compensation-settings__denied">Only administrators can manage compensation settings.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="compensation-settings"><p>Loading settings...</p></div>;
  }

  return (
    <div className="compensation-settings">
      <div className="compensation-settings__header">
        <h2>Compensation Settings</h2>
        <p className="compensation-settings__subtitle">
          Enable optional compensation features for your organisation. These can be toggled on or off at any time.
        </p>
      </div>

      {/* Feature toggle cards */}
      <div className="compensation-settings__toggles">
        {/* Tier-Band Linking toggle */}
        <div className="compensation-settings__toggle-card">
          <div className="compensation-settings__toggle-info">
            <h3>Tier-Band Linking</h3>
            <p>Link pay bands to organisational tiers. When enabled, you can associate each pay band with a specific tier level.</p>
          </div>
          <label className="toggle-switch" aria-label="Enable tier-band linking">
            <input
              type="checkbox"
              checked={settings.enable_tier_band_linking}
              onChange={() => handleToggle('enable_tier_band_linking')}
            />
            <span className="toggle-switch__slider"></span>
          </label>
        </div>

        {/* Bonus Schemes toggle */}
        <div className="compensation-settings__toggle-card">
          <div className="compensation-settings__toggle-info">
            <h3>Bonus Schemes</h3>
            <p>Create and manage bonus calculation schemes. Supports percentage-based or fixed bonuses linked to tiers or pay bands.</p>
          </div>
          <label className="toggle-switch" aria-label="Enable bonus schemes">
            <input
              type="checkbox"
              checked={settings.enable_bonus_schemes}
              onChange={() => handleToggle('enable_bonus_schemes')}
            />
            <span className="toggle-switch__slider"></span>
          </label>
        </div>

        {/* Responsibility Allowances toggle */}
        <div className="compensation-settings__toggle-card">
          <div className="compensation-settings__toggle-info">
            <h3>Responsibility Allowances</h3>
            <p>Define additional payments for specific responsibilities (e.g. Fire Warden, First Aider). Can be linked to tiers, bands, or additional roles.</p>
          </div>
          <label className="toggle-switch" aria-label="Enable responsibility allowances">
            <input
              type="checkbox"
              checked={settings.enable_responsibility_allowances}
              onChange={() => handleToggle('enable_responsibility_allowances')}
            />
            <span className="toggle-switch__slider"></span>
          </label>
        </div>
      </div>

      {/* Save button and status message */}
      <div className="compensation-settings__actions">
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {message && (
          <span className={`compensation-settings__message compensation-settings__message--${message.type}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

export default CompensationSettingsPanel;
