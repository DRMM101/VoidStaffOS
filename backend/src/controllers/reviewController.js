const pool = require('../config/database');

async function getReviews(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    let query;
    let params = [];

    if (role_name === 'Admin' || role_name === 'Compliance Officer') {
      // Admin and Compliance Officer can see all reviews
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
      // Managers can see reviews they created or for their team members
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
      // Employees can only see their own reviews
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
    res.json({ reviews: result.rows });
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

    // Check permissions
    if (role_name === 'Admin' || role_name === 'Compliance Officer') {
      // Can view any review
    } else if (role_name === 'Manager') {
      // Can view if they are the reviewer or the employee reports to them
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
      // Employees can only view their own reviews
      if (review.employee_id !== userId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    res.json({ review });
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
      review_date,
      period_start,
      period_end,
      goals,
      achievements,
      areas_for_improvement,
      overall_rating,
      status
    } = req.body;

    // Validate required fields
    if (!employee_id || !review_date || !period_start || !period_end) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if manager can review this employee
    if (role_name === 'Manager') {
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
    }

    const result = await pool.query(
      `INSERT INTO reviews (
        employee_id, reviewer_id, review_date, period_start, period_end,
        goals, achievements, areas_for_improvement, overall_rating, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        employee_id,
        userId,
        review_date,
        period_start,
        period_end,
        goals || null,
        achievements || null,
        areas_for_improvement || null,
        overall_rating || null,
        status || 'draft'
      ]
    );

    const review = result.rows[0];

    // Get employee and reviewer names
    const namesResult = await pool.query(
      `SELECT
        (SELECT full_name FROM users WHERE id = $1) as employee_name,
        (SELECT full_name FROM users WHERE id = $2) as reviewer_name`,
      [review.employee_id, review.reviewer_id]
    );

    review.employee_name = namesResult.rows[0].employee_name;
    review.reviewer_name = namesResult.rows[0].reviewer_name;

    res.status(201).json({ message: 'Review created successfully', review });
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
      period_start,
      period_end,
      goals,
      achievements,
      areas_for_improvement,
      overall_rating,
      status
    } = req.body;

    // Check if review exists
    const existingReview = await pool.query(
      'SELECT * FROM reviews WHERE id = $1',
      [id]
    );

    if (existingReview.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = existingReview.rows[0];

    // Check permissions
    if (role_name === 'Manager') {
      // Managers can only edit their own reviews
      if (review.reviewer_id !== userId) {
        return res.status(403).json({ error: 'You can only edit your own reviews' });
      }
    } else if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (review_date) { updates.push(`review_date = $${paramCount++}`); values.push(review_date); }
    if (period_start) { updates.push(`period_start = $${paramCount++}`); values.push(period_start); }
    if (period_end) { updates.push(`period_end = $${paramCount++}`); values.push(period_end); }
    if (goals !== undefined) { updates.push(`goals = $${paramCount++}`); values.push(goals); }
    if (achievements !== undefined) { updates.push(`achievements = $${paramCount++}`); values.push(achievements); }
    if (areas_for_improvement !== undefined) { updates.push(`areas_for_improvement = $${paramCount++}`); values.push(areas_for_improvement); }
    if (overall_rating !== undefined) { updates.push(`overall_rating = $${paramCount++}`); values.push(overall_rating); }
    if (status) { updates.push(`status = $${paramCount++}`); values.push(status); }

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

    // Get employee and reviewer names
    const namesResult = await pool.query(
      `SELECT
        (SELECT full_name FROM users WHERE id = $1) as employee_name,
        (SELECT full_name FROM users WHERE id = $2) as reviewer_name`,
      [updatedReview.employee_id, updatedReview.reviewer_id]
    );

    updatedReview.employee_name = namesResult.rows[0].employee_name;
    updatedReview.reviewer_name = namesResult.rows[0].reviewer_name;

    res.json({ message: 'Review updated successfully', review: updatedReview });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
}

module.exports = {
  getReviews,
  getReviewById,
  createReview,
  updateReview
};
