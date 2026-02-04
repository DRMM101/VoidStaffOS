/**
 * VoidStaffOS - Absence Dashboard Component
 * Overview of sick leave, statutory leave, and RTW interviews.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 30/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: LeaveOS
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import SickLeaveReport from './SickLeaveReport';
import AbsenceRequest from './AbsenceRequest';
import ReturnToWorkForm from './ReturnToWorkForm';

function AbsenceDashboard({ user, navParams }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [myAbsences, setMyAbsences] = useState([]);
  const [pendingRTW, setPendingRTW] = useState([]);
  const [pendingFollowUps, setPendingFollowUps] = useState([]);
  const [teamAbsences, setTeamAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);

  // Modal states
  const [showSickReport, setShowSickReport] = useState(false);
  const [showAbsenceRequest, setShowAbsenceRequest] = useState(false);
  const [showRTW, setShowRTW] = useState(null); // { leaveRequestId, employeeName }

  const isManager = user?.role_name === 'Manager' || user?.role_name === 'Admin';

  // Handle navigation params (e.g., from notification click)
  useEffect(() => {
    if (navParams) {
      if (navParams.tab) {
        setActiveTab(navParams.tab);
      }
      if (navParams.highlightId) {
        setHighlightedId(navParams.highlightId);
        // Clear highlight after 5 seconds
        setTimeout(() => setHighlightedId(null), 5000);
      }
    }
  }, [navParams]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch my absences (sick/statutory)
      const myResponse = await fetch('/api/leave/my-requests', {
        credentials: 'include'
      });
      const myData = await myResponse.json();
      if (myResponse.ok) {
        // Filter to show sick and statutory leave
        const filtered = myData.leave_requests?.filter(r =>
          r.absence_category && r.absence_category !== 'annual'
        ) || [];
        setMyAbsences(filtered);
      }

      // If manager, fetch pending RTW interviews and follow-ups
      if (isManager) {
        const rtwResponse = await fetch('/api/sick-leave/rtw/pending', {
          credentials: 'include'
        });
        const rtwData = await rtwResponse.json();
        if (rtwResponse.ok) {
          setPendingRTW(rtwData.pending_rtw || []);
        }

        // Fetch pending follow-ups
        const followUpResponse = await fetch('/api/sick-leave/rtw/follow-ups', {
          credentials: 'include'
        });
        const followUpData = await followUpResponse.json();
        if (followUpResponse.ok) {
          setPendingFollowUps(followUpData.pending_follow_ups || []);
        }

        // Fetch team absences
        const teamResponse = await fetch('/api/leave/team', {
          credentials: 'include'
        });
        const teamData = await teamResponse.json();
        if (teamResponse.ok) {
          const filtered = teamData.leave_requests?.filter(r =>
            r.absence_category && r.absence_category !== 'annual'
          ) || [];
          setTeamAbsences(filtered);
        }
      }
    } catch (err) {
      setError('Failed to load absence data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getCategoryBadge = (category) => {
    const colors = {
      sick: '#f44336',
      maternity: '#9c27b0',
      paternity: '#3f51b5',
      adoption: '#9c27b0',
      bereavement: '#607d8b',
      jury_duty: '#795548',
      compassionate: '#ff9800',
      toil: '#4caf50',
      unpaid: '#9e9e9e'
    };
    const color = colors[category] || '#2196f3';
    return (
      <span
        className="category-badge"
        style={{
          background: color,
          color: '#fff',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          textTransform: 'capitalize'
        }}
      >
        {category?.replace('_', ' ')}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: '#fff3e0', color: '#e65100' },
      approved: { bg: '#e8f5e9', color: '#2e7d32' },
      rejected: { bg: '#ffebee', color: '#c62828' },
      cancelled: { bg: '#eceff1', color: '#546e7a' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span style={{ background: style.bg, color: style.color, padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <div className="loading" style={{ color: '#333' }}>Loading absence data...</div>;
  }

  return (
    <div className="absence-dashboard" style={{ background: '#e3f2fd', padding: '24px', minHeight: '100%', borderRadius: '12px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: '#000', margin: 0, fontWeight: '600' }}>Absence Management</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowSickReport(true)} className="btn-warning" style={{ background: '#f44336', color: '#fff', borderRadius: '8px' }}>
            Report Sick
          </button>
          <button onClick={() => setShowAbsenceRequest(true)} className="primary-btn">
            Request Leave
          </button>
        </div>
      </div>

      {/* Tabs for managers */}
      {isManager && (
        <div className="tabs" style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #bbdefb', background: '#bbdefb', borderRadius: '8px 8px 0 0' }}>
          {['overview', 'my-absences', 'team', 'rtw', 'follow-ups'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: activeTab === tab ? '#fff' : 'transparent',
                borderBottom: activeTab === tab ? '2px solid #1976d2' : '2px solid transparent',
                color: activeTab === tab ? '#1976d2' : '#111',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? '600' : '500'
              }}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'my-absences' && 'My Absences'}
              {tab === 'team' && 'Team Absences'}
              {tab === 'rtw' && `RTW Interviews ${pendingRTW.length > 0 ? `(${pendingRTW.length})` : ''}`}
              {tab === 'follow-ups' && `Follow-ups ${pendingFollowUps.length > 0 ? `(${pendingFollowUps.length})` : ''}`}
            </button>
          ))}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="overview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {/* Quick Actions Card */}
          <div className="card" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h4 style={{ marginTop: 0, color: '#212121' }}>Quick Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => setShowSickReport(true)} style={{ padding: '12px', background: '#ffebee', border: '1px solid #f44336', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
                <strong style={{ color: '#c62828' }}>🤒 Report Sick</strong>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#424242' }}>Let your manager know you're unwell</p>
              </button>
              <button onClick={() => setShowAbsenceRequest(true)} style={{ padding: '12px', background: '#e3f2fd', border: '1px solid #2196f3', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
                <strong style={{ color: '#1565c0' }}>📅 Request Leave</strong>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#424242' }}>Maternity, paternity, bereavement, etc.</p>
              </button>
            </div>
          </div>

          {/* Recent Absences Card */}
          <div className="card" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h4 style={{ marginTop: 0, color: '#212121' }}>My Recent Absences</h4>
            {myAbsences.length === 0 ? (
              <p style={{ color: '#424242' }}>No recent absences recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myAbsences.slice(0, 3).map(absence => (
                  <div key={absence.id} style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {getCategoryBadge(absence.absence_category)}
                      {getStatusBadge(absence.status)}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '14px', color: '#333' }}>
                      {formatDate(absence.leave_start_date)}
                      {absence.leave_end_date && absence.leave_end_date !== absence.leave_start_date &&
                        ` - ${formatDate(absence.leave_end_date)}`
                      }
                      {!absence.leave_end_date && ' (ongoing)'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending RTW for Managers */}
          {isManager && pendingRTW.length > 0 && (
            <div className="card" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid #ff9800' }}>
              <h4 style={{ marginTop: 0, color: '#e65100' }}>⚠️ RTW Interviews Needed</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingRTW.slice(0, 3).map(rtw => (
                  <div key={rtw.id} style={{ padding: '12px', background: '#fff3e0', borderRadius: '8px' }}>
                    <strong style={{ color: '#212121' }}>{rtw.employee_name}</strong>
                    <div style={{ fontSize: '14px', color: '#424242', marginTop: '4px' }}>
                      Returned: {formatDate(rtw.leave_end_date)}
                    </div>
                    <button
                      onClick={() => setShowRTW({ leaveRequestId: rtw.id, employeeName: rtw.employee_name })}
                      style={{ marginTop: '8px', padding: '6px 12px', fontSize: '14px' }}
                    >
                      Start RTW Interview
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* My Absences Tab */}
      {activeTab === 'my-absences' && (
        <div className="absences-list">
          {myAbsences.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#424242' }}>
              <p>No absences recorded.</p>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#e0e0e0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Dates</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Days</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>RTW</th>
                </tr>
              </thead>
              <tbody>
                {myAbsences.map(absence => (
                  <tr key={absence.id} style={{ borderBottom: '1px solid #e0e0e0', background: '#fff' }}>
                    <td style={{ padding: '12px', color: '#111' }}>{getCategoryBadge(absence.absence_category)}</td>
                    <td style={{ padding: '12px', color: '#111' }}>
                      {formatDate(absence.leave_start_date)}
                      {absence.leave_end_date ? ` - ${formatDate(absence.leave_end_date)}` : ' (ongoing)'}
                    </td>
                    <td style={{ padding: '12px', color: '#111' }}>{absence.total_days || '-'}</td>
                    <td style={{ padding: '12px', color: '#111' }}>{getStatusBadge(absence.status)}</td>
                    <td style={{ padding: '12px', color: '#111' }}>
                      {absence.rtw_required && (
                        absence.rtw_completed ?
                          <span style={{ color: '#2e7d32' }}>✓ Complete</span> :
                          <span style={{ color: '#e65100' }}>Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Team Absences Tab (Manager only) */}
      {activeTab === 'team' && isManager && (
        <div className="team-absences">
          {teamAbsences.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#424242' }}>
              <p>No team absences recorded.</p>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#e0e0e0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Employee</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Dates</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Days</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#212121', fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamAbsences.map(absence => (
                  <tr key={absence.id} style={{
                    borderBottom: '1px solid #e0e0e0',
                    background: highlightedId === absence.id ? '#fff3e0' : '#fff',
                    transition: 'background 0.3s',
                    boxShadow: highlightedId === absence.id ? 'inset 0 0 0 2px #ff9800' : 'none'
                  }}>
                    <td style={{ padding: '12px', color: '#111', fontWeight: '500' }}>{absence.employee_name}</td>
                    <td style={{ padding: '12px', color: '#111' }}>{getCategoryBadge(absence.absence_category)}</td>
                    <td style={{ padding: '12px', color: '#111' }}>
                      {formatDate(absence.leave_start_date)}
                      {absence.leave_end_date ? ` - ${formatDate(absence.leave_end_date)}` : ' (ongoing)'}
                    </td>
                    <td style={{ padding: '12px', color: '#111' }}>{absence.total_days || '-'}</td>
                    <td style={{ padding: '12px', color: '#111' }}>{getStatusBadge(absence.status)}</td>
                    <td style={{ padding: '12px', color: '#111' }}>
                      {absence.rtw_required && !absence.rtw_completed && (
                        <button
                          onClick={() => setShowRTW({ leaveRequestId: absence.id, employeeName: absence.employee_name })}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          RTW Interview
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* RTW Tab (Manager only) */}
      {activeTab === 'rtw' && isManager && (
        <div className="rtw-list">
          <div className="info-banner" style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 8px', color: '#1b5e20' }}>Return to Work Conversations</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#2e7d32' }}>
              These are supportive wellbeing conversations to help employees transition back after sick leave.
              They are <strong>not</strong> disciplinary and should focus on support, adjustments, and wellbeing.
            </p>
          </div>

          {pendingRTW.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#424242' }}>
              <p>No pending RTW interviews.</p>
            </div>
          ) : (
            <div className="rtw-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {pendingRTW.map(rtw => (
                <div key={rtw.id} className="rtw-card" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }}>
                  <h4 style={{ margin: '0 0 12px', color: '#212121' }}>{rtw.employee_name}</h4>
                  <div style={{ fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                    <strong style={{ color: '#212121' }}>Sick leave:</strong> {formatDate(rtw.leave_start_date)} - {formatDate(rtw.leave_end_date)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                    <strong style={{ color: '#212121' }}>Duration:</strong> {rtw.total_days} day{rtw.total_days !== 1 ? 's' : ''}
                  </div>
                  {rtw.sick_reason && (
                    <div style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
                      <strong style={{ color: '#212121' }}>Reason:</strong> {rtw.sick_reason.replace('_', ' ')}
                    </div>
                  )}
                  <button
                    onClick={() => setShowRTW({ leaveRequestId: rtw.id, employeeName: rtw.employee_name })}
                    className="primary-btn"
                    style={{ width: '100%' }}
                  >
                    Conduct RTW Interview
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Follow-ups Tab (Manager only) */}
      {activeTab === 'follow-ups' && isManager && (
        <div className="follow-ups-list">
          <div className="info-banner" style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 8px', color: '#0d47a1' }}>Scheduled Follow-ups</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#1565c0' }}>
              These are follow-up conversations scheduled after RTW interviews.
              Check in with employees to ensure their return to work is going smoothly.
            </p>
          </div>

          {pendingFollowUps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#424242' }}>
              <p>No pending follow-ups scheduled.</p>
            </div>
          ) : (
            <div className="follow-up-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {pendingFollowUps.map(followUp => (
                <div key={followUp.id} className="follow-up-card" style={{
                  background: '#fff',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: new Date(followUp.follow_up_date) <= new Date() ? '2px solid #ff9800' : '1px solid #e0e0e0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: '#212121' }}>{followUp.employee_name}</h4>
                    {new Date(followUp.follow_up_date) <= new Date() && (
                      <span style={{ background: '#ff9800', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        Due
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                    <strong style={{ color: '#212121' }}>Follow-up date:</strong> {formatDate(followUp.follow_up_date)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                    <strong style={{ color: '#212121' }}>Original sick leave:</strong> {formatDate(followUp.leave_start_date)} - {formatDate(followUp.leave_end_date)}
                  </div>
                  {followUp.follow_up_notes && (
                    <div style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
                      <strong style={{ color: '#212121' }}>Focus areas:</strong> {followUp.follow_up_notes}
                    </div>
                  )}
                  {followUp.oh_referral_recommended && (
                    <div style={{ fontSize: '14px', color: '#e65100', marginBottom: '12px' }}>
                      <strong>OH Referral recommended</strong>
                    </div>
                  )}
                  {followUp.workplace_adjustments && (
                    <div style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
                      <strong style={{ color: '#212121' }}>Adjustments:</strong> {followUp.workplace_adjustments}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showSickReport && (
        <SickLeaveReport
          onClose={() => setShowSickReport(false)}
          onSubmit={() => {
            setShowSickReport(false);
            fetchData();
          }}
        />
      )}

      {showAbsenceRequest && (
        <AbsenceRequest
          onClose={() => setShowAbsenceRequest(false)}
          onSubmit={() => {
            setShowAbsenceRequest(false);
            fetchData();
          }}
        />
      )}

      {showRTW && (
        <ReturnToWorkForm
          leaveRequestId={showRTW.leaveRequestId}
          employeeName={showRTW.employeeName}
          onClose={() => setShowRTW(null)}
          onComplete={() => {
            setShowRTW(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

export default AbsenceDashboard;
