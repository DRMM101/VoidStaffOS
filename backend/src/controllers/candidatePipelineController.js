/**
 * HeadOfficeOS - Candidate Pipeline Controller
 * Manages the recruitment pipeline workflow.
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

// Valid recruitment stages in order
const RECRUITMENT_STAGES = [
  'application',
  'shortlisted',
  'interview_requested',
  'interview_scheduled',
  'interview_complete',
  'further_assessment',
  'final_shortlist',
  'offer_made',
  'offer_accepted',
  'offer_declined',
  'rejected',
  'withdrawn'
];

// Stage transition rules
const STAGE_TRANSITIONS = {
  application: ['shortlisted', 'rejected', 'withdrawn'],
  shortlisted: ['interview_requested', 'rejected', 'withdrawn'],
  interview_requested: ['interview_scheduled', 'rejected', 'withdrawn'],
  interview_scheduled: ['interview_complete', 'further_assessment', 'final_shortlist', 'rejected', 'withdrawn'],
  interview_complete: ['further_assessment', 'final_shortlist', 'rejected', 'withdrawn'],
  further_assessment: ['interview_scheduled', 'final_shortlist', 'rejected', 'withdrawn'],
  final_shortlist: ['offer_made', 'rejected', 'withdrawn'],
  offer_made: ['offer_accepted', 'offer_declined', 'withdrawn'],
  offer_accepted: [], // Terminal state - moves to onboarding
  offer_declined: ['application', 'shortlisted'],
  rejected: ['application', 'shortlisted'],
  withdrawn: ['application', 'shortlisted']
};

/**
 * Check if user has recruitment permissions
 */
async function checkRecruitmentPermissions(roleId, roleName) {
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

// ============================================
// STAGE TRANSITIONS
// ============================================

/**
 * Move candidate to next stage with validation
 */
async function updateStage(req, res) {
  try {
    const { role_name, role_id, id: userId } = req.user;
    const { id } = req.params;
    const { new_stage, reason } = req.body;

    // Check permissions
    const permissions = await checkRecruitmentPermissions(role_id, role_name);
    if (!permissions.full && !permissions.postChecks) {
      return res.status(403).json({ error: 'You do not have permission to update candidate stages' });
    }

    // Get current candidate
    const candidateResult = await pool.query(
      'SELECT * FROM candidates WHERE id = $1',
      [id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = candidateResult.rows[0];
    const currentStage = candidate.recruitment_stage;

    // Validate stage transition
    if (!RECRUITMENT_STAGES.includes(new_stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    const allowedTransitions = STAGE_TRANSITIONS[currentStage] || [];

    // Admin can force any transition
    if (role_name !== 'Admin' && !allowedTransitions.includes(new_stage)) {
      return res.status(400).json({
        error: `Cannot transition from ${currentStage} to ${new_stage}`,
        allowed_transitions: allowedTransitions
      });
    }

    // Validate stage-specific requirements
    const validation = await validateStageTransition(id, currentStage, new_stage, reason);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Update stage
    await pool.query(
      `UPDATE candidates SET
        recruitment_stage = $1,
        recruitment_stage_updated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [new_stage, id]
    );

    // Record stage history
    const tenantId = req.session?.tenantId || 1;
    await pool.query(
      `INSERT INTO candidate_stage_history (candidate_id, from_stage, to_stage, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, currentStage, new_stage, userId, reason]
    );

    // Add stage change note if reason provided
    if (reason) {
      await pool.query(
        `INSERT INTO candidate_notes (tenant_id, candidate_id, user_id, note_type, content, from_stage, to_stage)
         VALUES ($1, $2, $3, 'stage_change', $4, $5, $6)`,
        [tenantId, id, userId, reason, currentStage, new_stage]
      );
    }

    // Handle special transitions
    if (new_stage === 'rejected' || new_stage === 'withdrawn') {
      const reasonField = new_stage === 'rejected' ? 'rejection_reason' : 'withdrawn_reason';
      await pool.query(
        `UPDATE candidates SET ${reasonField} = $1 WHERE id = $2`,
        [reason, id]
      );
    }

    // If offer accepted, trigger onboarding
    if (new_stage === 'offer_accepted') {
      await triggerOnboarding(id, candidate, userId, tenantId);
    }

    res.json({
      message: `Candidate moved to ${new_stage}`,
      previous_stage: currentStage,
      new_stage
    });
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Failed to update candidate stage' });
  }
}

/**
 * Validate stage transition requirements
 */
async function validateStageTransition(candidateId, fromStage, toStage, reason) {
  // application → shortlisted: Requires screening note
  if (fromStage === 'application' && toStage === 'shortlisted') {
    const notes = await pool.query(
      `SELECT id FROM candidate_notes WHERE candidate_id = $1 AND note_type = 'screening'`,
      [candidateId]
    );
    if (notes.rows.length === 0) {
      return { valid: false, error: 'Screening note required before shortlisting' };
    }
  }

  // interview_scheduled → interview_complete: Requires completed interview with score
  if (fromStage === 'interview_scheduled' && toStage === 'interview_complete') {
    const interviews = await pool.query(
      `SELECT id FROM candidate_interviews
       WHERE candidate_id = $1 AND status = 'completed' AND score IS NOT NULL`,
      [candidateId]
    );
    if (interviews.rows.length === 0) {
      return { valid: false, error: 'At least one interview must be completed and scored' };
    }
  }

  // final_shortlist → offer_made: Requires offer details to be set first
  if (fromStage === 'final_shortlist' && toStage === 'offer_made') {
    const candidate = await pool.query(
      `SELECT offer_salary, offer_start_date FROM candidates WHERE id = $1`,
      [candidateId]
    );
    if (!candidate.rows[0].offer_salary || !candidate.rows[0].offer_start_date) {
      return { valid: false, error: 'Offer details (salary and start date) must be set first' };
    }
  }

  // rejected/withdrawn: Requires reason
  if ((toStage === 'rejected' || toStage === 'withdrawn') && !reason) {
    return { valid: false, error: 'Reason required for rejection or withdrawal' };
  }

  return { valid: true };
}

/**
 * Trigger onboarding when offer is accepted
 */
async function triggerOnboarding(candidateId, candidate, adminId, tenantId = 1) {
  // Get recruitment request to find line manager
  let managerId = null;
  if (candidate.recruitment_request_id) {
    const reqResult = await pool.query(
      'SELECT requested_by FROM recruitment_requests WHERE id = $1',
      [candidate.recruitment_request_id]
    );
    if (reqResult.rows.length > 0) {
      managerId = reqResult.rows[0].requested_by;
    }
  }

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

  // Use offer details if available, fall back to proposed
  const startDate = candidate.offer_start_date || candidate.proposed_start_date;

  // Create user account
  const userResult = await pool.query(
    `INSERT INTO users (
      tenant_id, email, full_name, password_hash, role_id, tier, employee_number,
      employment_status, start_date, manager_id, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)
    RETURNING id`,
    [
      tenantId,
      candidate.email,
      candidate.full_name,
      passwordHash,
      candidate.proposed_role_id,
      candidate.proposed_tier,
      employeeNumber,
      startDate,
      managerId,
      adminId
    ]
  );

  const newUserId = userResult.rows[0].id;

  // Update candidate to pre_colleague stage
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

  // Mark recruitment request as filled if applicable
  if (candidate.recruitment_request_id) {
    await pool.query(
      `UPDATE recruitment_requests SET status = 'filled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [candidate.recruitment_request_id]
    );
  }

  // Notify the new user
  await createNotification(
    newUserId,
    'employee_transferred',
    'Welcome to HeadOfficeOS',
    'Your offer has been accepted! Please complete your onboarding tasks before your start date.',
    candidateId,
    'candidate',
    tenantId
  );

  // Notify the manager if set
  if (managerId) {
    await createNotification(
      managerId,
      'employee_transferred',
      'New Team Member Joining',
      `${candidate.full_name} has accepted the offer and will be joining your team.`,
      candidateId,
      'candidate',
      tenantId
    );
  }

  console.log(`[WELCOME EMAIL] To: ${candidate.email}, Temp Password: ${tempPassword}`);

  return { userId: newUserId, tempPassword };
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Get stage history for a candidate
 */
async function getStageHistory(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT csh.*, u.full_name as changed_by_name
       FROM candidate_stage_history csh
       LEFT JOIN users u ON csh.changed_by = u.id
       WHERE csh.candidate_id = $1
       ORDER BY csh.created_at DESC`,
      [id]
    );

    res.json({ history: result.rows });
  } catch (error) {
    console.error('Get stage history error:', error);
    res.status(500).json({ error: 'Failed to fetch stage history' });
  }
}

// ============================================
// INTERVIEWS
// ============================================

/**
 * Schedule an interview
 */
async function scheduleInterview(req, res) {
  try {
    const { role_name, role_id, id: userId } = req.user;
    const { id } = req.params;

    const permissions = await checkRecruitmentPermissions(role_id, role_name);
    if (!permissions.full && !permissions.postChecks) {
      return res.status(403).json({ error: 'You do not have permission to schedule interviews' });
    }

    const {
      interview_type, scheduled_date, scheduled_time, duration_minutes,
      location, interviewer_ids
    } = req.body;

    if (!interview_type || !scheduled_date || !scheduled_time) {
      return res.status(400).json({ error: 'Interview type, date, and time are required' });
    }

    // Check candidate exists
    const candidate = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candidate.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO candidate_interviews (
        tenant_id, candidate_id, interview_type, scheduled_date, scheduled_time,
        duration_minutes, location, interviewer_ids, scheduled_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId, id, interview_type, scheduled_date, scheduled_time,
        duration_minutes || 60, location, interviewer_ids || [], userId
      ]
    );

    // Auto-transition to interview_requested/scheduled
    const currentStage = candidate.rows[0].recruitment_stage;
    if (currentStage === 'shortlisted') {
      await pool.query(
        `UPDATE candidates SET recruitment_stage = 'interview_requested',
         recruitment_stage_updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
      await pool.query(
        `INSERT INTO candidate_stage_history (candidate_id, from_stage, to_stage, changed_by)
         VALUES ($1, $2, 'interview_requested', $3)`,
        [id, currentStage, userId]
      );
    } else if (currentStage === 'interview_requested') {
      await pool.query(
        `UPDATE candidates SET recruitment_stage = 'interview_scheduled',
         recruitment_stage_updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
      await pool.query(
        `INSERT INTO candidate_stage_history (candidate_id, from_stage, to_stage, changed_by)
         VALUES ($1, $2, 'interview_scheduled', $3)`,
        [id, currentStage, userId]
      );
    }

    // Notify interviewers
    if (interviewer_ids && interviewer_ids.length > 0) {
      for (const interviewerId of interviewer_ids) {
        await createNotification(
          interviewerId,
          'leave_request_pending',
          'Interview Scheduled',
          `You have been assigned to interview ${candidate.rows[0].full_name} on ${scheduled_date} at ${scheduled_time}.`,
          result.rows[0].id,
          'interview',
          tenantId
        );
      }
    }

    res.status(201).json({
      message: 'Interview scheduled',
      interview: result.rows[0]
    });
  } catch (error) {
    console.error('=== SCHEDULE INTERVIEW ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
}

/**
 * Get interviews for a candidate
 */
async function getInterviews(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ci.*,
              (SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name))
               FROM users u WHERE u.id = ANY(ci.interviewer_ids)) as interviewers
       FROM candidate_interviews ci
       WHERE ci.candidate_id = $1
       ORDER BY ci.scheduled_date DESC, ci.scheduled_time DESC`,
      [id]
    );

    res.json({ interviews: result.rows });
  } catch (error) {
    console.error('Get interviews error:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
}

/**
 * Update interview (complete, score, notes)
 */
async function updateInterview(req, res) {
  try {
    const { role_name, role_id, id: userId } = req.user;
    const { id } = req.params;
    const { status, score, notes, recommend_next_stage } = req.body;

    const permissions = await checkRecruitmentPermissions(role_id, role_name);
    if (!permissions.full && !permissions.postChecks) {
      return res.status(403).json({ error: 'You do not have permission to update interviews' });
    }

    // Get interview
    const existing = await pool.query(
      'SELECT * FROM candidate_interviews WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const interview = existing.rows[0];

    // Build update
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (score !== undefined) {
      updates.push(`score = $${paramIndex++}`);
      params.push(score);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    if (recommend_next_stage !== undefined) {
      updates.push(`recommend_next_stage = $${paramIndex++}`);
      params.push(recommend_next_stage);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await pool.query(
      `UPDATE candidate_interviews SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    // If completed with score, update candidate's further_assessment_required
    if (status === 'completed' && recommend_next_stage === false) {
      await pool.query(
        `UPDATE candidates SET further_assessment_required = true WHERE id = $1`,
        [interview.candidate_id]
      );
    }

    // Add interview feedback note
    if (status === 'completed' && notes) {
      const tenantId = req.session?.tenantId || 1;
      await pool.query(
        `INSERT INTO candidate_notes (tenant_id, candidate_id, user_id, note_type, content)
         VALUES ($1, $2, $3, 'interview_feedback', $4)`,
        [tenantId, interview.candidate_id, userId, notes]
      );
    }

    res.json({
      message: 'Interview updated',
      interview: result.rows[0]
    });
  } catch (error) {
    console.error('=== UPDATE INTERVIEW ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    res.status(500).json({ error: 'Failed to update interview' });
  }
}

// ============================================
// NOTES
// ============================================

/**
 * Add a note to a candidate
 */
async function addNote(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;
    const { note_type, content, is_private } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Check candidate exists
    const candidate = await pool.query('SELECT id FROM candidates WHERE id = $1', [id]);
    if (candidate.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `INSERT INTO candidate_notes (tenant_id, candidate_id, user_id, note_type, content, is_private)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, id, userId, note_type || 'general', content, is_private || false]
    );

    res.status(201).json({
      message: 'Note added',
      note: result.rows[0]
    });
  } catch (error) {
    console.error('=== ADD NOTE ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    res.status(500).json({ error: 'Failed to add note' });
  }
}

/**
 * Get notes for a candidate (filtered by visibility)
 */
async function getNotes(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const { id } = req.params;

    let query = `
      SELECT cn.*, u.full_name as author_name
      FROM candidate_notes cn
      JOIN users u ON cn.user_id = u.id
      WHERE cn.candidate_id = $1
    `;
    const params = [id];

    // Non-admins can only see their own private notes
    if (role_name !== 'Admin') {
      query += ` AND (cn.is_private = false OR cn.user_id = $2)`;
      params.push(userId);
    }

    query += ` ORDER BY cn.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

// ============================================
// OFFERS
// ============================================

/**
 * Make an offer to a candidate
 */
async function makeOffer(req, res) {
  try {
    const { role_name, role_id, id: userId } = req.user;
    const { id } = req.params;

    const permissions = await checkRecruitmentPermissions(role_id, role_name);
    if (!permissions.full) {
      return res.status(403).json({ error: 'Only HR/Admin can make offers' });
    }

    const { offer_salary, offer_start_date, offer_expiry_date } = req.body;

    if (!offer_salary || !offer_start_date) {
      return res.status(400).json({ error: 'Salary and start date are required' });
    }

    // Check candidate exists and is at correct stage
    const candidate = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candidate.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (!['final_shortlist', 'offer_made'].includes(candidate.rows[0].recruitment_stage)) {
      return res.status(400).json({ error: 'Candidate must be at final_shortlist stage to receive an offer' });
    }

    const result = await pool.query(
      `UPDATE candidates SET
        offer_salary = $1,
        offer_start_date = $2,
        offer_expiry_date = $3,
        offer_date = CURRENT_DATE,
        recruitment_stage = 'offer_made',
        recruitment_stage_updated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [offer_salary, offer_start_date, offer_expiry_date, id]
    );

    const tenantId = req.session?.tenantId || 1;

    // Record stage history
    await pool.query(
      `INSERT INTO candidate_stage_history (candidate_id, from_stage, to_stage, changed_by, reason)
       VALUES ($1, $2, 'offer_made', $3, $4)`,
      [id, candidate.rows[0].recruitment_stage, userId, `Offer: £${offer_salary}, Start: ${offer_start_date}`]
    );

    // Add offer note
    await pool.query(
      `INSERT INTO candidate_notes (tenant_id, candidate_id, user_id, note_type, content)
       VALUES ($1, $2, $3, 'offer', $4)`,
      [tenantId, id, userId, `Offer made: £${offer_salary} salary, start date ${offer_start_date}`]
    );

    res.json({
      message: 'Offer made successfully',
      candidate: result.rows[0]
    });
  } catch (error) {
    console.error('=== MAKE OFFER ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    res.status(500).json({ error: 'Failed to make offer' });
  }
}

/**
 * Accept offer (triggers onboarding)
 */
async function acceptOffer(req, res) {
  try {
    const { role_name, role_id, id: userId } = req.user;
    const { id } = req.params;

    const permissions = await checkRecruitmentPermissions(role_id, role_name);
    if (!permissions.full) {
      return res.status(403).json({ error: 'Only HR/Admin can record offer acceptance' });
    }

    // Check candidate exists and has offer
    const candidate = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candidate.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (candidate.rows[0].recruitment_stage !== 'offer_made') {
      return res.status(400).json({ error: 'No offer has been made to this candidate' });
    }

    // Update stage
    await pool.query(
      `UPDATE candidates SET
        recruitment_stage = 'offer_accepted',
        recruitment_stage_updated_at = CURRENT_TIMESTAMP,
        contract_signed = true,
        contract_signed_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    const tenantId = req.session?.tenantId || 1;

    // Record stage history
    await pool.query(
      `INSERT INTO candidate_stage_history (candidate_id, from_stage, to_stage, changed_by, reason)
       VALUES ($1, 'offer_made', 'offer_accepted', $2, 'Candidate accepted offer')`,
      [id, userId]
    );

    // Trigger onboarding
    const result = await triggerOnboarding(id, candidate.rows[0], userId, tenantId);

    res.json({
      message: 'Offer accepted - onboarding initiated',
      user_id: result.userId
    });
  } catch (error) {
    console.error('=== ACCEPT OFFER ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
}

/**
 * Decline offer
 */
async function declineOffer(req, res) {
  try {
    const { role_name, role_id, id: userId } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    const permissions = await checkRecruitmentPermissions(role_id, role_name);
    if (!permissions.full) {
      return res.status(403).json({ error: 'Only HR/Admin can record offer decline' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Decline reason is required' });
    }

    // Check candidate exists and has offer
    const candidate = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (candidate.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (candidate.rows[0].recruitment_stage !== 'offer_made') {
      return res.status(400).json({ error: 'No offer has been made to this candidate' });
    }

    await pool.query(
      `UPDATE candidates SET
        recruitment_stage = 'offer_declined',
        recruitment_stage_updated_at = CURRENT_TIMESTAMP,
        decline_reason = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason, id]
    );

    const tenantId = req.session?.tenantId || 1;

    // Record stage history
    await pool.query(
      `INSERT INTO candidate_stage_history (candidate_id, from_stage, to_stage, changed_by, reason)
       VALUES ($1, 'offer_made', 'offer_declined', $2, $3)`,
      [id, userId, reason]
    );

    res.json({
      message: 'Offer declined recorded',
      reason
    });
  } catch (error) {
    console.error('=== DECLINE OFFER ERROR ===');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    res.status(500).json({ error: 'Failed to decline offer' });
  }
}

// ============================================
// PIPELINE OVERVIEW
// ============================================

/**
 * Get pipeline overview with counts per stage
 */
async function getPipelineOverview(req, res) {
  try {
    const { role_name, role_id } = req.user;
    const { recruitment_request_id } = req.query;

    const permissions = await checkRecruitmentPermissions(role_id, role_name);
    if (!permissions.full && !permissions.postChecks) {
      return res.status(403).json({ error: 'You do not have permission to view the pipeline' });
    }

    let whereClause = '';
    const params = [];

    if (recruitment_request_id) {
      whereClause = 'WHERE c.recruitment_request_id = $1';
      params.push(recruitment_request_id);
    }

    // Get counts by stage
    const countsResult = await pool.query(
      `SELECT recruitment_stage, COUNT(*) as count
       FROM candidates c
       ${whereClause}
       GROUP BY recruitment_stage`,
      params
    );

    const counts = {};
    RECRUITMENT_STAGES.forEach(stage => {
      counts[stage] = 0;
    });
    countsResult.rows.forEach(row => {
      counts[row.recruitment_stage] = parseInt(row.count);
    });

    // Get candidates grouped by stage
    const candidatesResult = await pool.query(
      `SELECT c.id, c.full_name, c.email, c.recruitment_stage,
              c.recruitment_stage_updated_at, c.recruitment_request_id,
              rr.role_title
       FROM candidates c
       LEFT JOIN recruitment_requests rr ON c.recruitment_request_id = rr.id
       ${whereClause}
       ORDER BY c.recruitment_stage_updated_at DESC`,
      params
    );

    // Group by stage
    const pipeline = {};
    RECRUITMENT_STAGES.forEach(stage => {
      pipeline[stage] = [];
    });
    candidatesResult.rows.forEach(c => {
      if (pipeline[c.recruitment_stage]) {
        pipeline[c.recruitment_stage].push(c);
      }
    });

    res.json({
      counts,
      pipeline,
      stages: RECRUITMENT_STAGES
    });
  } catch (error) {
    console.error('Get pipeline overview error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline overview' });
  }
}

module.exports = {
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
  getPipelineOverview,
  RECRUITMENT_STAGES,
  STAGE_TRANSITIONS
};
