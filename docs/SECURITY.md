<!--
  VoidStaffOS - Security Architecture Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS Security Architecture

Last Updated: 2026-01-25

This document describes the security architecture implemented in VoidStaffOS.

---

## 1. Authentication

### Session-Based Authentication

VoidStaffOS uses **secure HttpOnly session cookies** instead of localStorage tokens. This protects against XSS attacks that could steal authentication credentials.

**Session Cookie:** `staffos_sid`
- HttpOnly: `true` (not accessible to JavaScript)
- Secure: `true` in production (HTTPS only)
- SameSite: `lax` (prevents CSRF from external sites)
- Max Age: 8 hours
- Rolling: `true` (refreshes on activity)

**Session Storage:**
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Table: `user_sessions`
- Automatic cleanup of expired sessions

**Session Data Structure:**
```json
{
  "userId": 1,
  "tenantId": 1,
  "roles": ["Manager"],
  "permissions": ["read:users", "write:reviews"],
  "email": "user@example.com",
  "fullName": "John Doe",
  "csrfToken": "..."
}
```

### Login Flow

1. User submits credentials to `POST /api/auth/login`
2. Server validates password against bcrypt hash
3. Session created in PostgreSQL
4. HttpOnly `staffos_sid` cookie set
5. Readable `staffos_csrf` cookie set for CSRF protection
6. Login logged to `audit_logs` table

### Logout

1. `POST /api/auth/logout` called
2. Session destroyed in `user_sessions` table
3. Cookies cleared
4. Logout logged to `audit_logs` table

---

## 2. CSRF Protection

### Double-Submit Cookie Pattern

VoidStaffOS uses the double-submit cookie pattern for CSRF protection.

**CSRF Cookie:** `staffos_csrf`
- HttpOnly: `false` (readable by JavaScript)
- Contains randomly generated token
- Must be sent in `X-CSRF-Token` header for state-changing requests

**Protected Methods:**
- POST
- PUT
- PATCH
- DELETE

**Exempt Paths:**
- `/api/auth/*` (no session yet at login)

### Frontend Implementation

```javascript
// Read CSRF token from cookie
const getCsrfToken = () => {
  const match = document.cookie.match(/staffos_csrf=([^;]+)/);
  return match ? match[1] : '';
};

// Include in state-changing requests
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken()
  },
  credentials: 'include',
  body: JSON.stringify(data)
});
```

---

## 3. Multi-Tenant Isolation

### Tenant Architecture

All data is isolated by `tenant_id`. Every table (except system tables) includes a `tenant_id` foreign key.

**Tenant Context:**
- Derived from session during authentication
- Stored in `req.tenantContext`
- Enforced at repository layer

### BaseRepository Pattern

```javascript
class BaseRepository {
  constructor(tenantId) {
    if (!tenantId) throw new Error('Tenant ID required');
    this.tenantId = tenantId;
  }

  async findAll(table) {
    return pool.query(
      `SELECT * FROM ${table} WHERE tenant_id = $1`,
      [this.tenantId]
    );
  }
}
```

### Tenant Isolation Rules

1. All queries MUST include `tenant_id` filter
2. Cross-tenant data access is blocked at application layer
3. Sessions include `tenantId` for context
4. Audit logs track tenant context

---

## 4. Security Headers

### Helmet Configuration

VoidStaffOS uses Helmet middleware for security headers.

**Headers Applied:**
| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-XSS-Protection | 1; mode=block | XSS filter (legacy) |
| Strict-Transport-Security | max-age=31536000 | Force HTTPS (production) |
| Content-Security-Policy | See below | Script/resource restrictions |

**Content Security Policy:**
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-ancestors 'none';
```

---

## 5. Audit Logging

### Audit Log Table

All security-relevant events are logged to `audit_logs`.

**Tracked Events:**
| Category | Actions |
|----------|---------|
| Authentication | LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, PASSWORD_CHANGE |
| Authorization | ROLE_CHANGE, PERMISSION_CHANGE |
| Data Access | DATA_EXPORT, GDPR_DATA_REQUEST, GDPR_DELETION_REQUEST |
| HR Actions | EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_TERMINATED |
| Sensitive Ops | SALARY_VIEWED, SALARY_CHANGED, DOCUMENT_ACCESSED |
| Records | RECORD_CREATE, RECORD_UPDATE, RECORD_DELETE |

**Logged Information:**
- Timestamp
- User ID
- Tenant ID
- Action type
- Resource type and ID
- IP address
- User agent
- Additional details (JSONB)

### Audit Log Usage

```javascript
const auditLog = require('../utils/auditLog');

// Log successful login
auditLog.loginSuccess(tenantId, userId, req);

// Log record creation
auditLog.recordCreate(tenantId, userId, 'review', reviewId, req);
```

---

## 6. Password Security

### Password Hashing

- Algorithm: bcrypt
- Cost factor: 10 rounds
- Passwords never stored in plain text

### Password Policy

Recommended (not yet enforced):
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

## 7. Rate Limiting

### Limits Applied

| Scope | Limit | Window |
|-------|-------|--------|
| Global | 100 requests | 1 minute |
| Auth endpoints | 10 requests | 1 minute |

**Response on limit exceeded:**
```json
{
  "error": "Too many requests, please try again later"
}
```
Status: `429 Too Many Requests`

---

## 8. CORS Configuration

### Development

```javascript
origin: function(origin, callback) {
  // Allow any localhost port in development
  if (origin?.match(/^http:\/\/localhost:\d+$/)) {
    return callback(null, true);
  }
}
credentials: true  // Required for cookies
```

### Production

```javascript
origin: process.env.FRONTEND_URL,
credentials: true
```

---

## 9. Environment Variables

### Required Secrets

| Variable | Purpose | Notes |
|----------|---------|-------|
| SESSION_SECRET | Session signing | **Must change in production** |
| DATABASE_URL | Database connection | Contains credentials |

### Production Checklist

- [ ] Change `SESSION_SECRET` to random 64+ character string
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (secure cookies enabled)
- [ ] Configure proper CORS origin
- [ ] Review rate limiting settings
- [ ] Enable database SSL

---

## 10. Deployment Checklist

### Pre-Deployment

1. **Secrets**
   - [ ] Generate strong `SESSION_SECRET`
   - [ ] Secure database credentials
   - [ ] No secrets in version control

2. **HTTPS**
   - [ ] SSL certificate configured
   - [ ] HTTP redirects to HTTPS
   - [ ] HSTS header enabled

3. **Headers**
   - [ ] CSP configured for production
   - [ ] X-Frame-Options set
   - [ ] Secure cookies enabled

4. **Database**
   - [ ] SSL connections enabled
   - [ ] Firewall rules configured
   - [ ] Backups configured

5. **Monitoring**
   - [ ] Audit logs reviewed regularly
   - [ ] Failed login monitoring
   - [ ] Rate limit alerts

### Post-Deployment

1. **Testing**
   - [ ] Session timeout works
   - [ ] CSRF protection functional
   - [ ] Rate limiting effective

2. **Verification**
   - [ ] No sensitive data in logs
   - [ ] Cookies marked secure
   - [ ] Headers present

---

## 11. Security Contacts

Report security vulnerabilities to:

**D.R.M. Manthorpe**
- This software is proprietary and confidential
- Security issues should be reported privately
- Do not disclose vulnerabilities publicly

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-25 | Initial security architecture |
