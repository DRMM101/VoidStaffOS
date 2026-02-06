/**
 * HeadOfficeOS - Report Routes
 * API routes for quarterly performance reports.
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
const { getQuarterlyReport, getAvailableQuarters } = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get quarterly report for an employee
router.get('/quarterly/:employeeId/:quarter', getQuarterlyReport);

// Get available quarters for an employee
router.get('/quarters/:employeeId', getAvailableQuarters);

module.exports = router;
