/**
 * HeadOfficeOS - Emergency Controller
 * Emergency contacts and medical information management.
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
const isManager = (user) => user && (user.tier >= 50 || user.role_name === 'Admin' || user.role_name === 'HR Manager');
const isFullAccess = (user) => user && (user.tier >= 60 || user.role_name === 'Admin' || user.role_name === 'HR Manager');

// Check if user can access another employee's data
const canAccessEmployee = async (user, employeeId, tenantId) => {
  // Admin/HR can access anyone
  if (isFullAccess(user)) return true;

  // Own data
  if (user.id === parseInt(employeeId)) return true;

  // Manager can access direct reports
  if (isManager(user)) {
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND manager_id = $2 AND tenant_id = $3',
      [employeeId, user.id, tenantId]
    );
    return result.rows.length > 0;
  }

  return false;
};

// ===========================================
// EMERGENCY CONTACTS CRUD
// ===========================================

/**
 * Get emergency contacts for current user
 */
const getMyEmergencyContacts = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const employeeId = req.user.id;

    const result = await pool.query(`
      SELECT * FROM emergency_contacts
      WHERE tenant_id = $1 AND employee_id = $2
      ORDER BY priority ASC
    `, [tenantId, employeeId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching emergency contacts:', error);
    res.status(500).json({ error: 'Failed to fetch emergency contacts' });
  }
};

/**
 * Get emergency contacts for specific employee (with access control)
 */
const getEmployeeEmergencyContacts = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { employeeId } = req.params;

    // Check access
    const hasAccess = await canAccessEmployee(req.user, employeeId, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT ec.*, u.full_name as employee_name
      FROM emergency_contacts ec
      JOIN users u ON ec.employee_id = u.id
      WHERE ec.tenant_id = $1 AND ec.employee_id = $2
      ORDER BY ec.priority ASC
    `, [tenantId, employeeId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee emergency contacts:', error);
    res.status(500).json({ error: 'Failed to fetch emergency contacts' });
  }
};

/**
 * Create emergency contact
 */
const createEmergencyContact = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const employeeId = req.user.id;
    const {
      contact_name,
      relationship,
      priority,
      phone,
      mobile,
      email,
      address_line1,
      address_line2,
      city,
      postcode,
      country,
      is_next_of_kin,
      notes
    } = req.body;

    // Validate required fields
    if (!contact_name || !relationship) {
      return res.status(400).json({ error: 'Contact name and relationship are required' });
    }

    if (!phone && !mobile) {
      return res.status(400).json({ error: 'At least one phone number is required' });
    }

    // Check contact limit (max 5)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM emergency_contacts WHERE tenant_id = $1 AND employee_id = $2',
      [tenantId, employeeId]
    );
    if (parseInt(countResult.rows[0].count) >= 5) {
      return res.status(400).json({ error: 'Maximum 5 emergency contacts allowed' });
    }

    // Calculate priority if not provided
    let contactPriority = priority;
    if (!contactPriority) {
      const maxPriority = await pool.query(
        'SELECT COALESCE(MAX(priority), 0) as max_priority FROM emergency_contacts WHERE tenant_id = $1 AND employee_id = $2',
        [tenantId, employeeId]
      );
      contactPriority = parseInt(maxPriority.rows[0].max_priority) + 1;
    }

    const result = await pool.query(`
      INSERT INTO emergency_contacts (
        tenant_id, employee_id, contact_name, relationship, priority,
        phone, mobile, email, address_line1, address_line2, city, postcode, country,
        is_next_of_kin, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      tenantId, employeeId, contact_name, relationship, contactPriority,
      phone || null, mobile || null, email || null,
      address_line1 || null, address_line2 || null, city || null, postcode || null, country || 'United Kingdom',
      is_next_of_kin || false, notes || null, req.user.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating emergency contact:', error);
    if (error.constraint === 'idx_emergency_unique_priority') {
      return res.status(400).json({ error: 'A contact with this priority already exists' });
    }
    res.status(500).json({ error: 'Failed to create emergency contact' });
  }
};

/**
 * Update emergency contact
 */
const updateEmergencyContact = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const {
      contact_name,
      relationship,
      priority,
      phone,
      mobile,
      email,
      address_line1,
      address_line2,
      city,
      postcode,
      country,
      is_next_of_kin,
      notes
    } = req.body;

    // Verify ownership
    const existing = await pool.query(
      'SELECT * FROM emergency_contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Emergency contact not found' });
    }

    // Only owner or HR can update
    if (existing.rows[0].employee_id !== req.user.id && !isHR(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate phone requirement
    const finalPhone = phone !== undefined ? phone : existing.rows[0].phone;
    const finalMobile = mobile !== undefined ? mobile : existing.rows[0].mobile;
    if (!finalPhone && !finalMobile) {
      return res.status(400).json({ error: 'At least one phone number is required' });
    }

    const result = await pool.query(`
      UPDATE emergency_contacts SET
        contact_name = COALESCE($1, contact_name),
        relationship = COALESCE($2, relationship),
        priority = COALESCE($3, priority),
        phone = $4,
        mobile = $5,
        email = $6,
        address_line1 = $7,
        address_line2 = $8,
        city = $9,
        postcode = $10,
        country = COALESCE($11, country),
        is_next_of_kin = COALESCE($12, is_next_of_kin),
        notes = $13,
        updated_by = $14
      WHERE id = $15 AND tenant_id = $16
      RETURNING *
    `, [
      contact_name, relationship, priority,
      phone !== undefined ? (phone || null) : existing.rows[0].phone,
      mobile !== undefined ? (mobile || null) : existing.rows[0].mobile,
      email !== undefined ? (email || null) : existing.rows[0].email,
      address_line1 !== undefined ? (address_line1 || null) : existing.rows[0].address_line1,
      address_line2 !== undefined ? (address_line2 || null) : existing.rows[0].address_line2,
      city !== undefined ? (city || null) : existing.rows[0].city,
      postcode !== undefined ? (postcode || null) : existing.rows[0].postcode,
      country, is_next_of_kin,
      notes !== undefined ? (notes || null) : existing.rows[0].notes,
      req.user.id, id, tenantId
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating emergency contact:', error);
    if (error.constraint === 'idx_emergency_unique_priority') {
      return res.status(400).json({ error: 'A contact with this priority already exists' });
    }
    res.status(500).json({ error: 'Failed to update emergency contact' });
  }
};

/**
 * Delete emergency contact
 */
const deleteEmergencyContact = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    // Verify ownership
    const existing = await pool.query(
      'SELECT * FROM emergency_contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Emergency contact not found' });
    }

    // Only owner or HR can delete
    if (existing.rows[0].employee_id !== req.user.id && !isHR(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const employeeId = existing.rows[0].employee_id;

    await pool.query(
      'DELETE FROM emergency_contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    // Reorder priorities
    await pool.query('SELECT reorder_emergency_priorities($1, $2)', [tenantId, employeeId]);

    res.json({ message: 'Emergency contact deleted' });
  } catch (error) {
    console.error('Error deleting emergency contact:', error);
    res.status(500).json({ error: 'Failed to delete emergency contact' });
  }
};

/**
 * Reorder emergency contact priorities
 */
const reorderEmergencyContacts = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const employeeId = req.user.id;
    const { order } = req.body; // Array of contact IDs in new order

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'Order array is required' });
    }

    // Verify all contacts belong to user
    const contacts = await pool.query(
      'SELECT id FROM emergency_contacts WHERE tenant_id = $1 AND employee_id = $2',
      [tenantId, employeeId]
    );

    const existingIds = contacts.rows.map(c => c.id);
    const validOrder = order.every(id => existingIds.includes(id));

    if (!validOrder) {
      return res.status(400).json({ error: 'Invalid contact IDs in order' });
    }

    // Update priorities
    for (let i = 0; i < order.length; i++) {
      await pool.query(
        'UPDATE emergency_contacts SET priority = $1, updated_by = $2 WHERE id = $3 AND tenant_id = $4',
        [i + 1, req.user.id, order[i], tenantId]
      );
    }

    // Return updated list
    const result = await pool.query(`
      SELECT * FROM emergency_contacts
      WHERE tenant_id = $1 AND employee_id = $2
      ORDER BY priority ASC
    `, [tenantId, employeeId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error reordering emergency contacts:', error);
    res.status(500).json({ error: 'Failed to reorder emergency contacts' });
  }
};

// ===========================================
// MEDICAL INFO CRUD
// ===========================================

/**
 * Get medical info for current user
 */
const getMyMedicalInfo = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const employeeId = req.user.id;

    const result = await pool.query(`
      SELECT * FROM medical_info
      WHERE tenant_id = $1 AND employee_id = $2
    `, [tenantId, employeeId]);

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching medical info:', error);
    res.status(500).json({ error: 'Failed to fetch medical info' });
  }
};

/**
 * Get medical info for specific employee (HR only for full view)
 */
const getEmployeeMedicalInfo = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { employeeId } = req.params;

    // Check access
    const hasAccess = await canAccessEmployee(req.user, employeeId, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query;
    let params;

    // HR gets full view including hr_only_notes
    if (isFullAccess(req.user)) {
      query = `
        SELECT mi.*, u.full_name as employee_name
        FROM medical_info mi
        JOIN users u ON mi.employee_id = u.id
        WHERE mi.tenant_id = $1 AND mi.employee_id = $2
      `;
      params = [tenantId, employeeId];
    } else {
      // Non-HR (managers viewing team) - exclude hr_only_notes
      query = `
        SELECT mi.id, mi.tenant_id, mi.employee_id, mi.allergies, mi.medical_conditions,
               mi.medications, mi.blood_type, mi.gp_name, mi.gp_practice_name, mi.gp_phone,
               mi.gp_address, mi.additional_notes, mi.created_at, mi.updated_at,
               u.full_name as employee_name
        FROM medical_info mi
        JOIN users u ON mi.employee_id = u.id
        WHERE mi.tenant_id = $1 AND mi.employee_id = $2
      `;
      params = [tenantId, employeeId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching employee medical info:', error);
    res.status(500).json({ error: 'Failed to fetch medical info' });
  }
};

/**
 * Create or update medical info
 */
const saveMedicalInfo = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const employeeId = req.user.id;
    const {
      allergies,
      medical_conditions,
      medications,
      blood_type,
      gp_name,
      gp_practice_name,
      gp_phone,
      gp_address,
      hr_only_notes,
      additional_notes
    } = req.body;

    // Check if record exists
    const existing = await pool.query(
      'SELECT id FROM medical_info WHERE tenant_id = $1 AND employee_id = $2',
      [tenantId, employeeId]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update
      result = await pool.query(`
        UPDATE medical_info SET
          allergies = $1,
          medical_conditions = $2,
          medications = $3,
          blood_type = $4,
          gp_name = $5,
          gp_practice_name = $6,
          gp_phone = $7,
          gp_address = $8,
          hr_only_notes = $9,
          additional_notes = $10,
          updated_by = $11
        WHERE tenant_id = $12 AND employee_id = $13
        RETURNING *
      `, [
        allergies || null, medical_conditions || null, medications || null,
        blood_type || 'unknown', gp_name || null, gp_practice_name || null,
        gp_phone || null, gp_address || null, hr_only_notes || null,
        additional_notes || null, req.user.id, tenantId, employeeId
      ]);
    } else {
      // Create
      result = await pool.query(`
        INSERT INTO medical_info (
          tenant_id, employee_id, allergies, medical_conditions, medications,
          blood_type, gp_name, gp_practice_name, gp_phone, gp_address,
          hr_only_notes, additional_notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        tenantId, employeeId, allergies || null, medical_conditions || null,
        medications || null, blood_type || 'unknown', gp_name || null,
        gp_practice_name || null, gp_phone || null, gp_address || null,
        hr_only_notes || null, additional_notes || null, req.user.id
      ]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving medical info:', error);
    res.status(500).json({ error: 'Failed to save medical info' });
  }
};

// ===========================================
// TEAM/MANAGER VIEWS
// ===========================================

/**
 * Get team emergency contacts quick view (Manager Tier 50+ only)
 * Returns limited info: name, contact, relationship only
 */
const getTeamEmergencyQuickView = async (req, res) => {
  try {
    if (!isManager(req.user)) {
      return res.status(403).json({ error: 'Manager access required (Tier 50+)' });
    }

    const tenantId = req.user.tenant_id;
    const managerId = req.user.id;

    // Get team members' primary emergency contacts
    const result = await pool.query(`
      SELECT
        u.id as employee_id,
        u.full_name as employee_name,
        u.employee_number,
        ec.id as contact_id,
        ec.contact_name,
        ec.relationship,
        ec.phone,
        ec.mobile,
        ec.is_next_of_kin
      FROM users u
      LEFT JOIN emergency_contacts ec ON u.id = ec.employee_id AND ec.tenant_id = $1 AND ec.priority = 1
      WHERE u.manager_id = $2 AND u.tenant_id = $1 AND u.employment_status = 'active'
      ORDER BY u.full_name
    `, [tenantId, managerId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching team emergency contacts:', error);
    res.status(500).json({ error: 'Failed to fetch team emergency contacts' });
  }
};

/**
 * Get full emergency data for an employee (HR only)
 */
const getFullEmergencyData = async (req, res) => {
  try {
    if (!isFullAccess(req.user)) {
      return res.status(403).json({ error: 'HR access required (Tier 60+)' });
    }

    const tenantId = req.user.tenant_id;
    const { employeeId } = req.params;

    // Get employee info
    const employee = await pool.query(`
      SELECT id, full_name, employee_number, email
      FROM users WHERE id = $1 AND tenant_id = $2
    `, [employeeId, tenantId]);

    if (employee.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get emergency contacts
    const contacts = await pool.query(`
      SELECT * FROM emergency_contacts
      WHERE tenant_id = $1 AND employee_id = $2
      ORDER BY priority ASC
    `, [tenantId, employeeId]);

    // Get medical info
    const medical = await pool.query(`
      SELECT * FROM medical_info
      WHERE tenant_id = $1 AND employee_id = $2
    `, [tenantId, employeeId]);

    res.json({
      employee: employee.rows[0],
      contacts: contacts.rows,
      medical_info: medical.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching full emergency data:', error);
    res.status(500).json({ error: 'Failed to fetch emergency data' });
  }
};

module.exports = {
  // Emergency contacts
  getMyEmergencyContacts,
  getEmployeeEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  reorderEmergencyContacts,
  // Medical info
  getMyMedicalInfo,
  getEmployeeMedicalInfo,
  saveMedicalInfo,
  // Team views
  getTeamEmergencyQuickView,
  getFullEmergencyData
};
