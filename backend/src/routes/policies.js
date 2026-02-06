/**
 * HeadOfficeOS - Policy Management Routes
 * API routes for PolicyOS with legally compliant acknowledgment tracking.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: PolicyOS
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const {
  getPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  publishPolicy,
  archivePolicy,
  deletePolicy,
  getPendingPolicies,
  acknowledgePolicy,
  getPolicyAcknowledgments,
  getComplianceReport,
  getPolicyVersions,
  getMyPolicyStats,
  uploadPolicyPdf,
  servePolicyPdf,
  deletePolicyPdf
} = require('../controllers/policyController');
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

// Configure multer for PDF uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'HeadOfficeOS-uploads'),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// All routes require authentication
router.use(authenticate);

// ===========================================
// Employee Routes (any authenticated user)
// ===========================================

// GET /api/policies/pending - Get policies pending acknowledgment for current user
router.get('/pending', getPendingPolicies);

// GET /api/policies/my-stats - Get policy stats for dashboard
router.get('/my-stats', getMyPolicyStats);

// GET /api/policies/compliance-report - Get compliance statistics (HR only)
router.get('/compliance-report', getComplianceReport);

// ===========================================
// Policy CRUD Routes
// ===========================================

// GET /api/policies - Get all policies
router.get('/', getPolicies);

// POST /api/policies - Create new policy
router.post('/', createPolicy);

// GET /api/policies/:id - Get single policy
router.get('/:id', validateIdParam, getPolicyById);

// PUT /api/policies/:id - Update policy
router.put('/:id', validateIdParam, updatePolicy);

// DELETE /api/policies/:id - Delete draft policy
router.delete('/:id', validateIdParam, deletePolicy);

// ===========================================
// Policy Workflow Routes
// ===========================================

// POST /api/policies/:id/publish - Publish policy
router.post('/:id/publish', validateIdParam, publishPolicy);

// POST /api/policies/:id/archive - Archive policy
router.post('/:id/archive', validateIdParam, archivePolicy);

// ===========================================
// Acknowledgment Routes
// ===========================================

// POST /api/policies/:id/acknowledge - Acknowledge a policy
router.post('/:id/acknowledge', validateIdParam, acknowledgePolicy);

// GET /api/policies/:id/acknowledgments - Get acknowledgments for policy (HR only)
router.get('/:id/acknowledgments', validateIdParam, getPolicyAcknowledgments);

// ===========================================
// Version History Routes
// ===========================================

// GET /api/policies/:id/versions - Get version history
router.get('/:id/versions', validateIdParam, getPolicyVersions);

// ===========================================
// PDF Upload/Serve Routes
// ===========================================

// POST /api/policies/:id/upload-pdf - Upload PDF attachment
router.post('/:id/upload-pdf', validateIdParam, upload.single('pdf'), uploadPolicyPdf);

// GET /api/policies/:id/pdf - Serve PDF file
router.get('/:id/pdf', validateIdParam, servePolicyPdf);

// DELETE /api/policies/:id/pdf - Delete PDF attachment
router.delete('/:id/pdf', validateIdParam, deletePolicyPdf);

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;
