/**
 * VoidStaffOS - Authentication Routes
 * API routes for authentication operations.
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
const { register, login, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateLogin, validateUser } = require('../middleware/validation');

// POST /api/auth/register - Create new user (requires validation)
router.post('/register', validateUser, register);

// POST /api/auth/login - Authenticate and receive JWT
router.post('/login', validateLogin, login);

// GET /api/auth/me - Get current authenticated user
router.get('/me', authenticate, getMe);

// POST /api/auth/logout - Logout and destroy session
router.post('/logout', logout);

module.exports = router;
