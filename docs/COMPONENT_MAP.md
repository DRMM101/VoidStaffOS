<!--
  VoidStaffOS - Component Map Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 24/01/2026
  Updated: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS Component Map

Last Updated: 2026-01-31

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

### Policy Management (PolicyOS)
| Component | File | Description |
|-----------|------|-------------|
| Policies | `Policies.jsx` | Main policy management container with tabs |
| PolicyList | `PolicyList.jsx` | List of policies with status indicators |
| PolicyEditor | `PolicyEditor.jsx` | Create/edit policy with rich text |
| PolicyViewer | `PolicyViewer.jsx` | View policy and acknowledge |
| PolicyAcknowledgments | `PolicyAcknowledgments.jsx` | Acknowledgment tracking dashboard |

### Document Storage
| Component | File | Description |
|-----------|------|-------------|
| Documents | `Documents.jsx` | Main document management interface |
| DocumentUpload | `DocumentUpload.jsx` | File upload with category selection |
| DocumentList | `DocumentList.jsx` | Document list with expiry indicators |

### Compliance (RTW/DBS Tracking)
| Component | File | Description |
|-----------|------|-------------|
| Compliance | `Compliance.jsx` | Main compliance container with tabs |
| ComplianceDashboard | `ComplianceDashboard.jsx` | Overview with compliance rates |
| RTWCheckManager | `RTWCheckManager.jsx` | Right to Work verification CRUD |
| DBSCheckManager | `DBSCheckManager.jsx` | DBS certificate management |
| ComplianceTasks | `ComplianceTasks.jsx` | Task management for follow-ups |
| ComplianceReport | `ComplianceReport.jsx` | Configurable compliance report (CQC/etc) |
| ComplianceSettings | `ComplianceSettings.jsx` | Module settings (HR only) |

### Probation Management
| Component | File | Description |
|-----------|------|-------------|
| ProbationDashboard | `ProbationDashboard.jsx` | Main probation tracking interface |
| ProbationReviewModal | `ProbationReviewModal.jsx` | Create/edit probation reviews |

### Sick & Statutory Leave
| Component | File | Description |
|-----------|------|-------------|
| AbsenceDashboard | `AbsenceDashboard.jsx` | Main absence management interface |
| ReportSickLeaveModal | `ReportSickLeaveModal.jsx` | Employee sick leave self-reporting |
| StatutoryLeaveModal | `StatutoryLeaveModal.jsx` | Statutory leave request form |
| RTWInterviewModal | `RTWInterviewModal.jsx` | Return to Work interview form |

### Absence Insights
| Component | File | Description |
|-----------|------|-------------|
| InsightsDashboard | `InsightsDashboard.jsx` | HR dashboard for absence pattern analysis |
| InsightCard | `InsightCard.jsx` | Individual insight display card |
| InsightReviewModal | `InsightReviewModal.jsx` | Insight review and action modal |

### Offboarding
| Component | File | Description |
|-----------|------|-------------|
| OffboardingDashboard | `OffboardingDashboard.jsx` | Main dashboard with stats, active/completed/cancelled tabs |
| InitiateOffboardingModal | `InitiateOffboardingModal.jsx` | Form to start offboarding workflow (employee, type, dates) |
| OffboardingDetail | `OffboardingDetail.jsx` | Full workflow view with 4 tabs: checklist, exit interview, handovers, details |

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
| policyController | `policyController.js` | Policy CRUD, acknowledgment tracking |
| documentController | `documentController.js` | Document upload, access logging, expiry tracking |
| complianceController | `complianceController.js` | RTW/DBS checks, compliance tasks, settings |
| probationController | `probationController.js` | Probation period tracking, reviews |
| sickLeaveController | `sickLeaveController.js` | Sick leave reporting, RTW interviews |
| statutoryLeaveController | `statutoryLeaveController.js` | Statutory leave management |
| absenceInsightsController | `absenceInsightsController.js` | Absence pattern detection, Bradford Factor |
| offboardingController | `offboardingController.js` | Offboarding workflow, checklists, exit interviews |

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
| policies.js | `/api/policies` | Policy management and acknowledgments |
| documents.js | `/api/documents` | Document upload and access |
| compliance.js | `/api/compliance` | RTW/DBS checks, tasks, settings |
| probation.js | `/api/probation` | Probation tracking and reviews |
| sick-leave.js | `/api/sick-leave` | Sick leave reporting and RTW interviews |
| statutory-leave.js | `/api/statutory-leave` | Statutory leave requests |
| absence-insights.js | `/api/absence-insights` | Absence pattern detection and insights |
| offboarding.js | `/api/offboarding` | Offboarding workflow, checklists, exit interviews |
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
// Sick Leave
notifySickLeaveReported()          // Same-day marked urgent (🚨)
notifyRTWInterviewRequired()       // After sick leave return
// Offboarding
notifyOffboardingInitiated()       // Workflow started
notifyOffboardingTaskAssigned()    // Task assigned to user
notifyExitInterviewScheduled()     // Interview scheduled
notifyHandoverAssigned()           // Knowledge transfer assigned
notifyOffboardingCompleted()       // Workflow complete
notifyOffboardingReminder()        // Deadline reminders (2wk, 1wk, 2d, 1d)
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
| probation_periods | Probation tracking | → users (employee, manager) |
| probation_reviews | Probation review records | → probation_periods |
| sick_leave_records | Sick leave reporting | → users (employee, manager) |
| rtw_interviews | Return to Work interviews | → sick_leave_records |
| statutory_leave_requests | Statutory leave management | → users (employee, manager) |
| absence_insights | Pattern detection results | → users (employee) |
| absence_summaries | 12-month rolling summaries | → users (employee) |
| offboarding_workflows | Exit workflow management | → users (employee, manager, hr) |
| offboarding_checklist_items | Compliance checklist | → offboarding_workflows |
| exit_interviews | Exit interview records | → offboarding_workflows |
| offboarding_handovers | Knowledge transfer tracking | → offboarding_workflows |

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
| Report sick leave | ✓ | ✓ | ✓ | |
| Conduct RTW interview | ✓ | ✓ (team) | | |
| View absence insights | ✓ | | | |
| Initiate offboarding | ✓ | ✓ | | |
| Complete checklist items | ✓ | ✓ | ✓ (assigned) | |
| Conduct exit interview | ✓ | | | |

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
