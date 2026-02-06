/**
 * HeadOfficeOS - Role Controller
 * Handles tier definitions and additional role management.
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

const pool = require('../config/database');

/**
 * Get all tier definitions
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Object} Array of tier definitions
 * @authorization Any authenticated user
 */
async function getTierDefinitions(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT tier_level, tier_name, description, can_manage_tier_below, is_leadership, is_active
       FROM tier_definitions
       WHERE tenant_id = $1
       ORDER BY tier_level DESC`,
      [tenantId]
    );

    res.json({ tiers: result.rows });
  } catch (error) {
    console.error('Error fetching tier definitions:', error);
    res.status(500).json({ error: 'Failed to fetch tier definitions' });
  }
}

/**
 * Update a tier definition
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.tierLevel - Tier level to update
 * @param {Object} req.body - Fields to update
 * @param {Object} res - Express response
 * @returns {Object} Updated tier
 * @authorization Tier 100 (Admin/CEO only)
 */
async function updateTierDefinition(req, res) {
  try {
    const { tierLevel } = req.params;
    const { tier_name, description, is_active } = req.body;
    const tenantId = req.session?.tenantId || 1;
    const tierLevelInt = parseInt(tierLevel);

    // Core tiers (10, 20, 30) cannot be disabled
    const coreTiers = [10, 20, 30];
    if (coreTiers.includes(tierLevelInt) && is_active === false) {
      return res.status(400).json({
        error: 'Core tiers (10, 20, 30) cannot be disabled. These are required for minimum system functionality.'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (tier_name !== undefined) {
      updates.push(`tier_name = $${paramIndex++}`);
      params.push(tier_name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(tierLevelInt, tenantId);

    const result = await pool.query(
      `UPDATE tier_definitions
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE tier_level = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING tier_level, tier_name, description, can_manage_tier_below, is_leadership, is_active`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tier definition not found' });
    }

    res.json({
      message: 'Tier definition updated',
      tier: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating tier definition:', error);
    res.status(500).json({ error: 'Failed to update tier definition' });
  }
}

/**
 * Get all additional roles
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Object} Array of additional roles
 * @authorization Any authenticated user
 */
async function getAdditionalRoles(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT id, role_code, role_name, description, category, permissions_json,
              requires_tier_min, is_active, created_at, updated_at
       FROM additional_roles
       WHERE tenant_id = $1
       ORDER BY category, role_name`,
      [tenantId]
    );

    res.json({ roles: result.rows });
  } catch (error) {
    console.error('Error fetching additional roles:', error);
    res.status(500).json({ error: 'Failed to fetch additional roles' });
  }
}

/**
 * Get additional roles by category
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.category - Category filter
 * @param {Object} res - Express response
 * @returns {Object} Array of additional roles in category
 * @authorization Any authenticated user
 */
async function getAdditionalRolesByCategory(req, res) {
  try {
    const { category } = req.params;
    const tenantId = req.session?.tenantId || 1;

    const validCategories = ['hr', 'compliance', 'safety', 'finance', 'operations', 'regulatory'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const result = await pool.query(
      `SELECT id, role_code, role_name, description, category, permissions_json,
              requires_tier_min, is_active, created_at, updated_at
       FROM additional_roles
       WHERE tenant_id = $1 AND category = $2
       ORDER BY role_name`,
      [tenantId, category]
    );

    res.json({ roles: result.rows });
  } catch (error) {
    console.error('Error fetching additional roles by category:', error);
    res.status(500).json({ error: 'Failed to fetch additional roles' });
  }
}

/**
 * Get user's assigned additional roles
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.userId - User ID
 * @param {Object} res - Express response
 * @returns {Object} Array of user's additional roles
 * @authorization Any authenticated user (for own roles) or Manager+ for others
 */
async function getUserAdditionalRoles(req, res) {
  try {
    const { userId } = req.params;
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT uar.id, uar.user_id, uar.additional_role_id, uar.assigned_by,
              uar.assigned_at, uar.expires_at, uar.notes,
              ar.role_code, ar.role_name, ar.description, ar.category,
              ar.permissions_json, ar.requires_tier_min, ar.is_active,
              u.full_name as assigned_by_name
       FROM user_additional_roles uar
       JOIN additional_roles ar ON uar.additional_role_id = ar.id
       LEFT JOIN users u ON uar.assigned_by = u.id
       WHERE uar.user_id = $1 AND uar.tenant_id = $2
         AND ar.is_active = TRUE
         AND (uar.expires_at IS NULL OR uar.expires_at > CURRENT_TIMESTAMP)
       ORDER BY ar.category, ar.role_name`,
      [userId, tenantId]
    );

    res.json({ additional_roles: result.rows });
  } catch (error) {
    console.error('Error fetching user additional roles:', error);
    res.status(500).json({ error: 'Failed to fetch user additional roles' });
  }
}

/**
 * Assign an additional role to a user
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.userId - Target user ID
 * @param {Object} req.body.additional_role_id - Role to assign
 * @param {Object} req.body.expires_at - Optional expiry date
 * @param {Object} req.body.notes - Optional notes
 * @param {Object} res - Express response
 * @returns {Object} Created assignment
 * @authorization Tier 60+ (Manager or higher)
 */
async function assignAdditionalRole(req, res) {
  try {
    const { userId } = req.params;
    const { additional_role_id, expires_at, notes } = req.body;
    const tenantId = req.session?.tenantId || 1;
    const assignedBy = req.session?.userId;

    if (!additional_role_id) {
      return res.status(400).json({ error: 'additional_role_id is required' });
    }

    // Verify the role exists and is active
    const roleCheck = await pool.query(
      `SELECT id, role_name, requires_tier_min FROM additional_roles
       WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE`,
      [additional_role_id, tenantId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Additional role not found or inactive' });
    }

    const role = roleCheck.rows[0];

    // Check target user's tier meets requirement
    const userCheck = await pool.query(
      'SELECT id, tier, full_name FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userCheck.rows[0];

    if (role.requires_tier_min && (targetUser.tier === null || targetUser.tier < role.requires_tier_min)) {
      return res.status(400).json({
        error: `User tier (${targetUser.tier || 'none'}) does not meet minimum requirement (${role.requires_tier_min}) for this role`
      });
    }

    // Check if assignment already exists
    const existingCheck = await pool.query(
      `SELECT id FROM user_additional_roles
       WHERE user_id = $1 AND additional_role_id = $2`,
      [userId, additional_role_id]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ error: 'User already has this additional role assigned' });
    }

    // Create the assignment
    const result = await pool.query(
      `INSERT INTO user_additional_roles
       (user_id, additional_role_id, assigned_by, expires_at, notes, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, additional_role_id, assigned_by, assigned_at, expires_at, notes`,
      [userId, additional_role_id, assignedBy, expires_at || null, notes || null, tenantId]
    );

    res.status(201).json({
      message: `${role.role_name} assigned to ${targetUser.full_name}`,
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error assigning additional role:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'User already has this additional role assigned' });
    }
    res.status(500).json({ error: 'Failed to assign additional role' });
  }
}

/**
 * Remove an additional role from a user
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.userId - Target user ID
 * @param {Object} req.params.roleId - Assignment ID to remove
 * @param {Object} res - Express response
 * @returns {Object} Success message
 * @authorization Tier 60+ (Manager or higher)
 */
async function removeAdditionalRole(req, res) {
  try {
    const { userId, roleId } = req.params;
    const tenantId = req.session?.tenantId || 1;

    // Get role info for confirmation message
    const roleInfo = await pool.query(
      `SELECT uar.id, ar.role_name, u.full_name
       FROM user_additional_roles uar
       JOIN additional_roles ar ON uar.additional_role_id = ar.id
       JOIN users u ON uar.user_id = u.id
       WHERE uar.id = $1 AND uar.user_id = $2 AND uar.tenant_id = $3`,
      [roleId, userId, tenantId]
    );

    if (roleInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    const info = roleInfo.rows[0];

    // Delete the assignment
    await pool.query(
      'DELETE FROM user_additional_roles WHERE id = $1 AND tenant_id = $2',
      [roleId, tenantId]
    );

    res.json({
      message: `${info.role_name} removed from ${info.full_name}`,
      removed: true
    });
  } catch (error) {
    console.error('Error removing additional role:', error);
    res.status(500).json({ error: 'Failed to remove additional role' });
  }
}

/**
 * Update an additional role definition
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.id - Role definition ID
 * @param {Object} req.body - Fields to update
 * @param {Object} res - Express response
 * @returns {Object} Updated role
 * @authorization Tier 100 (Admin/CEO only)
 */
async function updateAdditionalRole(req, res) {
  try {
    const { id } = req.params;
    const { role_name, description, requires_tier_min, is_active } = req.body;
    const tenantId = req.session?.tenantId || 1;

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (role_name !== undefined) {
      updates.push(`role_name = $${paramIndex++}`);
      params.push(role_name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (requires_tier_min !== undefined) {
      updates.push(`requires_tier_min = $${paramIndex++}`);
      params.push(requires_tier_min);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id, tenantId);

    const result = await pool.query(
      `UPDATE additional_roles
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING id, role_code, role_name, description, category, permissions_json,
                 requires_tier_min, is_active, created_at, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Additional role not found' });
    }

    res.json({
      message: 'Additional role updated',
      role: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating additional role:', error);
    res.status(500).json({ error: 'Failed to update additional role' });
  }
}

/**
 * Get combined permissions for a user
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.userId - User ID
 * @param {Object} res - Express response
 * @returns {Object} Array of permissions
 * @authorization Same user or Tier 60+
 */
async function getUserPermissions(req, res) {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT get_user_permissions($1) as permissions',
      [userId]
    );

    res.json({ permissions: result.rows[0]?.permissions || [] });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
}

/**
 * Check if user has a specific permission
 *
 * @async
 * @param {Object} req - Express request
 * @param {Object} req.params.userId - User ID
 * @param {Object} req.params.permission - Permission to check
 * @param {Object} res - Express response
 * @returns {Object} Boolean result
 * @authorization Same user or Tier 60+
 */
async function checkUserPermission(req, res) {
  try {
    const { userId, permission } = req.params;

    const result = await pool.query(
      'SELECT user_has_permission($1, $2) as has_permission',
      [userId, permission]
    );

    res.json({
      permission,
      has_permission: result.rows[0]?.has_permission || false
    });
  } catch (error) {
    console.error('Error checking user permission:', error);
    res.status(500).json({ error: 'Failed to check user permission' });
  }
}

module.exports = {
  getTierDefinitions,
  updateTierDefinition,
  getAdditionalRoles,
  getAdditionalRolesByCategory,
  getUserAdditionalRoles,
  assignAdditionalRole,
  removeAdditionalRole,
  updateAdditionalRole,
  getUserPermissions,
  checkUserPermission
};
