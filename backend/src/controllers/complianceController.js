/**
 * VoidStaffOS - Compliance Controller
 * RTW, DBS checks and compliance task management.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

const pool = require('../config/database');

// ===========================================
// HELPER FUNCTIONS
// ===========================================

const isHR = (user) => user && (user.role_name === 'Admin' || user.role_name === 'HR Manager');
const isManager = (user) => user && user.role_name === 'Manager';

// ===========================================
// RTW CHECK CRUD
// ===========================================

const getRTWChecks = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { employee_id, status } = req.query;

    let query = `
      SELECT r.*,
             u.full_name as employee_name,
             u.employee_number,
             cb.full_name as checked_by_name,
             ed.filename as document_path,
             ed.original_filename as document_name
      FROM rtw_checks r
      JOIN users u ON r.employee_id = u.id
      JOIN users cb ON r.checked_by = cb.id
      LEFT JOIN employee_documents ed ON r.document_id = ed.id
      WHERE r.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (employee_id) {
      query += ` AND r.employee_id = $${paramCount++}`;
      params.push(employee_id);
    }

    if (status) {
      query += ` AND r.status = $${paramCount++}`;
      params.push(status);
    }

    query += ' ORDER BY r.check_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching RTW checks:', error);
    res.status(500).json({ error: 'Failed to fetch RTW checks' });
  }
};

const getRTWCheck = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const result = await pool.query(`
      SELECT r.*,
             u.full_name as employee_name,
             u.employee_number,
             cb.full_name as checked_by_name,
             ed.filename as document_path,
             ed.original_filename as document_name
      FROM rtw_checks r
      JOIN users u ON r.employee_id = u.id
      JOIN users cb ON r.checked_by = cb.id
      LEFT JOIN employee_documents ed ON r.document_id = ed.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RTW check not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching RTW check:', error);
    res.status(500).json({ error: 'Failed to fetch RTW check' });
  }
};

const createRTWCheck = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can create RTW checks' });
    }

    const tenantId = req.user.tenant_id;
    const checkedBy = req.user.id;
    const {
      employee_id,
      document_id,
      check_type,
      document_reference,
      immigration_status,
      check_date,
      expiry_date,
      followup_date,
      verification_method,
      notes
    } = req.body;

    if (!employee_id || !check_type || !check_date) {
      return res.status(400).json({ error: 'Employee, check type, and check date are required' });
    }

    const result = await pool.query(`
      INSERT INTO rtw_checks (
        tenant_id, employee_id, document_id, check_type, document_reference,
        immigration_status, check_date, expiry_date, followup_date,
        checked_by, verification_method, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      tenantId, employee_id, document_id || null, check_type, document_reference,
      immigration_status, check_date, expiry_date || null, followup_date || null,
      checkedBy, verification_method, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating RTW check:', error);
    res.status(500).json({ error: 'Failed to create RTW check' });
  }
};

const updateRTWCheck = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can update RTW checks' });
    }

    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const {
      document_id,
      check_type,
      document_reference,
      immigration_status,
      check_date,
      expiry_date,
      followup_date,
      verification_method,
      status,
      notes
    } = req.body;

    // Convert empty strings to null for date fields
    const toDateOrNull = (val) => (val && val.trim() !== '') ? val : null;

    const result = await pool.query(`
      UPDATE rtw_checks SET
        document_id = COALESCE($1, document_id),
        check_type = COALESCE($2, check_type),
        document_reference = COALESCE($3, document_reference),
        immigration_status = COALESCE($4, immigration_status),
        check_date = COALESCE($5, check_date),
        expiry_date = $6,
        followup_date = $7,
        verification_method = COALESCE($8, verification_method),
        status = COALESCE($9, status),
        notes = COALESCE($10, notes)
      WHERE id = $11 AND tenant_id = $12
      RETURNING *
    `, [
      document_id, check_type, document_reference, immigration_status,
      toDateOrNull(check_date), toDateOrNull(expiry_date), toDateOrNull(followup_date), verification_method,
      status, notes, id, tenantId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RTW check not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating RTW check:', error);
    res.status(500).json({ error: 'Failed to update RTW check' });
  }
};

// ===========================================
// DBS CHECK CRUD
// ===========================================

const getDBSChecks = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { employee_id, status } = req.query;

    let query = `
      SELECT d.*,
             u.full_name as employee_name,
             u.employee_number,
             cb.full_name as checked_by_name,
             ed.filename as document_path,
             ed.original_filename as document_name
      FROM dbs_checks d
      JOIN users u ON d.employee_id = u.id
      JOIN users cb ON d.checked_by = cb.id
      LEFT JOIN employee_documents ed ON d.document_id = ed.id
      WHERE d.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (employee_id) {
      query += ` AND d.employee_id = $${paramCount++}`;
      params.push(employee_id);
    }

    if (status) {
      query += ` AND d.status = $${paramCount++}`;
      params.push(status);
    }

    query += ' ORDER BY d.issue_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching DBS checks:', error);
    res.status(500).json({ error: 'Failed to fetch DBS checks' });
  }
};

const getDBSCheck = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const result = await pool.query(`
      SELECT d.*,
             u.full_name as employee_name,
             u.employee_number,
             cb.full_name as checked_by_name,
             ed.filename as document_path,
             ed.original_filename as document_name
      FROM dbs_checks d
      JOIN users u ON d.employee_id = u.id
      JOIN users cb ON d.checked_by = cb.id
      LEFT JOIN employee_documents ed ON d.document_id = ed.id
      WHERE d.id = $1 AND d.tenant_id = $2
    `, [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DBS check not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching DBS check:', error);
    res.status(500).json({ error: 'Failed to fetch DBS check' });
  }
};

const createDBSCheck = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can create DBS checks' });
    }

    const tenantId = req.user.tenant_id;
    const checkedBy = req.user.id;
    const {
      employee_id,
      document_id,
      dbs_level,
      certificate_number,
      issue_date,
      renewal_period_years,
      update_service_registered,
      update_service_id,
      last_update_check,
      workforce,
      notes
    } = req.body;

    if (!employee_id || !dbs_level || !issue_date) {
      return res.status(400).json({ error: 'Employee, DBS level, and issue date are required' });
    }

    // Validate renewal period
    const renewal = renewal_period_years || 3;
    if (![1, 2, 3].includes(renewal)) {
      return res.status(400).json({ error: 'Renewal period must be 1, 2, or 3 years' });
    }

    // Calculate next_update_check if using update service
    let nextUpdateCheck = null;
    if (update_service_registered && last_update_check) {
      const lastCheck = new Date(last_update_check);
      lastCheck.setFullYear(lastCheck.getFullYear() + 1);
      nextUpdateCheck = lastCheck.toISOString().split('T')[0];
    }

    const result = await pool.query(`
      INSERT INTO dbs_checks (
        tenant_id, employee_id, document_id, dbs_level, certificate_number,
        issue_date, renewal_period_years, update_service_registered, update_service_id,
        last_update_check, next_update_check, checked_by, workforce, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      tenantId, employee_id, document_id || null, dbs_level, certificate_number,
      issue_date, renewal, update_service_registered || false, update_service_id,
      last_update_check || null, nextUpdateCheck, checkedBy, workforce, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating DBS check:', error);
    res.status(500).json({ error: 'Failed to create DBS check' });
  }
};

const updateDBSCheck = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can update DBS checks' });
    }

    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const {
      document_id,
      dbs_level,
      certificate_number,
      issue_date,
      renewal_period_years,
      update_service_registered,
      update_service_id,
      last_update_check,
      workforce,
      status,
      notes
    } = req.body;

    // Convert empty strings to null for date fields
    const toDateOrNull = (val) => (val && val.trim() !== '') ? val : null;
    const lastCheckDate = toDateOrNull(last_update_check);

    // Calculate next_update_check if updating last check
    let nextUpdateCheck = null;
    if (update_service_registered && lastCheckDate) {
      const lastCheck = new Date(lastCheckDate);
      lastCheck.setFullYear(lastCheck.getFullYear() + 1);
      nextUpdateCheck = lastCheck.toISOString().split('T')[0];
    }

    const result = await pool.query(`
      UPDATE dbs_checks SET
        document_id = COALESCE($1, document_id),
        dbs_level = COALESCE($2, dbs_level),
        certificate_number = COALESCE($3, certificate_number),
        issue_date = COALESCE($4, issue_date),
        renewal_period_years = COALESCE($5, renewal_period_years),
        update_service_registered = COALESCE($6, update_service_registered),
        update_service_id = COALESCE($7, update_service_id),
        last_update_check = $8,
        next_update_check = $9,
        workforce = COALESCE($10, workforce),
        status = COALESCE($11, status),
        notes = COALESCE($12, notes)
      WHERE id = $13 AND tenant_id = $14
      RETURNING *
    `, [
      document_id, dbs_level, certificate_number, toDateOrNull(issue_date),
      renewal_period_years, update_service_registered, update_service_id,
      lastCheckDate, nextUpdateCheck, workforce, status, notes,
      id, tenantId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DBS check not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating DBS check:', error);
    res.status(500).json({ error: 'Failed to update DBS check' });
  }
};

// Record DBS Update Service check
const recordDBSUpdateCheck = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can record DBS update checks' });
    }

    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { check_date, notes } = req.body;

    const checkDate = check_date || new Date().toISOString().split('T')[0];
    const nextCheck = new Date(checkDate);
    nextCheck.setFullYear(nextCheck.getFullYear() + 1);

    const result = await pool.query(`
      UPDATE dbs_checks SET
        last_update_check = $1,
        next_update_check = $2,
        status = 'valid',
        notes = COALESCE($3, notes)
      WHERE id = $4 AND tenant_id = $5 AND update_service_registered = true
      RETURNING *
    `, [checkDate, nextCheck.toISOString().split('T')[0], notes, id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DBS check not found or not registered for update service' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error recording DBS update check:', error);
    res.status(500).json({ error: 'Failed to record DBS update check' });
  }
};

// ===========================================
// COMPLIANCE TASKS
// ===========================================

const getComplianceTasks = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { status, employee_id, assigned_to, task_type } = req.query;

    let query = `
      SELECT ct.*,
             u.full_name as employee_name,
             u.employee_number,
             a.full_name as assigned_to_name
      FROM compliance_tasks ct
      JOIN users u ON ct.employee_id = u.id
      LEFT JOIN users a ON ct.assigned_to = a.id
      WHERE ct.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (status) {
      query += ` AND ct.status = $${paramCount++}`;
      params.push(status);
    }

    if (employee_id) {
      query += ` AND ct.employee_id = $${paramCount++}`;
      params.push(employee_id);
    }

    if (assigned_to) {
      query += ` AND ct.assigned_to = $${paramCount++}`;
      params.push(assigned_to);
    }

    if (task_type) {
      query += ` AND ct.task_type = $${paramCount++}`;
      params.push(task_type);
    }

    query += ' ORDER BY ct.due_date ASC, ct.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching compliance tasks:', error);
    res.status(500).json({ error: 'Failed to fetch compliance tasks' });
  }
};

const createComplianceTask = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can create compliance tasks' });
    }

    const tenantId = req.user.tenant_id;
    const {
      employee_id,
      title,
      description,
      due_date,
      assigned_to
    } = req.body;

    if (!employee_id || !title || !due_date) {
      return res.status(400).json({ error: 'Employee, title, and due date are required' });
    }

    const result = await pool.query(`
      INSERT INTO compliance_tasks (
        tenant_id, task_type, employee_id, title, description, due_date, assigned_to
      ) VALUES ($1, 'manual', $2, $3, $4, $5, $6)
      RETURNING *
    `, [tenantId, employee_id, title, description, due_date, assigned_to || null]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating compliance task:', error);
    res.status(500).json({ error: 'Failed to create compliance task' });
  }
};

const updateComplianceTask = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can update compliance tasks' });
    }

    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { title, description, due_date, assigned_to, status, dismissed_reason } = req.body;

    const completedBy = status === 'completed' ? req.user.id : null;

    const result = await pool.query(`
      UPDATE compliance_tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        due_date = COALESCE($3, due_date),
        assigned_to = $4,
        status = COALESCE($5, status),
        completed_by = COALESCE($6, completed_by),
        dismissed_reason = COALESCE($7, dismissed_reason)
      WHERE id = $8 AND tenant_id = $9
      RETURNING *
    `, [title, description, due_date, assigned_to, status, completedBy, dismissed_reason, id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating compliance task:', error);
    res.status(500).json({ error: 'Failed to update compliance task' });
  }
};

// ===========================================
// COMPLIANCE DASHBOARD
// ===========================================

const getComplianceDashboard = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // Get overview from view
    const overview = await pool.query(`
      SELECT * FROM compliance_overview WHERE tenant_id = $1
    `, [tenantId]);

    // Calculate summary stats
    const stats = {
      total_employees: overview.rows.length,
      rtw: {
        compliant: overview.rows.filter(r => r.rtw_compliance === 'compliant').length,
        expiring: overview.rows.filter(r => r.rtw_compliance === 'expiring').length,
        expired: overview.rows.filter(r => r.rtw_compliance === 'expired').length,
        missing: overview.rows.filter(r => r.rtw_compliance === 'missing').length,
        action_required: overview.rows.filter(r => r.rtw_compliance === 'action_required').length
      },
      dbs: {
        compliant: overview.rows.filter(r => r.dbs_compliance === 'compliant').length,
        expiring: overview.rows.filter(r => r.dbs_compliance === 'expiring').length,
        expired: overview.rows.filter(r => r.dbs_compliance === 'expired').length,
        missing: overview.rows.filter(r => r.dbs_compliance === 'missing').length,
        action_required: overview.rows.filter(r => r.dbs_compliance === 'action_required').length,
        update_due: overview.rows.filter(r => r.dbs_compliance === 'update_due').length
      }
    };

    // Get pending tasks count
    const tasksResult = await pool.query(`
      SELECT COUNT(*) as pending_tasks FROM compliance_tasks
      WHERE tenant_id = $1 AND status = 'pending'
    `, [tenantId]);

    stats.pending_tasks = parseInt(tasksResult.rows[0].pending_tasks);

    res.json({
      stats,
      employees: overview.rows
    });
  } catch (error) {
    console.error('Error fetching compliance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch compliance dashboard' });
  }
};

// Get expiring checks
const getExpiringChecks = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const days = parseInt(req.query.days) || 90;

    // RTW expiring
    const rtwExpiring = await pool.query(`
      SELECT r.*, u.full_name as employee_name, u.employee_number,
             'rtw' as check_type_category,
             r.expiry_date as critical_date
      FROM rtw_checks r
      JOIN users u ON r.employee_id = u.id
      WHERE r.tenant_id = $1
        AND r.status IN ('verified', 'action_required')
        AND r.expiry_date IS NOT NULL
        AND r.expiry_date <= CURRENT_DATE + ($2 || ' days')::INTERVAL
      ORDER BY r.expiry_date ASC
    `, [tenantId, days]);

    // RTW followup due
    const rtwFollowup = await pool.query(`
      SELECT r.*, u.full_name as employee_name, u.employee_number,
             'rtw_followup' as check_type_category,
             r.followup_date as critical_date
      FROM rtw_checks r
      JOIN users u ON r.employee_id = u.id
      WHERE r.tenant_id = $1
        AND r.status IN ('verified', 'action_required')
        AND r.followup_date IS NOT NULL
        AND r.followup_date <= CURRENT_DATE + ($2 || ' days')::INTERVAL
      ORDER BY r.followup_date ASC
    `, [tenantId, days]);

    // DBS expiring
    const dbsExpiring = await pool.query(`
      SELECT d.*, u.full_name as employee_name, u.employee_number,
             'dbs' as check_type_category,
             d.calculated_expiry_date as critical_date
      FROM dbs_checks d
      JOIN users u ON d.employee_id = u.id
      WHERE d.tenant_id = $1
        AND d.status IN ('valid', 'action_required')
        AND d.calculated_expiry_date IS NOT NULL
        AND d.calculated_expiry_date <= CURRENT_DATE + ($2 || ' days')::INTERVAL
      ORDER BY d.calculated_expiry_date ASC
    `, [tenantId, days]);

    // DBS update service due
    const dbsUpdateDue = await pool.query(`
      SELECT d.*, u.full_name as employee_name, u.employee_number,
             'dbs_update' as check_type_category,
             d.next_update_check as critical_date
      FROM dbs_checks d
      JOIN users u ON d.employee_id = u.id
      WHERE d.tenant_id = $1
        AND d.update_service_registered = true
        AND d.status IN ('valid', 'action_required')
        AND d.next_update_check IS NOT NULL
        AND d.next_update_check <= CURRENT_DATE + ($2 || ' days')::INTERVAL
      ORDER BY d.next_update_check ASC
    `, [tenantId, days]);

    res.json({
      rtw_expiring: rtwExpiring.rows,
      rtw_followup: rtwFollowup.rows,
      dbs_expiring: dbsExpiring.rows,
      dbs_update_due: dbsUpdateDue.rows,
      total: rtwExpiring.rows.length + rtwFollowup.rows.length +
             dbsExpiring.rows.length + dbsUpdateDue.rows.length
    });
  } catch (error) {
    console.error('Error fetching expiring checks:', error);
    res.status(500).json({ error: 'Failed to fetch expiring checks' });
  }
};

// ===========================================
// COMPLIANCE SETTINGS
// ===========================================

const getComplianceSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const result = await pool.query(`
      SELECT * FROM compliance_settings WHERE tenant_id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      // Create default settings
      const newSettings = await pool.query(`
        INSERT INTO compliance_settings (tenant_id)
        VALUES ($1)
        RETURNING *
      `, [tenantId]);
      return res.json(newSettings.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching compliance settings:', error);
    res.status(500).json({ error: 'Failed to fetch compliance settings' });
  }
};

const updateComplianceSettings = async (req, res) => {
  try {
    if (!isHR(req.user)) {
      return res.status(403).json({ error: 'Only HR can update compliance settings' });
    }

    const tenantId = req.user.tenant_id;
    const {
      default_dbs_renewal_years,
      update_service_check_months,
      rtw_reminder_days,
      auto_create_followup_tasks,
      report_title,
      module_enabled
    } = req.body;

    const result = await pool.query(`
      UPDATE compliance_settings SET
        default_dbs_renewal_years = COALESCE($1, default_dbs_renewal_years),
        update_service_check_months = COALESCE($2, update_service_check_months),
        rtw_reminder_days = COALESCE($3, rtw_reminder_days),
        auto_create_followup_tasks = COALESCE($4, auto_create_followup_tasks),
        report_title = COALESCE($5, report_title),
        module_enabled = COALESCE($6, module_enabled)
      WHERE tenant_id = $7
      RETURNING *
    `, [default_dbs_renewal_years, update_service_check_months, rtw_reminder_days, auto_create_followup_tasks, report_title, module_enabled, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating compliance settings:', error);
    res.status(500).json({ error: 'Failed to update compliance settings' });
  }
};

// ===========================================
// CQC PDF REPORT DATA
// ===========================================

const getComplianceReportData = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // Get all active employees with their compliance status
    const employees = await pool.query(`
      SELECT * FROM compliance_overview WHERE tenant_id = $1 ORDER BY full_name
    `, [tenantId]);

    // Get settings
    const settings = await pool.query(`
      SELECT * FROM compliance_settings WHERE tenant_id = $1
    `, [tenantId]);

    // Get pending tasks
    const tasks = await pool.query(`
      SELECT ct.*, u.full_name as employee_name
      FROM compliance_tasks ct
      JOIN users u ON ct.employee_id = u.id
      WHERE ct.tenant_id = $1 AND ct.status = 'pending'
      ORDER BY ct.due_date ASC
    `, [tenantId]);

    // Calculate compliance percentages
    const total = employees.rows.length;
    const rtwCompliant = employees.rows.filter(e => e.rtw_compliance === 'compliant').length;
    const dbsCompliant = employees.rows.filter(e => e.dbs_compliance === 'compliant').length;

    const report = {
      generated_at: new Date().toISOString(),
      tenant_id: tenantId,
      summary: {
        total_employees: total,
        rtw_compliance_rate: total > 0 ? Math.round((rtwCompliant / total) * 100) : 0,
        dbs_compliance_rate: total > 0 ? Math.round((dbsCompliant / total) * 100) : 0,
        pending_tasks: tasks.rows.length
      },
      employees: employees.rows,
      pending_tasks: tasks.rows,
      settings: settings.rows[0] || null
    };

    res.json(report);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
};

// Get compliance stats for dashboard
const getComplianceStats = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const overview = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rtw_compliance != 'compliant' OR dbs_compliance != 'compliant') as issues,
        COUNT(*) FILTER (WHERE rtw_compliance = 'expiring' OR dbs_compliance = 'expiring' OR dbs_compliance = 'update_due') as expiring,
        COUNT(*) FILTER (WHERE rtw_compliance = 'missing' OR dbs_compliance = 'missing') as missing
      FROM compliance_overview
      WHERE tenant_id = $1
    `, [tenantId]);

    const tasks = await pool.query(`
      SELECT COUNT(*) as pending FROM compliance_tasks
      WHERE tenant_id = $1 AND status = 'pending'
    `, [tenantId]);

    res.json({
      total_employees: parseInt(overview.rows[0].total) || 0,
      issues: parseInt(overview.rows[0].issues) || 0,
      expiring: parseInt(overview.rows[0].expiring) || 0,
      missing: parseInt(overview.rows[0].missing) || 0,
      pending_tasks: parseInt(tasks.rows[0].pending) || 0
    });
  } catch (error) {
    console.error('Error fetching compliance stats:', error);
    res.status(500).json({ error: 'Failed to fetch compliance stats' });
  }
};

module.exports = {
  // RTW
  getRTWChecks,
  getRTWCheck,
  createRTWCheck,
  updateRTWCheck,
  // DBS
  getDBSChecks,
  getDBSCheck,
  createDBSCheck,
  updateDBSCheck,
  recordDBSUpdateCheck,
  // Tasks
  getComplianceTasks,
  createComplianceTask,
  updateComplianceTask,
  // Dashboard
  getComplianceDashboard,
  getExpiringChecks,
  getComplianceStats,
  // Settings
  getComplianceSettings,
  updateComplianceSettings,
  // Report
  getComplianceReportData
};
