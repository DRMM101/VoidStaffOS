# VoidStaffOS - Development Progress

**Last Updated:** 2026-01-31 23:30 UTC

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
> ✅ **Offboarding** - Complete
> ✅ **HR Cases (PIP/Disciplinary/Grievance)** - Complete

---

## Recent Updates (2026-01-31)

### Chunk 10: HR Cases (PIP/Disciplinary/Grievance) - COMPLETE

ACAS-compliant HR case management for Performance Improvement Plans, Disciplinary procedures, and Grievances with full audit trails.

**Features Implemented:**
- Three case types: PIP, Disciplinary, Grievance
- Auto-generated case references (PIP-2026-001, DISC-2026-001, GRIEV-2026-001)
- Case status workflow: draft → open → investigation → hearing_scheduled → awaiting_decision → appeal → closed
- **PIP**: SMART objectives with progress tracking (pending, on_track, at_risk, met, not_met)
- **Disciplinary**: ACAS-compliant workflow with investigation, hearing, and decision stages
- **Grievance**: Confidential employee self-service submission
- Meeting scheduler with companion rights (union rep, colleague)
- Witness statement capture
- Full audit trail via case notes (with visibility controls)
- Case timeline view
- ACAS guidance prompts at each stage
- Legal hold flag to prevent deletion
- Confidential flag for restricted access

**Outcomes:**
- PIP: passed, extended, failed, cancelled
- Disciplinary: no_action, verbal_warning, written_warning, final_warning, dismissal
- Grievance: upheld, partially_upheld, not_upheld, withdrawn

**Backend Endpoints Added:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hr-cases` | GET | List cases with filtering |
| `/api/hr-cases` | POST | Create new case |
| `/api/hr-cases/stats` | GET | Dashboard statistics |
| `/api/hr-cases/my-cases` | GET | Cases for current user's team |
| `/api/hr-cases/guidance/:type/:stage` | GET | ACAS guidance text |
| `/api/hr-cases/:id` | GET | Full case details |
| `/api/hr-cases/:id` | PUT | Update case |
| `/api/hr-cases/:id` | DELETE | Delete draft case only |
| `/api/hr-cases/:id/open` | POST | Open case from draft |
| `/api/hr-cases/:id/status` | POST | Update case status |
| `/api/hr-cases/:id/close` | POST | Close case with outcome |
| `/api/hr-cases/:id/appeal` | POST | Record appeal request |
| `/api/hr-cases/:id/objectives` | GET | Get PIP objectives |
| `/api/hr-cases/:id/objectives` | POST | Add PIP objective |
| `/api/hr-cases/:id/objectives/:objId` | PUT | Update/review objective |
| `/api/hr-cases/:id/objectives/:objId` | DELETE | Remove objective |
| `/api/hr-cases/:id/milestones` | GET | Get case milestones |
| `/api/hr-cases/:id/milestones` | POST | Add milestone |
| `/api/hr-cases/:id/milestones/:mId` | PUT | Update milestone |
| `/api/hr-cases/:id/meetings` | GET | Get case meetings |
| `/api/hr-cases/:id/meetings` | POST | Schedule meeting |
| `/api/hr-cases/:id/meetings/:mId` | PUT | Update meeting |
| `/api/hr-cases/:id/notes` | GET | Get case notes |
| `/api/hr-cases/:id/notes` | POST | Add case note |
| `/api/hr-cases/:id/witnesses` | GET | Get witnesses |
| `/api/hr-cases/:id/witnesses` | POST | Add witness |
| `/api/hr-cases/:id/witnesses/:wId` | PUT | Update witness statement |
| `/api/hr-cases/grievance/submit` | POST | Employee submits grievance |
| `/api/hr-cases/grievance/my-grievances` | GET | Employee views own grievances |

**Database Migration:**
- **Migration 033**: hr_cases, pip_objectives, hr_case_milestones, hr_case_meetings, hr_case_notes, hr_case_witnesses tables
- 5 enums: hr_case_type, hr_case_status, pip_outcome, disciplinary_outcome, grievance_outcome
- Auto-generated case_reference via trigger
- 6 notification types: hr_case_opened, hr_case_meeting_scheduled, hr_case_outcome_recorded, hr_case_appeal_submitted, pip_objective_due, grievance_submitted

**Frontend Components:**
- `HRCasesDashboard.jsx` - Main dashboard with stats, filters, case list
- `CreateCaseModal.jsx` - Form to create new PIP/Disciplinary/Grievance case
- `HRCaseDetail.jsx` - Full case view with tabs: overview, objectives (PIP), meetings, notes, witnesses, timeline
- `GrievanceSubmitForm.jsx` - Employee self-service grievance submission

**Access Control:**
- HR and Admin: Full access to all cases
- Managers: Access to their team's cases
- Employees: Can only submit and view own grievances (limited view)

---

### Chunk 9: Offboarding - COMPLETE

Structured offboarding workflow with compliance tracking, knowledge transfer, and asset recovery.

**Features Implemented:**
- 7 termination types: resignation, termination, redundancy, retirement, end_of_contract, tupe_transfer, death_in_service
- Default checklist with 13 compliance items auto-created on initiation
- Exit interview scheduling and feedback capture (5-star rating, open feedback)
- Knowledge transfer/handover tracking with priorities (high/medium/low)
- Workflow status tracking (pending → in_progress → completed/cancelled)
- Progress tracking with checklist completion percentage
- Days-until-last-day countdown with urgency highlighting (orange ≤7 days, red if past)
- Stats dashboard (pending, in progress, leaving this week, completed this month)
- **Deadline notifications**: Automatic reminders at 2 weeks, 1 week, 2 days, 1 day, and last day
- Notifications marked urgent at 2 days or less

**Backend Endpoints Added:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/offboarding` | GET | List workflows with status filtering |
| `/api/offboarding` | POST | Initiate new offboarding |
| `/api/offboarding/stats` | GET | Dashboard statistics |
| `/api/offboarding/upcoming` | GET | Employees leaving in next N days |
| `/api/offboarding/check-deadlines` | POST | Create deadline notifications (run daily) |
| `/api/offboarding/my-tasks/pending` | GET | User's assigned checklist/handover tasks |
| `/api/offboarding/:id` | GET | Full workflow details |
| `/api/offboarding/:id` | PUT | Update workflow status |
| `/api/offboarding/:id/complete` | POST | Mark workflow complete, update employee status |
| `/api/offboarding/:id/checklist` | GET | Get checklist items |
| `/api/offboarding/:id/checklist` | POST | Add custom checklist item |
| `/api/offboarding/:id/checklist/:itemId` | PUT | Toggle/update checklist item |
| `/api/offboarding/:id/exit-interview` | GET | Get exit interview |
| `/api/offboarding/:id/exit-interview` | POST | Create exit interview |
| `/api/offboarding/:id/exit-interview` | PUT | Update/complete exit interview |
| `/api/offboarding/:id/handovers` | GET | List handover items |
| `/api/offboarding/:id/handovers` | POST | Add handover item |
| `/api/offboarding/:id/handovers/:handoverId` | PUT | Update handover status |

**Database Migration:**
- **Migration 032**: offboarding_workflows, offboarding_checklist_items, exit_interviews, offboarding_handovers tables
- 3 enums: termination_type, offboarding_status, checklist_item_type
- 6 notification types: offboarding_initiated, offboarding_task_assigned, exit_interview_scheduled, handover_assigned, offboarding_completed, offboarding_reminder

**Frontend Components:**
- `OffboardingDashboard.jsx` - Main dashboard with stats cards, active/completed/cancelled tabs
- `InitiateOffboardingModal.jsx` - Form to start offboarding (employee, type, dates, reason)
- `OffboardingDetail.jsx` - Full workflow view with 4 tabs: checklist, exit interview, handovers, details

**Default Checklist Items (13):**
1. Return laptop/computer (IT)
2. Return mobile phone (IT)
3. Revoke system access (IT)
4. Disable email account (IT)
5. Collect ID badge (HR)
6. Return office keys (Manager)
7. Complete handover documentation (Employee)
8. Conduct exit interview (HR)
9. Process final pay (Payroll)
10. Issue P45 (Payroll)
11. Flag records for GDPR retention (HR)
12. Manager sign-off (Manager)
13. HR sign-off (HR)

---

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
| Offboarding | ✅ Complete | 032 | Exit workflow & compliance |
| HR Cases | ✅ Complete | 033 | PIP, Disciplinary, Grievance |

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
6. ✅ Offboarding route ordering - Moved /stats, /upcoming before /:id
7. ✅ Offboarding status filter - Fixed array handling for multiple status values
8. ✅ Date picker visibility - Added colorScheme: 'light' for calendar popups
9. ✅ apiFetch response handling - Added .json() parsing in offboarding components

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

- Fix offboarding route ordering and add missing stats endpoint
- Fix offboarding modal and add deadline notifications
- Offboarding module (workflow, checklist, exit interviews, handovers)
- Absence Insights module (pattern detection, Bradford Factor)
- Urgent notifications with click-to-navigate
- Follow-ups tab for RTW interviews
- UI polish (rounded corners, contrast fixes)
- Sick & Statutory Leave module complete
- Probation management complete
- Emergency contacts complete
