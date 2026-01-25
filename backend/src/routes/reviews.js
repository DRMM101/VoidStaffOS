/**
 * VoidStaffOS - Review Management Routes
 * API routes for performance reviews with blind review support.
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
const {
  getReviews,
  getReviewById,
  getMyLatestReview,
  getMyReflectionStatus,
  createReview,
  createSelfReflection,
  commitSelfReflection,
  updateReview,
  commitReview,
  uncommitReview
} = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateReview, validateIdParam } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// === Read Operations ===

// GET /api/reviews - Get all reviews (filtered by role)
router.get('/', getReviews);

// GET /api/reviews/my-latest - Get current user's most recent review
router.get('/my-latest', getMyLatestReview);

// GET /api/reviews/my-reflection-status - Get blind review state for current week
router.get('/my-reflection-status', getMyReflectionStatus);

// GET /api/reviews/:id - Get single review by ID
router.get('/:id', validateIdParam, getReviewById);

// === Self-Reflection (Any authenticated user) ===

// POST /api/reviews/self-reflection - Create self-reflection
router.post('/self-reflection', createSelfReflection);

// POST /api/reviews/self-reflection/:id/commit - Commit self-reflection
router.post('/self-reflection/:id/commit', validateIdParam, commitSelfReflection);

// === Manager Reviews (Admin/Manager only) ===

// POST /api/reviews - Create review for team member
router.post('/', authorize('Admin', 'Manager'), validateReview, createReview);

// PUT /api/reviews/:id - Update uncommitted review
router.put('/:id', validateIdParam, authorize('Admin', 'Manager'), updateReview);

// POST /api/reviews/:id/commit - Commit review (locks it)
router.post('/:id/commit', validateIdParam, authorize('Admin', 'Manager'), commitReview);

// === Admin Only ===

// POST /api/reviews/:id/uncommit - Unlock committed review
router.post('/:id/uncommit', validateIdParam, authorize('Admin'), uncommitReview);

module.exports = router;
