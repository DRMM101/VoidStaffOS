/**
 * VoidStaffOS - Development Routes
 * API routes for development utilities (disabled in production).
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
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
const { generateTestSnapshots, clearTestSnapshots } = require('../controllers/devController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticate);

// Generate test snapshots for quarterly reports
router.post('/generate-test-snapshots/:employeeId/:quarter', authorize('Admin'), generateTestSnapshots);

// Clear test snapshots
router.delete('/clear-test-snapshots/:employeeId/:quarter', authorize('Admin'), clearTestSnapshots);

module.exports = router;
