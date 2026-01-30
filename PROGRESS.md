# VoidStaffOS - Chunk 7: Sick & Statutory Leave

**Last Updated:** 2026-01-30 22:27 UTC

## Current State

Chunk 7 (Sick & Statutory Leave) is **mostly complete** and functional.

> **⚠️ IMPORTANT: Frontend has NOT been tested!**
> All 4 frontend components were created but have not been run or tested in the browser.
> This is the first priority for the next session.

---

## What's Working

### Backend API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/sick-leave/categories` | GET | ✅ Working | Returns 13 absence categories |
| `/api/sick-leave/report` | POST | ✅ Working | Employee self-service sick reporting |
| `/api/sick-leave/:id` | PUT | ✅ Created | Update/extend sick leave (untested) |
| `/api/sick-leave/:id/fit-note` | POST | ✅ Created | Upload fit note (untested) |
| `/api/sick-leave/statutory` | POST | ✅ Working | Request statutory leave (paternity tested) |
| `/api/sick-leave/rtw/pending` | GET | ✅ Working | Get pending RTW interviews |
| `/api/sick-leave/rtw` | POST | ✅ Working | Create RTW interview |
| `/api/sick-leave/rtw/:leaveRequestId` | GET | ✅ Working | Get RTW by leave request |
| `/api/sick-leave/rtw/:id/complete` | PUT | ✅ Working | Complete RTW interview |
| `/api/sick-leave/ssp/:employeeId` | GET | ✅ Created | Get SSP status (untested) |

### Database

- **Migration 029** applied successfully
- New tables created:
  - `return_to_work_interviews`
  - `ssp_periods`
  - `statutory_leave_entitlements`
  - `absence_category_settings` (populated with 13 categories)
- `leave_requests` table extended with sick/statutory columns
- `notifications` table: Added `data` JSONB column
- New notification types added to enum:
  - `sick_leave_reported`
  - `rtw_follow_up`
  - `rtw_required`

### Notifications

- ✅ Manager notified when employee reports sick
- ✅ Manager notified for statutory leave requests (pending approval)
- ✅ Follow-up notification created when RTW requires follow-up

### Frontend Components (Created, NOT TESTED)

**⚠️ These components have been written but NEVER run in a browser:**

- `SickLeaveReport.jsx` - Employee sick reporting form
- `ReturnToWorkForm.jsx` - 4-step RTW interview form
- `AbsenceRequest.jsx` - Statutory leave request form
- `AbsenceDashboard.jsx` - Main dashboard with tabs

May contain bugs, typos, or API integration issues. Must test before considering complete.

---

## What Needs Testing

### Backend

1. **PUT /api/sick-leave/:id** - Update/extend ongoing sick leave
2. **POST /api/sick-leave/:id/fit-note** - Fit note upload
3. **GET /api/sick-leave/ssp/:employeeId** - SSP status calculation
4. **Ongoing sick leave flow** - Report with `is_ongoing: true`, then close later

### Frontend

All frontend components need manual testing:
- Navigate to Absence Dashboard
- Test sick leave reporting form
- Test statutory leave request form
- Test RTW interview completion (as manager)

---

## Test Accounts

| Email | Role | Password | Notes |
|-------|------|----------|-------|
| test@test.com | Employee | (existing) | User ID 1, Manager ID 3 |
| manager@test.com | Manager | password123 | User ID 3, manages User 1 |

---

## Files Modified/Created

### Backend
- `backend/migrations/029_sick_statutory_leave.sql` - Database schema
- `backend/src/controllers/sickLeaveController.js` - Business logic
- `backend/src/routes/sickLeave.js` - API routes
- `backend/src/middleware/validation.js` - Added validators
- `backend/src/server.js` - Mounted sick-leave routes

### Frontend
- `frontend/src/components/SickLeaveReport.jsx`
- `frontend/src/components/ReturnToWorkForm.jsx`
- `frontend/src/components/AbsenceRequest.jsx`
- `frontend/src/components/AbsenceDashboard.jsx`
- `frontend/src/components/Navigation.jsx` - Added Absence nav button
- `frontend/src/App.jsx` - Added AbsenceDashboard route

### Documentation
- `docs/API_REFERENCE.md` - Updated with sick leave endpoints
- `README.md` - Added Sick & Statutory module to list

---

## Known Issues Fixed

1. **Notification tenant_id null** - Fixed by using imported `createNotification` from notificationController
2. **Notification data column missing** - Added `data` JSONB column to notifications table
3. **Missing notification types** - Added 3 new types to `notification_type_enum`

---

## Next Steps

1. **Test frontend** - Start frontend (`npm run dev`), navigate to Absence Dashboard
2. **Test remaining endpoints** - Fit note upload, SSP status, ongoing sick leave
3. **Test edge cases**:
   - Sick leave > 7 days (fit note required)
   - Multiple sick periods (SSP linking)
   - Different statutory leave types (maternity, adoption, etc.)
4. **Integration testing** - Full flow from sick report → RTW completion

---

## Quick Resume Commands

```bash
# Start backend
cd backend && node src/server.js

# Start frontend
cd frontend && npm run dev

# Login as employee
curl -X POST -c /tmp/cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"..."}' \
  http://localhost:3001/api/auth/login

# Login as manager
curl -X POST -c /tmp/mgr_cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"manager@test.com","password":"password123"}' \
  http://localhost:3001/api/auth/login
```
