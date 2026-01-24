/**
 * @fileoverview User Controller - Employee management operations
 *
 * Handles user CRUD, manager assignments, employee transfers, and adoptions.
 * Implements role-based visibility where users only see employees they
 * have permission to manage.
 *
 * Tier System:
 * - Tier 1: Executive Level
 * - Tier 2: Senior Level
 * - Tier 3: Mid Level
 * - Tier 4: Junior Level
 * - Tier 5: Entry Level
 * - null: Administrator (outside tier hierarchy)
 *
 * @module controllers/userController
 */

const pool = require('../config/database');
const bcrypt = require('bcrypt');
const {
  notifyEmployeeTransferred,
  notifyNewDirectReport
} = require('./notificationController');

/** @constant {number} SALT_ROUNDS - Bcrypt salt rounds for password hashing */
const SALT_ROUNDS = 10;

/**
 * Get list of users with role-based filtering
 *
 * Visibility rules:
 * - Admin/Compliance: See all users
 * - Manager: See self + direct reports only
 * - Employee: See self + anyone they manage
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from JWT
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with users array
 * @authorization Admin, Manager, Employee (filtered)
 */
async function getUsers(req, res) {
  try {
    const { role_name, id: userId } = req.user;
    let query;
    let params = [];

    if (role_name === 'Admin' || role_name === 'Compliance Officer') {
      // Admin/Compliance sees everyone
      query = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.tier,
               r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.tier NULLS FIRST, u.full_name
      `;
    } else if (role_name === 'Manager') {
      // Managers see themselves and their direct reports only
      query = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.tier,
               r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 OR u.manager_id = $1
        ORDER BY u.tier, u.full_name
      `;
      params = [userId];
    } else {
      // Employees see only themselves and anyone they manage (if any)
      query = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.tier,
               r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 OR u.manager_id = $1
        ORDER BY u.full_name
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;

    // Visibility check
    if (role_name !== 'Admin' && role_name !== 'Compliance Officer') {
      // Check if user can see this employee
      const visibilityCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND (id = $2 OR manager_id = $2)',
        [id, userId]
      );
      if (visibilityCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You do not have permission to view this employee' });
      }
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
              u.start_date, u.end_date, u.created_at, u.employee_number,
              u.manager_id, u.manager_contact_email, u.manager_contact_phone, u.tier,
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

// Get full employee profile with manager details
async function getUserProfile(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;

    // Check permissions - users can see their own profile, managers can see their team, admins can see all
    if (role_name !== 'Admin' && role_name !== 'Compliance Officer') {
      if (role_name === 'Manager') {
        const teamCheck = await pool.query(
          'SELECT id FROM users WHERE id = $1 AND (manager_id = $2 OR id = $2)',
          [id, userId]
        );
        if (teamCheck.rows.length === 0) {
          return res.status(403).json({ error: 'You can only view profiles of your team members' });
        }
      } else if (parseInt(id) !== userId) {
        return res.status(403).json({ error: 'You can only view your own profile' });
      }
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
              u.start_date, u.end_date, u.created_at, u.employee_number,
              u.manager_id, u.manager_contact_email, u.manager_contact_phone, u.tier,
              r.role_name,
              m.full_name as manager_name,
              m.email as manager_email,
              m.employee_number as manager_employee_number
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Build manager info object
    const managerInfo = user.manager_id ? {
      id: user.manager_id,
      name: user.manager_name,
      email: user.manager_contact_email || user.manager_email,
      phone: user.manager_contact_phone || null,
      employee_number: user.manager_employee_number
    } : null;

    // Calculate tenure
    const startDate = new Date(user.start_date);
    const now = new Date();
    const tenureMonths = Math.floor((now - startDate) / (1000 * 60 * 60 * 24 * 30));
    const tenureYears = Math.floor(tenureMonths / 12);
    const remainingMonths = tenureMonths % 12;

    res.json({
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        employee_number: user.employee_number,
        role_id: user.role_id,
        role_name: user.role_name,
        tier: user.tier,
        employment_status: user.employment_status,
        start_date: user.start_date,
        end_date: user.end_date,
        tenure: {
          years: tenureYears,
          months: remainingMonths,
          display: tenureYears > 0 ? `${tenureYears}y ${remainingMonths}m` : `${remainingMonths}m`
        },
        manager: managerInfo,
        has_manager: !!user.manager_id,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

async function createUser(req, res) {
  try {
    const { email, password, full_name, role_id, start_date, employee_number, manager_id, tier } = req.body;

    if (!email || !password || !full_name || !role_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Check if employee_number is unique (if provided)
    if (employee_number) {
      const empNumCheck = await pool.query('SELECT id FROM users WHERE employee_number = $1', [employee_number]);
      if (empNumCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Employee number already exists' });
      }
    }

    // Determine tier based on role if not provided
    const roleResult = await pool.query('SELECT role_name FROM roles WHERE id = $1', [role_id]);
    const roleName = roleResult.rows[0]?.role_name;

    let userTier = tier;
    if (userTier === undefined) {
      // Default tiers: Admin=null, Manager=2, Employee=4, others=3
      if (roleName === 'Admin') userTier = null;
      else if (roleName === 'Manager') userTier = 2;
      else if (roleName === 'Employee') userTier = 4;
      else userTier = 3;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const startDateValue = start_date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role_id, start_date, created_by, employee_number, manager_id, tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, full_name, role_id, employment_status, start_date, created_at, employee_number, manager_id, tier`,
      [email, full_name, password_hash, role_id, startDateValue, req.user.id, employee_number || null, manager_id || null, userTier]
    );

    const user = result.rows[0];
    user.role_name = roleName;

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

// Assign a manager to an employee (Admin or Manager can do this)
async function assignManager(req, res) {
  try {
    const { id } = req.params;
    const { manager_id, manager_contact_email, manager_contact_phone } = req.body;
    const { role_name, id: userId } = req.user;

    // Check if employee exists
    const employeeCheck = await pool.query('SELECT id, manager_id FROM users WHERE id = $1', [id]);
    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check permissions
    if (role_name !== 'Admin') {
      if (role_name === 'Manager') {
        // Managers can only assign employees to themselves or reassign their own team
        const currentManager = employeeCheck.rows[0].manager_id;
        if (currentManager && currentManager !== userId && parseInt(manager_id) !== userId) {
          return res.status(403).json({ error: 'You can only assign employees to yourself or manage your own team' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Validate manager exists and has appropriate role
    if (manager_id) {
      const managerCheck = await pool.query(
        `SELECT u.id, r.role_name FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1 AND r.role_name IN ('Admin', 'Manager')`,
        [manager_id]
      );
      if (managerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid manager - must be an Admin or Manager' });
      }
    }

    // Prevent self-assignment as manager
    if (parseInt(id) === parseInt(manager_id)) {
      return res.status(400).json({ error: 'Cannot assign user as their own manager' });
    }

    // Update the employee's manager
    const result = await pool.query(
      `UPDATE users
       SET manager_id = $1,
           manager_contact_email = $2,
           manager_contact_phone = $3
       WHERE id = $4
       RETURNING id, email, full_name, manager_id, employee_number`,
      [manager_id || null, manager_contact_email || null, manager_contact_phone || null, id]
    );

    // Log the action
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value_json, new_value_json)
       VALUES ($1, 'UPDATE', 'users', $2, $3, $4)`,
      [
        userId,
        id,
        JSON.stringify({ manager_id: employeeCheck.rows[0].manager_id }),
        JSON.stringify({ manager_id: manager_id || null })
      ]
    );

    // Get the new manager's details
    let managerInfo = null;
    if (manager_id) {
      const managerResult = await pool.query(
        'SELECT id, full_name, email, employee_number FROM users WHERE id = $1',
        [manager_id]
      );
      if (managerResult.rows.length > 0) {
        managerInfo = managerResult.rows[0];
      }
    }

    res.json({
      message: manager_id ? 'Manager assigned successfully' : 'Manager removed successfully',
      employee: result.rows[0],
      manager: managerInfo
    });
  } catch (error) {
    console.error('Assign manager error:', error);
    res.status(500).json({ error: 'Failed to assign manager' });
  }
}

// Manager can adopt/claim an unassigned employee (only lower tier)
async function adoptEmployee(req, res) {
  try {
    const { employeeId } = req.params;
    const { role_name, id: userId } = req.user;

    // Only Managers and Admins can adopt
    if (role_name !== 'Manager' && role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only managers can adopt employees' });
    }

    // Get manager's tier
    const managerCheck = await pool.query(
      'SELECT tier FROM users WHERE id = $1',
      [userId]
    );
    const managerTier = managerCheck.rows[0]?.tier;

    // Check if employee exists and has no manager
    const employeeCheck = await pool.query(
      'SELECT id, full_name, manager_id, tier FROM users WHERE id = $1',
      [employeeId]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeCheck.rows[0];

    // Check if already has a manager (only admins can override)
    if (employee.manager_id && role_name !== 'Admin') {
      return res.status(400).json({
        error: 'This employee already has a manager. Only admins can reassign employees.'
      });
    }

    // Prevent self-adoption
    if (parseInt(employeeId) === userId) {
      return res.status(400).json({ error: 'Cannot adopt yourself' });
    }

    // Tier check: Managers can only adopt employees with a higher tier number (lower level)
    // Admin (tier=null) can adopt anyone
    if (role_name !== 'Admin' && managerTier !== null) {
      if (employee.tier === null) {
        return res.status(403).json({ error: 'Cannot adopt an Admin' });
      }
      if (employee.tier <= managerTier) {
        return res.status(403).json({
          error: `Cannot adopt employees at your tier level or above. Your tier: ${managerTier}, Employee tier: ${employee.tier}`
        });
      }
    }

    // Adopt the employee
    const result = await pool.query(
      `UPDATE users
       SET manager_id = $1
       WHERE id = $2
       RETURNING id, email, full_name, manager_id, employee_number, tier`,
      [userId, employeeId]
    );

    // Log the action
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value_json, new_value_json)
       VALUES ($1, 'UPDATE', 'users', $2, $3, $4)`,
      [
        userId,
        employeeId,
        JSON.stringify({ manager_id: employee.manager_id }),
        JSON.stringify({ manager_id: userId })
      ]
    );

    // Get manager details
    const managerResult = await pool.query(
      'SELECT id, full_name, email, employee_number, tier FROM users WHERE id = $1',
      [userId]
    );

    // Notify manager of new direct report
    await notifyNewDirectReport(userId, parseInt(employeeId), employee.full_name, true);

    res.json({
      message: `Successfully adopted ${employee.full_name}`,
      employee: result.rows[0],
      manager: managerResult.rows[0]
    });
  } catch (error) {
    console.error('Adopt employee error:', error);
    res.status(500).json({ error: 'Failed to adopt employee' });
  }
}

// Get list of managers for dropdown
async function getManagers(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.employee_number, u.tier, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.role_name IN ('Admin', 'Manager')
       AND u.employment_status = 'active'
       ORDER BY u.tier NULLS FIRST, u.full_name`
    );
    res.json({ managers: result.rows });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
}

// Get orphaned employees (no manager assigned) - filtered by tier for managers
async function getOrphanedEmployees(req, res) {
  try {
    const { role_name, id: userId } = req.user;

    if (role_name !== 'Admin' && role_name !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get the requesting user's tier
    const userResult = await pool.query('SELECT tier FROM users WHERE id = $1', [userId]);
    const userTier = userResult.rows[0]?.tier;

    let query;
    let params = [];

    if (role_name === 'Admin') {
      // Admins see all orphaned employees except other admins
      query = `
        SELECT u.id, u.full_name, u.email, u.employee_number, u.start_date, u.tier,
               r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.manager_id IS NULL
        AND u.employment_status = 'active'
        AND r.role_name NOT IN ('Admin')
        ORDER BY u.tier NULLS FIRST, u.full_name
      `;
    } else {
      // Managers only see orphaned employees below their tier
      query = `
        SELECT u.id, u.full_name, u.email, u.employee_number, u.start_date, u.tier,
               r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.manager_id IS NULL
        AND u.employment_status = 'active'
        AND r.role_name NOT IN ('Admin')
        AND u.tier > $1
        ORDER BY u.tier, u.full_name
      `;
      params = [userTier];
    }

    const result = await pool.query(query, params);

    res.json({ orphaned_employees: result.rows, user_tier: userTier });
  } catch (error) {
    console.error('Get orphaned employees error:', error);
    res.status(500).json({ error: 'Failed to fetch orphaned employees' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { email, full_name, role_id, employment_status, start_date, end_date, password, employee_number, manager_id, tier } = req.body;

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

    if (employee_number) {
      const empNumCheck = await pool.query('SELECT id FROM users WHERE employee_number = $1 AND id != $2', [employee_number, id]);
      if (empNumCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Employee number already in use' });
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
    if (employee_number !== undefined) { updates.push(`employee_number = $${paramCount++}`); values.push(employee_number || null); }
    if (manager_id !== undefined) { updates.push(`manager_id = $${paramCount++}`); values.push(manager_id || null); }
    if (tier !== undefined) { updates.push(`tier = $${paramCount++}`); values.push(tier); }
    if (password) {
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    query += updates.join(', ') + ` WHERE id = $${paramCount} RETURNING id, email, full_name, role_id, employment_status, start_date, end_date, employee_number, manager_id, tier`;
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
               u.start_date, u.end_date, u.created_at, u.manager_id, u.employee_number, u.tier,
               r.role_name,
               (SELECT MAX(review_date) FROM reviews WHERE employee_id = u.id AND is_self_assessment = false) as last_review_date,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $1 AND is_self_assessment = false) as current_week_review_count,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $2 AND is_self_assessment = false) as previous_week_review_count
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.tier NULLS FIRST, u.full_name
      `;
      params = [currentWeekFriday, previousWeekFriday];
    } else if (role_name === 'Manager') {
      baseQuery = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.manager_id, u.employee_number, u.tier,
               r.role_name,
               (SELECT MAX(review_date) FROM reviews WHERE employee_id = u.id AND is_self_assessment = false) as last_review_date,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $2 AND is_self_assessment = false) as current_week_review_count,
               (SELECT COUNT(*) FROM reviews WHERE employee_id = u.id AND review_date = $3 AND is_self_assessment = false) as previous_week_review_count
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.manager_id = $1
        ORDER BY u.tier, u.full_name
      `;
      params = [userId, currentWeekFriday, previousWeekFriday];
    } else {
      // Regular employees only see themselves
      baseQuery = `
        SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
               u.start_date, u.end_date, u.created_at, u.manager_id, u.employee_number, u.tier,
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

// Transfer an employee to a new manager or orphan them
async function transferEmployee(req, res) {
  try {
    const { id } = req.params;
    const { new_manager_id, orphan } = req.body;
    const { role_name, id: userId } = req.user;

    // Get the employee
    const employeeResult = await pool.query(
      `SELECT u.id, u.full_name, u.manager_id, u.tier, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];
    const oldManagerId = employee.manager_id;

    // Check permissions: Admin can transfer anyone, Manager can only transfer their own direct reports
    if (role_name !== 'Admin') {
      if (employee.manager_id !== userId) {
        return res.status(403).json({ error: 'You can only transfer your own direct reports' });
      }
    }

    // Cannot transfer yourself
    if (parseInt(id) === userId) {
      return res.status(400).json({ error: 'You cannot transfer yourself' });
    }

    let newManagerId = null;
    let actionMessage;

    if (orphan === true) {
      // Orphan the employee (remove manager)
      newManagerId = null;
      actionMessage = `${employee.full_name} has been orphaned (manager removed)`;
    } else if (new_manager_id) {
      // Validate new manager exists and has appropriate tier
      const newManagerResult = await pool.query(
        `SELECT u.id, u.full_name, u.tier, r.role_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1 AND r.role_name IN ('Admin', 'Manager')`,
        [new_manager_id]
      );

      if (newManagerResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid new manager - must be an Admin or Manager' });
      }

      const newManager = newManagerResult.rows[0];

      // Tier check for non-admin transfers
      if (role_name !== 'Admin' && newManager.tier !== null && employee.tier !== null) {
        if (employee.tier <= newManager.tier) {
          return res.status(400).json({
            error: `Cannot transfer to a manager at the same or lower tier. Employee tier: ${employee.tier}, New manager tier: ${newManager.tier}`
          });
        }
      }

      // Cannot transfer to self
      if (parseInt(new_manager_id) === parseInt(id)) {
        return res.status(400).json({ error: 'Cannot assign employee as their own manager' });
      }

      newManagerId = new_manager_id;
      actionMessage = `${employee.full_name} has been transferred to ${newManager.full_name}`;
    } else {
      return res.status(400).json({ error: 'Must specify new_manager_id or orphan: true' });
    }

    // Perform the transfer
    const result = await pool.query(
      `UPDATE users
       SET manager_id = $1
       WHERE id = $2
       RETURNING id, email, full_name, manager_id, employee_number, tier`,
      [newManagerId, id]
    );

    // Log the action
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value_json, new_value_json)
       VALUES ($1, 'TRANSFER', 'users', $2, $3, $4)`,
      [
        userId,
        id,
        JSON.stringify({ manager_id: oldManagerId, action: 'transfer_out' }),
        JSON.stringify({ manager_id: newManagerId, action: orphan ? 'orphaned' : 'transfer_in' })
      ]
    );

    // Get new manager details if applicable
    let newManagerInfo = null;
    if (newManagerId) {
      const managerResult = await pool.query(
        'SELECT id, full_name, email, employee_number FROM users WHERE id = $1',
        [newManagerId]
      );
      newManagerInfo = managerResult.rows[0];
    }

    // Send notifications to all parties involved
    await notifyEmployeeTransferred(
      parseInt(id),
      oldManagerId,
      newManagerId ? parseInt(newManagerId) : null,
      employee.full_name
    );

    res.json({
      message: actionMessage,
      employee: result.rows[0],
      new_manager: newManagerInfo,
      previous_manager_id: oldManagerId
    });
  } catch (error) {
    console.error('Transfer employee error:', error);
    res.status(500).json({ error: 'Failed to transfer employee' });
  }
}

// Get eligible transfer targets (managers who can receive this employee based on tier)
async function getTransferTargets(req, res) {
  try {
    const { id } = req.params;
    const { role_name, id: userId } = req.user;

    // Get the employee's tier
    const employeeResult = await pool.query(
      'SELECT id, tier, manager_id FROM users WHERE id = $1',
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Check permissions
    if (role_name !== 'Admin' && employee.manager_id !== userId) {
      return res.status(403).json({ error: 'You can only view transfer targets for your direct reports' });
    }

    // Get eligible managers (lower tier number = higher rank, so they can manage higher tier numbers)
    let query;
    let params = [];

    if (role_name === 'Admin' || employee.tier === null) {
      // Admin can transfer to any manager
      query = `
        SELECT u.id, u.full_name, u.email, u.employee_number, u.tier, r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.role_name IN ('Admin', 'Manager')
        AND u.employment_status = 'active'
        AND u.id != $1
        ORDER BY u.tier NULLS FIRST, u.full_name
      `;
      params = [id];
    } else {
      // For non-admins, only show managers with lower tier numbers
      query = `
        SELECT u.id, u.full_name, u.email, u.employee_number, u.tier, r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.role_name IN ('Admin', 'Manager')
        AND u.employment_status = 'active'
        AND u.id != $1
        AND (u.tier IS NULL OR u.tier < $2)
        ORDER BY u.tier NULLS FIRST, u.full_name
      `;
      params = [id, employee.tier];
    }

    const result = await pool.query(query, params);
    res.json({ eligible_managers: result.rows, employee_tier: employee.tier });
  } catch (error) {
    console.error('Get transfer targets error:', error);
    res.status(500).json({ error: 'Failed to fetch transfer targets' });
  }
}

/**
 * Get team performance summary for manager dashboard
 * Includes team members with latest KPIs, averages, and staleness
 */
async function getTeamSummary(req, res) {
  try {
    const { role_name, id: userId } = req.user;

    if (role_name !== 'Admin' && role_name !== 'Manager') {
      return res.status(403).json({ error: 'Only managers can view team summary' });
    }

    // Get current Friday for staleness calculations
    const currentFriday = getMostRecentFriday();
    const today = new Date();

    // Get team members with their latest committed manager review
    let query;
    let params;

    if (role_name === 'Admin') {
      // Admin sees all employees with managers
      query = `
        SELECT
          u.id, u.full_name, u.email, u.tier, u.employee_number,
          r.role_name,
          u.manager_id,
          (SELECT full_name FROM users WHERE id = u.manager_id) as manager_name,
          latest_review.review_date as last_review_date,
          latest_review.tasks_completed,
          latest_review.work_volume,
          latest_review.problem_solving,
          latest_review.communication,
          latest_review.leadership
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN LATERAL (
          SELECT rev.review_date, rev.tasks_completed, rev.work_volume,
                 rev.problem_solving, rev.communication, rev.leadership
          FROM reviews rev
          WHERE rev.employee_id = u.id
            AND rev.is_self_assessment = false
            AND rev.manager_committed = true
          ORDER BY rev.review_date DESC
          LIMIT 1
        ) latest_review ON true
        WHERE u.employment_status = 'active'
          AND r.role_name NOT IN ('Admin')
        ORDER BY u.tier NULLS FIRST, u.full_name
      `;
      params = [];
    } else {
      // Manager sees only their direct reports
      query = `
        SELECT
          u.id, u.full_name, u.email, u.tier, u.employee_number,
          r.role_name,
          u.manager_id,
          latest_review.review_date as last_review_date,
          latest_review.tasks_completed,
          latest_review.work_volume,
          latest_review.problem_solving,
          latest_review.communication,
          latest_review.leadership
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN LATERAL (
          SELECT rev.review_date, rev.tasks_completed, rev.work_volume,
                 rev.problem_solving, rev.communication, rev.leadership
          FROM reviews rev
          WHERE rev.employee_id = u.id
            AND rev.is_self_assessment = false
            AND rev.manager_committed = true
          ORDER BY rev.review_date DESC
          LIMIT 1
        ) latest_review ON true
        WHERE u.manager_id = $1
          AND u.employment_status = 'active'
        ORDER BY u.tier NULLS FIRST, u.full_name
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    // Calculate KPIs and staleness for each team member
    const teamMembers = result.rows.map(member => {
      // Calculate composite KPIs
      let velocity = null;
      let friction = null;
      let cohesion = null;

      if (member.tasks_completed !== null && member.work_volume !== null && member.problem_solving !== null) {
        velocity = Math.round((member.tasks_completed + member.work_volume + member.problem_solving) / 3 * 100) / 100;
      }
      if (velocity !== null && member.communication !== null) {
        friction = Math.round((velocity + member.communication) / 2 * 100) / 100;
      }
      if (member.problem_solving !== null && member.communication !== null && member.leadership !== null) {
        cohesion = Math.round((member.problem_solving + member.communication + member.leadership) / 3 * 100) / 100;
      }

      // Calculate staleness
      let daysSinceReview = null;
      let isOverdue = false;
      let stalenessStatus = 'none'; // none, current, stale, overdue

      if (member.last_review_date) {
        const lastReview = new Date(member.last_review_date);
        daysSinceReview = Math.floor((today - lastReview) / (1000 * 60 * 60 * 24));

        if (daysSinceReview <= 7) {
          stalenessStatus = 'current';
        } else if (daysSinceReview <= 14) {
          stalenessStatus = 'stale';
        } else {
          stalenessStatus = 'overdue';
          isOverdue = true;
        }
      } else {
        stalenessStatus = 'overdue';
        isOverdue = true;
      }

      // Get status colors
      const getStatus = (value) => {
        if (value === null) return null;
        if (value < 5) return 'red';
        if (value < 6.5) return 'amber';
        return 'green';
      };

      return {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        tier: member.tier,
        role_name: member.role_name,
        employee_number: member.employee_number,
        manager_id: member.manager_id,
        manager_name: member.manager_name,
        last_review_date: member.last_review_date,
        days_since_review: daysSinceReview,
        staleness_status: stalenessStatus,
        is_overdue: isOverdue,
        kpis: {
          velocity: {
            value: velocity,
            status: getStatus(velocity)
          },
          friction: {
            value: friction,
            status: getStatus(friction)
          },
          cohesion: {
            value: cohesion,
            status: getStatus(cohesion)
          }
        },
        raw_metrics: {
          tasks_completed: member.tasks_completed,
          work_volume: member.work_volume,
          problem_solving: member.problem_solving,
          communication: member.communication,
          leadership: member.leadership
        }
      };
    });

    // Calculate team averages (only from members with KPI data)
    const membersWithKpis = teamMembers.filter(m => m.kpis.velocity.value !== null);

    let teamAverages = {
      velocity: { value: null, status: null },
      friction: { value: null, status: null },
      cohesion: { value: null, status: null }
    };

    if (membersWithKpis.length > 0) {
      const avgVelocity = Math.round(
        membersWithKpis.reduce((sum, m) => sum + m.kpis.velocity.value, 0) / membersWithKpis.length * 100
      ) / 100;

      const avgFriction = Math.round(
        membersWithKpis.filter(m => m.kpis.friction.value !== null)
          .reduce((sum, m) => sum + m.kpis.friction.value, 0) /
        membersWithKpis.filter(m => m.kpis.friction.value !== null).length * 100
      ) / 100;

      const avgCohesion = Math.round(
        membersWithKpis.filter(m => m.kpis.cohesion.value !== null)
          .reduce((sum, m) => sum + m.kpis.cohesion.value, 0) /
        membersWithKpis.filter(m => m.kpis.cohesion.value !== null).length * 100
      ) / 100;

      const getStatus = (value) => {
        if (value === null || isNaN(value)) return null;
        if (value < 5) return 'red';
        if (value < 6.5) return 'amber';
        return 'green';
      };

      teamAverages = {
        velocity: { value: avgVelocity, status: getStatus(avgVelocity) },
        friction: { value: avgFriction || null, status: getStatus(avgFriction) },
        cohesion: { value: avgCohesion || null, status: getStatus(avgCohesion) }
      };
    }

    // Count alerts
    const overdueCount = teamMembers.filter(m => m.is_overdue).length;
    const redKpiCount = teamMembers.filter(m =>
      m.kpis.velocity.status === 'red' ||
      m.kpis.friction.status === 'red' ||
      m.kpis.cohesion.status === 'red'
    ).length;

    res.json({
      team_members: teamMembers,
      team_averages: teamAverages,
      summary: {
        total_members: teamMembers.length,
        members_with_kpis: membersWithKpis.length,
        overdue_reviews: overdueCount,
        needs_attention: redKpiCount
      },
      current_week_friday: currentFriday
    });
  } catch (error) {
    console.error('Get team summary error:', error);
    res.status(500).json({ error: 'Failed to fetch team summary' });
  }
}

module.exports = {
  getUsers,
  getUserById,
  getUserProfile,
  createUser,
  updateUser,
  getRoles,
  getEmployeesByManager,
  getUsersWithReviewStatus,
  assignManager,
  adoptEmployee,
  transferEmployee,
  getTransferTargets,
  getManagers,
  getOrphanedEmployees,
  getTeamSummary
};
