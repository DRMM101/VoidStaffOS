# VoidStaffOS Database Schema

Last Updated: 2024-01-24

## Overview

VoidStaffOS uses PostgreSQL as its database. The schema supports employee management, performance reviews with blind review functionality, leave management, and notifications.

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   roles     │────<│   users     │>────│   users     │
│             │     │ (employee)  │     │ (manager)   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────────┐
    │  reviews  │   │  leave_   │   │ notifications │
    │           │   │  requests │   │               │
    └───────────┘   └───────────┘   └───────────────┘
          │
          ▼
    ┌───────────┐
    │ audit_log │
    └───────────┘
```

## Tables

### roles
Defines user roles and permissions in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique role identifier |
| role_name | VARCHAR(50) | UNIQUE, NOT NULL | Role name (Admin, Manager, Employee, Compliance Officer) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Seed Data:**
- Admin: Full system access
- Manager: Can manage team, create reviews, approve leave
- Employee: Can create self-reflections, request leave
- Compliance Officer: Read-only access to all data

---

### users
Core employee/user table with hierarchical management structure.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(255) | NOT NULL | Employee's full name |
| employee_number | VARCHAR(50) | UNIQUE | Employee ID (e.g., EMP001) |
| role_id | INTEGER | REFERENCES roles(id) | User's role |
| tier | INTEGER | CHECK (tier >= 1 AND tier <= 5) | Employee tier (1=Executive, 5=Entry, NULL=Admin) |
| manager_id | INTEGER | REFERENCES users(id) | Direct line manager |
| manager_contact_email | VARCHAR(255) | | Override email for manager contact |
| manager_contact_phone | VARCHAR(50) | | Manager contact phone |
| employment_status | VARCHAR(20) | DEFAULT 'active' | active, inactive, terminated |
| start_date | DATE | NOT NULL | Employment start date |
| end_date | DATE | | Employment end date (if terminated) |
| annual_leave_entitlement | DECIMAL(4,1) | DEFAULT 28 | Annual leave days entitled |
| created_by | INTEGER | REFERENCES users(id) | User who created this record |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Tier System:**
- Tier 1: Executive Level (gold badge)
- Tier 2: Senior Level (green badge)
- Tier 3: Mid Level (blue badge)
- Tier 4: Junior Level (orange badge)
- Tier 5: Entry Level (gray badge)
- NULL: Administrator (red badge, outside tier hierarchy)

**Indexes:**
- `idx_users_email` on email
- `idx_users_manager_id` on manager_id
- `idx_users_tier` on tier

---

### reviews
Weekly performance snapshots with blind review support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique review identifier |
| employee_id | INTEGER | REFERENCES users(id), NOT NULL | Employee being reviewed |
| reviewer_id | INTEGER | REFERENCES users(id), NOT NULL | Person creating the review |
| review_date | DATE | NOT NULL | Week ending date (always Friday) |
| is_self_assessment | BOOLEAN | DEFAULT false | True if employee self-reflection |
| is_committed | BOOLEAN | DEFAULT false | True when finalized |
| committed_at | TIMESTAMP | | When review was committed |
| skip_week | BOOLEAN | DEFAULT false | Skip this week (e.g., on leave) |
| skip_reason | VARCHAR(255) | | Reason for skipping |
| goals | TEXT | | Goals/objectives text |
| achievements | TEXT | | Achievements this week |
| areas_for_improvement | TEXT | | Areas to improve |
| tasks_completed | DECIMAL(3,1) | CHECK (1-10) | Task completion rating |
| work_volume | DECIMAL(3,1) | CHECK (1-10) | Work volume rating |
| problem_solving | DECIMAL(3,1) | CHECK (1-10) | Problem solving rating |
| communication | DECIMAL(3,1) | CHECK (1-10) | Communication rating |
| leadership | DECIMAL(3,1) | CHECK (1-10) | Leadership rating |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Calculated KPIs (not stored, computed on read):**
- Velocity = (tasks_completed + work_volume + problem_solving) / 3
- Friction = (velocity + communication) / 2
- Cohesion = (problem_solving + communication + leadership) / 3

**Traffic Light Thresholds:**
- Green: >= 6.5
- Amber: >= 5.0 and < 6.5
- Red: < 5.0

**Blind Review Logic:**
- Employee and manager both create reviews for the same week
- Neither can see the other's ratings until both commit
- After both commit, KPIs are revealed for comparison

**Indexes:**
- `idx_reviews_employee_id` on employee_id
- `idx_reviews_review_date` on review_date
- `idx_reviews_employee_date` on (employee_id, review_date)

---

### leave_requests
Employee leave/time-off requests with approval workflow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique request identifier |
| employee_id | INTEGER | REFERENCES users(id), NOT NULL | Employee requesting leave |
| manager_id | INTEGER | REFERENCES users(id) | Approving manager |
| request_date | DATE | NOT NULL | When request was submitted |
| leave_start_date | DATE | NOT NULL | First day of leave |
| leave_end_date | DATE | NOT NULL | Last day of leave |
| leave_type | leave_type_enum | DEFAULT 'full_day' | full_day, half_day_am, half_day_pm |
| total_days | DECIMAL(4,1) | NOT NULL | Total leave days (0.5 for half days) |
| status | leave_status_enum | DEFAULT 'pending' | pending, approved, rejected, cancelled |
| notice_days | INTEGER | NOT NULL | Days notice given |
| required_notice_days | INTEGER | NOT NULL | Days notice required by policy |
| meets_notice_requirement | BOOLEAN | DEFAULT false | True if notice requirement met |
| notes | TEXT | | Employee notes |
| rejection_reason | TEXT | | Manager's rejection reason |
| approved_by | INTEGER | REFERENCES users(id) | Who approved/rejected |
| approved_at | TIMESTAMP | | When approved/rejected |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Notice Policy:**
- 1-4 days leave: 2x notice required (e.g., 3 days leave needs 6 days notice)
- 5+ days leave: 30 days notice required

**Indexes:**
- `idx_leave_employee_id` on employee_id
- `idx_leave_status` on status
- `idx_leave_dates` on (leave_start_date, leave_end_date)

---

### notifications
User notifications for system events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique notification identifier |
| user_id | INTEGER | REFERENCES users(id) ON DELETE CASCADE | Recipient user |
| type | notification_type_enum | NOT NULL | Type of notification |
| title | VARCHAR(255) | NOT NULL | Notification title |
| message | TEXT | | Detailed message |
| related_id | INTEGER | | ID of related entity |
| related_type | VARCHAR(50) | | Type of related entity (review, leave_request, user) |
| is_read | BOOLEAN | DEFAULT false | Read status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| read_at | TIMESTAMP | | When marked as read |

**Notification Types:**
- `manager_snapshot_committed`: Manager committed weekly review
- `snapshot_overdue`: Team member's snapshot is overdue
- `self_reflection_overdue`: Employee's self-reflection is overdue
- `leave_request_pending`: New leave request for manager
- `leave_request_approved`: Leave request approved
- `leave_request_rejected`: Leave request rejected
- `employee_transferred`: Employee transferred to new manager
- `new_direct_report`: New direct report assigned
- `kpi_revealed`: Both reviews committed, KPIs visible

**Indexes:**
- `idx_notifications_user_id` on user_id
- `idx_notifications_user_unread` on (user_id, is_read) WHERE is_read = false
- `idx_notifications_created_at` on created_at DESC

---

### audit_log
Audit trail for sensitive operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique log entry identifier |
| user_id | INTEGER | REFERENCES users(id) | User who performed action |
| action | VARCHAR(50) | NOT NULL | Action type (INSERT, UPDATE, DELETE, TRANSFER) |
| table_name | VARCHAR(100) | NOT NULL | Affected table |
| record_id | INTEGER | | ID of affected record |
| old_value_json | JSONB | | Previous values |
| new_value_json | JSONB | | New values |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When action occurred |

**Audited Operations:**
- Manager assignments
- Employee transfers
- Tier changes
- Leave approvals/rejections
- Review commits/uncommits

---

## Enums

### leave_type_enum
```sql
CREATE TYPE leave_type_enum AS ENUM ('full_day', 'half_day_am', 'half_day_pm');
```

### leave_status_enum
```sql
CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
```

### notification_type_enum
```sql
CREATE TYPE notification_type_enum AS ENUM (
  'manager_snapshot_committed',
  'snapshot_overdue',
  'self_reflection_overdue',
  'leave_request_pending',
  'leave_request_approved',
  'leave_request_rejected',
  'employee_transferred',
  'new_direct_report',
  'kpi_revealed'
);
```

---

## Key Relationships

1. **User Hierarchy**: `users.manager_id` → `users.id` (self-referencing)
2. **Role Assignment**: `users.role_id` → `roles.id`
3. **Reviews**: `reviews.employee_id` → `users.id`, `reviews.reviewer_id` → `users.id`
4. **Leave Requests**: `leave_requests.employee_id` → `users.id`, `leave_requests.manager_id` → `users.id`
5. **Notifications**: `notifications.user_id` → `users.id` (CASCADE DELETE)

---

## Migration Files

| Migration | Description |
|-----------|-------------|
| 001_initial_schema.sql | Base tables (roles, users) |
| 002_reviews.sql | Reviews table |
| 003_audit_log.sql | Audit logging |
| 004_employee_number.sql | Employee number field |
| 005_self_assessment.sql | Self-assessment support |
| 006_review_commit.sql | Commit functionality |
| 007_employee_tiers.sql | Tier system |
| 008_leave_system.sql | Leave management |
| 009_notifications.sql | Notifications |
