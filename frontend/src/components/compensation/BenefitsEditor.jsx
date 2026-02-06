// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — BenefitsEditor
 * Card-based CRUD for employee benefits.
 * HR/Finance only for editing; employees can view.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

// Available benefit types matching the DB CHECK constraint
const BENEFIT_TYPES = ['pension', 'healthcare', 'car', 'bonus', 'stock', 'allowance', 'other'];
const FREQUENCIES = ['monthly', 'quarterly', 'annual', 'one-off'];

function BenefitsEditor({ user, employeeId, canEdit = false }) {
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    benefit_type: 'pension', provider: '', description: '', value: '',
    employer_contribution: '', employee_contribution: '', frequency: 'monthly',
    start_date: '', end_date: ''
  });

  // Fetch benefits for employee
  const fetchBenefits = async () => {
    try {
      const response = await apiFetch(`/api/compensation/benefits/${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setBenefits(data.data);
      } else {
        setError('Failed to load benefits');
      }
    } catch (err) {
      console.error('Fetch benefits error:', err);
      setError('Failed to load benefits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (employeeId) fetchBenefits(); }, [employeeId]);

  // Format currency for display
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  // Open create modal
  const handleCreate = () => {
    setEditingBenefit(null);
    setForm({
      benefit_type: 'pension', provider: '', description: '', value: '',
      employer_contribution: '', employee_contribution: '', frequency: 'monthly',
      start_date: '', end_date: ''
    });
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (benefit) => {
    setEditingBenefit(benefit);
    setForm({
      benefit_type: benefit.benefit_type,
      provider: benefit.provider || '',
      description: benefit.description || '',
      value: benefit.value || '',
      employer_contribution: benefit.employer_contribution || '',
      employee_contribution: benefit.employee_contribution || '',
      frequency: benefit.frequency || 'monthly',
      start_date: benefit.start_date ? benefit.start_date.split('T')[0] : '',
      end_date: benefit.end_date ? benefit.end_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  // Save benefit
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = { ...form, employee_id: employeeId };
      // Clean empty strings to null
      for (const key of ['value', 'employer_contribution', 'employee_contribution']) {
        if (payload[key] === '') payload[key] = null;
        else payload[key] = parseFloat(payload[key]);
      }
      if (payload.end_date === '') payload.end_date = null;

      const url = editingBenefit
        ? `/api/compensation/benefits/${editingBenefit.id}`
        : '/api/compensation/benefits';
      const method = editingBenefit ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowModal(false);
        await fetchBenefits();
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to save benefit');
      }
    } catch (err) {
      console.error('Save benefit error:', err);
      setError('Failed to save benefit');
    } finally {
      setSaving(false);
    }
  };

  // Delete benefit
  const handleDelete = async (benefit) => {
    if (!window.confirm(`Delete this ${benefit.benefit_type} benefit?`)) return;
    try {
      const response = await apiFetch(`/api/compensation/benefits/${benefit.id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchBenefits();
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to delete benefit');
      }
    } catch (err) {
      console.error('Delete benefit error:', err);
    }
  };

  if (loading) return <div className="loading">Loading benefits...</div>;

  return (
    <div className="benefits-editor">
      <div className="benefits-editor__header">
        <h3 className="comp-section-title">Benefits</h3>
        {canEdit && (
          <button className="btn btn--sm btn--primary" onClick={handleCreate}>+ Add Benefit</button>
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {/* Benefits cards grid */}
      <div className="benefits-grid">
        {benefits.length === 0 ? (
          <div className="empty-state"><p>No benefits recorded</p></div>
        ) : (
          benefits.map((benefit) => (
            <div key={benefit.id} className={`benefit-card ${benefit.end_date && new Date(benefit.end_date) < new Date() ? 'benefit-card--expired' : ''}`}>
              <div className="benefit-card__header">
                <span className="benefit-card__type">{benefit.benefit_type}</span>
                <span className="benefit-card__frequency">{benefit.frequency}</span>
              </div>
              {benefit.provider && <span className="benefit-card__provider">{benefit.provider}</span>}
              {benefit.description && <p className="benefit-card__desc">{benefit.description}</p>}
              {benefit.value && <span className="benefit-card__value">{formatCurrency(benefit.value)}</span>}
              {(benefit.employer_contribution || benefit.employee_contribution) && (
                <div className="benefit-card__contributions">
                  {benefit.employer_contribution && <span>Employer: {formatCurrency(benefit.employer_contribution)}</span>}
                  {benefit.employee_contribution && <span>Employee: {formatCurrency(benefit.employee_contribution)}</span>}
                </div>
              )}
              <div className="benefit-card__dates">
                <span>From: {formatDate(benefit.start_date)}</span>
                {benefit.end_date && <span>To: {formatDate(benefit.end_date)}</span>}
              </div>
              {canEdit && (
                <div className="benefit-card__actions">
                  <button className="btn btn--xs btn--secondary" onClick={() => handleEdit(benefit)}>Edit</button>
                  <button className="btn btn--xs btn--danger" onClick={() => handleDelete(benefit)}>Remove</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBenefit ? 'Edit Benefit' : 'Add Benefit'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="benefit-type">Type *</label>
                    <select id="benefit-type" value={form.benefit_type}
                      onChange={(e) => setForm({ ...form, benefit_type: e.target.value })}>
                      {BENEFIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="benefit-freq">Frequency</label>
                    <select id="benefit-freq" value={form.frequency}
                      onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="benefit-provider">Provider</label>
                  <input id="benefit-provider" type="text" value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="benefit-desc">Description</label>
                  <textarea id="benefit-desc" rows="2" value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="benefit-value">Value</label>
                    <input id="benefit-value" type="number" step="0.01" value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="benefit-employer">Employer Contribution</label>
                    <input id="benefit-employer" type="number" step="0.01" value={form.employer_contribution}
                      onChange={(e) => setForm({ ...form, employer_contribution: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="benefit-employee">Employee Contribution</label>
                    <input id="benefit-employee" type="number" step="0.01" value={form.employee_contribution}
                      onChange={(e) => setForm({ ...form, employee_contribution: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="benefit-start">Start Date *</label>
                    <input id="benefit-start" type="date" required value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="benefit-end">End Date</label>
                    <input id="benefit-end" type="date" value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingBenefit ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BenefitsEditor;
