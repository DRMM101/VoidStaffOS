// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Internal Opportunities Routes
 * API routes for internal job postings and employee applications.
 * Employees can browse open roles and apply; HR/Admin manage postings.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/* All routes require authentication */
router.use(authenticate);

// =====================================================
// OPPORTUNITY ENDPOINTS
// =====================================================

/**
 * GET /api/opportunities
 * List open opportunities visible to all employees.
 * Returns only opportunities with status='open' for the user's tenant.
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    /* Fetch open opportunities with applicant count and poster name */
    const result = await db.query(
      `SELECT o.*,
              u.full_name AS posted_by_name,
              (SELECT COUNT(*) FROM internal_applications a WHERE a.opportunity_id = o.id) AS applicant_count
       FROM internal_opportunities o
       LEFT JOIN users u ON u.id = o.posted_by
       WHERE o.tenant_id = $1 AND o.status = 'open'
       ORDER BY o.posted_at DESC NULLS LAST, o.created_at DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

/**
 * GET /api/opportunities/all
 * List all opportunities (any status) — HR/Admin only.
 * Used for the admin management view.
 */
router.get('/all', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const result = await db.query(
      `SELECT o.*,
              u.full_name AS posted_by_name,
              (SELECT COUNT(*) FROM internal_applications a WHERE a.opportunity_id = o.id) AS applicant_count
       FROM internal_opportunities o
       LEFT JOIN users u ON u.id = o.posted_by
       WHERE o.tenant_id = $1
       ORDER BY
         CASE o.status
           WHEN 'open' THEN 1
           WHEN 'draft' THEN 2
           WHEN 'closed' THEN 3
           WHEN 'filled' THEN 4
         END,
         o.created_at DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

/**
 * GET /api/opportunities/:id
 * Get a single opportunity by ID.
 * All employees can view open opportunities; HR/Admin can view any status.
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const isHR = ['Admin', 'Manager'].includes(req.user.role_name);

    /* Fetch the opportunity with poster name */
    const result = await db.query(
      `SELECT o.*,
              u.full_name AS posted_by_name
       FROM internal_opportunities o
       LEFT JOIN users u ON u.id = o.posted_by
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const opportunity = result.rows[0];

    /* Non-HR users can only see open opportunities */
    if (!isHR && opportunity.status !== 'open') {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    /* Check if current user has already applied */
    const appCheck = await db.query(
      `SELECT id, status, created_at FROM internal_applications
       WHERE opportunity_id = $1 AND applicant_id = $2`,
      [id, req.user.id]
    );

    opportunity.my_application = appCheck.rows[0] || null;

    res.json(opportunity);
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

/**
 * POST /api/opportunities
 * Create a new opportunity (draft status) — HR/Admin only.
 */
router.post('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      title, department, location, employment_type,
      description, requirements,
      salary_range_min, salary_range_max, show_salary, closes_at
    } = req.body;

    /* Validate required fields */
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await db.query(
      `INSERT INTO internal_opportunities
        (tenant_id, title, department, location, employment_type,
         description, requirements, salary_range_min, salary_range_max,
         show_salary, closes_at, posted_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
       RETURNING *`,
      [
        tenantId, title.trim(), department || null, location || null,
        employment_type || null, description || null, requirements || null,
        salary_range_min || null, salary_range_max || null,
        show_salary || false, closes_at || null, req.user.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating opportunity:', error);
    res.status(500).json({ error: 'Failed to create opportunity' });
  }
});

/**
 * PUT /api/opportunities/:id
 * Update an existing opportunity — HR/Admin only.
 * Cannot edit opportunities that are closed or filled.
 */
router.put('/:id', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const {
      title, department, location, employment_type,
      description, requirements,
      salary_range_min, salary_range_max, show_salary, closes_at
    } = req.body;

    /* Check opportunity exists and is editable */
    const existing = await db.query(
      `SELECT status FROM internal_opportunities WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    if (['closed', 'filled'].includes(existing.rows[0].status)) {
      return res.status(400).json({ error: 'Cannot edit a closed or filled opportunity' });
    }

    const result = await db.query(
      `UPDATE internal_opportunities SET
        title = COALESCE($3, title),
        department = $4,
        location = $5,
        employment_type = $6,
        description = $7,
        requirements = $8,
        salary_range_min = $9,
        salary_range_max = $10,
        show_salary = COALESCE($11, show_salary),
        closes_at = $12,
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        id, tenantId, title?.trim() || null, department || null,
        location || null, employment_type || null,
        description || null, requirements || null,
        salary_range_min || null, salary_range_max || null,
        show_salary, closes_at || null
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating opportunity:', error);
    res.status(500).json({ error: 'Failed to update opportunity' });
  }
});

/**
 * DELETE /api/opportunities/:id
 * Delete an opportunity — HR/Admin only.
 * Only draft opportunities can be deleted (open/closed/filled are preserved).
 */
router.delete('/:id', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    /* Only allow deletion of drafts */
    const result = await db.query(
      `DELETE FROM internal_opportunities
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
       RETURNING id`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Only draft opportunities can be deleted' });
    }

    res.json({ message: 'Opportunity deleted' });
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    res.status(500).json({ error: 'Failed to delete opportunity' });
  }
});

/**
 * POST /api/opportunities/:id/publish
 * Publish a draft opportunity (draft → open) — HR/Admin only.
 * Sets posted_at timestamp and status to 'open'.
 */
router.post('/:id/publish', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const result = await db.query(
      `UPDATE internal_opportunities
       SET status = 'open', posted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
       RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Only draft opportunities can be published' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error publishing opportunity:', error);
    res.status(500).json({ error: 'Failed to publish opportunity' });
  }
});

/**
 * POST /api/opportunities/:id/close
 * Close an open opportunity — HR/Admin only.
 * Accepts optional { filled: true } to mark as filled instead of just closed.
 */
router.post('/:id/close', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const newStatus = req.body.filled ? 'filled' : 'closed';

    const result = await db.query(
      `UPDATE internal_opportunities
       SET status = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'open'
       RETURNING *`,
      [id, tenantId, newStatus]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Only open opportunities can be closed' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error closing opportunity:', error);
    res.status(500).json({ error: 'Failed to close opportunity' });
  }
});

// =====================================================
// APPLICATION ENDPOINTS
// =====================================================

/**
 * GET /api/opportunities/:id/applications
 * List all applications for an opportunity — HR/Admin only.
 * Includes applicant name, email, and application details.
 */
router.get('/:id/applications', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    /* Verify opportunity belongs to this tenant */
    const oppCheck = await db.query(
      `SELECT id FROM internal_opportunities WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    /* Fetch applications with applicant details */
    const result = await db.query(
      `SELECT a.*,
              u.full_name AS applicant_name,
              u.email AS applicant_email,
              u.role_name AS applicant_role,
              r.full_name AS reviewed_by_name
       FROM internal_applications a
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN users r ON r.id = a.reviewed_by
       WHERE a.opportunity_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC`,
      [id, tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

/**
 * GET /api/applications/mine
 * List all applications submitted by the current user.
 * Includes opportunity title and status. Does NOT include HR notes.
 */
router.get('/applications/mine', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT a.id, a.opportunity_id, a.cover_letter, a.status,
              a.created_at, a.updated_at,
              o.title AS opportunity_title,
              o.department AS opportunity_department,
              o.status AS opportunity_status
       FROM internal_applications a
       JOIN internal_opportunities o ON o.id = a.opportunity_id
       WHERE a.applicant_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC`,
      [userId, tenantId]
    );

    /* Explicitly exclude notes — they are HR-internal */
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching my applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

/**
 * POST /api/applications
 * Submit an application to an open opportunity.
 * Enforces one-application-per-opportunity constraint.
 */
router.post('/applications', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { opportunity_id, cover_letter } = req.body;

    if (!opportunity_id) {
      return res.status(400).json({ error: 'Opportunity ID is required' });
    }

    /* Verify the opportunity is open and belongs to this tenant */
    const oppCheck = await db.query(
      `SELECT id, closes_at FROM internal_opportunities
       WHERE id = $1 AND tenant_id = $2 AND status = 'open'`,
      [opportunity_id, tenantId]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Opportunity is not open for applications' });
    }

    /* Check if deadline has passed */
    const opp = oppCheck.rows[0];
    if (opp.closes_at && new Date(opp.closes_at) < new Date()) {
      return res.status(400).json({ error: 'Application deadline has passed' });
    }

    /* Check for duplicate application (belt-and-braces; UNIQUE constraint also enforces) */
    const dupCheck = await db.query(
      `SELECT id FROM internal_applications
       WHERE opportunity_id = $1 AND applicant_id = $2`,
      [opportunity_id, userId]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'You have already applied to this opportunity' });
    }

    /* Insert the application */
    const result = await db.query(
      `INSERT INTO internal_applications
        (tenant_id, opportunity_id, applicant_id, cover_letter, status)
       VALUES ($1, $2, $3, $4, 'submitted')
       RETURNING *`,
      [tenantId, opportunity_id, userId, cover_letter || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    /* Handle unique constraint violation gracefully */
    if (error.code === '23505') {
      return res.status(409).json({ error: 'You have already applied to this opportunity' });
    }
    console.error('Error submitting application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

/**
 * PUT /api/applications/:id/status
 * Update an application's status — HR/Admin only.
 * Also records reviewer and optional internal notes.
 */
router.put('/applications/:id/status', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { status, notes } = req.body;

    /* Validate status value */
    const validStatuses = ['submitted', 'reviewing', 'shortlisted', 'interview', 'offered', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    /* Update the application */
    const result = await db.query(
      `UPDATE internal_applications SET
        status = $3,
        reviewed_by = $4,
        reviewed_at = NOW(),
        notes = COALESCE($5, notes),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, status, req.user.id, notes || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ error: 'Failed to update application status' });
  }
});

/**
 * PUT /api/applications/:id/withdraw
 * Withdraw own application — applicant only.
 * Can withdraw at any stage before 'accepted'.
 */
router.put('/applications/:id/withdraw', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { id } = req.params;

    /* Verify ownership and that it's not already accepted/withdrawn */
    const appCheck = await db.query(
      `SELECT status FROM internal_applications
       WHERE id = $1 AND applicant_id = $2 AND tenant_id = $3`,
      [id, userId, tenantId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const currentStatus = appCheck.rows[0].status;
    if (currentStatus === 'accepted') {
      return res.status(400).json({ error: 'Cannot withdraw an accepted application' });
    }
    if (currentStatus === 'withdrawn') {
      return res.status(400).json({ error: 'Application is already withdrawn' });
    }

    /* Withdraw the application */
    const result = await db.query(
      `UPDATE internal_applications SET
        status = 'withdrawn', updated_at = NOW()
       WHERE id = $1 AND applicant_id = $2 AND tenant_id = $3
       RETURNING *`,
      [id, userId, tenantId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error withdrawing application:', error);
    res.status(500).json({ error: 'Failed to withdraw application' });
  }
});

module.exports = router;
