/**
 * HeadOfficeOS - Document Routes
 * API routes for secure employee document management.
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
 * Module: Document Storage
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const {
  getDocuments,
  getDocumentById,
  uploadDocument,
  updateDocument,
  archiveDocument,
  deleteDocument,
  downloadDocument,
  getExpiringDocuments,
  processExpiryNotifications,
  getMyDocumentStats,
  getDocumentAccessLog,
  getDocumentsByEmployee
} = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

// Configure multer for document uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'HeadOfficeOS-doc-uploads'),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed: PDF, images, Word, Excel'), false);
    }
  }
});

// All routes require authentication
router.use(authenticate);

// ===========================================
// Stats and Dashboard Routes (must be before /:id routes)
// ===========================================

// GET /api/documents/my-stats - Get current user's document stats
router.get('/my-stats', getMyDocumentStats);

// GET /api/documents/expiring - Get expiring documents dashboard (HR only)
router.get('/expiring', getExpiringDocuments);

// GET /api/documents/by-employee - Get all employees with document counts (HR only)
router.get('/by-employee', getDocumentsByEmployee);

// POST /api/documents/process-expiry-notifications - Process notifications (HR only)
router.post('/process-expiry-notifications', processExpiryNotifications);

// ===========================================
// Document CRUD Routes
// ===========================================

// GET /api/documents - Get documents (filtered by permissions)
router.get('/', getDocuments);

// POST /api/documents/upload - Upload new document
router.post('/upload', upload.single('file'), uploadDocument);

// GET /api/documents/:id - Get single document
router.get('/:id', validateIdParam, getDocumentById);

// PUT /api/documents/:id - Update document metadata
router.put('/:id', validateIdParam, updateDocument);

// POST /api/documents/:id/archive - Archive document (soft delete)
router.post('/:id/archive', validateIdParam, archiveDocument);

// DELETE /api/documents/:id - Permanently delete document (HR only)
router.delete('/:id', validateIdParam, deleteDocument);

// ===========================================
// File Operations
// ===========================================

// GET /api/documents/:id/download - Download document file
router.get('/:id/download', validateIdParam, downloadDocument);

// GET /api/documents/:id/access-log - Get document access log (HR only)
router.get('/:id/access-log', validateIdParam, getDocumentAccessLog);

// ===========================================
// Error handling for multer
// ===========================================

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 20MB limit' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error.message && error.message.includes('File type not allowed')) {
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;
