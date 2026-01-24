const pool = require('../config/database');

// Get traffic light status based on metric value
function getMetricStatus(value) {
  if (value == null) return null;
  if (value < 5) return 'red';
  if (value < 6.5) return 'amber';
  return 'green';
}

// Calculate weeks since review based on review_date (week ending date)
function calculateWeeksSince(reviewDate) {
  if (!reviewDate) return null;
  const now = new Date();
  const weekEnd = new Date(reviewDate);
  const diffTime = now - weekEnd;
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, diffWeeks);
}

// Get staleness status based on weeks since review
function getStalenessStatus(weeks) {
  if (weeks == null) return null;
  if (weeks <= 1) return 'green';
  if (weeks <= 4) return 'amber';
  return 'red';
}

// Calculate the most recent Friday (week ending date)
function getMostRecentFriday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  // If it's Friday (5), use today. Otherwise go back to last Friday
  const diff = day === 5 ? 0 : (day < 5 ? day + 2 : day - 5);
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

// Calculate velocity, friction, and cohesion metrics
function calculateMetrics(review) {
  const { tasks_completed, work_volume, problem_solving, communication, leadership, review_date } = review;

  let velocity = null;
  let friction = null;
  let cohesion = null;

  if (tasks_completed != null && work_volume != null && problem_solving != null) {
    velocity = (tasks_completed + work_volume + problem_solving) / 3;
    velocity = Math.round(velocity * 100) / 100;
  }

  if (velocity != null && communication != null) {
    friction = (velocity + communication) / 2;
    friction = Math.round(friction * 100) / 100;
  }

  if (problem_solving != null && communication != null && leadership != null) {
    cohesion = (problem_solving + communication + leadership) / 3;
    cohesion = Math.round(cohesion * 100) / 100;
  }

  const weeks_since_review = calculateWeeksSince(review_date);
  const staleness_status = getStalenessStatus(weeks_since_review);

  return {
    ...review,
    velocity,
    velocity_status: getMetricStatus(velocity),
    friction,
    friction_status: getMetricStatus(friction),
    cohesion,
    cohesion_status: getMetricStatus(cohesion),
    weeks_since_review,
    staleness_status
  };
}

async function getReviews(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    let query;
    let params = [];

    if (role_name === 'Admin' || role_name === 'Compliance Officer') {
      query = `
        SELECT r.*,
               e.full_name as employee_name,
               rv.full_name as reviewer_name
        FROM reviews r
        JOIN users e ON r.employee_id = e.id
        JOIN users rv ON r.reviewer_id = rv.id
        ORDER BY r.review_date DESC
      `;
    } else if (role_name === 'Manager') {
      query = `
        SELECT r.*,
               e.full_name as employee_name,
               rv.full_name as reviewer_name
        FROM reviews r
        JOIN users e ON r.employee_id = e.id
        JOIN users rv ON r.reviewer_id = rv.id
        WHERE r.reviewer_id = $1 OR e.manager_id = $1
        ORDER BY r.review_date DESC
      `;
      params = [userId];
    } else {
      query = `
        SELECT r.*,
               e.full_name as employee_name,
               rv.full_name as reviewer_name
        FROM reviews r
        JOIN users e ON r.employee_id = e.id
        JOIN users rv ON r.reviewer_id = rv.id
        WHERE r.employee_id = $1
        ORDER BY r.review_date DESC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    const reviews = result.rows.map(calculateMetrics);
    res.json({ reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
}

async function getReviewById(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;

    const result = await pool.query(
      `SELECT r.*,
              e.full_name as employee_name,
              rv.full_name as reviewer_name
       FROM reviews r
       JOIN users e ON r.employee_id = e.id
       JOIN users rv ON r.reviewer_id = rv.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = result.rows[0];

    if (role_name === 'Admin' || role_name === 'Compliance Officer') {
      // Can view any review
    } else if (role_name === 'Manager') {
      const employeeCheck = await pool.query(
        'SELECT manager_id FROM users WHERE id = $1',
        [review.employee_id]
      );
      const isReviewer = review.reviewer_id === userId;
      const isManager = employeeCheck.rows[0]?.manager_id === userId;

      if (!isReviewer && !isManager) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    } else {
      if (review.employee_id !== userId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    res.json({ review: calculateMetrics(review) });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
}

async function createReview(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    const {
      employee_id,
      review_date, // This is the week ending date
      goals,
      achievements,
      areas_for_improvement,
      tasks_completed,
      work_volume,
      problem_solving,
      communication,
      leadership,
      is_self_assessment
    } = req.body;

    // Default to most recent Friday if no date provided
    const weekEndingDate = review_date || getMostRecentFriday();

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // For self-assessments, employee creates their own review
    const isSelfAssessment = is_self_assessment || (parseInt(employee_id) === userId);

    if (role_name === 'Manager' && !isSelfAssessment) {
      const employeeCheck = await pool.query(
        'SELECT manager_id FROM users WHERE id = $1',
        [employee_id]
      );

      if (employeeCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      if (employeeCheck.rows[0].manager_id !== userId) {
        return res.status(403).json({ error: 'You can only create reviews for your team members' });
      }
    } else if (role_name === 'Employee' && !isSelfAssessment) {
      return res.status(403).json({ error: 'Employees can only create self-assessments' });
    }

    const result = await pool.query(
      `INSERT INTO reviews (
        employee_id, reviewer_id, review_date,
        goals, achievements, areas_for_improvement,
        tasks_completed, work_volume, problem_solving, communication, leadership,
        is_self_assessment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        employee_id,
        userId,
        weekEndingDate,
        goals || null,
        achievements || null,
        areas_for_improvement || null,
        tasks_completed || null,
        work_volume || null,
        problem_solving || null,
        communication || null,
        leadership || null,
        isSelfAssessment
      ]
    );

    const review = result.rows[0];

    const namesResult = await pool.query(
      `SELECT
        (SELECT full_name FROM users WHERE id = $1) as employee_name,
        (SELECT full_name FROM users WHERE id = $2) as reviewer_name`,
      [review.employee_id, review.reviewer_id]
    );

    review.employee_name = namesResult.rows[0].employee_name;
    review.reviewer_name = namesResult.rows[0].reviewer_name;

    res.status(201).json({ message: 'Review created successfully', review: calculateMetrics(review) });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
}

async function updateReview(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;
    const {
      review_date,
      goals,
      achievements,
      areas_for_improvement,
      tasks_completed,
      work_volume,
      problem_solving,
      communication,
      leadership
    } = req.body;

    const existingReview = await pool.query(
      'SELECT * FROM reviews WHERE id = $1',
      [id]
    );

    if (existingReview.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = existingReview.rows[0];

    // Check if review is committed (only admin can edit committed reviews)
    if (review.is_committed && role_name !== 'Admin') {
      return res.status(403).json({ error: 'This review has been committed and cannot be edited' });
    }

    // Check permissions
    if (role_name === 'Manager') {
      if (review.reviewer_id !== userId) {
        return res.status(403).json({ error: 'You can only edit your own reviews' });
      }
    } else if (role_name === 'Employee') {
      if (review.reviewer_id !== userId || !review.is_self_assessment) {
        return res.status(403).json({ error: 'You can only edit your own self-assessments' });
      }
    } else if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (review_date) { updates.push(`review_date = $${paramCount++}`); values.push(review_date); }
    if (goals !== undefined) { updates.push(`goals = $${paramCount++}`); values.push(goals); }
    if (achievements !== undefined) { updates.push(`achievements = $${paramCount++}`); values.push(achievements); }
    if (areas_for_improvement !== undefined) { updates.push(`areas_for_improvement = $${paramCount++}`); values.push(areas_for_improvement); }
    if (tasks_completed !== undefined) { updates.push(`tasks_completed = $${paramCount++}`); values.push(tasks_completed); }
    if (work_volume !== undefined) { updates.push(`work_volume = $${paramCount++}`); values.push(work_volume); }
    if (problem_solving !== undefined) { updates.push(`problem_solving = $${paramCount++}`); values.push(problem_solving); }
    if (communication !== undefined) { updates.push(`communication = $${paramCount++}`); values.push(communication); }
    if (leadership !== undefined) { updates.push(`leadership = $${paramCount++}`); values.push(leadership); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE reviews
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const updatedReview = result.rows[0];

    const namesResult = await pool.query(
      `SELECT
        (SELECT full_name FROM users WHERE id = $1) as employee_name,
        (SELECT full_name FROM users WHERE id = $2) as reviewer_name`,
      [updatedReview.employee_id, updatedReview.reviewer_id]
    );

    updatedReview.employee_name = namesResult.rows[0].employee_name;
    updatedReview.reviewer_name = namesResult.rows[0].reviewer_name;

    res.json({ message: 'Review updated successfully', review: calculateMetrics(updatedReview) });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
}

async function commitReview(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;

    const existingReview = await pool.query(
      'SELECT * FROM reviews WHERE id = $1',
      [id]
    );

    if (existingReview.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = existingReview.rows[0];

    // Only the original reviewer can commit their own review
    if (review.reviewer_id !== userId && role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only the original reviewer can commit this review' });
    }

    if (review.is_committed) {
      return res.status(400).json({ error: 'Review is already committed' });
    }

    const result = await pool.query(
      `UPDATE reviews
       SET is_committed = true, committed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const updatedReview = result.rows[0];

    const namesResult = await pool.query(
      `SELECT
        (SELECT full_name FROM users WHERE id = $1) as employee_name,
        (SELECT full_name FROM users WHERE id = $2) as reviewer_name`,
      [updatedReview.employee_id, updatedReview.reviewer_id]
    );

    updatedReview.employee_name = namesResult.rows[0].employee_name;
    updatedReview.reviewer_name = namesResult.rows[0].reviewer_name;

    res.json({ message: 'Review committed successfully', review: calculateMetrics(updatedReview) });
  } catch (error) {
    console.error('Commit review error:', error);
    res.status(500).json({ error: 'Failed to commit review' });
  }
}

// Get the latest review for the current user (for dashboard)
async function getMyLatestReview(req, res) {
  try {
    const { id: userId } = req.user;

    const result = await pool.query(
      `SELECT r.*,
              e.full_name as employee_name,
              rv.full_name as reviewer_name
       FROM reviews r
       JOIN users e ON r.employee_id = e.id
       JOIN users rv ON r.reviewer_id = rv.id
       WHERE r.employee_id = $1
       ORDER BY r.review_date DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ review: null });
    }

    res.json({ review: calculateMetrics(result.rows[0]) });
  } catch (error) {
    console.error('Get my latest review error:', error);
    res.status(500).json({ error: 'Failed to fetch latest review' });
  }
}

// Get previous quarter averages for context during self-reflection
async function getPreviousQuarterAverages(userId) {
  // Calculate previous quarter date range
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const currentYear = now.getFullYear();

  let prevQuarter, prevYear;
  if (currentQuarter === 0) {
    prevQuarter = 3;
    prevYear = currentYear - 1;
  } else {
    prevQuarter = currentQuarter - 1;
    prevYear = currentYear;
  }

  const startMonth = prevQuarter * 3;
  const startDate = new Date(prevYear, startMonth, 1);
  const endDate = new Date(prevYear, startMonth + 3, 0);

  const quarterLabel = `Q${prevQuarter + 1} ${prevYear}`;

  // Get all committed manager reviews for the employee in that quarter
  const result = await pool.query(
    `SELECT
       AVG(tasks_completed) as avg_tasks,
       AVG(work_volume) as avg_volume,
       AVG(problem_solving) as avg_problem_solving,
       AVG(communication) as avg_communication,
       AVG(leadership) as avg_leadership,
       COUNT(*) as review_count
     FROM reviews
     WHERE employee_id = $1
     AND is_self_assessment = false
     AND is_committed = true
     AND review_date >= $2
     AND review_date <= $3`,
    [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
  );

  const data = result.rows[0];
  if (!data || data.review_count === 0) {
    return null;
  }

  // Calculate KPIs from averages
  const avgTasks = parseFloat(data.avg_tasks);
  const avgVolume = parseFloat(data.avg_volume);
  const avgProblemSolving = parseFloat(data.avg_problem_solving);
  const avgCommunication = parseFloat(data.avg_communication);
  const avgLeadership = parseFloat(data.avg_leadership);

  const velocity = (avgTasks + avgVolume + avgProblemSolving) / 3;
  const friction = (velocity + avgCommunication) / 2;
  const cohesion = (avgProblemSolving + avgCommunication + avgLeadership) / 3;

  return {
    quarter: quarterLabel,
    velocity: Math.round(velocity * 100) / 100,
    friction: Math.round(friction * 100) / 100,
    cohesion: Math.round(cohesion * 100) / 100,
    review_count: parseInt(data.review_count)
  };
}

// Get employee's self-reflection status for the current week (with blind review support)
async function getMyReflectionStatus(req, res) {
  try {
    const { id: userId } = req.user;

    const currentWeekFriday = getMostRecentFriday();

    // Get previous week's Friday
    const prevFriday = new Date(currentWeekFriday);
    prevFriday.setDate(prevFriday.getDate() - 7);
    const previousWeekFriday = prevFriday.toISOString().split('T')[0];

    // Check for current week self-reflection
    const selfReflectionResult = await pool.query(
      `SELECT * FROM reviews
       WHERE employee_id = $1
       AND review_date = $2
       AND is_self_assessment = true`,
      [userId, currentWeekFriday]
    );

    // Check for current week manager review
    const managerReviewResult = await pool.query(
      `SELECT * FROM reviews
       WHERE employee_id = $1
       AND review_date = $2
       AND is_self_assessment = false`,
      [userId, currentWeekFriday]
    );

    // Check for previous week self-reflection
    const previousResult = await pool.query(
      `SELECT id FROM reviews
       WHERE employee_id = $1
       AND review_date = $2
       AND is_self_assessment = true`,
      [userId, previousWeekFriday]
    );

    const selfReflection = selfReflectionResult.rows[0] || null;
    const managerReview = managerReviewResult.rows[0] || null;
    const hasPreviousWeekReflection = previousResult.rows.length > 0;

    const selfCommitted = selfReflection?.is_committed || false;
    const managerCommitted = managerReview?.is_committed || false;
    const bothCommitted = selfCommitted && managerCommitted;

    // Get previous quarter averages for context
    const previousQuarterAverages = await getPreviousQuarterAverages(userId);

    // Build response - only reveal KPIs when both are committed
    const response = {
      current_week_friday: currentWeekFriday,
      previous_week_friday: previousWeekFriday,
      has_current_week_reflection: !!selfReflection,
      has_previous_week_reflection: hasPreviousWeekReflection,
      previous_quarter_averages: previousQuarterAverages,

      // Commit status
      self_committed: selfCommitted,
      manager_committed: managerCommitted,
      both_committed: bothCommitted,

      // Self reflection data (without KPIs unless both committed)
      self_reflection: selfReflection ? {
        id: selfReflection.id,
        review_date: selfReflection.review_date,
        is_committed: selfReflection.is_committed,
        achievements: selfReflection.achievements,
        goals: selfReflection.goals,
        areas_for_improvement: selfReflection.areas_for_improvement,
        // Only include ratings and KPIs if both committed
        ...(bothCommitted ? {
          tasks_completed: selfReflection.tasks_completed,
          work_volume: selfReflection.work_volume,
          problem_solving: selfReflection.problem_solving,
          communication: selfReflection.communication,
          leadership: selfReflection.leadership,
          ...calculateMetrics(selfReflection)
        } : {})
      } : null,

      // Manager review data (only visible when both committed)
      manager_review: bothCommitted && managerReview ? calculateMetrics(managerReview) : null
    };

    res.json(response);
  } catch (error) {
    console.error('Get my reflection status error:', error);
    res.status(500).json({ error: 'Failed to fetch reflection status' });
  }
}

// Create a self-reflection (any authenticated user can create their own)
async function createSelfReflection(req, res) {
  try {
    const { id: userId } = req.user;
    const {
      review_date,
      goals,
      achievements,
      areas_for_improvement,
      tasks_completed,
      work_volume,
      problem_solving,
      communication,
      leadership
    } = req.body;

    // Default to most recent Friday if no date provided
    const weekEndingDate = review_date || getMostRecentFriday();

    // Check if a self-reflection already exists for this week
    const existingResult = await pool.query(
      `SELECT id FROM reviews
       WHERE employee_id = $1
       AND review_date = $2
       AND is_self_assessment = true`,
      [userId, weekEndingDate]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already submitted a self-reflection for this week' });
    }

    const result = await pool.query(
      `INSERT INTO reviews (
        employee_id, reviewer_id, review_date,
        goals, achievements, areas_for_improvement,
        tasks_completed, work_volume, problem_solving, communication, leadership,
        is_self_assessment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *`,
      [
        userId,
        userId,
        weekEndingDate,
        goals || null,
        achievements || null,
        areas_for_improvement || null,
        tasks_completed || null,
        work_volume || null,
        problem_solving || null,
        communication || null,
        leadership || null
      ]
    );

    const review = result.rows[0];

    const namesResult = await pool.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [userId]
    );

    review.employee_name = namesResult.rows[0].full_name;
    review.reviewer_name = namesResult.rows[0].full_name;

    // Don't return KPIs - they're hidden until both commit
    res.status(201).json({
      message: 'Self-reflection created successfully',
      review: {
        id: review.id,
        review_date: review.review_date,
        is_committed: review.is_committed,
        is_self_assessment: review.is_self_assessment,
        employee_name: review.employee_name,
        reviewer_name: review.reviewer_name
      }
    });
  } catch (error) {
    console.error('Create self-reflection error:', error);
    res.status(500).json({ error: 'Failed to create self-reflection' });
  }
}

// Commit a self-reflection (any authenticated user can commit their own)
async function commitSelfReflection(req, res) {
  try {
    const { id: reviewId } = req.params;
    const { id: userId } = req.user;

    const existingReview = await pool.query(
      'SELECT * FROM reviews WHERE id = $1',
      [reviewId]
    );

    if (existingReview.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = existingReview.rows[0];

    // Must be a self-assessment
    if (!review.is_self_assessment) {
      return res.status(400).json({ error: 'This is not a self-reflection' });
    }

    // Must be the owner
    if (review.employee_id !== userId) {
      return res.status(403).json({ error: 'You can only commit your own self-reflections' });
    }

    if (review.is_committed) {
      return res.status(400).json({ error: 'Self-reflection is already committed' });
    }

    // Commit the self-reflection
    const result = await pool.query(
      `UPDATE reviews
       SET is_committed = true, committed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [reviewId]
    );

    const updatedReview = result.rows[0];

    // Check if manager has also committed for this week
    const managerReviewResult = await pool.query(
      `SELECT * FROM reviews
       WHERE employee_id = $1
       AND review_date = $2
       AND is_self_assessment = false
       AND is_committed = true`,
      [userId, updatedReview.review_date]
    );

    const managerCommitted = managerReviewResult.rows.length > 0;
    const bothCommitted = managerCommitted;

    // Only return full data if both committed
    if (bothCommitted) {
      res.json({
        message: 'Self-reflection committed successfully. Both reviews are now visible.',
        both_committed: true,
        self_reflection: calculateMetrics(updatedReview),
        manager_review: calculateMetrics(managerReviewResult.rows[0])
      });
    } else {
      res.json({
        message: 'Self-reflection committed successfully. Waiting for manager review.',
        both_committed: false,
        self_reflection: {
          id: updatedReview.id,
          review_date: updatedReview.review_date,
          is_committed: true
        }
      });
    }
  } catch (error) {
    console.error('Commit self-reflection error:', error);
    res.status(500).json({ error: 'Failed to commit self-reflection' });
  }
}

async function uncommitReview(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;

    // Only admin can uncommit
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can uncommit reviews' });
    }

    const existingReview = await pool.query(
      'SELECT * FROM reviews WHERE id = $1',
      [id]
    );

    if (existingReview.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = existingReview.rows[0];

    if (!review.is_committed) {
      return res.status(400).json({ error: 'Review is not committed' });
    }

    // Log the uncommit action to audit_log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value_json, new_value_json)
       VALUES ($1, 'UPDATE', 'reviews', $2, $3, $4)`,
      [
        userId,
        id,
        JSON.stringify({ is_committed: true, committed_at: review.committed_at }),
        JSON.stringify({ is_committed: false, committed_at: null })
      ]
    );

    const result = await pool.query(
      `UPDATE reviews
       SET is_committed = false, committed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const updatedReview = result.rows[0];

    const namesResult = await pool.query(
      `SELECT
        (SELECT full_name FROM users WHERE id = $1) as employee_name,
        (SELECT full_name FROM users WHERE id = $2) as reviewer_name`,
      [updatedReview.employee_id, updatedReview.reviewer_id]
    );

    updatedReview.employee_name = namesResult.rows[0].employee_name;
    updatedReview.reviewer_name = namesResult.rows[0].reviewer_name;

    res.json({ message: 'Review uncommitted successfully', review: calculateMetrics(updatedReview) });
  } catch (error) {
    console.error('Uncommit review error:', error);
    res.status(500).json({ error: 'Failed to uncommit review' });
  }
}

module.exports = {
  getReviews,
  getReviewById,
  getMyLatestReview,
  getMyReflectionStatus,
  createReview,
  createSelfReflection,
  commitSelfReflection,
  updateReview,
  commitReview,
  uncommitReview,
  getMostRecentFriday
};
