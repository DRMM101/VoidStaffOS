# HeadOfficeOS — API Documentation

## Authentication

All endpoints require session-based authentication. The user session is established via `/api/auth/login` and stored in a server-side session cookie.

- `req.user` is populated by auth middleware
- `req.session.tenantId` provides multi-tenant isolation
- All DB queries filter by `tenant_id`

---

## Org Chart Endpoints

**Base path:** `/api/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/org-chart` | Admin, Manager | Returns nested JSON tree of all active employees based on `manager_id` relationships. Response: `{ tree: [...], total_employees: N }`. Each node includes `id`, `full_name`, `email`, `employee_number`, `tier`, `role_name`, `manager_id`, `direct_reports`, `children: [...]`. |

**Related existing endpoints used by Org Chart:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/managers` | Any authenticated | List of users with Admin/Manager role (for reassignment dropdown) |
| PUT | `/:id/assign-manager` | Admin, Manager | Reassign an employee's manager |

---

## Compensation Endpoints

**Base path:** `/api/compensation`

All endpoints require authentication. Access control varies by role:
- **Employee**: Own data only
- **Manager**: Direct reports (current salary only)
- **HR / Admin / Finance**: Full access
- **Director**: Aggregate reports only

### Dashboard & Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stats` | HR/Admin/Finance | Dashboard statistics (total payroll, avg salary, employee count, active cycles, upcoming changes, pending reviews) |

### Pay Bands

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pay-bands` | Any authenticated | List all pay bands for tenant |
| POST | `/pay-bands` | HR/Admin | Create a new pay band |
| PUT | `/pay-bands/:id` | HR/Admin | Update a pay band |
| DELETE | `/pay-bands/:id` | HR/Admin | Delete a pay band |

**Pay Band fields:** `band_name`, `grade`, `min_salary`, `mid_salary`, `max_salary`, `currency`, `tier_level` (optional, INTEGER FK to tier_definitions)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pay-bands/by-tier/:tierLevel` | Any authenticated | List pay bands for a specific tier level |

### Compensation Records

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | Employee | Get own compensation history |
| GET | `/employee/:id` | Manager/HR/Admin | Get employee's compensation records |
| POST | `/records` | HR/Admin | Create a new compensation record |

**Record fields:** `employee_id`, `pay_band_id`, `base_salary`, `effective_date`, `reason`, `approved_by`

### Benefits

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/benefits/:employeeId` | Employee(self)/HR/Admin | List benefits for an employee |
| POST | `/benefits` | HR/Admin | Create a benefit |
| PUT | `/benefits/:id` | HR/Admin | Update a benefit |
| DELETE | `/benefits/:id` | HR/Admin | Delete a benefit |

**Benefit types:** `pension`, `healthcare`, `car`, `bonus`, `stock`, `allowance`, `other`

**Benefit fields:** `employee_id`, `benefit_type`, `benefit_name`, `value`, `frequency`, `employer_contribution`, `employee_contribution`, `start_date`, `end_date`

### Review Cycles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/review-cycles` | HR/Admin | List review cycles |
| POST | `/review-cycles` | HR/Admin | Create a review cycle |
| PUT | `/review-cycles/:id` | HR/Admin | Update a review cycle |

**Cycle fields:** `cycle_name`, `start_date`, `end_date`, `status`, `budget_total`

### Pay Reviews

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reviews` | HR/Admin | List pay reviews (filterable by `cycle_id`, `status`) |
| POST | `/reviews` | HR/Admin | Create a pay review |
| PUT | `/reviews/:id` | HR/Admin | Update review (including status transitions) |

**Status workflow:** `draft` → `submitted` → `hr_review` → `approved` → `applied` (with `rejected` branch)

**Review fields:** `review_cycle_id`, `employee_id`, `current_salary`, `proposed_salary`, `approved_salary`, `justification`, `status`

### Pay Slips

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pay-slips/me` | Employee | Get own pay slips |
| POST | `/pay-slips` | HR/Admin | Create a pay slip record |

**Slip fields:** `employee_id`, `period_start`, `period_end`, `gross_pay`, `net_pay`, `deductions`, `file_url`

### Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reports/gender-pay-gap` | HR/Admin/Finance | Gender pay gap analysis by pay band |
| GET | `/reports/department-costs` | HR/Admin/Finance | Department cost breakdown |
| GET | `/reports/aggregates` | HR/Admin/Finance/Director | Aggregate compensation statistics |

### Audit Log

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audit` | HR/Admin | Filterable audit log with pagination |

**Query params:** `action`, `employee_id`, `date_from`, `date_to`, `limit` (default 50), `offset` (default 0)

**Response:** `{ data: [...], total, limit, offset }`

### Compensation Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings` | Any authenticated | Get feature toggle settings |
| PUT | `/settings` | Admin | Update feature toggles |

**Settings fields:** `enable_tier_band_linking`, `enable_bonus_schemes`, `enable_responsibility_allowances` (all BOOLEAN, default false)

### Bonus Schemes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/bonus-schemes` | Any authenticated | List bonus schemes |
| POST | `/bonus-schemes` | Admin/HR | Create a bonus scheme |
| PUT | `/bonus-schemes/:id` | Admin/HR | Update a bonus scheme |
| DELETE | `/bonus-schemes/:id` | Admin/HR | Delete a bonus scheme |
| POST | `/bonus-schemes/:id/calculate` | Admin/HR/Finance | Calculate bonuses for eligible employees |

**Scheme fields:** `scheme_name`, `description`, `calculation_type` (percentage/fixed), `calculation_value`, `basis` (base_salary/total_compensation), `frequency`, `tier_level` (optional), `pay_band_id` (optional), `min_service_months`, `is_active`

**Calculate request:** `{ effective_date }` — finds eligible employees by tier/band/service months and creates pending assignments

### Bonus Assignments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/bonus-assignments` | Admin/HR | List all bonus assignments (filterable by `status`, `scheme_id`) |
| PUT | `/bonus-assignments/:id` | Admin/HR | Update assignment status (approve/reject) |
| POST | `/bonus-assignments/:id/apply` | Admin/HR | Apply approved bonus — creates a `benefits` record |

**Assignment status workflow:** `pending` → `approved` → `applied` (with `rejected` branch)

### Responsibility Allowances

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/responsibility-allowances` | Any authenticated | List responsibility allowances |
| POST | `/responsibility-allowances` | Admin/HR | Create an allowance |
| PUT | `/responsibility-allowances/:id` | Admin/HR | Update an allowance |
| DELETE | `/responsibility-allowances/:id` | Admin/HR | Delete an allowance |
| POST | `/responsibility-allowances/:id/assign` | Admin/HR | Assign allowance to employees |

**Allowance fields:** `allowance_name`, `description`, `amount`, `frequency`, `tier_level` (optional), `pay_band_id` (optional), `additional_role_id` (optional), `is_active`

**Assign request:** `{ employee_ids: [1, 2, 3], start_date }` — creates assignments for each employee

### Allowance Assignments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/allowance-assignments` | Admin/HR | List all allowance assignments |
| PUT | `/allowance-assignments/:id` | Admin/HR | Update assignment (e.g., set end_date) |

### Total Compensation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/total-compensation/:employeeId` | Self/Manager/HR/Admin | Full compensation package with annualised totals |

**Response:** `{ employee_id, base_salary, currency, band, bonuses: [...], allowances: [...], benefits: [...], totals: { base_salary, bonuses, allowances, benefits, total_annual } }`

### Audit Middleware

All compensation endpoints are automatically audited via `compensationAudit.js` middleware:
- Sensitive fields (salary, contributions, budgets) are redacted in audit entries
- Client IP is captured (supports X-Forwarded-For)
- Field-level change tracking for updates (old value vs new value)
- Append-only audit log — no updates or deletes permitted

---

## Example Responses

### GET /api/compensation/stats
```json
{
  "total_payroll": 500000,
  "average_salary": 50000,
  "employee_count": 10,
  "active_review_cycles": 1,
  "upcoming_changes": 3,
  "pending_reviews": 5
}
```

### GET /api/compensation/pay-bands
```json
{
  "data": [
    {
      "id": "uuid",
      "band_name": "Senior Developer",
      "grade": 3,
      "min_salary": 45000,
      "mid_salary": 55000,
      "max_salary": 65000,
      "currency": "GBP"
    }
  ]
}
```

### GET /api/compensation/me
```json
{
  "current": {
    "id": "uuid",
    "base_salary": 50000,
    "effective_date": "2026-01-01",
    "band_name": "Senior Developer",
    "min_salary": 45000,
    "mid_salary": 55000,
    "max_salary": 65000
  },
  "history": [...],
  "benefits": [...]
}
```

---

## Internal Opportunities

### Opportunities

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/opportunities` | All employees | List open opportunities |
| GET | `/api/opportunities/all` | Admin, Manager | List all opportunities (any status) |
| GET | `/api/opportunities/:id` | All (open only for non-HR) | Get opportunity detail + user's application |
| POST | `/api/opportunities` | Admin, Manager | Create opportunity (draft) |
| PUT | `/api/opportunities/:id` | Admin, Manager | Update opportunity |
| DELETE | `/api/opportunities/:id` | Admin, Manager | Delete draft opportunity only |
| POST | `/api/opportunities/:id/publish` | Admin, Manager | Publish draft → open |
| POST | `/api/opportunities/:id/close` | Admin, Manager | Close open opportunity. Body: `{ filled: true }` to mark as filled |

### Applications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/opportunities/:id/applications` | Admin, Manager | List applications for opportunity |
| GET | `/api/opportunities/applications/mine` | All employees | List my applications (no HR notes) |
| POST | `/api/opportunities/applications` | All employees | Submit application |
| PUT | `/api/opportunities/applications/:id/status` | Admin, Manager | Update application status + notes |
| PUT | `/api/opportunities/applications/:id/withdraw` | Applicant only | Withdraw own application |

### Create/Update Opportunity Body
```json
{
  "title": "Senior Carer",
  "department": "Care",
  "location": "London",
  "employment_type": "full_time",
  "description": "Role description...",
  "requirements": "Requirements...",
  "salary_range_min": 28000,
  "salary_range_max": 35000,
  "show_salary": true,
  "closes_at": "2026-03-01T23:59:59Z"
}
```

### Submit Application Body
```json
{
  "opportunity_id": 1,
  "cover_letter": "I am interested in this role because..."
}
```

### Update Application Status Body
```json
{
  "status": "shortlisted",
  "notes": "Strong candidate, schedule interview"
}
```

### Status Values
- **Opportunity**: `draft`, `open`, `closed`, `filled`
- **Application**: `submitted`, `reviewing`, `shortlisted`, `interview`, `offered`, `accepted`, `rejected`, `withdrawn`

---

## Goals Endpoints

All goals endpoints require authentication. Base path: `/api/goals`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/goals/stats` | Any | Get own goal stats (+ team stats for Manager/Admin) |
| `GET` | `/api/goals/team` | Manager, Admin | List direct reports' goals |
| `GET` | `/api/goals` | Any | List own goals (optional `?status=active&category=performance`) |
| `GET` | `/api/goals/:id` | Owner, Manager, Admin | Get goal detail with update history |
| `POST` | `/api/goals` | Any | Create goal (managers can set `assigned_to` for reports) |
| `PUT` | `/api/goals/:id` | Owner, Admin | Update goal fields |
| `PUT` | `/api/goals/:id/progress` | Owner, Manager, Admin | Quick progress update with optional comment |
| `POST` | `/api/goals/:id/complete` | Owner, Admin | Mark goal as completed (sets progress=100) |
| `DELETE` | `/api/goals/:id` | Owner, Admin | Cancel goal (soft delete: status → cancelled) |
| `GET` | `/api/goals/:id/updates` | Owner, Manager, Admin | Get update history |
| `POST` | `/api/goals/:id/updates` | Owner, Manager, Admin | Add comment to goal |

### Stats Response
```json
{
  "own": { "total": 5, "active": 3, "completed": 1, "overdue": 1 },
  "team": { "total": 12, "active": 8, "completed": 3, "overdue": 1 }
}
```

### Create/Update Goal Body
```json
{
  "title": "Complete leadership training",
  "description": "Finish all modules by Q2",
  "category": "development",
  "priority": "high",
  "target_date": "2026-06-30",
  "assigned_to": 5
}
```

### Progress Update Body
```json
{
  "progress": 75,
  "comment": "Completed modules 1-3"
}
```

### Goal Values
- **Category**: `performance`, `development`, `project`, `personal`
- **Priority**: `low`, `medium`, `high`
- **Status**: `draft`, `active`, `completed`, `cancelled`
- **Progress**: 0–100 (integer)

---

## Announcements Endpoints

All endpoints require authentication. Base path: `/api/announcements`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/announcements` | Any | Published, non-expired announcements with read status |
| `GET` | `/api/announcements/all` | Admin | All announcements with read counts |
| `GET` | `/api/announcements/unread` | Any | Unread announcements for current user |
| `GET` | `/api/announcements/ticker` | Any | Pinned/urgent published announcements for ticker |
| `GET` | `/api/announcements/:id` | Any | Single announcement (employees see published only) |
| `POST` | `/api/announcements` | Admin | Create announcement |
| `PUT` | `/api/announcements/:id` | Admin | Update announcement |
| `DELETE` | `/api/announcements/:id` | Admin | Delete announcement |
| `POST` | `/api/announcements/:id/publish` | Admin | Publish a draft announcement |
| `POST` | `/api/announcements/:id/archive` | Admin | Archive an announcement |
| `POST` | `/api/announcements/:id/read` | Any | Mark announcement as read (idempotent) |
| `GET` | `/api/announcements/:id/reads` | Admin | Read receipts with employee list |

### Create/Update Announcement Body
```json
{
  "title": "Office closure notice",
  "content": "The office will be closed on Friday.",
  "category": "general",
  "priority": "normal",
  "expires_at": "2026-03-01",
  "pinned": false
}
```

### Read Receipts Response
```json
{
  "employees": [
    { "id": 1, "full_name": "John Smith", "has_read": true, "read_at": "2026-02-01T10:00:00Z" }
  ],
  "summary": { "total": 20, "read": 15, "unread": 5, "percentage": 75 }
}
```

### Announcement Values
- **Category**: `general`, `urgent`, `policy`, `event`, `celebration`
- **Priority**: `low`, `normal`, `high`, `urgent`
- **Status**: `draft`, `published`, `archived`

---

## GDPR Data Export Endpoints

All endpoints require authentication. Base path: `/api/gdpr`

### Employee Self-Service

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/gdpr/my-requests` | Any | List current user's data requests |
| `POST` | `/api/gdpr/export` | Any | Request export of own data (rate-limited: 3/24h) |
| `GET` | `/api/gdpr/download/:id` | Owner or Admin/HR | Download completed export ZIP |

### HR/Admin Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/gdpr/requests` | Admin, HR Manager | List all data requests (filterable by status, type, search) |
| `GET` | `/api/gdpr/requests/:id` | Admin, HR Manager | Request detail with activity log |
| `POST` | `/api/gdpr/requests/:id/process` | Admin | Process (approve) a pending request |
| `POST` | `/api/gdpr/requests/:id/reject` | Admin, HR Manager | Reject a request (reason required) |
| `POST` | `/api/gdpr/deletion-request` | Admin, HR Manager | Create deletion request for an employee |
| `POST` | `/api/gdpr/cleanup-expired` | Admin | Clean up expired export files from disk |

### Export Contents

The ZIP archive contains JSON files organised by category:
- `profile/` — User profile (password hash excluded)
- `personal/` — Emergency contacts, medical info
- `documents/` — Document metadata (not actual files)
- `leave/` — Leave requests, RTW interviews, SSP periods, statutory entitlements
- `compliance/` — RTW checks, DBS checks
- `performance/` — Performance reviews
- `compensation/` — Compensation records, benefits, pay reviews, pay slips
- `goals/` — Goals, goal updates
- `probation/` — Probation periods, probation reviews
- `hr_cases/` — HR cases, PIP objectives, case notes (visible to employee only)
- `offboarding/` — Offboarding workflows, exit interviews
- `opportunities/` — Internal applications
- `activity/` — Announcement reads
- `absence/` — Absence insights, absence summaries
- `manifest.json` — Generation metadata and table list

### Request Values
- **Request Type**: `export`, `deletion`
- **Status**: `pending`, `processing`, `completed`, `rejected`, `expired`
