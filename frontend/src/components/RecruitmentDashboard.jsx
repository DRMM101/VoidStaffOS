/**
 * VoidStaffOS - Recruitment Dashboard Component
 * Main recruitment pipeline management interface.
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
import CandidatePipelineCard from './CandidatePipelineCard';
import CandidateDetailModal from './CandidateDetailModal';
import './RecruitmentDashboard.css';

const STAGE_GROUPS = {
  application: { label: 'Application', color: '#6b7280' },
  shortlisted: { label: 'Shortlisted', color: '#3b82f6' },
  interview_requested: { label: 'Interview', color: '#8b5cf6' },
  interview_scheduled: { label: 'Interview', color: '#8b5cf6' },
  interview_complete: { label: 'Interview', color: '#8b5cf6' },
  further_assessment: { label: 'Assessment', color: '#f59e0b' },
  final_shortlist: { label: 'Final List', color: '#10b981' },
  offer_made: { label: 'Offer', color: '#06b6d4' },
  offer_accepted: { label: 'Accepted', color: '#22c55e' },
  offer_declined: { label: 'Declined', color: '#ef4444' },
  rejected: { label: 'Rejected', color: '#dc2626' },
  withdrawn: { label: 'Withdrawn', color: '#9ca3af' }
};

const KANBAN_COLUMNS = [
  { id: 'application', label: 'Application', stages: ['application'] },
  { id: 'shortlisted', label: 'Shortlisted', stages: ['shortlisted'] },
  { id: 'interview', label: 'Interview', stages: ['interview_requested', 'interview_scheduled', 'interview_complete'] },
  { id: 'assessment', label: 'Assessment', stages: ['further_assessment', 'final_shortlist'] },
  { id: 'offer', label: 'Offer', stages: ['offer_made'] },
  { id: 'accepted', label: 'Accepted', stages: ['offer_accepted'] }
];

export default function RecruitmentDashboard() {
  const [pipeline, setPipeline] = useState({});
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recruitmentRequests, setRecruitmentRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showRejected, setShowRejected] = useState(false);

  useEffect(() => {
    fetchPipeline();
    fetchRecruitmentRequests();
  }, [selectedRequest]);

  async function fetchPipeline() {
    try {
      let url = '/api/pipeline';
      if (selectedRequest) {
        url += `?recruitment_request_id=${selectedRequest}`;
      }

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch pipeline');

      const data = await response.json();
      setPipeline(data.pipeline);
      setCounts(data.counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecruitmentRequests() {
    try {
      const response = await fetch('/api/recruitment/requests?status=approved', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setRecruitmentRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Failed to fetch recruitment requests:', err);
    }
  }

  async function handleStageChange(candidateId, newStage, reason = '') {
    try {
      const response = await apiFetch(`/api/pipeline/candidates/${candidateId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ new_stage: newStage, reason })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update stage');
      }

      fetchPipeline();
    } catch (err) {
      alert(err.message);
    }
  }

  function getCandidatesForColumn(column) {
    const candidates = [];
    column.stages.forEach(stage => {
      if (pipeline[stage]) {
        candidates.push(...pipeline[stage]);
      }
    });
    return candidates;
  }

  function getColumnCount(column) {
    return column.stages.reduce((sum, stage) => sum + (counts[stage] || 0), 0);
  }

  function handleDragStart(e, candidate) {
    e.dataTransfer.setData('candidateId', candidate.id);
    e.dataTransfer.setData('currentStage', candidate.recruitment_stage);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e, targetColumn) {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('candidateId');
    const currentStage = e.dataTransfer.getData('currentStage');

    // Determine target stage based on column
    const targetStages = targetColumn.stages;
    if (targetStages.includes(currentStage)) return; // Already in this column

    // Get the first valid stage in target column
    let targetStage = targetStages[0];

    // Handle interview progression
    if (targetColumn.id === 'interview' && currentStage === 'shortlisted') {
      targetStage = 'interview_requested';
    }

    // Prompt for reason if rejecting
    if (targetStage === 'rejected' || targetStage === 'withdrawn') {
      const reason = prompt(`Enter reason for ${targetStage}:`);
      if (!reason) return;
      handleStageChange(candidateId, targetStage, reason);
    } else {
      handleStageChange(candidateId, targetStage);
    }
  }

  if (loading) return <div className="loading">Loading pipeline...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const rejectedCount = (counts.rejected || 0) + (counts.withdrawn || 0) + (counts.offer_declined || 0);

  return (
    <div className="recruitment-dashboard">
      <div className="dashboard-header">
        <h2>Recruitment Pipeline</h2>
        <div className="dashboard-controls">
          <select
            value={selectedRequest}
            onChange={(e) => setSelectedRequest(e.target.value)}
            className="request-filter"
          >
            <option value="">All Roles</option>
            {recruitmentRequests.map(req => (
              <option key={req.id} value={req.id}>
                {req.role_title}
              </option>
            ))}
          </select>
          <label className="show-rejected">
            <input
              type="checkbox"
              checked={showRejected}
              onChange={(e) => setShowRejected(e.target.checked)}
            />
            Show Rejected ({rejectedCount})
          </label>
        </div>
      </div>

      <div className="pipeline-stats">
        <div className="stat-item">
          <span className="stat-value">{counts.application || 0}</span>
          <span className="stat-label">New Applications</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {(counts.interview_requested || 0) + (counts.interview_scheduled || 0)}
          </span>
          <span className="stat-label">In Interview</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{counts.offer_made || 0}</span>
          <span className="stat-label">Offers Out</span>
        </div>
        <div className="stat-item highlight">
          <span className="stat-value">{counts.offer_accepted || 0}</span>
          <span className="stat-label">Accepted</span>
        </div>
      </div>

      <div className="kanban-board">
        {KANBAN_COLUMNS.map(column => (
          <div
            key={column.id}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column)}
          >
            <div className="column-header">
              <h3>{column.label}</h3>
              <span className="column-count">{getColumnCount(column)}</span>
            </div>
            <div className="column-content">
              {getCandidatesForColumn(column).map(candidate => (
                <CandidatePipelineCard
                  key={candidate.id}
                  candidate={candidate}
                  stageInfo={STAGE_GROUPS[candidate.recruitment_stage]}
                  onDragStart={(e) => handleDragStart(e, candidate)}
                  onClick={() => setSelectedCandidate(candidate)}
                />
              ))}
              {getCandidatesForColumn(column).length === 0 && (
                <div className="empty-column">No candidates</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showRejected && (
        <div className="rejected-section">
          <h3>Rejected / Withdrawn / Declined</h3>
          <div className="rejected-grid">
            {[...( pipeline.rejected || []), ...(pipeline.withdrawn || []), ...(pipeline.offer_declined || [])].map(candidate => (
              <CandidatePipelineCard
                key={candidate.id}
                candidate={candidate}
                stageInfo={STAGE_GROUPS[candidate.recruitment_stage]}
                onClick={() => setSelectedCandidate(candidate)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedCandidate && (
        <CandidateDetailModal
          candidateId={selectedCandidate.id}
          onClose={() => setSelectedCandidate(null)}
          onUpdate={fetchPipeline}
        />
      )}
    </div>
  );
}
