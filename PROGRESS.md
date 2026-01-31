# VoidStaffOS - Development Progress

**Last Updated:** 2026-01-31 16:00 UTC

## Current State

All core modules are **COMPLETE** and production-ready.

> ✅ **Core Employee Management** - Complete
> ✅ **Performance Reviews (Blind KPIs)** - Complete
> ✅ **Leave Management** - Complete
> ✅ **360 Feedback** - Complete
> ✅ **Policy Management** - Complete
> ✅ **Document Storage** - Complete
> ✅ **Compliance (RTW/DBS)** - Complete
> ✅ **Emergency Contacts** - Complete
> ✅ **Probation Management** - Complete
> ✅ **Sick & Statutory Leave** - Complete
> ✅ **Urgent Notifications** - Complete

---

## Recent Updates (2026-01-31)

### Chunk 7: Sick & Statutory Leave - COMPLETE

Full sick leave and statutory leave management with Return to Work interviews.

**Features Implemented:**
- Employee self-service sick leave reporting
- Statutory leave requests (maternity, paternity, adoption, etc.)
- 13 absence categories with configurable settings
- Return to Work (RTW) interview workflow
- Follow-up interview scheduling and tracking
- Fit note requirement tracking (>7 days)
- SSP (Statutory Sick Pay) eligibility tracking

**Urgent Notifications:**
- Same-day sick leave marked as urgent with 🚨 prefix
- Short-notice absence requests (within 3 days) marked urgent
- Urgent notifications display with red styling
- Click-to-navigate from notification to absence record
- Highlighted row when navigating to specific absence

**UI Polish:**
- Rounded corners (12px) on all panels
- Light blue background (#e3f2fd) for Absence Dashboard
- Fixed text contrast throughout (changed #666 to #424242/#111)
- Urgent notification filter button

### Backend Endpoints Added

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sick-leave/categories` | GET | List 13 absence categories |
| `/api/sick-leave/report` | POST | Employee reports sick |
| `/api/sick-leave/:id` | PUT | Update/extend sick leave |
| `/api/sick-leave/:id/fit-note` | POST | Attach fit note document |
| `/api/sick-leave/statutory` | POST | Request statutory leave |
| `/api/sick-leave/rtw/pending` | GET | Pending RTW interviews |
| `/api/sick-leave/rtw/follow-ups` | GET | Pending follow-up interviews |
| `/api/sick-leave/rtw` | POST | Create RTW interview |
| `/api/sick-leave/rtw/:id` | GET | Get RTW by leave request |
| `/api/sick-leave/rtw/:id/complete` | PUT | Complete RTW interview |
| `/api/sick-leave/ssp/:employeeId` | GET | Get SSP status |

### Database Migrations

- **Migration 029**: Sick & statutory leave tables
- **Migration 030**: Urgent notifications (`is_urgent` column)

### Frontend Components

- `AbsenceDashboard.jsx` - Main dashboard with 5 tabs
- `SickLeaveReport.jsx` - Employee sick reporting form
- `AbsenceRequest.jsx` - Statutory leave request form
- `ReturnToWorkForm.jsx` - 4-step RTW interview wizard
- Updated `Notifications.jsx` - Urgent styling, click-to-navigate
- Updated `NotificationBell.jsx` - Urgent notifications at top

---

## Module Status

| Module | Status | Migrations | Description |
|--------|--------|------------|-------------|
| Core | ✅ Complete | 001-005 | Users, roles, tenants |
| Reviews | ✅ Complete | 006-010 | Blind performance reviews |
| Leave | ✅ Complete | 011-015 | Annual leave management |
| Feedback | ✅ Complete | 016-020 | 360 quarterly feedback |
| Policies | ✅ Complete | 021-023 | Policy acknowledgment |
| Documents | ✅ Complete | 024 | Secure document storage |
| Compliance | ✅ Complete | 025 | RTW/DBS verification |
| Emergency | ✅ Complete | 026 | Emergency contacts |
| Probation | ✅ Complete | 027-028 | Probation tracking |
| Sick/Statutory | ✅ Complete | 029-030 | Sick leave & RTW |

---

## Test Accounts

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| test@test.com | (existing) | Employee | User ID 1, reports to manager@test.com |
| manager@test.com | password123 | Manager | User ID 3, manages test@test.com |
| manager2@test.com | password123 | Manager | User ID 9, manages manager@test.com |

---

## Known Issues Fixed

1. ✅ Duplicate RTW interview error - Added ON CONFLICT clause
2. ✅ Text contrast issues - Fixed pale grey text throughout
3. ✅ Notification tenant_id null - Using imported createNotification
4. ✅ Route ordering for /rtw/follow-ups - Fixed parameter parsing
5. ✅ Missing notification types - Added to enum

---

## Future Enhancements

- Fit note document upload UI (currently accepts document_id)
- SSP calculation refinement (earnings check)
- Maternity/adoption leave notice period validation
- Email notifications for urgent absences
- Manager dashboard absence calendar view

---

## Quick Start

```bash
# Backend
cd backend
npm install
node src/server.js
# Runs on http://localhost:3001

# Frontend
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173

# Login
# manager@test.com / password123
```

---

## Git Commit History (Recent)

- Urgent notifications with click-to-navigate
- Follow-ups tab for RTW interviews
- UI polish (rounded corners, contrast fixes)
- Sick & Statutory Leave module complete
- Probation management complete
- Emergency contacts complete
