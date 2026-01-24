const express = require('express');
const router = express.Router();
const { getReviews, getReviewById, getMyLatestReview, getMyReflectionStatus, createReview, createSelfReflection, commitSelfReflection, updateReview, commitReview, uncommitReview } = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all reviews (filtered by user role)
router.get('/', getReviews);

// Get latest review for current user (for dashboard)
router.get('/my-latest', getMyLatestReview);

// Get self-reflection status for current week (for dashboard with blind review support)
router.get('/my-reflection-status', getMyReflectionStatus);

// Get single review
router.get('/:id', getReviewById);

// Create self-reflection - Any authenticated user can create their own
router.post('/self-reflection', createSelfReflection);

// Commit self-reflection - Any authenticated user can commit their own
router.post('/self-reflection/:id/commit', commitSelfReflection);

// Create review - Admin and Manager only
router.post('/', authorize('Admin', 'Manager'), createReview);

// Update review - Admin and Manager only
router.put('/:id', authorize('Admin', 'Manager'), updateReview);

// Commit review - Admin and Manager (only original reviewer)
router.post('/:id/commit', authorize('Admin', 'Manager'), commitReview);

// Uncommit review - Admin only
router.post('/:id/uncommit', authorize('Admin'), uncommitReview);

module.exports = router;
