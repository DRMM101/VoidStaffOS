/**
 * VoidStaffOS - User Management Routes
 * API routes for user and employee management.
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
  getUsers,
  getUserById,
  getUserProfile,
  createUser,
  updateUser,
  getRoles,
  getEmployeesByManager,
  getUsersWithReviewStatus,
  assignManager,
  adoptEmployee,
  transferEmployee,
  getTransferTargets,
  getManagers,
  getOrphanedEmployees,
  getTeamSummary,
  getOrgChart
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateUser, validateIdParam } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// GET /api/users/roles - Get all roles (for dropdowns)
router.get('/roles', getRoles);

// GET /api/users/managers - Get list of managers (for assignment dropdown)
router.get('/managers', getManagers);

// GET /api/users/orphaned - Get employees without managers
router.get('/orphaned', authorize('Admin', 'Manager'), getOrphanedEmployees);

// GET /api/users/my-team - Get current user's direct reports
router.get('/my-team', authorize('Admin', 'Manager'), getEmployeesByManager);

// GET /api/users/team-summary - Get team performance summary with KPIs
router.get('/team-summary', authorize('Admin', 'Manager'), getTeamSummary);

// GET /api/users/with-review-status - Get users with review status indicators
router.get('/with-review-status', getUsersWithReviewStatus);

// GET /api/users/org-chart - Get organisational chart tree (Admin/Manager only)
router.get('/org-chart', authorize('Admin', 'Manager'), getOrgChart);

// GET /api/users - Get all users (filtered by role)
router.get('/', getUsers);

// GET /api/users/:id/profile - Get detailed user profile
router.get('/:id/profile', validateIdParam, getUserProfile);

// PUT /api/users/:id/assign-manager - Assign manager to employee
router.put('/:id/assign-manager', validateIdParam, authorize('Admin', 'Manager'), assignManager);

// POST /api/users/adopt-employee/:employeeId - Manager adopts orphaned employee
router.post('/adopt-employee/:employeeId', validateIdParam, authorize('Admin', 'Manager'), adoptEmployee);

// POST /api/users/:id/transfer - Transfer employee to new manager
router.post('/:id/transfer', validateIdParam, authorize('Admin', 'Manager'), transferEmployee);

// GET /api/users/:id/transfer-targets - Get eligible managers for transfer
router.get('/:id/transfer-targets', validateIdParam, authorize('Admin', 'Manager'), getTransferTargets);

// GET /api/users/:id - Get single user
router.get('/:id', validateIdParam, getUserById);

// POST /api/users - Create new user (Admin only)
router.post('/', authorize('Admin'), validateUser, createUser);

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', validateIdParam, authorize('Admin'), updateUser);

module.exports = router;
