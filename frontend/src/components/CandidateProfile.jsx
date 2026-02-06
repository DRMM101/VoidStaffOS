/**
 * HeadOfficeOS - Candidate Profile Component
 * Displays detailed candidate information.
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
import CandidateForm from './CandidateForm';

function CandidateProfile({ candidateId, onClose }) {
  const [candidate, setCandidate] = useState(null);
  const [references, setReferences] = useState([]);
  const [checks, setChecks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [dayOneItems, setDayOneItems] = useState([]);
  const [promotionStatus, setPromotionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showAddRef, setShowAddRef] = useState(false);
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [confirmingArrival, setConfirmingArrival] = useState(false);

  useEffect(() => {
    fetchCandidate();
    fetchPromotionStatus();
  }, [candidateId]);

  const fetchCandidate = async () => {
    try {
      const response = await fetch(`/api/onboarding/candidates/${candidateId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setCandidate(data.candidate);
        setReferences(data.references);
        setChecks(data.background_checks);
        setTasks(data.onboarding_tasks);
        setPolicies(data.policies);
        setDayOneItems(data.day_one_items);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch candidate');
    } finally {
      setLoading(false);
    }
  };

  const fetchPromotionStatus = async () => {
    try {
      const response = await fetch(`/api/onboarding/candidates/${candidateId}/promotion-status`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setPromotionStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch promotion status');
    }
  };

  const handlePromote = async () => {
    if (!promotionStatus?.can_promote) return;

    setPromoting(true);
    try {
      const response = await apiFetch(`/api/onboarding/candidates/${candidateId}/promote`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchCandidate();
        fetchPromotionStatus();
      } else {
        alert(`Cannot promote: ${data.missing?.join(', ') || data.error}`);
      }
    } catch (err) {
      alert('Failed to promote candidate');
    } finally {
      setPromoting(false);
    }
  };

  const handleConfirmArrival = async () => {
    // Require password confirmation for security
    const password = prompt(`To confirm ${candidate.full_name} has arrived for their first day, please enter your password:`);
    if (!password) return;

    setConfirmingArrival(true);
    try {
      const response = await apiFetch(`/api/onboarding/candidates/${candidateId}/confirm-arrival`, {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchCandidate();
        fetchPromotionStatus();
      } else {
        alert(data.error || 'Failed to confirm arrival');
      }
    } catch (err) {
      alert('Failed to confirm arrival');
    } finally {
      setConfirmingArrival(false);
    }
  };

  const updateReferenceStatus = async (refId, status) => {
    try {
      const response = await apiFetch(`/api/onboarding/references/${refId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          received_date: status === 'received' || status === 'verified' ? new Date().toISOString().split('T')[0] : null
        })
      });
      if (response.ok) {
        fetchCandidate();
        fetchPromotionStatus();
      }
    } catch (err) {
      console.error('Failed to update reference');
    }
  };

  const updateCheckStatus = async (checkId, status) => {
    try {
      const response = await apiFetch(`/api/onboarding/checks/${checkId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          completed_date: status === 'cleared' || status === 'failed' ? new Date().toISOString().split('T')[0] : null
        })
      });
      if (response.ok) {
        fetchCandidate();
        fetchPromotionStatus();
      }
    } catch (err) {
      console.error('Failed to update check');
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

  const formatCheckType = (type) => {
    const labels = {
      'dbs_basic': 'DBS Basic',
      'dbs_enhanced': 'DBS Enhanced',
      'right_to_work': 'Right to Work',
      'qualification_verify': 'Qualification Verification',
      'other': 'Other'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'gray',
      'requested': 'amber',
      'received': 'blue',
      'verified': 'green',
      'not_started': 'gray',
      'submitted': 'amber',
      'in_progress': 'blue',
      'cleared': 'green',
      'failed': 'red',
      'completed': 'green'
    };
    return colors[status] || 'gray';
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          <div className="loading">Loading candidate...</div>
        </div>
      </div>
    );
  }

  if (showEdit) {
    return (
      <CandidateForm
        candidate={candidate}
        onClose={() => setShowEdit(false)}
        onSave={() => {
          setShowEdit(false);
          fetchCandidate();
          fetchPromotionStatus();
        }}
      />
    );
  }

  if (!candidate) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="error-message">Candidate not found</div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const verifiedRefs = references.filter(r => r.status === 'verified').length;
  const requiredChecksCleared = checks.filter(c => c.required && c.status === 'cleared').length;
  const requiredChecksTotal = checks.filter(c => c.required).length;

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-xlarge candidate-profile">
        <div className="modal-header">
          <div className="header-info">
            <h3>{candidate.full_name}</h3>
            <span className={`stage-badge stage-${candidate.stage}`}>
              {candidate.stage === 'candidate' ? 'Candidate' :
               candidate.stage === 'pre_colleague' ? 'Pre-Colleague' : 'Active'}
            </span>
          </div>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Highlighted Start Date Banner */}
        {candidate.proposed_start_date && candidate.stage !== 'active' && (
          <div className="start-date-banner">
            <div className="start-date-icon">📅</div>
            <div className="start-date-info">
              <span className="start-date-label">
                {candidate.stage === 'candidate' ? 'Proposed Start Date' : 'Start Date'}
              </span>
              <span className="start-date-value">{formatDate(candidate.proposed_start_date)}</span>
              {(() => {
                const startDate = new Date(candidate.proposed_start_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                startDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
                if (daysUntil < 0) {
                  return <span className="start-date-countdown overdue">{Math.abs(daysUntil)} days overdue</span>;
                } else if (daysUntil === 0) {
                  return <span className="start-date-countdown today">TODAY</span>;
                } else if (daysUntil <= 7) {
                  return <span className="start-date-countdown urgent">{daysUntil} day{daysUntil > 1 ? 's' : ''} away</span>;
                } else {
                  return <span className="start-date-countdown">{daysUntil} days away</span>;
                }
              })()}
            </div>
          </div>
        )}

        <div className="profile-content">
          {/* Left Column - Details */}
          <div className="profile-left">
            <div className="profile-section">
              <div className="section-header">
                <h4>Personal Details</h4>
                <button className="btn-small" onClick={() => setShowEdit(true)}>Edit</button>
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Email</label>
                  <span>{candidate.email}</span>
                </div>
                <div className="detail-item">
                  <label>Phone</label>
                  <span>{candidate.phone || '-'}</span>
                </div>
                <div className="detail-item">
                  <label>Address</label>
                  <span>
                    {candidate.address_line1 || '-'}
                    {candidate.address_line2 && <><br/>{candidate.address_line2}</>}
                    {candidate.city && <><br/>{candidate.city}</>}
                    {candidate.postcode && <>, {candidate.postcode}</>}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Date of Birth</label>
                  <span>{formatDate(candidate.dob)}</span>
                </div>
              </div>
            </div>

            <div className="profile-section">
              <h4>Employment Details</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Role</label>
                  <span>{candidate.proposed_role_name || '-'}</span>
                </div>
                <div className="detail-item">
                  <label>Tier</label>
                  <span>{candidate.proposed_tier ? `Tier ${candidate.proposed_tier}` : '-'}</span>
                </div>
                <div className="detail-item">
                  <label>Salary</label>
                  <span>{candidate.proposed_salary ? `£${parseFloat(candidate.proposed_salary).toLocaleString()}` : '-'}</span>
                </div>
                <div className="detail-item">
                  <label>Hours</label>
                  <span>{candidate.proposed_hours ? `${candidate.proposed_hours} hrs/week` : '-'}</span>
                </div>
                <div className="detail-item">
                  <label>Start Date</label>
                  <span>{formatDate(candidate.proposed_start_date)}</span>
                </div>
                <div className="detail-item">
                  <label>Contract Signed</label>
                  <span className={candidate.contract_signed ? 'text-green' : 'text-red'}>
                    {candidate.contract_signed ? `Yes (${formatDate(candidate.contract_signed_date)})` : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {candidate.skills_experience && (
              <div className="profile-section">
                <h4>Skills & Experience</h4>
                <p className="text-content">{candidate.skills_experience}</p>
              </div>
            )}
          </div>

          {/* Right Column - Checks & Promotion */}
          <div className="profile-right">
            {/* Promotion Readiness */}
            {candidate.stage !== 'active' && (
              <div className="profile-section promotion-section">
                <h4>
                  {candidate.stage === 'candidate' ? 'Pre-Colleague Readiness' : 'Activation Readiness'}
                </h4>
                <div className="readiness-checklist">
                  {promotionStatus?.completed?.map((item, idx) => (
                    <div key={idx} className="checklist-item complete">
                      <span className="check-icon">✅</span>
                      <span>{item}</span>
                    </div>
                  ))}
                  {promotionStatus?.missing?.map((item, idx) => (
                    <div key={idx} className="checklist-item incomplete">
                      <span className="check-icon">❌</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {/* Confirm Arrival Button - only for pre-colleagues who haven't arrived */}
                {candidate.stage === 'pre_colleague' && !candidate.arrival_confirmed && (
                  <button
                    className="btn-confirm-arrival"
                    onClick={handleConfirmArrival}
                    disabled={confirmingArrival}
                  >
                    {confirmingArrival ? 'Confirming...' : '✓ Confirm Arrival (First Day)'}
                  </button>
                )}

                {/* Show arrival confirmed status */}
                {candidate.stage === 'pre_colleague' && candidate.arrival_confirmed && (
                  <div className="arrival-confirmed-notice">
                    ✅ Arrival confirmed
                  </div>
                )}

                <button
                  className={`btn-promote ${promotionStatus?.can_promote ? 'ready' : 'disabled'}`}
                  onClick={handlePromote}
                  disabled={!promotionStatus?.can_promote || promoting}
                  title={!promotionStatus?.can_promote ? `Missing: ${promotionStatus?.missing?.join(', ')}` : ''}
                >
                  {promoting ? 'Promoting...' : (
                    candidate.stage === 'candidate'
                      ? 'Promote to Pre-Colleague'
                      : 'Activate Employee'
                  )}
                </button>
              </div>
            )}

            {/* References */}
            <div className="profile-section">
              <div className="section-header">
                <h4>References ({verifiedRefs}/2 verified)</h4>
                <button className="btn-small" onClick={() => setShowAddRef(true)}>+ Add</button>
              </div>
              {references.length === 0 ? (
                <p className="text-muted">No references added</p>
              ) : (
                <div className="items-list">
                  {references.map(ref => (
                    <div key={ref.id} className="list-item">
                      <div className="item-info">
                        <strong>{ref.reference_name}</strong>
                        <span className="item-meta">{ref.reference_company} - {ref.relationship}</span>
                        {ref.reference_email && <span className="item-contact">{ref.reference_email}</span>}
                      </div>
                      <div className="item-actions">
                        <span className={`status-badge status-${getStatusColor(ref.status)}`}>
                          {ref.status}
                        </span>
                        <select
                          value={ref.status}
                          onChange={(e) => updateReferenceStatus(ref.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="requested">Requested</option>
                          <option value="received">Received</option>
                          <option value="verified">Verified</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Background Checks */}
            <div className="profile-section">
              <div className="section-header">
                <h4>Background Checks ({requiredChecksCleared}/{requiredChecksTotal} required cleared)</h4>
                <button className="btn-small" onClick={() => setShowAddCheck(true)}>+ Add</button>
              </div>
              {checks.length === 0 ? (
                <p className="text-muted">No checks configured</p>
              ) : (
                <div className="items-list">
                  {checks.map(check => (
                    <div key={check.id} className="list-item">
                      <div className="item-info">
                        <strong>
                          {formatCheckType(check.check_type)}
                          {check.required && <span className="required-badge">Required</span>}
                        </strong>
                        {check.certificate_number && (
                          <span className="item-meta">Cert: {check.certificate_number}</span>
                        )}
                        {check.expiry_date && (
                          <span className="item-meta">Expires: {formatDate(check.expiry_date)}</span>
                        )}
                      </div>
                      <div className="item-actions">
                        <span className={`status-badge status-${getStatusColor(check.status)}`}>
                          {check.status.replace('_', ' ')}
                        </span>
                        <select
                          value={check.status}
                          onChange={(e) => updateCheckStatus(check.id, e.target.value)}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="submitted">Submitted</option>
                          <option value="in_progress">In Progress</option>
                          <option value="cleared">Cleared</option>
                          <option value="failed">Failed</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Onboarding Tasks (for pre-colleagues) */}
            {candidate.stage === 'pre_colleague' && tasks.length > 0 && (
              <div className="profile-section">
                <h4>Onboarding Tasks</h4>
                <div className="items-list">
                  {tasks.map(task => (
                    <div key={task.id} className="list-item">
                      <div className="item-info">
                        <strong>
                          {task.task_name}
                          {task.required_before_start && <span className="required-badge">Required</span>}
                        </strong>
                        <span className="item-meta">{task.task_type.replace('_', ' ')}</span>
                      </div>
                      <span className={`status-badge status-${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Policies (for pre-colleagues) */}
            {candidate.stage === 'pre_colleague' && policies.length > 0 && (
              <div className="profile-section">
                <h4>Policy Acknowledgments</h4>
                <div className="items-list">
                  {policies.map(policy => (
                    <div key={policy.id} className="list-item">
                      <div className="item-info">
                        <strong>{policy.policy_name}</strong>
                        <span className="item-meta">v{policy.policy_version}</span>
                      </div>
                      <span className={`status-badge status-${policy.acknowledged ? 'green' : 'gray'}`}>
                        {policy.acknowledged ? 'Acknowledged' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Reference Modal */}
        {showAddRef && (
          <AddReferenceModal
            candidateId={candidateId}
            onClose={() => setShowAddRef(false)}
            onSave={() => {
              setShowAddRef(false);
              fetchCandidate();
              fetchPromotionStatus();
            }}
          />
        )}

        {/* Add Check Modal */}
        {showAddCheck && (
          <AddCheckModal
            candidateId={candidateId}
            onClose={() => setShowAddCheck(false)}
            onSave={() => {
              setShowAddCheck(false);
              fetchCandidate();
              fetchPromotionStatus();
            }}
          />
        )}

        <div className="form-actions">
          <button onClick={onClose} className="cancel-btn">Close</button>
        </div>
      </div>
    </div>
  );
}

// Sub-components for adding references and checks
function AddReferenceModal({ candidateId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    reference_name: '',
    reference_company: '',
    reference_email: '',
    reference_phone: '',
    relationship: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch(`/api/onboarding/candidates/${candidateId}/references`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        onSave();
      }
    } catch (err) {
      console.error('Failed to add reference');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay nested">
      <div className="modal-content modal-small">
        <h4>Add Reference</h4>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={formData.reference_name}
              onChange={(e) => setFormData(prev => ({ ...prev, reference_name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Company</label>
            <input
              type="text"
              value={formData.reference_company}
              onChange={(e) => setFormData(prev => ({ ...prev, reference_company: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.reference_email}
              onChange={(e) => setFormData(prev => ({ ...prev, reference_email: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.reference_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, reference_phone: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Relationship</label>
            <select
              value={formData.relationship}
              onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
            >
              <option value="">Select...</option>
              <option value="Previous Manager">Previous Manager</option>
              <option value="Direct Supervisor">Direct Supervisor</option>
              <option value="Colleague">Colleague</option>
              <option value="HR Contact">HR Contact</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Adding...' : 'Add Reference'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddCheckModal({ candidateId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    check_type: '',
    check_type_other: '',
    required: true
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch(`/api/onboarding/candidates/${candidateId}/checks`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        onSave();
      }
    } catch (err) {
      console.error('Failed to add check');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay nested">
      <div className="modal-content modal-small">
        <h4>Add Background Check</h4>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Check Type *</label>
            <select
              value={formData.check_type}
              onChange={(e) => setFormData(prev => ({ ...prev, check_type: e.target.value }))}
              required
            >
              <option value="">Select...</option>
              <option value="dbs_basic">DBS Basic</option>
              <option value="dbs_enhanced">DBS Enhanced</option>
              <option value="right_to_work">Right to Work</option>
              <option value="qualification_verify">Qualification Verification</option>
              <option value="other">Other</option>
            </select>
          </div>
          {formData.check_type === 'other' && (
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={formData.check_type_other}
                onChange={(e) => setFormData(prev => ({ ...prev, check_type_other: e.target.value }))}
                placeholder="Describe the check..."
              />
            </div>
          )}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.required}
                onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.checked }))}
              />
              Required for promotion
            </label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Adding...' : 'Add Check'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CandidateProfile;
