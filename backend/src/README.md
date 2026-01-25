<!--
  VoidStaffOS - Backend Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 24/01/2026
  Updated: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS Backend

Express.js REST API for the VoidStaffOS employee management system.

## Structure

```
src/
├── config/
│   └── database.js           # PostgreSQL connection pool
├── controllers/
│   ├── authController.js     # Login, logout, session management
│   ├── userController.js     # User CRUD, transfers, adoptions
│   ├── reviewController.js   # Performance reviews, KPI calculations
│   ├── leaveController.js    # Leave requests, approvals
│   ├── notificationController.js # Notifications CRUD and triggers
│   ├── feedbackController.js # 360 feedback, quarterly KPIs
│   └── reportController.js   # Team performance reports
├── middleware/
│   ├── auth.js               # Session authentication, role authorization
│   ├── sessionAuth.js        # PostgreSQL session configuration
│   ├── csrf.js               # CSRF protection
│   └── securityHeaders.js    # Helmet security headers
├── repositories/
│   └── baseRepository.js     # Tenant-isolated data access
├── routes/
│   ├── auth.js               # /api/auth/* endpoints
│   ├── users.js              # /api/users/* endpoints
│   ├── reviews.js            # /api/reviews/* endpoints
│   ├── leave.js              # /api/leave/* endpoints
│   ├── notifications.js      # /api/notifications/* endpoints
│   ├── feedback.js           # /api/feedback/* endpoints
│   ├── reports.js            # /api/reports/* endpoints
│   └── dev.js                # Development utilities
├── utils/
│   └── auditLog.js           # Security audit logging
└── server.js                 # Express app configuration
```

## Security Architecture

### Authentication
- **Session-based** with HttpOnly cookies (no localStorage tokens)
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Session cookie: `staffos_sid` (HttpOnly, secure in production)
- 8-hour session lifetime with rolling expiry

### CSRF Protection
- Double-submit cookie pattern
- CSRF token: `staffos_csrf` (readable by frontend)
- Required header: `X-CSRF-Token` for POST/PUT/PATCH/DELETE
- Auth endpoints exempt (no session yet at login)

### Security Headers
- Helmet middleware with production-ready CSP
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (production only)

### Multi-Tenant Isolation
- All data scoped by `tenant_id`
- BaseRepository enforces tenant context on all queries
- Sessions include tenant context

## Key Concepts

### Authorization
- Role-based: Admin, Manager, Employee, Compliance Officer
- Tier-based: 1 (Executive) to 5 (Entry), null for Admin
- Managers can only manage lower-tier employees
- Visibility filtered by relationship (manager → direct reports)

### Blind Reviews
- Manager and employee both create reviews for same week
- Neither sees the other's ratings until both commit
- Text fields hidden from managers viewing team self-reflections
- KPIs revealed only after both parties commit

### Leave Policy
- Notice: 2x days for 1-4 day requests, 30 days for 5+ days
- Working days calculation excludes weekends
- Auto-skip reviews during approved leave (>2 days)

### Audit Logging
- All authentication events logged
- Sensitive operations tracked with IP and user agent
- GDPR-compliant audit trail

## Middleware Stack (Applied in Order)

1. `securityHeaders` - Helmet headers
2. `cors` - Cross-origin with credentials
3. `sessionMiddleware` - PostgreSQL sessions
4. `csrfProtection` - CSRF validation
5. `deriveTenantContext` - Extract tenant from session
6. `rateLimiter` - Request rate limiting

## Environment Variables

```env
# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Session Security (REQUIRED - change in production!)
SESSION_SECRET=your-long-random-secret-key

# Server
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

## Running

```bash
# Install dependencies
npm install

# Development (with nodemon)
npm run dev

# Production
npm start
```

## Database Migrations

Migrations are in `../migrations/`. Run them in order:

```bash
# Core tables
psql -U voidstaff -d voidstaff_db -f migrations/001_initial_schema.sql
# ... through 015

# Security tables (required)
psql -U voidstaff -d voidstaff_db -f migrations/016_multi_tenant_foundation.sql
psql -U voidstaff -d voidstaff_db -f migrations/017_audit_log_enhanced.sql
```

## Rate Limiting

- **Global:** 100 requests/minute per IP
- **Auth endpoints:** 10 requests/minute per IP

## API Documentation

See `/docs/API_REFERENCE.md` for complete endpoint documentation.
See `/docs/SECURITY.md` for security architecture details.
