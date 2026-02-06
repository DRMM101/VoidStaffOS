/**
 * HeadOfficeOS - Policies Component
 * Main PolicyOS page managing all policy views.
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

import { useState, useCallback } from 'react';
import PolicyDashboard from './PolicyDashboard';
import PolicyList from './PolicyList';
import PolicyEditor from './PolicyEditor';
import PolicyViewer from './PolicyViewer';
import PolicyComplianceReport from './PolicyComplianceReport';

/**
 * Check if user can manage policies (HR Manager role or Tier 60+)
 * @param {Object} user - User object
 * @returns {boolean}
 */
function canManagePolicies(user) {
  const isAdmin = user.role_name === 'Admin';
  const isHRManager = user.role_name === 'Manager' && user.additional_roles?.includes('HR');
  const isTier60Plus = user.tier >= 60;
  return isAdmin || isHRManager || isTier60Plus;
}

function Policies({ user }) {
  const [view, setView] = useState('dashboard'); // dashboard, list, editor, viewer, compliance
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isManager = canManagePolicies(user);

  const handleViewPolicy = useCallback((policy) => {
    setSelectedPolicy(policy);
    setView('viewer');
  }, []);

  const handleEditPolicy = useCallback((policy) => {
    setSelectedPolicy(policy);
    setView('editor');
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedPolicy(null);
    setView('editor');
  }, []);

  const handleSavePolicy = useCallback((savedPolicy) => {
    setSelectedPolicy(null);
    setView('list');
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleAcknowledge = useCallback((policyId) => {
    setSelectedPolicy(null);
    setView('dashboard');
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setSelectedPolicy(null);
    setView(isManager ? 'list' : 'dashboard');
  }, [isManager]);

  const handleCloseEditor = useCallback(() => {
    setSelectedPolicy(null);
    setView('list');
  }, []);

  return (
    <div className="policies-page">
      {/* Tab Navigation for Managers */}
      {isManager && view !== 'editor' && view !== 'viewer' && (
        <div className="tab-nav">
          <button
            className={`tab ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            My Policies
          </button>
          <button
            className={`tab ${view === 'list' || view === 'compliance' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            Manage Policies
          </button>
        </div>
      )}

      {/* Views */}
      {view === 'dashboard' && (
        <PolicyDashboard
          key={`dashboard-${refreshKey}`}
          user={user}
          onViewPolicy={handleViewPolicy}
        />
      )}

      {view === 'list' && (
        <PolicyList
          key={`list-${refreshKey}`}
          user={user}
          onCreateNew={handleCreateNew}
          onEdit={handleEditPolicy}
          onView={handleViewPolicy}
          onViewCompliance={() => setView('compliance')}
        />
      )}

      {view === 'compliance' && (
        <PolicyComplianceReport
          onClose={() => setView('list')}
        />
      )}

      {view === 'editor' && (
        <PolicyEditor
          policy={selectedPolicy}
          onSave={handleSavePolicy}
          onCancel={handleCloseEditor}
        />
      )}

      {view === 'viewer' && selectedPolicy && (
        <PolicyViewer
          policy={selectedPolicy}
          user={user}
          onAcknowledge={handleAcknowledge}
          onClose={handleCloseViewer}
          readOnly={isManager && selectedPolicy.status !== 'published'}
        />
      )}

      <style>{`
        .policies-page {
          min-height: 100%;
        }

        .tab-nav {
          display: flex;
          gap: 0;
          padding: 0 20px;
          background: #f9f6f2;
          border: 1px solid #e8e2d9;
        }

        .tab {
          padding: 15px 25px;
          background: none;
          border: none;
          color: #808080;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #e0e0e0;
        }

        .tab.active {
          color: #134e4a;
          border-bottom-color: #134e4a;
        }
      `}</style>
    </div>
  );
}

export default Policies;
