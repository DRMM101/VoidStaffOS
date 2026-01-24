/**
 * @fileoverview 360 Feedback Routes
 * @module routes/feedback
 */

const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getFeedbackForEmployee,
  getPendingFeedback,
  getComposite,
  startFeedbackCycle,
  getCycleStatus,
  getActiveCycles,
  signComposite,
  closeCycle
} = require('../controllers/feedbackController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/feedback/pending - Get pending feedback requests for current user
router.get('/pending', getPendingFeedback);

// GET /api/feedback/cycles - Get all active feedback cycles
router.get('/cycles', getActiveCycles);

// POST /api/feedback/quarterly - Submit feedback
router.post('/quarterly', submitFeedback);

// GET /api/feedback/quarterly/:employeeId/:quarter - Get all feedback for an employee
router.get('/quarterly/:employeeId/:quarter', getFeedbackForEmployee);

// GET /api/feedback/composite/:employeeId/:quarter - Get composite KPIs
router.get('/composite/:employeeId/:quarter', getComposite);

// POST /api/feedback/composite/:employeeId/:quarter/sign - Sign off on composite
router.post('/composite/:employeeId/:quarter/sign', signComposite);

// Admin only routes
// POST /api/feedback/request-cycle/:quarter - Start a feedback cycle
router.post('/request-cycle/:quarter', authorize('Admin'), startFeedbackCycle);

// GET /api/feedback/cycle-status/:quarter - Get cycle completion status
router.get('/cycle-status/:quarter', authorize('Admin'), getCycleStatus);

// POST /api/feedback/close-cycle/:quarter - Close a feedback cycle
router.post('/close-cycle/:quarter', authorize('Admin'), closeCycle);

module.exports = router;
