// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Bonus Scheme Manager
 * Admin/HR CRUD for bonus scheme templates with calculation engine.
 * Supports percentage-based and fixed bonuses, optionally linked to tiers/bands.
 * Includes assignment management with approve/reject/apply workflow.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

function BonusSchemeManager({ user }) {
  const [schemes, setSchemes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payBands, setPayBands] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [showCalcPreview, setShowCalcPreview] = useState(false);
  const [calcResults, setCalcResults] = useState([]);
  const [calcScheme, setCalcScheme] = useState(null);
  const [activeTab, setActiveTab] = useState('schemes'); // 'schemes' or 'assignments'
  const [form, setForm] = useState({
    scheme_name: '', description: '', calculation_type: 'percentage',
    calculation_value: '', basis: 'base_salary', frequency: 'annual',
    tier_level: '', pay_band_id: '', min_service_months: 0, is_active: true
  });

  const isAdmin = user?.role_name === 'Admin';
  const canManage = ['Admin', 'HR', 'HR Manager'].includes(user?.role_name);

  // Fetch schemes, assignments, pay bands, and tiers on mount
  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [schemesRes, assignmentsRes, bandsRes, tiersRes] = await Promise.all([
        apiFetch('/api/compensation/bonus-schemes'),
        apiFetch('/api/compensation/bonus-assignments'),
        apiFetch('/api/compensation/pay-bands'),
        apiFetch('/api/roles/tiers').catch(() => ({ ok: false }))
      ]);

      if (schemesRes.ok) {
        const data = await schemesRes.json();
        setSchemes(data.data || []);
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(data.data || []);
      }
      if (bandsRes.ok) {
        const data = await bandsRes.json();
        setPayBands(data.data || []);
      }
      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setTiers(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      setError('Failed to load bonus schemes');
    } finally {
      setLoading(false);
    }
  }

  // Open create modal
  const handleCreate = () => {
    setEditingScheme(null);
    setForm({
      scheme_name: '', description: '', calculation_type: 'percentage',
      calculation_value: '', basis: 'base_salary', frequency: 'annual',
      tier_level: '', pay_band_id: '', min_service_months: 0, is_active: true
    });
    setShowModal(true);
  };

  // Open edit modal with existing scheme data
  const handleEdit = (scheme) => {
    setEditingScheme(scheme);
    setForm({
      scheme_name: scheme.scheme_name,
      description: scheme.description || '',
      calculation_type: scheme.calculation_type,
      calculation_value: scheme.calculation_value,
      basis: scheme.basis || 'base_salary',
      frequency: scheme.frequency || 'annual',
      tier_level: scheme.tier_level || '',
      pay_band_id: scheme.pay_band_id || '',
      min_service_months: scheme.min_service_months || 0,
      is_active: scheme.is_active
    });
    setShowModal(true);
  };

  // Save (create or update) scheme
  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        tier_level: form.tier_level || null,
        pay_band_id: form.pay_band_id || null,
        calculation_value: Number(form.calculation_value),
        min_service_months: Number(form.min_service_months)
      };

      const url = editingScheme
        ? `/api/compensation/bonus-schemes/${editingScheme.id}`
        : '/api/compensation/bonus-schemes';
      const method = editingScheme ? 'PUT' : 'POST';

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
        alert(err.error || 'Failed to save scheme');
      }
    } catch (err) {
      alert('Network error — please try again');
    }
  };

  // Delete scheme (Admin only)
  const handleDelete = async (id) => {
    if (!confirm('Delete this bonus scheme?')) return;
    try {
      const res = await apiFetch(`/api/compensation/bonus-schemes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete scheme');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  // Calculate bonuses for a scheme
  const handleCalculate = async (scheme) => {
    const effectiveDate = prompt('Enter effective date for bonus calculation (YYYY-MM-DD):');
    if (!effectiveDate) return;

    try {
      const res = await apiFetch(`/api/compensation/bonus-schemes/${scheme.id}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effective_date: effectiveDate })
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResults(data.data || []);
        setCalcScheme(data.scheme);
        setShowCalcPreview(true);
        fetchAll(); // Refresh assignments
      } else {
        const err = await res.json();
        alert(err.error || 'Calculation failed');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  // Approve or reject an assignment
  const handleAssignmentAction = async (assignmentId, status) => {
    try {
      const res = await apiFetch(`/api/compensation/bonus-assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchAll();
      else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  // Apply an approved assignment (creates benefit)
  const handleApply = async (assignmentId) => {
    try {
      const res = await apiFetch(`/api/compensation/bonus-assignments/${assignmentId}/apply`, {
        method: 'POST'
      });
      if (res.ok) fetchAll();
      else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  // Format currency values
  const formatCurrency = (val) => {
    if (!val) return '-';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val);
  };

  // Status badge colour mapping
  const statusClass = (status) => {
    const map = { pending: 'amber', approved: 'green', applied: 'blue', rejected: 'red' };
    return `assignment-status-badge assignment-status-badge--${map[status] || 'grey'}`;
  };

  if (loading) return <div className="bonus-scheme-manager"><p>Loading bonus schemes...</p></div>;
  if (error) return <div className="bonus-scheme-manager"><p className="error-text">{error}</p></div>;

  return (
    <div className="bonus-scheme-manager">
      {/* Header */}
      <div className="bonus-scheme-manager__header">
        <h2>Bonus Schemes</h2>
        {canManage && (
          <button className="btn btn--primary" onClick={handleCreate}>+ New Scheme</button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="bonus-scheme-manager__tabs">
        <button
          className={`tab-btn ${activeTab === 'schemes' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('schemes')}
        >
          Schemes ({schemes.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'assignments' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments ({assignments.length})
        </button>
      </div>

      {/* Schemes Tab */}
      {activeTab === 'schemes' && (
        <div className="bonus-scheme-manager__table-wrap">
          {schemes.length === 0 ? (
            <p className="empty-state">No bonus schemes defined yet</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scheme Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Frequency</th>
                  <th>Tier</th>
                  <th>Band</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.scheme_name}</strong></td>
                    <td>{s.calculation_type}</td>
                    <td>{s.calculation_type === 'percentage' ? `${s.calculation_value}%` : formatCurrency(s.calculation_value)}</td>
                    <td>{s.frequency}</td>
                    <td>{s.tier_name || '-'}</td>
                    <td>{s.band_name || '-'}</td>
                    <td>{s.is_active ? 'Yes' : 'No'}</td>
                    <td className="actions-cell">
                      {canManage && (
                        <>
                          <button className="btn btn--sm" onClick={() => handleEdit(s)}>Edit</button>
                          <button className="btn btn--sm btn--primary" onClick={() => handleCalculate(s)}>Calculate</button>
                          {isAdmin && <button className="btn btn--sm btn--danger" onClick={() => handleDelete(s.id)}>Delete</button>}
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
        <div className="bonus-scheme-manager__table-wrap">
          {assignments.length === 0 ? (
            <p className="empty-state">No bonus assignments yet. Use Calculate on a scheme to generate assignments.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Scheme</th>
                  <th>Base</th>
                  <th>Bonus Amount</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id}>
                    <td>{a.employee_name}</td>
                    <td>{a.scheme_name}</td>
                    <td>{formatCurrency(a.base_amount)}</td>
                    <td><strong>{formatCurrency(a.calculated_amount)}</strong></td>
                    <td>{new Date(a.effective_date).toLocaleDateString('en-GB')}</td>
                    <td><span className={statusClass(a.status)}>{a.status}</span></td>
                    <td className="actions-cell">
                      {canManage && a.status === 'pending' && (
                        <>
                          <button className="btn btn--sm btn--primary" onClick={() => handleAssignmentAction(a.id, 'approved')}>Approve</button>
                          <button className="btn btn--sm btn--danger" onClick={() => handleAssignmentAction(a.id, 'rejected')}>Reject</button>
                        </>
                      )}
                      {canManage && a.status === 'approved' && (
                        <button className="btn btn--sm btn--primary" onClick={() => handleApply(a.id)}>Apply</button>
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
            <h3>{editingScheme ? 'Edit Bonus Scheme' : 'New Bonus Scheme'}</h3>
            <div className="modal__form">
              {/* Scheme name */}
              <label>
                Scheme Name *
                <input type="text" value={form.scheme_name}
                  onChange={e => setForm({ ...form, scheme_name: e.target.value })} />
              </label>

              {/* Description */}
              <label>
                Description
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </label>

              {/* Calculation type radio */}
              <fieldset className="modal__fieldset">
                <legend>Calculation Type *</legend>
                <label className="radio-label">
                  <input type="radio" name="calc_type" value="percentage"
                    checked={form.calculation_type === 'percentage'}
                    onChange={() => setForm({ ...form, calculation_type: 'percentage' })} />
                  Percentage of salary
                </label>
                <label className="radio-label">
                  <input type="radio" name="calc_type" value="fixed"
                    checked={form.calculation_type === 'fixed'}
                    onChange={() => setForm({ ...form, calculation_type: 'fixed' })} />
                  Fixed amount
                </label>
              </fieldset>

              {/* Calculation value */}
              <label>
                {form.calculation_type === 'percentage' ? 'Percentage (%)' : 'Fixed Amount (GBP)'} *
                <input type="number" step="0.01" value={form.calculation_value}
                  onChange={e => setForm({ ...form, calculation_value: e.target.value })} />
              </label>

              {/* Basis (for percentage type) */}
              {form.calculation_type === 'percentage' && (
                <label>
                  Basis
                  <select value={form.basis} onChange={e => setForm({ ...form, basis: e.target.value })}>
                    <option value="base_salary">Base Salary</option>
                    <option value="total_compensation">Total Compensation</option>
                  </select>
                </label>
              )}

              {/* Frequency */}
              <label>
                Frequency
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                  <option value="one-off">One-off</option>
                </select>
              </label>

              {/* Tier link (optional) */}
              <label>
                Linked Tier (optional)
                <select value={form.tier_level} onChange={e => setForm({ ...form, tier_level: e.target.value })}>
                  <option value="">No tier link</option>
                  {tiers.map(t => (
                    <option key={t.tier_level} value={t.tier_level}>{t.tier_name} ({t.tier_level})</option>
                  ))}
                </select>
              </label>

              {/* Pay band link (optional) */}
              <label>
                Linked Pay Band (optional)
                <select value={form.pay_band_id} onChange={e => setForm({ ...form, pay_band_id: e.target.value })}>
                  <option value="">No band link</option>
                  {payBands.map(b => (
                    <option key={b.id} value={b.id}>{b.band_name} (Grade {b.grade})</option>
                  ))}
                </select>
              </label>

              {/* Min service months */}
              <label>
                Minimum Service (months)
                <input type="number" min="0" value={form.min_service_months}
                  onChange={e => setForm({ ...form, min_service_months: e.target.value })} />
              </label>

              {/* Active toggle */}
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>
            </div>

            <div className="modal__actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSave}>
                {editingScheme ? 'Save Changes' : 'Create Scheme'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculation Preview Modal */}
      {showCalcPreview && (
        <div className="modal-overlay" onClick={() => setShowCalcPreview(false)}>
          <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
            <h3>Bonus Calculation Results</h3>
            {calcScheme && (
              <p className="calc-preview__summary">
                Scheme: <strong>{calcScheme.scheme_name}</strong> —
                {calcScheme.calculation_type === 'percentage'
                  ? ` ${calcScheme.calculation_value}% of salary`
                  : ` ${formatCurrency(calcScheme.calculation_value)} fixed`
                }
              </p>
            )}
            {calcResults.length === 0 ? (
              <p>No eligible employees found for this scheme.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Base Salary</th>
                    <th>Calculated Bonus</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calcResults.map(r => (
                    <tr key={r.id}>
                      <td>{r.employee_name || `Employee ${r.employee_id}`}</td>
                      <td>{formatCurrency(r.base_amount)}</td>
                      <td><strong>{formatCurrency(r.calculated_amount)}</strong></td>
                      <td><span className={statusClass(r.status)}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="modal__actions">
              <button className="btn btn--primary" onClick={() => { setShowCalcPreview(false); setActiveTab('assignments'); }}>
                View Assignments
              </button>
              <button className="btn" onClick={() => setShowCalcPreview(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BonusSchemeManager;
