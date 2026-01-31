/**
 * VoidStaffOS - Offboarding Dashboard
 * HR dashboard for managing employee offboarding workflows.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: Offboarding
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import InitiateOffboardingModal from './InitiateOffboardingModal';
import OffboardingDetail from './OffboardingDetail';

function OffboardingDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';

  useEffect(() => {
    fetchWorkflows();
    fetchStats();
  }, [activeTab]);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/api/offboarding?limit=100';
      if (activeTab === 'active') {
        url += '&status=pending&status=in_progress';
      } else if (activeTab === 'completed') {
        url += '&status=completed';
      } else if (activeTab === 'cancelled') {
        url += '&status=cancelled';
      }
      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }
      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Fetch workflows error:', err);
      setError('Failed to load offboarding workflows');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiFetch('/api/offboarding/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  const handleInitiateSuccess = () => {
    setShowInitiateModal(false);
    fetchWorkflows();
    fetchStats();
  };

  const handleWorkflowClick = (workflow) => {
    setSelectedWorkflow(workflow);
  };

  const handleBackFromDetail = () => {
    setSelectedWorkflow(null);
    fetchWorkflows();
    fetchStats();
  };

  const getTerminationLabel = (type) => {
    const labels = {
      resignation: 'Resignation',
      termination: 'Termination',
      redundancy: 'Redundancy',
      retirement: 'Retirement',
      end_of_contract: 'End of Contract',
      tupe_transfer: 'TUPE Transfer',
      death_in_service: 'Death in Service'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'in_progress': return '#2196f3';
      case 'completed': return '#4caf50';
      case 'cancelled': return '#9e9e9e';
      default: return '#555';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const lastDay = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDay.setHours(0, 0, 0, 0);
    const diffTime = lastDay - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Show detail view if a workflow is selected
  if (selectedWorkflow) {
    return (
      <OffboardingDetail
        workflowId={selectedWorkflow.id}
        onBack={handleBackFromDetail}
        user={user}
      />
    );
  }

  return (
    <div className="offboarding-dashboard" style={{ padding: '20px' }}>
      <div className="page-header" style={{
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff' }}>Offboarding</h2>
          <p style={{ margin: '8px 0 0', color: '#fff', fontSize: '14px' }}>
            Manage employee exits with compliance tracking
          </p>
        </div>
        {(isAdmin || isManager) && (
          <button
            onClick={() => setShowInitiateModal(true)}
            style={{
              padding: '10px 20px',
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            + Initiate Offboarding
          </button>
        )}
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="stats-overview" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #ff9800'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#ff9800' }}>
              {stats.pending || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              Pending
            </div>
          </div>

          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #2196f3'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#2196f3' }}>
              {stats.in_progress || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              In Progress
            </div>
          </div>

          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #f44336'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#f44336' }}>
              {stats.leaving_this_week || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              Leaving This Week
            </div>
          </div>

          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #4caf50'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#4caf50' }}>
              {stats.completed_this_month || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              Completed (Month)
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs" style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '12px'
      }}>
        {['active', 'completed', 'cancelled'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab ? '#1976d2' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '600' : '500',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'active' ? 'Active Workflows' : tab}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* Workflows List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#111' }}>
          Loading workflows...
        </div>
      ) : workflows.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f5f5f5',
          borderRadius: '12px',
          color: '#111'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {activeTab === 'active' ? '✓' : '📋'}
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#111' }}>
            {activeTab === 'active' ? 'No active offboardings' : `No ${activeTab} workflows`}
          </h3>
          <p style={{ margin: 0, fontSize: '14px' }}>
            {activeTab === 'active'
              ? 'There are no employees currently being offboarded.'
              : `No offboarding workflows have been ${activeTab}.`}
          </p>
        </div>
      ) : (
        <div className="workflows-list" style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#111', fontSize: '13px' }}>Employee</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#111', fontSize: '13px' }}>Type</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#111', fontSize: '13px' }}>Last Day</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#111', fontSize: '13px' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#111', fontSize: '13px' }}>Progress</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: '#111', fontSize: '13px' }}></th>
              </tr>
            </thead>
            <tbody>
              {workflows.map(workflow => {
                const daysUntil = getDaysUntil(workflow.last_working_day);
                const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0;
                const isPast = daysUntil !== null && daysUntil < 0;

                return (
                  <tr
                    key={workflow.id}
                    style={{
                      borderBottom: '1px solid #e0e0e0',
                      cursor: 'pointer',
                      background: isUrgent ? '#fff3e0' : '#fff'
                    }}
                    onClick={() => handleWorkflowClick(workflow)}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '500', color: '#111' }}>
                        {workflow.employee_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {workflow.employee_number || workflow.job_title || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: '#111' }}>
                      {getTerminationLabel(workflow.termination_type)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '16px' }}>
                      <div style={{ color: '#111', fontWeight: '500' }}>
                        {formatDate(workflow.last_working_day)}
                      </div>
                      {daysUntil !== null && (
                        <div style={{
                          fontSize: '12px',
                          color: isPast ? '#f44336' : (isUrgent ? '#ff9800' : '#666')
                        }}>
                          {isPast ? `${Math.abs(daysUntil)} days ago` :
                           daysUntil === 0 ? 'Today' :
                           daysUntil === 1 ? 'Tomorrow' :
                           `${daysUntil} days`}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        background: getStatusColor(workflow.status),
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '500',
                        textTransform: 'capitalize'
                      }}>
                        {workflow.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '16px' }}>
                      <div style={{
                        width: '100px',
                        height: '8px',
                        background: '#e0e0e0',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        margin: '0 auto'
                      }}>
                        <div style={{
                          width: `${workflow.checklist_progress || 0}%`,
                          height: '100%',
                          background: '#4caf50',
                          borderRadius: '4px'
                        }} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {workflow.checklist_progress || 0}%
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px' }}>
                      <span style={{ color: '#1976d2', fontSize: '20px' }}>→</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Initiate Modal */}
      {showInitiateModal && (
        <InitiateOffboardingModal
          onClose={() => setShowInitiateModal(false)}
          onSuccess={handleInitiateSuccess}
        />
      )}
    </div>
  );
}

export default OffboardingDashboard;
