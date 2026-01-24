const express = require('express');
const router = express.Router();
const { getReviews, getReviewById, createReview, updateReview } = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all reviews (filtered by user role)
router.get('/', getReviews);

// Get single review
router.get('/:id', getReviewById);

// Create review - Admin and Manager only
router.post('/', authorize('Admin', 'Manager'), createReview);

// Update review - Admin and Manager only
router.put('/:id', authorize('Admin', 'Manager'), updateReview);

module.exports = router;
