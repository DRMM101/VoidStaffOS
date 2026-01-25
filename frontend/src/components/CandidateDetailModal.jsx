/**
 * VoidStaffOS - Candidate Detail Modal Component
 * Detailed candidate view with pipeline actions.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import CandidatePipelineProgress from './CandidatePipelineProgress';
import InterviewScheduler from './InterviewScheduler';
import InterviewScorecard from './InterviewScorecard';
import CandidateNotes from './CandidateNotes';
import OfferForm from './OfferForm';
import './CandidateDetailModal.css';

const STAGE_ORDER = [
  'application', 'shortlisted', 'interview_requested', 'interview_scheduled',
  'interview_complete', 'further_assessment', 'final_shortlist', 'offer_made',
  'offer_accepted'
];

export default function CandidateDetailModal({ candidateId, onClose, onUpdate }) {
  const [candidate, setCandidate] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionModal, setActionModal] = useState(null);

  useEffect(() => {
    fetchCandidateDetails();
  }, [candidateId]);

  async function fetchCandidateDetails() {
    try {

      // Fetch candidate, interviews, and history in parallel
      const [candidateRes, interviewsRes, historyRes] = await Promise.all([
        fetch(`/api/onboarding/candidates/${candidateId}`, {
          credentials: 'include'
        }),
        fetch(`/api/pipeline/candidates/${candidateId}/interviews`, {
          credentials: 'include'
        }),
        fetch(`/api/pipeline/candidates/${candidateId}/history`, {
          credentials: 'include'
        })
      ]);

      if (candidateRes.ok) {
        const data = await candidateRes.json();
        setCandidate(data.candidate);
      }

      if (interviewsRes.ok) {
        const data = await interviewsRes.json();
        setInterviews(data.interviews || []);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setStageHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch candidate details:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStageAction(action) {
    let endpoint = '';
    let method = 'POST';
    let body = {};

    switch (action) {
      case 'shortlist':
        endpoint = `/api/pipeline/candidates/${candidateId}/stage`;
        method = 'PUT';
        body = { new_stage: 'shortlisted' };
        break;
      case 'reject':
        const rejectReason = prompt('Enter rejection reason:');
        if (!rejectReason) return;
        endpoint = `/api/pipeline/candidates/${candidateId}/stage`;
        method = 'PUT';
        body = { new_stage: 'rejected', reason: rejectReason };
        break;
      case 'withdraw':
        const withdrawReason = prompt('Enter withdrawal reason:');
        if (!withdrawReason) return;
        endpoint = `/api/pipeline/candidates/${candidateId}/stage`;
        method = 'PUT';
        body = { new_stage: 'withdrawn', reason: withdrawReason };
        break;
      case 'final_shortlist':
        endpoint = `/api/pipeline/candidates/${candidateId}/stage`;
        method = 'PUT';
        body = { new_stage: 'final_shortlist' };
        break;
      case 'further_assessment':
        endpoint = `/api/pipeline/candidates/${candidateId}/stage`;
        method = 'PUT';
        body = { new_stage: 'further_assessment' };
        break;
      case 'accept_offer':
        endpoint = `/api/pipeline/candidates/${candidateId}/accept-offer`;
        break;
      case 'decline_offer':
        const declineReason = prompt('Enter decline reason:');
        if (!declineReason) return;
        endpoint = `/api/pipeline/candidates/${candidateId}/decline-offer`;
        body = { reason: declineReason };
        break;
      case 'unreject':
      case 'unwithdraw':
      case 'reinstate':
        endpoint = `/api/pipeline/candidates/${candidateId}/stage`;
        method = 'PUT';
        body = { new_stage: 'shortlisted', reason: 'Candidate reinstated' };
        break;
      default:
        return;
    }

    try {
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Action failed');
      }

      fetchCandidateDetails();
      onUpdate();
    } catch (err) {
      alert(err.message);
    }
  }

  function getAvailableActions() {
    if (!candidate) return [];
    const stage = candidate.recruitment_stage;
    const actions = [];

    switch (stage) {
      case 'application':
        actions.push({ id: 'shortlist', label: 'Shortlist', type: 'primary' });
        actions.push({ id: 'reject', label: 'Reject', type: 'danger' });
        break;
      case 'shortlisted':
        actions.push({ id: 'schedule_interview', label: 'Schedule Interview', type: 'primary' });
        actions.push({ id: 'reject', label: 'Reject', type: 'danger' });
        break;
      case 'interview_requested':
        actions.push({ id: 'schedule_interview', label: 'Schedule Interview', type: 'primary' });
        actions.push({ id: 'reject', label: 'Reject', type: 'danger' });
        break;
      case 'interview_scheduled':
        actions.push({ id: 'score_interview', label: 'Score Interview', type: 'primary' });
        actions.push({ id: 'final_shortlist', label: 'Add to Final Shortlist', type: 'secondary' });
        actions.push({ id: 'further_assessment', label: 'Needs Further Assessment', type: 'secondary' });
        actions.push({ id: 'reject', label: 'Reject', type: 'danger' });
        break;
      case 'interview_complete':
        actions.push({ id: 'final_shortlist', label: 'Add to Final Shortlist', type: 'primary' });
        actions.push({ id: 'further_assessment', label: 'Requires Further Assessment', type: 'secondary' });
        actions.push({ id: 'schedule_interview', label: 'Schedule Another Interview', type: 'secondary' });
        actions.push({ id: 'reject', label: 'Reject', type: 'danger' });
        break;
      case 'further_assessment':
        actions.push({ id: 'schedule_interview', label: 'Schedule Assessment', type: 'primary' });
        actions.push({ id: 'final_shortlist', label: 'Add to Final Shortlist', type: 'secondary' });
        break;
      case 'final_shortlist':
        actions.push({ id: 'make_offer', label: 'Make Offer', type: 'primary' });
        actions.push({ id: 'reject', label: 'Reject', type: 'danger' });
        break;
      case 'offer_made':
        actions.push({ id: 'accept_offer', label: 'Mark Accepted', type: 'success' });
        actions.push({ id: 'decline_offer', label: 'Mark Declined', type: 'danger' });
        break;
      case 'rejected':
        actions.push({ id: 'unreject', label: 'Reinstate Candidate', type: 'primary' });
        break;
      case 'withdrawn':
        actions.push({ id: 'unwithdraw', label: 'Reinstate Candidate', type: 'primary' });
        break;
      case 'offer_declined':
        actions.push({ id: 'reinstate', label: 'Reinstate Candidate', type: 'primary' });
        break;
    }

    // Only show withdraw for active stages
    if (!['rejected', 'withdrawn', 'offer_declined', 'offer_accepted'].includes(stage)) {
      actions.push({ id: 'withdraw', label: 'Withdraw', type: 'secondary' });
    }

    return actions;
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="candidate-modal">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="modal-overlay">
        <div className="candidate-modal">
          <div className="error-message">Candidate not found</div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const actions = getAvailableActions();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="candidate-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-info">
            <h2>{candidate.full_name}</h2>
            <span className="candidate-email">{candidate.email}</span>
            <span className={`header-stage ${candidate.recruitment_stage}`}>
              {candidate.recruitment_stage?.replace(/_/g, ' ')}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <CandidatePipelineProgress
          currentStage={candidate.recruitment_stage}
          stageHistory={stageHistory}
        />

        <div className="modal-tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={activeTab === 'interviews' ? 'active' : ''}
            onClick={() => setActiveTab('interviews')}
          >
            Interviews ({interviews.length})
          </button>
          <button
            className={activeTab === 'notes' ? 'active' : ''}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
          {candidate.recruitment_stage === 'offer_made' && (
            <button
              className={activeTab === 'offer' ? 'active' : ''}
              onClick={() => setActiveTab('offer')}
            >
              Offer Details
            </button>
          )}
        </div>

        <div className="modal-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="info-grid">
                <div className="info-section">
                  <h4>Contact Details</h4>
                  <p><strong>Phone:</strong> {candidate.phone || 'Not provided'}</p>
                  <p><strong>Address:</strong> {candidate.address_line1 || 'Not provided'}</p>
                  {candidate.city && <p><strong>City:</strong> {candidate.city}</p>}
                  {candidate.postcode && <p><strong>Postcode:</strong> {candidate.postcode}</p>}
                </div>
                <div className="info-section">
                  <h4>Role Details</h4>
                  <p><strong>Role:</strong> {candidate.proposed_role_name || 'Not assigned'}</p>
                  <p><strong>Tier:</strong> {candidate.proposed_tier || 'Not set'}</p>
                  <p><strong>Salary:</strong> {candidate.proposed_salary ? `£${Number(candidate.proposed_salary).toLocaleString()}` : 'Not set'}</p>
                  <p><strong>Start Date:</strong> {candidate.proposed_start_date ? new Date(candidate.proposed_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</p>
                </div>
              </div>

              {candidate.skills_experience && (
                <div className="info-section full-width">
                  <h4>Skills & Experience</h4>
                  <p>{candidate.skills_experience}</p>
                </div>
              )}

              <div className="info-section full-width">
                <h4>Stage History</h4>
                <div className="history-list">
                  {stageHistory.length === 0 ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>No history yet</p>
                  ) : (
                    stageHistory.map((h, i) => (
                      <div key={i} className="history-item">
                        <span className="history-stages">
                          {(h.from_stage || 'New').replace(/_/g, ' ')} → {h.to_stage?.replace(/_/g, ' ')}
                        </span>
                        <span className="history-by">{h.changed_by_name || 'System'}</span>
                        <span className="history-date">
                          {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {h.reason && <span className="history-reason">{h.reason}</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interviews' && (
            <div className="interviews-tab">
              <div className="interviews-list">
                {interviews.map(interview => (
                  <div key={interview.id} className={`interview-card ${interview.status}`}>
                    <div className="interview-header">
                      <span className="interview-type">{interview.interview_type?.replace(/_/g, ' ')}</span>
                      <span className={`interview-status ${interview.status}`}>{interview.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="interview-details">
                      <p>
                        <strong>Date:</strong> {new Date(interview.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at {interview.scheduled_time?.slice(0, 5)}
                      </p>
                      <p><strong>Duration:</strong> {interview.duration_minutes} mins</p>
                      {interview.location && <p><strong>Location:</strong> {interview.location}</p>}
                      {interview.interviewers && interview.interviewers.length > 0 && (
                        <p><strong>Interviewers:</strong> {interview.interviewers.map(i => i.full_name).join(', ')}</p>
                      )}
                    </div>
                    {interview.status === 'completed' && (
                      <div className="interview-result">
                        {interview.score && (
                          <span className="score">Score: {interview.score}/10</span>
                        )}
                        {interview.recommend_next_stage !== null && (
                          <span className={`recommend ${interview.recommend_next_stage ? 'yes' : 'no'}`}>
                            {interview.recommend_next_stage ? 'Recommended' : 'Not Recommended'}
                          </span>
                        )}
                      </div>
                    )}
                    {interview.notes && (
                      <div className="interview-notes">
                        <p>{interview.notes}</p>
                      </div>
                    )}
                    {interview.status === 'scheduled' && (
                      <button
                        className="btn-score"
                        onClick={() => setActionModal({ type: 'score_interview', interview })}
                      >
                        Complete & Score
                      </button>
                    )}
                  </div>
                ))}
                {interviews.length === 0 && (
                  <p className="no-interviews">No interviews scheduled</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <CandidateNotes
              candidateId={candidateId}
              onNoteAdded={fetchCandidateDetails}
            />
          )}

          {activeTab === 'offer' && (
            <div className="offer-tab">
              <div className="offer-details">
                <p><strong>Offer Date:</strong> {candidate.offer_date ? new Date(candidate.offer_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'}</p>
                <p><strong>Salary:</strong> {candidate.offer_salary ? `£${Number(candidate.offer_salary).toLocaleString()}` : 'Not set'}</p>
                <p><strong>Start Date:</strong> {candidate.offer_start_date ? new Date(candidate.offer_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'}</p>
                <p><strong>Expiry:</strong> {candidate.offer_expiry_date ? new Date(candidate.offer_expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          {actions.map(action => (
            <button
              key={action.id}
              className={`btn-action ${action.type}`}
              onClick={() => {
                if (action.id === 'schedule_interview') {
                  setActionModal({ type: 'schedule_interview' });
                } else if (action.id === 'score_interview') {
                  const pendingInterview = interviews.find(i => i.status === 'scheduled');
                  if (pendingInterview) {
                    setActionModal({ type: 'score_interview', interview: pendingInterview });
                  } else {
                    alert('No scheduled interviews to score');
                  }
                } else if (action.id === 'make_offer') {
                  setActionModal({ type: 'make_offer' });
                } else {
                  handleStageAction(action.id);
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

        {actionModal?.type === 'schedule_interview' && (
          <InterviewScheduler
            candidateId={candidateId}
            onClose={() => setActionModal(null)}
            onScheduled={() => {
              setActionModal(null);
              fetchCandidateDetails();
              onUpdate();
            }}
          />
        )}

        {actionModal?.type === 'score_interview' && actionModal.interview && (
          <InterviewScorecard
            interview={actionModal.interview}
            onClose={() => setActionModal(null)}
            onSubmit={() => {
              setActionModal(null);
              fetchCandidateDetails();
              onUpdate();
            }}
          />
        )}

        {actionModal?.type === 'make_offer' && (
          <OfferForm
            candidateId={candidateId}
            candidate={candidate}
            onClose={() => setActionModal(null)}
            onSubmit={() => {
              setActionModal(null);
              fetchCandidateDetails();
              onUpdate();
            }}
          />
        )}
      </div>
    </div>
  );
}
