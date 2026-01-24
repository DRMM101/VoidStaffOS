# VoidStaffOS API Reference

Last Updated: 2024-01-24

Base URL: `http://localhost:3001/api`

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

Tokens expire after 24 hours.

---

## Auth Endpoints

### POST /auth/login
Authenticate user and receive JWT token.

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
  "token": "eyJhbGciOiJIUzI1NiIs...",
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

**Errors:**
- 400: Missing email or password
- 401: Invalid credentials

---

## User Endpoints

### GET /users
Get list of users (filtered by role permissions).

**Auth Required:** Yes
**Roles:** Admin sees all, Manager sees self + direct reports, Employee sees self only

**Query Parameters:**
- None currently (pagination to be added)

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

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "john@example.com",
    "full_name": "John Doe",
    "role_id": 2,
    "role_name": "Manager",
    "tier": 2,
    "manager_id": null,
    "employee_number": "EMP001"
  }
}
```

**Errors:**
- 403: Insufficient permissions
- 404: User not found

---

### GET /users/:id/profile
Get detailed user profile with manager info and tenure.

**Auth Required:** Yes
**Roles:** Same visibility rules as GET /users/:id

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

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": { ... }
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

**Request Body:** (all fields optional)
```json
{
  "full_name": "Updated Name",
  "role_id": 3,
  "tier": 3,
  "employment_status": "inactive",
  "password": "newpassword"
}
```

---

### PUT /users/:id/assign-manager
Assign or change a user's manager.

**Auth Required:** Yes
**Roles:** Admin, or Manager (limited)

**Request Body:**
```json
{
  "manager_id": 5,
  "manager_contact_email": "override@example.com",
  "manager_contact_phone": "555-1234"
}
```

---

### POST /users/adopt-employee/:employeeId
Manager adopts an orphaned employee.

**Auth Required:** Yes
**Roles:** Manager, Admin

**Constraints:**
- Employee must not have a manager (unless Admin)
- Employee must be lower tier than adopting manager

**Response (200):**
```json
{
  "message": "Successfully adopted John Doe",
  "employee": { ... },
  "manager": { ... }
}
```

---

### POST /users/:id/transfer
Transfer employee to new manager or orphan them.

**Auth Required:** Yes
**Roles:** Admin, or current Manager of employee

**Request Body (transfer):**
```json
{
  "new_manager_id": 5
}
```

**Request Body (orphan):**
```json
{
  "orphan": true
}
```

---

### GET /users/:id/transfer-targets
Get eligible managers for transferring an employee.

**Auth Required:** Yes
**Roles:** Admin, or current Manager

**Response (200):**
```json
{
  "eligible_managers": [
    {
      "id": 5,
      "full_name": "Jane Smith",
      "tier": 2,
      "role_name": "Manager"
    }
  ],
  "employee_tier": 4
}
```

---

### GET /users/managers
Get list of all managers (for dropdowns).

**Auth Required:** Yes

---

### GET /users/orphaned
Get employees without managers.

**Auth Required:** Yes
**Roles:** Admin sees all orphans, Manager sees only orphans they can adopt (lower tier)

---

### GET /users/my-team
Get current user's direct reports.

**Auth Required:** Yes
**Roles:** Manager, Admin

---

### GET /users/with-review-status
Get users with their current week review status.

**Auth Required:** Yes

---

## Review Endpoints

### GET /reviews
Get reviews (filtered by permissions).

**Auth Required:** Yes
**Roles:** Admin/Compliance sees all, Manager sees own + team's, Employee sees own only

---

### GET /reviews/:id
Get single review.

**Auth Required:** Yes

**Note:** For managers viewing team's self-reflections, text fields are hidden (show KPIs only).

---

### GET /reviews/my-latest
Get current user's most recent review.

**Auth Required:** Yes

---

### GET /reviews/my-reflection-status
Get current user's weekly reflection status (blind review state).

**Auth Required:** Yes

**Response (200):**
```json
{
  "current_week_friday": "2024-01-19",
  "has_current_week_reflection": true,
  "self_committed": true,
  "manager_committed": false,
  "both_committed": false,
  "self_reflection": { ... },
  "manager_review": null,
  "previous_quarter_averages": {
    "quarter": "Q4 2023",
    "velocity": 7.5,
    "friction": 7.2,
    "cohesion": 7.8
  }
}
```

---

### POST /reviews
Create a review (manager reviewing employee).

**Auth Required:** Yes
**Roles:** Admin, Manager (for their team only)

**Request Body:**
```json
{
  "employee_id": 3,
  "review_date": "2024-01-19",
  "tasks_completed": 8,
  "work_volume": 7,
  "problem_solving": 8,
  "communication": 7,
  "leadership": 6,
  "goals": "Complete project X",
  "achievements": "Delivered feature Y",
  "areas_for_improvement": "Communication in meetings"
}
```

---

### POST /reviews/self-reflection
Create a self-reflection.

**Auth Required:** Yes
**Roles:** Any authenticated user

---

### PUT /reviews/:id
Update a review.

**Auth Required:** Yes
**Roles:** Original reviewer only (unless Admin)

**Constraint:** Cannot update committed reviews (unless Admin)

---

### POST /reviews/:id/commit
Commit (finalize) a manager review.

**Auth Required:** Yes
**Roles:** Original reviewer, Admin

---

### POST /reviews/self-reflection/:id/commit
Commit a self-reflection.

**Auth Required:** Yes
**Roles:** Owner only

---

### POST /reviews/:id/uncommit
Uncommit a review (Admin only).

**Auth Required:** Yes
**Roles:** Admin only

---

## Leave Endpoints

### POST /leave/request
Submit a leave request.

**Auth Required:** Yes

**Request Body:**
```json
{
  "leave_start_date": "2024-02-01",
  "leave_end_date": "2024-02-05",
  "leave_type": "full_day",
  "notes": "Family vacation"
}
```

**Response (201):**
```json
{
  "message": "Leave request submitted successfully",
  "leave_request": { ... },
  "notice_warning": "Notice period is 5 days, but policy requires 10 days"
}
```

---

### GET /leave/my-requests
Get current user's leave requests with balance.

**Auth Required:** Yes

---

### GET /leave/my-balance
Get current user's leave balance.

**Auth Required:** Yes

**Response (200):**
```json
{
  "balance": {
    "employee_id": 1,
    "employee_name": "John Doe",
    "entitlement": 28,
    "used": 5,
    "pending": 3,
    "remaining": 23,
    "available": 20
  }
}
```

---

### GET /leave/balance/:id
Get leave balance for specific employee.

**Auth Required:** Yes
**Roles:** Admin, or Manager of employee

---

### GET /leave/pending
Get pending leave requests for approval.

**Auth Required:** Yes
**Roles:** Manager (sees team), Admin (sees all)

---

### GET /leave/pending-count
Get count of pending leave requests.

**Auth Required:** Yes
**Roles:** Manager, Admin

---

### GET /leave/team
Get all leave requests for team.

**Auth Required:** Yes
**Roles:** Manager, Admin

---

### PUT /leave/:id/approve
Approve a leave request.

**Auth Required:** Yes
**Roles:** Admin, or Manager of requesting employee

---

### PUT /leave/:id/reject
Reject a leave request.

**Auth Required:** Yes
**Roles:** Admin, or Manager of requesting employee

**Request Body:**
```json
{
  "rejection_reason": "Team is understaffed that week"
}
```

---

### PUT /leave/:id/cancel
Cancel own pending leave request.

**Auth Required:** Yes
**Roles:** Request owner only

---

## Notification Endpoints

### GET /notifications
Get user's notifications.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (default: 50)
- `offset` (default: 0)
- `unread_only` (true/false)

**Response (200):**
```json
{
  "notifications": [
    {
      "id": 1,
      "type": "leave_request_approved",
      "title": "Leave Request Approved",
      "message": "Your leave request for Feb 1-5 has been approved.",
      "is_read": false,
      "created_at": "2024-01-20T10:30:00Z"
    }
  ],
  "unread_count": 3,
  "total": 10
}
```

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

### DELETE /notifications/:id
Delete/dismiss a notification.

**Auth Required:** Yes

---

### POST /notifications/check-overdue
Check for and create overdue snapshot notifications.

**Auth Required:** Yes

---

## Report Endpoints

### GET /reports/team-performance
Get team performance summary.

**Auth Required:** Yes
**Roles:** Manager, Admin

---

### GET /reports/employee/:id/history
Get review history for an employee.

**Auth Required:** Yes
**Roles:** Admin, Manager of employee, Employee (self only)

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
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 409: Conflict (duplicate entry)
- 500: Internal Server Error

---

## Rate Limiting

- Global: 100 requests per minute per IP
- Login: More restrictive (recommended: 5 attempts per minute)

---

## Pagination (To Be Implemented)

Future endpoints will support:
```
GET /users?page=1&limit=20
GET /reviews?page=1&limit=50
GET /notifications?page=1&limit=20
```

Response will include:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```
