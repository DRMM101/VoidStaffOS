/**
 * VoidStaffOS - Express Server
 * Main entry point for the backend API server.
 * Configures middleware, routes, and security settings.
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
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Security middleware
const securityHeaders = require('./middleware/securityHeaders');
const { sessionMiddleware, deriveTenantContext } = require('./middleware/sessionAuth');
const { csrfProtection } = require('./middleware/csrf');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');
const leaveRoutes = require('./routes/leave');
const notificationRoutes = require('./routes/notifications');
const onboardingRoutes = require('./routes/onboarding');
const recruitmentRoutes = require('./routes/recruitment');
const candidatePipelineRoutes = require('./routes/candidatePipeline');
const feedbackRoutes = require('./routes/feedback');
const devRoutes = require('./routes/dev');

const app = express();

// ===========================================
// Security Middleware
// ===========================================

// Security headers (replaces basic helmet)
app.use(securityHeaders);

// CORS: Enable cross-origin requests
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost on any port for development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    // Allow configured frontend URL
    if (origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true // Allow cookies
}));

// JSON body parser with size limit
app.use(express.json({ limit: '10kb' }));

// Session middleware
app.use(sessionMiddleware);

// Derive tenant context from session
app.use(deriveTenantContext);

// CSRF protection
app.use(csrfProtection);

// ===========================================
// Rate Limiting
// ===========================================

// Global rate limiter: 100 requests per minute
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Stricter rate limiter for auth endpoints: 10 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// ===========================================
// Health Check Endpoints
// ===========================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Void Staff OS API is running' });
});

app.get('/api/db-test', async (req, res) => {
  const pool = require('./config/database');
  try {
    const result = await pool.query('SELECT COUNT(*) FROM roles');
    res.json({
      status: 'ok',
      message: 'Database connected',
      roles_count: result.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ===========================================
// API Routes
// ===========================================

// Auth routes with stricter rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// Protected routes
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/pipeline', candidatePipelineRoutes);
app.use('/api/feedback', feedbackRoutes);

// Development routes (should be disabled in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

// ===========================================
// Error Handling
// ===========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/api/health');
  console.log('DB test: http://localhost:' + PORT + '/api/db-test');
});