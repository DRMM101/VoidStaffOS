/**
 * VoidStaffOS - Compliance Settings
 * Configuration for compliance module.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function ComplianceSettings({ user }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const isHR = user && (user.role_name === 'Admin' || user.role_name === 'HR Manager');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compliance/settings', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isHR) return;

    try {
      setSaving(true);
      setMessage(null);

      const response = await apiFetch('/api/compliance/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="error-message">Failed to load settings</div>;
  }

  if (!isHR) {
    return <div className="error-message">Access denied. HR permissions required.</div>;
  }

  return (
    <div className="compliance-settings">
      <div className="settings-header">
        <h2>Compliance Settings</h2>
        <p>Configure compliance module behaviour for your organisation</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-section">
        <h3>Module Settings</h3>

        <div className="setting-item checkbox-setting">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.module_enabled !== false}
              onChange={(e) => setSettings({ ...settings, module_enabled: e.target.checked })}
            />
            Enable Compliance Module
          </label>
          <p className="setting-help">
            When disabled, the compliance module will be hidden from navigation.
            Useful for companies that don't require RTW/DBS tracking.
          </p>
        </div>

        <div className="setting-item">
          <label>Report Title</label>
          <input
            type="text"
            value={settings.report_title || 'Compliance Report'}
            onChange={(e) => setSettings({ ...settings, report_title: e.target.value })}
            placeholder="e.g., CQC Report, Compliance Report"
            style={{
              padding: '10px 14px',
              border: '2px solid #2a2a4a',
              borderRadius: '6px',
              background: '#1a1a2e',
              color: '#fff',
              fontSize: '0.95rem',
              width: '300px'
            }}
          />
          <p className="setting-help">
            Customise the report title for your sector. Examples: "CQC Report" for care sector,
            "Compliance Report" for general use, "Safeguarding Report" for education.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>DBS Settings</h3>

        <div className="setting-item">
          <label>Default DBS Renewal Period</label>
          <select
            value={settings.default_dbs_renewal_years}
            onChange={(e) => setSettings({ ...settings, default_dbs_renewal_years: parseInt(e.target.value) })}
          >
            <option value={1}>1 Year</option>
            <option value={2}>2 Years</option>
            <option value={3}>3 Years</option>
          </select>
          <p className="setting-help">
            Default renewal period for new DBS checks. Regulated sectors typically require 3 years,
            but some organisations may require more frequent renewals.
          </p>
        </div>

        <div className="setting-item">
          <label>Update Service Check Interval (months)</label>
          <select
            value={settings.update_service_check_months}
            onChange={(e) => setSettings({ ...settings, update_service_check_months: parseInt(e.target.value) })}
          >
            <option value={1}>Monthly</option>
            <option value={3}>Quarterly (3 months)</option>
            <option value={6}>Bi-annually (6 months)</option>
            <option value={12}>Annually (12 months)</option>
          </select>
          <p className="setting-help">
            How often to prompt for DBS Update Service checks for registered employees.
            Regulators recommend checking at least annually.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>RTW Settings</h3>

        <div className="setting-item">
          <label>RTW Reminder Days</label>
          <div className="reminder-days">
            <span className="reminder-day">90 days</span>
            <span className="reminder-day">60 days</span>
            <span className="reminder-day">30 days</span>
            <span className="reminder-day">Expired</span>
          </div>
          <p className="setting-help">
            Notifications are sent at these intervals before RTW expiry.
            This follows the standard escalation pattern used across the system.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Task Automation</h3>

        <div className="setting-item checkbox-setting">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.auto_create_followup_tasks}
              onChange={(e) => setSettings({ ...settings, auto_create_followup_tasks: e.target.checked })}
            />
            Auto-create follow-up tasks
          </label>
          <p className="setting-help">
            When enabled, the system automatically creates compliance tasks when:
          </p>
          <ul className="setting-list">
            <li>An RTW check has an expiry date set</li>
            <li>An RTW check has a follow-up date set</li>
            <li>A DBS check is created (renewal task)</li>
            <li>A DBS Update Service check becomes due</li>
          </ul>
        </div>
      </div>

      <div className="settings-actions">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          className="btn-secondary"
          onClick={fetchSettings}
          disabled={saving}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default ComplianceSettings;
