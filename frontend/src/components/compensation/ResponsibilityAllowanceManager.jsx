// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Responsibility Allowance Manager
 * Admin/HR CRUD for allowance templates with employee assignment.
 * Supports linking allowances to tiers, pay bands, or additional roles.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

function ResponsibilityAllowanceManager({ user }) {
  const [allowances, setAllowances] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payBands, setPayBands] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState(null);
  const [assigningAllowance, setAssigningAllowance] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('allowances');
  const [form, setForm] = useState({
    allowance_name: '', description: '', amount: '',
    frequency: 'monthly', tier_level: '', pay_band_id: '',
    additional_role_id: '', is_active: true
  });
  const [assignForm, setAssignForm] = useState({
    employee_ids: [], start_date: ''
  });

  const isAdmin = user?.role_name === 'Admin';
  const canManage = ['Admin', 'HR', 'HR Manager'].includes(user?.role_name);

  // Fetch all data on mount
  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [allowRes, assignRes, bandsRes, tiersRes] = await Promise.all([
        apiFetch('/api/compensation/responsibility-allowances'),
        apiFetch('/api/compensation/allowance-assignments'),
        apiFetch('/api/compensation/pay-bands'),
        apiFetch('/api/roles/tiers').catch(() => ({ ok: false }))
      ]);

      if (allowRes.ok) { const d = await allowRes.json(); setAllowances(d.data || []); }
      if (assignRes.ok) { const d = await assignRes.json(); setAssignments(d.data || []); }
      if (bandsRes.ok) { const d = await bandsRes.json(); setPayBands(d.data || []); }
      if (tiersRes.ok) { const d = await tiersRes.json(); setTiers(Array.isArray(d) ? d : d.data || []); }
    } catch (err) {
      setError('Failed to load allowances');
    } finally {
      setLoading(false);
    }
  }

  // Fetch employee list for assignment modal
  async function fetchEmployees() {
    try {
      const res = await apiFetch('/api/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  }

  // Open create modal
  const handleCreate = () => {
    setEditingAllowance(null);
    setForm({
      allowance_name: '', description: '', amount: '',
      frequency: 'monthly', tier_level: '', pay_band_id: '',
      additional_role_id: '', is_active: true
    });
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (a) => {
    setEditingAllowance(a);
    setForm({
      allowance_name: a.allowance_name,
      description: a.description || '',
      amount: a.amount,
      frequency: a.frequency || 'monthly',
      tier_level: a.tier_level || '',
      pay_band_id: a.pay_band_id || '',
      additional_role_id: a.additional_role_id || '',
      is_active: a.is_active
    });
    setShowModal(true);
  };

  // Save (create or update) allowance
  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        tier_level: form.tier_level || null,
        pay_band_id: form.pay_band_id || null,
        additional_role_id: form.additional_role_id || null
      };

      const url = editingAllowance
        ? `/api/compensation/responsibility-allowances/${editingAllowance.id}`
        : '/api/compensation/responsibility-allowances';
      const method = editingAllowance ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        fetchAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save allowance');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  // Delete allowance (Admin only)
  const handleDelete = async (id) => {
    if (!confirm('Delete this allowance?')) return;
    try {
      const res = await apiFetch(`/api/compensation/responsibility-allowances/${id}`, { method: 'DELETE' });
      if (res.ok) fetchAll();
      else { const err = await res.json(); alert(err.error); }
    } catch (err) {
      alert('Network error');
    }
  };

  // Open assignment modal
  const handleAssign = async (allowance) => {
    setAssigningAllowance(allowance);
    setAssignForm({ employee_ids: [], start_date: new Date().toISOString().split('T')[0] });
    await fetchEmployees();
    setShowAssignModal(true);
  };

  // Submit assignment
  const handleAssignSubmit = async () => {
    if (assignForm.employee_ids.length === 0) {
      return alert('Select at least one employee');
    }
    try {
      const res = await apiFetch(`/api/compensation/responsibility-allowances/${assigningAllowance.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm)
      });
      if (res.ok) {
        setShowAssignModal(false);
        fetchAll();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  // End an assignment (set end_date)
  const handleEndAssignment = async (assignmentId) => {
    const endDate = prompt('Enter end date (YYYY-MM-DD):');
    if (!endDate) return;
    try {
      const res = await apiFetch(`/api/compensation/allowance-assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end_date: endDate })
      });
      if (res.ok) fetchAll();
      else { const err = await res.json(); alert(err.error); }
    } catch (err) {
      alert('Network error');
    }
  };

  // Toggle employee selection in assign modal
  const toggleEmployee = (empId) => {
    setAssignForm(prev => ({
      ...prev,
      employee_ids: prev.employee_ids.includes(empId)
        ? prev.employee_ids.filter(id => id !== empId)
        : [...prev.employee_ids, empId]
    }));
  };

  // Format currency
  const formatCurrency = (val) => {
    if (!val) return '-';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val);
  };

  if (loading) return <div className="allowance-manager"><p>Loading responsibility allowances...</p></div>;
  if (error) return <div className="allowance-manager"><p className="error-text">{error}</p></div>;

  return (
    <div className="allowance-manager">
      {/* Header */}
      <div className="allowance-manager__header">
        <h2>Responsibility Allowances</h2>
        {canManage && (
          <button className="btn btn--primary" onClick={handleCreate}>+ New Allowance</button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="allowance-manager__tabs">
        <button className={`tab-btn ${activeTab === 'allowances' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('allowances')}>
          Allowances ({allowances.length})
        </button>
        <button className={`tab-btn ${activeTab === 'assignments' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('assignments')}>
          Assignments ({assignments.length})
        </button>
      </div>

      {/* Allowances Tab */}
      {activeTab === 'allowances' && (
        <div className="allowance-manager__table-wrap">
          {allowances.length === 0 ? (
            <p className="empty-state">No responsibility allowances defined yet</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Allowance Name</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Tier</th>
                  <th>Band</th>
                  <th>Role</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allowances.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.allowance_name}</strong></td>
                    <td>{formatCurrency(a.amount)}</td>
                    <td>{a.frequency}</td>
                    <td>{a.tier_name || '-'}</td>
                    <td>{a.band_name || '-'}</td>
                    <td>{a.additional_role_name || '-'}</td>
                    <td>{a.is_active ? 'Yes' : 'No'}</td>
                    <td className="actions-cell">
                      {canManage && (
                        <>
                          <button className="btn btn--sm" onClick={() => handleEdit(a)}>Edit</button>
                          <button className="btn btn--sm btn--primary" onClick={() => handleAssign(a)}>Assign</button>
                          {isAdmin && <button className="btn btn--sm btn--danger" onClick={() => handleDelete(a.id)}>Delete</button>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="allowance-manager__table-wrap">
          {assignments.length === 0 ? (
            <p className="empty-state">No allowance assignments yet</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Allowance</th>
                  <th>Amount</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id}>
                    <td>{a.employee_name}</td>
                    <td>{a.allowance_name}</td>
                    <td>{formatCurrency(a.amount)}</td>
                    <td>{new Date(a.start_date).toLocaleDateString('en-GB')}</td>
                    <td>{a.end_date ? new Date(a.end_date).toLocaleDateString('en-GB') : 'Ongoing'}</td>
                    <td className="actions-cell">
                      {canManage && !a.end_date && (
                        <button className="btn btn--sm" onClick={() => handleEndAssignment(a.id)}>End</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingAllowance ? 'Edit Allowance' : 'New Responsibility Allowance'}</h3>
            <div className="modal__form">
              <label>
                Allowance Name *
                <input type="text" value={form.allowance_name}
                  onChange={e => setForm({ ...form, allowance_name: e.target.value })} />
              </label>
              <label>
                Description
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </label>
              <label>
                Amount (GBP) *
                <input type="number" step="0.01" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label>
                Frequency
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </label>
              <label>
                Linked Tier (optional)
                <select value={form.tier_level} onChange={e => setForm({ ...form, tier_level: e.target.value })}>
                  <option value="">No tier link</option>
                  {tiers.map(t => (
                    <option key={t.tier_level} value={t.tier_level}>{t.tier_name} ({t.tier_level})</option>
                  ))}
                </select>
              </label>
              <label>
                Linked Pay Band (optional)
                <select value={form.pay_band_id} onChange={e => setForm({ ...form, pay_band_id: e.target.value })}>
                  <option value="">No band link</option>
                  {payBands.map(b => (
                    <option key={b.id} value={b.id}>{b.band_name} (Grade {b.grade})</option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="modal__actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSave}>
                {editingAllowance ? 'Save Changes' : 'Create Allowance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Employees Modal */}
      {showAssignModal && assigningAllowance && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Assign: {assigningAllowance.allowance_name}</h3>
            <p>Amount: {formatCurrency(assigningAllowance.amount)} / {assigningAllowance.frequency}</p>
            <div className="modal__form">
              <label>
                Start Date *
                <input type="date" value={assignForm.start_date}
                  onChange={e => setAssignForm({ ...assignForm, start_date: e.target.value })} />
              </label>
              <fieldset className="modal__fieldset">
                <legend>Select Employees</legend>
                <div className="employee-checklist">
                  {employees.map(emp => (
                    <label key={emp.id} className="checkbox-label">
                      <input type="checkbox"
                        checked={assignForm.employee_ids.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)} />
                      {emp.full_name} ({emp.email})
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="modal__actions">
              <button className="btn" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleAssignSubmit}>
                Assign to {assignForm.employee_ids.length} Employee{assignForm.employee_ids.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResponsibilityAllowanceManager;
