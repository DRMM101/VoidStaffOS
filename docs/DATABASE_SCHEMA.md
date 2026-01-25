<!--
  VoidStaffOS - Database Schema Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 24/01/2026
  Updated: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS Database Schema

Last Updated: 2026-01-25

## Overview

VoidStaffOS uses PostgreSQL as its database. The schema supports multi-tenant employee management, performance reviews with blind review functionality, leave management, notifications, and comprehensive audit logging.

## Entity Relationship Diagram

```
┌─────────────┐
│   tenants   │ (Multi-tenant root)
└──────┬──────┘
       │
       ├──────────────────────────────────────────────────────────┐
       │                                                          │
       ▼                                                          ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐   ┌─────────────────┐
│   roles     │────<│   users     │>────│   users     │   │  user_sessions  │
│             │     │ (employee)  │     │ (manager)   │   │                 │
└─────────────┘     └──────┬──────┘     └─────────────┘   └─────────────────┘
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
    │audit_logs │ (Enhanced security audit)
    └───────────┘
```

---

## Multi-Tenant Architecture

All data is isolated by `tenant_id`. Every table (except system tables) includes a `tenant_id` foreign key to ensure complete data isolation between organisations.

---

## Tables

### tenants
Root table for multi-tenant support. Each organisation has one tenant record.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique tenant identifier |
| name | VARCHAR(255) | NOT NULL | Organisation name |
| subdomain | VARCHAR(63) | UNIQUE, NOT NULL | Subdomain for tenant |
| domain | VARCHAR(255) | | Custom domain (optional) |
| subscription_tier | VARCHAR(50) | DEFAULT 'standard' | standard, professional, enterprise |
| enabled_modules | JSONB | DEFAULT '["core"]' | List of enabled modules |
| settings | JSONB | DEFAULT '{}' | Tenant-specific settings |
| is_active | BOOLEAN | DEFAULT true | Tenant active status |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Module Options:**
- core: Base employee management
- PolicyOS, LearnOS, AssetOS, FleetOS, SafetyOS, TimeOS, BoardOS
- ExpenseOS, KudosOS, TellMeOS, EngageOS, WellbeingOS, ComplianceOS, FacilitiesOS

---

### roles
Defines user roles and permissions in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique role identifier |
| tenant_id | INTEGER | REFERENCES tenants(id) | Owning tenant |
| role_name | VARCHAR(50) | NOT NULL | Role name |
| permissions_json | JSONB | | Role permissions |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Seed Data:**
- Admin: Full system access
- Manager: Can manage team, create reviews, approve leave
- Employee: Can create self-reflections, request leave
- HR Manager: HR-specific access

**Indexes:**
- `idx_roles_tenant` on tenant_id

---

### users
Core employee/user table with hierarchical management structure.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique user identifier |
| tenant_id | INTEGER | REFERENCES tenants(id), NOT NULL | Owning tenant |
| email | VARCHAR(255) | NOT NULL | Login email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(255) | NOT NULL | Employee's full name |
| employee_number | VARCHAR(50) | | Employee ID (e.g., EMP001) |
| role_id | INTEGER | REFERENCES roles(id) | User's role |
| tier | INTEGER | CHECK (tier >= 1 AND tier <= 5) | Employee tier |
| manager_id | INTEGER | REFERENCES users(id) | Direct line manager |
| manager_contact_email | VARCHAR(255) | | Override email for manager contact |
| manager_contact_phone | VARCHAR(50) | | Manager contact phone |
| employment_status | VARCHAR(20) | DEFAULT 'active' | active, inactive, terminated |
| start_date | DATE | NOT NULL | Employment start date |
| end_date | DATE | | Employment end date |
| annual_leave_entitlement | DECIMAL(4,1) | DEFAULT 28 | Annual leave days entitled |
| created_by | INTEGER | REFERENCES users(id) | User who created this record |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Unique Constraints:**
- `users_email_tenant_unique` on (tenant_id, email)
- `users_employee_number_tenant_unique` on (tenant_id, employee_number)

**Indexes:**
- `idx_users_tenant` on tenant_id
- `idx_users_email` on email
- `idx_users_manager_id` on manager_id

---

### user_sessions
PostgreSQL session storage for secure authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| sid | VARCHAR | PRIMARY KEY | Session identifier |
| sess | JSON | NOT NULL | Session data (userId, tenantId, roles, permissions) |
| expire | TIMESTAMP(6) | NOT NULL | Session expiry time |

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

**Indexes:**
- `idx_session_expire` on expire

---

### reviews
Weekly performance snapshots with blind review support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique review identifier |
| tenant_id | INTEGER | REFERENCES tenants(id), NOT NULL | Owning tenant |
| employee_id | INTEGER | REFERENCES users(id), NOT NULL | Employee being reviewed |
| reviewer_id | INTEGER | REFERENCES users(id), NOT NULL | Person creating the review |
| review_date | DATE | NOT NULL | Week ending date (always Friday) |
| is_self_assessment | BOOLEAN | DEFAULT false | True if employee self-reflection |
| is_committed | BOOLEAN | DEFAULT false | True when finalized |
| committed_at | TIMESTAMP | | When review was committed |
| skip_week | BOOLEAN | DEFAULT false | Skip this week |
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

**Calculated KPIs (PROPRIETARY - computed on read):**
- Velocity = (tasks_completed + work_volume + problem_solving) / 3
- Friction = (velocity + communication) / 2
- Cohesion = (problem_solving + communication + leadership) / 3

**Indexes:**
- `idx_reviews_tenant` on tenant_id
- `idx_reviews_employee_id` on employee_id
- `idx_reviews_employee_date` on (employee_id, review_date)

---

### leave_requests
Employee leave/time-off requests with approval workflow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique request identifier |
| tenant_id | INTEGER | REFERENCES tenants(id), NOT NULL | Owning tenant |
| employee_id | INTEGER | REFERENCES users(id), NOT NULL | Employee requesting leave |
| manager_id | INTEGER | REFERENCES users(id) | Approving manager |
| request_date | DATE | NOT NULL | When request was submitted |
| leave_start_date | DATE | NOT NULL | First day of leave |
| leave_end_date | DATE | NOT NULL | Last day of leave |
| leave_type | leave_type_enum | DEFAULT 'full_day' | Type of leave |
| total_days | DECIMAL(4,1) | NOT NULL | Total leave days |
| status | leave_status_enum | DEFAULT 'pending' | Request status |
| notice_days | INTEGER | NOT NULL | Days notice given |
| required_notice_days | INTEGER | NOT NULL | Days notice required |
| meets_notice_requirement | BOOLEAN | DEFAULT false | Notice requirement met |
| notes | TEXT | | Employee notes |
| rejection_reason | TEXT | | Manager's rejection reason |
| approved_by | INTEGER | REFERENCES users(id) | Who approved/rejected |
| approved_at | TIMESTAMP | | When approved/rejected |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_leave_requests_tenant` on tenant_id
- `idx_leave_employee_id` on employee_id
- `idx_leave_status` on status

---

### notifications
User notifications for system events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique notification identifier |
| tenant_id | INTEGER | REFERENCES tenants(id), NOT NULL | Owning tenant |
| user_id | INTEGER | REFERENCES users(id) ON DELETE CASCADE | Recipient user |
| type | notification_type_enum | NOT NULL | Type of notification |
| title | VARCHAR(255) | NOT NULL | Notification title |
| message | TEXT | | Detailed message |
| related_id | INTEGER | | ID of related entity |
| related_type | VARCHAR(50) | | Type of related entity |
| is_read | BOOLEAN | DEFAULT false | Read status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| read_at | TIMESTAMP | | When marked as read |

**Indexes:**
- `idx_notifications_tenant` on tenant_id
- `idx_notifications_user_id` on user_id
- `idx_notifications_user_unread` on (user_id, is_read)

---

### audit_logs
Enhanced security audit trail for all sensitive operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique log entry identifier |
| tenant_id | INTEGER | REFERENCES tenants(id) | Owning tenant (NULL for system) |
| user_id | INTEGER | REFERENCES users(id) | User who performed action |
| action | VARCHAR(50) | NOT NULL | Action type (see below) |
| resource_type | VARCHAR(100) | | Affected entity type |
| resource_id | INTEGER | | ID of affected record |
| details | JSONB | | Additional context |
| ip_address | VARCHAR(45) | | Client IP address |
| user_agent | TEXT | | Client user agent |
| created_at | TIMESTAMP | DEFAULT NOW() | When action occurred |

**Action Types:**
- **Authentication:** LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET_REQUEST
- **Authorization:** ROLE_CHANGE, PERMISSION_CHANGE
- **Data Access:** DATA_EXPORT, GDPR_DATA_REQUEST, GDPR_DELETION_REQUEST
- **HR Actions:** EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_TERMINATED, DISCIPLINARY_CREATED, GRIEVANCE_SUBMITTED, PIP_CREATED
- **Sensitive Ops:** SALARY_VIEWED, SALARY_CHANGED, DOCUMENT_ACCESSED
- **Records:** RECORD_CREATE, RECORD_UPDATE, RECORD_DELETE
- **Admin:** TENANT_SETTINGS_CHANGED, ADMIN_ACTION

**Indexes:**
- `idx_audit_logs_tenant` on tenant_id
- `idx_audit_logs_user` on user_id
- `idx_audit_logs_action` on action
- `idx_audit_logs_created` on created_at DESC
- `idx_audit_logs_resource` on (resource_type, resource_id)

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
  'manager_snapshot_committed', 'snapshot_overdue', 'self_reflection_overdue',
  'leave_request_pending', 'leave_request_approved', 'leave_request_rejected',
  'employee_transferred', 'new_direct_report', 'kpi_revealed'
);
```

---

## Migration Files

| Migration | Description |
|-----------|-------------|
| 001_initial_schema.sql | Base tables (roles, users) |
| 002_reviews.sql | Reviews table |
| 003_audit_log.sql | Basic audit logging |
| 004_employee_number.sql | Employee number field |
| 005_self_assessment.sql | Self-assessment support |
| 006_review_commit.sql | Commit functionality |
| 007_employee_tiers.sql | Tier system |
| 008_leave_system.sql | Leave management |
| 009_notifications.sql | Notifications |
| 010-015 | Recruitment, onboarding, feedback modules |
| **016_multi_tenant_foundation.sql** | Tenants table, tenant_id on all tables |
| **017_audit_log_enhanced.sql** | Enhanced audit_logs table |

---

## Security Considerations

1. **Tenant Isolation**: All queries MUST include `tenant_id` filter
2. **Password Storage**: Bcrypt with 10 rounds
3. **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
4. **Audit Trail**: All sensitive operations logged to audit_logs
5. **Soft Deletes**: Use `deleted_at` timestamp where applicable
