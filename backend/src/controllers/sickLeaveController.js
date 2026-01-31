/**
 * VoidStaffOS - Sick & Statutory Leave Controller
 * Handles sick leave, statutory leave types, and Return to Work interviews.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 30/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: LeaveOS
 */

const pool = require('../config/database');
const { notifyManager, notifyEmployee, createNotification } = require('./notificationController');
const auditTrail = require('../utils/auditTrail');

// =====================================================
// Constants
// =====================================================

const SELF_CERT_DAYS = 7; // UK: self-certification up to 7 calendar days
const SSP_WAITING_DAYS = 3; // SSP starts after 3 qualifying days
const SSP_MAX_WEEKS = 28; // Maximum 28 weeks SSP
const SSP_LINK_GAP_WEEKS = 8; // Periods link if gap < 8 weeks

// =====================================================
// Sick Leave Functions
// =====================================================

/**
 * Report sick leave (employee self-service)
 * Sick leave doesn't require pre-approval - just notification
 */
async function reportSickLeave(req, res) {
  try {
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;
    console.log('=== SICK LEAVE REPORT ===');
    console.log('UserId:', userId, 'TenantId:', tenantId);
    console.log('Body:', JSON.stringify(req.body));
    const {
      start_date,
      end_date,
      sick_reason,
      sick_notes,
      is_ongoing
    } = req.body;

    if (!start_date) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    // For ongoing sick leave, use start_date as end_date (will be updated when they return)
    // The original schema requires end_date to be NOT NULL
    const endDate = is_ongoing ? start_date : end_date;

    if (!is_ongoing && !end_date) {
      return res.status(400).json({ error: 'End date is required unless ongoing' });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sick leave can be reported for today or recent past (up to 7 days back)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (startDate < sevenDaysAgo) {
      return res.status(400).json({ error: 'Cannot report sick leave more than 7 days in the past' });
    }

    if (endDate && new Date(endDate) < startDate) {
      return res.status(400).json({ error: 'End date must be on or after start date' });
    }

    // Get employee's manager
    const userResult = await pool.query(
      'SELECT manager_id, full_name FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { manager_id, full_name } = userResult.rows[0];
    console.log('Manager:', manager_id, 'Employee:', full_name);

    // Calculate duration if end date provided
    let totalDays = null;
    let fitNoteRequired = false;

    if (endDate) {
      totalDays = calculateCalendarDays(start_date, endDate);
      fitNoteRequired = totalDays > SELF_CERT_DAYS;
    }

    // Check SSP eligibility (simplified - would need earnings check in production)
    const sspEligible = true; // Assume eligible for now

    // For sick leave: notice_days = 0 (reporting same day), required_notice = 0
    const noticeDays = 0;
    const requiredNoticeDays = 0;

    // Determine if RTW is required (for absences > 1 day)
    const rtwRequired = is_ongoing ? true : (totalDays && totalDays > 1);

    // Create leave request with 'sick' category
    // Sick leave is auto-approved but requires notification
    const result = await pool.query(
      `INSERT INTO leave_requests (
        tenant_id, employee_id, manager_id, request_date,
        leave_start_date, leave_end_date, leave_type, total_days,
        status, absence_category, sick_reason, sick_notes,
        fit_note_required, ssp_eligible, self_certified,
        rtw_required, notice_days, required_notice_days, meets_notice_requirement
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'full_day'::leave_type_enum, $6,
        'approved'::leave_status_enum, 'sick'::absence_category_enum, $7::sick_reason_enum, $8,
        $9, $10, true, $11, $12, $13, true)
      RETURNING *`,
      [
        tenantId, userId, manager_id, start_date, endDate, totalDays || 1,
        sick_reason || 'illness', sick_notes,
        fitNoteRequired, sspEligible, rtwRequired,
        noticeDays, requiredNoticeDays
      ]
    );

    const sickLeave = result.rows[0];
    console.log('Sick leave created:', sickLeave.id);

    // Update SSP tracking
    await updateSSPTracking(tenantId, userId, sickLeave.id, start_date);

    // Audit trail
    await auditTrail.logCreate(
      { tenantId, userId },
      req,
      'sick_leave',
      sickLeave.id,
      `Sick leave reported from ${start_date}`,
      { start_date, end_date: endDate, sick_reason, is_ongoing }
    );

    // Notify manager - mark as urgent if same-day or very short notice
    if (manager_id) {
      const startDateObj = new Date(start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDateObj.setHours(0, 0, 0, 0);

      // Urgent if sick leave starts today or in the past (same-day/retrospective reporting)
      const isUrgent = startDateObj <= today;
      const urgentPrefix = isUrgent ? '🚨 URGENT: ' : '';

      await createNotification(
        manager_id,
        'sick_leave_reported',
        `${urgentPrefix}${full_name} has reported sick`,
        `${full_name} has reported sick leave starting ${formatDate(start_date)}${endDate ? ` to ${formatDate(endDate)}` : ' (ongoing)'}. ${isUrgent ? 'This is short-notice absence.' : ''}`,
        sickLeave.id,
        'leave_request',
        tenantId,
        isUrgent
      );
    }

    res.status(201).json({
      message: 'Sick leave reported successfully',
      leave_request: sickLeave,
      fit_note_required: fitNoteRequired,
      fit_note_message: fitNoteRequired
        ? 'A fit note (GP sick note) is required for absences over 7 days'
        : null
    });
  } catch (error) {
    console.error('=== REPORT SICK LEAVE ERROR ===');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to report sick leave' });
  }
}

/**
 * Update sick leave (extend or close)
 */
async function updateSickLeave(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const { end_date, sick_notes } = req.body;

    // Get the sick leave record
    const leaveResult = await pool.query(
      `SELECT * FROM leave_requests
       WHERE id = $1 AND tenant_id = $2 AND absence_category = 'sick'`,
      [id, tenantId]
    );

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sick leave record not found' });
    }

    const sickLeave = leaveResult.rows[0];

    // Only employee or manager can update
    if (sickLeave.employee_id !== userId && sickLeave.manager_id !== userId) {
      const { role_name } = req.user;
      if (role_name !== 'Admin') {
        return res.status(403).json({ error: 'Not authorized to update this record' });
      }
    }

    // Calculate new duration
    const totalDays = end_date ? calculateCalendarDays(sickLeave.leave_start_date, end_date) : null;
    const fitNoteRequired = totalDays ? totalDays > SELF_CERT_DAYS : false;
    const rtwRequired = totalDays ? totalDays > 1 : false;

    // Update the record
    const result = await pool.query(
      `UPDATE leave_requests SET
        leave_end_date = $1,
        total_days = $2,
        sick_notes = COALESCE($3, sick_notes),
        fit_note_required = $4,
        rtw_required = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *`,
      [end_date, totalDays, sick_notes, fitNoteRequired, rtwRequired, id]
    );

    // If closing sick leave, trigger RTW if required
    if (end_date && rtwRequired && !sickLeave.rtw_completed) {
      await createRTWTask(tenantId, id, sickLeave.employee_id, sickLeave.manager_id);
    }

    // Update SSP tracking
    if (end_date) {
      await closeSSPPeriod(tenantId, sickLeave.employee_id, end_date);
    }

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'sick_leave',
      parseInt(id),
      `Sick leave updated`,
      { end_date: sickLeave.leave_end_date },
      { end_date },
      { reason: 'Sick leave period updated' }
    );

    res.json({
      message: 'Sick leave updated',
      leave_request: result.rows[0],
      rtw_required: rtwRequired && !sickLeave.rtw_completed
    });
  } catch (error) {
    console.error('Update sick leave error:', error);
    res.status(500).json({ error: 'Failed to update sick leave' });
  }
}

/**
 * Upload fit note for sick leave
 */
async function uploadFitNote(req, res) {
  try {
    const { id } = req.params;
    const { document_id } = req.body;
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // Verify the leave request exists and belongs to user
    const leaveResult = await pool.query(
      `SELECT * FROM leave_requests
       WHERE id = $1 AND tenant_id = $2 AND absence_category = 'sick'`,
      [id, tenantId]
    );

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sick leave record not found' });
    }

    const sickLeave = leaveResult.rows[0];

    if (sickLeave.employee_id !== userId) {
      return res.status(403).json({ error: 'Can only upload fit note for your own sick leave' });
    }

    // Update with fit note document ID
    const result = await pool.query(
      `UPDATE leave_requests SET
        fit_note_document_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      [document_id, id]
    );

    // Audit trail
    await auditTrail.logUpdate(
      { tenantId, userId },
      req,
      'sick_leave',
      parseInt(id),
      `Fit note uploaded`,
      { fit_note_document_id: null },
      { fit_note_document_id: document_id },
      { reason: 'Fit note attached to sick leave' }
    );

    res.json({
      message: 'Fit note uploaded successfully',
      leave_request: result.rows[0]
    });
  } catch (error) {
    console.error('Upload fit note error:', error);
    res.status(500).json({ error: 'Failed to upload fit note' });
  }
}

// =====================================================
// Statutory Leave Functions
// =====================================================

/**
 * Request statutory leave (maternity, paternity, adoption, etc.)
 */
async function requestStatutoryLeave(req, res) {
  try {
    const { id: userId } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const {
      absence_category,
      start_date,
      end_date,
      expected_date,
      notes,
      weeks_requested
    } = req.body;

    // Validate absence category
    const validCategories = [
      'maternity', 'paternity', 'adoption', 'shared_parental',
      'parental', 'bereavement', 'jury_duty', 'public_duties',
      'compassionate', 'toil', 'unpaid'
    ];

    if (!validCategories.includes(absence_category)) {
      return res.status(400).json({ error: 'Invalid absence category' });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    // Get employee details
    const userResult = await pool.query(
      'SELECT manager_id, full_name FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { manager_id, full_name } = userResult.rows[0];

    // Get category settings
    const settingsResult = await pool.query(
      `SELECT * FROM absence_category_settings
       WHERE tenant_id = $1 AND category = $2`,
      [tenantId, absence_category]
    );

    const settings = settingsResult.rows[0] || {
      requires_approval: true,
      auto_approve: false,
      min_notice_days: 0
    };

    // Calculate days
    const totalDays = calculateWorkingDays(start_date, end_date);

    // Determine initial status
    let status = 'pending';
    if (settings.auto_approve || !settings.requires_approval) {
      status = 'approved';
    }

    // Check notice requirement for certain leave types
    if (settings.min_notice_days > 0) {
      const noticeDays = calculateNoticeDays(new Date(), start_date);
      if (noticeDays < settings.min_notice_days) {
        // Still allow but flag it
        console.log(`Notice warning: ${noticeDays} days given, ${settings.min_notice_days} required`);
      }
    }

    // Create leave request
    const result = await pool.query(
      `INSERT INTO leave_requests (
        tenant_id, employee_id, manager_id, request_date,
        leave_start_date, leave_end_date, leave_type, total_days,
        status, absence_category, notes, expected_date,
        statutory_weeks_requested, notice_days, required_notice_days,
        meets_notice_requirement
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'full_day', $6,
        $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        tenantId, userId, manager_id, start_date, end_date, totalDays,
        status, absence_category, notes, expected_date,
        weeks_requested,
        calculateNoticeDays(new Date(), start_date),
        settings.min_notice_days || 0,
        calculateNoticeDays(new Date(), start_date) >= (settings.min_notice_days || 0)
      ]
    );

    const leaveRequest = result.rows[0];

    // Audit trail
    await auditTrail.logCreate(
      { tenantId, userId },
      req,
      'statutory_leave',
      leaveRequest.id,
      `${absence_category} leave requested`,
      { absence_category, start_date, end_date, weeks_requested }
    );

    // Notify appropriate person - mark as urgent if short notice (within 3 days)
    if (status === 'pending' && manager_id) {
      const startDateObj = new Date(start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDateObj.setHours(0, 0, 0, 0);

      const daysUntilStart = Math.floor((startDateObj - today) / (1000 * 60 * 60 * 24));
      const isUrgent = daysUntilStart <= 3; // Urgent if starts within 3 days
      const urgentPrefix = isUrgent ? '🚨 URGENT: ' : '';

      await createNotification(
        manager_id,
        'leave_request_pending',
        `${urgentPrefix}${absence_category} leave request from ${full_name}`,
        `${full_name} has requested ${absence_category} leave from ${formatDate(start_date)} to ${formatDate(end_date)}. ${isUrgent ? 'Short notice - requires immediate attention.' : ''}`,
        leaveRequest.id,
        'leave_request',
        tenantId,
        isUrgent
      );
    }

    res.status(201).json({
      message: status === 'approved'
        ? 'Leave request approved automatically'
        : 'Leave request submitted for approval',
      leave_request: leaveRequest
    });
  } catch (error) {
    console.error('Request statutory leave error:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
}

/**
 * Get absence categories and settings
 */
async function getAbsenceCategories(req, res) {
  try {
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT * FROM absence_category_settings
       WHERE tenant_id = $1 AND is_enabled = true
       ORDER BY category`,
      [tenantId]
    );

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get absence categories error:', error);
    res.status(500).json({ error: 'Failed to fetch absence categories' });
  }
}

// =====================================================
// Return to Work Interview Functions
// =====================================================

/**
 * Get pending RTW interviews for manager
 */
async function getPendingRTWInterviews(req, res) {
  try {
    const { id: userId, role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;

    let query;
    let params = [tenantId];

    if (role_name === 'Admin') {
      query = `
        SELECT lr.*, u.full_name as employee_name, u.employee_number,
               m.full_name as manager_name, rtw.id as rtw_id,
               rtw.interview_completed
        FROM leave_requests lr
        JOIN users u ON lr.employee_id = u.id
        LEFT JOIN users m ON lr.manager_id = m.id
        LEFT JOIN return_to_work_interviews rtw ON lr.id = rtw.leave_request_id
        WHERE lr.tenant_id = $1
        AND lr.absence_category = 'sick'
        AND lr.rtw_required = true
        AND (rtw.interview_completed IS NULL OR rtw.interview_completed = false)
        AND lr.leave_end_date IS NOT NULL
        AND lr.leave_end_date <= CURRENT_DATE
        ORDER BY lr.leave_end_date DESC
      `;
    } else {
      query = `
        SELECT lr.*, u.full_name as employee_name, u.employee_number,
               m.full_name as manager_name, rtw.id as rtw_id,
               rtw.interview_completed
        FROM leave_requests lr
        JOIN users u ON lr.employee_id = u.id
        LEFT JOIN users m ON lr.manager_id = m.id
        LEFT JOIN return_to_work_interviews rtw ON lr.id = rtw.leave_request_id
        WHERE lr.tenant_id = $1
        AND lr.manager_id = $2
        AND lr.absence_category = 'sick'
        AND lr.rtw_required = true
        AND (rtw.interview_completed IS NULL OR rtw.interview_completed = false)
        AND lr.leave_end_date IS NOT NULL
        AND lr.leave_end_date <= CURRENT_DATE
        ORDER BY lr.leave_end_date DESC
      `;
      params.push(userId);
    }

    const result = await pool.query(query, params);

    res.json({ pending_rtw: result.rows });
  } catch (error) {
    console.error('Get pending RTW error:', error);
    res.status(500).json({ error: 'Failed to fetch pending RTW interviews' });
  }
}

/**
 * Create or get RTW interview
 */
async function createRTWInterview(req, res) {
  try {
    const { leave_request_id } = req.body;
    const { id: userId, role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;

    // Get the leave request
    const leaveResult = await pool.query(
      `SELECT lr.*, u.full_name as employee_name
       FROM leave_requests lr
       JOIN users u ON lr.employee_id = u.id
       WHERE lr.id = $1 AND lr.tenant_id = $2`,
      [leave_request_id, tenantId]
    );

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leave = leaveResult.rows[0];

    // Check authorization
    if (leave.manager_id !== userId && role_name !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to conduct this RTW interview' });
    }

    // Check if RTW already exists
    const existingRTW = await pool.query(
      'SELECT * FROM return_to_work_interviews WHERE leave_request_id = $1 AND tenant_id = $2',
      [leave_request_id, tenantId]
    );

    if (existingRTW.rows.length > 0) {
      return res.json({
        message: 'RTW interview already exists',
        rtw_interview: existingRTW.rows[0],
        existing: true,
        employee_name: leave.employee_name
      });
    }

    // Create new RTW interview (with conflict handling for race conditions)
    const result = await pool.query(
      `INSERT INTO return_to_work_interviews (
        tenant_id, leave_request_id, employee_id, interviewer_id, interview_date
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE)
      ON CONFLICT (leave_request_id) DO UPDATE SET updated_at = NOW()
      RETURNING *`,
      [tenantId, leave_request_id, leave.employee_id, userId]
    );

    res.status(201).json({
      message: 'RTW interview created',
      rtw_interview: result.rows[0],
      employee_name: leave.employee_name
    });
  } catch (error) {
    console.error('Create RTW interview error:', error);

    // Handle duplicate key error gracefully
    if (error.code === '23505') {
      const existingRTW = await pool.query(
        'SELECT * FROM return_to_work_interviews WHERE leave_request_id = $1 AND tenant_id = $2',
        [req.body.leave_request_id, req.session?.tenantId || 1]
      );
      if (existingRTW.rows.length > 0) {
        return res.json({
          message: 'RTW interview already exists',
          rtw_interview: existingRTW.rows[0],
          existing: true
        });
      }
    }

    res.status(500).json({ error: 'Failed to create RTW interview' });
  }
}

/**
 * Complete RTW interview
 */
async function completeRTWInterview(req, res) {
  try {
    const { id } = req.params;
    const { id: userId, role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;
    const {
      feeling_ready,
      ready_notes,
      ongoing_concerns,
      workplace_adjustments,
      support_required,
      wellbeing_notes,
      follow_up_required,
      follow_up_date,
      follow_up_notes,
      oh_referral_recommended,
      oh_referral_reason,
      manager_notes
    } = req.body;

    // Get the RTW interview
    const rtwResult = await pool.query(
      `SELECT rtw.*, lr.manager_id, lr.employee_id
       FROM return_to_work_interviews rtw
       JOIN leave_requests lr ON rtw.leave_request_id = lr.id
       WHERE rtw.id = $1 AND rtw.tenant_id = $2`,
      [id, tenantId]
    );

    if (rtwResult.rows.length === 0) {
      return res.status(404).json({ error: 'RTW interview not found' });
    }

    const rtw = rtwResult.rows[0];

    // Check authorization
    if (rtw.manager_id !== userId && rtw.interviewer_id !== userId && role_name !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to complete this RTW interview' });
    }

    // Update the RTW interview
    const result = await pool.query(
      `UPDATE return_to_work_interviews SET
        interview_completed = true,
        completed_at = CURRENT_TIMESTAMP,
        feeling_ready = $1,
        ready_notes = $2,
        ongoing_concerns = $3,
        workplace_adjustments = $4,
        support_required = $5,
        wellbeing_notes = $6,
        follow_up_required = $7,
        follow_up_date = $8,
        follow_up_notes = $9,
        oh_referral_recommended = $10,
        oh_referral_reason = $11,
        manager_notes = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *`,
      [
        feeling_ready, ready_notes, ongoing_concerns, workplace_adjustments,
        support_required, wellbeing_notes, follow_up_required, follow_up_date,
        follow_up_notes, oh_referral_recommended, oh_referral_reason,
        manager_notes, id
      ]
    );

    // Mark RTW as completed on leave request
    await pool.query(
      `UPDATE leave_requests SET rtw_completed = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [rtw.leave_request_id]
    );

    // Audit trail
    await auditTrail.logCreate(
      { tenantId, userId },
      req,
      'rtw_interview',
      parseInt(id),
      'RTW interview completed',
      {
        leave_request_id: rtw.leave_request_id,
        employee_id: rtw.employee_id,
        oh_referral: oh_referral_recommended,
        follow_up: follow_up_required
      }
    );

    // Create follow-up notification if needed
    if (follow_up_required && follow_up_date) {
      await createNotification(
        userId,
        'rtw_follow_up',
        'RTW Follow-up Due',
        `Follow-up due for RTW interview on ${formatDate(follow_up_date)}`,
        id,
        'rtw_interview',
        req.session?.tenantId || 1
      );
    }

    res.json({
      message: 'RTW interview completed successfully',
      rtw_interview: result.rows[0]
    });
  } catch (error) {
    console.error('Complete RTW interview error:', error);
    res.status(500).json({ error: 'Failed to complete RTW interview' });
  }
}

/**
 * Get RTW interview for a leave request
 */
async function getRTWInterview(req, res) {
  try {
    const { leaveRequestId } = req.params;
    const { id: userId, role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT rtw.*, lr.leave_start_date, lr.leave_end_date, lr.total_days,
              lr.sick_reason, lr.sick_notes, u.full_name as employee_name,
              i.full_name as interviewer_name
       FROM return_to_work_interviews rtw
       JOIN leave_requests lr ON rtw.leave_request_id = lr.id
       JOIN users u ON rtw.employee_id = u.id
       LEFT JOIN users i ON rtw.interviewer_id = i.id
       WHERE rtw.leave_request_id = $1 AND rtw.tenant_id = $2`,
      [leaveRequestId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RTW interview not found' });
    }

    const rtw = result.rows[0];

    // Check authorization (employee can view their own, manager can view team's)
    if (rtw.employee_id !== userId && rtw.interviewer_id !== userId && role_name !== 'Admin') {
      // Check if user is the manager
      const managerCheck = await pool.query(
        'SELECT manager_id FROM leave_requests WHERE id = $1',
        [leaveRequestId]
      );
      if (managerCheck.rows[0]?.manager_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to view this RTW interview' });
      }
    }

    res.json({ rtw_interview: rtw });
  } catch (error) {
    console.error('Get RTW interview error:', error);
    res.status(500).json({ error: 'Failed to fetch RTW interview' });
  }
}

// =====================================================
// SSP Tracking Functions
// =====================================================

/**
 * Update SSP tracking when sick leave is reported
 */
async function updateSSPTracking(tenantId, employeeId, leaveRequestId, startDate) {
  try {
    // Check for existing active SSP period
    const existingPeriod = await pool.query(
      `SELECT * FROM ssp_periods
       WHERE tenant_id = $1 AND employee_id = $2 AND is_active = true`,
      [tenantId, employeeId]
    );

    if (existingPeriod.rows.length > 0) {
      // Add to existing period
      const period = existingPeriod.rows[0];
      const linkedIds = period.linked_leave_ids || [];
      linkedIds.push(leaveRequestId);

      await pool.query(
        `UPDATE ssp_periods SET
          linked_leave_ids = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [linkedIds, period.id]
      );
    } else {
      // Check for recent closed period (within 8 weeks) to link
      const recentPeriod = await pool.query(
        `SELECT * FROM ssp_periods
         WHERE tenant_id = $1 AND employee_id = $2
         AND is_active = false
         AND period_end >= CURRENT_DATE - INTERVAL '8 weeks'
         ORDER BY period_end DESC LIMIT 1`,
        [tenantId, employeeId]
      );

      const linkedToPreviousId = recentPeriod.rows[0]?.id || null;

      // Create new SSP period
      await pool.query(
        `INSERT INTO ssp_periods (
          tenant_id, employee_id, period_start, linked_leave_ids, linked_to_previous_period_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, employeeId, startDate, [leaveRequestId], linkedToPreviousId]
      );
    }
  } catch (error) {
    console.error('Update SSP tracking error:', error);
    // Don't throw - SSP tracking failure shouldn't block sick leave reporting
  }
}

/**
 * Close SSP period when sick leave ends
 */
async function closeSSPPeriod(tenantId, employeeId, endDate) {
  try {
    await pool.query(
      `UPDATE ssp_periods SET
        period_end = $1,
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $2 AND employee_id = $3 AND is_active = true`,
      [endDate, tenantId, employeeId]
    );
  } catch (error) {
    console.error('Close SSP period error:', error);
  }
}

/**
 * Get employee's SSP status
 */
async function getSSPStatus(req, res) {
  try {
    const { employeeId } = req.params;
    const tenantId = req.session?.tenantId || 1;

    const result = await pool.query(
      `SELECT sp.*,
              COALESCE(SUM(sp.weeks_paid), 0) as total_weeks_paid
       FROM ssp_periods sp
       WHERE sp.tenant_id = $1 AND sp.employee_id = $2
       AND sp.period_start >= CURRENT_DATE - INTERVAL '3 years'
       GROUP BY sp.id
       ORDER BY sp.period_start DESC`,
      [tenantId, employeeId]
    );

    // Calculate remaining SSP entitlement
    const totalWeeksPaid = result.rows.reduce((sum, p) => sum + parseFloat(p.weeks_paid || 0), 0);
    const remainingWeeks = Math.max(0, SSP_MAX_WEEKS - totalWeeksPaid);

    res.json({
      ssp_periods: result.rows,
      total_weeks_paid: totalWeeksPaid,
      remaining_weeks: remainingWeeks,
      max_weeks: SSP_MAX_WEEKS
    });
  } catch (error) {
    console.error('Get SSP status error:', error);
    res.status(500).json({ error: 'Failed to fetch SSP status' });
  }
}

// =====================================================
// Helper Functions
// =====================================================

function calculateCalendarDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function calculateWorkingDays(startDate, endDate) {
  let workingDays = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
}

function calculateNoticeDays(requestDate, leaveStartDate) {
  const request = new Date(requestDate);
  const start = new Date(leaveStartDate);
  const diffTime = start - request;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

async function createRTWTask(tenantId, leaveRequestId, employeeId, managerId) {
  try {
    // Create notification for manager about RTW
    const employeeResult = await pool.query(
      'SELECT full_name FROM users WHERE id = $1',
      [employeeId]
    );
    const employeeName = employeeResult.rows[0]?.full_name || 'Employee';

    await createNotification(
      managerId,
      'rtw_required',
      'Return to Work Interview Required',
      `A return to work conversation is needed with ${employeeName} following their sick leave.`,
      leaveRequestId,
      'leave_request',
      tenantId
    );
  } catch (error) {
    console.error('Create RTW task error:', error);
  }
}

/**
 * Get pending follow-up interviews
 * Returns RTW interviews where follow_up_required = true and not yet addressed
 */
async function getPendingFollowUps(req, res) {
  try {
    const { id: userId, role_name } = req.user;
    const tenantId = req.session?.tenantId || 1;

    let query = `
      SELECT
        rtw.*,
        lr.leave_start_date,
        lr.leave_end_date,
        lr.total_days,
        lr.sick_reason,
        u.full_name as employee_name,
        m.full_name as interviewer_name
      FROM return_to_work_interviews rtw
      JOIN leave_requests lr ON rtw.leave_request_id = lr.id
      JOIN users u ON rtw.employee_id = u.id
      JOIN users m ON rtw.interviewer_id = m.id
      WHERE rtw.tenant_id = $1
        AND rtw.follow_up_required = true
        AND rtw.interview_completed = true
    `;

    const params = [tenantId];

    // Managers see their own follow-ups, Admins see all
    if (role_name !== 'Admin') {
      query += ` AND rtw.interviewer_id = $2`;
      params.push(userId);
    }

    query += ` ORDER BY rtw.follow_up_date ASC NULLS LAST`;

    const result = await pool.query(query, params);

    res.json({ pending_follow_ups: result.rows });
  } catch (error) {
    console.error('Get pending follow-ups error:', error);
    res.status(500).json({ error: 'Failed to get pending follow-ups' });
  }
}

// =====================================================
// Exports
// =====================================================

module.exports = {
  // Sick leave
  reportSickLeave,
  updateSickLeave,
  uploadFitNote,

  // Statutory leave
  requestStatutoryLeave,
  getAbsenceCategories,

  // RTW interviews
  getPendingRTWInterviews,
  createRTWInterview,
  completeRTWInterview,
  getRTWInterview,
  getPendingFollowUps,

  // SSP
  getSSPStatus
};
