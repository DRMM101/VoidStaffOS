/**
 * VoidStaffOS - Role Management Component
 * Admin interface for managing tier definitions and additional roles.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 26/01/2026
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
import './RoleManagement.css';

function RoleManagement({ user }) {
  const [tiers, setTiers] = useState([]);
  const [additionalRoles, setAdditionalRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('tiers');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingRole, setEditingRole] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningRole, setAssigningRole] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [roleAssignments, setRoleAssignments] = useState([]);
  const [editingTier, setEditingTier] = useState(null);
  const [showTierEditModal, setShowTierEditModal] = useState(false);

  const isAdmin = user.role_name === 'Admin';
  const isCEO = user.tier === 100;
  const canEditRoles = isAdmin || isCEO;

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'hr', label: 'HR' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'safety', label: 'Safety' },
    { value: 'finance', label: 'Finance' },
    { value: 'operations', label: 'Operations' },
    { value: 'regulatory', label: 'Regulatory' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tiersRes, rolesRes, usersRes] = await Promise.all([
        fetch('/api/roles/tiers', { credentials: 'include' }),
        fetch('/api/roles/additional', { credentials: 'include' }),
        fetch('/api/users', { credentials: 'include' })
      ]);

      const tiersData = await tiersRes.json();
      const rolesData = await rolesRes.json();
      const usersData = await usersRes.json();

      if (tiersRes.ok) {
        setTiers(tiersData.tiers);
      } else {
        setError(tiersData.error);
      }

      if (rolesRes.ok) {
        setAdditionalRoles(rolesData.roles);
      } else {
        setError(rolesData.error);
      }

      if (usersRes.ok) {
        setUsers(usersData.users || []);
      }
    } catch (err) {
      setError('Failed to fetch role data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleAssignments = async (roleId) => {
    try {
      // Fetch all users who have this role assigned
      const assignments = [];
      for (const u of users) {
        const res = await fetch(`/api/roles/user/${u.id}/additional`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const hasRole = data.additional_roles.find(r => r.additional_role_id === roleId);
          if (hasRole) {
            assignments.push({ ...hasRole, user_name: u.full_name, user_id: u.id });
          }
        }
      }
      setRoleAssignments(assignments);
    } catch (err) {
      console.error('Failed to fetch role assignments');
    }
  };

  const handleAssignRole = (role) => {
    setAssigningRole(role);
    setSelectedUserId('');
    setRoleAssignments([]);
    setShowAssignModal(true);
    fetchRoleAssignments(role.id);
  };

  const handleAssignToUser = async () => {
    if (!selectedUserId || !assigningRole) return;

    try {
      const response = await apiFetch(`/api/roles/user/${selectedUserId}/additional`, {
        method: 'POST',
        body: JSON.stringify({ additional_role_id: assigningRole.id })
      });

      const data = await response.json();
      if (response.ok) {
        setSelectedUserId('');
        fetchRoleAssignments(assigningRole.id);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to assign role');
    }
  };

  const handleRemoveAssignment = async (userId, assignmentId) => {
    try {
      const response = await apiFetch(`/api/roles/user/${userId}/additional/${assignmentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchRoleAssignments(assigningRole.id);
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to remove assignment');
    }
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setAssigningRole(null);
    setRoleAssignments([]);
  };

  const handleEditTier = (tier) => {
    setEditingTier({ ...tier });
    setShowTierEditModal(true);
  };

  const handleSaveTier = async () => {
    if (!editingTier) return;

    try {
      const response = await apiFetch(`/api/roles/tiers/${editingTier.tier_level}`, {
        method: 'PUT',
        body: JSON.stringify({
          tier_name: editingTier.tier_name,
          description: editingTier.description,
          is_active: editingTier.is_active
        })
      });

      const data = await response.json();
      if (response.ok) {
        setShowTierEditModal(false);
        setEditingTier(null);
        fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update tier');
    }
  };

  const handleCloseTierEditModal = () => {
    setShowTierEditModal(false);
    setEditingTier(null);
  };

  const handleToggleTier = async (tier) => {
    // Core tiers cannot be toggled
    const coreTiers = [10, 20, 30];
    if (coreTiers.includes(tier.tier_level)) {
      setError('Core tiers (10, 20, 30) cannot be disabled');
      return;
    }

    setError(''); // Clear previous errors
    try {
      console.log('Toggling tier:', tier.tier_level);
      const url = `/api/roles/tiers/${tier.tier_level}`;
      console.log('Request URL:', url);

      const response = await apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !tier.is_active })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        fetchData();
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Toggle error:', err);
      setError('Failed to toggle tier');
    }
  };

  const isCoreTier = (tierLevel) => [10, 20, 30].includes(tierLevel);

  const handleEditRole = (role) => {
    setEditingRole({ ...role });
    setShowEditModal(true);
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;

    try {
      const response = await apiFetch(`/api/roles/additional/${editingRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          role_name: editingRole.role_name,
          description: editingRole.description,
          requires_tier_min: editingRole.requires_tier_min,
          is_active: editingRole.is_active
        })
      });

      const data = await response.json();
      if (response.ok) {
        setShowEditModal(false);
        setEditingRole(null);
        fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingRole(null);
  };

  const filteredRoles = selectedCategory === 'all'
    ? additionalRoles
    : additionalRoles.filter(r => r.category === selectedCategory);

  const getTierBadgeClass = (tier) => {
    if (tier >= 90) return 'tier-badge-executive';
    if (tier >= 70) return 'tier-badge-senior';
    if (tier >= 50) return 'tier-badge-mid';
    if (tier >= 30) return 'tier-badge-junior';
    return 'tier-badge-entry';
  };

  const getCategoryBadgeClass = (category) => {
    const classes = {
      hr: 'category-badge-hr',
      compliance: 'category-badge-compliance',
      safety: 'category-badge-safety',
      finance: 'category-badge-finance',
      operations: 'category-badge-operations',
      regulatory: 'category-badge-regulatory'
    };
    return classes[category] || 'category-badge-default';
  };

  if (loading) {
    return <div className="loading">Loading role configuration...</div>;
  }

  return (
    <div className="role-management-container">
      <div className="role-management-header">
        <h2>Role Management</h2>
        <p className="role-management-subtitle">
          Manage tier definitions and additional functional roles
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="role-tabs">
        <button
          className={`role-tab ${activeTab === 'tiers' ? 'active' : ''}`}
          onClick={() => setActiveTab('tiers')}
        >
          Tier Definitions
        </button>
        <button
          className={`role-tab ${activeTab === 'additional' ? 'active' : ''}`}
          onClick={() => setActiveTab('additional')}
        >
          Additional Roles
        </button>
      </div>

      {activeTab === 'tiers' && (
        <div className="tiers-section">
          <div className="section-header">
            <h3>Tier Hierarchy (10-100 Scale)</h3>
            <p className="section-description">
              Higher tier numbers indicate more senior positions with greater authority.
            </p>
          </div>

          <div className="tiers-table-container">
            <table className="tiers-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Can Manage Below</th>
                  <th>Leadership</th>
                  <th>Status</th>
                  {canEditRoles && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {tiers.map(tier => (
                  <tr key={tier.tier_level} className={`${tier.is_leadership ? 'leadership-row' : ''} ${tier.is_active === false ? 'inactive-tier-row' : ''}`}>
                    <td>
                      <span className={`tier-level-badge ${getTierBadgeClass(tier.tier_level)}`}>
                        {tier.tier_level}
                      </span>
                    </td>
                    <td className="tier-name-cell">{tier.tier_name}</td>
                    <td className="tier-description-cell">{tier.description}</td>
                    <td>
                      {tier.can_manage_tier_below ? (
                        <span className="manage-badge">{tier.can_manage_tier_below} and below</span>
                      ) : (
                        <span className="no-manage">-</span>
                      )}
                    </td>
                    <td>
                      {tier.is_leadership ? (
                        <span className="leadership-badge">Yes</span>
                      ) : (
                        <span className="not-leadership">No</span>
                      )}
                    </td>
                    <td>
                      {isCoreTier(tier.tier_level) ? (
                        <span className="core-tier-badge">Core (Required)</span>
                      ) : (
                        <button
                          className={`tier-toggle-btn ${tier.is_active !== false ? 'active' : 'inactive'}`}
                          onClick={() => handleToggleTier(tier)}
                        >
                          {tier.is_active !== false ? 'Active' : 'Disabled'}
                        </button>
                      )}
                    </td>
                    {canEditRoles && (
                      <td>
                        <button
                          className="edit-tier-btn"
                          onClick={() => handleEditTier(tier)}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'additional' && (
        <div className="additional-roles-section">
          <div className="section-header">
            <h3>Additional Functional Roles</h3>
            <p className="section-description">
              Roles that can be assigned to users in addition to their primary role.
            </p>
          </div>

          <div className="category-filter">
            <label htmlFor="category-select">Filter by Category:</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="additional-roles-grid">
            {filteredRoles.map(role => (
              <div key={role.id} className={`role-card ${!role.is_active ? 'inactive' : ''}`}>
                <div className="role-card-header">
                  <span className={`category-badge ${getCategoryBadgeClass(role.category)}`}>
                    {role.category.toUpperCase()}
                  </span>
                  {!role.is_active && (
                    <span className="inactive-badge">Inactive</span>
                  )}
                </div>

                <h4 className="role-card-title">{role.role_name}</h4>
                <code className="role-code">{role.role_code}</code>

                <p className="role-card-description">{role.description}</p>

                {role.requires_tier_min && (
                  <div className="role-card-meta">
                    <div className="meta-item">
                      <span className="meta-label">Min Tier:</span>
                      <span className={`tier-level-badge small ${getTierBadgeClass(role.requires_tier_min)}`}>
                        {role.requires_tier_min}
                      </span>
                    </div>
                  </div>
                )}

                <div className="role-card-actions">
                  <button
                    className="assign-role-btn"
                    onClick={() => handleAssignRole(role)}
                  >
                    Assign to Users
                  </button>
                  {canEditRoles && (
                    <button
                      className="edit-role-btn"
                      onClick={() => handleEditRole(role)}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filteredRoles.length === 0 && (
              <div className="no-roles-message">
                No roles found in this category.
              </div>
            )}
          </div>
        </div>
      )}

      {showEditModal && editingRole && (
        <div className="modal-overlay">
          <div className="modal-content role-edit-modal">
            <div className="modal-header">
              <h3>Edit Additional Role</h3>
              <button onClick={handleCloseModal} className="close-btn">&times;</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveRole(); }}>
              <div className="form-group">
                <label htmlFor="role_code">Role Code</label>
                <input
                  type="text"
                  id="role_code"
                  value={editingRole.role_code}
                  disabled
                  className="input-disabled"
                />
                <span className="field-hint">Role code cannot be changed</span>
              </div>

              <div className="form-group">
                <label htmlFor="role_name">Role Name</label>
                <input
                  type="text"
                  id="role_name"
                  value={editingRole.role_name}
                  onChange={(e) => setEditingRole({ ...editingRole, role_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={editingRole.description || ''}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="requires_tier_min">Minimum Tier Required</label>
                  <select
                    id="requires_tier_min"
                    value={editingRole.requires_tier_min || ''}
                    onChange={(e) => setEditingRole({
                      ...editingRole,
                      requires_tier_min: e.target.value ? parseInt(e.target.value) : null
                    })}
                  >
                    <option value="">No minimum</option>
                    <option value="100">100 - Chair/CEO</option>
                    <option value="90">90 - Director</option>
                    <option value="80">80 - Executive</option>
                    <option value="70">70 - Senior Manager</option>
                    <option value="60">60 - Manager</option>
                    <option value="50">50 - Team Lead</option>
                    <option value="40">40 - Senior Employee</option>
                    <option value="30">30 - Employee</option>
                    <option value="20">20 - Trainee</option>
                    <option value="10">10 - Contractor</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="is_active">Status</label>
                  <select
                    id="is_active"
                    value={editingRole.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditingRole({
                      ...editingRole,
                      is_active: e.target.value === 'active'
                    })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Permissions</label>
                <div className="permissions-display">
                  {editingRole.permissions_json && editingRole.permissions_json.length > 0 ? (
                    editingRole.permissions_json.map((perm, idx) => (
                      <span key={idx} className="permission-tag">{perm}</span>
                    ))
                  ) : (
                    <span className="no-permissions">No permissions defined</span>
                  )}
                </div>
                <span className="field-hint">Permissions are managed via database migrations</span>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button type="button" onClick={handleCloseModal} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && assigningRole && (
        <div className="modal-overlay">
          <div className="modal-content role-assign-modal">
            <div className="modal-header">
              <h3>Assign: {assigningRole.role_name}</h3>
              <button onClick={handleCloseAssignModal} className="close-btn">&times;</button>
            </div>

            <div className="assign-modal-body">
              <div className="assign-section">
                <label>Assign to Employee</label>
                <div className="assign-row">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="assign-select"
                  >
                    <option value="">Select an employee...</option>
                    {users
                      .filter(u => !roleAssignments.some(ra => ra.user_id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role_name}) - Tier {u.tier || 'Admin'}
                        </option>
                      ))}
                  </select>
                  <button
                    className="assign-btn"
                    onClick={handleAssignToUser}
                    disabled={!selectedUserId}
                  >
                    Assign
                  </button>
                </div>
              </div>

              <div className="current-assignments">
                <label>Currently Assigned ({roleAssignments.length})</label>
                {roleAssignments.length > 0 ? (
                  <div className="assignment-list">
                    {roleAssignments.map(assignment => (
                      <div key={assignment.id} className="assignment-item">
                        <span className="assignment-name">{assignment.user_name}</span>
                        <span className="assignment-date">
                          Since {new Date(assignment.assigned_at).toLocaleDateString()}
                        </span>
                        <button
                          className="remove-assignment-btn"
                          onClick={() => handleRemoveAssignment(assignment.user_id, assignment.id)}
                          title="Remove assignment"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-assignments">No users currently assigned to this role.</p>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button onClick={handleCloseAssignModal} className="cancel-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showTierEditModal && editingTier && (
        <div className="modal-overlay">
          <div className="modal-content tier-edit-modal">
            <div className="modal-header">
              <h3>Edit Tier {editingTier.tier_level}</h3>
              <button onClick={handleCloseTierEditModal} className="close-btn">&times;</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveTier(); }}>
              <div className="form-group">
                <label htmlFor="tier_level">Tier Level</label>
                <input
                  type="text"
                  id="tier_level"
                  value={editingTier.tier_level}
                  disabled
                  className="input-disabled"
                />
                <span className="field-hint">Tier level cannot be changed</span>
              </div>

              <div className="form-group">
                <label htmlFor="tier_name">Tier Name</label>
                <input
                  type="text"
                  id="tier_name"
                  value={editingTier.tier_name}
                  onChange={(e) => setEditingTier({ ...editingTier, tier_name: e.target.value })}
                  required
                  placeholder="e.g., Director, Manager, Team Lead"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tier_description">Description</label>
                <textarea
                  id="tier_description"
                  value={editingTier.description || ''}
                  onChange={(e) => setEditingTier({ ...editingTier, description: e.target.value })}
                  rows={3}
                  placeholder="Describe this tier's responsibilities and authority level"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tier_is_active">Status</label>
                {isCoreTier(editingTier.tier_level) ? (
                  <div className="core-tier-notice">
                    <span className="core-tier-badge">Core Tier</span>
                    <p>This is a core tier (10, 20, or 30) and cannot be disabled. These tiers are required for minimum system functionality.</p>
                  </div>
                ) : (
                  <select
                    id="tier_is_active"
                    value={editingTier.is_active !== false ? 'active' : 'inactive'}
                    onChange={(e) => setEditingTier({
                      ...editingTier,
                      is_active: e.target.value === 'active'
                    })}
                  >
                    <option value="active">Active - Available for use</option>
                    <option value="inactive">Disabled - Hidden from selection</option>
                  </select>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button type="button" onClick={handleCloseTierEditModal} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleManagement;
