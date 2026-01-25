/**
 * VoidStaffOS - API Client
 * Handles authentication cookies and CSRF tokens.
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

const API_BASE = '/api';

/**
 * Get CSRF token from cookie
 * @returns {string|null} CSRF token or null if not found
 */
const getCSRFToken = () => {
  const match = document.cookie.match(/staffos_csrf=([^;]+)/);
  return match ? match[1] : null;
};

/**
 * API client with automatic CSRF and cookie handling
 */
const api = {
  /**
   * Make an API request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint (without /api prefix)
   * @param {Object|null} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {Error} On API error or auth failure
   */
  async request(method, endpoint, data = null, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken()
      },
      credentials: 'include', // Always send cookies
      ...options
    };

    if (data && !['GET', 'HEAD'].includes(method)) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);

    // Handle 401 - redirect to login
    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    // Handle 403 - CSRF or permission issue
    if (response.status === 403) {
      const error = await response.json();
      throw new Error(error.error || 'Access denied');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  },

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} Response data
   */
  get: (endpoint) => api.request('GET', endpoint),

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  post: (endpoint, data) => api.request('POST', endpoint, data),

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  put: (endpoint, data) => api.request('PUT', endpoint, data),

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  patch: (endpoint, data) => api.request('PATCH', endpoint, data),

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} Response data
   */
  delete: (endpoint) => api.request('DELETE', endpoint),

  /**
   * Upload file
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with file
   * @returns {Promise<Object>} Response data
   */
  upload: async (endpoint, formData) => {
    const url = `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': getCSRFToken()
        // Don't set Content-Type - browser will set it with boundary
      },
      credentials: 'include',
      body: formData
    });

    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }
};

export default api;
