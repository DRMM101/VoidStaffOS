/**
 * VoidStaffOS - Onboarding Dashboard Component
 * Manages candidate onboarding process.
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
import CandidateForm from './CandidateForm';
import CandidateProfile from './CandidateProfile';

function OnboardingDashboard({ onClose }) {
  const [candidates, setCandidates] = useState([]);
  const [counts, setCounts] = useState({ candidate: 0, pre_colleague: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('candidate');
  const [showForm, setShowForm] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const response = await fetch('/api/onboarding/candidates', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setCandidates(data.candidates);
        setCounts(data.counts);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidates = candidates.filter(c => c.stage === activeTab);

  const getStageLabel = (stage) => {
    const labels = {
      'candidate': 'Candidates',
      'pre_colleague': 'Pre-Colleagues',
      'active': 'Recent Starters'
    };
    return labels[stage] || stage;
  };

  const getStatusIndicator = (candidate) => {
    if (candidate.stage === 'candidate') {
      const hasRefs = candidate.verified_refs >= 2;
      const hasChecks = candidate.pending_required_checks === 0;
      const hasSigned = candidate.contract_signed;
      if (hasRefs && hasChecks && hasSigned) return { color: 'green', text: 'Ready to promote' };
      if (hasRefs || hasChecks) return { color: 'amber', text: 'In progress' };
      return { color: 'red', text: 'Pending' };
    }
    if (candidate.stage === 'pre_colleague') {
      if (candidate.pending_required_tasks === 0) return { color: 'green', text: 'Ready to activate' };
      return { color: 'amber', text: 'Onboarding' };
    }
    return { color: 'green', text: 'Active' };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          <div className="loading">Loading onboarding data...</div>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <CandidateForm
        onClose={() => setShowForm(false)}
        onSave={() => {
          setShowForm(false);
          fetchCandidates();
        }}
      />
    );
  }

  if (selectedCandidate) {
    return (
      <CandidateProfile
        candidateId={selectedCandidate}
        onClose={() => {
          setSelectedCandidate(null);
          fetchCandidates();
        }}
      />
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-xlarge onboarding-dashboard">
        <div className="modal-header">
          <h3>Onboarding Pipeline</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="onboarding-header">
          <div className="pipeline-tabs">
            <button
              className={`pipeline-tab ${activeTab === 'candidate' ? 'active' : ''}`}
              onClick={() => setActiveTab('candidate')}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-label">Candidates</span>
              <span className="tab-count">{counts.candidate}</span>
            </button>
            <button
              className={`pipeline-tab ${activeTab === 'pre_colleague' ? 'active' : ''}`}
              onClick={() => setActiveTab('pre_colleague')}
            >
              <span className="tab-icon">🎓</span>
              <span className="tab-label">Pre-Colleagues</span>
              <span className="tab-count">{counts.pre_colleague}</span>
            </button>
            <button
              className={`pipeline-tab ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              <span className="tab-icon">✅</span>
              <span className="tab-label">Recent Starters</span>
              <span className="tab-count">{counts.active}</span>
            </button>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + New Candidate
          </button>
        </div>

        <div className="candidates-list">
          {filteredCandidates.length === 0 ? (
            <div className="no-candidates">
              <div className="no-candidates-icon">
                {activeTab === 'candidate' ? '📋' : activeTab === 'pre_colleague' ? '🎓' : '✅'}
              </div>
              <p>No {getStageLabel(activeTab).toLowerCase()} found</p>
              {activeTab === 'candidate' && (
                <button className="btn-secondary" onClick={() => setShowForm(true)}>
                  Add First Candidate
                </button>
              )}
            </div>
          ) : (
            <table className="candidates-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>{activeTab === 'active' ? 'Start Date' : 'Proposed Start'}</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map(candidate => {
                  const status = getStatusIndicator(candidate);
                  return (
                    <tr key={candidate.id}>
                      <td className="candidate-name">
                        <strong>{candidate.full_name}</strong>
                        {candidate.proposed_tier && (
                          <span className={`tier-badge tier-${candidate.proposed_tier}`}>
                            Tier {candidate.proposed_tier}
                          </span>
                        )}
                      </td>
                      <td>{candidate.email}</td>
                      <td>{candidate.proposed_role_name || '-'}</td>
                      <td>{formatDate(candidate.stage === 'active' ? candidate.actual_start_date : candidate.proposed_start_date)}</td>
                      <td>
                        <span className={`status-badge status-${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-small"
                          onClick={() => setSelectedCandidate(candidate.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="form-actions">
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingDashboard;
