/**
 * HeadOfficeOS - Roles Routes
 * API routes for tier definitions and additional role management.
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

const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/roleController');
const { authenticate } = require('../middleware/auth');
const { requireTier, requireAuth } = require('../middleware/sessionAuth');

// All routes require authentication
router.use(authenticate);

// ============================================
// Tier Definition Routes
// ============================================

/**
 * GET /api/roles/tiers
 * Get all tier definitions for the tenant
 * @authorization Any authenticated user
 */
router.get('/tiers', getTierDefinitions);

/**
 * PUT /api/roles/tiers/:tierLevel
 * Update a tier definition (name, description, active status)
 * @authorization Tier 100 (Chair/CEO only)
 */
router.put('/tiers/:tierLevel', requireTier(100), updateTierDefinition);

// ============================================
// Additional Role Definition Routes
// ============================================

/**
 * GET /api/roles/additional
 * Get all additional role definitions
 * @authorization Any authenticated user
 */
router.get('/additional', getAdditionalRoles);

/**
 * GET /api/roles/additional/category/:category
 * Get additional roles filtered by category
 * @authorization Any authenticated user
 */
router.get('/additional/category/:category', getAdditionalRolesByCategory);

/**
 * PUT /api/roles/additional/:id
 * Update an additional role definition
 * @authorization Tier 100 (Chair/CEO only)
 */
router.put('/additional/:id', requireTier(100), updateAdditionalRole);

// ============================================
// User Additional Role Assignment Routes
// ============================================

/**
 * GET /api/roles/user/:userId/additional
 * Get a user's assigned additional roles
 * @authorization Any authenticated user
 */
router.get('/user/:userId/additional', getUserAdditionalRoles);

/**
 * POST /api/roles/user/:userId/additional
 * Assign an additional role to a user
 * @authorization Tier 60+ (Manager or higher)
 */
router.post('/user/:userId/additional', requireTier(60), assignAdditionalRole);

/**
 * DELETE /api/roles/user/:userId/additional/:roleId
 * Remove an additional role from a user
 * @authorization Tier 60+ (Manager or higher)
 */
router.delete('/user/:userId/additional/:roleId', requireTier(60), removeAdditionalRole);

// ============================================
// Permission Check Routes
// ============================================

/**
 * GET /api/roles/user/:userId/permissions
 * Get combined permissions for a user
 * @authorization Same user or Tier 60+
 */
router.get('/user/:userId/permissions', getUserPermissions);

/**
 * GET /api/roles/user/:userId/permissions/:permission
 * Check if user has a specific permission
 * @authorization Same user or Tier 60+
 */
router.get('/user/:userId/permissions/:permission', checkUserPermission);

module.exports = router;
