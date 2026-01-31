/**
 * VoidStaffOS - Offboarding Detail View
 * Full workflow detail with checklist, exit interview, and handovers.
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

function OffboardingDetail({ workflowId, onBack, user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workflow, setWorkflow] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [exitInterview, setExitInterview] = useState(null);
  const [handovers, setHandovers] = useState([]);
  const [activeSection, setActiveSection] = useState('checklist');
  const [showAddHandover, setShowAddHandover] = useState(false);

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';

  useEffect(() => {
    fetchWorkflowDetails();
  }, [workflowId]);

  const fetchWorkflowDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const [workflowData, checklistData, exitData, handoverData] = await Promise.all([
        apiFetch(`/api/offboarding/${workflowId}`),
        apiFetch(`/api/offboarding/${workflowId}/checklist`),
        apiFetch(`/api/offboarding/${workflowId}/exit-interview`).catch(() => null),
        apiFetch(`/api/offboarding/${workflowId}/handovers`)
      ]);

      setWorkflow(workflowData);
      setChecklist(checklistData.items || []);
      setExitInterview(exitData);
      setHandovers(handoverData.handovers || []);
    } catch (err) {
      console.error('Fetch workflow details error:', err);
      setError('Failed to load workflow details');
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistToggle = async (itemId, completed) => {
    try {
      await apiFetch(`/api/offboarding/${workflowId}/checklist/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ completed: !completed })
      });
      fetchWorkflowDetails();
    } catch (err) {
      console.error('Toggle checklist error:', err);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      await apiFetch(`/api/offboarding/${workflowId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      fetchWorkflowDetails();
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleScheduleInterview = async () => {
    const date = prompt('Enter interview date (YYYY-MM-DD):');
    if (!date) return;

    try {
      if (exitInterview) {
        await apiFetch(`/api/offboarding/${workflowId}/exit-interview`, {
          method: 'PUT',
          body: JSON.stringify({ scheduled_date: date })
        });
      } else {
        await apiFetch(`/api/offboarding/${workflowId}/exit-interview`, {
          method: 'POST',
          body: JSON.stringify({ scheduled_date: date })
        });
      }
      fetchWorkflowDetails();
    } catch (err) {
      console.error('Schedule interview error:', err);
    }
  };

  const handleAddHandover = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      item_name: form.item_name.value,
      item_type: form.item_type.value,
      description: form.description.value,
      priority: form.priority.value
    };

    try {
      await apiFetch(`/api/offboarding/${workflowId}/handovers`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setShowAddHandover(false);
      fetchWorkflowDetails();
    } catch (err) {
      console.error('Add handover error:', err);
    }
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

  const getChecklistProgress = () => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter(item => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#111' }}>
        Loading workflow details...
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div style={{ padding: '20px' }}>
        <button onClick={onBack} style={{
          background: 'none',
          border: 'none',
          color: '#1976d2',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '16px'
        }}>
          ← Back to Offboarding
        </button>
        <div style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '12px 16px',
          borderRadius: '8px'
        }}>
          {error || 'Workflow not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="offboarding-detail" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button onClick={onBack} style={{
          background: 'none',
          border: 'none',
          color: '#1976d2',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '16px',
          padding: 0
        }}>
          ← Back to Offboarding
        </button>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff' }}>
              {workflow.employee_name}
            </h2>
            <p style={{ margin: '8px 0 0', color: '#fff', fontSize: '14px' }}>
              {getTerminationLabel(workflow.termination_type)} • Last day: {formatDate(workflow.last_working_day)}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{
              padding: '6px 16px',
              borderRadius: '16px',
              background: getStatusColor(workflow.status),
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              textTransform: 'capitalize'
            }}>
              {workflow.status?.replace('_', ' ')}
            </span>

            {(isAdmin || isManager) && workflow.status !== 'completed' && workflow.status !== 'cancelled' && (
              <select
                onChange={(e) => e.target.value && handleUpdateStatus(e.target.value)}
                value=""
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  background: '#fff',
                  color: '#111',
                  cursor: 'pointer'
                }}
              >
                <option value="">Change status...</option>
                {workflow.status === 'pending' && <option value="in_progress">Start Processing</option>}
                {workflow.status === 'in_progress' && <option value="completed">Mark Completed</option>}
                <option value="cancelled">Cancel</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Notice Date</div>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#111' }}>
            {formatDate(workflow.notice_date)}
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Checklist Progress</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#111' }}>
              {getChecklistProgress()}%
            </div>
            <div style={{
              flex: 1,
              height: '8px',
              background: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${getChecklistProgress()}%`,
                height: '100%',
                background: '#4caf50',
                borderRadius: '4px'
              }} />
            </div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Exit Interview</div>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#111' }}>
            {exitInterview?.completed ? 'Completed' :
             exitInterview?.scheduled_date ? `Scheduled: ${formatDate(exitInterview.scheduled_date)}` :
             'Not Scheduled'}
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Handovers</div>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#111' }}>
            {handovers.filter(h => h.status === 'completed').length} / {handovers.length} complete
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '12px'
      }}>
        {['checklist', 'exit-interview', 'handovers', 'details'].map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === section ? '#1976d2' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeSection === section ? '600' : '500',
              textTransform: 'capitalize'
            }}
          >
            {section.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Checklist Section */}
      {activeSection === 'checklist' && (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#111' }}>Offboarding Checklist</h3>

          {checklist.length === 0 ? (
            <div style={{ color: '#666', padding: '20px 0', textAlign: 'center' }}>
              No checklist items
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {checklist.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: item.completed ? '#f1f8e9' : '#f5f5f5',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleChecklistToggle(item.id, item.completed)}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: item.completed ? 'none' : '2px solid #bdbdbd',
                    background: item.completed ? '#4caf50' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {item.completed && '✓'}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '500',
                      color: item.completed ? '#666' : '#111',
                      textDecoration: item.completed ? 'line-through' : 'none'
                    }}>
                      {item.item_name}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                        {item.description}
                      </div>
                    )}
                  </div>

                  <div style={{
                    padding: '4px 8px',
                    background: '#e0e0e0',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#555'
                  }}>
                    {item.assigned_role || 'Unassigned'}
                  </div>

                  {item.due_date && (
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Due: {formatDate(item.due_date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exit Interview Section */}
      {activeSection === 'exit-interview' && (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ margin: 0, color: '#111' }}>Exit Interview</h3>
            {(isAdmin || isManager) && !exitInterview?.completed && (
              <button
                onClick={handleScheduleInterview}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#1976d2',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {exitInterview ? 'Reschedule' : 'Schedule Interview'}
              </button>
            )}
          </div>

          {!exitInterview ? (
            <div style={{ color: '#666', padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <p style={{ margin: 0 }}>No exit interview scheduled yet</p>
            </div>
          ) : (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Status</div>
                  <div style={{ fontWeight: '500', color: '#111' }}>
                    {exitInterview.completed ? 'Completed' : 'Scheduled'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Date</div>
                  <div style={{ fontWeight: '500', color: '#111' }}>
                    {formatDate(exitInterview.scheduled_date)}
                  </div>
                </div>
                {exitInterview.interviewer_name && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Interviewer</div>
                    <div style={{ fontWeight: '500', color: '#111' }}>
                      {exitInterview.interviewer_name}
                    </div>
                  </div>
                )}
              </div>

              {exitInterview.completed && (
                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', color: '#111' }}>Feedback Summary</h4>

                  {exitInterview.overall_experience && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Overall Experience</div>
                      <div style={{ color: '#111' }}>
                        {'★'.repeat(exitInterview.overall_experience)}
                        {'☆'.repeat(5 - exitInterview.overall_experience)}
                      </div>
                    </div>
                  )}

                  {exitInterview.reason_for_leaving && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Reason for Leaving</div>
                      <div style={{ color: '#111' }}>{exitInterview.reason_for_leaving}</div>
                    </div>
                  )}

                  {exitInterview.feedback_improvements && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Suggestions for Improvement</div>
                      <div style={{ color: '#111' }}>{exitInterview.feedback_improvements}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Handovers Section */}
      {activeSection === 'handovers' && (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ margin: 0, color: '#111' }}>Knowledge Transfer & Handovers</h3>
            {(isAdmin || isManager) && (
              <button
                onClick={() => setShowAddHandover(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#1976d2',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Add Handover
              </button>
            )}
          </div>

          {handovers.length === 0 ? (
            <div style={{ color: '#666', padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
              <p style={{ margin: 0 }}>No handover items added yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {handovers.map(handover => (
                <div
                  key={handover.id}
                  style={{
                    padding: '16px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${
                      handover.priority === 'high' ? '#f44336' :
                      handover.priority === 'medium' ? '#ff9800' : '#4caf50'
                    }`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#111' }}>{handover.item_name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {handover.item_type} • {handover.priority} priority
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: handover.status === 'completed' ? '#4caf50' :
                                 handover.status === 'in_progress' ? '#2196f3' : '#ff9800',
                      color: '#fff',
                      fontSize: '12px',
                      textTransform: 'capitalize'
                    }}>
                      {handover.status?.replace('_', ' ')}
                    </span>
                  </div>
                  {handover.description && (
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {handover.description}
                    </div>
                  )}
                  {handover.handover_to_name && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Assigned to: {handover.handover_to_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Handover Form */}
          {showAddHandover && (
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
                width: '100%',
                maxWidth: '400px'
              }}>
                <h3 style={{ margin: '0 0 16px', color: '#111' }}>Add Handover Item</h3>
                <form onSubmit={handleAddHandover}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#111', fontSize: '14px' }}>
                      Item Name *
                    </label>
                    <input
                      name="item_name"
                      required
                      placeholder="e.g., Client ABC Account"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#111', fontSize: '14px' }}>
                      Type *
                    </label>
                    <select
                      name="item_type"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        fontSize: '14px'
                      }}
                    >
                      <option value="project">Project</option>
                      <option value="client">Client</option>
                      <option value="document">Document</option>
                      <option value="system_access">System Access</option>
                      <option value="responsibility">Responsibility</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#111', fontSize: '14px' }}>
                      Priority
                    </label>
                    <select
                      name="priority"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        fontSize: '14px'
                      }}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#111', fontSize: '14px' }}>
                      Description
                    </label>
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="Details about what needs to be handed over..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        fontSize: '14px',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowAddHandover(false)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        background: '#fff',
                        color: '#111',
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
                        background: '#1976d2',
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Add
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Section */}
      {activeSection === 'details' && (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#111' }}>Workflow Details</h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Employee</div>
              <div style={{ color: '#111', fontWeight: '500' }}>{workflow.employee_name}</div>
              {workflow.employee_number && (
                <div style={{ fontSize: '12px', color: '#666' }}>{workflow.employee_number}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Termination Type</div>
              <div style={{ color: '#111' }}>{getTerminationLabel(workflow.termination_type)}</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Notice Date</div>
              <div style={{ color: '#111' }}>{formatDate(workflow.notice_date)}</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Last Working Day</div>
              <div style={{ color: '#111' }}>{formatDate(workflow.last_working_day)}</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Eligible for Rehire</div>
              <div style={{ color: '#111' }}>
                {workflow.eligible_for_rehire === true ? 'Yes' :
                 workflow.eligible_for_rehire === false ? 'No' : 'Not determined'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Reference Agreed</div>
              <div style={{ color: '#111' }}>{workflow.reference_agreed ? 'Yes' : 'No'}</div>
            </div>

            {workflow.manager_name && (
              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Manager</div>
                <div style={{ color: '#111' }}>{workflow.manager_name}</div>
              </div>
            )}

            {workflow.hr_owner_name && (
              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>HR Owner</div>
                <div style={{ color: '#111' }}>{workflow.hr_owner_name}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Initiated By</div>
              <div style={{ color: '#111' }}>{workflow.initiated_by_name || '-'}</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Created</div>
              <div style={{ color: '#111' }}>{formatDate(workflow.created_at)}</div>
            </div>
          </div>

          {workflow.reason && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Reason</div>
              <div style={{ color: '#111', background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
                {workflow.reason}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OffboardingDetail;
