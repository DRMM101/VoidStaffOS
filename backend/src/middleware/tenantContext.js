/**
 * VoidStaffOS - Tenant Context Middleware
 * Sets PostgreSQL session variables for Row Level Security.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 26/01/2026
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

/**
 * Middleware: Set PostgreSQL tenant context from session
 * Must be called after session middleware and authentication
 *
 * This sets the app.current_tenant_id and app.current_user_id
 * session variables that RLS policies use for filtering.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const setTenantContext = async (req, res, next) => {
  try {
    const tenantId = req.session?.tenantId;
    const userId = req.session?.userId;

    if (tenantId && userId) {
      // Get a client from the pool and set session variables
      const client = await pool.connect();
      try {
        await client.query('SELECT set_session_context($1, $2)', [tenantId, userId]);
        // Store the client on the request for use in route handlers
        req.dbClient = client;
        req.releaseDbClient = () => {
          client.release();
          req.dbClient = null;
        };
      } catch (err) {
        client.release();
        throw err;
      }
    }

    next();
  } catch (error) {
    console.error('Error setting tenant context:', error);
    next(error);
  }
};

/**
 * Middleware: Cleanup - release database client after request
 * Should be registered as a response finish handler
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const cleanupTenantContext = (req, res, next) => {
  res.on('finish', () => {
    if (req.releaseDbClient) {
      req.releaseDbClient();
    }
  });
  next();
};

/**
 * Helper: Execute query with tenant context
 * Use this for individual queries that need tenant isolation
 * without maintaining a persistent connection.
 *
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const queryWithTenantContext = async (tenantId, userId, query, params = []) => {
  const client = await pool.connect();
  try {
    // Set session context
    await client.query('SELECT set_session_context($1, $2)', [tenantId, userId]);

    // Execute the query
    const result = await client.query(query, params);

    // Clear context
    await client.query('SELECT clear_session_context()');

    return result;
  } finally {
    client.release();
  }
};

/**
 * Helper: Execute multiple queries with tenant context in a transaction
 *
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {Function} callback - Async function that receives the client
 * @returns {Promise<any>} Result from callback
 */
const withTenantTransaction = async (tenantId, userId, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_session_context($1, $2)', [tenantId, userId]);

    const result = await callback(client);

    await client.query('SELECT clear_session_context()');
    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  setTenantContext,
  cleanupTenantContext,
  queryWithTenantContext,
  withTenantTransaction
};
