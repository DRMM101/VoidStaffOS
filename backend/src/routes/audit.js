/**
 * HeadOfficeOS - Audit Trail Routes
 * API routes for viewing the comprehensive audit trail.
 *
 * SECURITY NOTICE:
 * - All routes are READ-ONLY (GET only)
 * - Only System Administrators (Admin role) can access
 * - NO POST, PUT, PATCH, or DELETE operations allowed
 * - Audit logging happens internally via controller functions
 * - Cannot be triggered directly by user API requests
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 25/01/2026
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
const { authenticate, authorize, requireAuditAccess } = require('../middleware/auth');
const {
  getAuditTrail,
  getResourceHistory,
  getUserActivity,
  getAuditStats,
  getFilterOptions
} = require('../controllers/auditController');

/**
 * @route GET /api/audit-trail
 * @desc Get audit trail entries with filtering
 * @access Admin ONLY + Re-authentication required
 * @query resource_type - Filter by resource type
 * @query resource_id - Filter by resource ID
 * @query user_id - Filter by user who made changes
 * @query action - Filter by action type (CREATE, UPDATE, DELETE)
 * @query start_date - Filter from date
 * @query end_date - Filter to date
 * @query limit - Number of entries (default 50, max 200)
 * @query offset - Pagination offset
 */
router.get('/', authenticate, authorize('Admin'), requireAuditAccess, getAuditTrail);

/**
 * @route GET /api/audit-trail/stats
 * @desc Get audit trail statistics and summary
 * @access Admin ONLY + Re-authentication required
 */
router.get('/stats', authenticate, authorize('Admin'), requireAuditAccess, getAuditStats);

/**
 * @route GET /api/audit-trail/filters
 * @desc Get available filter options for the UI
 * @access Admin ONLY + Re-authentication required
 */
router.get('/filters', authenticate, authorize('Admin'), requireAuditAccess, getFilterOptions);

/**
 * @route GET /api/audit-trail/resource/:resource_type/:resource_id
 * @desc Get audit history for a specific resource
 * @access Admin ONLY + Re-authentication required
 */
router.get('/resource/:resource_type/:resource_id', authenticate, authorize('Admin'), requireAuditAccess, getResourceHistory);

/**
 * @route GET /api/audit-trail/user/:user_id
 * @desc Get recent activity by a specific user
 * @access Admin ONLY + Re-authentication required
 */
router.get('/user/:user_id', authenticate, authorize('Admin'), requireAuditAccess, getUserActivity);

// ===========================================
// SECURITY: NO modification routes allowed
// The audit trail is immutable and read-only
// ===========================================
// NO POST routes - logging happens internally
// NO PUT routes - records cannot be modified
// NO PATCH routes - records cannot be modified
// NO DELETE routes - records cannot be deleted

module.exports = router;
