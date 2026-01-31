/**
 * VoidStaffOS - HR Case Detail
 * Full case view with tabs for objectives, meetings, notes, witnesses.
 * ACAS-compliant workflows with guidance prompts.
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

function HRCaseDetail({ caseId, user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hrCase, setHRCase] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Sub-data
  const [objectives, setObjectives] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [witnesses, setWitnesses] = useState([]);
  const [milestones, setMilestones] = useState([]);

  // Forms
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [showWitnessForm, setShowWitnessForm] = useState(false);
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);

  // Note form state
  const [newNote, setNewNote] = useState({ content: '', note_type: 'general', visible_to_employee: false });

  // Meeting form state
  const [newMeeting, setNewMeeting] = useState({
    meeting_type: 'hearing',
    scheduled_date: '',
    scheduled_time: '',
    location: '',
    companion_name: '',
    companion_type: ''
  });

  // Objective form state
  const [newObjective, setNewObjective] = useState({
    objective: '',
    success_criteria: '',
    support_provided: '',
    target_date: ''
  });

  // Witness form state
  const [newWitness, setNewWitness] = useState({
    witness_name: '',
    relationship: '',
    statement: ''
  });

  // Outcome form state
  const [outcomeData, setOutcomeData] = useState({
    outcome: '',
    outcome_notes: ''
  });

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  useEffect(() => {
    if (hrCase) {
      if (hrCase.case_type === 'pip') {
        fetchObjectives();
      }
      fetchMeetings();
      fetchNotes();
      fetchWitnesses();
      fetchMilestones();
    }
  }, [hrCase?.id]);

  const fetchCase = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}`);
      if (!response.ok) throw new Error('Failed to load case');
      const data = await response.json();
      setHRCase(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchObjectives = async () => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/objectives`);
      if (response.ok) {
        const data = await response.json();
        setObjectives(data.objectives || []);
      }
    } catch (err) {
      console.error('Fetch objectives error:', err);
    }
  };

  const fetchMeetings = async () => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/meetings`);
      if (response.ok) {
        const data = await response.json();
        setMeetings(data.meetings || []);
      }
    } catch (err) {
      console.error('Fetch meetings error:', err);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.error('Fetch notes error:', err);
    }
  };

  const fetchWitnesses = async () => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/witnesses`);
      if (response.ok) {
        const data = await response.json();
        setWitnesses(data.witnesses || []);
      }
    } catch (err) {
      console.error('Fetch witnesses error:', err);
    }
  };

  const fetchMilestones = async () => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/milestones`);
      if (response.ok) {
        const data = await response.json();
        setMilestones(data.milestones || []);
      }
    } catch (err) {
      console.error('Fetch milestones error:', err);
    }
  };

  const handleOpenCase = async () => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/open`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to open case');
      fetchCase();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (status, notes = '') => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, notes })
      });
      if (!response.ok) throw new Error('Failed to update status');
      fetchCase();
      fetchNotes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/notes`, {
        method: 'POST',
        body: JSON.stringify(newNote)
      });
      if (!response.ok) throw new Error('Failed to add note');
      setNewNote({ content: '', note_type: 'general', visible_to_employee: false });
      setShowNoteForm(false);
      fetchNotes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddMeeting = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/meetings`, {
        method: 'POST',
        body: JSON.stringify(newMeeting)
      });
      if (!response.ok) throw new Error('Failed to schedule meeting');
      setNewMeeting({
        meeting_type: 'hearing',
        scheduled_date: '',
        scheduled_time: '',
        location: '',
        companion_name: '',
        companion_type: ''
      });
      setShowMeetingForm(false);
      fetchMeetings();
      fetchCase();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddObjective = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/objectives`, {
        method: 'POST',
        body: JSON.stringify(newObjective)
      });
      if (!response.ok) throw new Error('Failed to add objective');
      setNewObjective({ objective: '', success_criteria: '', support_provided: '', target_date: '' });
      setShowObjectiveForm(false);
      fetchObjectives();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateObjective = async (objId, status, review_notes) => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/objectives/${objId}`, {
        method: 'PUT',
        body: JSON.stringify({ status, review_notes })
      });
      if (!response.ok) throw new Error('Failed to update objective');
      fetchObjectives();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddWitness = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/witnesses`, {
        method: 'POST',
        body: JSON.stringify(newWitness)
      });
      if (!response.ok) throw new Error('Failed to add witness');
      setNewWitness({ witness_name: '', relationship: '', statement: '' });
      setShowWitnessForm(false);
      fetchWitnesses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCloseCase = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/close`, {
        method: 'POST',
        body: JSON.stringify(outcomeData)
      });
      if (!response.ok) throw new Error('Failed to close case');
      setShowOutcomeForm(false);
      fetchCase();
      fetchNotes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkMeetingHeld = async (meetingId, outcome_summary) => {
    try {
      const response = await apiFetch(`/api/hr-cases/${caseId}/meetings/${meetingId}`, {
        method: 'PUT',
        body: JSON.stringify({ held: true, held_date: new Date().toISOString().split('T')[0], outcome_summary })
      });
      if (!response.ok) throw new Error('Failed to update meeting');
      fetchMeetings();
    } catch (err) {
      alert(err.message);
    }
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

  const getObjectiveStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#9e9e9e';
      case 'on_track': return '#4caf50';
      case 'at_risk': return '#ff9800';
      case 'met': return '#2196f3';
      case 'not_met': return '#f44336';
      default: return '#666';
    }
  };

  const getOutcomeOptions = () => {
    switch (hrCase?.case_type) {
      case 'pip':
        return [
          { value: 'passed', label: 'Passed - Objectives Met' },
          { value: 'extended', label: 'Extended - More Time Needed' },
          { value: 'failed', label: 'Failed - Proceed to Disciplinary' },
          { value: 'cancelled', label: 'Cancelled' }
        ];
      case 'disciplinary':
        return [
          { value: 'no_action', label: 'No Action Required' },
          { value: 'verbal_warning', label: 'Verbal Warning' },
          { value: 'written_warning', label: 'Written Warning' },
          { value: 'final_warning', label: 'Final Written Warning' },
          { value: 'dismissal', label: 'Dismissal' }
        ];
      case 'grievance':
        return [
          { value: 'upheld', label: 'Upheld' },
          { value: 'partially_upheld', label: 'Partially Upheld' },
          { value: 'not_upheld', label: 'Not Upheld' },
          { value: 'withdrawn', label: 'Withdrawn' }
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading case details...</div>;
  }

  if (error || !hrCase) {
    return (
      <div style={{ padding: '24px' }}>
        <button onClick={onBack} style={{ marginBottom: '16px', padding: '8px 16px', cursor: 'pointer' }}>
          &larr; Back
        </button>
        <div style={{ color: '#c62828' }}>{error || 'Case not found'}</div>
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    color: '#111',
    background: '#fff',
    colorScheme: 'light'
  };

  // Employee PIP View - Encouraging, goal-focused
  if (hrCase.employee_view && hrCase.case_type === 'pip') {
    const progress = hrCase.pip_progress || { total: 0, met: 0, on_track: 0 };
    const progressPct = progress.total > 0 ? Math.round((progress.met / progress.total) * 100) : 0;
    const onTrackPct = progress.on_track_percentage || 0;

    return (
      <div style={{ padding: '24px', background: '#e8f5e9', minHeight: '100vh' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#2e7d32',
            cursor: 'pointer',
            fontSize: '14px',
            padding: 0,
            marginBottom: '16px'
          }}
        >
          &larr; Back to Development Plans
        </button>

        {/* Encouraging Header */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '2px solid #c8e6c9'
        }}>
          <h2 style={{ margin: '0 0 8px', color: '#2e7d32' }}>Your Development Plan</h2>
          <p style={{ margin: '0 0 16px', color: '#424242' }}>
            This plan is designed to help you succeed. Focus on your goals one step at a time.
          </p>

          {/* Progress Summary */}
          {progress.total > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: '500', color: '#424242' }}>Your Progress</span>
                <span style={{ fontWeight: '600', color: onTrackPct >= 50 ? '#2e7d32' : '#ff9800' }}>
                  {onTrackPct}% on track
                </span>
              </div>
              <div style={{
                height: '12px',
                background: '#e0e0e0',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${onTrackPct}%`,
                  background: onTrackPct >= 50 ? 'linear-gradient(90deg, #4caf50, #81c784)' : 'linear-gradient(90deg, #ff9800, #ffb74d)',
                  borderRadius: '6px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#666' }}>
                {progress.met} of {progress.total} objectives completed
              </p>
            </div>
          )}

          {/* Encouraging Message */}
          <div style={{
            background: '#f1f8e9',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px'
          }}>
            <p style={{ margin: 0, color: '#33691e', fontSize: '15px' }}>
              {onTrackPct >= 75 ? "&#127881; Excellent work! You're making fantastic progress. Keep it up!" :
               onTrackPct >= 50 ? "&#128170; Great job! You're on track. Continue focusing on your objectives." :
               progress.total > 0 ? "&#127793; Every step counts. Focus on one objective at a time - you've got this!" :
               "&#128218; Your objectives will be discussed with your manager. This is your opportunity to grow."}
            </p>
          </div>
        </div>

        {/* Objectives */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#424242' }}>Your Objectives</h3>

          {objectives.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>
              Your objectives will be set in discussion with your manager.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {objectives.map((obj, index) => (
                <div key={obj.id} style={{
                  border: '2px solid',
                  borderColor: obj.status === 'met' ? '#4caf50' :
                              obj.status === 'on_track' ? '#81c784' :
                              obj.status === 'at_risk' ? '#ffb74d' : '#e0e0e0',
                  borderRadius: '12px',
                  padding: '16px',
                  background: obj.status === 'met' ? '#f1f8e9' : '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: obj.status === 'met' ? '#4caf50' :
                                   obj.status === 'on_track' ? '#81c784' :
                                   obj.status === 'at_risk' ? '#ff9800' : '#e0e0e0',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        {obj.status === 'met' ? '✓' : index + 1}
                      </span>
                      <h4 style={{ margin: 0, color: '#111' }}>{obj.objective}</h4>
                    </div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: obj.status === 'met' ? '#e8f5e9' :
                                 obj.status === 'on_track' ? '#e8f5e9' :
                                 obj.status === 'at_risk' ? '#fff3e0' : '#f5f5f5',
                      color: obj.status === 'met' ? '#2e7d32' :
                            obj.status === 'on_track' ? '#4caf50' :
                            obj.status === 'at_risk' ? '#e65100' : '#666'
                    }}>
                      {obj.status === 'met' ? 'Achieved!' :
                       obj.status === 'on_track' ? 'On Track' :
                       obj.status === 'at_risk' ? 'Needs Focus' : 'In Progress'}
                    </span>
                  </div>

                  <div style={{ marginLeft: '44px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#2e7d32', fontSize: '13px' }}>How to succeed:</strong>
                      <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{obj.success_criteria}</p>
                    </div>

                    {obj.support_provided && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#2e7d32', fontSize: '13px' }}>Support available:</strong>
                        <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{obj.support_provided}</p>
                      </div>
                    )}

                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#666' }}>
                      Target date: {new Date(obj.target_date).toLocaleDateString('en-GB')}
                    </p>

                    {obj.review_notes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#e3f2fd',
                        borderRadius: '8px'
                      }}>
                        <strong style={{ color: '#1565c0', fontSize: '13px' }}>Feedback:</strong>
                        <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{obj.review_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Meetings */}
        {meetings.filter(m => !m.held).length > 0 && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 16px', color: '#424242' }}>Upcoming Meetings</h3>
            {meetings.filter(m => !m.held).map(meeting => (
              <div key={meeting.id} style={{
                padding: '16px',
                background: '#f5f5f5',
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <p style={{ margin: '0 0 4px', fontWeight: '500', color: '#111' }}>
                  {meeting.meeting_type.charAt(0).toUpperCase() + meeting.meeting_type.slice(1)} Meeting
                </p>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                  {new Date(meeting.scheduled_date).toLocaleDateString('en-GB')}
                  {meeting.scheduled_time && ` at ${meeting.scheduled_time}`}
                  {meeting.location && ` - ${meeting.location}`}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Support Info */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #c8e6c9'
        }}>
          <h3 style={{ margin: '0 0 12px', color: '#2e7d32' }}>Remember</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#424242', lineHeight: '1.8' }}>
            <li>Your manager wants you to succeed and is here to support you</li>
            <li>Ask for help whenever you need it - that's what the support is there for</li>
            <li>Progress is more important than perfection</li>
            <li>You can request regular check-ins with your manager</li>
            <li>You have the right to be accompanied at any formal meetings</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#fce4ec', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#c2185b',
            cursor: 'pointer',
            fontSize: '14px',
            padding: 0,
            marginBottom: '8px'
          }}
        >
          &larr; Back to Cases
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 8px', color: '#111' }}>
              {hrCase.case_reference}
              {hrCase.confidential && (
                <span style={{ marginLeft: '12px', fontSize: '12px', color: '#c62828', fontWeight: '400' }}>
                  CONFIDENTIAL
                </span>
              )}
              {hrCase.legal_hold && (
                <span style={{ marginLeft: '12px', fontSize: '12px', color: '#e65100', fontWeight: '400' }}>
                  LEGAL HOLD
                </span>
              )}
            </h2>
            <p style={{ margin: 0, color: '#666' }}>
              {hrCase.case_type === 'pip' ? 'Performance Improvement Plan' :
               hrCase.case_type === 'disciplinary' ? 'Disciplinary Case' :
               'Grievance'} for {hrCase.employee_name}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              background: getStatusColor(hrCase.status) + '20',
              color: getStatusColor(hrCase.status)
            }}>
              {hrCase.status.replace('_', ' ').toUpperCase()}
            </span>

            {hrCase.status === 'draft' && (
              <button
                onClick={handleOpenCase}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2196f3',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Open Case
              </button>
            )}

            {hrCase.status !== 'closed' && hrCase.status !== 'draft' && (
              <button
                onClick={() => setShowOutcomeForm(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#4caf50',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Close Case
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ACAS Guidance */}
      {hrCase.guidance && hrCase.status !== 'closed' && (
        <div style={{
          background: '#e8f5e9',
          border: '1px solid #81c784',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h4 style={{ margin: '0 0 8px', color: '#2e7d32' }}>ACAS Guidance</h4>
          <p style={{ margin: 0, color: '#424242', fontSize: '14px' }}>
            {hrCase.guidance[hrCase.status] || hrCase.guidance.investigation || 'Follow the ACAS Code of Practice throughout this process.'}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['overview', hrCase.case_type === 'pip' ? 'objectives' : null, 'meetings', 'notes', 'witnesses', 'timeline'].filter(Boolean).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab ? '#c2185b' : '#fff',
              color: activeTab === tab ? '#fff' : '#424242',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? '600' : '400',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'objectives' && objectives.length > 0 && ` (${objectives.length})`}
            {tab === 'meetings' && meetings.length > 0 && ` (${meetings.length})`}
            {tab === 'notes' && notes.length > 0 && ` (${notes.length})`}
            {tab === 'witnesses' && witnesses.length > 0 && ` (${witnesses.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
              <div>
                <h4 style={{ margin: '0 0 16px', color: '#424242' }}>Case Details</h4>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#666' }}>Opened:</strong>
                  <span style={{ marginLeft: '8px', color: '#111' }}>
                    {new Date(hrCase.opened_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
                {hrCase.target_close_date && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#666' }}>Target Close:</strong>
                    <span style={{ marginLeft: '8px', color: '#111' }}>
                      {new Date(hrCase.target_close_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#666' }}>Case Owner:</strong>
                  <span style={{ marginLeft: '8px', color: '#111' }}>
                    {hrCase.case_owner_name || 'Unassigned'}
                  </span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#666' }}>Manager:</strong>
                  <span style={{ marginLeft: '8px', color: '#111' }}>
                    {hrCase.manager_name || 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 16px', color: '#424242' }}>Summary</h4>
                <p style={{ margin: 0, color: '#424242', whiteSpace: 'pre-wrap' }}>{hrCase.summary}</p>

                {hrCase.background && (
                  <>
                    <h4 style={{ margin: '24px 0 16px', color: '#424242' }}>Background</h4>
                    <p style={{ margin: 0, color: '#424242', whiteSpace: 'pre-wrap' }}>{hrCase.background}</p>
                  </>
                )}
              </div>
            </div>

            {hrCase.status === 'closed' && (
              <div style={{ marginTop: '24px', borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
                <h4 style={{ margin: '0 0 16px', color: '#424242' }}>Outcome</h4>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#666' }}>Decision:</strong>
                  <span style={{
                    marginLeft: '8px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: '#4caf5020',
                    color: '#4caf50',
                    fontWeight: '500'
                  }}>
                    {(hrCase.pip_outcome || hrCase.disciplinary_outcome || hrCase.grievance_outcome || '').replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                {hrCase.outcome_notes && (
                  <p style={{ margin: '12px 0 0', color: '#424242' }}>{hrCase.outcome_notes}</p>
                )}
                <div style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
                  Closed on {new Date(hrCase.closed_date).toLocaleDateString('en-GB')}
                </div>
              </div>
            )}

            {/* Status Change Buttons */}
            {hrCase.status !== 'closed' && hrCase.status !== 'draft' && (
              <div style={{ marginTop: '24px', borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
                <h4 style={{ margin: '0 0 16px', color: '#424242' }}>Update Status</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {hrCase.status !== 'investigation' && (
                    <button
                      onClick={() => handleStatusChange('investigation')}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ff9800', background: '#fff', color: '#ff9800', cursor: 'pointer' }}
                    >
                      Start Investigation
                    </button>
                  )}
                  {hrCase.status !== 'hearing_scheduled' && (
                    <button
                      onClick={() => setShowMeetingForm(true)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #9c27b0', background: '#fff', color: '#9c27b0', cursor: 'pointer' }}
                    >
                      Schedule Hearing
                    </button>
                  )}
                  {hrCase.status !== 'awaiting_decision' && (
                    <button
                      onClick={() => handleStatusChange('awaiting_decision')}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #f44336', background: '#fff', color: '#f44336', cursor: 'pointer' }}
                    >
                      Awaiting Decision
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Objectives Tab (PIP only) */}
        {activeTab === 'objectives' && hrCase.case_type === 'pip' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#424242' }}>SMART Objectives</h4>
              {hrCase.status !== 'closed' && (
                <button
                  onClick={() => setShowObjectiveForm(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ff9800',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  + Add Objective
                </button>
              )}
            </div>

            {objectives.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No objectives set yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {objectives.map(obj => (
                  <div key={obj.id} style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#fafafa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h5 style={{ margin: '0 0 4px', color: '#111' }}>{obj.objective}</h5>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          Due: {new Date(obj.target_date).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: getObjectiveStatusColor(obj.status) + '20',
                        color: getObjectiveStatusColor(obj.status)
                      }}>
                        {obj.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#666', fontSize: '13px' }}>Success Criteria:</strong>
                      <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{obj.success_criteria}</p>
                    </div>

                    {obj.support_provided && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Support Provided:</strong>
                        <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{obj.support_provided}</p>
                      </div>
                    )}

                    {obj.review_notes && (
                      <div style={{ marginBottom: '8px', background: '#e3f2fd', padding: '8px', borderRadius: '4px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Review Notes:</strong>
                        <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{obj.review_notes}</p>
                      </div>
                    )}

                    {hrCase.status !== 'closed' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button
                          onClick={() => handleUpdateObjective(obj.id, 'on_track', '')}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #4caf50', background: '#fff', color: '#4caf50', cursor: 'pointer', fontSize: '12px' }}
                        >
                          On Track
                        </button>
                        <button
                          onClick={() => handleUpdateObjective(obj.id, 'at_risk', '')}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ff9800', background: '#fff', color: '#ff9800', cursor: 'pointer', fontSize: '12px' }}
                        >
                          At Risk
                        </button>
                        <button
                          onClick={() => handleUpdateObjective(obj.id, 'met', '')}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #2196f3', background: '#fff', color: '#2196f3', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Met
                        </button>
                        <button
                          onClick={() => handleUpdateObjective(obj.id, 'not_met', '')}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #f44336', background: '#fff', color: '#f44336', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Not Met
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Objective Form */}
            {showObjectiveForm && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#fff3e0', borderRadius: '8px' }}>
                <h5 style={{ margin: '0 0 16px', color: '#424242' }}>Add SMART Objective</h5>
                <form onSubmit={handleAddObjective}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Objective (Specific & Measurable) *</label>
                    <textarea
                      value={newObjective.objective}
                      onChange={(e) => setNewObjective({ ...newObjective, objective: e.target.value })}
                      required
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Success Criteria (How will we know it's achieved?) *</label>
                    <textarea
                      value={newObjective.success_criteria}
                      onChange={(e) => setNewObjective({ ...newObjective, success_criteria: e.target.value })}
                      required
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Support Provided</label>
                    <textarea
                      value={newObjective.support_provided}
                      onChange={(e) => setNewObjective({ ...newObjective, support_provided: e.target.value })}
                      rows={2}
                      placeholder="Training, mentoring, resources, etc."
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Target Date (Time-bound) *</label>
                    <input
                      type="date"
                      value={newObjective.target_date}
                      onChange={(e) => setNewObjective({ ...newObjective, target_date: e.target.value })}
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#ff9800', color: '#fff', cursor: 'pointer' }}>
                      Add Objective
                    </button>
                    <button type="button" onClick={() => setShowObjectiveForm(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Meetings Tab */}
        {activeTab === 'meetings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#424242' }}>Meetings & Hearings</h4>
              {hrCase.status !== 'closed' && (
                <button
                  onClick={() => setShowMeetingForm(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#9c27b0',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  + Schedule Meeting
                </button>
              )}
            </div>

            {/* ACAS reminder about companion rights */}
            <div style={{ background: '#e8f5e9', border: '1px solid #81c784', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ margin: 0, color: '#424242', fontSize: '13px' }}>
                <strong>Right to be accompanied:</strong> The employee has the statutory right to be accompanied by a
                workplace colleague or trade union representative at any formal disciplinary or grievance hearing.
              </p>
            </div>

            {meetings.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No meetings scheduled</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {meetings.map(meeting => (
                  <div key={meeting.id} style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: meeting.held ? '#e8f5e9' : '#fafafa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h5 style={{ margin: '0 0 4px', color: '#111' }}>
                          {meeting.meeting_type.charAt(0).toUpperCase() + meeting.meeting_type.slice(1)}
                        </h5>
                        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                          {new Date(meeting.scheduled_date).toLocaleDateString('en-GB')}
                          {meeting.scheduled_time && ` at ${meeting.scheduled_time}`}
                          {meeting.location && ` - ${meeting.location}`}
                        </p>
                        {meeting.companion_name && (
                          <p style={{ margin: '4px 0 0', color: '#9c27b0', fontSize: '13px' }}>
                            Companion: {meeting.companion_name} ({meeting.companion_type || 'unspecified'})
                          </p>
                        )}
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: meeting.held ? '#4caf5020' : '#ff980020',
                        color: meeting.held ? '#4caf50' : '#ff9800'
                      }}>
                        {meeting.held ? 'Held' : 'Scheduled'}
                      </span>
                    </div>

                    {meeting.outcome_summary && (
                      <div style={{ marginTop: '12px', padding: '8px', background: '#e3f2fd', borderRadius: '4px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Outcome:</strong>
                        <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{meeting.outcome_summary}</p>
                      </div>
                    )}

                    {!meeting.held && hrCase.status !== 'closed' && (
                      <button
                        onClick={() => {
                          const outcome = prompt('Enter meeting outcome summary:');
                          if (outcome) handleMarkMeetingHeld(meeting.id, outcome);
                        }}
                        style={{
                          marginTop: '12px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #4caf50',
                          background: '#fff',
                          color: '#4caf50',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Mark as Held
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Meeting Form */}
            {showMeetingForm && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#f3e5f5', borderRadius: '8px' }}>
                <h5 style={{ margin: '0 0 16px', color: '#424242' }}>Schedule Meeting</h5>
                <form onSubmit={handleAddMeeting}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Meeting Type *</label>
                      <select
                        value={newMeeting.meeting_type}
                        onChange={(e) => setNewMeeting({ ...newMeeting, meeting_type: e.target.value })}
                        required
                        style={inputStyle}
                      >
                        <option value="investigation">Investigation Meeting</option>
                        <option value="hearing">Formal Hearing</option>
                        <option value="review">Review Meeting</option>
                        <option value="appeal">Appeal Hearing</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Date *</label>
                      <input
                        type="date"
                        value={newMeeting.scheduled_date}
                        onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_date: e.target.value })}
                        required
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Time</label>
                      <input
                        type="time"
                        value={newMeeting.scheduled_time}
                        onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_time: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Location</label>
                      <input
                        type="text"
                        value={newMeeting.location}
                        onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                        placeholder="Meeting room, office, etc."
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Companion Name</label>
                      <input
                        type="text"
                        value={newMeeting.companion_name}
                        onChange={(e) => setNewMeeting({ ...newMeeting, companion_name: e.target.value })}
                        placeholder="If known"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Companion Type</label>
                      <select
                        value={newMeeting.companion_type}
                        onChange={(e) => setNewMeeting({ ...newMeeting, companion_type: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Not specified</option>
                        <option value="union_rep">Trade Union Representative</option>
                        <option value="colleague">Workplace Colleague</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#9c27b0', color: '#fff', cursor: 'pointer' }}>
                      Schedule Meeting
                    </button>
                    <button type="button" onClick={() => setShowMeetingForm(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#424242' }}>Case Notes (Audit Trail)</h4>
              {hrCase.status !== 'closed' && (
                <button
                  onClick={() => setShowNoteForm(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2196f3',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  + Add Note
                </button>
              )}
            </div>

            {notes.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No notes yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {notes.map(note => (
                  <div key={note.id} style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#fafafa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: '#e0e0e0',
                          color: '#424242',
                          textTransform: 'uppercase'
                        }}>
                          {note.note_type}
                        </span>
                        {note.visible_to_employee && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            background: '#e8f5e9',
                            color: '#4caf50'
                          }}>
                            Visible to Employee
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {new Date(note.created_at).toLocaleString('en-GB')}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px', color: '#424242', whiteSpace: 'pre-wrap' }}>{note.content}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                      By: {note.created_by_name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Add Note Form */}
            {showNoteForm && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#e3f2fd', borderRadius: '8px' }}>
                <h5 style={{ margin: '0 0 16px', color: '#424242' }}>Add Note</h5>
                <form onSubmit={handleAddNote}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Note Type</label>
                    <select
                      value={newNote.note_type}
                      onChange={(e) => setNewNote({ ...newNote, note_type: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="general">General</option>
                      <option value="investigation">Investigation</option>
                      <option value="evidence">Evidence</option>
                      <option value="decision">Decision</option>
                      <option value="appeal">Appeal</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Content *</label>
                    <textarea
                      value={newNote.content}
                      onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                      required
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '14px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newNote.visible_to_employee}
                        onChange={(e) => setNewNote({ ...newNote, visible_to_employee: e.target.checked })}
                      />
                      Make visible to employee
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2196f3', color: '#fff', cursor: 'pointer' }}>
                      Add Note
                    </button>
                    <button type="button" onClick={() => setShowNoteForm(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Witnesses Tab */}
        {activeTab === 'witnesses' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#424242' }}>Witnesses</h4>
              {hrCase.status !== 'closed' && (
                <button
                  onClick={() => setShowWitnessForm(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#607d8b',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  + Add Witness
                </button>
              )}
            </div>

            {witnesses.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No witnesses recorded</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {witnesses.map(witness => (
                  <div key={witness.id} style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#fafafa'
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <h5 style={{ margin: '0 0 4px', color: '#111' }}>{witness.witness_name}</h5>
                      <span style={{ fontSize: '13px', color: '#666' }}>{witness.relationship || 'Relationship not specified'}</span>
                    </div>
                    {witness.statement && (
                      <div style={{ background: '#fff', padding: '12px', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: 0, color: '#424242', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{witness.statement}</p>
                        {witness.statement_date && (
                          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#666' }}>
                            Statement dated: {new Date(witness.statement_date).toLocaleDateString('en-GB')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Witness Form */}
            {showWitnessForm && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#eceff1', borderRadius: '8px' }}>
                <h5 style={{ margin: '0 0 16px', color: '#424242' }}>Add Witness</h5>
                <form onSubmit={handleAddWitness}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Witness Name *</label>
                      <input
                        type="text"
                        value={newWitness.witness_name}
                        onChange={(e) => setNewWitness({ ...newWitness, witness_name: e.target.value })}
                        required
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Relationship</label>
                      <select
                        value={newWitness.relationship}
                        onChange={(e) => setNewWitness({ ...newWitness, relationship: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Select...</option>
                        <option value="colleague">Colleague</option>
                        <option value="manager">Manager</option>
                        <option value="subordinate">Subordinate</option>
                        <option value="external">External</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px' }}>Statement</label>
                    <textarea
                      value={newWitness.statement}
                      onChange={(e) => setNewWitness({ ...newWitness, statement: e.target.value })}
                      rows={4}
                      placeholder="Witness statement (can be added later)"
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#607d8b', color: '#fff', cursor: 'pointer' }}>
                      Add Witness
                    </button>
                    <button type="button" onClick={() => setShowWitnessForm(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div>
            <h4 style={{ margin: '0 0 16px', color: '#424242' }}>Case Timeline</h4>
            <div style={{ position: 'relative', paddingLeft: '24px' }}>
              <div style={{
                position: 'absolute',
                left: '8px',
                top: 0,
                bottom: 0,
                width: '2px',
                background: '#e0e0e0'
              }} />

              {/* Case opened */}
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <div style={{
                  position: 'absolute',
                  left: '-20px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#2196f3',
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 2px #2196f3'
                }} />
                <div>
                  <strong style={{ color: '#111' }}>Case Opened</strong>
                  <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
                    {new Date(hrCase.opened_date).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Milestones */}
              {milestones.map(milestone => (
                <div key={milestone.id} style={{ position: 'relative', marginBottom: '24px' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-20px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: milestone.completed ? '#4caf50' : '#ff9800',
                    border: '2px solid #fff',
                    boxShadow: `0 0 0 2px ${milestone.completed ? '#4caf50' : '#ff9800'}`
                  }} />
                  <div>
                    <strong style={{ color: '#111' }}>{milestone.milestone_type.replace('_', ' ')}</strong>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
                      {new Date(milestone.milestone_date).toLocaleDateString('en-GB')}
                      {milestone.completed && ` - Completed`}
                    </p>
                    {milestone.description && (
                      <p style={{ margin: '4px 0 0', color: '#424242', fontSize: '14px' }}>{milestone.description}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Meetings */}
              {meetings.map(meeting => (
                <div key={`meeting-${meeting.id}`} style={{ position: 'relative', marginBottom: '24px' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-20px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: meeting.held ? '#9c27b0' : '#e0e0e0',
                    border: '2px solid #fff',
                    boxShadow: `0 0 0 2px ${meeting.held ? '#9c27b0' : '#e0e0e0'}`
                  }} />
                  <div>
                    <strong style={{ color: '#111' }}>{meeting.meeting_type.charAt(0).toUpperCase() + meeting.meeting_type.slice(1)}</strong>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
                      {new Date(meeting.scheduled_date).toLocaleDateString('en-GB')}
                      {meeting.held ? ' - Completed' : ' - Scheduled'}
                    </p>
                  </div>
                </div>
              ))}

              {/* Case closed */}
              {hrCase.status === 'closed' && (
                <div style={{ position: 'relative', marginBottom: '24px' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-20px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#4caf50',
                    border: '2px solid #fff',
                    boxShadow: '0 0 0 2px #4caf50'
                  }} />
                  <div>
                    <strong style={{ color: '#111' }}>Case Closed</strong>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
                      {new Date(hrCase.closed_date).toLocaleDateString('en-GB')} -
                      Outcome: {(hrCase.pip_outcome || hrCase.disciplinary_outcome || hrCase.grievance_outcome || '').replace('_', ' ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Close Case Modal */}
      {showOutcomeForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            width: '500px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ margin: '0 0 24px', color: '#111' }}>Close Case</h3>

            <form onSubmit={handleCloseCase}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: '500' }}>Outcome *</label>
                <select
                  value={outcomeData.outcome}
                  onChange={(e) => setOutcomeData({ ...outcomeData, outcome: e.target.value })}
                  required
                  style={inputStyle}
                >
                  <option value="">Select outcome...</option>
                  {getOutcomeOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: '500' }}>Outcome Notes</label>
                <textarea
                  value={outcomeData.outcome_notes}
                  onChange={(e) => setOutcomeData({ ...outcomeData, outcome_notes: e.target.value })}
                  rows={4}
                  placeholder="Reasons for decision, any conditions, next steps..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{
                background: '#fff3e0',
                border: '1px solid #ffb74d',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px'
              }}>
                <p style={{ margin: 0, color: '#424242', fontSize: '13px' }}>
                  <strong>Important:</strong> The employee will be notified that the case has been closed.
                  They have the right to appeal this decision.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowOutcomeForm(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    color: '#424242',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#4caf50',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Close Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HRCaseDetail;
