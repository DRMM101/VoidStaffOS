<!--
  VoidStaffOS - Component Map Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 24/01/2026
  Updated: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS Component Map

Last Updated: 2026-01-25

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Login  │  │ Dashboard │  │Employees │  │    Reviews     │  │
│  └────┬────┘  └─────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       │             │             │                │            │
│       └─────────────┴─────────────┴────────────────┘            │
│                              │                                   │
│                    credentials: 'include'                        │
│                      + X-CSRF-Token header                       │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                         BACKEND (Node.js/Express)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Security Middleware Stack                │   │
│  │  ┌─────────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌─────────┐ │   │
│  │  │Security │ │ CORS │ │ Session  │ │ CSRF │ │  Rate   │ │   │
│  │  │Headers  │ │      │ │  Auth    │ │      │ │ Limit   │ │   │
│  │  └─────────┘ └──────┘ └──────────┘ └──────┘ └─────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Controllers                          │   │
│  │  ┌──────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌────────────┐  │   │
│  │  │ Auth │ │ User │ │ Review │ │ Leave │ │Notification│  │   │
│  │  └──────┘ └──────┘ └────────┘ └───────┘ └────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Repositories                          │   │
│  │  ┌───────────────┐                                       │   │
│  │  │BaseRepository │ → Enforces tenant_id isolation        │   │
│  │  └───────────────┘                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                         DATABASE (PostgreSQL)                    │
│  ┌─────────┐ ┌───────┐ ┌───────┐ ┌─────────┐ ┌──────────────┐  │
│  │ tenants │ │ users │ │reviews│ │leave_req│ │user_sessions │  │
│  └─────────┘ └───────┘ └───────┘ └─────────┘ └──────────────┘  │
│  ┌───────────────┐ ┌──────────────────┐                         │
│  │ notifications │ │    audit_logs    │ (Enhanced security)     │
│  └───────────────┘ └──────────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      Authentication Flow                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User submits credentials                                        │
│     POST /api/auth/login { email, password }                        │
│                           │                                         │
│                           ▼                                         │
│  2. Server validates and creates session                            │
│     ┌────────────────────────────────────────┐                     │
│     │ • Verify password with bcrypt          │                     │
│     │ • Create session in user_sessions      │                     │
│     │ • Store: userId, tenantId, roles       │                     │
│     │ • Generate CSRF token                  │                     │
│     └────────────────────────────────────────┘                     │
│                           │                                         │
│                           ▼                                         │
│  3. Response sets HttpOnly cookies                                  │
│     ┌────────────────────────────────────────┐                     │
│     │ Set-Cookie: staffos_sid=xxx; HttpOnly  │ ← Session (secure)  │
│     │ Set-Cookie: staffos_csrf=xxx           │ ← CSRF (readable)   │
│     └────────────────────────────────────────┘                     │
│                           │                                         │
│                           ▼                                         │
│  4. Subsequent requests                                             │
│     ┌────────────────────────────────────────┐                     │
│     │ Cookie: staffos_sid=xxx (automatic)    │                     │
│     │ X-CSRF-Token: xxx (from staffos_csrf)  │ ← State-changing    │
│     │ credentials: 'include' (required)      │                     │
│     └────────────────────────────────────────┘                     │
│                           │                                         │
│                           ▼                                         │
│  5. Middleware validates                                            │
│     sessionAuth.requireAuth() → Check session exists               │
│     csrfProtection() → Validate X-CSRF-Token                       │
│     auth.authenticate() → Load user, check active                  │
│     auth.authorize() → Role-based access control                   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Blind Review Process

```
1. FRIDAY: Manager creates snapshot for employee
   ┌─────────┐    POST /reviews    ┌─────────────┐
   │ Manager │ ─────────────────▶  │   reviews   │  (is_committed=false)
   └─────────┘                     └─────────────┘

2. FRIDAY: Employee creates self-reflection
   ┌──────────┐  POST /reviews/self-reflection  ┌─────────────┐
   │ Employee │ ───────────────────────────────▶│   reviews   │  (is_self_assessment=true)
   └──────────┘                                 └─────────────┘

3. Manager commits their review
   ┌─────────┐  POST /reviews/:id/commit  ┌─────────────┐
   │ Manager │ ─────────────────────────▶ │   reviews   │  (is_committed=true)
   └─────────┘                            └─────────────┘
         │
         ▼
   ┌─────────────────┐
   │  Notification   │ → Employee: "Manager submitted snapshot"
   └─────────────────┘

4. Employee commits their self-reflection
   ┌──────────┐  POST /reviews/self-reflection/:id/commit  ┌─────────────┐
   │ Employee │ ──────────────────────────────────────────▶│   reviews   │
   └──────────┘                                            └─────────────┘
         │
         ▼  (both_committed = true)
   ┌─────────────────┐
   │  Notification   │ → Both: "KPIs revealed - compare your assessments"
   └─────────────────┘

5. REVEAL: Both can now see ratings comparison
   ┌──────────┐  GET /reviews/my-reflection-status  ┌────────────────┐
   │ Employee │ ──────────────────────────────────▶ │ KPI Comparison │
   └──────────┘                                     │ Manager: 7.5   │
                                                    │ Self: 8.0      │
                                                    │ Delta: +0.5    │
                                                    └────────────────┘
```

---

## Frontend Components

### Core Layout
| Component | File | Description |
|-----------|------|-------------|
| App | `App.jsx` | Root component, session auth state, routing |
| Login | `Login.jsx` | Authentication form with credentials: 'include' |
| Dashboard | `Dashboard.jsx` | Main landing page with KPI summary, reflection status, quick actions |

### Employee Management
| Component | File | Description |
|-----------|------|-------------|
| Employees | `Employees.jsx` | Employee list with review status indicators |
| EmployeeForm | `EmployeeForm.jsx` | Create/edit employee modal (Admin only) |
| EmployeeProfile | `EmployeeProfile.jsx` | Detailed employee profile with manager info, leave balance |

### Performance Reviews
| Component | File | Description |
|-----------|------|-------------|
| Reviews | `Reviews.jsx` | List of all reviews user can access |
| ReviewForm | `ReviewForm.jsx` | Manager creates/edits employee review |
| SelfReflectionForm | `SelfReflectionForm.jsx` | Employee weekly self-reflection form |
| MyReports | `MyReports.jsx` | Employee's own performance history |

### Leave Management
| Component | File | Description |
|-----------|------|-------------|
| LeaveRequest | `LeaveRequest.jsx` | Submit leave request form |
| MyLeaveRequests | `MyLeaveRequests.jsx` | Employee's leave history with balance |
| ManagerLeaveApprovals | `ManagerLeaveApprovals.jsx` | Manager approval queue |

### Notifications
| Component | File | Description |
|-----------|------|-------------|
| NotificationBell | `NotificationBell.jsx` | Header bell icon with dropdown |
| Notifications | `Notifications.jsx` | Full notification list with filters |

### Shared/UI
| Component | File | Description |
|-----------|------|-------------|
| TrafficLight | (inline) | Red/amber/green KPI indicator |
| KPIComparison | (inline) | Side-by-side manager vs self KPI display |

---

## Backend Structure

### Middleware Stack (Applied in Order)
| Middleware | File | Purpose |
|------------|------|---------|
| securityHeaders | `securityHeaders.js` | Helmet security headers, CSP, HSTS |
| cors | `server.js` | Cross-origin requests with credentials |
| sessionMiddleware | `sessionAuth.js` | PostgreSQL-backed session management |
| csrfProtection | `csrf.js` | CSRF token validation (state-changing requests) |
| deriveTenantContext | `sessionAuth.js` | Extract tenant context from session |
| rateLimiter | `server.js` | Request rate limiting |

### Authentication Middleware
| Middleware | File | Purpose |
|------------|------|---------|
| authenticate | `auth.js` | Validate session, load user |
| authorize | `auth.js` | Role-based access control |
| requireAuth | `sessionAuth.js` | Require valid session |
| requireRole | `sessionAuth.js` | Require specific role(s) |
| requirePermission | `sessionAuth.js` | Require specific permission(s) |

### Controllers
| Controller | File | Responsibility |
|------------|------|----------------|
| authController | `authController.js` | Login, logout, session management |
| userController | `userController.js` | CRUD users, manager assignment, transfers, orphan management |
| reviewController | `reviewController.js` | CRUD reviews, KPI calculations, blind review logic |
| leaveController | `leaveController.js` | Leave requests, approvals, balance calculations |
| notificationController | `notificationController.js` | CRUD notifications, trigger functions |
| feedbackController | `feedbackController.js` | 360 feedback, quarterly KPIs |
| reportController | `reportController.js` | Team performance reports |

### Routes
| Route File | Base Path | Description |
|------------|-----------|-------------|
| auth.js | `/api/auth` | Login, logout, session check |
| users.js | `/api/users` | User management |
| reviews.js | `/api/reviews` | Performance reviews |
| leave.js | `/api/leave` | Leave management |
| notifications.js | `/api/notifications` | Notification system |
| feedback.js | `/api/feedback` | 360 feedback endpoints |
| reports.js | `/api/reports` | Reporting endpoints |
| dev.js | `/api/dev` | Development utilities |

### Repositories
| Repository | File | Purpose |
|------------|------|---------|
| BaseRepository | `baseRepository.js` | Tenant-isolated database operations |

### Utilities
| Utility | File | Purpose |
|---------|------|---------|
| auditLog | `auditLog.js` | Security audit logging |
| database | `database.js` | PostgreSQL connection pool |

---

## Key Functions

### KPI Calculations (reviewController.js)
```javascript
calculateMetrics(review)     // Compute velocity, friction, cohesion
getMetricStatus(value)       // Return 'red'|'amber'|'green'
getMostRecentFriday()        // Get week ending date
filterSelfReflectionForManager()  // Hide text, show KPIs only
```

### Leave Policy (leaveController.js)
```javascript
calculateWorkingDays(start, end)  // Exclude weekends
calculateRequiredNotice(days)      // 2x for 1-4 days, 30 for 5+
calculateNoticeDays(request, start) // Days between request and leave
```

### Notification Triggers (notificationController.js)
```javascript
notifyManagerSnapshotCommitted()   // When manager commits
notifyKPIsRevealed()               // When both commit
notifyLeaveRequestPending()        // New leave request
notifyLeaveRequestApproved()       // Leave approved
notifyLeaveRequestRejected()       // Leave rejected
notifyEmployeeTransferred()        // Transfer notification
notifyNewDirectReport()            // Manager adoption
checkAndNotifyOverdueSnapshots()   // Overdue check
```

### Audit Logging (auditLog.js)
```javascript
loginSuccess(tenantId, userId, req)  // Log successful login
loginFailure(tenantId, email, req)   // Log failed login attempt
logout(tenantId, userId, req)        // Log logout
recordCreate(tenantId, userId, type, id, req)  // Log record creation
recordUpdate(tenantId, userId, type, id, req)  // Log record update
```

---

## Database Tables

| Table | Primary Purpose | Key Relationships |
|-------|-----------------|-------------------|
| tenants | Organisation isolation | → all tables via tenant_id |
| roles | Role definitions | → users.role_id |
| users | Employee data, hierarchy | → self (manager_id), → roles, → tenants |
| user_sessions | Session storage | Session data with expiry |
| reviews | Performance snapshots | → users (employee, reviewer), → tenants |
| leave_requests | Time-off management | → users (employee, manager), → tenants |
| notifications | System alerts | → users, → tenants |
| audit_logs | Security audit trail | → users, → tenants |

---

## Role Permissions Matrix

| Action | Admin | Manager | Employee | Compliance |
|--------|-------|---------|----------|------------|
| View all users | ✓ | | | ✓ |
| View own team | ✓ | ✓ | | |
| Create user | ✓ | | | |
| Edit user | ✓ | | | |
| Create review (team) | ✓ | ✓ | | |
| Create self-reflection | ✓ | ✓ | ✓ | |
| Approve leave | ✓ | ✓ (team) | | |
| Transfer employee | ✓ | ✓ (own) | | |
| Adopt orphan | ✓ | ✓ (lower tier) | | |
| Uncommit review | ✓ | | | |
| View reports | ✓ | ✓ (team) | ✓ (self) | ✓ |

---

## File Structure

```
VoidStaffOS/
├── backend/
│   ├── migrations/              # SQL migration files
│   │   ├── 016_multi_tenant_foundation.sql
│   │   └── 017_audit_log_enhanced.sql
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js      # PostgreSQL connection pool
│   │   ├── controllers/         # Business logic
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── reviewController.js
│   │   │   ├── leaveController.js
│   │   │   ├── notificationController.js
│   │   │   └── feedbackController.js
│   │   ├── middleware/          # Security middleware
│   │   │   ├── auth.js          # Session auth + RBAC
│   │   │   ├── sessionAuth.js   # Session configuration
│   │   │   ├── csrf.js          # CSRF protection
│   │   │   └── securityHeaders.js # Helmet headers
│   │   ├── repositories/        # Data access layer
│   │   │   └── baseRepository.js # Tenant isolation
│   │   ├── routes/              # API endpoints
│   │   ├── utils/               # Utilities
│   │   │   └── auditLog.js      # Audit logging
│   │   └── server.js            # Express app entry
│   ├── .env                     # Environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── utils/
│   │   │   └── api.js           # Fetch wrapper with credentials
│   │   ├── App.jsx              # Root component
│   │   ├── App.css              # Global styles
│   │   └── main.jsx             # Entry point
│   └── package.json
├── docs/
│   ├── API_REFERENCE.md         # API documentation
│   ├── COMPONENT_MAP.md         # This file
│   ├── DATABASE_SCHEMA.md       # Database documentation
│   └── SECURITY.md              # Security architecture
├── LICENSE.md                   # Proprietary licence
├── NOTICE.md                    # Copyright notice
└── README.md                    # Project overview
```
