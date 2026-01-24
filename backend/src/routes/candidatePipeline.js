/**
 * @fileoverview Candidate Pipeline Routes
 *
 * Routes for recruitment pipeline management.
 *
 * @module routes/candidatePipeline
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  updateStage,
  getStageHistory,
  scheduleInterview,
  getInterviews,
  updateInterview,
  addNote,
  getNotes,
  makeOffer,
  acceptOffer,
  declineOffer,
  getPipelineOverview
} = require('../controllers/candidatePipelineController');

// All routes require authentication
router.use(authenticate);

// Pipeline overview
// GET /api/pipeline - Get pipeline overview with counts
router.get('/', getPipelineOverview);

// Stage management
// PUT /api/pipeline/candidates/:id/stage - Move to next stage
router.put('/candidates/:id/stage', validateIdParam, updateStage);

// GET /api/pipeline/candidates/:id/history - Get stage history
router.get('/candidates/:id/history', validateIdParam, getStageHistory);

// Interviews
// POST /api/pipeline/candidates/:id/interviews - Schedule interview
router.post('/candidates/:id/interviews', validateIdParam, scheduleInterview);

// GET /api/pipeline/candidates/:id/interviews - Get interviews
router.get('/candidates/:id/interviews', validateIdParam, getInterviews);

// PUT /api/pipeline/interviews/:id - Update interview
router.put('/interviews/:id', validateIdParam, updateInterview);

// Notes
// POST /api/pipeline/candidates/:id/notes - Add note
router.post('/candidates/:id/notes', validateIdParam, addNote);

// GET /api/pipeline/candidates/:id/notes - Get notes
router.get('/candidates/:id/notes', validateIdParam, getNotes);

// Offers
// PUT /api/pipeline/candidates/:id/offer - Make offer
router.put('/candidates/:id/offer', validateIdParam, makeOffer);

// POST /api/pipeline/candidates/:id/accept-offer - Accept offer
router.post('/candidates/:id/accept-offer', validateIdParam, acceptOffer);

// POST /api/pipeline/candidates/:id/decline-offer - Decline offer
router.post('/candidates/:id/decline-offer', validateIdParam, declineOffer);

module.exports = router;
