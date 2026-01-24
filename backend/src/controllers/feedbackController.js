/**
 * @fileoverview 360 Feedback Controller
 * Handles quarterly feedback collection, weighting, and composite calculations
 */

const pool = require('../config/database');

// Weighting configurations by reviewer type
const WEIGHTS = {
  skip_level: {
    tasks_completed: 0.30,
    work_volume: 0.30,
    problem_solving: 0.20,
    communication: 0.15,
    leadership: 0.05
  },
  direct_report: {
    tasks_completed: 0.05,
    work_volume: 0.05,
    problem_solving: 0.15,
    communication: 0.35,
    leadership: 0.40
  },
  manager: {
    tasks_completed: 0.20,
    work_volume: 0.20,
    problem_solving: 0.20,
    communication: 0.20,
    leadership: 0.20
  },
  self: {
    tasks_completed: 0.20,
    work_volume: 0.20,
    problem_solving: 0.20,
    communication: 0.20,
    leadership: 0.20
  }
};

// Calculate weighted KPIs from raw ratings
function calculateWeightedKPIs(feedback, reviewerType) {
  const weights = WEIGHTS[reviewerType];
  if (!weights || !feedback) return null;

  // Velocity = (tasks + volume + problem_solving) / 3
  const velocity = (
    (feedback.tasks_completed || 0) * weights.tasks_completed +
    (feedback.work_volume || 0) * weights.work_volume +
    (feedback.problem_solving || 0) * weights.problem_solving
  ) / (weights.tasks_completed + weights.work_volume + weights.problem_solving) *
  ((feedback.tasks_completed || 0) + (feedback.work_volume || 0) + (feedback.problem_solving || 0)) / 3;

  // Actually, let's calculate KPIs the standard way first, then we weight the final composite
  const rawVelocity = ((feedback.tasks_completed || 0) + (feedback.work_volume || 0) + (feedback.problem_solving || 0)) / 3;
  const rawFriction = (rawVelocity + (feedback.communication || 0)) / 2;
  const rawCohesion = ((feedback.problem_solving || 0) + (feedback.communication || 0) + (feedback.leadership || 0)) / 3;

  return {
    velocity: Math.round(rawVelocity * 100) / 100,
    friction: Math.round(rawFriction * 100) / 100,
    cohesion: Math.round(rawCohesion * 100) / 100
  };
}

// Get current quarter string
function getCurrentQuarter() {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
}

/**
 * Submit quarterly feedback
 */
async function submitFeedback(req, res) {
  const client = await pool.connect();
  try {
    const reviewerId = req.user.id;
    const {
      employee_id,
      quarter,
      tasks_completed,
      work_volume,
      problem_solving,
      communication,
      leadership,
      comments
    } = req.body;

    // Validate required fields
    if (!employee_id || !quarter) {
      return res.status(400).json({ error: 'Employee ID and quarter are required' });
    }

    // Check if there's a pending feedback request
    const requestResult = await client.query(
      `SELECT id, reviewer_type FROM feedback_requests
       WHERE employee_id = $1 AND reviewer_id = $2 AND quarter = $3 AND status = 'pending'`,
      [employee_id, reviewerId, quarter]
    );

    if (requestResult.rows.length === 0) {
      return res.status(400).json({ error: 'No pending feedback request found' });
    }

    const { reviewer_type } = requestResult.rows[0];
    const isAnonymous = reviewer_type === 'direct_report';

    await client.query('BEGIN');

    // Insert or update feedback
    const feedbackResult = await client.query(
      `INSERT INTO quarterly_feedback
       (employee_id, reviewer_id, reviewer_type, quarter, tasks_completed, work_volume,
        problem_solving, communication, leadership, comments, is_anonymous, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (employee_id, reviewer_id, quarter)
       DO UPDATE SET
         tasks_completed = EXCLUDED.tasks_completed,
         work_volume = EXCLUDED.work_volume,
         problem_solving = EXCLUDED.problem_solving,
         communication = EXCLUDED.communication,
         leadership = EXCLUDED.leadership,
         comments = EXCLUDED.comments,
         submitted_at = NOW()
       RETURNING *`,
      [employee_id, reviewerId, reviewer_type, quarter, tasks_completed, work_volume,
       problem_solving, communication, leadership, comments, isAnonymous]
    );

    // Update request status
    await client.query(
      `UPDATE feedback_requests SET status = 'submitted'
       WHERE employee_id = $1 AND reviewer_id = $2 AND quarter = $3`,
      [employee_id, reviewerId, quarter]
    );

    // Check if all feedback for this employee is complete
    const pendingCount = await client.query(
      `SELECT COUNT(*) FROM feedback_requests
       WHERE employee_id = $1 AND quarter = $2 AND status = 'pending'`,
      [employee_id, quarter]
    );

    if (parseInt(pendingCount.rows[0].count) === 0) {
      // All feedback received - calculate composite
      await calculateAndStoreComposite(client, employee_id, quarter);

      // Notify employee and manager
      const employee = await client.query(
        `SELECT u.id, u.full_name, u.manager_id FROM users u WHERE u.id = $1`,
        [employee_id]
      );

      if (employee.rows[0]) {
        // Notify employee
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           VALUES ($1, 'info', '360 Feedback Complete',
                   'Your quarterly feedback for ${quarter} is now available to review.')`,
          [employee_id]
        );

        // Notify manager
        if (employee.rows[0].manager_id) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES ($1, 'info', '360 Feedback Complete',
                     '360 feedback for ${employee.rows[0].full_name} (${quarter}) is ready for review.')`,
            [employee.rows[0].manager_id]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Feedback submitted successfully',
      feedback: feedbackResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error submitting feedback:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  } finally {
    client.release();
  }
}

/**
 * Calculate and store composite KPIs
 */
async function calculateAndStoreComposite(client, employeeId, quarter) {
  // Get all feedback for this employee
  const feedbackResult = await client.query(
    `SELECT * FROM quarterly_feedback
     WHERE employee_id = $1 AND quarter = $2 AND submitted_at IS NOT NULL`,
    [employeeId, quarter]
  );

  const feedbackByType = {};
  for (const fb of feedbackResult.rows) {
    if (fb.reviewer_type === 'direct_report') {
      if (!feedbackByType.direct_reports) feedbackByType.direct_reports = [];
      feedbackByType.direct_reports.push(fb);
    } else {
      feedbackByType[fb.reviewer_type] = fb;
    }
  }

  // Calculate KPIs for each source
  const managerKPIs = feedbackByType.manager ? calculateWeightedKPIs(feedbackByType.manager, 'manager') : null;
  const skipLevelKPIs = feedbackByType.skip_level ? calculateWeightedKPIs(feedbackByType.skip_level, 'skip_level') : null;
  const selfKPIs = feedbackByType.self ? calculateWeightedKPIs(feedbackByType.self, 'self') : null;

  // Average direct reports
  let directReportsKPIs = null;
  if (feedbackByType.direct_reports && feedbackByType.direct_reports.length > 0) {
    const drKPIs = feedbackByType.direct_reports.map(fb => calculateWeightedKPIs(fb, 'direct_report'));
    directReportsKPIs = {
      velocity: drKPIs.reduce((sum, k) => sum + k.velocity, 0) / drKPIs.length,
      friction: drKPIs.reduce((sum, k) => sum + k.friction, 0) / drKPIs.length,
      cohesion: drKPIs.reduce((sum, k) => sum + k.cohesion, 0) / drKPIs.length
    };
  }

  // Check if employee has direct reports
  const hasDirectReports = directReportsKPIs !== null;

  // Calculate final composites based on available sources
  let finalVelocity, finalFriction, finalCohesion;

  if (hasDirectReports) {
    // Employee has direct reports
    if (skipLevelKPIs) {
      finalVelocity = (managerKPIs?.velocity || 0) * 0.50 + skipLevelKPIs.velocity * 0.35 + (selfKPIs?.velocity || 0) * 0.15;
    } else {
      finalVelocity = (managerKPIs?.velocity || 0) * 0.85 + (selfKPIs?.velocity || 0) * 0.15;
    }
    finalFriction = (managerKPIs?.friction || 0) * 0.50 + directReportsKPIs.friction * 0.35 + (selfKPIs?.friction || 0) * 0.15;
    finalCohesion = (managerKPIs?.cohesion || 0) * 0.40 + directReportsKPIs.cohesion * 0.45 + (selfKPIs?.cohesion || 0) * 0.15;
  } else {
    // No direct reports
    if (skipLevelKPIs) {
      finalVelocity = (managerKPIs?.velocity || 0) * 0.60 + skipLevelKPIs.velocity * 0.25 + (selfKPIs?.velocity || 0) * 0.15;
    } else {
      finalVelocity = (managerKPIs?.velocity || 0) * 0.85 + (selfKPIs?.velocity || 0) * 0.15;
    }
    finalFriction = (managerKPIs?.friction || 0) * 0.70 + (selfKPIs?.friction || 0) * 0.30;
    finalCohesion = (managerKPIs?.cohesion || 0) * 0.70 + (selfKPIs?.cohesion || 0) * 0.30;
  }

  // Store composite
  await client.query(
    `INSERT INTO quarterly_composites
     (employee_id, quarter, velocity, friction, cohesion,
      manager_velocity, manager_friction, manager_cohesion,
      skip_level_velocity, skip_level_friction, skip_level_cohesion,
      direct_reports_velocity, direct_reports_friction, direct_reports_cohesion,
      self_velocity, self_friction, self_cohesion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (employee_id, quarter)
     DO UPDATE SET
       velocity = EXCLUDED.velocity,
       friction = EXCLUDED.friction,
       cohesion = EXCLUDED.cohesion,
       manager_velocity = EXCLUDED.manager_velocity,
       manager_friction = EXCLUDED.manager_friction,
       manager_cohesion = EXCLUDED.manager_cohesion,
       skip_level_velocity = EXCLUDED.skip_level_velocity,
       skip_level_friction = EXCLUDED.skip_level_friction,
       skip_level_cohesion = EXCLUDED.skip_level_cohesion,
       direct_reports_velocity = EXCLUDED.direct_reports_velocity,
       direct_reports_friction = EXCLUDED.direct_reports_friction,
       direct_reports_cohesion = EXCLUDED.direct_reports_cohesion,
       self_velocity = EXCLUDED.self_velocity,
       self_friction = EXCLUDED.self_friction,
       self_cohesion = EXCLUDED.self_cohesion,
       calculated_at = NOW()`,
    [
      employeeId, quarter,
      Math.round(finalVelocity * 100) / 100,
      Math.round(finalFriction * 100) / 100,
      Math.round(finalCohesion * 100) / 100,
      managerKPIs?.velocity, managerKPIs?.friction, managerKPIs?.cohesion,
      skipLevelKPIs?.velocity, skipLevelKPIs?.friction, skipLevelKPIs?.cohesion,
      directReportsKPIs?.velocity, directReportsKPIs?.friction, directReportsKPIs?.cohesion,
      selfKPIs?.velocity, selfKPIs?.friction, selfKPIs?.cohesion
    ]
  );
}

/**
 * Get all feedback for an employee for a quarter
 */
async function getFeedbackForEmployee(req, res) {
  try {
    const { employeeId, quarter } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role_name;

    // Check authorization - employee can see own, manager can see direct reports, admin sees all
    const isAdmin = userRole === 'Admin';
    const isOwnFeedback = parseInt(employeeId) === userId;

    if (!isAdmin && !isOwnFeedback) {
      // Check if user is manager of employee
      const managerCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [employeeId, userId]
      );
      if (managerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view this feedback' });
      }
    }

    // Get feedback - hide reviewer identity for anonymous feedback unless admin
    const feedback = await pool.query(
      `SELECT
         qf.id, qf.employee_id, qf.reviewer_type, qf.quarter,
         qf.tasks_completed, qf.work_volume, qf.problem_solving,
         qf.communication, qf.leadership, qf.comments,
         qf.is_anonymous, qf.submitted_at,
         CASE WHEN qf.is_anonymous AND $3 = false THEN NULL ELSE qf.reviewer_id END as reviewer_id,
         CASE WHEN qf.is_anonymous AND $3 = false THEN 'Anonymous' ELSE u.full_name END as reviewer_name
       FROM quarterly_feedback qf
       LEFT JOIN users u ON qf.reviewer_id = u.id
       WHERE qf.employee_id = $1 AND qf.quarter = $2 AND qf.submitted_at IS NOT NULL
       ORDER BY qf.reviewer_type`,
      [employeeId, quarter, isAdmin]
    );

    res.json({ feedback: feedback.rows });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
}

/**
 * Get pending feedback requests for current user
 */
async function getPendingFeedback(req, res) {
  try {
    const userId = req.user.id;

    const pending = await pool.query(
      `SELECT
         fr.id, fr.employee_id, fr.reviewer_type, fr.quarter, fr.deadline, fr.created_at,
         u.full_name as employee_name, u.email as employee_email,
         r.name as employee_role,
         fc.status as cycle_status
       FROM feedback_requests fr
       JOIN users u ON fr.employee_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN feedback_cycles fc ON fr.quarter = fc.quarter
       WHERE fr.reviewer_id = $1 AND fr.status = 'pending'
       ORDER BY fr.deadline ASC, u.full_name`,
      [userId]
    );

    res.json({ pending_feedback: pending.rows });
  } catch (err) {
    console.error('Error fetching pending feedback:', err);
    res.status(500).json({ error: 'Failed to fetch pending feedback' });
  }
}

/**
 * Get composite KPIs for an employee
 */
async function getComposite(req, res) {
  try {
    const { employeeId, quarter } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role_name;

    // Authorization check
    const isAdmin = userRole === 'Admin';
    const isOwnComposite = parseInt(employeeId) === userId;

    if (!isAdmin && !isOwnComposite) {
      const managerCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [employeeId, userId]
      );
      if (managerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view this data' });
      }
    }

    const composite = await pool.query(
      `SELECT qc.*, u.full_name as employee_name
       FROM quarterly_composites qc
       JOIN users u ON qc.employee_id = u.id
       WHERE qc.employee_id = $1 AND qc.quarter = $2`,
      [employeeId, quarter]
    );

    if (composite.rows.length === 0) {
      return res.status(404).json({ error: 'Composite not found or not yet calculated' });
    }

    // Get feedback completion status
    const feedbackStatus = await pool.query(
      `SELECT reviewer_type, status FROM feedback_requests
       WHERE employee_id = $1 AND quarter = $2`,
      [employeeId, quarter]
    );

    res.json({
      composite: composite.rows[0],
      feedback_status: feedbackStatus.rows
    });
  } catch (err) {
    console.error('Error fetching composite:', err);
    res.status(500).json({ error: 'Failed to fetch composite' });
  }
}

/**
 * Start a quarterly feedback cycle (Admin only)
 */
async function startFeedbackCycle(req, res) {
  const client = await pool.connect();
  try {
    const { quarter } = req.params;
    const adminId = req.user.id;
    const { deadline } = req.body;

    // Validate quarter format
    if (!/^Q[1-4]-\d{4}$/.test(quarter)) {
      return res.status(400).json({ error: 'Invalid quarter format. Use Q1-2025 format.' });
    }

    await client.query('BEGIN');

    // Check if cycle already exists
    const existingCycle = await client.query(
      'SELECT id, status FROM feedback_cycles WHERE quarter = $1',
      [quarter]
    );

    if (existingCycle.rows.length > 0 && existingCycle.rows[0].status === 'active') {
      return res.status(400).json({ error: 'Feedback cycle already active for this quarter' });
    }

    // Create or reactivate cycle
    const cycleResult = await client.query(
      `INSERT INTO feedback_cycles (quarter, status, started_by, deadline)
       VALUES ($1, 'active', $2, $3)
       ON CONFLICT (quarter) DO UPDATE SET status = 'active', started_at = NOW(), deadline = $3
       RETURNING *`,
      [quarter, adminId, deadline || null]
    );

    // Get all active employees (excluding pre-colleagues)
    const employees = await client.query(
      `SELECT u.id, u.manager_id, u.full_name,
              m.manager_id as skip_level_id
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.is_active = true AND u.tier IS NOT NULL`
    );

    let requestsCreated = 0;

    for (const employee of employees.rows) {
      // Self feedback
      await client.query(
        `INSERT INTO feedback_requests (employee_id, reviewer_id, reviewer_type, quarter, deadline)
         VALUES ($1, $1, 'self', $2, $3)
         ON CONFLICT (employee_id, reviewer_id, quarter) DO UPDATE SET status = 'pending'`,
        [employee.id, quarter, deadline]
      );
      requestsCreated++;

      // Manager feedback
      if (employee.manager_id) {
        await client.query(
          `INSERT INTO feedback_requests (employee_id, reviewer_id, reviewer_type, quarter, deadline)
           VALUES ($1, $2, 'manager', $3, $4)
           ON CONFLICT (employee_id, reviewer_id, quarter) DO UPDATE SET status = 'pending'`,
          [employee.id, employee.manager_id, quarter, deadline]
        );
        requestsCreated++;

        // Notify manager
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           VALUES ($1, 'action_required', 'Feedback Request',
                   'Please provide quarterly feedback for ${employee.full_name} (${quarter})')`,
          [employee.manager_id]
        );
      }

      // Skip-level feedback
      if (employee.skip_level_id) {
        await client.query(
          `INSERT INTO feedback_requests (employee_id, reviewer_id, reviewer_type, quarter, deadline)
           VALUES ($1, $2, 'skip_level', $3, $4)
           ON CONFLICT (employee_id, reviewer_id, quarter) DO UPDATE SET status = 'pending'`,
          [employee.id, employee.skip_level_id, quarter, deadline]
        );
        requestsCreated++;
      }

      // Direct reports feedback (employee reviews their manager)
      const directReports = await client.query(
        'SELECT id, full_name FROM users WHERE manager_id = $1 AND is_active = true',
        [employee.id]
      );

      for (const report of directReports.rows) {
        await client.query(
          `INSERT INTO feedback_requests (employee_id, reviewer_id, reviewer_type, quarter, deadline)
           VALUES ($1, $2, 'direct_report', $3, $4)
           ON CONFLICT (employee_id, reviewer_id, quarter) DO UPDATE SET status = 'pending'`,
          [employee.id, report.id, quarter, deadline]
        );
        requestsCreated++;

        // Notify direct report
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           VALUES ($1, 'action_required', 'Feedback Request',
                   'Please provide anonymous feedback for your manager (${quarter})')`,
          [report.id]
        );
      }

      // Notify employee about self-assessment
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, 'action_required', 'Self-Assessment Required',
                 'Please complete your self-assessment for ${quarter}')`,
        [employee.id]
      );
    }

    await client.query('COMMIT');

    res.json({
      message: 'Feedback cycle started successfully',
      cycle: cycleResult.rows[0],
      requests_created: requestsCreated
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error starting feedback cycle:', err);
    res.status(500).json({ error: 'Failed to start feedback cycle' });
  } finally {
    client.release();
  }
}

/**
 * Get feedback cycle status (Admin)
 */
async function getCycleStatus(req, res) {
  try {
    const { quarter } = req.params;

    const cycle = await pool.query(
      'SELECT * FROM feedback_cycles WHERE quarter = $1',
      [quarter]
    );

    if (cycle.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback cycle not found' });
    }

    // Get completion stats
    const stats = await pool.query(
      `SELECT
         COUNT(*) as total_requests,
         COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'skipped') as skipped
       FROM feedback_requests
       WHERE quarter = $1`,
      [quarter]
    );

    // Get per-employee breakdown
    const employeeBreakdown = await pool.query(
      `SELECT
         u.id, u.full_name,
         COUNT(*) as total_feedback,
         COUNT(*) FILTER (WHERE fr.status = 'submitted') as received,
         COUNT(*) FILTER (WHERE fr.status = 'pending') as pending,
         EXISTS(SELECT 1 FROM quarterly_composites qc WHERE qc.employee_id = u.id AND qc.quarter = $1) as composite_ready
       FROM users u
       JOIN feedback_requests fr ON u.id = fr.employee_id AND fr.quarter = $1
       WHERE u.is_active = true
       GROUP BY u.id, u.full_name
       ORDER BY u.full_name`,
      [quarter]
    );

    res.json({
      cycle: cycle.rows[0],
      stats: stats.rows[0],
      employees: employeeBreakdown.rows
    });
  } catch (err) {
    console.error('Error fetching cycle status:', err);
    res.status(500).json({ error: 'Failed to fetch cycle status' });
  }
}

/**
 * Get all active feedback cycles
 */
async function getActiveCycles(req, res) {
  try {
    const cycles = await pool.query(
      `SELECT fc.*,
              (SELECT COUNT(*) FROM feedback_requests fr WHERE fr.quarter = fc.quarter) as total_requests,
              (SELECT COUNT(*) FROM feedback_requests fr WHERE fr.quarter = fc.quarter AND fr.status = 'submitted') as submitted_requests
       FROM feedback_cycles fc
       WHERE fc.status = 'active'
       ORDER BY fc.quarter DESC`
    );

    res.json({ cycles: cycles.rows });
  } catch (err) {
    console.error('Error fetching active cycles:', err);
    res.status(500).json({ error: 'Failed to fetch active cycles' });
  }
}

/**
 * Sign off on quarterly composite (employee or manager)
 */
async function signComposite(req, res) {
  try {
    const { employeeId, quarter } = req.params;
    const userId = req.user.id;

    // Check if user is employee or their manager
    const composite = await pool.query(
      `SELECT qc.*, u.manager_id
       FROM quarterly_composites qc
       JOIN users u ON qc.employee_id = u.id
       WHERE qc.employee_id = $1 AND qc.quarter = $2`,
      [employeeId, quarter]
    );

    if (composite.rows.length === 0) {
      return res.status(404).json({ error: 'Composite not found' });
    }

    const isEmployee = parseInt(employeeId) === userId;
    const isManager = composite.rows[0].manager_id === userId;

    if (!isEmployee && !isManager) {
      return res.status(403).json({ error: 'Not authorized to sign this composite' });
    }

    const field = isEmployee ? 'employee_signed_at' : 'manager_signed_at';

    const result = await pool.query(
      `UPDATE quarterly_composites SET ${field} = NOW()
       WHERE employee_id = $1 AND quarter = $2
       RETURNING *`,
      [employeeId, quarter]
    );

    res.json({
      message: 'Composite signed successfully',
      composite: result.rows[0]
    });
  } catch (err) {
    console.error('Error signing composite:', err);
    res.status(500).json({ error: 'Failed to sign composite' });
  }
}

/**
 * Close a feedback cycle (Admin)
 */
async function closeCycle(req, res) {
  try {
    const { quarter } = req.params;

    const result = await pool.query(
      `UPDATE feedback_cycles SET status = 'closed', closed_at = NOW()
       WHERE quarter = $1
       RETURNING *`,
      [quarter]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback cycle not found' });
    }

    res.json({
      message: 'Feedback cycle closed',
      cycle: result.rows[0]
    });
  } catch (err) {
    console.error('Error closing cycle:', err);
    res.status(500).json({ error: 'Failed to close cycle' });
  }
}

module.exports = {
  submitFeedback,
  getFeedbackForEmployee,
  getPendingFeedback,
  getComposite,
  startFeedbackCycle,
  getCycleStatus,
  getActiveCycles,
  signComposite,
  closeCycle,
  getCurrentQuarter
};
