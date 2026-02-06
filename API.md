# VoidStaffOS — API Documentation

## Authentication

All endpoints require session-based authentication. The user session is established via `/api/auth/login` and stored in a server-side session cookie.

- `req.user` is populated by auth middleware
- `req.session.tenantId` provides multi-tenant isolation
- All DB queries filter by `tenant_id`

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

**Pay Band fields:** `band_name`, `grade`, `min_salary`, `mid_salary`, `max_salary`, `currency`

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
