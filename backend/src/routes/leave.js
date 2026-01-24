/**
 * @fileoverview Leave Management Routes
 * @module routes/leave
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateLeaveRequest, validateIdParam } = require('../middleware/validation');
const {
  createLeaveRequest,
  getMyLeaveRequests,
  getPendingLeaveRequests,
  getTeamLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveBalance,
  getPendingLeaveCount
} = require('../controllers/leaveController');

// All routes require authentication
router.use(authenticate);

// === Employee Routes ===

// POST /api/leave/request - Submit new leave request
router.post('/request', validateLeaveRequest, createLeaveRequest);

// GET /api/leave/my-requests - Get current user's leave requests
router.get('/my-requests', getMyLeaveRequests);

// GET /api/leave/my-balance - Get current user's leave balance
router.get('/my-balance', getLeaveBalance);

// PUT /api/leave/:id/cancel - Cancel own pending request
router.put('/:id/cancel', validateIdParam, cancelLeaveRequest);

// === Manager/Admin Routes ===

// GET /api/leave/pending - Get pending requests for approval
router.get('/pending', authorize('Admin', 'Manager'), getPendingLeaveRequests);

// GET /api/leave/pending-count - Get count of pending requests (for badge)
router.get('/pending-count', getPendingLeaveCount);

// GET /api/leave/team - Get all team leave requests
router.get('/team', authorize('Admin', 'Manager'), getTeamLeaveRequests);

// PUT /api/leave/:id/approve - Approve leave request
router.put('/:id/approve', validateIdParam, authorize('Admin', 'Manager'), approveLeaveRequest);

// PUT /api/leave/:id/reject - Reject leave request
router.put('/:id/reject', validateIdParam, authorize('Admin', 'Manager'), rejectLeaveRequest);

// GET /api/leave/balance/:id - Get specific employee's balance
router.get('/balance/:id', validateIdParam, getLeaveBalance);

module.exports = router;
