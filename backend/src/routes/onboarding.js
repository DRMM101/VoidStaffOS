/**
 * @fileoverview Onboarding Routes
 *
 * Routes for managing the candidate onboarding pipeline:
 * - Candidate management (Admin)
 * - References and background checks (Admin)
 * - Promotion with stage gates (Admin)
 * - Self-service tasks and policies (Pre-colleagues)
 *
 * @module routes/onboarding
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  createCandidate,
  getCandidates,
  getCandidate,
  updateCandidate,
  addReference,
  updateReference,
  addBackgroundCheck,
  updateBackgroundCheck,
  getPromotionStatus,
  promoteCandidate,
  getMyTasks,
  completeTask,
  getPolicies,
  acknowledgePolicy,
  addDayOneItem
} = require('../controllers/onboardingController');

// All routes require authentication
router.use(authenticate);

// ============================================
// CANDIDATE MANAGEMENT (Admin only)
// ============================================

// POST /api/onboarding/candidates - Create a new candidate
router.post('/candidates', authorize('Admin'), createCandidate);

// GET /api/onboarding/candidates - List all candidates
router.get('/candidates', authorize('Admin'), getCandidates);

// GET /api/onboarding/candidates/:id - Get candidate with all details
router.get('/candidates/:id', validateIdParam, getCandidate);

// PUT /api/onboarding/candidates/:id - Update candidate
router.put('/candidates/:id', validateIdParam, authorize('Admin'), updateCandidate);

// ============================================
// REFERENCES (Admin only)
// ============================================

// POST /api/onboarding/candidates/:id/references - Add reference
router.post('/candidates/:id/references', validateIdParam, authorize('Admin'), addReference);

// PUT /api/onboarding/references/:id - Update reference status
router.put('/references/:id', validateIdParam, authorize('Admin'), updateReference);

// ============================================
// BACKGROUND CHECKS (Admin only)
// ============================================

// POST /api/onboarding/candidates/:id/checks - Add background check
router.post('/candidates/:id/checks', validateIdParam, authorize('Admin'), addBackgroundCheck);

// PUT /api/onboarding/checks/:id - Update check status
router.put('/checks/:id', validateIdParam, authorize('Admin'), updateBackgroundCheck);

// ============================================
// PROMOTION (Admin only)
// ============================================

// GET /api/onboarding/candidates/:id/promotion-status - Get promotion requirements
router.get('/candidates/:id/promotion-status', validateIdParam, authorize('Admin'), getPromotionStatus);

// POST /api/onboarding/candidates/:id/promote - Promote to next stage
router.post('/candidates/:id/promote', validateIdParam, authorize('Admin'), promoteCandidate);

// ============================================
// DAY ONE PLAN (Admin only)
// ============================================

// POST /api/onboarding/candidates/:id/day-one - Add day one item
router.post('/candidates/:id/day-one', validateIdParam, authorize('Admin'), addDayOneItem);

// ============================================
// SELF-SERVICE (Pre-colleagues)
// ============================================

// GET /api/onboarding/my-tasks - Get current user's onboarding tasks
router.get('/my-tasks', getMyTasks);

// PUT /api/onboarding/tasks/:id/complete - Mark task as complete
router.put('/tasks/:id/complete', validateIdParam, completeTask);

// ============================================
// POLICIES (All authenticated users)
// ============================================

// GET /api/onboarding/policies - List policies
router.get('/policies', getPolicies);

// POST /api/onboarding/policies/:id/acknowledge - Acknowledge policy
router.post('/policies/:id/acknowledge', validateIdParam, acknowledgePolicy);

module.exports = router;
