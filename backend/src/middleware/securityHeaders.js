/**
 * VoidStaffOS - Security Headers
 * HTTP security headers configuration.
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

const helmet = require('helmet');

/**
 * Security headers middleware
 * Configures helmet with strict security policies
 */
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },

  // Cross-Origin Embedder Policy - may need adjustment for external resources
  crossOriginEmbedderPolicy: false,

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: 'same-origin' },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Expect-CT (Certificate Transparency)
  // Note: This header is being deprecated but included for compatibility

  // Frameguard (X-Frame-Options)
  frameguard: { action: 'deny' },

  // Hide Powered By
  hidePoweredBy: true,

  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff (X-Content-Type-Options)
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },

  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // XSS Filter (X-XSS-Protection)
  // Note: Modern browsers don't need this, but included for legacy support
  xssFilter: true
});

/**
 * Additional security headers not covered by helmet
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Permissions Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // Cache Control for sensitive data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};

/**
 * Combined security middleware
 */
const securityMiddleware = [securityHeaders, additionalSecurityHeaders];

module.exports = securityMiddleware;
