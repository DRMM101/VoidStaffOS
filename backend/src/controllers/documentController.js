/**
 * VoidStaffOS - Document Controller
 * Secure employee document management with expiry tracking.
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

const pool = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const auditTrail = require('../utils/auditTrail');

const UPLOAD_BASE = path.join(__dirname, '../../uploads/documents');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const DOCUMENT_CATEGORIES = [
  'cv', 'certificate', 'contract', 'reference', 'rtw', 'dbs', 'supervision', 'responsibility_pack'
];

/**
 * Check if user has HR-level access (Tier 60+)
 */
function isHR(user) {
  return user.tier >= 60 || user.role_name === 'HR Manager';
}

/**
 * Check if user is manager of the employee
 */
async function isManagerOf(managerId, employeeId) {
  const result = await pool.query(
    'SELECT 1 FROM users WHERE id = $1 AND manager_id = $2',
    [employeeId, managerId]
  );
  return result.rows.length > 0;
}

/**
 * Get upload directory for a document
 */
function getUploadDir(tenantId, employeeId) {
  return path.join(UPLOAD_BASE, String(tenantId), String(employeeId));
}

/**
 * Log document access
 */
async function logAccess(documentId, userId, accessType, req, tenantId) {
  const ip = req.ip || req.connection?.remoteAddress || '0.0.0.0';
  const userAgent = req.get('User-Agent') || 'Unknown';

  await pool.query(
    `INSERT INTO document_access_log (tenant_id, document_id, accessed_by, access_type, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5::inet, $6)`,
    [tenantId, documentId, userId, accessType, ip, userAgent]
  );
}

/**
 * Check document visibility for user
 */
async function canViewDocument(document, user) {
  // HR can see everything
  if (isHR(user)) return true;

  // Owner can see if visible_to_employee is true
  if (document.employee_id === user.id) {
    return document.visible_to_employee;
  }

  // Manager can see team docs if visible_to_manager is true
  if (await isManagerOf(user.id, document.employee_id)) {
    return document.visible_to_manager;
  }

  return false;
}

// ===========================================
// CRUD OPERATIONS
// ===========================================

/**
 * Get documents for current user or specified employee
 * GET /api/documents
 * Query params: employee_id, category, status, include_expired
 */
async function getDocuments(req, res) {
  try {
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const { employee_id, category, status, include_expired } = req.query;

    let query = `
      SELECT d.*,
             e.full_name as employee_name,
             e.employee_number,
             u.full_name as uploaded_by_name
      FROM employee_documents d
      JOIN users e ON d.employee_id = e.id
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    // Determine which documents to show based on role and request
    if (employee_id) {
      // Specific employee requested
      if (isHR(req.user)) {
        // HR can view any employee's documents
        query += ` AND d.employee_id = $${paramCount++}`;
        params.push(employee_id);
      } else if (employee_id == userId) {
        // User viewing their own documents
        query += ` AND d.employee_id = $${paramCount++} AND d.visible_to_employee = true`;
        params.push(employee_id);
      } else {
        // Non-HR viewing someone else's docs - must be their manager
        const isManager = await isManagerOf(userId, employee_id);
        if (!isManager) {
          return res.status(403).json({ error: 'You can only view your own documents or your team\'s documents' });
        }
        query += ` AND d.employee_id = $${paramCount++} AND d.visible_to_manager = true`;
        params.push(employee_id);
      }
    } else {
      // No employee specified - show current user's own documents
      query += ` AND d.employee_id = $${paramCount++} AND d.visible_to_employee = true`;
      params.push(userId);
    }

    if (category) {
      query += ` AND d.category = $${paramCount++}`;
      params.push(category);
    }

    if (status) {
      query += ` AND d.status = $${paramCount++}`;
      params.push(status);
    } else if (!include_expired) {
      query += ` AND d.status != 'archived'`;
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
}

/**
 * Get single document by ID
 * GET /api/documents/:id
 */
async function getDocumentById(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT d.*,
              e.full_name as employee_name,
              e.employee_number,
              u.full_name as uploaded_by_name
       FROM employee_documents d
       JOIN users e ON d.employee_id = e.id
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];

    // Check visibility
    if (!await canViewDocument(document, req.user)) {
      return res.status(403).json({ error: 'You do not have permission to view this document' });
    }

    // Log the view access
    await logAccess(id, userId, 'view', req, tenantId);

    res.json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
}

/**
 * Upload a new document
 * POST /api/documents/upload
 */
async function uploadDocument(req, res) {
  try {
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      employee_id,
      category,
      document_type,
      title,
      description,
      expiry_date,
      visible_to_employee,
      visible_to_manager
    } = req.body;

    // Validate required fields
    if (!employee_id || !category || !title) {
      // Clean up temp file
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Missing required fields: employee_id, category, title' });
    }

    // Validate category
    if (!DOCUMENT_CATEGORIES.includes(category)) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Invalid document category' });
    }

    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'File type not allowed. Allowed: PDF, images, Word, Excel' });
    }

    // Validate file size
    if (req.file.size > MAX_FILE_SIZE) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'File size exceeds 20MB limit' });
    }

    // Check permission to upload for this employee
    const targetEmployeeId = parseInt(employee_id);
    if (!isHR(req.user)) {
      // Non-HR can only upload for themselves or direct reports
      if (targetEmployeeId !== userId) {
        const isManager = await isManagerOf(userId, targetEmployeeId);
        if (!isManager) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(403).json({ error: 'You can only upload documents for yourself or your direct reports' });
        }
      }
    }

    // Verify employee exists
    const employeeCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
      [targetEmployeeId, tenantId]
    );
    if (employeeCheck.rows.length === 0) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Create upload directory
    const uploadDir = getUploadDir(tenantId, targetEmployeeId);
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const fileExt = path.extname(req.file.originalname);
    const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;
    const destPath = path.join(uploadDir, uniqueFilename);

    // Move file from temp to permanent location
    await fs.rename(req.file.path, destPath);

    // Determine visibility defaults based on category
    let visEmployee = visible_to_employee !== 'false';
    let visManager = visible_to_manager !== 'false';

    // References are HR-only by default
    if (category === 'reference') {
      visEmployee = visible_to_employee === 'true';
      visManager = visible_to_manager === 'true';
    }

    // Insert document record
    const result = await pool.query(
      `INSERT INTO employee_documents (
        tenant_id, employee_id, uploaded_by, category, document_type, title, description,
        filename, original_filename, file_size, mime_type,
        visible_to_employee, visible_to_manager, expiry_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        tenantId, targetEmployeeId, userId, category, document_type || null, title, description || null,
        uniqueFilename, req.file.originalname, req.file.size, req.file.mimetype,
        visEmployee, visManager, expiry_date || null
      ]
    );

    const document = result.rows[0];

    // Audit trail
    await auditTrail.logCreate(
      { tenantId, userId },
      req,
      'document',
      document.id,
      `Document uploaded: ${title}`,
      { category, employee_id: targetEmployeeId, filename: req.file.originalname }
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      document
    });
  } catch (error) {
    console.error('Upload document error:', error);
    // Clean up temp file if it exists
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
}

/**
 * Update document metadata
 * PUT /api/documents/:id
 */
async function updateDocument(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // Get existing document
    const existing = await pool.query(
      'SELECT * FROM employee_documents WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const oldDoc = existing.rows[0];

    // Only HR or uploader can update
    if (!isHR(req.user) && oldDoc.uploaded_by !== userId) {
      return res.status(403).json({ error: 'Only HR or the uploader can update this document' });
    }

    const {
      title,
      description,
      document_type,
      expiry_date,
      visible_to_employee,
      visible_to_manager
    } = req.body;

    const result = await pool.query(
      `UPDATE employee_documents SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        document_type = COALESCE($3, document_type),
        expiry_date = $4,
        visible_to_employee = COALESCE($5, visible_to_employee),
        visible_to_manager = COALESCE($6, visible_to_manager)
      WHERE id = $7 AND tenant_id = $8
      RETURNING *`,
      [
        title, description, document_type, expiry_date || oldDoc.expiry_date,
        visible_to_employee, visible_to_manager, id, tenantId
      ]
    );

    const document = result.rows[0];

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'document',
      document.id,
      `Document updated: ${document.title}`,
      oldDoc,
      document
    );

    res.json({ message: 'Document updated', document });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
}

/**
 * Archive document (soft delete)
 * POST /api/documents/:id/archive
 */
async function archiveDocument(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const { reason } = req.body;

    // Only HR can archive
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can archive documents' });
    }

    const existing = await pool.query(
      'SELECT * FROM employee_documents WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const result = await pool.query(
      `UPDATE employee_documents SET
        status = 'archived',
        archived_at = NOW(),
        archived_by = $1,
        archive_reason = $2
      WHERE id = $3 AND tenant_id = $4
      RETURNING *`,
      [userId, reason || null, id, tenantId]
    );

    const document = result.rows[0];

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'document',
      document.id,
      `Document archived: ${document.title}`,
      existing.rows[0],
      document
    );

    res.json({ message: 'Document archived', document });
  } catch (error) {
    console.error('Archive document error:', error);
    res.status(500).json({ error: 'Failed to archive document' });
  }
}

/**
 * Permanently delete document (HR only, for compliance cleanup)
 * DELETE /api/documents/:id
 */
async function deleteDocument(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // Only HR can delete
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can permanently delete documents' });
    }

    const existing = await pool.query(
      'SELECT * FROM employee_documents WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const oldDoc = existing.rows[0];

    // Delete file from disk
    const filePath = path.join(getUploadDir(tenantId, oldDoc.employee_id), oldDoc.filename);
    await fs.unlink(filePath).catch(() => {});

    // Delete from database
    await pool.query('DELETE FROM employee_documents WHERE id = $1', [id]);

    // Audit trail
    await auditTrail.logDelete(
      { tenantId, userId },
      req,
      'document',
      id,
      `Document deleted: ${oldDoc.title}`,
      oldDoc
    );

    res.json({ message: 'Document permanently deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
}

// ===========================================
// FILE OPERATIONS
// ===========================================

/**
 * Download/serve document file
 * GET /api/documents/:id/download
 */
async function downloadDocument(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const { preview } = req.query;

    const result = await pool.query(
      'SELECT * FROM employee_documents WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];

    // Check visibility
    if (!await canViewDocument(document, req.user)) {
      return res.status(403).json({ error: 'You do not have permission to access this document' });
    }

    // Log access
    const accessType = preview === 'true' ? 'preview' : 'download';
    await logAccess(id, userId, accessType, req, tenantId);

    // Serve the file
    const filePath = path.join(getUploadDir(tenantId, document.employee_id), document.filename);

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set headers
    res.setHeader('Content-Type', document.mime_type);
    if (preview === 'true') {
      res.setHeader('Content-Disposition', `inline; filename="${document.original_filename}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
    }

    // Stream the file
    const fsSync = require('fs');
    const stream = fsSync.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
}

// ===========================================
// EXPIRY MANAGEMENT
// ===========================================

/**
 * Get expiring documents dashboard
 * GET /api/documents/expiring
 */
async function getExpiringDocuments(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;

    // Only HR can view expiry dashboard
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can view the expiry dashboard' });
    }

    // Get documents expiring within 90 days or already expired
    const result = await pool.query(
      `SELECT d.*,
              e.full_name as employee_name,
              e.employee_number,
              e.email as employee_email,
              m.id as manager_id,
              m.full_name as manager_name,
              m.email as manager_email,
              CASE
                WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
                WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
                WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'warning'
                ELSE 'notice'
              END as escalation_level,
              d.expiry_date - CURRENT_DATE as days_until_expiry
       FROM employee_documents d
       JOIN users e ON d.employee_id = e.id
       LEFT JOIN users m ON e.manager_id = m.id
       WHERE d.tenant_id = $1
         AND d.status = 'active'
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
       ORDER BY d.expiry_date ASC`,
      [tenantId]
    );

    // Group by escalation level
    const grouped = {
      expired: [],
      critical: [],  // 30 days
      warning: [],   // 60 days
      notice: []     // 90 days
    };

    for (const doc of result.rows) {
      grouped[doc.escalation_level].push(doc);
    }

    // Get summary counts by category
    const categoryStats = await pool.query(
      `SELECT category,
              COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) as expired_count,
              COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '30 days') as critical_count,
              COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + INTERVAL '30 days' AND expiry_date <= CURRENT_DATE + INTERVAL '60 days') as warning_count,
              COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + INTERVAL '60 days' AND expiry_date <= CURRENT_DATE + INTERVAL '90 days') as notice_count
       FROM employee_documents
       WHERE tenant_id = $1 AND status = 'active' AND expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'
       GROUP BY category`,
      [tenantId]
    );

    res.json({
      documents: grouped,
      total: result.rows.length,
      by_category: categoryStats.rows,
      summary: {
        expired: grouped.expired.length,
        critical: grouped.critical.length,
        warning: grouped.warning.length,
        notice: grouped.notice.length
      }
    });
  } catch (error) {
    console.error('Get expiring documents error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring documents' });
  }
}

/**
 * Process expiry notifications (called by cron or on demand)
 * POST /api/documents/process-expiry-notifications
 */
async function processExpiryNotifications(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;

    // Only HR can trigger this
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can process expiry notifications' });
    }

    const notifications = await sendExpiryNotifications(tenantId);

    res.json({
      message: 'Expiry notifications processed',
      notifications_sent: notifications.length
    });
  } catch (error) {
    console.error('Process expiry notifications error:', error);
    res.status(500).json({ error: 'Failed to process notifications' });
  }
}

/**
 * Send expiry notifications based on escalation levels
 * Called internally or by cron
 */
async function sendExpiryNotifications(tenantId = 1) {
  const { createNotification } = require('./notificationController');
  const notificationsSent = [];

  try {
    // Get documents needing notifications
    const documents = await pool.query(
      `SELECT d.*,
              e.id as employee_id,
              e.full_name as employee_name,
              e.manager_id,
              d.expiry_date - CURRENT_DATE as days_until_expiry
       FROM employee_documents d
       JOIN users e ON d.employee_id = e.id
       WHERE d.tenant_id = $1
         AND d.status = 'active'
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + INTERVAL '90 days'`,
      [tenantId]
    );

    // Get HR users for critical notifications
    const hrUsers = await pool.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND tier >= 60 AND employment_status = 'active'`,
      [tenantId]
    );
    const hrIds = hrUsers.rows.map(u => u.id);

    for (const doc of documents.rows) {
      const daysUntil = parseInt(doc.days_until_expiry);
      const categoryLabel = doc.category.toUpperCase();
      const isExpired = daysUntil < 0;
      const isCritical = daysUntil <= 30 && daysUntil >= 0;
      const isWarning = daysUntil <= 60 && daysUntil > 30;
      const isNotice = daysUntil <= 90 && daysUntil > 60;

      // EXPIRED - notify all (employee, manager, HR) with CRITICAL flag
      if (isExpired && !doc.expiry_notified_expired) {
        const title = `CRITICAL: ${categoryLabel} Document Expired`;
        const message = `${doc.title} for ${doc.employee_name} has EXPIRED. Immediate action required.`;

        // Notify employee
        if (doc.visible_to_employee) {
          await createNotification(doc.employee_id, 'document_expired', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: doc.employee_id, level: 'expired' });
        }

        // Notify manager
        if (doc.manager_id && doc.visible_to_manager) {
          await createNotification(doc.manager_id, 'document_expired', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: doc.manager_id, level: 'expired' });
        }

        // Notify all HR
        for (const hrId of hrIds) {
          await createNotification(hrId, 'document_expired', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: hrId, level: 'expired' });
        }

        await pool.query('UPDATE employee_documents SET expiry_notified_expired = true WHERE id = $1', [doc.id]);
      }

      // 30 DAYS - notify employee, manager, and HR
      else if (isCritical && !doc.expiry_notified_30) {
        const title = `URGENT: ${categoryLabel} Document Expiring in ${daysUntil} Days`;
        const message = `${doc.title} for ${doc.employee_name} expires on ${new Date(doc.expiry_date).toLocaleDateString()}. Please renew immediately.`;

        if (doc.visible_to_employee) {
          await createNotification(doc.employee_id, 'document_expiry_30', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: doc.employee_id, level: '30' });
        }

        if (doc.manager_id && doc.visible_to_manager) {
          await createNotification(doc.manager_id, 'document_expiry_30', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: doc.manager_id, level: '30' });
        }

        for (const hrId of hrIds) {
          await createNotification(hrId, 'document_expiry_30', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: hrId, level: '30' });
        }

        await pool.query('UPDATE employee_documents SET expiry_notified_30 = true WHERE id = $1', [doc.id]);
      }

      // 60 DAYS - notify employee and manager
      else if (isWarning && !doc.expiry_notified_60) {
        const title = `${categoryLabel} Document Expiring Soon`;
        const message = `${doc.title} for ${doc.employee_name} expires in ${daysUntil} days (${new Date(doc.expiry_date).toLocaleDateString()}). Please plan for renewal.`;

        if (doc.visible_to_employee) {
          await createNotification(doc.employee_id, 'document_expiry_60', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: doc.employee_id, level: '60' });
        }

        if (doc.manager_id && doc.visible_to_manager) {
          await createNotification(doc.manager_id, 'document_expiry_60', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: doc.manager_id, level: '60' });
        }

        await pool.query('UPDATE employee_documents SET expiry_notified_60 = true WHERE id = $1', [doc.id]);
      }

      // 90 DAYS - notify employee only
      else if (isNotice && !doc.expiry_notified_90) {
        const title = `${categoryLabel} Document Expiry Notice`;
        const message = `${doc.title} expires in ${daysUntil} days (${new Date(doc.expiry_date).toLocaleDateString()}). Please ensure you have a renewal plan.`;

        if (doc.visible_to_employee) {
          await createNotification(doc.employee_id, 'document_expiry_90', title, message, doc.id, 'document', tenantId);
          notificationsSent.push({ doc_id: doc.id, user_id: doc.employee_id, level: '90' });
        }

        await pool.query('UPDATE employee_documents SET expiry_notified_90 = true WHERE id = $1', [doc.id]);
      }
    }

    return notificationsSent;
  } catch (error) {
    console.error('Send expiry notifications error:', error);
    return notificationsSent;
  }
}

// ===========================================
// DOCUMENT STATS
// ===========================================

/**
 * Get document stats for current user
 * GET /api/documents/my-stats
 */
async function getMyDocumentStats(req, res) {
  try {
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND status = 'active') as expiring_soon
       FROM employee_documents
       WHERE tenant_id = $1 AND employee_id = $2 AND visible_to_employee = true`,
      [tenantId, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get document stats error:', error);
    res.status(500).json({ error: 'Failed to fetch document stats' });
  }
}

/**
 * Get access log for a document (HR only)
 * GET /api/documents/:id/access-log
 */
async function getDocumentAccessLog(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;

    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can view access logs' });
    }

    const result = await pool.query(
      `SELECT l.*, u.full_name as accessed_by_name
       FROM document_access_log l
       JOIN users u ON l.accessed_by = u.id
       WHERE l.document_id = $1 AND l.tenant_id = $2
       ORDER BY l.accessed_at DESC
       LIMIT 100`,
      [id, tenantId]
    );

    res.json({ access_log: result.rows });
  } catch (error) {
    console.error('Get access log error:', error);
    res.status(500).json({ error: 'Failed to fetch access log' });
  }
}

/**
 * Get all employees with their document counts (HR view)
 * GET /api/documents/by-employee
 */
async function getDocumentsByEmployee(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;

    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can view all employee documents' });
    }

    const result = await pool.query(
      `SELECT
        u.id as employee_id,
        u.full_name,
        u.employee_number,
        u.email,
        COUNT(d.id) as total_documents,
        COUNT(d.id) FILTER (WHERE d.status = 'active') as active_documents,
        COUNT(d.id) FILTER (WHERE d.status = 'expired') as expired_documents,
        COUNT(d.id) FILTER (WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND d.status = 'active') as expiring_soon,
        MAX(d.created_at) as last_upload
       FROM users u
       LEFT JOIN employee_documents d ON u.id = d.employee_id AND d.tenant_id = $1
       WHERE u.tenant_id = $1 AND u.employment_status = 'active'
       GROUP BY u.id, u.full_name, u.employee_number, u.email
       ORDER BY u.full_name`,
      [tenantId]
    );

    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get documents by employee error:', error);
    res.status(500).json({ error: 'Failed to fetch employee documents' });
  }
}

module.exports = {
  getDocuments,
  getDocumentById,
  uploadDocument,
  updateDocument,
  archiveDocument,
  deleteDocument,
  downloadDocument,
  getExpiringDocuments,
  processExpiryNotifications,
  sendExpiryNotifications,
  getMyDocumentStats,
  getDocumentAccessLog,
  getDocumentsByEmployee,
  isHR
};
