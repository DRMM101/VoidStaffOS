const express = require('express');
const router = express.Router();
const { getQuarterlyReport, getAvailableQuarters } = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get quarterly report for an employee
router.get('/quarterly/:employeeId/:quarter', getQuarterlyReport);

// Get available quarters for an employee
router.get('/quarters/:employeeId', getAvailableQuarters);

module.exports = router;
