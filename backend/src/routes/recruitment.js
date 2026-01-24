/**
 * @fileoverview Recruitment Routes
 *
 * Routes for the recruitment request workflow.
 *
 * @module routes/recruitment
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  createRequest,
  getRequests,
  getRequest,
  updateRequest,
  submitRequest,
  approveRequest,
  rejectRequest,
  getMyApprovals,
  getApprovedRequests
} = require('../controllers/recruitmentController');

// All routes require authentication
router.use(authenticate);

// POST /api/recruitment/requests - Create new recruitment request
router.post('/requests', createRequest);

// GET /api/recruitment/requests - List requests (filtered by role)
router.get('/requests', getRequests);

// GET /api/recruitment/requests/approved - Get approved requests (for candidate creation)
router.get('/requests/approved', getApprovedRequests);

// GET /api/recruitment/my-approvals - Get requests awaiting user's approval
router.get('/my-approvals', getMyApprovals);

// GET /api/recruitment/requests/:id - Get single request
router.get('/requests/:id', validateIdParam, getRequest);

// PUT /api/recruitment/requests/:id - Update draft request
router.put('/requests/:id', validateIdParam, updateRequest);

// POST /api/recruitment/requests/:id/submit - Submit for approval
router.post('/requests/:id/submit', validateIdParam, submitRequest);

// POST /api/recruitment/requests/:id/approve - Approve request
router.post('/requests/:id/approve', validateIdParam, approveRequest);

// POST /api/recruitment/requests/:id/reject - Reject request
router.post('/requests/:id/reject', validateIdParam, rejectRequest);

module.exports = router;
