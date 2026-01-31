/**
 * VoidStaffOS - Sick & Statutory Leave Routes
 * API routes for sick leave, statutory leave, and RTW interviews.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 30/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: LeaveOS
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateIdParam, validateSickLeave, validateStatutoryLeave } = require('../middleware/validation');
const {
  // Sick leave
  reportSickLeave,
  updateSickLeave,
  uploadFitNote,

  // Statutory leave
  requestStatutoryLeave,
  getAbsenceCategories,

  // RTW interviews
  getPendingRTWInterviews,
  createRTWInterview,
  completeRTWInterview,
  getRTWInterview,
  getPendingFollowUps,

  // SSP
  getSSPStatus
} = require('../controllers/sickLeaveController');

// All routes require authentication
router.use(authenticate);

// =====================================================
// Absence Categories
// =====================================================

// GET /api/sick-leave/categories - Get available absence categories
router.get('/categories', getAbsenceCategories);

// =====================================================
// Sick Leave Routes (Employee Self-Service)
// =====================================================

// POST /api/sick-leave/report - Report sick (employee reports they are sick)
router.post('/report', validateSickLeave, reportSickLeave);

// PUT /api/sick-leave/:id - Update sick leave (extend or close)
router.put('/:id', validateIdParam, updateSickLeave);

// POST /api/sick-leave/:id/fit-note - Upload fit note for sick leave
router.post('/:id/fit-note', validateIdParam, uploadFitNote);

// =====================================================
// Statutory Leave Routes
// =====================================================

// POST /api/sick-leave/statutory - Request statutory leave
router.post('/statutory', validateStatutoryLeave, requestStatutoryLeave);

// =====================================================
// Return to Work Interview Routes
// =====================================================

// GET /api/sick-leave/rtw/pending - Get pending RTW interviews (manager/admin)
router.get('/rtw/pending', authorize('Admin', 'Manager'), getPendingRTWInterviews);

// GET /api/sick-leave/rtw/follow-ups - Get pending follow-up interviews (manager/admin)
router.get('/rtw/follow-ups', authorize('Admin', 'Manager'), getPendingFollowUps);

// POST /api/sick-leave/rtw - Create RTW interview
router.post('/rtw', authorize('Admin', 'Manager'), createRTWInterview);

// GET /api/sick-leave/rtw/:leaveRequestId - Get RTW for a leave request
router.get('/rtw/:leaveRequestId', validateIdParam, getRTWInterview);

// PUT /api/sick-leave/rtw/:id/complete - Complete RTW interview
router.put('/rtw/:id/complete', validateIdParam, authorize('Admin', 'Manager'), completeRTWInterview);

// =====================================================
// SSP Status Routes
// =====================================================

// GET /api/sick-leave/ssp/:employeeId - Get employee's SSP status
router.get('/ssp/:employeeId', validateIdParam, authorize('Admin', 'Manager'), getSSPStatus);

module.exports = router;
