/**
 * HeadOfficeOS - Probation Routes
 * Probation period and review management endpoints.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createProbation,
  getProbation,
  getMyProbation,
  extendProbation,
  recordOutcome,
  getReviews,
  getReview,
  completeReview,
  signReview,
  acknowledgeReview,
  getDashboard
} = require('../controllers/probationController');

// All routes require authentication
router.use(authenticate);

// ===========================================
// DASHBOARD (HR Tier 60+)
// ===========================================

router.get('/dashboard', getDashboard);

// ===========================================
// EMPLOYEE OWN PROBATION
// ===========================================

router.get('/my', getMyProbation);

// ===========================================
// PROBATION PERIOD ROUTES
// ===========================================

// Get probation for specific employee
router.get('/employee/:employeeId', getProbation);

// Create new probation period
router.post('/', createProbation);

// Extend probation
router.put('/:id/extend', extendProbation);

// Record outcome (pass/fail)
router.put('/:id/outcome', recordOutcome);

// Get reviews for probation
router.get('/:id/reviews', getReviews);

// ===========================================
// REVIEW ROUTES
// ===========================================

// Get single review details
router.get('/reviews/:reviewId', getReview);

// Complete review (fill in content)
router.put('/reviews/:reviewId', completeReview);

// Manager sign-off
router.put('/reviews/:reviewId/sign', signReview);

// Employee acknowledgment
router.put('/reviews/:reviewId/acknowledge', acknowledgeReview);

module.exports = router;
