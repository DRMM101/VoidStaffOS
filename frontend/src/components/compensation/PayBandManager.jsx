// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — PayBandManager
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
    </div>
  );
}

export default PayBandManager;
