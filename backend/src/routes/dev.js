const express = require('express');
const router = express.Router();
const { generateTestSnapshots, clearTestSnapshots } = require('../controllers/devController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticate);

// Generate test snapshots for quarterly reports
router.post('/generate-test-snapshots/:employeeId/:quarter', authorize('Admin'), generateTestSnapshots);

// Clear test snapshots
router.delete('/clear-test-snapshots/:employeeId/:quarter', authorize('Admin'), clearTestSnapshots);

module.exports = router;
