/**
 * VoidStaffOS - Compliance Tasks
 * Task management for compliance follow-ups.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function ComplianceTasks({ user, onRefresh }) {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState({ status: 'pending', employee_id: '', task_type: '' });

  const isHR = user && (user.role_name === 'Admin' || user.role_name === 'HR Manager');

  const taskTypes = [
    { value: 'rtw_expiry', label: 'RTW Expiry' },
    { value: 'rtw_followup', label: 'RTW Follow-up' },
    { value: 'dbs_renewal', label: 'DBS Renewal' },
    { value: 'dbs_update_check', label: 'DBS Update Check' },
    { value: 'manual', label: 'Manual Task' }
  ];

  const [formData, setFormData] = useState({
    employee_id: '',
    title: '',
    description: '',
    due_date: '',
    assigned_to: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, [filter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.employee_id) params.append('employee_id', filter.employee_id);
      if (filter.task_type) params.append('task_type', filter.task_type);

      const response = await fetch(`/api/compliance/tasks?${params}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/users?status=active', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Handle both array and object response formats
        const userList = Array.isArray(data) ? data : (data.users || []);
        setEmployees(userList);
        setHrUsers(userList.filter(u => u.role_name === 'Admin' || u.role_name === 'HR Manager'));
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/compliance/tasks', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowForm(false);
        resetForm();
        fetchTasks();
        if (onRefresh) onRefresh();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    }
  };

  const handleStatusChange = async (taskId, newStatus, dismissReason = null) => {
    try {
      const body = { status: newStatus };
      if (dismissReason) body.dismissed_reason = dismissReason;

      const response = await apiFetch(`/api/compliance/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        fetchTasks();
        if (onRefresh) onRefresh();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleAssign = async (taskId, assignedTo) => {
    try {
      const response = await apiFetch(`/api/compliance/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ assigned_to: assignedTo || null })
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error assigning task:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      title: '',
      description: '',
      due_date: '',
      assigned_to: ''
    });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getTaskTypeLabel = (type) => {
    return taskTypes.find(t => t.value === type)?.label || type;
  };

  return (
    <div className="compliance-tasks">
      <div className="manager-header">
        <h2>Compliance Tasks</h2>
        {isHR && (
          <button
            className="btn-primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + New Task
          </button>
        )}
      </div>

      <div className="manager-filters">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={filter.employee_id}
          onChange={(e) => setFilter({ ...filter, employee_id: e.target.value })}
        >
          <option value="">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
          ))}
        </select>
        <select
          value={filter.task_type}
          onChange={(e) => setFilter({ ...filter, task_type: e.target.value })}
        >
          <option value="">All Types</option>
          {taskTypes.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal task-form-modal">
            <h3>New Compliance Task</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Employee *</label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Task title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  placeholder="Task details"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Due Date *</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Assign To</label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {hrUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading tasks...</div>
      ) : (
        <div className="tasks-list">
          {tasks.length === 0 ? (
            <div className="no-data-message">No tasks found</div>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                className={`task-card ${task.status} ${isOverdue(task.due_date) && task.status === 'pending' ? 'overdue' : ''}`}
              >
                <div className="task-header">
                  <span className={`task-type-badge ${task.task_type}`}>
                    {getTaskTypeLabel(task.task_type)}
                  </span>
                  <span className={`task-status ${task.status}`}>
                    {task.status}
                  </span>
                </div>

                <h4 className="task-title">{task.title}</h4>

                <div className="task-meta">
                  <div className="task-employee">
                    <strong>Employee:</strong> {task.employee_name}
                  </div>
                  <div className={`task-due ${isOverdue(task.due_date) && task.status === 'pending' ? 'overdue' : ''}`}>
                    <strong>Due:</strong> {formatDate(task.due_date)}
                    {isOverdue(task.due_date) && task.status === 'pending' && (
                      <span className="overdue-badge">OVERDUE</span>
                    )}
                  </div>
                </div>

                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}

                {isHR && task.status === 'pending' && (
                  <div className="task-actions">
                    <select
                      value={task.assigned_to || ''}
                      onChange={(e) => handleAssign(task.id, e.target.value)}
                      className="assign-select"
                    >
                      <option value="">Unassigned</option>
                      {hrUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                    <button
                      className="btn-small btn-complete"
                      onClick={() => handleStatusChange(task.id, 'completed')}
                    >
                      Complete
                    </button>
                    <button
                      className="btn-small btn-dismiss"
                      onClick={() => {
                        const reason = prompt('Reason for dismissing this task:');
                        if (reason !== null) {
                          handleStatusChange(task.id, 'dismissed', reason);
                        }
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {task.assigned_to_name && (
                  <div className="task-assigned">
                    <small>Assigned to: {task.assigned_to_name}</small>
                  </div>
                )}

                {task.status === 'dismissed' && task.dismissed_reason && (
                  <div className="task-dismissed-reason">
                    <small>Dismissed: {task.dismissed_reason}</small>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ComplianceTasks;
