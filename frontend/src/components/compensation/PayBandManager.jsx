// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — PayBandManager
 * CRUD table for managing pay bands. HR/Admin only.
 * Supports inline editing via modal.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import PageHeader from '../layout/PageHeader';

function PayBandManager({ user }) {
  const [bands, setBands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBand, setEditingBand] = useState(null);
  const [form, setForm] = useState({
    band_name: '', grade: '', min_salary: '', mid_salary: '', max_salary: '', currency: 'GBP', tier_level: ''
  });
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState([]);
  const [settings, setSettings] = useState({ enable_tier_band_linking: false });
  /* Assign employees modal state */
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignBand, setAssignBand] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [assignForm, setAssignForm] = useState({ employee_id: '', base_salary: '', effective_date: '' });
  const [assignError, setAssignError] = useState(null);
  const [bandEmployees, setBandEmployees] = useState([]);

  // Fetch all pay bands, tiers, and settings
  const fetchBands = async () => {
    try {
      const response = await apiFetch('/api/compensation/pay-bands');
      if (response.ok) {
        const data = await response.json();
        setBands(data.data);
      } else {
        setError('Failed to load pay bands');
      }
    } catch (err) {
      console.error('Fetch pay bands error:', err);
      setError('Failed to load pay bands');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBands();
    // Fetch settings and tiers for tier-band linking feature
    apiFetch('/api/compensation/settings').then(async r => {
      if (r.ok) setSettings(await r.json());
    }).catch(() => {});
    apiFetch('/api/roles/tiers').then(async r => {
      if (r.ok) {
        const d = await r.json();
        setTiers(Array.isArray(d) ? d : d.data || []);
      }
    }).catch(() => {});
  }, []);

  // Format currency for display
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  };

  // Open modal to create new band
  const handleCreate = () => {
    setEditingBand(null);
    setForm({ band_name: '', grade: '', min_salary: '', mid_salary: '', max_salary: '', currency: 'GBP', tier_level: '' });
    setShowModal(true);
  };

  // Open modal to edit existing band
  const handleEdit = (band) => {
    setEditingBand(band);
    setForm({
      band_name: band.band_name,
      grade: band.grade,
      min_salary: band.min_salary,
      mid_salary: band.mid_salary,
      max_salary: band.max_salary,
      currency: band.currency || 'GBP',
      tier_level: band.tier_level || ''
    });
    setShowModal(true);
  };

  // Save (create or update)
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingBand
        ? `/api/compensation/pay-bands/${editingBand.id}`
        : '/api/compensation/pay-bands';
      const method = editingBand ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          band_name: form.band_name.trim(),
          grade: parseInt(form.grade),
          min_salary: parseFloat(form.min_salary),
          mid_salary: parseFloat(form.mid_salary),
          max_salary: parseFloat(form.max_salary),
          currency: form.currency,
          tier_level: form.tier_level ? parseInt(form.tier_level) : null
        })
      });

      if (response.ok) {
        setShowModal(false);
        await fetchBands();
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to save pay band');
      }
    } catch (err) {
      console.error('Save pay band error:', err);
      setError('Failed to save pay band');
    } finally {
      setSaving(false);
    }
  };

  // Delete a pay band
  const handleDelete = async (band) => {
    if (!window.confirm(`Delete pay band "${band.band_name}"? This cannot be undone.`)) return;

    try {
      const response = await apiFetch(`/api/compensation/pay-bands/${band.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchBands();
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to delete pay band');
      }
    } catch (err) {
      console.error('Delete pay band error:', err);
      setError('Failed to delete pay band');
    }
  };

  /* Open assign employees modal for a specific band */
  const handleAssign = async (band) => {
    setAssignBand(band);
    setAssignForm({ employee_id: '', base_salary: '', effective_date: new Date().toISOString().split('T')[0] });
    setAssignError(null);

    try {
      // Fetch employees list
      const empRes = await apiFetch('/api/users');
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : empData.data || []);
      }
      // Fetch current employees on this band via compensation records
      const recRes = await apiFetch(`/api/compensation/pay-bands/${band.id}/employees`);
      if (recRes.ok) {
        const recData = await recRes.json();
        setBandEmployees(recData.data || []);
      } else {
        setBandEmployees([]);
      }
    } catch (err) {
      console.error('Fetch employees for assign:', err);
    }
    setShowAssignModal(true);
  };

  /* Submit new employee assignment to this pay band */
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAssignError(null);

    try {
      const response = await apiFetch('/api/compensation/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: parseInt(assignForm.employee_id),
          pay_band_id: assignBand.id,
          base_salary: parseFloat(assignForm.base_salary),
          effective_date: assignForm.effective_date,
          reason: `Assigned to ${assignBand.band_name} pay band`
        })
      });

      if (response.ok) {
        // Refresh the band employees list
        const recRes = await apiFetch(`/api/compensation/pay-bands/${assignBand.id}/employees`);
        if (recRes.ok) {
          const recData = await recRes.json();
          setBandEmployees(recData.data || []);
        }
        // Reset form for another assignment
        setAssignForm({ ...assignForm, employee_id: '', base_salary: '' });
      } else {
        const errData = await response.json();
        setAssignError(errData.error || 'Failed to assign employee');
      }
    } catch (err) {
      console.error('Assign employee error:', err);
      setAssignError('Failed to assign employee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading pay bands...</div>;

  return (
    <div className="pay-band-manager">
      <PageHeader
        title="Pay Bands"
        subtitle="Manage organisation salary structure"
        actions={
          <button className="btn btn--primary" onClick={handleCreate}>
            + New Pay Band
          </button>
        }
      />

      {error && <div className="alert alert--error">{error}</div>}

      {/* Pay bands table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Band Name</th>
              <th>Grade</th>
              <th>Min Salary</th>
              <th>Mid Salary</th>
              <th>Max Salary</th>
              <th>Currency</th>
              {settings.enable_tier_band_linking && <th>Tier</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bands.length === 0 ? (
              <tr><td colSpan={settings.enable_tier_band_linking ? 8 : 7} className="text-center text-muted">No pay bands defined yet</td></tr>
            ) : (
              bands.map((band) => (
                <tr key={band.id}>
                  <td><strong>{band.band_name}</strong></td>
                  <td>{band.grade}</td>
                  <td>{formatCurrency(band.min_salary)}</td>
                  <td>{formatCurrency(band.mid_salary)}</td>
                  <td>{formatCurrency(band.max_salary)}</td>
                  <td>{band.currency}</td>
                  {settings.enable_tier_band_linking && (
                    <td>{tiers.find(t => t.tier_level === band.tier_level)?.tier_name || '-'}</td>
                  )}
                  <td>
                    <div className="table-actions">
                      <button className="btn btn--sm btn--secondary" onClick={() => handleAssign(band)}>Assign</button>
                      <button className="btn btn--sm btn--secondary" onClick={() => handleEdit(band)}>Edit</button>
                      <button className="btn btn--sm btn--danger" onClick={() => handleDelete(band)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBand ? 'Edit Pay Band' : 'New Pay Band'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="band_name">Band Name *</label>
                  <input
                    id="band_name" type="text" required
                    value={form.band_name}
                    onChange={(e) => setForm({ ...form, band_name: e.target.value })}
                    placeholder="e.g. Junior Developer"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="grade">Grade *</label>
                  <input
                    id="grade" type="number" required min="1"
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="min_salary">Min Salary *</label>
                    <input
                      id="min_salary" type="number" required min="0" step="0.01"
                      value={form.min_salary}
                      onChange={(e) => setForm({ ...form, min_salary: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="mid_salary">Mid Salary *</label>
                    <input
                      id="mid_salary" type="number" required min="0" step="0.01"
                      value={form.mid_salary}
                      onChange={(e) => setForm({ ...form, mid_salary: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="max_salary">Max Salary *</label>
                    <input
                      id="max_salary" type="number" required min="0" step="0.01"
                      value={form.max_salary}
                      onChange={(e) => setForm({ ...form, max_salary: e.target.value })}
                    />
                  </div>
                </div>
                {/* Tier dropdown — shown when tier-band linking is enabled */}
                {settings.enable_tier_band_linking && (
                  <div className="form-group">
                    <label htmlFor="tier_level">Linked Tier (optional)</label>
                    <select
                      id="tier_level"
                      value={form.tier_level}
                      onChange={(e) => setForm({ ...form, tier_level: e.target.value })}
                    >
                      <option value="">No tier link</option>
                      {tiers.map(t => (
                        <option key={t.tier_level} value={t.tier_level}>
                          {t.tier_name} ({t.tier_level})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingBand ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Assign Employees Modal */}
      {showAssignModal && assignBand && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Employees — {assignBand.band_name}</h2>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Current employees on this band */}
              <h3 style={{ marginBottom: '8px', fontSize: '0.95rem' }}>Currently Assigned</h3>
              {bandEmployees.length === 0 ? (
                <p className="text-muted" style={{ marginBottom: '16px' }}>No employees assigned to this band yet.</p>
              ) : (
                <table className="table" style={{ marginBottom: '16px' }}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Salary</th>
                      <th>Effective Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td>{emp.full_name || emp.employee_name || `Employee #${emp.employee_id}`}</td>
                        <td>{formatCurrency(emp.base_salary)}</td>
                        <td>{new Date(emp.effective_date).toLocaleDateString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Add new assignment form */}
              <h3 style={{ marginBottom: '8px', fontSize: '0.95rem' }}>Add Employee</h3>
              {assignError && <div className="alert alert--error" style={{ marginBottom: '8px' }}>{assignError}</div>}
              <form onSubmit={handleAssignSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="assign_employee">Employee *</label>
                    <select
                      id="assign_employee" required
                      value={assignForm.employee_id}
                      onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                    >
                      <option value="">Select employee...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="assign_salary">Base Salary *</label>
                    <input
                      id="assign_salary" type="number" required min="0" step="0.01"
                      value={assignForm.base_salary}
                      onChange={(e) => setAssignForm({ ...assignForm, base_salary: e.target.value })}
                      placeholder={`${formatCurrency(assignBand.min_salary)} – ${formatCurrency(assignBand.max_salary)}`}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="assign_date">Effective Date *</label>
                    <input
                      id="assign_date" type="date" required
                      value={assignForm.effective_date}
                      onChange={(e) => setAssignForm({ ...assignForm, effective_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn--secondary" onClick={() => setShowAssignModal(false)}>Close</button>
                  <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Assigning...' : 'Assign Employee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayBandManager;
