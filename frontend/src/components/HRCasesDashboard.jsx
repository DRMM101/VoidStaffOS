/**
 * VoidStaffOS - HR Cases Dashboard
 * Main dashboard for PIP, Disciplinary, and Grievance management.
 * ACAS-compliant HR case workflows.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: HR Cases
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import CreateCaseModal from './CreateCaseModal';
import HRCaseDetail from './HRCaseDetail';
import GrievanceSubmitForm from './GrievanceSubmitForm';
import EmployeeHRView from './EmployeeHRView';

function HRCasesDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [filterType, setFilterType] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [showGrievanceForm, setShowGrievanceForm] = useState(false);

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';
  const canManageCases = isAdmin || isManager;

  useEffect(() => {
    if (canManageCases) {
      fetchCases();
      fetchStats();
    }
  }, [activeTab, filterType]);

  const fetchCases = async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/api/hr-cases?';

      if (activeTab === 'active') {
        url += 'status=open&status=investigation&status=hearing_scheduled&status=awaiting_decision&status=appeal';
      } else if (activeTab === 'draft') {
        url += 'status=draft';
      } else if (activeTab === 'closed') {
        url += 'status=closed&include_closed=true';
      }

      if (filterType !== 'all') {
        url += `&case_type=${filterType}`;
      }

      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }
      const data = await response.json();
      setCases(data.cases || []);
    } catch (err) {
      console.error('Fetch cases error:', err);
      setError('Failed to load HR cases');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiFetch('/api/hr-cases/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchCases();
    fetchStats();
  };

  const handleCaseClick = (hrCase) => {
    setSelectedCase(hrCase);
  };

  const handleBackFromDetail = () => {
    setSelectedCase(null);
    fetchCases();
    fetchStats();
  };

  const getCaseTypeLabel = (type) => {
    const labels = {
      pip: 'Performance Improvement Plan',
      disciplinary: 'Disciplinary',
      grievance: 'Grievance'
    };
    return labels[type] || type;
  };

  const getCaseTypeShort = (type) => {
    const labels = {
      pip: 'PIP',
      disciplinary: 'Disciplinary',
      grievance: 'Grievance'
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Draft',
      open: 'Open',
      investigation: 'Investigation',
      hearing_scheduled: 'Hearing Scheduled',
      awaiting_decision: 'Awaiting Decision',
      appeal: 'Appeal',
      closed: 'Closed'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return '#9e9e9e';
      case 'open': return '#2196f3';
      case 'investigation': return '#ff9800';
      case 'hearing_scheduled': return '#9c27b0';
      case 'awaiting_decision': return '#f44336';
      case 'appeal': return '#e91e63';
      case 'closed': return '#4caf50';
      default: return '#666';
    }
  };

  const getCaseTypeColor = (type) => {
    switch (type) {
      case 'pip': return '#ff9800';
      case 'disciplinary': return '#f44336';
      case 'grievance': return '#9c27b0';
      default: return '#666';
    }
  };

  // If viewing a case detail
  if (selectedCase) {
    return (
      <HRCaseDetail
        caseId={selectedCase.id}
        user={user}
        onBack={handleBackFromDetail}
      />
    );
  }

  // Employee view - PIPs and grievance submission
  if (!canManageCases) {
    return (
      <EmployeeHRView user={user} onSelectCase={handleCaseClick} />
    );
  }

  // Main dashboard view
  return (
    <div style={{ padding: '24px', background: '#fce4ec', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#111' }}>HR Cases</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: '#c2185b',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          + New Case
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#c2185b' }}>{stats.active_cases || 0}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>Active Cases</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#ff9800' }}>{stats.active_pips || 0}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>Active PIPs</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#f44336' }}>{stats.active_disciplinary || 0}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>Disciplinary</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#9c27b0' }}>{stats.active_grievances || 0}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>Grievances</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#e91e63' }}>{stats.pending_appeals || 0}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>Pending Appeals</div>
          </div>
        </div>
      )}

      {/* ACAS Reminder Banner */}
      <div style={{
        background: '#e8f5e9',
        border: '1px solid #81c784',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px'
      }}>
        <h4 style={{ margin: '0 0 8px', color: '#2e7d32' }}>ACAS Code of Practice</h4>
        <p style={{ margin: 0, color: '#424242', fontSize: '14px' }}>
          All disciplinary and grievance procedures must follow the ACAS Code of Practice.
          Employees have the right to be accompanied at formal hearings. Decisions must be
          confirmed in writing with the right to appeal.
        </p>
      </div>

      {/* Tabs and Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['active', 'draft', 'closed'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === tab ? '#c2185b' : '#fff',
                color: activeTab === tab ? '#fff' : '#424242',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? '600' : '400'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            background: '#fff',
            color: '#424242',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Types</option>
          <option value="pip">PIP Only</option>
          <option value="disciplinary">Disciplinary Only</option>
          <option value="grievance">Grievance Only</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Cases List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading cases...</div>
      ) : cases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', color: '#666' }}>
          No cases found
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#424242', fontWeight: '600' }}>Reference</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#424242', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#424242', fontWeight: '600' }}>Employee</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#424242', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#424242', fontWeight: '600' }}>Opened</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#424242', fontWeight: '600' }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((hrCase, index) => (
                <tr
                  key={hrCase.id}
                  onClick={() => handleCaseClick(hrCase)}
                  style={{
                    borderBottom: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    background: index % 2 === 0 ? '#fff' : '#fafafa'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseOut={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#fff' : '#fafafa'}
                >
                  <td style={{ padding: '12px 16px', color: '#111', fontWeight: '500' }}>
                    {hrCase.case_reference}
                    {hrCase.confidential && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#c62828' }}>
                        CONFIDENTIAL
                      </span>
                    )}
                    {hrCase.legal_hold && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#e65100' }}>
                        LEGAL HOLD
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: getCaseTypeColor(hrCase.case_type) + '20',
                      color: getCaseTypeColor(hrCase.case_type)
                    }}>
                      {getCaseTypeShort(hrCase.case_type)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#424242' }}>{hrCase.employee_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: getStatusColor(hrCase.status) + '20',
                      color: getStatusColor(hrCase.status)
                    }}>
                      {getStatusLabel(hrCase.status)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#424242' }}>
                    {new Date(hrCase.opened_date).toLocaleDateString('en-GB')}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#424242' }}>
                    {hrCase.case_owner_name || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <CreateCaseModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}

export default HRCasesDashboard;
