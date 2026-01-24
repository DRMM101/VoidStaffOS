const express = require('express');
const router = express.Router();
const { getUsers, getUserById, createUser, updateUser, getRoles, getEmployeesByManager } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all roles (for dropdowns)
router.get('/roles', getRoles);

// Get employees by manager (for review dropdown)
router.get('/my-team', authorize('Admin', 'Manager'), getEmployeesByManager);

// Get all users - any authenticated user can view
router.get('/', getUsers);

// Get single user - any authenticated user can view
router.get('/:id', getUserById);

// Create user - admin only
router.post('/', authorize('Admin'), createUser);

// Update user - admin only
router.put('/:id', authorize('Admin'), updateUser);

module.exports = router;
