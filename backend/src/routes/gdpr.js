// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — GDPR Data Export Routes
 * Handles Subject Access Requests (data export) and deletion requests.
 * Employees can request a copy of all their personal data held in the system.
 * HR/Admin can manage deletion requests and view all requests across the tenant.
 *
 * UK GDPR compliance: 30-day response deadline, machine-readable format (JSON in ZIP).
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const archiver = require('archiver');

/* All routes require authentication */
router.use(authenticate);

// Base directory for export files — stored under backend/uploads/exports/{tenantId}/
const EXPORTS_BASE = path.join(__dirname, '../../uploads/exports');

// Maximum export requests per 24-hour period (rate limit)
const MAX_EXPORTS_PER_DAY = 3;

// Download link expiry in days
const EXPORT_EXPIRY_DAYS = 30;

// =====================================================
// EXPORT ZIP GENERATION SERVICE
// =====================================================

/**
 * Defines all tables to include in a GDPR data export.
 * Each entry specifies the table name, the FK column linking to the user,
 * the SQL query, and the output filename within the ZIP.
 * Tables with indirect relationships (via parent table JOINs) have custom queries.
 */
const EXPORT_TABLES = [
  // Profile — explicitly list columns to EXCLUDE password_hash
  {
    label: 'User Profile',
    filename: 'profile/user_profile.json',
    query: `SELECT id, email, full_name, employee_number, role_id, employment_status,
                   start_date, end_date, manager_id, tier, annual_leave_entitlement,
                   tenant_id, created_at
            FROM users WHERE id = $1 AND tenant_id = $2`
  },
  // Personal information
  {
    label: 'Emergency Contacts',
    filename: 'personal/emergency_contacts.json',
    query: `SELECT * FROM emergency_contacts WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Medical Information',
    filename: 'personal/medical_info.json',
    query: `SELECT * FROM medical_info WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Documents — metadata only, not the actual files
  {
    label: 'Document Records',
    filename: 'documents/document_records.json',
    query: `SELECT id, category, original_filename, mime_type, file_size, expiry_date,
                   visible_to_employee, visible_to_manager, uploaded_by, created_at, updated_at
            FROM employee_documents WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Leave & absence
  {
    label: 'Leave Requests',
    filename: 'leave/leave_requests.json',
    query: `SELECT * FROM leave_requests WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Return to Work Interviews',
    filename: 'leave/return_to_work_interviews.json',
    query: `SELECT * FROM return_to_work_interviews WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'SSP Periods',
    filename: 'leave/ssp_periods.json',
    query: `SELECT * FROM ssp_periods WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Statutory Leave Entitlements',
    filename: 'leave/statutory_leave_entitlements.json',
    query: `SELECT * FROM statutory_leave_entitlements WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Compliance
  {
    label: 'Right to Work Checks',
    filename: 'compliance/rtw_checks.json',
    query: `SELECT * FROM rtw_checks WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'DBS Checks',
    filename: 'compliance/dbs_checks.json',
    query: `SELECT * FROM dbs_checks WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Performance
  {
    label: 'Performance Reviews',
    filename: 'performance/reviews.json',
    query: `SELECT * FROM reviews WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Compensation (UUID PK tables)
  {
    label: 'Compensation Records',
    filename: 'compensation/compensation_records.json',
    query: `SELECT * FROM compensation_records WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Benefits',
    filename: 'compensation/benefits.json',
    query: `SELECT * FROM benefits WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Pay Reviews',
    filename: 'compensation/pay_reviews.json',
    query: `SELECT * FROM pay_reviews WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Pay Slips',
    filename: 'compensation/pay_slips.json',
    query: `SELECT * FROM pay_slips WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Goals
  {
    label: 'Goals',
    filename: 'goals/goals.json',
    query: `SELECT * FROM goals WHERE user_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Goal Updates',
    filename: 'goals/goal_updates.json',
    query: `SELECT gu.* FROM goal_updates gu
            JOIN goals g ON gu.goal_id = g.id
            WHERE g.user_id = $1 AND g.tenant_id = $2`
  },
  // Probation
  {
    label: 'Probation Periods',
    filename: 'probation/probation_periods.json',
    query: `SELECT * FROM probation_periods WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Probation Reviews',
    filename: 'probation/probation_reviews.json',
    query: `SELECT * FROM probation_reviews WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Offboarding
  {
    label: 'Offboarding Workflows',
    filename: 'offboarding/offboarding_workflows.json',
    query: `SELECT * FROM offboarding_workflows WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Exit Interviews',
    filename: 'offboarding/exit_interviews.json',
    query: `SELECT * FROM exit_interviews WHERE employee_id = $1 AND tenant_id = $2`
  },
  // Opportunities
  {
    label: 'Internal Applications',
    filename: 'opportunities/internal_applications.json',
    query: `SELECT * FROM internal_applications WHERE applicant_id = $1 AND tenant_id = $2`
  },
  // Activity
  {
    label: 'Announcement Reads',
    filename: 'activity/announcement_reads.json',
    query: `SELECT * FROM announcement_reads WHERE user_id = $1 AND tenant_id = $2`
  },
  // Absence analytics
  {
    label: 'Absence Insights',
    filename: 'absence/absence_insights.json',
    query: `SELECT * FROM absence_insights WHERE employee_id = $1 AND tenant_id = $2`
  },
  {
    label: 'Absence Summaries',
    filename: 'absence/absence_summaries.json',
    query: `SELECT * FROM absence_summaries WHERE employee_id = $1 AND tenant_id = $2`
  }
];

/**
 * Generate a ZIP archive containing all personal data for a given employee.
 * Queries every relevant table and adds non-empty results as JSON files.
 * Also handles HR cases with sub-tables (pip_objectives, case_notes).
 *
 * @param {number} tenantId - The tenant ID for data isolation
 * @param {number} employeeId - The employee whose data to export
 * @param {number} requestId - The data_request row ID for filename
 * @returns {Promise<{relativePath: string, fileSize: number}>} Path and size of generated ZIP
 */
async function generateExportZip(tenantId, employeeId, requestId) {
  // Create output directory if it doesn't exist
  const exportDir = path.join(EXPORTS_BASE, String(tenantId));
  await fsp.mkdir(exportDir, { recursive: true });

  // Build the output filename and paths
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `export_${requestId}_${dateStr}.zip`;
  const outputPath = path.join(exportDir, filename);
  const relativePath = `exports/${tenantId}/${filename}`;

  // Create a write stream and archiver instance
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(output);

  // Track which tables had data for the manifest
  const tablesIncluded = [];

  // Query each standard table and add non-empty results to the archive
  for (const table of EXPORT_TABLES) {
    try {
      const result = await db.query(table.query, [employeeId, tenantId]);
      if (result.rows.length > 0) {
        archive.append(JSON.stringify(result.rows, null, 2), { name: table.filename });
        tablesIncluded.push({ label: table.label, records: result.rows.length });
      }
    } catch (err) {
      // If a table doesn't exist (not migrated yet), skip it silently
      console.warn(`GDPR export: skipping ${table.label} — ${err.message}`);
    }
  }

  // HR Cases require special handling — sub-tables linked via case_id, not employee_id
  try {
    const casesResult = await db.query(
      `SELECT * FROM hr_cases WHERE employee_id = $1 AND tenant_id = $2`,
      [employeeId, tenantId]
    );
    if (casesResult.rows.length > 0) {
      archive.append(JSON.stringify(casesResult.rows, null, 2), { name: 'hr_cases/cases.json' });
      tablesIncluded.push({ label: 'HR Cases', records: casesResult.rows.length });

      // Collect all case IDs to query sub-tables
      const caseIds = casesResult.rows.map(c => c.id);

      // PIP objectives linked to user's cases
      const pipResult = await db.query(
        `SELECT * FROM pip_objectives WHERE case_id = ANY($1::int[])`,
        [caseIds]
      );
      if (pipResult.rows.length > 0) {
        archive.append(JSON.stringify(pipResult.rows, null, 2), { name: 'hr_cases/pip_objectives.json' });
        tablesIncluded.push({ label: 'PIP Objectives', records: pipResult.rows.length });
      }

      // Case notes — only those visible to the employee (GDPR: don't expose HR-only notes)
      const notesResult = await db.query(
        `SELECT * FROM hr_case_notes WHERE case_id = ANY($1::int[]) AND visible_to_employee = true`,
        [caseIds]
      );
      if (notesResult.rows.length > 0) {
        archive.append(JSON.stringify(notesResult.rows, null, 2), { name: 'hr_cases/case_notes.json' });
        tablesIncluded.push({ label: 'HR Case Notes (visible)', records: notesResult.rows.length });
      }
    }
  } catch (err) {
    console.warn(`GDPR export: skipping HR cases — ${err.message}`);
  }

  // Add a manifest file summarising what's included
  const manifest = {
    generated_at: new Date().toISOString(),
    subject_id: employeeId,
    request_id: requestId,
    tenant_id: tenantId,
    format: 'JSON files organised by category',
    tables_included: tablesIncluded,
    note: 'This archive contains all personal data held in VoidStaffOS for this employee, ' +
          'generated in compliance with UK GDPR Article 15 (Right of Access).'
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // Finalise the archive — this triggers the end of the stream
  await archive.finalize();

  // Wait for the output stream to finish writing to disk
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });

  // Get the file size for the database record
  const stats = await fsp.stat(outputPath);

  return { relativePath, fileSize: stats.size };
}

// =====================================================
// EMPLOYEE SELF-SERVICE ENDPOINTS
// =====================================================

/**
 * GET /api/gdpr/my-requests
 * List the current user's own data requests, ordered by most recent first.
 */
router.get('/my-requests', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT dr.*,
              requester.full_name AS requested_by_name
       FROM data_requests dr
       LEFT JOIN users requester ON dr.requested_by = requester.id
       WHERE dr.tenant_id = $1 AND dr.employee_id = $2
       ORDER BY dr.created_at DESC`,
      [tenantId, userId]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('GDPR my-requests error:', error);
    res.status(500).json({ error: 'Failed to fetch your data requests' });
  }
});

/**
 * POST /api/gdpr/export
 * Employee requests an export of all their personal data.
 * Rate-limited to MAX_EXPORTS_PER_DAY per 24-hour window.
 * The export is generated immediately (synchronous for the request).
 */
router.post('/export', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // Rate limit check — count recent export requests in the last 24 hours
    const rateLimitResult = await db.query(
      `SELECT COUNT(*) AS count FROM data_requests
       WHERE employee_id = $1 AND tenant_id = $2
         AND request_type = 'export'
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId, tenantId]
    );

    if (parseInt(rateLimitResult.rows[0].count) >= MAX_EXPORTS_PER_DAY) {
      return res.status(429).json({
        error: `You can request up to ${MAX_EXPORTS_PER_DAY} data exports per 24 hours. Please try again later.`
      });
    }

    // Create the request record with status 'processing'
    const insertResult = await db.query(
      `INSERT INTO data_requests (tenant_id, employee_id, requested_by, request_type, status, expires_at)
       VALUES ($1, $2, $2, 'export', 'processing', NOW() + INTERVAL '${EXPORT_EXPIRY_DAYS} days')
       RETURNING *`,
      [tenantId, userId]
    );
    const request = insertResult.rows[0];

    // Log the creation
    await db.query(
      `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
       VALUES ($1, $2, 'created', $3, 'Employee requested data export')`,
      [tenantId, request.id, userId]
    );

    // Generate the export ZIP
    try {
      const { relativePath, fileSize } = await generateExportZip(tenantId, userId, request.id);

      // Update the request with the file details
      const updatedResult = await db.query(
        `UPDATE data_requests
         SET status = 'completed', file_path = $1, file_size_bytes = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [relativePath, fileSize, request.id]
      );

      // Log completion
      await db.query(
        `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
         VALUES ($1, $2, 'completed', $3, $4)`,
        [tenantId, request.id, userId, `Export generated: ${relativePath} (${fileSize} bytes)`]
      );

      res.status(201).json({ message: 'Data export generated', request: updatedResult.rows[0] });
    } catch (genError) {
      // If generation fails, mark as pending so it can be retried
      console.error('GDPR export generation error:', genError);
      await db.query(
        `UPDATE data_requests SET status = 'pending', updated_at = NOW() WHERE id = $1`,
        [request.id]
      );
      await db.query(
        `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
         VALUES ($1, $2, 'error', $3, $4)`,
        [tenantId, request.id, userId, `Export generation failed: ${genError.message}`]
      );
      res.status(500).json({ error: 'Failed to generate data export. Please try again.' });
    }
  } catch (error) {
    console.error('GDPR export request error:', error);
    res.status(500).json({ error: 'Failed to create data export request' });
  }
});

/**
 * GET /api/gdpr/download/:id
 * Download a completed data export ZIP. Verifies ownership (or admin role),
 * checks the export hasn't expired, and streams the file.
 */
router.get('/download/:id', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const requestId = parseInt(req.params.id);

    // Validate request ID
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Fetch the request, checking tenant isolation
    const result = await db.query(
      `SELECT * FROM data_requests WHERE id = $1 AND tenant_id = $2`,
      [requestId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data request not found' });
    }

    const request = result.rows[0];

    // Permission check: must be the data subject or admin/HR
    const isAdmin = req.user.role_name === 'Admin' || req.user.role_name === 'HR Manager';
    if (request.employee_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'You can only download your own data exports' });
    }

    // Must be a completed export with a file path
    if (request.status !== 'completed' || !request.file_path) {
      return res.status(400).json({ error: 'Export is not ready for download' });
    }

    // Check expiry
    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This export link has expired' });
    }

    // Resolve the full file path from the relative path
    const filePath = path.join(__dirname, '../../uploads', request.file_path);

    // Check file exists on disk
    try {
      await fsp.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Export file not found on server' });
    }

    // Log the download for audit compliance
    await db.query(
      `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
       VALUES ($1, $2, 'downloaded', $3, $4)`,
      [tenantId, requestId, userId, `Downloaded by ${req.user.full_name}`]
    );

    // Stream the file to the client
    const zipFilename = path.basename(request.file_path);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('GDPR download error:', error);
    res.status(500).json({ error: 'Failed to download export' });
  }
});

// =====================================================
// ADMIN / HR MANAGEMENT ENDPOINTS
// =====================================================

/**
 * GET /api/gdpr/requests
 * List all data requests across the tenant. Admin/HR only.
 * Supports filtering by status, type, and search by employee name.
 */
router.get('/requests', authorize('Admin', 'HR Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { status, type, search } = req.query;

    // Build dynamic WHERE clause for filters
    let whereClause = 'WHERE dr.tenant_id = $1';
    const params = [tenantId];
    let paramIdx = 2;

    if (status) {
      whereClause += ` AND dr.status = $${paramIdx++}`;
      params.push(status);
    }
    if (type) {
      whereClause += ` AND dr.request_type = $${paramIdx++}`;
      params.push(type);
    }
    if (search) {
      whereClause += ` AND (emp.full_name ILIKE $${paramIdx++} OR emp.email ILIKE $${paramIdx++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const result = await db.query(
      `SELECT dr.*,
              emp.full_name AS employee_name,
              emp.email AS employee_email,
              emp.employee_number,
              processor.full_name AS processed_by_name
       FROM data_requests dr
       JOIN users emp ON dr.employee_id = emp.id
       LEFT JOIN users processor ON dr.processed_by = processor.id
       ${whereClause}
       ORDER BY dr.created_at DESC`,
      params
    );

    res.json({ requests: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('GDPR list requests error:', error);
    res.status(500).json({ error: 'Failed to fetch data requests' });
  }
});

/**
 * GET /api/gdpr/requests/:id
 * Get full details of a data request including its audit log. Admin/HR only.
 */
router.get('/requests/:id', authorize('Admin', 'HR Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const requestId = parseInt(req.params.id);

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Fetch the request with employee and processor details
    const result = await db.query(
      `SELECT dr.*,
              emp.full_name AS employee_name,
              emp.email AS employee_email,
              emp.employee_number,
              requester.full_name AS requested_by_name,
              processor.full_name AS processed_by_name
       FROM data_requests dr
       JOIN users emp ON dr.employee_id = emp.id
       LEFT JOIN users requester ON dr.requested_by = requester.id
       LEFT JOIN users processor ON dr.processed_by = processor.id
       WHERE dr.id = $1 AND dr.tenant_id = $2`,
      [requestId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data request not found' });
    }

    // Fetch the audit log for this request
    const logsResult = await db.query(
      `SELECT drl.*, u.full_name AS performed_by_name
       FROM data_request_logs drl
       LEFT JOIN users u ON drl.performed_by = u.id
       WHERE drl.data_request_id = $1 AND drl.tenant_id = $2
       ORDER BY drl.created_at ASC`,
      [requestId, tenantId]
    );

    res.json({ request: result.rows[0], logs: logsResult.rows });
  } catch (error) {
    console.error('GDPR request detail error:', error);
    res.status(500).json({ error: 'Failed to fetch request details' });
  }
});

/**
 * POST /api/gdpr/requests/:id/process
 * Process (approve) a pending deletion request. Admin only.
 * Marks the request as completed. Actual data deletion is a future enhancement.
 */
router.post('/requests/:id/process', authorize('Admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const requestId = parseInt(req.params.id);
    const { notes } = req.body;

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Fetch the request and validate it's pending
    const result = await db.query(
      `SELECT * FROM data_requests WHERE id = $1 AND tenant_id = $2`,
      [requestId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data request not found' });
    }

    const request = result.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Cannot process a request with status '${request.status}'` });
    }

    // If it's an export request, generate the ZIP now
    if (request.request_type === 'export') {
      // Update status to processing
      await db.query(
        `UPDATE data_requests SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [requestId]
      );

      try {
        const { relativePath, fileSize } = await generateExportZip(tenantId, request.employee_id, requestId);

        const updatedResult = await db.query(
          `UPDATE data_requests
           SET status = 'completed', file_path = $1, file_size_bytes = $2,
               processed_by = $3, processed_at = NOW(),
               expires_at = NOW() + INTERVAL '${EXPORT_EXPIRY_DAYS} days', updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [relativePath, fileSize, userId, requestId]
        );

        await db.query(
          `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
           VALUES ($1, $2, 'completed', $3, $4)`,
          [tenantId, requestId, userId, `Export generated by HR: ${relativePath} (${fileSize} bytes)${notes ? '. Notes: ' + notes : ''}`]
        );

        return res.json({ message: 'Export generated', request: updatedResult.rows[0] });
      } catch (genError) {
        console.error('GDPR admin export generation error:', genError);
        await db.query(
          `UPDATE data_requests SET status = 'pending', updated_at = NOW() WHERE id = $1`,
          [requestId]
        );
        return res.status(500).json({ error: 'Failed to generate export' });
      }
    }

    // For deletion requests — mark as completed (actual deletion is future work)
    const updatedResult = await db.query(
      `UPDATE data_requests
       SET status = 'completed', processed_by = $1, processed_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, requestId]
    );

    // Log the processing action
    await db.query(
      `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
       VALUES ($1, $2, 'processed', $3, $4)`,
      [tenantId, requestId, userId, `Deletion request approved by ${req.user.full_name}${notes ? '. Notes: ' + notes : ''}`]
    );

    res.json({ message: 'Request processed', request: updatedResult.rows[0] });
  } catch (error) {
    console.error('GDPR process request error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /api/gdpr/requests/:id/reject
 * Reject a data request with a reason. Admin/HR only.
 */
router.post('/requests/:id/reject', authorize('Admin', 'HR Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const requestId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Rejection reason is required
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Fetch and validate
    const result = await db.query(
      `SELECT * FROM data_requests WHERE id = $1 AND tenant_id = $2`,
      [requestId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data request not found' });
    }

    if (result.rows[0].status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject a request with status '${result.rows[0].status}'` });
    }

    // Update the request to rejected
    const updatedResult = await db.query(
      `UPDATE data_requests
       SET status = 'rejected', rejection_reason = $1, processed_by = $2,
           processed_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [reason.trim(), userId, requestId]
    );

    // Log the rejection
    await db.query(
      `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
       VALUES ($1, $2, 'rejected', $3, $4)`,
      [tenantId, requestId, userId, `Rejected by ${req.user.full_name}. Reason: ${reason.trim()}`]
    );

    res.json({ message: 'Request rejected', request: updatedResult.rows[0] });
  } catch (error) {
    console.error('GDPR reject request error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

/**
 * POST /api/gdpr/deletion-request
 * HR/Admin creates a deletion request on behalf of an employee.
 * This creates a 'pending' deletion request that must be approved via /process.
 */
router.post('/deletion-request', authorize('Admin', 'HR Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { employee_id, reason } = req.body;

    // Validate inputs
    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for deletion requests' });
    }

    const empId = parseInt(employee_id);
    if (isNaN(empId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    // Verify the employee exists and belongs to the same tenant
    const empResult = await db.query(
      `SELECT id, full_name FROM users WHERE id = $1 AND tenant_id = $2`,
      [empId, tenantId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Create the deletion request
    const insertResult = await db.query(
      `INSERT INTO data_requests (tenant_id, employee_id, requested_by, request_type, status, reason)
       VALUES ($1, $2, $3, 'deletion', 'pending', $4)
       RETURNING *`,
      [tenantId, empId, userId, reason.trim()]
    );

    // Log the creation
    await db.query(
      `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
       VALUES ($1, $2, 'created', $3, $4)`,
      [tenantId, insertResult.rows[0].id, userId,
       `Deletion request created by ${req.user.full_name} for ${empResult.rows[0].full_name}`]
    );

    res.status(201).json({ message: 'Deletion request created', request: insertResult.rows[0] });
  } catch (error) {
    console.error('GDPR deletion request error:', error);
    res.status(500).json({ error: 'Failed to create deletion request' });
  }
});

/**
 * POST /api/gdpr/cleanup-expired
 * Admin endpoint to clean up expired export files from disk and mark them as expired.
 * Should be run periodically (e.g. daily via cron or manually).
 */
router.post('/cleanup-expired', authorize('Admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // Find all completed export requests that have expired
    const expiredResult = await db.query(
      `SELECT * FROM data_requests
       WHERE tenant_id = $1
         AND status = 'completed'
         AND request_type = 'export'
         AND expires_at < NOW()
         AND file_path IS NOT NULL`,
      [tenantId]
    );

    let cleanedCount = 0;

    // Delete each expired file and update the record
    for (const request of expiredResult.rows) {
      try {
        const filePath = path.join(__dirname, '../../uploads', request.file_path);

        // Delete the file from disk if it exists
        try {
          await fsp.unlink(filePath);
        } catch {
          // File may already be deleted — that's fine
        }

        // Update the request status to expired and clear file path
        await db.query(
          `UPDATE data_requests
           SET status = 'expired', file_path = NULL, file_size_bytes = NULL, updated_at = NOW()
           WHERE id = $1`,
          [request.id]
        );

        // Log the cleanup
        await db.query(
          `INSERT INTO data_request_logs (tenant_id, data_request_id, action, performed_by, details)
           VALUES ($1, $2, 'expired', $3, 'Export file cleaned up after expiry')`,
          [tenantId, request.id, userId]
        );

        cleanedCount++;
      } catch (err) {
        console.error(`GDPR cleanup: failed to clean request ${request.id}:`, err);
      }
    }

    res.json({ message: `Cleaned up ${cleanedCount} expired export(s)`, cleaned: cleanedCount });
  } catch (error) {
    console.error('GDPR cleanup error:', error);
    res.status(500).json({ error: 'Failed to clean up expired exports' });
  }
});

module.exports = router;
