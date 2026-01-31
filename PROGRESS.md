# VoidStaffOS - Development Progress

**Last Updated:** 2026-01-31 18:00 UTC

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
> ✅ **Absence Insights** - Complete

---

## Recent Updates (2026-01-31)

### Chunk 8: Absence Insights - COMPLETE

HR-focused absence pattern detection and reporting system for wellbeing review.

**Features Implemented:**
- Pattern detection engine with 6 pattern types:
  - **Frequency**: High absence count in rolling period
  - **Monday/Friday**: Weekend-adjacent absence patterns
  - **Post-Holiday**: Absences immediately after annual leave
  - **Duration Trend**: Increasing average absence duration
  - **Short Notice**: Frequent same-day absence reporting
  - **Recurring Reason**: Same reason cited repeatedly
- Bradford Factor calculation (S² × D formula)
- 12-month rolling employee absence summaries
- HR dashboard with pattern breakdown
- Insight review workflow (new → reviewed → actioned/dismissed)
- Follow-up date scheduling for actioned insights
- Full audit trail of insight reviews
- Auto-detection triggered when sick leave is recorded

**Backend Endpoints Added:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/absence-insights` | GET | List insights with filtering |
| `/api/absence-insights/dashboard` | GET | Dashboard summary stats |
| `/api/absence-insights/:id` | GET | Full insight details |
| `/api/absence-insights/:id/review` | PUT | Mark as reviewed |
| `/api/absence-insights/:id/action` | PUT | Record action taken |
| `/api/absence-insights/:id/dismiss` | PUT | Dismiss insight |
| `/api/absence-insights/employee/:id` | GET | Employee's insights |
| `/api/absence-insights/run-detection/:id` | POST | Manual detection |
| `/api/absence-insights/follow-ups/pending` | GET | Pending follow-ups |

**Database Migration:**
- **Migration 031**: absence_insights, absence_summaries, insight_review_history tables

**Frontend Components:**
- `InsightsDashboard.jsx` - Main HR dashboard with stats and filtering
- `InsightCard.jsx` - Individual insight display card
- `InsightReviewModal.jsx` - Full insight review modal with actions

---

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
| Insights | ✅ Complete | 031 | Absence pattern detection |

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

- **UX Pass Required**: Full review of font colours, contrast, layout and styling across all modules
- Fit note document upload UI (currently accepts document_id)
- SSP calculation refinement (earnings check)
- Maternity/adoption leave notice period validation
- Email notifications for urgent absences
- Manager dashboard absence calendar view
- Seasonal pattern detection (same time each year)

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

- Absence Insights module (pattern detection, Bradford Factor)
- Urgent notifications with click-to-navigate
- Follow-ups tab for RTW interviews
- UI polish (rounded corners, contrast fixes)
- Sick & Statutory Leave module complete
- Probation management complete
- Emergency contacts complete
