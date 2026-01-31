/**
 * VoidStaffOS - Employee HR View
 * Employee-facing view for PIPs (encouraging, goal-focused) and grievances.
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
import GrievanceSubmitForm from './GrievanceSubmitForm';

function EmployeeHRView({ user, onSelectCase }) {
  const [myPIPs, setMyPIPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('development'); // 'development' or 'grievance'

  useEffect(() => {
    fetchMyPIPs();
  }, []);

  const fetchMyPIPs = async () => {
    try {
      const response = await apiFetch('/api/hr-cases/pip/my-pips');
      if (response.ok) {
        const data = await response.json();
        setMyPIPs(data.pips || []);
      }
    } catch (err) {
      console.error('Fetch PIPs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 75) return '#4caf50';
    if (percentage >= 50) return '#ff9800';
    return '#2196f3';
  };

  const getEncouragingMessage = (pip) => {
    const onTrackPct = pip.objectives_on_track && pip.total_objectives
      ? Math.round((pip.objectives_on_track / pip.total_objectives) * 100)
      : 0;

    if (pip.pip_outcome === 'passed') {
      return "Congratulations! You've successfully completed this development plan.";
    }
    if (onTrackPct >= 75) {
      return "Excellent progress! You're doing really well - keep up the great work!";
    }
    if (onTrackPct >= 50) {
      return "Good progress! You're on track. Keep focusing on your goals.";
    }
    if (pip.total_objectives > 0) {
      return "Every step forward counts. Your manager is here to support you.";
    }
    return "Your development objectives will be set with your manager. This is an opportunity to grow.";
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Setting Up',
      open: 'Active',
      investigation: 'In Review',
      hearing_scheduled: 'Meeting Scheduled',
      awaiting_decision: 'Under Review',
      appeal: 'Appeal',
      closed: 'Completed'
    };
    return labels[status] || status;
  };

  const activePIPs = myPIPs.filter(p => p.status !== 'closed');
  const completedPIPs = myPIPs.filter(p => p.status === 'closed');

  return (
    <div style={{ padding: '24px', background: '#e8f5e9', minHeight: '100vh' }}>
      <h2 style={{ margin: '0 0 24px', color: '#111' }}>My Development & Support</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('development')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'development' ? '#2e7d32' : '#fff',
            color: activeTab === 'development' ? '#fff' : '#424242',
            cursor: 'pointer',
            fontWeight: activeTab === 'development' ? '600' : '400'
          }}
        >
          Development Plans {activePIPs.length > 0 && `(${activePIPs.length})`}
        </button>
        <button
          onClick={() => setActiveTab('grievance')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'grievance' ? '#9c27b0' : '#fff',
            color: activeTab === 'grievance' ? '#fff' : '#424242',
            cursor: 'pointer',
            fontWeight: activeTab === 'grievance' ? '600' : '400'
          }}
        >
          Raise a Concern
        </button>
      </div>

      {/* Development Plans Tab */}
      {activeTab === 'development' && (
        <div>
          {/* Encouraging intro */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid #c8e6c9'
          }}>
            <h3 style={{ margin: '0 0 12px', color: '#2e7d32' }}>Your Growth Journey</h3>
            <p style={{ margin: 0, color: '#424242', lineHeight: '1.6' }}>
              Development plans are designed to help you succeed and grow in your role.
              Your manager and HR are here to support you every step of the way.
              Focus on one goal at a time, and remember that progress - not perfection - is the aim.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</div>
          ) : activePIPs.length === 0 && completedPIPs.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: '#666'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#127793;</div>
              <p style={{ margin: 0 }}>No development plans at the moment. Keep up the great work!</p>
            </div>
          ) : (
            <>
              {/* Active PIPs */}
              {activePIPs.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <h4 style={{ margin: '0 0 16px', color: '#424242' }}>Active Development Plans</h4>
                  {activePIPs.map(pip => {
                    const progressPct = pip.total_objectives > 0
                      ? Math.round((pip.objectives_met / pip.total_objectives) * 100)
                      : 0;
                    const onTrackPct = pip.total_objectives > 0
                      ? Math.round((pip.objectives_on_track / pip.total_objectives) * 100)
                      : 0;

                    return (
                      <div
                        key={pip.id}
                        onClick={() => onSelectCase(pip)}
                        style={{
                          background: '#fff',
                          borderRadius: '12px',
                          padding: '20px',
                          marginBottom: '16px',
                          cursor: 'pointer',
                          border: '2px solid #c8e6c9',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#4caf50'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#c8e6c9'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              background: '#e8f5e9',
                              color: '#2e7d32',
                              marginBottom: '8px'
                            }}>
                              {getStatusLabel(pip.status)}
                            </span>
                            <h4 style={{ margin: '0 0 4px', color: '#111' }}>Development Plan</h4>
                            <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
                              Started {new Date(pip.opened_date).toLocaleDateString('en-GB')}
                              {pip.target_close_date && ` • Target: ${new Date(pip.target_close_date).toLocaleDateString('en-GB')}`}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {pip.total_objectives > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', color: '#666' }}>Progress</span>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: getProgressColor(onTrackPct) }}>
                                {onTrackPct}% on track
                              </span>
                            </div>
                            <div style={{
                              height: '8px',
                              background: '#e0e0e0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${onTrackPct}%`,
                                background: `linear-gradient(90deg, ${getProgressColor(onTrackPct)}, ${getProgressColor(onTrackPct)}dd)`,
                                borderRadius: '4px',
                                transition: 'width 0.3s'
                              }} />
                            </div>
                            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#666' }}>
                              {pip.objectives_met} of {pip.total_objectives} objectives completed
                            </p>
                          </div>
                        )}

                        {/* Encouraging message */}
                        <div style={{
                          background: '#f1f8e9',
                          borderRadius: '8px',
                          padding: '12px',
                          marginTop: '12px'
                        }}>
                          <p style={{ margin: 0, color: '#33691e', fontSize: '14px' }}>
                            &#128170; {getEncouragingMessage(pip)}
                          </p>
                        </div>

                        <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#2e7d32', fontWeight: '500' }}>
                          Click to view your objectives &rarr;
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Completed PIPs */}
              {completedPIPs.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 16px', color: '#424242' }}>Completed Plans</h4>
                  {completedPIPs.map(pip => (
                    <div
                      key={pip.id}
                      onClick={() => onSelectCase(pip)}
                      style={{
                        background: '#fff',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '12px',
                        cursor: 'pointer',
                        border: '1px solid #e0e0e0',
                        opacity: 0.8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: '#111', fontWeight: '500' }}>Development Plan</span>
                          <span style={{ marginLeft: '12px', color: '#666', fontSize: '13px' }}>
                            {new Date(pip.opened_date).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: pip.pip_outcome === 'passed' ? '#e8f5e9' : '#fff3e0',
                          color: pip.pip_outcome === 'passed' ? '#2e7d32' : '#e65100'
                        }}>
                          {pip.pip_outcome === 'passed' ? 'Completed Successfully' :
                           pip.pip_outcome === 'extended' ? 'Extended' :
                           pip.pip_outcome === 'cancelled' ? 'Cancelled' : 'Completed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Support Resources */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '24px',
            border: '1px solid #c8e6c9'
          }}>
            <h4 style={{ margin: '0 0 12px', color: '#2e7d32' }}>Support Available to You</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#424242', lineHeight: '1.8' }}>
              <li>Regular 1-to-1 meetings with your manager</li>
              <li>HR support and guidance throughout the process</li>
              <li>Training and development resources</li>
              <li>Right to be accompanied at formal meetings</li>
            </ul>
          </div>
        </div>
      )}

      {/* Grievance Tab */}
      {activeTab === 'grievance' && (
        <div>
          <div style={{
            background: '#fff3e0',
            border: '1px solid #ffb74d',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h4 style={{ margin: '0 0 8px', color: '#e65100' }}>Confidential Process</h4>
            <p style={{ margin: 0, color: '#424242', fontSize: '14px' }}>
              If you have a workplace concern, you can submit a formal grievance. Your submission
              will be handled confidentially by HR. You have the right to be accompanied by a
              workplace colleague or trade union representative at any grievance meeting.
            </p>
          </div>

          <GrievanceSubmitForm user={user} />
        </div>
      )}
    </div>
  );
}

export default EmployeeHRView;
