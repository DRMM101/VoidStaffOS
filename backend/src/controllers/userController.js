const pool = require('../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function getUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
              u.start_date, u.end_date, u.created_at,
              r.role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.full_name`
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
              u.start_date, u.end_date, u.created_at,
              r.role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

async function createUser(req, res) {
  try {
    const { email, password, full_name, role_id, start_date } = req.body;

    if (!email || !password || !full_name || !role_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const startDateValue = start_date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role_id, start_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role_id, employment_status, start_date, created_at`,
      [email, full_name, password_hash, role_id, startDateValue, req.user.id]
    );

    const user = result.rows[0];
    const roleResult = await pool.query('SELECT role_name FROM roles WHERE id = $1', [role_id]);
    user.role_name = roleResult.rows[0]?.role_name;

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { email, full_name, role_id, employment_status, start_date, end_date, password } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    let query = `UPDATE users SET `;
    const values = [];
    const updates = [];
    let paramCount = 1;

    if (email) { updates.push(`email = $${paramCount++}`); values.push(email); }
    if (full_name) { updates.push(`full_name = $${paramCount++}`); values.push(full_name); }
    if (role_id) { updates.push(`role_id = $${paramCount++}`); values.push(role_id); }
    if (employment_status) { updates.push(`employment_status = $${paramCount++}`); values.push(employment_status); }
    if (start_date) { updates.push(`start_date = $${paramCount++}`); values.push(start_date); }
    if (end_date !== undefined) { updates.push(`end_date = $${paramCount++}`); values.push(end_date || null); }
    if (password) {
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    query += updates.join(', ') + ` WHERE id = $${paramCount} RETURNING id, email, full_name, role_id, employment_status, start_date, end_date`;
    values.push(id);

    const result = await pool.query(query, values);
    const user = result.rows[0];

    const roleResult = await pool.query('SELECT role_name FROM roles WHERE id = $1', [user.role_id]);
    user.role_name = roleResult.rows[0]?.role_name;

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

async function getRoles(req, res) {
  try {
    const result = await pool.query('SELECT id, role_name FROM roles ORDER BY id');
    res.json({ roles: result.rows });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
}

async function getEmployeesByManager(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    let query;
    let params = [];

    if (role_name === 'Admin') {
      // Admin can see all active employees
      query = `
        SELECT u.id, u.full_name, u.email, r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.employment_status = 'active'
        ORDER BY u.full_name
      `;
    } else if (role_name === 'Manager') {
      // Managers can only see their team members
      query = `
        SELECT u.id, u.full_name, u.email, r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.manager_id = $1 AND u.employment_status = 'active'
        ORDER BY u.full_name
      `;
      params = [userId];
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(query, params);
    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get employees by manager error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
}

// Helper to get the most recent Friday
function getMostRecentFriday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 5 ? 0 : (day < 5 ? day + 2 : day - 5);
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

// Helper to get previous Friday
function getPreviousFriday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 5 ? 7 : (day < 5 ? day + 2 : day - 5) + 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

// Get users with their review status for the employees table
async function getUsersWithReviewStatus(req, res) {
  try {
    const { role_name, id: userId } = req.user;

    // Get current and previous week's Fridays
    const currentWeekFriday = getMostRecentFriday();
    const previousWeekFriday = getPreviousFriday();
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const isFriday = dayOfWeek === 5;

    let baseQuery;
    let params = [];

    if (role_name === 'Admin') {
      baseQuery = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.manager_id,
               r.role_name,
               (SELECT MAX(review_date) FROM reviews WHERE employee_id = u.id AND is_self_assessment = false) as last_review_date,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $1 AND is_self_assessment = false) as current_week_review_count,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $2 AND is_self_assessment = false) as previous_week_review_count
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.full_name
      `;
      params = [currentWeekFriday, previousWeekFriday];
    } else if (role_name === 'Manager') {
      baseQuery = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.manager_id,
               r.role_name,
               (SELECT MAX(review_date) FROM reviews WHERE employee_id = u.id AND is_self_assessment = false) as last_review_date,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $2 AND is_self_assessment = false) as current_week_review_count,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $3 AND is_self_assessment = false) as previous_week_review_count
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.manager_id = $1
        ORDER BY u.full_name
      `;
      params = [userId, currentWeekFriday, previousWeekFriday];
    } else {
      // Regular employees only see themselves
      baseQuery = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.manager_id,
               r.role_name,
               (SELECT MAX(review_date) FROM reviews WHERE employee_id = u.id AND is_self_assessment = false) as last_review_date,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $2 AND is_self_assessment = false) as current_week_review_count,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $3 AND is_self_assessment = false) as previous_week_review_count
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
        ORDER BY u.full_name
      `;
      params = [userId, currentWeekFriday, previousWeekFriday];
    }

    const result = await pool.query(baseQuery, params);

    // Calculate review status for each user
    const users = result.rows.map(user => {
      const hasCurrentWeekReview = parseInt(user.current_week_review_count) > 0;
      const hasPreviousWeekReview = parseInt(user.previous_week_review_count) > 0;

      let reviewStatus;
      let reviewStatusColor;

      if (hasCurrentWeekReview) {
        reviewStatus = 'complete';
        reviewStatusColor = 'green';
      } else if (isFriday) {
        reviewStatus = 'due_today';
        reviewStatusColor = 'green';
      } else if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        // Monday-Thursday
        reviewStatus = 'upcoming';
        reviewStatusColor = 'amber';
      } else {
        // Saturday or Sunday after Friday, no review
        if (!hasPreviousWeekReview && !hasCurrentWeekReview) {
          reviewStatus = 'overdue';
          reviewStatusColor = 'red';
        } else {
          reviewStatus = 'upcoming';
          reviewStatusColor = 'amber';
        }
      }

      // Check for missed weeks - if last review is more than 2 weeks ago
      let missedWeeks = 0;
      if (user.last_review_date) {
        const lastReview = new Date(user.last_review_date);
        const diffTime = today - lastReview;
        const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
        missedWeeks = Math.max(0, diffWeeks - 1); // -1 because current week might not be done yet
      }

      return {
        ...user,
        current_week_friday: currentWeekFriday,
        has_current_week_review: hasCurrentWeekReview,
        has_previous_week_review: hasPreviousWeekReview,
        review_status: reviewStatus,
        review_status_color: reviewStatusColor,
        missed_weeks: missedWeeks
      };
    });

    res.json({ users, current_week_friday: currentWeekFriday, is_friday: isFriday });
  } catch (error) {
    console.error('Get users with review status error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  getRoles,
  getEmployeesByManager,
  getUsersWithReviewStatus
};
