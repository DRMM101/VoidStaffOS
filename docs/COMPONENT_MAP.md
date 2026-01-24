# VoidStaffOS Component Map

Last Updated: 2024-01-24

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
│                         HTTP/REST                                │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                         BACKEND (Node.js/Express)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Middleware                           │   │
│  │  ┌─────────┐  ┌────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │ Helmet  │  │  CORS  │  │Rate Limit│  │    Auth    │  │   │
│  │  └─────────┘  └────────┘  └──────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Controllers                          │   │
│  │  ┌──────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌────────────┐  │   │
│  │  │ Auth │ │ User │ │ Review │ │ Leave │ │Notification│  │   │
│  │  └──────┘ └──────┘ └────────┘ └───────┘ └────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                         DATABASE (PostgreSQL)                    │
│  ┌───────┐ ┌───────┐ ┌─────────┐ ┌────────────────┐ ┌─────────┐│
│  │ users │ │reviews│ │leave_req│ │ notifications  │ │audit_log││
│  └───────┘ └───────┘ └─────────┘ └────────────────┘ └─────────┘│
└──────────────────────────────────────────────────────────────────┘
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
| App | `App.jsx` | Root component, handles auth state and routing |
| Login | `Login.jsx` | Authentication form |
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

### Controllers
| Controller | File | Responsibility |
|------------|------|----------------|
| authController | `authController.js` | Login, JWT generation |
| userController | `userController.js` | CRUD users, manager assignment, transfers, orphan management |
| reviewController | `reviewController.js` | CRUD reviews, KPI calculations, blind review logic |
| leaveController | `leaveController.js` | Leave requests, approvals, balance calculations |
| notificationController | `notificationController.js` | CRUD notifications, trigger functions |
| reportController | `reportController.js` | Team performance reports |

### Routes
| Route File | Base Path | Description |
|------------|-----------|-------------|
| auth.js | `/api/auth` | Login endpoint |
| users.js | `/api/users` | User management |
| reviews.js | `/api/reviews` | Performance reviews |
| leave.js | `/api/leave` | Leave management |
| notifications.js | `/api/notifications` | Notification system |
| reports.js | `/api/reports` | Reporting endpoints |
| dev.js | `/api/dev` | Development utilities |

### Middleware
| Middleware | File | Purpose |
|------------|------|---------|
| authenticate | `auth.js` | Verify JWT token |
| authorize | `auth.js` | Role-based access control |

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

---

## Database Tables

| Table | Primary Purpose | Key Relationships |
|-------|-----------------|-------------------|
| roles | Role definitions | → users.role_id |
| users | Employee data, hierarchy | → self (manager_id), → roles |
| reviews | Performance snapshots | → users (employee, reviewer) |
| leave_requests | Time-off management | → users (employee, manager) |
| notifications | System alerts | → users |
| audit_log | Change tracking | → users |

---

## Authentication Flow

```
1. User submits credentials
   POST /api/auth/login { email, password }

2. Server validates
   - Check email exists
   - Compare password hash
   - Generate JWT with user data

3. Client stores token
   localStorage.setItem('token', jwt)

4. Subsequent requests
   Authorization: Bearer <jwt>

5. Middleware validates
   authenticate() → decode JWT → attach req.user
   authorize('Admin', 'Manager') → check role
```

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
│   ├── migrations/          # SQL migration files
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js  # PostgreSQL connection
│   │   ├── controllers/     # Business logic
│   │   ├── middleware/      # Auth, validation
│   │   ├── routes/          # API endpoints
│   │   └── server.js        # Express app entry
│   ├── .env                 # Environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── App.jsx          # Root component
│   │   ├── App.css          # Global styles
│   │   └── main.jsx         # Entry point
│   └── package.json
└── docs/
    ├── API_REFERENCE.md
    ├── COMPONENT_MAP.md
    └── DATABASE_SCHEMA.md
```
