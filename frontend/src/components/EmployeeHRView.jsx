/**
 * VoidStaffOS - Employee HR View
 * Employee-facing view for PIPs (encouraging/goal-focused) and grievance submission.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-02-04
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: HR Cases
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import GrievanceSubmitForm from './GrievanceSubmitForm';

function EmployeeHRView({ user, onSelectCase }) {
  const [loading, setLoading] = useState(true);
  const [myPips, setMyPips] = useState([]);
  const [activeTab, setActiveTab] = useState('pips');

  useEffect(() => {
    fetchMyPips();
  }, []);

  const fetchMyPips = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/hr-cases/pip/my-pips');
      if (response.ok) {
        const data = await response.json();
        setMyPips(data.pips || []);
      }
    } catch (err) {
      console.error('Fetch PIPs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      open: 'In Progress',
      investigation: 'In Progress',
      hearing_scheduled: 'Review Scheduled',
      awaiting_decision: 'Under Review',
      closed: 'Completed'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
      case 'investigation': return '#2196f3';
      case 'hearing_scheduled': return '#9c27b0';
      case 'awaiting_decision': return '#ff9800';
      case 'closed': return '#4caf50';
      default: return '#666';
    }
  };

  const getOutcomeLabel = (outcome) => {
    if (!outcome) return null;
    const labels = {
      passed: 'Objectives Met — Well Done!',
      extended: 'Extended — Keep Going',
      failed: 'Not Met',
      cancelled: 'Cancelled'
    };
    return labels[outcome] || outcome;
  };

  const getProgressPercent = (pip) => {
    const total = parseInt(pip.total_objectives) || 0;
    if (total === 0) return 0;
    const met = parseInt(pip.objectives_met) || 0;
    return Math.round((met / total) * 100);
  };

  const getOnTrackPercent = (pip) => {
    const total = parseInt(pip.total_objectives) || 0;
    if (total === 0) return 0;
    const onTrack = parseInt(pip.objectives_on_track) || 0;
    const met = parseInt(pip.objectives_met) || 0;
    return Math.round(((met + onTrack) / total) * 100);
  };

  return (
    <div style={{ padding: '24px', background: '#fce4ec', minHeight: '100vh' }}>
      <h2 style={{ margin: '0 0 8px', color: '#111' }}>My Development & Support</h2>
      <p style={{ margin: '0 0 24px', color: '#424242', fontSize: '14px' }}>
        View your development plans and submit confidential grievances.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('pips')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'pips' ? '#c2185b' : '#fff',
            color: activeTab === 'pips' ? '#fff' : '#424242',
            cursor: 'pointer',
            fontWeight: activeTab === 'pips' ? '600' : '400'
          }}
        >
          My Development Plans
        </button>
        <button
          onClick={() => setActiveTab('grievances')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'grievances' ? '#c2185b' : '#fff',
            color: activeTab === 'grievances' ? '#fff' : '#424242',
            cursor: 'pointer',
            fontWeight: activeTab === 'grievances' ? '600' : '400'
          }}
        >
          Grievances
        </button>
      </div>

      {/* PIPs Tab */}
      {activeTab === 'pips' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</div>
          ) : myPips.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center',
              color: '#666'
            }}>
              <p style={{ fontSize: '16px', margin: '0 0 8px' }}>No active development plans</p>
              <p style={{ fontSize: '14px', margin: 0 }}>You don't currently have any performance improvement plans.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {myPips.map(pip => {
                const progressPct = getProgressPercent(pip);
                const onTrackPct = getOnTrackPercent(pip);

                return (
                  <div
                    key={pip.id}
                    onClick={() => onSelectCase && onSelectCase(pip)}
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #e0e0e0',
                      cursor: onSelectCase ? 'pointer' : 'default',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontWeight: '600', color: '#111', fontSize: '16px' }}>
                          Development Plan
                        </span>
                        <span style={{ marginLeft: '12px', fontSize: '13px', color: '#666' }}>
                          {pip.case_reference}
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: getStatusColor(pip.status) + '20',
                        color: getStatusColor(pip.status)
                      }}>
                        {getStatusLabel(pip.status)}
                      </span>
                    </div>

                    {/* Summary */}
                    <p style={{ margin: '0 0 16px', color: '#424242', fontSize: '14px' }}>
                      {pip.summary}
                    </p>

                    {/* Progress Bar */}
                    {parseInt(pip.total_objectives) > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', color: '#424242' }}>
                            Objectives Progress
                          </span>
                          <span style={{ fontSize: '13px', color: '#424242', fontWeight: '500' }}>
                            {pip.objectives_met} of {pip.total_objectives} met ({progressPct}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', background: '#e0e0e0', borderRadius: '8px', height: '10px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${onTrackPct}%`,
                            background: '#4caf50',
                            height: '100%',
                            borderRadius: '8px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#666' }}>
                            {pip.objectives_on_track} on track
                          </span>
                          {pip.target_close_date && (
                            <span style={{ fontSize: '11px', color: '#666' }}>
                              Target: {new Date(pip.target_close_date).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Outcome */}
                    {pip.status === 'closed' && pip.pip_outcome && (
                      <div style={{
                        padding: '12px',
                        background: pip.pip_outcome === 'passed' ? '#e8f5e9' : '#fff3e0',
                        borderRadius: '8px',
                        marginTop: '8px'
                      }}>
                        <strong style={{ color: pip.pip_outcome === 'passed' ? '#2e7d32' : '#e65100' }}>
                          Outcome:
                        </strong>
                        <span style={{ marginLeft: '8px', color: '#424242' }}>
                          {getOutcomeLabel(pip.pip_outcome)}
                        </span>
                      </div>
                    )}

                    {/* Encouraging message for active PIPs */}
                    {pip.status !== 'closed' && (
                      <div style={{
                        padding: '12px',
                        background: '#e3f2fd',
                        borderRadius: '8px',
                        marginTop: '8px'
                      }}>
                        <p style={{ margin: 0, color: '#1565c0', fontSize: '13px' }}>
                          💡 This development plan is designed to help you succeed. Your manager and HR are here to support you.
                          Don't hesitate to ask for help or discuss any concerns.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grievances Tab */}
      {activeTab === 'grievances' && (
        <GrievanceSubmitForm user={user} />
      )}
    </div>
  );
}

export default EmployeeHRView;
