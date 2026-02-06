/**
 * HeadOfficeOS - User Model
 * User data access and authentication methods.
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

const SALT_ROUNDS = 10;

const User = {
  async findByEmail(email) {
    const result = await pool.query(
      `SELECT u.*, r.role_name, r.permissions_json
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role_id, u.employment_status,
              u.start_date, u.end_date, u.created_at, u.manager_id,
              u.tier, u.employee_number, u.tenant_id,
              r.role_name, r.permissions_json
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async create(userData) {
    const { email, password, full_name, role_id, created_by } = userData;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role_id, start_date, created_by)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
       RETURNING id, email, full_name, role_id, employment_status, start_date, created_at`,
      [email, full_name, password_hash, role_id, created_by || null]
    );

    return result.rows[0];
  }
};

module.exports = User;
