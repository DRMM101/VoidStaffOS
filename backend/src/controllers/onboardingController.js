/**
 * HeadOfficeOS - Onboarding Controller
 * Manages the three-stage onboarding process.
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

const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { createNotification } = require('./notificationController');

// ============================================
// START DATE NOTIFICATIONS
// ============================================

/**
 * Check for upcoming start dates and create notifications at 7, 5, 3, 2, 1 days
 * This is called when the onboarding dashboard is accessed
 */
async function checkUpcomingStartDates(tenantId, userId) {
  const alertDays = [7, 5, 3, 2, 1, 0]; // Days before start to send alerts

  try {
    // Get candidates/pre-colleagues with upcoming start dates
    const result = await pool.query(`
      SELECT id, full_name, proposed_start_date, stage
      FROM candidates
      WHERE tenant_id = $1
        AND stage IN ('candidate', 'pre_colleague')
        AND proposed_start_date IS NOT NULL
        AND proposed_start_date >= CURRENT_DATE
        AND proposed_start_date <= CURRENT_DATE + INTERVAL '7 days'
    `, [tenantId]);

    for (const candidate of result.rows) {
      const startDate = new Date(candidate.proposed_start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      const daysUntil = Math.round((startDate - today) / (1000 * 60 * 60 * 24));

      if (alertDays.includes(daysUntil)) {
        // Check if we already sent this notification today
        const existingNotif = await pool.query(`
          SELECT id FROM notifications
          WHERE tenant_id = $1
            AND type = 'onboarding_reminder'
            AND related_id = $2
            AND DATE(created_at) = CURRENT_DATE
            AND message LIKE $3
        `, [tenantId, candidate.id, `%${daysUntil} day%`]);

        if (existingNotif.rows.length === 0) {
          // Get HR users to notify
          const hrUsers = await pool.query(`
            SELECT u.id FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.tenant_id = $1
              AND (r.role_name = 'Admin' OR r.onboarding_full = true)
              AND u.employment_status = 'active'
          `, [tenantId]);

          let message;
          if (daysUntil === 0) {
            message = `🚨 TODAY: ${candidate.full_name} is starting today!`;
          } else if (daysUntil === 1) {
            message = `⚠️ TOMORROW: ${candidate.full_name} is starting tomorrow!`;
          } else {
            message = `📅 ${candidate.full_name} is starting in ${daysUntil} days (${startDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })})`;
          }

          for (const user of hrUsers.rows) {
            try {
              await createNotification(
                tenantId,
                user.id,
                'onboarding_reminder',
                message,
                candidate.id
              );
            } catch (notifErr) {
              console.error('Failed to create start date notification:', notifErr.message);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Check upcoming start dates error:', error.message);
    // Don't throw - this is a background check
  }
}

// ============================================
// CANDIDATES
// ============================================

/**
 * Check if user has onboarding permissions
 */
async function checkOnboardingPermissions(roleId, roleName) {
  if (roleName === 'Admin') {
    return { full: true, postChecks: true };
  }
  const result = await pool.query(
    `SELECT onboarding_full, onboarding_post_checks FROM roles WHERE id = $1`,
    [roleId]
  );
  return {
    full: result.rows[0]?.onboarding_full || false,
    postChecks: result.rows[0]?.onboarding_post_checks || false
  };
}

/**
 * Create a new candidate
 */
async function createCandidate(req, res) {
  try {
    const { role_name, role_id, id: userId } = req.user;

    // Check permissions - Admin or HR (onboarding_full) can create candidates
    const permissions = await checkOnboardingPermissions(role_id, role_name);
    if (!permissions.full) {
      return res.status(403).json({ error: 'You do not have permission to create candidates' });
    }

    const {
      full_name, email, phone, address_line1, address_line2, city, postcode,
      dob, proposed_start_date, proposed_role_id, proposed_tier,
      proposed_salary, proposed_hours, skills_experience, notes,
      recruitment_request_id
    } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }

    // Check if email already exists
    const existingCandidate = await pool.query(
      'SELECT id FROM candidates WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existingCandidate.rows.length > 0) {
      return res.status(409).json({ error: 'A candidate with this email already exists' });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Validate recruitment request if provided
    if (recruitment_request_id) {
      const reqResult = await pool.query(
        'SELECT status FROM recruitment_requests WHERE id = $1',
        [recruitment_request_id]
      );
      if (reqResult.rows.length === 0) {
        return res.status(400).json({ error: 'Recruitment request not found' });
      }
      if (reqResult.rows[0].status !== 'approved') {
        return res.status(400).json({ error: 'Recruitment request must be approved before adding candidates' });
      }
    }

    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO candidates (
        tenant_id, full_name, email, phone, address_line1, address_line2, city, postcode,
        dob, proposed_start_date, proposed_role_id, proposed_tier,
        proposed_salary, proposed_hours, skills_experience, notes, created_by, recruitment_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        tenantId, full_name, email.toLowerCase(), phone, address_line1, address_line2, city, postcode,
        dob || null, proposed_start_date || null, proposed_role_id || null, proposed_tier || null,
        proposed_salary || null, proposed_hours || 40.0, skills_experience || null, notes || null, userId,
        recruitment_request_id || null
      ]
    );

    // Create default background checks
    const defaultChecks = [
      { type: 'right_to_work', required: true },
      { type: 'dbs_basic', required: true }
    ];

    for (const check of defaultChecks) {
      await pool.query(
        `INSERT INTO background_checks (tenant_id, candidate_id, check_type, required) VALUES ($1, $2, $3, $4)`,
        [tenantId, result.rows[0].id, check.type, check.required]
      );
    }

    res.status(201).json({
      message: 'Candidate created successfully',
      candidate: result.rows[0]
    });
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({ error: 'Failed to create candidate' });
  }
}

/**
 * Get all candidates with optional stage filter
 *
 * Access Control:
 * - Admin/HR (onboarding_full): See all candidates at all stages
 * - Hiring Manager (onboarding_post_checks): Only see candidates where all required checks are cleared
 */
async function getCandidates(req, res) {
  try {
    const { role_name, role_id } = req.user;

    // Check permissions
    const permissions = await checkOnboardingPermissions(role_id, role_name);
    if (!permissions.full && !permissions.postChecks) {
      return res.status(403).json({ error: 'You do not have permission to view candidates' });
    }

    const { stage } = req.query;

    let query = `
      SELECT c.*, r.role_name as proposed_role_name,
             (SELECT COUNT(*) FROM candidate_references cr WHERE cr.candidate_id = c.id AND cr.status = 'verified') as verified_refs,
             (SELECT COUNT(*) FROM background_checks bc WHERE bc.candidate_id = c.id AND bc.required = true AND bc.status != 'cleared') as pending_required_checks,
             (SELECT COUNT(*) FROM onboarding_tasks ot WHERE ot.candidate_id = c.id AND ot.required_before_start = true AND ot.status != 'completed') as pending_required_tasks,
             (SELECT pp.status FROM probation_periods pp WHERE pp.employee_id = c.user_id AND pp.status IN ('active', 'extended') ORDER BY pp.created_at DESC LIMIT 1) as probation_status
      FROM candidates c
      LEFT JOIN roles r ON c.proposed_role_id = r.id
    `;

    const params = [];
    let paramIndex = 1;
    const conditions = [];

    // For Hiring Managers (post_checks only), only show candidates with all required checks cleared
    if (!permissions.full && permissions.postChecks) {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM background_checks bc
        WHERE bc.candidate_id = c.id AND bc.required = true AND bc.status != 'cleared'
      )`);
    }

    if (stage) {
      conditions.push(`c.stage = $${paramIndex}`);
      params.push(stage);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);

    // For Hiring Managers, redact sensitive contact details
    let candidates = result.rows;
    if (!permissions.full && permissions.postChecks) {
      candidates = candidates.map(c => ({
        ...c,
        phone: null,
        address_line1: null,
        address_line2: null,
        city: null,
        dob: null
        // Keep postcode for location reference
      }));
    }

    // Get counts by stage
    const countResult = await pool.query(`
      SELECT stage, COUNT(*) as count FROM candidates GROUP BY stage
    `);
    const counts = {
      candidate: 0,
      pre_colleague: 0,
      active: 0
    };
    countResult.rows.forEach(row => {
      counts[row.stage] = parseInt(row.count);
    });

    // Check for upcoming start dates and create notifications (background task)
    const tenantId = req.session?.tenantId || 1;
    checkUpcomingStartDates(tenantId, req.user.id).catch(err => {
      console.error('Background start date check failed:', err.message);
    });

    res.json({
      candidates,
      counts
    });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
}

/**
 * Get single candidate with all related data
 */
async function getCandidate(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { id } = req.params;

    // Get candidate
    const candidateResult = await pool.query(
      `SELECT c.*, r.role_name as proposed_role_name,
              u.full_name as created_by_name,
              m.full_name as manager_name, m.email as manager_email
       FROM candidates c
       LEFT JOIN roles r ON c.proposed_role_id = r.id
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN users m ON c.user_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM users usr WHERE usr.id = c.user_id AND usr.manager_id = m.id
       )
       WHERE c.id = $1`,
      [id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = candidateResult.rows[0];

    // Check permissions
    if (role_name !== 'Admin') {
      // Manager can only see their assigned pre-colleagues
      if (role_name === 'Manager') {
        if (candidate.stage === 'candidate') {
          return res.status(403).json({ error: 'Managers cannot view candidates' });
        }
        // Check if this pre-colleague is assigned to the manager
        const assignedCheck = await pool.query(
          'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
          [candidate.user_id, userId]
        );
        if (assignedCheck.rows.length === 0) {
          return res.status(403).json({ error: 'You can only view your assigned pre-colleagues' });
        }
        // Redact contact info for managers
        candidate.address_line1 = null;
        candidate.address_line2 = null;
        candidate.city = null;
        candidate.phone = null;
        // Keep postcode
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Get references
    const refsResult = await pool.query(
      `SELECT * FROM candidate_references WHERE candidate_id = $1 ORDER BY created_at`,
      [id]
    );

    // Get background checks
    const checksResult = await pool.query(
      `SELECT * FROM background_checks WHERE candidate_id = $1 ORDER BY required DESC, created_at`,
      [id]
    );

    // Get onboarding tasks
    const tasksResult = await pool.query(
      `SELECT * FROM onboarding_tasks WHERE candidate_id = $1 ORDER BY required_before_start DESC, due_date`,
      [id]
    );

    // Get policy acknowledgments
    const policiesResult = await pool.query(
      `SELECT p.*,
              CASE WHEN pa.id IS NOT NULL THEN true ELSE false END as acknowledged,
              pa.acknowledged_at
       FROM policies p
       LEFT JOIN policy_acknowledgments pa ON p.id = pa.policy_id
         AND (pa.candidate_id = $1 OR pa.user_id = $2)
       WHERE p.status = 'published' AND p.requires_acknowledgment = true
       ORDER BY p.title`,
      [id, candidate.user_id]
    );

    // Get day one items
    const dayOneResult = await pool.query(
      `SELECT * FROM day_one_items WHERE candidate_id = $1 ORDER BY sort_order, time_slot`,
      [id]
    );

    res.json({
      candidate,
      references: refsResult.rows,
      background_checks: checksResult.rows,
      onboarding_tasks: tasksResult.rows,
      policies: policiesResult.rows,
      day_one_items: dayOneResult.rows
    });
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
}

/**
 * Update candidate details
 */
async function updateCandidate(req, res) {
  try {
    const { role_name } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can update candidates' });
    }

    const {
      full_name, email, phone, address_line1, address_line2, city, postcode,
      dob, proposed_start_date, proposed_role_id, proposed_tier,
      proposed_salary, proposed_hours, skills_experience, notes,
      contract_signed, contract_signed_date
    } = req.body;

    // Check candidate exists
    const existing = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const result = await pool.query(
      `UPDATE candidates SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        address_line1 = COALESCE($4, address_line1),
        address_line2 = $5,
        city = COALESCE($6, city),
        postcode = COALESCE($7, postcode),
        dob = COALESCE($8, dob),
        proposed_start_date = COALESCE($9, proposed_start_date),
        proposed_role_id = COALESCE($10, proposed_role_id),
        proposed_tier = $11,
        proposed_salary = COALESCE($12, proposed_salary),
        proposed_hours = COALESCE($13, proposed_hours),
        skills_experience = COALESCE($14, skills_experience),
        notes = $15,
        contract_signed = COALESCE($16, contract_signed),
        contract_signed_date = $17,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
      RETURNING *`,
      [
        full_name, email?.toLowerCase(), phone, address_line1, address_line2, city, postcode,
        dob, proposed_start_date, proposed_role_id, proposed_tier,
        proposed_salary, proposed_hours, skills_experience, notes,
        contract_signed, contract_signed_date, id
      ]
    );

    res.json({
      message: 'Candidate updated successfully',
      candidate: result.rows[0]
    });
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
}

// ============================================
// REFERENCES
// ============================================

/**
 * Add a reference to a candidate
 */
async function addReference(req, res) {
  try {
    const { role_name } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can add references' });
    }

    const { reference_name, reference_company, reference_email, reference_phone, relationship } = req.body;

    if (!reference_name) {
      return res.status(400).json({ error: 'Reference name is required' });
    }

    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO candidate_references
        (tenant_id, candidate_id, reference_name, reference_company, reference_email, reference_phone, relationship)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, id, reference_name, reference_company, reference_email, reference_phone, relationship]
    );

    res.status(201).json({
      message: 'Reference added',
      reference: result.rows[0]
    });
  } catch (error) {
    console.error('=== ADD REFERENCE ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    console.error('Full:', error);
    res.status(500).json({ error: 'Failed to add reference' });
  }
}

/**
 * Update reference status
 */
async function updateReference(req, res) {
  try {
    const { role_name } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can update references' });
    }

    const { status, reference_notes, received_date } = req.body;

    const result = await pool.query(
      `UPDATE candidate_references SET
        status = COALESCE($1, status),
        reference_notes = COALESCE($2, reference_notes),
        received_date = COALESCE($3, received_date),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, reference_notes, received_date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    res.json({
      message: 'Reference updated',
      reference: result.rows[0]
    });
  } catch (error) {
    console.error('Update reference error:', error);
    res.status(500).json({ error: 'Failed to update reference' });
  }
}

// ============================================
// BACKGROUND CHECKS
// ============================================

/**
 * Add a background check
 */
async function addBackgroundCheck(req, res) {
  try {
    const { role_name } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can add background checks' });
    }

    const { check_type, check_type_other, required } = req.body;

    if (!check_type) {
      return res.status(400).json({ error: 'Check type is required' });
    }

    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO background_checks
        (tenant_id, candidate_id, check_type, check_type_other, required)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, id, check_type, check_type_other, required !== false]
    );

    res.status(201).json({
      message: 'Background check added',
      check: result.rows[0]
    });
  } catch (error) {
    console.error('=== ADD BACKGROUND CHECK ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    console.error('Full:', error);
    res.status(500).json({ error: 'Failed to add background check' });
  }
}

/**
 * Update background check status
 */
async function updateBackgroundCheck(req, res) {
  try {
    const { role_name } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can update background checks' });
    }

    const { status, submitted_date, completed_date, certificate_number, expiry_date, notes } = req.body;

    const result = await pool.query(
      `UPDATE background_checks SET
        status = COALESCE($1, status),
        submitted_date = COALESCE($2, submitted_date),
        completed_date = COALESCE($3, completed_date),
        certificate_number = COALESCE($4, certificate_number),
        expiry_date = COALESCE($5, expiry_date),
        notes = COALESCE($6, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [status, submitted_date, completed_date, certificate_number, expiry_date, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Background check not found' });
    }

    res.json({
      message: 'Background check updated',
      check: result.rows[0]
    });
  } catch (error) {
    console.error('Update background check error:', error);
    res.status(500).json({ error: 'Failed to update background check' });
  }
}

// ============================================
// PROMOTION STATUS & STAGE GATES
// ============================================

/**
 * Get promotion status - what's complete and what's missing
 */
async function getPromotionStatus(req, res) {
  try {
    const { role_name } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can view promotion status' });
    }

    const candidate = await pool.query(
      `SELECT c.*, r.role_name as proposed_role_name
       FROM candidates c
       LEFT JOIN roles r ON c.proposed_role_id = r.id
       WHERE c.id = $1`,
      [id]
    );

    if (candidate.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const c = candidate.rows[0];
    const status = await calculatePromotionStatus(id, c.stage);

    res.json(status);
  } catch (error) {
    console.error('Get promotion status error:', error);
    res.status(500).json({ error: 'Failed to get promotion status' });
  }
}

/**
 * Calculate what's needed for promotion
 */
async function calculatePromotionStatus(candidateId, currentStage) {
  const status = {
    current_stage: currentStage,
    next_stage: currentStage === 'candidate' ? 'pre_colleague' : (currentStage === 'pre_colleague' ? 'active' : null),
    can_promote: false,
    requirements: [],
    completed: [],
    missing: []
  };

  if (currentStage === 'candidate') {
    // Requirements for Candidate → Pre-Colleague

    // 1. At least 2 verified references
    const refsResult = await pool.query(
      `SELECT COUNT(*) as count FROM candidate_references
       WHERE candidate_id = $1 AND status = 'verified'`,
      [candidateId]
    );
    const verifiedRefs = parseInt(refsResult.rows[0].count);
    const refReq = { name: 'Verified references (minimum 2)', required: 2, current: verifiedRefs };
    status.requirements.push(refReq);
    if (verifiedRefs >= 2) {
      status.completed.push('2+ references verified');
    } else {
      status.missing.push(`Need ${2 - verifiedRefs} more verified reference(s)`);
    }

    // 2. All required background checks cleared
    const checksResult = await pool.query(
      `SELECT check_type, status, required FROM background_checks
       WHERE candidate_id = $1 AND required = true`,
      [candidateId]
    );
    const allChecksCleared = checksResult.rows.every(c => c.status === 'cleared');
    const pendingChecks = checksResult.rows.filter(c => c.status !== 'cleared');

    status.requirements.push({
      name: 'All required background checks cleared',
      checks: checksResult.rows.map(c => ({ type: c.check_type, status: c.status }))
    });

    if (allChecksCleared && checksResult.rows.length > 0) {
      status.completed.push('All required background checks cleared');
    } else if (checksResult.rows.length === 0) {
      status.missing.push('No background checks configured');
    } else {
      pendingChecks.forEach(c => {
        status.missing.push(`${formatCheckType(c.check_type)} not cleared (${c.status})`);
      });
    }

    // 3. Contract details complete
    const candidate = await pool.query(
      `SELECT proposed_role_id, proposed_tier, proposed_salary, proposed_hours, proposed_start_date
       FROM candidates WHERE id = $1`,
      [candidateId]
    );
    const c = candidate.rows[0];
    const contractComplete = c.proposed_role_id && c.proposed_salary && c.proposed_hours && c.proposed_start_date;

    status.requirements.push({
      name: 'Contract details complete',
      fields: {
        role: !!c.proposed_role_id,
        salary: !!c.proposed_salary,
        hours: !!c.proposed_hours,
        start_date: !!c.proposed_start_date
      }
    });

    if (contractComplete) {
      status.completed.push('Contract details complete');
    } else {
      const missing = [];
      if (!c.proposed_role_id) missing.push('role');
      if (!c.proposed_salary) missing.push('salary');
      if (!c.proposed_hours) missing.push('hours');
      if (!c.proposed_start_date) missing.push('start date');
      status.missing.push(`Missing contract details: ${missing.join(', ')}`);
    }

    // 4. Contract signed
    const signedResult = await pool.query(
      `SELECT contract_signed, contract_signed_date FROM candidates WHERE id = $1`,
      [candidateId]
    );
    const signed = signedResult.rows[0];

    status.requirements.push({
      name: 'Contract signed',
      signed: signed.contract_signed,
      signed_date: signed.contract_signed_date
    });

    if (signed.contract_signed) {
      status.completed.push('Contract signed');
    } else {
      status.missing.push('Contract not signed');
    }

    status.can_promote = status.missing.length === 0;

  } else if (currentStage === 'pre_colleague') {
    // Requirements for Pre-Colleague → Active

    // 1. All required_before_start tasks completed
    const tasksResult = await pool.query(
      `SELECT task_name, status FROM onboarding_tasks
       WHERE candidate_id = $1 AND required_before_start = true`,
      [candidateId]
    );
    const allTasksComplete = tasksResult.rows.every(t => t.status === 'completed');
    const pendingTasks = tasksResult.rows.filter(t => t.status !== 'completed');

    status.requirements.push({
      name: 'All required onboarding tasks completed',
      tasks: tasksResult.rows.map(t => ({ name: t.task_name, status: t.status }))
    });

    if (allTasksComplete && tasksResult.rows.length > 0) {
      status.completed.push('All required tasks completed');
    } else if (tasksResult.rows.length === 0) {
      status.completed.push('No required tasks configured');
    } else {
      pendingTasks.forEach(t => {
        status.missing.push(`Task incomplete: ${t.task_name}`);
      });
    }

    // 2. All policies acknowledged
    const policiesResult = await pool.query(
      `SELECT p.title, pa.id as ack_id
       FROM policies p
       LEFT JOIN policy_acknowledgments pa ON p.id = pa.policy_id AND pa.candidate_id = $1
       WHERE p.status = 'published' AND p.requires_acknowledgment = true`,
      [candidateId]
    );
    const allPoliciesAcked = policiesResult.rows.every(p => p.ack_id);
    const unackedPolicies = policiesResult.rows.filter(p => !p.ack_id);

    status.requirements.push({
      name: 'All policies acknowledged',
      policies: policiesResult.rows.map(p => ({ name: p.title, acknowledged: !!p.ack_id }))
    });

    if (allPoliciesAcked) {
      status.completed.push('All policies acknowledged');
    } else {
      unackedPolicies.forEach(p => {
        status.missing.push(`Policy not acknowledged: ${p.title}`);
      });
    }

    // 3. Arrival confirmed (manual confirmation that person has physically arrived)
    const arrivalResult = await pool.query(
      `SELECT arrival_confirmed, arrival_confirmed_at, proposed_start_date FROM candidates WHERE id = $1`,
      [candidateId]
    );
    const arrivalData = arrivalResult.rows[0];
    const arrivalConfirmed = arrivalData.arrival_confirmed === true;

    status.requirements.push({
      name: 'Arrival confirmed',
      confirmed: arrivalConfirmed,
      confirmed_at: arrivalData.arrival_confirmed_at,
      start_date: arrivalData.proposed_start_date
    });

    if (arrivalConfirmed) {
      status.completed.push('Arrival confirmed');
    } else {
      status.missing.push('Arrival not confirmed - confirm when employee arrives for first day');
    }

    // 4. Background checks still valid
    const checksResult = await pool.query(
      `SELECT check_type, status, expiry_date FROM background_checks
       WHERE candidate_id = $1 AND required = true`,
      [candidateId]
    );
    const checksValid = checksResult.rows.every(c => {
      if (c.status !== 'cleared') return false;
      if (c.expiry_date && new Date(c.expiry_date) < today) return false;
      return true;
    });

    status.requirements.push({
      name: 'Background checks still valid',
      checks: checksResult.rows.map(c => ({
        type: c.check_type,
        status: c.status,
        expired: c.expiry_date && new Date(c.expiry_date) < today
      }))
    });

    if (checksValid) {
      status.completed.push('Background checks valid');
    } else {
      checksResult.rows.forEach(c => {
        if (c.status !== 'cleared') {
          status.missing.push(`${formatCheckType(c.check_type)} not cleared`);
        } else if (c.expiry_date && new Date(c.expiry_date) < today) {
          status.missing.push(`${formatCheckType(c.check_type)} expired`);
        }
      });
    }

    status.can_promote = status.missing.length === 0;
  }

  return status;
}

function formatCheckType(type) {
  const labels = {
    'dbs_basic': 'DBS Basic',
    'dbs_enhanced': 'DBS Enhanced',
    'right_to_work': 'Right to Work',
    'qualification_verify': 'Qualification Verification',
    'other': 'Other Check'
  };
  return labels[type] || type;
}

// ============================================
// PROMOTION
// ============================================

/**
 * Promote candidate to next stage
 */
async function promoteCandidate(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can promote candidates' });
    }

    const candidateResult = await pool.query(
      `SELECT * FROM candidates WHERE id = $1`,
      [id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = candidateResult.rows[0];
    const status = await calculatePromotionStatus(id, candidate.stage);

    if (!status.can_promote) {
      return res.status(400).json({
        error: 'Cannot promote - requirements not met',
        missing: status.missing
      });
    }

    if (candidate.stage === 'candidate') {
      // Promote to pre_colleague
      const tenantId = req.session?.tenantId || 1;
      await promoteToPreColleague(id, candidate, userId, tenantId);

      res.json({
        message: 'Candidate promoted to Pre-Colleague',
        new_stage: 'pre_colleague'
      });

    } else if (candidate.stage === 'pre_colleague') {
      // Promote to active
      await promoteToActive(id, candidate, userId);

      res.json({
        message: 'Pre-Colleague promoted to Active Employee',
        new_stage: 'active'
      });

    } else {
      return res.status(400).json({ error: 'Candidate is already active' });
    }

  } catch (error) {
    console.error('Promote candidate error:', error);
    res.status(500).json({ error: 'Failed to promote candidate' });
  }
}

/**
 * Promote candidate to pre-colleague
 * - Creates user account
 * - Generates onboarding tasks
 * - Sends welcome email (placeholder)
 */
async function promoteToPreColleague(candidateId, candidate, adminId, tenantId = 1) {
  // Generate temporary password
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // Generate employee number
  const empNumResult = await pool.query(
    `SELECT MAX(CAST(SUBSTRING(employee_number FROM 4) AS INTEGER)) as max_num
     FROM users WHERE employee_number LIKE 'EMP%'`
  );
  const nextNum = (empNumResult.rows[0].max_num || 100) + 1;
  const employeeNumber = `EMP${nextNum.toString().padStart(3, '0')}`;

  // Create user account
  const userResult = await pool.query(
    `INSERT INTO users (
      tenant_id, email, full_name, password_hash, role_id, tier, employee_number,
      employment_status, start_date, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)
    RETURNING id`,
    [
      tenantId,
      candidate.email,
      candidate.full_name,
      passwordHash,
      candidate.proposed_role_id,
      candidate.proposed_tier,
      employeeNumber,
      candidate.proposed_start_date,
      adminId
    ]
  );

  const newUserId = userResult.rows[0].id;

  // Link user to candidate and update stage
  await pool.query(
    `UPDATE candidates SET
      stage = 'pre_colleague',
      user_id = $1,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [newUserId, candidateId]
  );

  // Create default onboarding tasks
  const defaultTasks = [
    { name: 'Read Employee Handbook', type: 'document_read', required: true },
    { name: 'Complete emergency contact form', type: 'form_submit', required: true },
    { name: 'Set up IT account', type: 'check_complete', required: true },
    { name: 'Complete health declaration', type: 'form_submit', required: true },
    { name: 'Meet with manager', type: 'meeting', required: false },
    { name: 'Complete induction training', type: 'training', required: false }
  ];

  for (const task of defaultTasks) {
    await pool.query(
      `INSERT INTO onboarding_tasks (tenant_id, candidate_id, task_name, task_type, required_before_start)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, candidateId, task.name, task.type, task.required]
    );
  }

  // Create default Day One items
  const dayOneItems = [
    { time: '09:00', activity: 'Arrive at reception', location: 'Main entrance', meeting_with: 'Reception' },
    { time: '09:15', activity: 'Welcome and building tour', location: 'Office', meeting_with: 'HR' },
    { time: '10:00', activity: 'IT setup and equipment collection', location: 'IT desk', meeting_with: 'IT Support' },
    { time: '11:00', activity: 'Meet your team', location: 'Team area', meeting_with: 'Team members' },
    { time: '12:00', activity: 'Lunch with manager', location: 'Canteen', meeting_with: 'Your manager' },
    { time: '13:30', activity: 'HR paperwork and policies', location: 'HR office', meeting_with: 'HR' },
    { time: '15:00', activity: 'Workstation setup', location: 'Your desk', meeting_with: 'Buddy' },
    { time: '16:30', activity: 'End of day check-in', location: 'Manager office', meeting_with: 'Your manager' }
  ];

  for (let i = 0; i < dayOneItems.length; i++) {
    const item = dayOneItems[i];
    await pool.query(
      `INSERT INTO day_one_items (candidate_id, time_slot, activity, location, meeting_with, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [candidateId, item.time, item.activity, item.location, item.meeting_with, i]
    );
  }

  // TODO: Send welcome email with:
  // - Temp password: tempPassword
  // - Login URL
  // - Handbook link
  // - Start date: candidate.proposed_start_date
  console.log(`[WELCOME EMAIL] To: ${candidate.email}, Temp Password: ${tempPassword}`);

  // Create notification for the new user
  await createNotification(
    newUserId,
    'employee_transferred', // Reusing type, could add 'welcome' type
    'Welcome to HeadOfficeOS',
    'Your account has been created. Please complete your onboarding tasks before your start date.',
    candidateId,
    'candidate',
    tenantId
  );

  return { userId: newUserId, tempPassword };
}

/**
 * Promote pre-colleague to active employee
 */
async function promoteToActive(candidateId, candidate, adminId) {
  // Get tenant_id from candidate
  const tenantId = candidate.tenant_id || 1;

  // Update candidate stage
  await pool.query(
    `UPDATE candidates SET
      stage = 'active',
      actual_start_date = CURRENT_DATE,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [candidateId]
  );

  // Ensure user account is fully active
  await pool.query(
    `UPDATE users SET employment_status = 'active' WHERE id = $1`,
    [candidate.user_id]
  );

  // Auto-create probation period (6 months standard)
  if (candidate.user_id) {
    try {
      const startDate = candidate.proposed_start_date || new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 6);

      // Check if probation already exists
      const existingProbation = await pool.query(
        `SELECT id FROM probation_periods WHERE employee_id = $1 AND status IN ('active', 'extended')`,
        [candidate.user_id]
      );

      if (existingProbation.rows.length === 0) {
        // Create probation period
        const probationResult = await pool.query(`
          INSERT INTO probation_periods (
            tenant_id, employee_id, start_date, end_date, duration_months, status, created_by
          ) VALUES ($1, $2, $3, $4, 6, 'active', $5)
          RETURNING id
        `, [tenantId, candidate.user_id, startDate, endDate, adminId]);

        const probationId = probationResult.rows[0].id;

        // Create review milestones
        const milestones = [
          { type: '1_month', months: 1, number: 1 },
          { type: '3_month', months: 3, number: 2 },
          { type: '6_month', months: 6, number: 3 }
        ];

        for (const m of milestones) {
          const reviewDate = new Date(startDate);
          reviewDate.setMonth(reviewDate.getMonth() + m.months);

          await pool.query(`
            INSERT INTO probation_reviews (
              tenant_id, probation_id, employee_id, review_type, review_number, scheduled_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
          `, [tenantId, probationId, candidate.user_id, m.type, m.number, reviewDate]);
        }

        // Add final review 2 weeks before end
        const finalDate = new Date(endDate);
        finalDate.setDate(finalDate.getDate() - 14);
        await pool.query(`
          INSERT INTO probation_reviews (
            tenant_id, probation_id, employee_id, review_type, review_number, scheduled_date, status
          ) VALUES ($1, $2, $3, 'final', 4, $4, 'pending')
        `, [tenantId, probationId, candidate.user_id, finalDate]);

        console.log(`Created probation period for employee ${candidate.user_id}`);
      }
    } catch (probError) {
      console.error('Error creating probation:', probError);
      // Non-fatal, continue with promotion
    }
  }

  // Create notification (only if user exists)
  if (candidate.user_id) {
    try {
      await createNotification(
        candidate.user_id,
        'kpi_revealed', // Reusing, could add specific type
        'Welcome - You are now active!',
        'Your onboarding is complete. Welcome to the team!',
        candidateId,
        'candidate'
      );
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Non-fatal, continue
    }
  }

  // Log the promotion (skip if audit_log doesn't exist)
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, new_value_json)
       VALUES ($1, 'UPDATE', 'candidates', $2, $3)`,
      [adminId, candidateId, JSON.stringify({ stage: 'active', promoted_at: new Date() })]
    );
  } catch (auditError) {
    // Audit log table may not exist - non-fatal
    console.log('Audit log skipped (table may not exist)');
  }
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ============================================
// ONBOARDING TASKS (Pre-colleague self-service)
// ============================================

/**
 * Get current user's onboarding tasks (for pre-colleagues)
 */
async function getMyTasks(req, res) {
  try {
    const { id: userId } = req.user;

    // Find the candidate record linked to this user
    const candidateResult = await pool.query(
      `SELECT id, stage, proposed_start_date FROM candidates WHERE user_id = $1`,
      [userId]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'No onboarding record found' });
    }

    const candidate = candidateResult.rows[0];

    // Get tasks
    const tasksResult = await pool.query(
      `SELECT * FROM onboarding_tasks WHERE candidate_id = $1 ORDER BY required_before_start DESC, due_date`,
      [candidate.id]
    );

    // Get policies needing acknowledgment
    const policiesResult = await pool.query(
      `SELECT p.*,
              CASE WHEN pa.id IS NOT NULL THEN true ELSE false END as acknowledged,
              pa.acknowledged_at
       FROM policies p
       LEFT JOIN policy_acknowledgments pa ON p.id = pa.policy_id AND pa.candidate_id = $1
       WHERE p.status = 'published' AND p.requires_acknowledgment = true
       ORDER BY p.title`,
      [candidate.id]
    );

    // Get day one plan
    const dayOneResult = await pool.query(
      `SELECT * FROM day_one_items WHERE candidate_id = $1 ORDER BY sort_order, time_slot`,
      [candidate.id]
    );

    // Calculate progress
    const totalRequired = tasksResult.rows.filter(t => t.required_before_start).length;
    const completedRequired = tasksResult.rows.filter(t => t.required_before_start && t.status === 'completed').length;
    const policiesAcked = policiesResult.rows.filter(p => p.acknowledged).length;
    const totalPolicies = policiesResult.rows.length;

    // Days until start
    const today = new Date();
    const startDate = new Date(candidate.proposed_start_date);
    const daysUntilStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));

    res.json({
      stage: candidate.stage,
      start_date: candidate.proposed_start_date,
      days_until_start: daysUntilStart,
      tasks: tasksResult.rows,
      policies: policiesResult.rows,
      day_one_plan: dayOneResult.rows,
      progress: {
        tasks_completed: completedRequired,
        tasks_total: totalRequired,
        policies_acknowledged: policiesAcked,
        policies_total: totalPolicies,
        percentage: totalRequired + totalPolicies > 0
          ? Math.round(((completedRequired + policiesAcked) / (totalRequired + totalPolicies)) * 100)
          : 100
      }
    });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding tasks' });
  }
}

/**
 * Mark a task as complete
 */
async function completeTask(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;

    // Verify this task belongs to the user's candidate record
    const taskResult = await pool.query(
      `SELECT ot.*, c.user_id FROM onboarding_tasks ot
       JOIN candidates c ON ot.candidate_id = c.id
       WHERE ot.id = $1`,
      [id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (taskResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You can only complete your own tasks' });
    }

    const result = await pool.query(
      `UPDATE onboarding_tasks SET
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      message: 'Task completed',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
}

// ============================================
// POLICIES
// ============================================

/**
 * Get all active policies requiring acknowledgment
 */
async function getPolicies(req, res) {
  try {
    const { id: userId } = req.user;

    // Check if user is a pre-colleague
    const candidateResult = await pool.query(
      `SELECT id FROM candidates WHERE user_id = $1`,
      [userId]
    );
    const candidateId = candidateResult.rows[0]?.id;

    const result = await pool.query(
      `SELECT p.*,
              CASE WHEN pa.id IS NOT NULL THEN true ELSE false END as acknowledged,
              pa.acknowledged_at
       FROM policies p
       LEFT JOIN policy_acknowledgments pa ON p.id = pa.policy_id
         AND (pa.user_id = $1 OR pa.candidate_id = $2)
       WHERE p.is_active = true
       ORDER BY p.requires_acknowledgment DESC, p.policy_name`,
      [userId, candidateId]
    );

    res.json({ policies: result.rows });
  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
}

/**
 * Acknowledge a policy
 */
async function acknowledgePolicy(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Get candidate ID if user is a pre-colleague
    const candidateResult = await pool.query(
      `SELECT id FROM candidates WHERE user_id = $1`,
      [userId]
    );
    const candidateId = candidateResult.rows[0]?.id;

    // Check if already acknowledged
    const existing = await pool.query(
      `SELECT id FROM policy_acknowledgments
       WHERE policy_id = $1 AND (user_id = $2 OR candidate_id = $3)`,
      [id, userId, candidateId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Policy already acknowledged' });
    }

    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO policy_acknowledgments (tenant_id, user_id, candidate_id, policy_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, userId, candidateId, id, ipAddress]
    );

    res.json({
      message: 'Policy acknowledged',
      acknowledgment: result.rows[0]
    });
  } catch (error) {
    console.error('Acknowledge policy error:', error);
    res.status(500).json({ error: 'Failed to acknowledge policy' });
  }
}

// ============================================
// DAY ONE PLAN
// ============================================

/**
 * Add day one item (Admin)
 */
async function addDayOneItem(req, res) {
  try {
    const { role_name } = req.user;
    const { id } = req.params;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can add day one items' });
    }

    const { time_slot, activity, location, meeting_with, notes } = req.body;
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO day_one_items (candidate_id, time_slot, activity, location, meeting_with, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, time_slot, activity, location, meeting_with, notes]
    );

    res.status(201).json({
      message: 'Day one item added',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('=== ADD DAY ONE ITEM ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    res.status(500).json({ error: 'Failed to add day one item' });
  }
}

/**
 * Confirm arrival of a pre-colleague
 * This must be done before promoting to active employee
 */
async function confirmArrival(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { id } = req.params;
    const { password } = req.body;

    if (role_name !== 'Admin' && role_name !== 'HR Manager') {
      return res.status(403).json({ error: 'Only Admin or HR can confirm arrival' });
    }

    // Require password confirmation
    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required' });
    }

    // Verify user's password
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check candidate exists and is pre_colleague
    const candidateResult = await pool.query(
      'SELECT id, full_name, stage, arrival_confirmed FROM candidates WHERE id = $1',
      [id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = candidateResult.rows[0];

    if (candidate.stage !== 'pre_colleague') {
      return res.status(400).json({ error: 'Can only confirm arrival for pre-colleagues' });
    }

    if (candidate.arrival_confirmed) {
      return res.status(400).json({ error: 'Arrival already confirmed' });
    }

    // Confirm arrival
    await pool.query(
      `UPDATE candidates SET
        arrival_confirmed = true,
        arrival_confirmed_at = NOW(),
        arrival_confirmed_by = $1
       WHERE id = $2`,
      [userId, id]
    );

    // Get full candidate data for activation
    const fullCandidateResult = await pool.query(
      `SELECT * FROM candidates WHERE id = $1`,
      [id]
    );
    const fullCandidate = fullCandidateResult.rows[0];

    // Auto-activate the employee now they've arrived
    await promoteToActive(id, fullCandidate, userId);

    res.json({
      message: `${candidate.full_name} has arrived and is now active!`,
      confirmed_at: new Date(),
      activated: true
    });

  } catch (error) {
    console.error('Confirm arrival error:', error);
    res.status(500).json({ error: 'Failed to confirm arrival' });
  }
}

module.exports = {
  // Candidates
  createCandidate,
  getCandidates,
  getCandidate,
  updateCandidate,
  // References
  addReference,
  updateReference,
  // Background checks
  addBackgroundCheck,
  updateBackgroundCheck,
  // Promotion
  getPromotionStatus,
  promoteCandidate,
  confirmArrival,
  // Tasks
  getMyTasks,
  completeTask,
  // Policies
  getPolicies,
  acknowledgePolicy,
  // Day One
  addDayOneItem
};
