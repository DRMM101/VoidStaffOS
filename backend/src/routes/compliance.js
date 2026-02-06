/**
 * HeadOfficeOS - Compliance Routes
 * RTW, DBS and compliance task management endpoints.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const complianceController = require('../controllers/complianceController');

// All routes require authentication
router.use(authenticate);

// ===========================================
// DASHBOARD & STATS
// ===========================================

router.get('/dashboard', complianceController.getComplianceDashboard);
router.get('/expiring', complianceController.getExpiringChecks);
router.get('/stats', complianceController.getComplianceStats);
router.get('/report', complianceController.getComplianceReportData);

// ===========================================
// SETTINGS
// ===========================================

router.get('/settings', complianceController.getComplianceSettings);
router.put('/settings', complianceController.updateComplianceSettings);

// ===========================================
// RTW CHECKS
// ===========================================

router.get('/rtw', complianceController.getRTWChecks);
router.get('/rtw/:id', complianceController.getRTWCheck);
router.post('/rtw', complianceController.createRTWCheck);
router.put('/rtw/:id', complianceController.updateRTWCheck);

// ===========================================
// DBS CHECKS
// ===========================================

router.get('/dbs', complianceController.getDBSChecks);
router.get('/dbs/:id', complianceController.getDBSCheck);
router.post('/dbs', complianceController.createDBSCheck);
router.put('/dbs/:id', complianceController.updateDBSCheck);
router.post('/dbs/:id/update-check', complianceController.recordDBSUpdateCheck);

// ===========================================
// COMPLIANCE TASKS
// ===========================================

router.get('/tasks', complianceController.getComplianceTasks);
router.post('/tasks', complianceController.createComplianceTask);
router.put('/tasks/:id', complianceController.updateComplianceTask);

module.exports = router;
