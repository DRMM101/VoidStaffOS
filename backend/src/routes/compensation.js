// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Compensation Routes
 * Chunk 11: Pay bands, salary records, benefits, review cycles,
 * pay reviews, pay slips, audit log, and reporting endpoints.
 *
 * Access control:
 *  - Employee (/me): own data only via req.user.id
 *  - Manager: direct reports only (users.manager_id = req.user.id), current salary only
 *  - HR/Admin: full access within tenant
 *  - Finance: same as HR for compensation data
 *  - Director: aggregate queries only, no individual records
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { logCompensationAudit, logFieldChanges, getClientIP } = require('../middleware/compensationAudit');
const { createNotification } = require('../controllers/notificationController');

// All compensation routes require authentication
router.use(authenticate);

// ============================================
// HELPER: Check if user is HR, Admin, or Finance
// ============================================
function isHROrAdmin(user) {
  return ['Admin', 'HR', 'Finance'].includes(user.role_name);
}

// ============================================
// HELPER: Check if user manages an employee
// ============================================
async function isManagerOf(managerId, employeeId, tenantId) {
  const result = await db.query(
    'SELECT 1 FROM users WHERE id = $1 AND manager_id = $2 AND tenant_id = $3',
    [employeeId, managerId, tenantId]
  );
  return result.rows.length > 0;
}

// ============================================
// PAY BANDS
// ============================================

// GET /api/compensation/pay-bands — List all pay bands for tenant
router.get('/pay-bands', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;

    const result = await db.query(
      `SELECT * FROM pay_bands
       WHERE tenant_id = $1
       ORDER BY grade ASC, band_name ASC`,
      [tenantId]
    );

    // Log the view access
    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'view',
      tableName: 'pay_bands', ipAddress: getClientIP(req)
    });

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List pay bands error:', err);
    res.status(500).json({ error: 'Failed to list pay bands' });
  }
});

// POST /api/compensation/pay-bands — Create a new pay band (HR/Admin only)
router.post('/pay-bands', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { band_name, grade, min_salary, mid_salary, max_salary, currency } = req.body;

    // Validate required fields
    if (!band_name || grade === undefined || !min_salary || !mid_salary || !max_salary) {
      return res.status(400).json({
        error: 'Missing required fields: band_name, grade, min_salary, mid_salary, max_salary'
      });
    }

    // Validate salary ordering: min <= mid <= max
    if (Number(min_salary) > Number(mid_salary) || Number(mid_salary) > Number(max_salary)) {
      return res.status(400).json({ error: 'Salary values must satisfy: min <= mid <= max' });
    }

    const result = await db.query(
      `INSERT INTO pay_bands (tenant_id, band_name, grade, min_salary, mid_salary, max_salary, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, band_name.trim(), grade, min_salary, mid_salary, max_salary, currency || 'GBP']
    );

    // Audit log
    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'create',
      tableName: 'pay_bands', recordId: result.rows[0].id,
      ipAddress: getClientIP(req)
    });

    res.status(201).json({ message: 'Pay band created', data: result.rows[0] });
  } catch (err) {
    // Handle unique constraint violation (duplicate band name)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pay band with this name already exists' });
    }
    console.error('Create pay band error:', err);
    res.status(500).json({ error: 'Failed to create pay band' });
  }
});

// PUT /api/compensation/pay-bands/:id — Update a pay band (HR/Admin only)
router.put('/pay-bands/:id', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { id } = req.params;
    const { band_name, grade, min_salary, mid_salary, max_salary, currency } = req.body;

    // Fetch existing record for audit comparison
    const existing = await db.query(
      'SELECT * FROM pay_bands WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Pay band not found' });
    }

    // Validate salary ordering if provided
    const newMin = min_salary !== undefined ? Number(min_salary) : Number(existing.rows[0].min_salary);
    const newMid = mid_salary !== undefined ? Number(mid_salary) : Number(existing.rows[0].mid_salary);
    const newMax = max_salary !== undefined ? Number(max_salary) : Number(existing.rows[0].max_salary);
    if (newMin > newMid || newMid > newMax) {
      return res.status(400).json({ error: 'Salary values must satisfy: min <= mid <= max' });
    }

    const result = await db.query(
      `UPDATE pay_bands SET
        band_name = COALESCE($1, band_name),
        grade = COALESCE($2, grade),
        min_salary = COALESCE($3, min_salary),
        mid_salary = COALESCE($4, mid_salary),
        max_salary = COALESCE($5, max_salary),
        currency = COALESCE($6, currency),
        updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [band_name, grade, min_salary, mid_salary, max_salary, currency, id, tenantId]
    );

    // Log field-level changes for audit
    await logFieldChanges({
      tenantId, employeeId: null, accessedBy: user.id,
      tableName: 'pay_bands', recordId: id,
      oldData: existing.rows[0], newData: result.rows[0],
      ipAddress: getClientIP(req)
    });

    res.json({ message: 'Pay band updated', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pay band with this name already exists' });
    }
    console.error('Update pay band error:', err);
    res.status(500).json({ error: 'Failed to update pay band' });
  }
});

// DELETE /api/compensation/pay-bands/:id — Delete a pay band (Admin only)
router.delete('/pay-bands/:id', authorize('Admin'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { id } = req.params;

    // Check if any compensation records reference this band
    const inUse = await db.query(
      'SELECT 1 FROM compensation_records WHERE pay_band_id = $1 LIMIT 1',
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: 'Cannot delete pay band — it is referenced by compensation records' });
    }

    const result = await db.query(
      'DELETE FROM pay_bands WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pay band not found' });
    }

    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'update',
      tableName: 'pay_bands', recordId: id,
      fieldChanged: 'deleted', oldValue: 'active', newValue: 'deleted',
      ipAddress: getClientIP(req)
    });

    res.json({ message: 'Pay band deleted' });
  } catch (err) {
    console.error('Delete pay band error:', err);
    res.status(500).json({ error: 'Failed to delete pay band' });
  }
});

// ============================================
// COMPENSATION RECORDS (salary history)
// ============================================

// GET /api/compensation/me — Employee views own compensation history
router.get('/me', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;

    // Get salary history
    const salary = await db.query(
      `SELECT cr.*, pb.band_name, pb.grade, pb.min_salary as band_min, pb.mid_salary as band_mid, pb.max_salary as band_max
       FROM compensation_records cr
       LEFT JOIN pay_bands pb ON cr.pay_band_id = pb.id
       WHERE cr.employee_id = $1 AND cr.tenant_id = $2
       ORDER BY cr.effective_date DESC`,
      [user.id, tenantId]
    );

    // Get active benefits
    const benefits = await db.query(
      `SELECT * FROM benefits
       WHERE employee_id = $1 AND tenant_id = $2 AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       ORDER BY start_date DESC`,
      [user.id, tenantId]
    );

    // Get pay slips
    const paySlips = await db.query(
      `SELECT * FROM pay_slips
       WHERE employee_id = $1 AND tenant_id = $2
       ORDER BY period_end DESC
       LIMIT 12`,
      [user.id, tenantId]
    );

    // Audit log — employee viewed own data
    await logCompensationAudit({
      tenantId, employeeId: user.id, accessedBy: user.id, action: 'view',
      tableName: 'compensation_records', ipAddress: getClientIP(req)
    });

    res.json({
      salary_history: salary.rows,
      current_salary: salary.rows[0] || null,
      benefits: benefits.rows,
      pay_slips: paySlips.rows
    });
  } catch (err) {
    console.error('Get own compensation error:', err);
    res.status(500).json({ error: 'Failed to retrieve compensation data' });
  }
});

// GET /api/compensation/employee/:id — View an employee's compensation (HR/Manager)
router.get('/employee/:id', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const employeeId = parseInt(req.params.id);

    // Access control: HR/Admin get full history, Managers get current salary only
    const isHR = isHROrAdmin(user);
    const isManager = user.role_name === 'Manager';

    if (!isHR && isManager) {
      // Verify this employee reports to the requesting manager
      const manages = await isManagerOf(user.id, employeeId, tenantId);
      if (!manages) {
        return res.status(403).json({ error: 'You can only view compensation for your direct reports' });
      }
    } else if (!isHR) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get salary history — managers only see current, HR sees all
    let salaryQuery;
    if (isManager && !isHR) {
      // Managers: current salary only (most recent record)
      salaryQuery = await db.query(
        `SELECT cr.*, pb.band_name, pb.grade
         FROM compensation_records cr
         LEFT JOIN pay_bands pb ON cr.pay_band_id = pb.id
         WHERE cr.employee_id = $1 AND cr.tenant_id = $2
         ORDER BY cr.effective_date DESC
         LIMIT 1`,
        [employeeId, tenantId]
      );
    } else {
      // HR/Admin: full salary history
      salaryQuery = await db.query(
        `SELECT cr.*, pb.band_name, pb.grade, pb.min_salary as band_min, pb.mid_salary as band_mid, pb.max_salary as band_max,
                u.full_name as created_by_name
         FROM compensation_records cr
         LEFT JOIN pay_bands pb ON cr.pay_band_id = pb.id
         LEFT JOIN users u ON cr.created_by = u.id
         WHERE cr.employee_id = $1 AND cr.tenant_id = $2
         ORDER BY cr.effective_date DESC`,
        [employeeId, tenantId]
      );
    }

    // Benefits (HR sees all, managers see active only)
    const benefitsQuery = isHR
      ? await db.query(
          'SELECT * FROM benefits WHERE employee_id = $1 AND tenant_id = $2 ORDER BY start_date DESC',
          [employeeId, tenantId]
        )
      : await db.query(
          `SELECT benefit_type, provider, frequency, start_date, end_date FROM benefits
           WHERE employee_id = $1 AND tenant_id = $2 AND (end_date IS NULL OR end_date >= CURRENT_DATE)
           ORDER BY start_date DESC`,
          [employeeId, tenantId]
        );

    // Pay slips (HR only)
    let paySlips = [];
    if (isHR) {
      const psResult = await db.query(
        'SELECT * FROM pay_slips WHERE employee_id = $1 AND tenant_id = $2 ORDER BY period_end DESC',
        [employeeId, tenantId]
      );
      paySlips = psResult.rows;
    }

    // Audit log
    await logCompensationAudit({
      tenantId, employeeId, accessedBy: user.id, action: 'view',
      tableName: 'compensation_records', ipAddress: getClientIP(req)
    });

    res.json({
      salary_history: salaryQuery.rows,
      current_salary: salaryQuery.rows[0] || null,
      benefits: benefitsQuery.rows,
      pay_slips: paySlips
    });
  } catch (err) {
    console.error('Get employee compensation error:', err);
    res.status(500).json({ error: 'Failed to retrieve compensation data' });
  }
});

// POST /api/compensation/records — Create a new compensation record (HR/Admin)
router.post('/records', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { employee_id, effective_date, base_salary, currency, fte_percentage, pay_band_id, reason } = req.body;

    // Validate required fields
    if (!employee_id || !effective_date || !base_salary) {
      return res.status(400).json({
        error: 'Missing required fields: employee_id, effective_date, base_salary'
      });
    }

    // Validate salary is positive
    if (Number(base_salary) <= 0) {
      return res.status(400).json({ error: 'Base salary must be a positive number' });
    }

    // Verify employee exists in tenant
    const emp = await db.query(
      'SELECT id, full_name FROM users WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );
    if (emp.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const result = await db.query(
      `INSERT INTO compensation_records
        (employee_id, tenant_id, effective_date, base_salary, currency, fte_percentage, pay_band_id, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [employee_id, tenantId, effective_date, base_salary, currency || 'GBP',
       fte_percentage || 100.00, pay_band_id || null, reason || null, user.id]
    );

    // Audit log
    await logCompensationAudit({
      tenantId, employeeId: employee_id, accessedBy: user.id, action: 'create',
      tableName: 'compensation_records', recordId: result.rows[0].id,
      ipAddress: getClientIP(req)
    });

    // Notify the employee about salary change
    await createNotification(
      employee_id, 'salary_change_applied', 'Salary Update',
      `A salary change has been recorded effective ${effective_date}.`,
      result.rows[0].id, 'compensation', tenantId
    );

    res.status(201).json({ message: 'Compensation record created', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A compensation record already exists for this employee on this date' });
    }
    console.error('Create compensation record error:', err);
    res.status(500).json({ error: 'Failed to create compensation record' });
  }
});

// ============================================
// BENEFITS
// ============================================

// GET /api/compensation/benefits/:employeeId — List benefits for an employee
router.get('/benefits/:employeeId', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const employeeId = parseInt(req.params.employeeId);

    // Employees can view own benefits, HR/Admin can view any, Managers can view direct reports
    if (user.id !== employeeId && !isHROrAdmin(user)) {
      if (user.role_name === 'Manager') {
        const manages = await isManagerOf(user.id, employeeId, tenantId);
        if (!manages) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const result = await db.query(
      `SELECT * FROM benefits
       WHERE employee_id = $1 AND tenant_id = $2
       ORDER BY start_date DESC`,
      [employeeId, tenantId]
    );

    await logCompensationAudit({
      tenantId, employeeId, accessedBy: user.id, action: 'view',
      tableName: 'benefits', ipAddress: getClientIP(req)
    });

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List benefits error:', err);
    res.status(500).json({ error: 'Failed to list benefits' });
  }
});

// POST /api/compensation/benefits — Create a benefit (HR/Admin/Finance)
router.post('/benefits', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const {
      employee_id, benefit_type, provider, description, value,
      employer_contribution, employee_contribution, frequency, start_date, end_date
    } = req.body;

    // Validate required fields
    if (!employee_id || !benefit_type || !start_date) {
      return res.status(400).json({
        error: 'Missing required fields: employee_id, benefit_type, start_date'
      });
    }

    // Validate benefit_type enum
    const validTypes = ['pension', 'healthcare', 'car', 'bonus', 'stock', 'allowance', 'other'];
    if (!validTypes.includes(benefit_type)) {
      return res.status(400).json({ error: `Invalid benefit type. Must be one of: ${validTypes.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO benefits
        (employee_id, tenant_id, benefit_type, provider, description, value,
         employer_contribution, employee_contribution, frequency, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [employee_id, tenantId, benefit_type, provider || null, description || null,
       value || null, employer_contribution || null, employee_contribution || null,
       frequency || 'monthly', start_date, end_date || null, user.id]
    );

    await logCompensationAudit({
      tenantId, employeeId: employee_id, accessedBy: user.id, action: 'create',
      tableName: 'benefits', recordId: result.rows[0].id,
      ipAddress: getClientIP(req)
    });

    // Notify employee
    await createNotification(
      employee_id, 'benefit_added', 'New Benefit Added',
      `A ${benefit_type} benefit has been added to your record.`,
      result.rows[0].id, 'compensation', tenantId
    );

    res.status(201).json({ message: 'Benefit created', data: result.rows[0] });
  } catch (err) {
    console.error('Create benefit error:', err);
    res.status(500).json({ error: 'Failed to create benefit' });
  }
});

// PUT /api/compensation/benefits/:id — Update a benefit (HR/Admin/Finance)
router.put('/benefits/:id', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { id } = req.params;

    // Fetch existing
    const existing = await db.query(
      'SELECT * FROM benefits WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Benefit not found' });
    }

    const {
      benefit_type, provider, description, value,
      employer_contribution, employee_contribution, frequency, start_date, end_date
    } = req.body;

    const result = await db.query(
      `UPDATE benefits SET
        benefit_type = COALESCE($1, benefit_type),
        provider = COALESCE($2, provider),
        description = COALESCE($3, description),
        value = COALESCE($4, value),
        employer_contribution = COALESCE($5, employer_contribution),
        employee_contribution = COALESCE($6, employee_contribution),
        frequency = COALESCE($7, frequency),
        start_date = COALESCE($8, start_date),
        end_date = $9,
        updated_at = NOW()
       WHERE id = $10 AND tenant_id = $11
       RETURNING *`,
      [benefit_type, provider, description, value,
       employer_contribution, employee_contribution, frequency,
       start_date, end_date !== undefined ? end_date : existing.rows[0].end_date,
       id, tenantId]
    );

    await logFieldChanges({
      tenantId, employeeId: existing.rows[0].employee_id, accessedBy: user.id,
      tableName: 'benefits', recordId: id,
      oldData: existing.rows[0], newData: result.rows[0],
      ipAddress: getClientIP(req)
    });

    res.json({ message: 'Benefit updated', data: result.rows[0] });
  } catch (err) {
    console.error('Update benefit error:', err);
    res.status(500).json({ error: 'Failed to update benefit' });
  }
});

// DELETE /api/compensation/benefits/:id — Delete a benefit (HR/Admin)
router.delete('/benefits/:id', authorize('Admin', 'HR'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { id } = req.params;

    const existing = await db.query(
      'SELECT * FROM benefits WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Benefit not found' });
    }

    await db.query('DELETE FROM benefits WHERE id = $1 AND tenant_id = $2', [id, tenantId]);

    await logCompensationAudit({
      tenantId, employeeId: existing.rows[0].employee_id, accessedBy: user.id,
      action: 'update', tableName: 'benefits', recordId: id,
      fieldChanged: 'deleted', oldValue: 'active', newValue: 'deleted',
      ipAddress: getClientIP(req)
    });

    res.json({ message: 'Benefit deleted' });
  } catch (err) {
    console.error('Delete benefit error:', err);
    res.status(500).json({ error: 'Failed to delete benefit' });
  }
});

// ============================================
// REVIEW CYCLES
// ============================================

// GET /api/compensation/review-cycles — List review cycles
router.get('/review-cycles', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const { status, year } = req.query;

    let whereClause = 'WHERE tenant_id = $1';
    const params = [tenantId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (year) {
      whereClause += ` AND year = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    const result = await db.query(
      `SELECT rc.*,
              (SELECT COUNT(*) FROM pay_reviews WHERE review_cycle_id = rc.id) as review_count,
              (SELECT COUNT(*) FROM pay_reviews WHERE review_cycle_id = rc.id AND status = 'approved') as approved_count
       FROM review_cycles rc
       ${whereClause}
       ORDER BY rc.year DESC, rc.start_date DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List review cycles error:', err);
    res.status(500).json({ error: 'Failed to list review cycles' });
  }
});

// POST /api/compensation/review-cycles — Create a review cycle (HR/Admin)
router.post('/review-cycles', authorize('Admin', 'HR'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { name, year, budget_total, start_date, end_date } = req.body;

    if (!name || !year || !start_date || !end_date) {
      return res.status(400).json({
        error: 'Missing required fields: name, year, start_date, end_date'
      });
    }

    const result = await db.query(
      `INSERT INTO review_cycles (tenant_id, name, year, budget_total, budget_remaining, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name.trim(), year, budget_total || null, start_date, end_date, user.id]
    );

    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'create',
      tableName: 'review_cycles', recordId: result.rows[0].id,
      ipAddress: getClientIP(req)
    });

    res.status(201).json({ message: 'Review cycle created', data: result.rows[0] });
  } catch (err) {
    console.error('Create review cycle error:', err);
    res.status(500).json({ error: 'Failed to create review cycle' });
  }
});

// PUT /api/compensation/review-cycles/:id — Update a review cycle (HR/Admin)
router.put('/review-cycles/:id', authorize('Admin', 'HR'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { id } = req.params;

    const existing = await db.query(
      'SELECT * FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Review cycle not found' });
    }

    const { name, year, budget_total, budget_remaining, start_date, end_date, status } = req.body;

    const result = await db.query(
      `UPDATE review_cycles SET
        name = COALESCE($1, name),
        year = COALESCE($2, year),
        budget_total = COALESCE($3, budget_total),
        budget_remaining = COALESCE($4, budget_remaining),
        start_date = COALESCE($5, start_date),
        end_date = COALESCE($6, end_date),
        status = COALESCE($7, status),
        updated_at = NOW()
       WHERE id = $8 AND tenant_id = $9
       RETURNING *`,
      [name, year, budget_total, budget_remaining, start_date, end_date, status, id, tenantId]
    );

    await logFieldChanges({
      tenantId, employeeId: null, accessedBy: user.id,
      tableName: 'review_cycles', recordId: id,
      oldData: existing.rows[0], newData: result.rows[0],
      ipAddress: getClientIP(req)
    });

    // If status changed to 'open', notify relevant users
    if (status === 'open' && existing.rows[0].status !== 'open') {
      // Notify all managers in the tenant
      const managers = await db.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.tenant_id = $1 AND r.role_name = 'Manager' AND u.employment_status = 'active'`,
        [tenantId]
      );
      for (const mgr of managers.rows) {
        await createNotification(
          mgr.id, 'review_cycle_opened', 'Pay Review Cycle Opened',
          `The ${name || existing.rows[0].name} pay review cycle is now open for submissions.`,
          id, 'compensation', tenantId
        );
      }
    }

    res.json({ message: 'Review cycle updated', data: result.rows[0] });
  } catch (err) {
    console.error('Update review cycle error:', err);
    res.status(500).json({ error: 'Failed to update review cycle' });
  }
});

// ============================================
// PAY REVIEWS
// ============================================

// GET /api/compensation/reviews — List pay reviews (filtered by role)
router.get('/reviews', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { review_cycle_id, status } = req.query;

    let whereClause = 'WHERE pr.tenant_id = $1';
    const params = [tenantId];
    let paramIndex = 2;

    // Role-based filtering
    if (user.role_name === 'Manager' && !isHROrAdmin(user)) {
      // Managers see only their direct reports
      whereClause += ` AND pr.manager_id = $${paramIndex}`;
      params.push(user.id);
      paramIndex++;
    } else if (!isHROrAdmin(user)) {
      // Regular employees see only their own reviews
      whereClause += ` AND pr.employee_id = $${paramIndex}`;
      params.push(user.id);
      paramIndex++;
    }

    if (review_cycle_id) {
      whereClause += ` AND pr.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }
    if (status) {
      whereClause += ` AND pr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await db.query(
      `SELECT pr.*,
              u.full_name as employee_name,
              m.full_name as manager_name,
              rc.name as cycle_name
       FROM pay_reviews pr
       JOIN users u ON pr.employee_id = u.id
       LEFT JOIN users m ON pr.manager_id = m.id
       JOIN review_cycles rc ON pr.review_cycle_id = rc.id
       ${whereClause}
       ORDER BY pr.created_at DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List pay reviews error:', err);
    res.status(500).json({ error: 'Failed to list pay reviews' });
  }
});

// POST /api/compensation/reviews — Create a pay review (Manager/HR/Admin)
router.post('/reviews', authorize('Admin', 'HR', 'Finance', 'Manager'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { review_cycle_id, employee_id, current_salary, proposed_salary, manager_notes } = req.body;

    if (!review_cycle_id || !employee_id || !current_salary) {
      return res.status(400).json({
        error: 'Missing required fields: review_cycle_id, employee_id, current_salary'
      });
    }

    // Verify the review cycle exists and is open
    const cycle = await db.query(
      'SELECT * FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [review_cycle_id, tenantId]
    );
    if (cycle.rows.length === 0) {
      return res.status(404).json({ error: 'Review cycle not found' });
    }
    if (cycle.rows[0].status !== 'open' && cycle.rows[0].status !== 'planning') {
      return res.status(400).json({ error: 'Review cycle is not accepting new reviews' });
    }

    // Managers can only create reviews for their direct reports
    if (user.role_name === 'Manager' && !isHROrAdmin(user)) {
      const manages = await isManagerOf(user.id, employee_id, tenantId);
      if (!manages) {
        return res.status(403).json({ error: 'You can only create reviews for your direct reports' });
      }
    }

    const result = await db.query(
      `INSERT INTO pay_reviews
        (tenant_id, review_cycle_id, employee_id, current_salary, proposed_salary, manager_id, manager_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, review_cycle_id, employee_id, current_salary, proposed_salary || null,
       user.id, manager_notes || null]
    );

    await logCompensationAudit({
      tenantId, employeeId: employee_id, accessedBy: user.id, action: 'create',
      tableName: 'pay_reviews', recordId: result.rows[0].id,
      ipAddress: getClientIP(req)
    });

    res.status(201).json({ message: 'Pay review created', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pay review already exists for this employee in this cycle' });
    }
    console.error('Create pay review error:', err);
    res.status(500).json({ error: 'Failed to create pay review' });
  }
});

// PUT /api/compensation/reviews/:id — Update a pay review (role-dependent fields)
router.put('/reviews/:id', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { id } = req.params;

    const existing = await db.query(
      'SELECT * FROM pay_reviews WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Pay review not found' });
    }

    const review = existing.rows[0];
    const { proposed_salary, manager_notes, hr_notes, finance_notes, status, effective_date } = req.body;

    // Build update fields based on user role
    let updates = {};

    // Manager can update proposed_salary and manager_notes on draft/submitted reviews
    if (user.role_name === 'Manager' || isHROrAdmin(user)) {
      if (proposed_salary !== undefined) updates.proposed_salary = proposed_salary;
      if (manager_notes !== undefined) updates.manager_notes = manager_notes;
    }

    // HR can update HR-specific fields
    if (['Admin', 'HR'].includes(user.role_name)) {
      if (hr_notes !== undefined) updates.hr_notes = hr_notes;
      if (status !== undefined) updates.status = status;
      if (effective_date !== undefined) updates.effective_date = effective_date;
    }

    // Finance can add finance notes and approve
    if (['Admin', 'Finance'].includes(user.role_name)) {
      if (finance_notes !== undefined) updates.finance_notes = finance_notes;
    }

    // Status transition handling
    if (status === 'submitted' && review.status === 'draft') {
      updates.status = 'submitted';
    } else if (status === 'hr_review' && review.status === 'submitted') {
      updates.status = 'hr_review';
      updates.hr_approved_by = user.id;
    } else if (status === 'approved' && ['hr_review', 'submitted'].includes(review.status)) {
      if (!['Admin', 'HR'].includes(user.role_name)) {
        return res.status(403).json({ error: 'Only HR/Admin can approve pay reviews' });
      }
      updates.status = 'approved';
      updates.approved_salary = req.body.approved_salary || review.proposed_salary;
      updates.hr_approved_by = user.id;
    } else if (status === 'rejected') {
      if (!isHROrAdmin(user)) {
        return res.status(403).json({ error: 'Only HR/Admin can reject pay reviews' });
      }
      updates.status = 'rejected';
    } else if (status === 'applied' && review.status === 'approved') {
      if (!isHROrAdmin(user)) {
        return res.status(403).json({ error: 'Only HR/Admin can apply pay reviews' });
      }
      updates.status = 'applied';

      // Create a new compensation record when applying
      const effectiveDate = review.effective_date || new Date().toISOString().split('T')[0];
      const approvedAmount = review.approved_salary || review.proposed_salary;

      if (approvedAmount) {
        await db.query(
          `INSERT INTO compensation_records
            (employee_id, tenant_id, effective_date, base_salary, created_by, reason)
           VALUES ($1, $2, $3, $4, $5, 'Pay review applied')
           ON CONFLICT (employee_id, effective_date) DO UPDATE SET base_salary = $4`,
          [review.employee_id, tenantId, effectiveDate, approvedAmount, user.id]
        );

        // Update budget remaining
        const salaryDiff = Number(approvedAmount) - Number(review.current_salary);
        if (salaryDiff > 0) {
          await db.query(
            `UPDATE review_cycles SET budget_remaining = budget_remaining - $1, updated_at = NOW()
             WHERE id = $2`,
            [salaryDiff, review.review_cycle_id]
          );
        }

        // Notify employee
        await createNotification(
          review.employee_id, 'salary_change_applied', 'Salary Change Applied',
          `Your salary has been updated effective ${effectiveDate}.`,
          id, 'compensation', tenantId
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Build dynamic UPDATE query
    const setClauses = [];
    const updateParams = [];
    let pIdx = 1;
    for (const [key, val] of Object.entries(updates)) {
      setClauses.push(`${key} = $${pIdx}`);
      updateParams.push(val);
      pIdx++;
    }
    setClauses.push(`updated_at = NOW()`);
    updateParams.push(id, tenantId);

    const result = await db.query(
      `UPDATE pay_reviews SET ${setClauses.join(', ')}
       WHERE id = $${pIdx} AND tenant_id = $${pIdx + 1}
       RETURNING *`,
      updateParams
    );

    // Audit log
    await logFieldChanges({
      tenantId, employeeId: review.employee_id, accessedBy: user.id,
      tableName: 'pay_reviews', recordId: id,
      oldData: review, newData: result.rows[0],
      ipAddress: getClientIP(req)
    });

    // Notifications for status changes
    if (status === 'submitted') {
      // Notify HR about new submission
      const hrUsers = await db.query(
        `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
         WHERE u.tenant_id = $1 AND r.role_name IN ('HR', 'Admin') AND u.employment_status = 'active'`,
        [tenantId]
      );
      for (const hr of hrUsers.rows) {
        await createNotification(
          hr.id, 'pay_review_submitted', 'Pay Review Submitted',
          `A pay review has been submitted for approval.`,
          id, 'compensation', tenantId
        );
      }
    } else if (status === 'approved') {
      await createNotification(
        review.employee_id, 'pay_review_approved', 'Pay Review Approved',
        'Your pay review has been approved.',
        id, 'compensation', tenantId
      );
    } else if (status === 'rejected') {
      await createNotification(
        review.manager_id || review.employee_id, 'pay_review_rejected', 'Pay Review Rejected',
        'A pay review has been rejected.',
        id, 'compensation', tenantId
      );
    }

    res.json({ message: 'Pay review updated', data: result.rows[0] });
  } catch (err) {
    console.error('Update pay review error:', err);
    res.status(500).json({ error: 'Failed to update pay review' });
  }
});

// ============================================
// PAY SLIPS
// ============================================

// GET /api/compensation/pay-slips/me — Employee views own pay slips
router.get('/pay-slips/me', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;

    const result = await db.query(
      `SELECT * FROM pay_slips
       WHERE employee_id = $1 AND tenant_id = $2
       ORDER BY period_end DESC`,
      [user.id, tenantId]
    );

    await logCompensationAudit({
      tenantId, employeeId: user.id, accessedBy: user.id, action: 'view',
      tableName: 'pay_slips', ipAddress: getClientIP(req)
    });

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get own pay slips error:', err);
    res.status(500).json({ error: 'Failed to retrieve pay slips' });
  }
});

// POST /api/compensation/pay-slips — Upload a pay slip reference (HR/Admin/Finance)
router.post('/pay-slips', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;
    const { employee_id, period_start, period_end, document_id } = req.body;

    if (!employee_id || !period_start || !period_end) {
      return res.status(400).json({
        error: 'Missing required fields: employee_id, period_start, period_end'
      });
    }

    const result = await db.query(
      `INSERT INTO pay_slips (employee_id, tenant_id, period_start, period_end, document_id, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [employee_id, tenantId, period_start, period_end, document_id || null, user.id]
    );

    await logCompensationAudit({
      tenantId, employeeId: employee_id, accessedBy: user.id, action: 'create',
      tableName: 'pay_slips', recordId: result.rows[0].id,
      ipAddress: getClientIP(req)
    });

    res.status(201).json({ message: 'Pay slip recorded', data: result.rows[0] });
  } catch (err) {
    console.error('Create pay slip error:', err);
    res.status(500).json({ error: 'Failed to create pay slip record' });
  }
});

// ============================================
// DASHBOARD & STATS (HR/Finance/Admin)
// ============================================

// GET /api/compensation/stats — Dashboard statistics
router.get('/stats', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;

    // Total annual payroll (sum of most recent salary for each employee)
    const payroll = await db.query(
      `SELECT COALESCE(SUM(cr.base_salary * cr.fte_percentage / 100), 0) as total_payroll,
              COALESCE(AVG(cr.base_salary), 0) as avg_salary,
              COUNT(DISTINCT cr.employee_id) as employee_count
       FROM compensation_records cr
       INNER JOIN (
         SELECT employee_id, MAX(effective_date) as latest_date
         FROM compensation_records
         WHERE tenant_id = $1
         GROUP BY employee_id
       ) latest ON cr.employee_id = latest.employee_id AND cr.effective_date = latest.latest_date
       WHERE cr.tenant_id = $1`,
      [tenantId]
    );

    // Active review cycles
    const activeCycles = await db.query(
      `SELECT COUNT(*) as count FROM review_cycles
       WHERE tenant_id = $1 AND status IN ('open', 'in_review')`,
      [tenantId]
    );

    // Upcoming salary changes (effective date in next 30 days)
    const upcoming = await db.query(
      `SELECT COUNT(*) as count FROM compensation_records
       WHERE tenant_id = $1 AND effective_date > CURRENT_DATE AND effective_date <= CURRENT_DATE + INTERVAL '30 days'`,
      [tenantId]
    );

    // Pending pay reviews
    const pendingReviews = await db.query(
      `SELECT COUNT(*) as count FROM pay_reviews
       WHERE tenant_id = $1 AND status IN ('draft', 'submitted', 'hr_review')`,
      [tenantId]
    );

    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'view',
      tableName: 'compensation_records', ipAddress: getClientIP(req)
    });

    res.json({
      total_payroll: Number(payroll.rows[0].total_payroll),
      average_salary: Number(payroll.rows[0].avg_salary),
      employee_count: Number(payroll.rows[0].employee_count),
      active_review_cycles: Number(activeCycles.rows[0].count),
      upcoming_changes: Number(upcoming.rows[0].count),
      pending_reviews: Number(pendingReviews.rows[0].count)
    });
  } catch (err) {
    console.error('Compensation stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve compensation statistics' });
  }
});

// ============================================
// REPORTS (HR/Admin/Director — aggregates only for Director)
// ============================================

// GET /api/compensation/reports/gender-pay-gap
router.get('/reports/gender-pay-gap', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;

    // Gender pay gap analysis by pay band
    // NOTE: groups by pay band only since the users table does not have a gender column yet
    // When a gender column is added, update the GROUP BY to include u.gender
    const result = await db.query(
      `SELECT
         pb.band_name,
         pb.grade,
         COUNT(*) as employee_count,
         AVG(cr.base_salary) as mean_salary,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cr.base_salary) as median_salary,
         MIN(cr.base_salary) as min_salary,
         MAX(cr.base_salary) as max_salary
       FROM compensation_records cr
       INNER JOIN (
         SELECT employee_id, MAX(effective_date) as latest_date
         FROM compensation_records WHERE tenant_id = $1
         GROUP BY employee_id
       ) latest ON cr.employee_id = latest.employee_id AND cr.effective_date = latest.latest_date
       JOIN users u ON cr.employee_id = u.id
       LEFT JOIN pay_bands pb ON cr.pay_band_id = pb.id
       WHERE cr.tenant_id = $1
       GROUP BY pb.band_name, pb.grade
       ORDER BY pb.grade`,
      [tenantId]
    );

    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'export',
      tableName: 'compensation_records', ipAddress: getClientIP(req)
    });

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Gender pay gap report error:', err);
    res.status(500).json({ error: 'Failed to generate gender pay gap report' });
  }
});

// GET /api/compensation/reports/department-costs
router.get('/reports/department-costs', authorize('Admin', 'HR', 'Finance'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;

    // Department cost breakdown
    // NOTE: users table has no department column yet — groups by role instead
    // When a department column is added, update GROUP BY to use u.department
    const result = await db.query(
      `SELECT
         r.role_name as department,
         COUNT(DISTINCT cr.employee_id) as headcount,
         SUM(cr.base_salary) as total_cost,
         AVG(cr.base_salary) as avg_salary,
         MIN(cr.base_salary) as min_salary,
         MAX(cr.base_salary) as max_salary
       FROM compensation_records cr
       INNER JOIN (
         SELECT employee_id, MAX(effective_date) as latest_date
         FROM compensation_records WHERE tenant_id = $1
         GROUP BY employee_id
       ) latest ON cr.employee_id = latest.employee_id AND cr.effective_date = latest.latest_date
       JOIN users u ON cr.employee_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE cr.tenant_id = $1
       GROUP BY r.role_name
       ORDER BY total_cost DESC`,
      [tenantId]
    );

    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'export',
      tableName: 'compensation_records', ipAddress: getClientIP(req)
    });

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Department costs report error:', err);
    res.status(500).json({ error: 'Failed to generate department costs report' });
  }
});

// GET /api/compensation/reports/aggregates — Director-level aggregate view
router.get('/reports/aggregates', authorize('Admin', 'HR', 'Finance', 'Director'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const user = req.user;

    // Directors and above get aggregate-only data — no individual records
    const payroll = await db.query(
      `SELECT
         COUNT(DISTINCT cr.employee_id) as total_employees,
         AVG(cr.base_salary) as company_avg_salary,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cr.base_salary) as company_median_salary,
         MIN(cr.base_salary) as company_min_salary,
         MAX(cr.base_salary) as company_max_salary,
         SUM(cr.base_salary) as total_payroll
       FROM compensation_records cr
       INNER JOIN (
         SELECT employee_id, MAX(effective_date) as latest_date
         FROM compensation_records WHERE tenant_id = $1
         GROUP BY employee_id
       ) latest ON cr.employee_id = latest.employee_id AND cr.effective_date = latest.latest_date
       WHERE cr.tenant_id = $1`,
      [tenantId]
    );

    // Benefits summary
    const benefitsSummary = await db.query(
      `SELECT
         benefit_type,
         COUNT(*) as count,
         AVG(value) as avg_value
       FROM benefits
       WHERE tenant_id = $1 AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       GROUP BY benefit_type
       ORDER BY count DESC`,
      [tenantId]
    );

    await logCompensationAudit({
      tenantId, accessedBy: user.id, action: 'view',
      tableName: 'compensation_records', ipAddress: getClientIP(req)
    });

    res.json({
      payroll_summary: payroll.rows[0],
      benefits_summary: benefitsSummary.rows
    });
  } catch (err) {
    console.error('Aggregate report error:', err);
    res.status(500).json({ error: 'Failed to generate aggregate report' });
  }
});

// ============================================
// AUDIT LOG (HR/Admin only)
// ============================================

// GET /api/compensation/audit — View compensation audit log
router.get('/audit', authorize('Admin', 'HR'), async (req, res) => {
  try {
    const tenantId = req.session?.tenantId || 1;
    const { employee_id, action, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE cal.tenant_id = $1';
    const params = [tenantId];
    let paramIndex = 2;

    if (employee_id) {
      whereClause += ` AND cal.employee_id = $${paramIndex}`;
      params.push(parseInt(employee_id));
      paramIndex++;
    }
    if (action) {
      whereClause += ` AND cal.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    if (start_date) {
      whereClause += ` AND cal.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      whereClause += ` AND cal.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    const result = await db.query(
      `SELECT cal.*,
              u.full_name as accessed_by_name,
              e.full_name as employee_name
       FROM compensation_audit_log cal
       JOIN users u ON cal.accessed_by = u.id
       LEFT JOIN users e ON cal.employee_id = e.id
       ${whereClause}
       ORDER BY cal.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Count total for pagination
    const countResult = await db.query(
      `SELECT COUNT(*) FROM compensation_audit_log cal ${whereClause}`,
      params
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Audit log query error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

module.exports = router;
