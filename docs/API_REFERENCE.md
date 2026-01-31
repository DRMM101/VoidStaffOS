<!--
  VoidStaffOS - API Reference Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 24/01/2026
  Updated: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS API Reference

Last Updated: 2026-01-31

Base URL: `http://localhost:3001/api`

## Authentication

VoidStaffOS uses **secure HttpOnly session cookies** for authentication. No tokens are stored in localStorage or exposed to JavaScript.

### Session Cookie
After successful login, the server sets an HttpOnly cookie named `staffos_sid`. This cookie is automatically sent with all requests when using `credentials: 'include'`.

### CSRF Protection
A readable `staffos_csrf` cookie is set for CSRF protection. Include this token in the `X-CSRF-Token` header for all state-changing requests (POST, PUT, PATCH, DELETE).

### Frontend Implementation
```javascript
// All fetch requests must include credentials
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken() // Read from staffos_csrf cookie
  },
  credentials: 'include', // Required for session cookies
  body: JSON.stringify(data)
});
```

---

## Auth Endpoints

### POST /auth/login
Authenticate user and establish session.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "role_name": "Manager",
    "tier": 2,
    "employee_number": "EMP001"
  }
}
```

**Side Effects:**
- Sets `staffos_sid` HttpOnly session cookie
- Sets `staffos_csrf` readable CSRF token cookie
- Creates session record in `user_sessions` table
- Logs `LOGIN_SUCCESS` to audit_logs

**Errors:**
- 400: Missing email or password
- 401: Invalid credentials or inactive account

---

### GET /auth/me
Get current authenticated user's profile.

**Auth Required:** Yes (session cookie)

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "role_id": 2,
    "role_name": "Manager",
    "tier": 2,
    "employee_number": "EMP001",
    "employment_status": "active",
    "start_date": "2023-01-15"
  }
}
```

**Errors:**
- 401: No valid session

---

### POST /auth/logout
End user session and clear cookies.

**Auth Required:** No (works with or without session)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Side Effects:**
- Destroys session in `user_sessions` table
- Clears `staffos_sid` cookie
- Clears `staffos_csrf` cookie
- Logs `LOGOUT` to audit_logs

---

### POST /auth/register
Create new user account.

**Auth Required:** No (typically disabled in production)

**Request Body:**
```json
{
  "email": "new@example.com",
  "password": "password123",
  "full_name": "New User",
  "role_id": 3
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 2,
    "email": "new@example.com",
    "full_name": "New User",
    "role_id": 3
  }
}
```

---

## User Endpoints

### GET /users
Get list of users (filtered by role permissions).

**Auth Required:** Yes
**Roles:** Admin sees all, Manager sees self + direct reports, Employee sees self only

**Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "email": "john@example.com",
      "full_name": "John Doe",
      "role_id": 2,
      "role_name": "Manager",
      "tier": 2,
      "employment_status": "active",
      "start_date": "2023-01-15",
      "employee_number": "EMP001"
    }
  ]
}
```

---

### GET /users/:id
Get single user by ID.

**Auth Required:** Yes
**Roles:** Admin/Compliance see any, Manager sees self + team, Employee sees self only

**Errors:**
- 403: Insufficient permissions
- 404: User not found

---

### GET /users/:id/profile
Get detailed user profile with manager info and tenure.

**Auth Required:** Yes

**Response (200):**
```json
{
  "profile": {
    "id": 1,
    "email": "john@example.com",
    "full_name": "John Doe",
    "employee_number": "EMP001",
    "role_name": "Manager",
    "tier": 2,
    "employment_status": "active",
    "start_date": "2023-01-15",
    "tenure": {
      "years": 1,
      "months": 0,
      "display": "1y 0m"
    },
    "manager": {
      "id": 5,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "employee_number": "EMP005"
    },
    "has_manager": true
  }
}
```

---

### POST /users
Create new user.

**Auth Required:** Yes
**Roles:** Admin only

**Request Body:**
```json
{
  "email": "new@example.com",
  "password": "password123",
  "full_name": "New Employee",
  "role_id": 3,
  "start_date": "2024-01-15",
  "employee_number": "EMP010",
  "manager_id": 2,
  "tier": 4
}
```

**Errors:**
- 400: Missing required fields
- 409: Email or employee number already exists

---

### PUT /users/:id
Update user.

**Auth Required:** Yes
**Roles:** Admin only

---

### GET /users/my-team
Get current user's direct reports.

**Auth Required:** Yes
**Roles:** Manager, Admin

**Response (200):**
```json
{
  "employees": [
    {
      "id": 3,
      "full_name": "Team Member",
      "email": "member@example.com",
      "role_name": "Employee"
    }
  ]
}
```

---

### GET /users/team-summary
Get team performance summary with KPIs.

**Auth Required:** Yes
**Roles:** Manager, Admin

**Response (200):**
```json
{
  "team_members": [
    {
      "id": 3,
      "full_name": "Team Member",
      "tier": 4,
      "role_name": "Employee",
      "last_review_date": "2026-01-23",
      "days_since_review": 2,
      "staleness_status": "current",
      "kpis": {
        "velocity": {"value": 7.5, "status": "green"},
        "friction": {"value": 7.2, "status": "green"},
        "cohesion": {"value": 6.8, "status": "green"}
      }
    }
  ],
  "team_averages": {
    "velocity": {"value": 7.5, "status": "green"},
    "friction": {"value": 7.2, "status": "green"},
    "cohesion": {"value": 6.8, "status": "green"}
  },
  "summary": {
    "total_members": 1,
    "members_with_kpis": 1,
    "overdue_reviews": 0
  }
}
```

---

### PUT /users/:id/assign-manager
Assign or change a user's manager.

**Auth Required:** Yes
**Roles:** Admin, or Manager (limited)

---

### POST /users/adopt-employee/:employeeId
Manager adopts an orphaned employee.

**Auth Required:** Yes
**Roles:** Manager, Admin

---

### POST /users/:id/transfer
Transfer employee to new manager.

**Auth Required:** Yes
**Roles:** Admin, or current Manager

---

### GET /users/managers
Get list of all managers.

**Auth Required:** Yes

---

### GET /users/orphaned
Get employees without managers.

**Auth Required:** Yes
**Roles:** Admin, Manager

---

## Review Endpoints

### GET /reviews
Get reviews (filtered by permissions).

**Auth Required:** Yes

---

### GET /reviews/:id
Get single review.

**Auth Required:** Yes

---

### GET /reviews/my-latest
Get current user's most recent review.

**Auth Required:** Yes

---

### GET /reviews/my-reflection-status
Get current user's weekly reflection status.

**Auth Required:** Yes

---

### POST /reviews
Create a review (manager reviewing employee).

**Auth Required:** Yes
**Roles:** Admin, Manager

---

### POST /reviews/self-reflection
Create a self-reflection.

**Auth Required:** Yes

---

### PUT /reviews/:id
Update a review.

**Auth Required:** Yes
**Constraint:** Cannot update committed reviews

---

### POST /reviews/:id/commit
Commit a manager review.

**Auth Required:** Yes

---

### POST /reviews/self-reflection/:id/commit
Commit a self-reflection.

**Auth Required:** Yes

---

## Leave Endpoints

### POST /leave/request
Submit a leave request.

**Auth Required:** Yes

---

### GET /leave/my-requests
Get current user's leave requests.

**Auth Required:** Yes

---

### GET /leave/my-balance
Get current user's leave balance.

**Auth Required:** Yes

---

### GET /leave/pending
Get pending leave requests for approval.

**Auth Required:** Yes
**Roles:** Manager, Admin

---

### PUT /leave/:id/approve
Approve a leave request.

**Auth Required:** Yes
**Roles:** Admin, or Manager of employee

---

### PUT /leave/:id/reject
Reject a leave request.

**Auth Required:** Yes
**Roles:** Admin, or Manager of employee

---

## Notification Endpoints

### GET /notifications
Get user's notifications.

**Auth Required:** Yes

---

### GET /notifications/unread-count
Get count of unread notifications.

**Auth Required:** Yes

---

### PUT /notifications/:id/read
Mark notification as read.

**Auth Required:** Yes

---

### PUT /notifications/read-all
Mark all notifications as read.

**Auth Required:** Yes

---

## Feedback Endpoints (360 Feedback)

### GET /feedback/pending
Get pending feedback requests.

**Auth Required:** Yes

---

### POST /feedback/quarterly
Submit quarterly feedback.

**Auth Required:** Yes

---

### GET /feedback/composite/:employeeId/:quarter
Get composite KPIs for employee.

**Auth Required:** Yes

---

## Policy Endpoints (PolicyOS)

### GET /policies
Get all policies (filtered by status for non-HR).

**Auth Required:** Yes

---

### GET /policies/:id
Get single policy.

**Auth Required:** Yes

---

### POST /policies
Create new policy.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### PUT /policies/:id
Update policy.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### POST /policies/:id/publish
Publish a draft policy.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### POST /policies/:id/acknowledge
Acknowledge a policy.

**Auth Required:** Yes

---

### GET /policies/:id/acknowledgments
Get acknowledgment status for a policy.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### GET /policies/pending-acknowledgments
Get policies pending user acknowledgment.

**Auth Required:** Yes

---

## Document Endpoints

### GET /documents
Get documents (filtered by permissions).

**Auth Required:** Yes

---

### GET /documents/:id
Get single document metadata.

**Auth Required:** Yes

---

### GET /documents/:id/download
Download document file.

**Auth Required:** Yes

---

### POST /documents/upload
Upload new document.

**Auth Required:** Yes
**Roles:** Admin, HR Manager (for any employee), Employee (for self)

---

### DELETE /documents/:id
Archive/delete document.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

## Compliance Endpoints (RTW/DBS)

### GET /compliance/dashboard
Get compliance overview with statistics.

**Auth Required:** Yes

---

### GET /compliance/stats
Get summary compliance statistics.

**Auth Required:** Yes

---

### GET /compliance/rtw
Get RTW checks.

**Auth Required:** Yes

---

### GET /compliance/rtw/:id
Get single RTW check.

**Auth Required:** Yes

---

### POST /compliance/rtw
Create RTW check.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### PUT /compliance/rtw/:id
Update RTW check.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### GET /compliance/dbs
Get DBS checks.

**Auth Required:** Yes

---

### GET /compliance/dbs/:id
Get single DBS check.

**Auth Required:** Yes

---

### POST /compliance/dbs
Create DBS check.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### PUT /compliance/dbs/:id
Update DBS check.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### POST /compliance/dbs/:id/update-check
Record DBS Update Service check.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### GET /compliance/tasks
Get compliance tasks.

**Auth Required:** Yes

---

### POST /compliance/tasks
Create manual compliance task.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### PUT /compliance/tasks/:id
Update task (status, assignment).

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### GET /compliance/settings
Get compliance module settings.

**Auth Required:** Yes

---

### PUT /compliance/settings
Update compliance settings.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### GET /compliance/report
Get compliance report data for PDF generation.

**Auth Required:** Yes

---

### GET /compliance/expiring
Get checks expiring within specified days.

**Auth Required:** Yes

---

## Sick & Statutory Leave Endpoints

### GET /sick-leave/categories
Get available absence categories for the tenant.

**Auth Required:** Yes

**Response:**
```json
{
  "categories": [
    {
      "category": "sick",
      "display_name": "Sick Leave",
      "requires_approval": false,
      "requires_evidence_after_days": 7,
      "rtw_required_after_days": 1
    }
  ]
}
```

---

### POST /sick-leave/report
Report sick leave (employee self-service). No approval required.

**Auth Required:** Yes

**Request Body:**
```json
{
  "start_date": "2026-01-30",
  "end_date": "2026-01-31",
  "sick_reason": "illness",
  "sick_notes": "Flu symptoms",
  "is_ongoing": false
}
```

**Response:**
```json
{
  "message": "Sick leave reported successfully",
  "leave_request": { ... },
  "fit_note_required": false
}
```

---

### PUT /sick-leave/:id
Update sick leave (extend or close ongoing absence).

**Auth Required:** Yes

---

### POST /sick-leave/:id/fit-note
Attach fit note document to sick leave.

**Auth Required:** Yes

---

### POST /sick-leave/statutory
Request statutory leave (maternity, paternity, bereavement, etc.).

**Auth Required:** Yes

**Request Body:**
```json
{
  "absence_category": "maternity",
  "start_date": "2026-03-01",
  "end_date": "2026-08-31",
  "expected_date": "2026-03-15",
  "weeks_requested": 26,
  "notes": "Starting 2 weeks before due date"
}
```

---

### GET /sick-leave/rtw/pending
Get pending Return to Work interviews.

**Auth Required:** Yes
**Roles:** Admin, Manager

---

### GET /sick-leave/rtw/follow-ups
Get pending follow-up interviews scheduled after RTW completion.

**Auth Required:** Yes
**Roles:** Admin, Manager

**Response:**
```json
{
  "pending_follow_ups": [
    {
      "id": 1,
      "employee_id": 3,
      "employee_name": "John Doe",
      "follow_up_date": "2026-02-07",
      "follow_up_notes": "Check on phased return progress"
    }
  ]
}
```

---

### POST /sick-leave/rtw
Create Return to Work interview for a sick leave record.

**Auth Required:** Yes
**Roles:** Admin, Manager

**Request Body:**
```json
{
  "leave_request_id": 123
}
```

---

### GET /sick-leave/rtw/:leaveRequestId
Get RTW interview for a specific leave request.

**Auth Required:** Yes

---

### PUT /sick-leave/rtw/:id/complete
Complete RTW interview with wellbeing notes.

**Auth Required:** Yes
**Roles:** Admin, Manager

**Request Body:**
```json
{
  "feeling_ready": true,
  "ready_notes": "Feeling much better",
  "ongoing_concerns": "",
  "workplace_adjustments": "Phased return first week",
  "support_required": "",
  "wellbeing_notes": "Good spirits",
  "follow_up_required": true,
  "follow_up_date": "2026-02-07",
  "oh_referral_recommended": false,
  "manager_notes": "Smooth return expected"
}
```

---

### GET /sick-leave/ssp/:employeeId
Get employee's SSP (Statutory Sick Pay) status.

**Auth Required:** Yes
**Roles:** Admin, Manager

**Response:**
```json
{
  "ssp_periods": [...],
  "total_weeks_paid": 4,
  "remaining_weeks": 24,
  "max_weeks": 28
}
```

---

## Absence Insights Endpoints

### GET /absence-insights
Get insights for HR dashboard with filtering.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager (sees only direct reports)

**Query Parameters:**
- `status` - Filter by status (new, pending_review, reviewed, action_taken, dismissed)
- `priority` - Filter by priority (low, medium, high)
- `pattern_type` - Filter by pattern type
- `employee_id` - Filter by employee
- `limit` - Results limit (default 50)
- `offset` - Pagination offset

**Response (200):**
```json
{
  "insights": [...],
  "counts": {"new": 5, "pending_review": 3},
  "pagination": {"limit": 50, "offset": 0, "total": 8}
}
```

---

### GET /absence-insights/dashboard
Get dashboard summary for insights.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager

**Response (200):**
```json
{
  "overview": {
    "pending_count": 8,
    "new_count": 5,
    "high_priority_count": 2,
    "recent_count": 3
  },
  "pattern_breakdown": [
    {"pattern_type": "frequency", "count": 3}
  ],
  "high_priority_insights": [...],
  "top_bradford_scores": [...]
}
```

---

### GET /absence-insights/:id
Get single insight with full details.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager

**Response (200):**
```json
{
  "insight": {
    "id": 1,
    "employee_id": 3,
    "employee_name": "John Doe",
    "pattern_type": "frequency",
    "priority": "medium",
    "status": "new",
    "summary": "6 absences in the last 90 days",
    "pattern_data": {...},
    "related_absences": [...],
    "review_history": [...],
    "employee_summary": {...}
  }
}
```

---

### PUT /absence-insights/:id/review
Mark insight as reviewed with notes.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager

**Request Body:**
```json
{
  "notes": "Reviewed, no immediate concern"
}
```

---

### PUT /absence-insights/:id/action
Record action taken on an insight.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager

**Request Body:**
```json
{
  "action_taken": "Wellbeing conversation scheduled",
  "follow_up_date": "2026-02-15"
}
```

---

### PUT /absence-insights/:id/dismiss
Dismiss an insight as not concerning.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager

**Request Body:**
```json
{
  "reason": "Known medical condition, already managed"
}
```

---

### GET /absence-insights/employee/:employeeId
Get all insights for a specific employee.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager (for direct reports)

---

### POST /absence-insights/run-detection/:employeeId
Manually trigger pattern detection for an employee.

**Auth Required:** Yes
**Roles:** Admin, HR Manager

---

### GET /absence-insights/follow-ups/pending
Get insights with pending follow-up dates.

**Auth Required:** Yes
**Roles:** Admin, HR Manager, Manager

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- 400: Bad Request (validation error)
- 401: Unauthorized (no session or expired)
- 403: Forbidden (insufficient permissions or CSRF validation failed)
- 404: Not Found
- 409: Conflict (duplicate entry)
- 429: Too Many Requests (rate limited)
- 500: Internal Server Error

---

## Rate Limiting

- **Global:** 100 requests per minute per IP
- **Auth endpoints:** 10 requests per minute per IP

---

## Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (production)
- `Content-Security-Policy`
