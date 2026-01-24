/**
 * @fileoverview Authentication Routes
 * @module routes/auth
 */

const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateLogin, validateUser } = require('../middleware/validation');

// POST /api/auth/register - Create new user (requires validation)
router.post('/register', validateUser, register);

// POST /api/auth/login - Authenticate and receive JWT
router.post('/login', validateLogin, login);

// GET /api/auth/me - Get current authenticated user
router.get('/me', authenticate, getMe);

module.exports = router;
