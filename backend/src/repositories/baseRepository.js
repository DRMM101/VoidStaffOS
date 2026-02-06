/**
 * HeadOfficeOS - Base Repository
 * Foundation for all data access with enforced tenant isolation.
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
 * TRADE SECRET: Contains tenant isolation patterns.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

const pool = require('../config/database');

/**
 * Error thrown when tenant context is missing or invalid
 */
class TenantRequiredError extends Error {
  constructor(message = 'Tenant context is required') {
    super(message);
    this.name = 'TenantRequiredError';
    this.status = 500;
  }
}

/**
 * Base repository class with enforced tenant isolation
 * All data access methods require a valid tenant context
 */
class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.pool = pool;
  }

  /**
   * Validate that tenant context is present and valid
   * @param {Object} tenantContext - Context object with tenantId
   * @throws {TenantRequiredError} If tenantId is missing
   */
  validateTenantContext(tenantContext) {
    if (!tenantContext?.tenantId) {
      throw new TenantRequiredError(
        `${this.tableName}: tenantContext.tenantId is required`
      );
    }
  }

  /**
   * Find a single record by ID within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {number} id - Record ID
   * @returns {Object|null} Found record or null
   */
  async findById(tenantContext, id) {
    this.validateTenantContext(tenantContext);
    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName}
       WHERE tenant_id = $1 AND id = $2`,
      [tenantContext.tenantId, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all records within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {Object} options - Query options
   * @param {number} [options.limit=100] - Maximum records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {string} [options.orderBy='id'] - Column to order by
   * @param {string} [options.order='ASC'] - Sort order (ASC or DESC)
   * @returns {Array} Array of records
   */
  async findAll(tenantContext, options = {}) {
    this.validateTenantContext(tenantContext);
    const { limit = 100, offset = 0, orderBy = 'id', order = 'ASC' } = options;

    // Validate order direction
    const safeOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName}
       WHERE tenant_id = $1
       ORDER BY ${orderBy} ${safeOrder}
       LIMIT $2 OFFSET $3`,
      [tenantContext.tenantId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Create a new record within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {Object} data - Record data
   * @returns {Object} Created record
   */
  async create(tenantContext, data) {
    this.validateTenantContext(tenantContext);
    const dataWithTenant = { ...data, tenant_id: tenantContext.tenantId };
    const columns = Object.keys(dataWithTenant);
    const values = Object.values(dataWithTenant);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const result = await this.pool.query(
      `INSERT INTO ${this.tableName} (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Update a record within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {number} id - Record ID
   * @param {Object} data - Fields to update
   * @returns {Object|null} Updated record or null if not found
   */
  async update(tenantContext, id, data) {
    this.validateTenantContext(tenantContext);
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 3}`).join(', ');

    const result = await this.pool.query(
      `UPDATE ${this.tableName}
       SET ${setClause}, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [tenantContext.tenantId, id, ...values]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a record within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {number} id - Record ID
   * @param {boolean} [soft=true] - Soft delete (set deleted_at) or hard delete
   * @returns {Object} Query result
   */
  async delete(tenantContext, id, soft = true) {
    this.validateTenantContext(tenantContext);
    if (soft) {
      return this.pool.query(
        `UPDATE ${this.tableName}
         SET deleted_at = NOW()
         WHERE tenant_id = $1 AND id = $2`,
        [tenantContext.tenantId, id]
      );
    }
    return this.pool.query(
      `DELETE FROM ${this.tableName}
       WHERE tenant_id = $1 AND id = $2`,
      [tenantContext.tenantId, id]
    );
  }

  /**
   * Count records within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {Object} [conditions={}] - Additional WHERE conditions
   * @returns {number} Count of records
   */
  async count(tenantContext, conditions = {}) {
    this.validateTenantContext(tenantContext);
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantContext.tenantId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Find records matching conditions within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {Object} conditions - WHERE conditions as key-value pairs
   * @returns {Array} Array of matching records
   */
  async findWhere(tenantContext, conditions) {
    this.validateTenantContext(tenantContext);
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);

    const whereClause = keys
      .map((key, i) => `${key} = $${i + 2}`)
      .join(' AND ');

    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName}
       WHERE tenant_id = $1 AND ${whereClause}`,
      [tenantContext.tenantId, ...values]
    );
    return result.rows;
  }

  /**
   * Find a single record matching conditions within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {Object} conditions - WHERE conditions as key-value pairs
   * @returns {Object|null} Found record or null
   */
  async findOneWhere(tenantContext, conditions) {
    const results = await this.findWhere(tenantContext, conditions);
    return results[0] || null;
  }

  /**
   * Check if a record exists within tenant scope
   * @param {Object} tenantContext - Tenant context with tenantId
   * @param {number} id - Record ID
   * @returns {boolean} True if record exists
   */
  async exists(tenantContext, id) {
    this.validateTenantContext(tenantContext);
    const result = await this.pool.query(
      `SELECT 1 FROM ${this.tableName}
       WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantContext.tenantId, id]
    );
    return result.rows.length > 0;
  }
}

module.exports = { BaseRepository, TenantRequiredError };
