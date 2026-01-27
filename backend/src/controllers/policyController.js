/**
 * VoidStaffOS - Policy Controller
 * Handles policy management with legally compliant acknowledgment tracking.
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
 * TRADE SECRET: Contains proprietary algorithms.
 *
 * Author: D.R.M. Manthorpe
 * Module: PolicyOS
 */

const pool = require('../config/database');
const auditTrail = require('../utils/auditTrail');
const { notifyPolicyPublished } = require('./notificationController');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * Policy categories for validation
 */
const VALID_CATEGORIES = ['HR', 'Health & Safety', 'Safeguarding', 'Compliance', 'IT', 'Operational'];
const VALID_FREQUENCIES = ['once', 'annual', 'biannual', 'quarterly'];
const VALID_STATUSES = ['draft', 'published', 'archived'];
const VALID_ASSIGNMENT_TYPES = ['all', 'role', 'tier_min', 'tier_max', 'department', 'individual'];

/**
 * Check if user can manage policies (HR Manager role or Tier 60+)
 * @param {Object} user - User object from request
 * @returns {boolean} True if user can manage policies
 */
function canManagePolicies(user) {
  const isHRManager = user.role_name === 'Admin' ||
                      (user.role_name === 'Manager' && user.additional_roles?.includes('HR'));
  const isTier60Plus = user.tier >= 60;
  return isHRManager || isTier60Plus;
}

/**
 * Get all policies
 * GET /api/policies
 */
async function getPolicies(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;
    const { status, category } = req.query;

    let query = `
      SELECT p.*,
             u.full_name as created_by_name,
             pu.full_name as published_by_name,
             (SELECT COUNT(*) FROM policy_assignments pa WHERE pa.policy_id = p.id) as assignment_count,
             (SELECT COUNT(*) FROM policy_acknowledgments pa WHERE pa.policy_id = p.id AND pa.policy_version = p.version) as acknowledgment_count
      FROM policies p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN users pu ON p.published_by = pu.id
      WHERE p.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (status) {
      query += ` AND p.status = $${paramCount++}`;
      params.push(status);
    }

    if (category) {
      query += ` AND p.category = $${paramCount++}`;
      params.push(category);
    }

    query += ` ORDER BY p.updated_at DESC`;

    const result = await pool.query(query, params);

    res.json({ policies: result.rows });
  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
}

/**
 * Get single policy by ID
 * GET /api/policies/:id
 */
async function getPolicyById(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT p.*,
              u.full_name as created_by_name,
              pu.full_name as published_by_name
       FROM policies p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN users pu ON p.published_by = pu.id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Get assignments
    const assignmentsResult = await pool.query(
      `SELECT * FROM policy_assignments WHERE policy_id = $1`,
      [id]
    );

    const policy = result.rows[0];
    policy.assignments = assignmentsResult.rows;

    res.json({ policy });
  } catch (error) {
    console.error('Get policy error:', error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
}

/**
 * Create a new policy
 * POST /api/policies
 */
async function createPolicy(req, res) {
  try {
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can create policies' });
    }

    const {
      title,
      category,
      content,
      summary,
      requires_acknowledgment = true,
      acknowledgment_frequency = 'once',
      acknowledgment_deadline_days,
      assignments = []
    } = req.body;

    // Validation
    if (!title || !category || !content) {
      return res.status(400).json({ error: 'Title, category, and content are required' });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    if (!VALID_FREQUENCIES.includes(acknowledgment_frequency)) {
      return res.status(400).json({ error: 'Invalid acknowledgment frequency' });
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert policy (version_hash is auto-generated by trigger)
      const policyResult = await client.query(
        `INSERT INTO policies (
          tenant_id, title, category, content, summary,
          requires_acknowledgment, acknowledgment_frequency, acknowledgment_deadline_days,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          tenantId, title, category, content, summary,
          requires_acknowledgment, acknowledgment_frequency, acknowledgment_deadline_days || null,
          userId
        ]
      );

      const policy = policyResult.rows[0];

      // Insert assignments
      if (assignments.length > 0) {
        for (const assignment of assignments) {
          if (!VALID_ASSIGNMENT_TYPES.includes(assignment.type)) {
            throw new Error(`Invalid assignment type: ${assignment.type}`);
          }

          await client.query(
            `INSERT INTO policy_assignments (policy_id, assignment_type, assignment_value)
             VALUES ($1, $2, $3)`,
            [policy.id, assignment.type, assignment.value || null]
          );
        }
      } else {
        // Default to all employees
        await client.query(
          `INSERT INTO policy_assignments (policy_id, assignment_type, assignment_value)
           VALUES ($1, 'all', NULL)`,
          [policy.id]
        );
      }

      await client.query('COMMIT');

      // Audit trail
      await auditTrail.logCreate(
        { tenantId, userId },
        req,
        'policy',
        policy.id,
        `Policy: ${title}`,
        { category, requires_acknowledgment }
      );

      res.status(201).json({ message: 'Policy created successfully', policy });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create policy error:', error);
    res.status(500).json({ error: 'Failed to create policy' });
  }
}

/**
 * Update a policy
 * PUT /api/policies/:id
 */
async function updatePolicy(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can update policies' });
    }

    // Check policy exists and is editable
    const existing = await pool.query(
      'SELECT * FROM policies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const oldPolicy = existing.rows[0];

    const {
      title,
      category,
      content,
      summary,
      requires_acknowledgment,
      acknowledgment_frequency,
      acknowledgment_deadline_days,
      assignments
    } = req.body;

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (content !== undefined) { updates.push(`content = $${paramCount++}`); values.push(content); }
    if (summary !== undefined) { updates.push(`summary = $${paramCount++}`); values.push(summary); }
    if (requires_acknowledgment !== undefined) { updates.push(`requires_acknowledgment = $${paramCount++}`); values.push(requires_acknowledgment); }
    if (acknowledgment_frequency !== undefined) {
      if (!VALID_FREQUENCIES.includes(acknowledgment_frequency)) {
        return res.status(400).json({ error: 'Invalid acknowledgment frequency' });
      }
      updates.push(`acknowledgment_frequency = $${paramCount++}`);
      values.push(acknowledgment_frequency);
    }
    if (acknowledgment_deadline_days !== undefined) {
      updates.push(`acknowledgment_deadline_days = $${paramCount++}`);
      values.push(acknowledgment_deadline_days);
    }

    if (updates.length === 0 && !assignments) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let policy = oldPolicy;

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(id);
        values.push(tenantId);

        const result = await client.query(
          `UPDATE policies SET ${updates.join(', ')}
           WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
           RETURNING *`,
          values
        );
        policy = result.rows[0];
      }

      // Update assignments if provided
      if (assignments) {
        await client.query('DELETE FROM policy_assignments WHERE policy_id = $1', [id]);

        for (const assignment of assignments) {
          if (!VALID_ASSIGNMENT_TYPES.includes(assignment.type)) {
            throw new Error(`Invalid assignment type: ${assignment.type}`);
          }

          await client.query(
            `INSERT INTO policy_assignments (policy_id, assignment_type, assignment_value)
             VALUES ($1, $2, $3)`,
            [id, assignment.type, assignment.value || null]
          );
        }
      }

      await client.query('COMMIT');

      // Audit trail
      await auditTrail.logUpdate(
        { tenantId, userId },
        req,
        'policy',
        policy.id,
        `Policy: ${policy.title}`,
        oldPolicy,
        policy
      );

      res.json({ message: 'Policy updated successfully', policy });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update policy error:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
}

/**
 * Publish a policy
 * POST /api/policies/:id/publish
 */
async function publishPolicy(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can publish policies' });
    }

    const result = await pool.query(
      `UPDATE policies
       SET status = 'published', published_at = NOW(), published_by = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND status = 'draft'
       RETURNING *`,
      [userId, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or already published' });
    }

    const policy = result.rows[0];

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'policy',
      policy.id,
      `Policy published: ${policy.title}`,
      { status: 'draft' },
      { status: 'published', published_at: policy.published_at }
    );

    // Send notifications to all users if policy requires acknowledgment
    if (policy.requires_acknowledgment) {
      await notifyPolicyPublished(policy.id, policy.title, policy.category, tenantId);
    }

    res.json({ message: 'Policy published successfully', policy });
  } catch (error) {
    console.error('Publish policy error:', error);
    res.status(500).json({ error: 'Failed to publish policy' });
  }
}

/**
 * Archive a policy
 * POST /api/policies/:id/archive
 */
async function archivePolicy(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can archive policies' });
    }

    const result = await pool.query(
      `UPDATE policies
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status != 'archived'
       RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or already archived' });
    }

    const policy = result.rows[0];

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'policy',
      policy.id,
      `Policy archived: ${policy.title}`,
      { status: 'published' },
      { status: 'archived' }
    );

    res.json({ message: 'Policy archived successfully', policy });
  } catch (error) {
    console.error('Archive policy error:', error);
    res.status(500).json({ error: 'Failed to archive policy' });
  }
}

/**
 * Get pending policies for current user
 * GET /api/policies/pending
 */
async function getPendingPolicies(req, res) {
  try {
    const { id: userId, role_name, tier } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // Find policies assigned to this user that need acknowledgment
    // Note: department-based assignment not yet supported (users table lacks department column)
    const result = await pool.query(
      `SELECT DISTINCT p.*,
              u.full_name as created_by_name,
              (SELECT pa2.acknowledged_at
               FROM policy_acknowledgments pa2
               WHERE pa2.policy_id = p.id
               AND pa2.user_id = $1
               AND pa2.policy_version = p.version
               LIMIT 1) as acknowledged_at
       FROM policies p
       LEFT JOIN users u ON p.created_by = u.id
       JOIN policy_assignments pa ON pa.policy_id = p.id
       WHERE p.tenant_id = $2
         AND p.status = 'published'
         AND p.requires_acknowledgment = true
         AND (
           pa.assignment_type = 'all'
           OR (pa.assignment_type = 'role' AND pa.assignment_value = $3)
           OR (pa.assignment_type = 'tier_min' AND $4 >= CAST(NULLIF(pa.assignment_value, '') AS INTEGER))
           OR (pa.assignment_type = 'tier_max' AND $4 <= CAST(NULLIF(pa.assignment_value, '') AS INTEGER))
           OR (pa.assignment_type = 'individual' AND CAST(NULLIF(pa.assignment_value, '') AS INTEGER) = $1)
         )
       ORDER BY p.published_at DESC`,
      [userId, tenantId, role_name, tier || 0]
    );

    // Filter to only pending (not yet acknowledged current version)
    // Also check frequency requirements
    const now = new Date();
    const pending = [];

    for (const policy of result.rows) {
      if (!policy.acknowledged_at) {
        pending.push(policy);
        continue;
      }

      // Check if re-acknowledgment is needed based on frequency
      const ackDate = new Date(policy.acknowledged_at);
      let needsReack = false;

      switch (policy.acknowledgment_frequency) {
        case 'annual':
          needsReack = (now - ackDate) > 365 * 24 * 60 * 60 * 1000;
          break;
        case 'biannual':
          needsReack = (now - ackDate) > 182 * 24 * 60 * 60 * 1000;
          break;
        case 'quarterly':
          needsReack = (now - ackDate) > 91 * 24 * 60 * 60 * 1000;
          break;
        // 'once' - no re-acknowledgment needed
      }

      if (needsReack) {
        policy.last_acknowledged_at = policy.acknowledged_at;
        policy.acknowledged_at = null;
        pending.push(policy);
      }
    }

    // Calculate deadlines
    for (const policy of pending) {
      if (policy.acknowledgment_deadline_days) {
        const publishDate = new Date(policy.published_at);
        const deadline = new Date(publishDate);
        deadline.setDate(deadline.getDate() + policy.acknowledgment_deadline_days);
        policy.deadline = deadline.toISOString();
        policy.is_overdue = now > deadline;
      }
    }

    res.json({ pending_policies: pending, count: pending.length });
  } catch (error) {
    console.error('Get pending policies error:', error);
    res.status(500).json({ error: 'Failed to fetch pending policies' });
  }
}

/**
 * Acknowledge a policy
 * POST /api/policies/:id/acknowledge
 */
async function acknowledgePolicy(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    const {
      scroll_completed,
      checkbox_confirmed,
      typed_name,
      time_spent_seconds,
      pdf_pages_viewed,
      pdf_total_pages
    } = req.body;

    // Validation
    if (!scroll_completed) {
      return res.status(400).json({ error: 'You must scroll through the entire policy' });
    }

    if (!checkbox_confirmed) {
      return res.status(400).json({ error: 'You must check the acknowledgment checkbox' });
    }

    if (!typed_name || typed_name.trim().length === 0) {
      return res.status(400).json({ error: 'You must type your name as signature' });
    }

    // Get policy
    const policyResult = await pool.query(
      'SELECT * FROM policies WHERE id = $1 AND tenant_id = $2 AND status = $3',
      [id, tenantId, 'published']
    );

    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or not published' });
    }

    const policy = policyResult.rows[0];

    // Check if already acknowledged this version
    const existingAck = await pool.query(
      `SELECT id FROM policy_acknowledgments
       WHERE policy_id = $1 AND user_id = $2 AND policy_version = $3`,
      [id, userId, policy.version]
    );

    if (existingAck.rows.length > 0) {
      return res.status(400).json({ error: 'You have already acknowledged this version of the policy' });
    }

    // Get IP address and user agent
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] ||
                      req.connection?.remoteAddress ||
                      req.socket?.remoteAddress ||
                      '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // For PDF policies, verify all pages were viewed
    if (policy.pdf_filename && pdf_total_pages) {
      if (!pdf_pages_viewed || pdf_pages_viewed < pdf_total_pages) {
        return res.status(400).json({ error: 'You must view all pages of the PDF document' });
      }
    }

    // Insert acknowledgment (immutable record)
    const result = await pool.query(
      `INSERT INTO policy_acknowledgments (
        tenant_id, policy_id, policy_version, version_hash, user_id,
        ip_address, user_agent, scroll_completed, time_spent_seconds,
        checkbox_confirmed, typed_name, pdf_pages_viewed, pdf_total_pages
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        tenantId, id, policy.version, policy.version_hash, userId,
        ipAddress, userAgent, scroll_completed, time_spent_seconds || null,
        checkbox_confirmed, typed_name.trim(), pdf_pages_viewed || null, pdf_total_pages || null
      ]
    );

    const acknowledgment = result.rows[0];

    // Audit trail
    await auditTrail.logCreate(
      { tenantId, userId },
      req,
      'policy_acknowledgment',
      acknowledgment.id,
      `Acknowledged policy: ${policy.title} (v${policy.version})`,
      {
        policy_id: policy.id,
        version: policy.version,
        version_hash: policy.version_hash,
        typed_name
      }
    );

    res.status(201).json({
      message: 'Policy acknowledged successfully',
      acknowledgment: {
        id: acknowledgment.id,
        policy_id: acknowledgment.policy_id,
        policy_version: acknowledgment.policy_version,
        acknowledged_at: acknowledgment.acknowledged_at
      }
    });
  } catch (error) {
    console.error('Acknowledge policy error:', error);
    res.status(500).json({ error: 'Failed to acknowledge policy' });
  }
}

/**
 * Get acknowledgment status for a specific policy
 * GET /api/policies/:id/acknowledgments
 */
async function getPolicyAcknowledgments(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can view acknowledgments' });
    }

    // Get policy info
    const policyResult = await pool.query(
      'SELECT * FROM policies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policy = policyResult.rows[0];

    // Get all acknowledgments
    const acknowledgments = await pool.query(
      `SELECT pa.*, u.full_name, u.email
       FROM policy_acknowledgments pa
       JOIN users u ON pa.user_id = u.id
       WHERE pa.policy_id = $1
       ORDER BY pa.acknowledged_at DESC`,
      [id]
    );

    res.json({
      policy: { id: policy.id, title: policy.title, version: policy.version },
      acknowledgments: acknowledgments.rows
    });
  } catch (error) {
    console.error('Get policy acknowledgments error:', error);
    res.status(500).json({ error: 'Failed to fetch acknowledgments' });
  }
}

/**
 * Get compliance report for all policies
 * GET /api/policies/compliance-report
 */
async function getComplianceReport(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can view compliance reports' });
    }

    // Get total active employees
    const employeeCount = await pool.query(
      `SELECT COUNT(*) as count FROM users
       WHERE tenant_id = $1 AND employment_status = 'active'`,
      [tenantId]
    );
    const totalEmployees = parseInt(employeeCount.rows[0].count);

    // Get policy compliance stats
    const policyStats = await pool.query(
      `SELECT
         p.id,
         p.title,
         p.category,
         p.version,
         p.status,
         p.published_at,
         p.acknowledgment_frequency,
         p.acknowledgment_deadline_days,
         COUNT(DISTINCT pa.user_id) as acknowledged_count,
         (SELECT COUNT(*) FROM policy_assignments pas WHERE pas.policy_id = p.id) as assignment_scope
       FROM policies p
       LEFT JOIN policy_acknowledgments pa ON pa.policy_id = p.id AND pa.policy_version = p.version
       WHERE p.tenant_id = $1 AND p.status = 'published' AND p.requires_acknowledgment = true
       GROUP BY p.id
       ORDER BY p.published_at DESC`,
      [tenantId]
    );

    // Calculate compliance percentages
    const policies = policyStats.rows.map(policy => {
      const complianceRate = totalEmployees > 0
        ? Math.round((policy.acknowledged_count / totalEmployees) * 100)
        : 0;

      return {
        ...policy,
        compliance_rate: complianceRate,
        pending_count: totalEmployees - policy.acknowledged_count
      };
    });

    // Overall stats
    const totalAcknowledgments = await pool.query(
      `SELECT COUNT(*) as count FROM policy_acknowledgments WHERE tenant_id = $1`,
      [tenantId]
    );

    // Get overdue acknowledgments
    const now = new Date();
    const overdueResult = await pool.query(
      `SELECT
         p.id as policy_id,
         p.title as policy_title,
         u.id as user_id,
         u.full_name,
         u.email,
         p.published_at,
         p.acknowledgment_deadline_days,
         (p.published_at + (p.acknowledgment_deadline_days * INTERVAL '1 day')) as deadline
       FROM policies p
       CROSS JOIN users u
       WHERE p.tenant_id = $1
         AND p.status = 'published'
         AND p.requires_acknowledgment = true
         AND p.acknowledgment_deadline_days IS NOT NULL
         AND u.tenant_id = $1
         AND u.employment_status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM policy_acknowledgments pa
           WHERE pa.policy_id = p.id
           AND pa.user_id = u.id
           AND pa.policy_version = p.version
         )
         AND NOW() > (p.published_at + (p.acknowledgment_deadline_days * INTERVAL '1 day'))
       ORDER BY deadline
       LIMIT 50`,
      [tenantId]
    );

    res.json({
      summary: {
        total_employees: totalEmployees,
        total_published_policies: policies.length,
        total_acknowledgments: parseInt(totalAcknowledgments.rows[0].count),
        overdue_count: overdueResult.rows.length
      },
      policies,
      overdue_acknowledgments: overdueResult.rows
    });
  } catch (error) {
    console.error('Get compliance report error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance report' });
  }
}

/**
 * Get policy stats for user dashboard
 * GET /api/policies/my-stats
 */
async function getMyPolicyStats(req, res) {
  try {
    const { id: userId, role_name, tier } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // Get total policies assigned to user
    const assignedResult = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM policies p
       JOIN policy_assignments pa ON pa.policy_id = p.id
       WHERE p.tenant_id = $1
         AND p.status = 'published'
         AND p.requires_acknowledgment = true
         AND (
           pa.assignment_type = 'all'
           OR (pa.assignment_type = 'role' AND pa.assignment_value = $2)
           OR (pa.assignment_type = 'tier_min' AND $3 >= CAST(NULLIF(pa.assignment_value, '') AS INTEGER))
           OR (pa.assignment_type = 'tier_max' AND $3 <= CAST(NULLIF(pa.assignment_value, '') AS INTEGER))
           OR (pa.assignment_type = 'individual' AND CAST(NULLIF(pa.assignment_value, '') AS INTEGER) = $4)
         )`,
      [tenantId, role_name, tier || 0, userId]
    );

    // Get acknowledged policies count
    const acknowledgedResult = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM policies p
       JOIN policy_assignments pa ON pa.policy_id = p.id
       JOIN policy_acknowledgments pack ON pack.policy_id = p.id
         AND pack.user_id = $4
         AND pack.policy_version = p.version
       WHERE p.tenant_id = $1
         AND p.status = 'published'
         AND p.requires_acknowledgment = true
         AND (
           pa.assignment_type = 'all'
           OR (pa.assignment_type = 'role' AND pa.assignment_value = $2)
           OR (pa.assignment_type = 'tier_min' AND $3 >= CAST(NULLIF(pa.assignment_value, '') AS INTEGER))
           OR (pa.assignment_type = 'tier_max' AND $3 <= CAST(NULLIF(pa.assignment_value, '') AS INTEGER))
           OR (pa.assignment_type = 'individual' AND CAST(NULLIF(pa.assignment_value, '') AS INTEGER) = $4)
         )`,
      [tenantId, role_name, tier || 0, userId]
    );

    // Get upcoming re-acknowledgment dates
    const upcomingResult = await pool.query(
      `SELECT p.id, p.title, p.acknowledgment_frequency, pack.acknowledged_at,
              CASE p.acknowledgment_frequency
                WHEN 'annual' THEN pack.acknowledged_at + INTERVAL '1 year'
                WHEN 'biannual' THEN pack.acknowledged_at + INTERVAL '6 months'
                WHEN 'quarterly' THEN pack.acknowledged_at + INTERVAL '3 months'
                ELSE NULL
              END as next_due
       FROM policies p
       JOIN policy_acknowledgments pack ON pack.policy_id = p.id AND pack.user_id = $1 AND pack.policy_version = p.version
       WHERE p.tenant_id = $2
         AND p.status = 'published'
         AND p.acknowledgment_frequency != 'once'
       ORDER BY next_due ASC
       LIMIT 5`,
      [userId, tenantId]
    );

    const totalAssigned = parseInt(assignedResult.rows[0]?.total || 0);
    const totalAcknowledged = parseInt(acknowledgedResult.rows[0]?.total || 0);
    const pendingCount = totalAssigned - totalAcknowledged;

    res.json({
      total_assigned: totalAssigned,
      acknowledged: totalAcknowledged,
      pending: pendingCount,
      compliance_rate: totalAssigned > 0 ? Math.round((totalAcknowledged / totalAssigned) * 100) : 100,
      upcoming_renewals: upcomingResult.rows
    });
  } catch (error) {
    console.error('Get my policy stats error:', error);
    res.status(500).json({ error: 'Failed to fetch policy stats' });
  }
}

/**
 * Get version history for a policy
 * GET /api/policies/:id/versions
 */
async function getPolicyVersions(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.session?.tenantId || 1;

    // Verify policy exists
    const policyResult = await pool.query(
      'SELECT id, title FROM policies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Get version history
    const versions = await pool.query(
      `SELECT pv.*, u.full_name as created_by_name
       FROM policy_versions pv
       LEFT JOIN users u ON pv.created_by = u.id
       WHERE pv.policy_id = $1
       ORDER BY pv.version DESC`,
      [id]
    );

    res.json({
      policy_id: parseInt(id),
      policy_title: policyResult.rows[0].title,
      versions: versions.rows
    });
  } catch (error) {
    console.error('Get policy versions error:', error);
    res.status(500).json({ error: 'Failed to fetch policy versions' });
  }
}

/**
 * Delete a draft policy
 * DELETE /api/policies/:id
 */
async function deletePolicy(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can delete policies' });
    }

    // Only draft policies can be deleted
    const result = await pool.query(
      `DELETE FROM policies
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
       RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or cannot be deleted (only drafts can be deleted)' });
    }

    const policy = result.rows[0];

    // Audit trail
    await auditTrail.logDelete(
      { tenantId, userId },
      req,
      'policy',
      policy.id,
      `Policy deleted: ${policy.title}`,
      policy
    );

    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Delete policy error:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
}

/**
 * Get upload directory for a policy
 * @param {number} tenantId - Tenant ID
 * @param {number} policyId - Policy ID
 * @returns {string} Upload directory path
 */
function getUploadDir(tenantId, policyId) {
  return path.join(__dirname, '..', '..', 'uploads', 'policies', String(tenantId), String(policyId));
}

/**
 * Upload PDF for a policy
 * POST /api/policies/:id/upload-pdf
 */
async function uploadPolicyPdf(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can upload policy PDFs' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      // Remove uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    // Check policy exists
    const policyResult = await pool.query(
      'SELECT * FROM policies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (policyResult.rows.length === 0) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policy = policyResult.rows[0];

    // Create upload directory
    const uploadDir = getUploadDir(tenantId, id);
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const fileExt = path.extname(req.file.originalname);
    const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;
    const destPath = path.join(uploadDir, uniqueFilename);

    // Move file from temp location
    await fs.rename(req.file.path, destPath);

    // Delete old PDF if exists
    if (policy.pdf_filename) {
      const oldPath = path.join(uploadDir, policy.pdf_filename);
      await fs.unlink(oldPath).catch(() => {});
    }

    // Update policy record
    const result = await pool.query(
      `UPDATE policies
       SET pdf_filename = $1, pdf_original_name = $2, pdf_size = $3, pdf_uploaded_at = NOW(), updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [uniqueFilename, req.file.originalname, req.file.size, id, tenantId]
    );

    const updatedPolicy = result.rows[0];

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'policy',
      updatedPolicy.id,
      `PDF uploaded for policy: ${updatedPolicy.title}`,
      { pdf_filename: policy.pdf_filename },
      { pdf_filename: uniqueFilename, pdf_original_name: req.file.originalname }
    );

    res.json({
      message: 'PDF uploaded successfully',
      pdf: {
        filename: uniqueFilename,
        original_name: req.file.originalname,
        size: req.file.size,
        uploaded_at: updatedPolicy.pdf_uploaded_at
      }
    });
  } catch (error) {
    console.error('Upload policy PDF error:', error);
    // Clean up temp file if exists
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
}

/**
 * Serve PDF for a policy
 * GET /api/policies/:id/pdf
 */
async function servePolicyPdf(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // Check policy exists and user has access
    const policyResult = await pool.query(
      'SELECT * FROM policies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policy = policyResult.rows[0];

    if (!policy.pdf_filename) {
      return res.status(404).json({ error: 'No PDF attached to this policy' });
    }

    // For non-published policies, only policy managers can view
    if (policy.status !== 'published' && !canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(getUploadDir(tenantId, id), policy.pdf_filename);

    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'PDF file not found on server' });
    }

    // Set headers and stream file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${policy.pdf_original_name}"`);

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Serve policy PDF error:', error);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
}

/**
 * Delete PDF from a policy
 * DELETE /api/policies/:id/pdf
 */
async function deletePolicyPdf(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    if (!canManagePolicies(req.user)) {
      return res.status(403).json({ error: 'Only HR Managers or Tier 60+ can delete policy PDFs' });
    }

    // Check policy exists
    const policyResult = await pool.query(
      'SELECT * FROM policies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (policyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policy = policyResult.rows[0];

    if (!policy.pdf_filename) {
      return res.status(400).json({ error: 'No PDF attached to this policy' });
    }

    // Delete file
    const filePath = path.join(getUploadDir(tenantId, id), policy.pdf_filename);
    await fs.unlink(filePath).catch(() => {});

    // Update policy record
    await pool.query(
      `UPDATE policies
       SET pdf_filename = NULL, pdf_original_name = NULL, pdf_size = NULL, pdf_uploaded_at = NULL, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'policy',
      policy.id,
      `PDF deleted from policy: ${policy.title}`,
      { pdf_filename: policy.pdf_filename, pdf_original_name: policy.pdf_original_name },
      { pdf_filename: null, pdf_original_name: null }
    );

    res.json({ message: 'PDF deleted successfully' });
  } catch (error) {
    console.error('Delete policy PDF error:', error);
    res.status(500).json({ error: 'Failed to delete PDF' });
  }
}

module.exports = {
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
  deletePolicyPdf,
  canManagePolicies
};
