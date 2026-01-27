/**
 * VoidStaffOS - Compliance Module
 * Main compliance management interface for RTW and DBS tracking.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import ComplianceDashboard from './ComplianceDashboard';
import RTWCheckManager from './RTWCheckManager';
import DBSCheckManager from './DBSCheckManager';
import ComplianceTasks from './ComplianceTasks';
import ComplianceSettings from './ComplianceSettings';
import ComplianceReport from './ComplianceReport';

function Compliance({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  const isHR = user && (user.role_name === 'Admin' || user.role_name === 'HR Manager');

  useEffect(() => {
    fetchStats();
    fetchSettings();
  }, []);

  const fetchStats = async () => {
    try {
      setError(null);
      const response = await fetch('/api/compliance/stats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load stats');
      }
    } catch (err) {
      console.error('Error fetching compliance stats:', err);
      setError('Network error');
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/compliance/settings', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const reportTitle = settings?.report_title || 'Compliance Report';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ComplianceDashboard user={user} onRefresh={fetchStats} />;
      case 'rtw':
        return <RTWCheckManager user={user} onRefresh={fetchStats} />;
      case 'dbs':
        return <DBSCheckManager user={user} onRefresh={fetchStats} />;
      case 'tasks':
        return <ComplianceTasks user={user} onRefresh={fetchStats} />;
      case 'report':
        return <ComplianceReport user={user} reportTitle={reportTitle} />;
      case 'settings':
        return <ComplianceSettings user={user} />;
      default:
        return <ComplianceDashboard user={user} onRefresh={fetchStats} />;
    }
  };

  return (
    <div className="compliance-container">
      <div className="compliance-header">
        <h1>Compliance Management</h1>
        <p className="compliance-subtitle">RTW & DBS verification tracking</p>
        {error && <p style={{color: '#ff6b6b'}}>Error: {error}</p>}
      </div>

      <div className="compliance-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabClick('dashboard')}
        >
          Dashboard
          {stats && stats.issues > 0 && (
            <span className="tab-badge warning">{stats.issues}</span>
          )}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'rtw' ? 'active' : ''}`}
          onClick={() => handleTabClick('rtw')}
        >
          RTW Checks
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'dbs' ? 'active' : ''}`}
          onClick={() => handleTabClick('dbs')}
        >
          DBS Checks
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => handleTabClick('tasks')}
        >
          Tasks
          {stats && stats.pending_tasks > 0 && (
            <span className="tab-badge">{stats.pending_tasks}</span>
          )}
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => handleTabClick('report')}
        >
          {reportTitle}
        </button>
        {isHR && (
          <button
            type="button"
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabClick('settings')}
          >
            Settings
          </button>
        )}
      </div>

      <div className="compliance-content">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default Compliance;
