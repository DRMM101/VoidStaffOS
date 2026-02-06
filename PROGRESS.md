# VoidStaffOS - Development Progress

**Last Updated:** 2026-02-06 17:00 UTC

## Current State

All core modules are **COMPLETE** and production-ready. Theme migration to HeadofficeOS neutral design system complete.

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
> ✅ **HR Cases (PIP/Disciplinary/Grievance)** - Complete (debugged, ready for browser testing)
> ✅ **HeadofficeOS Neutral Theme Migration** - Complete
> ✅ **Internal Opportunities** - Complete
> ✅ **Org Chart** - Complete
> ✅ **Goals Dashboard** - Complete
> ✅ **Announcements** - Complete
> ✅ **GDPR Data Export** - Complete

---

## Recent Updates (2026-02-04)

### HeadofficeOS Neutral Theme Migration - COMPLETE

Full migration from dark cyberpunk theme to HeadofficeOS neutral design system, aligned with the shared HeadofficeOS brand guidelines (ClickUp task 86c7yj0uu).

**Design System Applied:**
- **Brand**: Warm, trustworthy, premium — "Calm and competent" energy
- **Product Accent**: Dusty Blue #b8c4d4 (StaffOS-specific)
- **Typography**: Inter font via Google Fonts (400/500/600 weights)
- **Colour Palette**: Cream #f9f6f2 (page bg), Dark Teal #134e4a (primary), Warm White #ffffff (cards), Stone #e8e2d9 (borders), Muted Teal #5c6b63 (body text)
- **Shadows**: Teal-tinted (not pure black)
- **Spacing**: 4px base unit system
- **Border Radius**: 6px (sm) to 20px (2xl)

**Theme Architecture:**
```
frontend/src/theme/
├── variables.css      # 184 lines — all CSS custom properties (design tokens)
├── base.css           # Reset, typography, body defaults
├── components.css     # 8881 lines — all component styles using CSS variables
└── themes/
    └── default.css    # StaffOS product accent overrides (Dusty Blue)
```

**Migration Stats:**
- Original classes: 801 (from 7977-line dark App.css)
- Migrated classes: 854 (100% coverage + new additions)
- CSS bundle: 204 kB (27.9 kB gzip)
- Old colours replaced: #1a1a2e → var(--color-bg), #7f5af0 → var(--color-primary), etc.
- Component CSS files migrated: 8 standalone .css files (TeamPerformance, Feedback, Quarterly, Recruitment pipeline)
- Inline JSX styles migrated: 12 .jsx files (Policy, Document, Compliance, Expiry, Audit)
- Grey text contrast fix: #9ca3af → #8a9490 across 7 recruitment/candidate CSS files

**White-Label Ready:** To retheme for a client, copy `themes/default.css` → `themes/client-name.css`, override CSS variables, switch import in `main.jsx`.

**Spec Document:** `THEME_SPEC.md` — full design token reference and colour mapping

---

### Chunk 10: HR Cases (PIP/Disciplinary/Grievance) - COMPLETE

ACAS-compliant HR case management for Performance Improvement Plans, Disciplinary procedures, and Grievances with full audit trails.

**Status:** Backend debugged and verified. Frontend components integrated. Ready for browser testing.

**Known Issue (Resolved):** Case creation was not displaying in dashboard — fixed during debugging session (cookie/auth flow and route ordering).

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
| Layout Shell | ✅ Complete | — | Collapsible sidebar + header + breadcrumb |
| Compensation | ✅ Complete | 034-035 | Pay bands, reviews, benefits, bonus schemes, allowances, audit |
| Theme | ✅ Complete | — | HeadofficeOS neutral design system migration |
| Opportunities | ✅ Complete | 036 | Internal job board with apply/review |
| GDPR Export | ✅ Complete | 039 | Data export, deletion requests, ZIP generation |
| Org Chart | ✅ Complete | — | Interactive hierarchy visualisation |

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
11. ✅ HR Cases cookie/auth flow - Fixed session handling for case creation
12. ✅ HR Cases route ordering - Fixed /stats, /my-cases before /:id
13. ✅ Component CSS dark purple remnants - 8 standalone CSS files + 12 JSX inline styles migrated
14. ✅ Grey text contrast (#9ca3af) - Fixed across recruitment/candidate pipeline CSS

---

## Known Issues (Open)

1. **Employees table "Reports To" column clipped** — Right-hand side of the employee list table is cut off on screen, "Reports To" column not fully visible. Needs CSS/layout fix.

---

## Future Enhancements

- ~~**UX Pass Required**: Full review of font colours, contrast, layout and styling across all modules~~ ✅ Done (HeadofficeOS neutral theme migration)
- Visual testing pass — verify all modules render correctly with new theme
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

- HeadofficeOS neutral theme migration — full design system, white-label ready
- Fix component CSS and JSX inline styles — purple remnants and grey text contrast
- HR Cases debugging — cookie/auth flow, route ordering fixes
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

---

## Progress Log

### 2026-02-05 — Rebrand theme from PropertyOS to HeadofficeOS

- **Task**: Rename all references from "PropertyOS theme migration" to "HeadofficeOS neutral theme migration" across the project.
- **Decisions**: Replaced "PropertyOS" with "HeadofficeOS" and changed "light design system" to "neutral design system" throughout. Kept all other theme details (colours, tokens, architecture) unchanged as the request was a naming/branding change only.
- **Changes**: 13 references updated across 5 files:
  - `PROGRESS.md` (7 references)
  - `README.md` (3 references)
  - `THEME_SPEC.md` (1 reference)
  - `frontend/src/README.md` (1 reference)
  - `frontend/src/theme/variables.css` (1 reference)
- **Status**: Complete

### 2026-02-06 — Phase 1: Layout Modernisation (Chunk 11 prep)

- **Task**: Replace the dual-sidebar/horizontal-nav layout with a collapsible sidebar + sticky header bar + content area shell. Add layout CSS tokens, create reusable layout components, migrate all pages, and write unit tests.
- **Decisions**:
  - Used BEM-style CSS class naming (`.sidebar__item--active`) to avoid conflicts with existing component styles
  - Kept existing page components unchanged — only replaced the outer Navigation wrapper with AppShell
  - Sidebar stores collapsed/expanded preference in localStorage (`voidstaffos-sidebar-collapsed`)
  - Nav items follow the spec: Dashboard, People, Cases, Leave, Documents, Compensation, Compliance, Reports, Settings
  - Compliance is admin/manager only; Settings is admin only
  - Breadcrumb auto-generates from a page key → section/label map
  - Header bar includes search placeholder (Ctrl+K palette ready) and contextual action button
  - Installed vitest + @testing-library/react for frontend unit testing (first time setup)
  - Dark mode tokens added to variables.css but not activated
- **Changes**:
  - `frontend/src/theme/variables.css` — added layout sidebar, sidebar colour, and dark mode tokens
  - `frontend/src/components/layout/AppShell.jsx` — new layout shell component
  - `frontend/src/components/layout/Sidebar.jsx` — new collapsible sidebar with lucide-react icons
  - `frontend/src/components/layout/Breadcrumb.jsx` — auto-generating breadcrumb trail
  - `frontend/src/components/layout/StatCard.jsx` — reusable stat card for bento grids
  - `frontend/src/components/layout/PageHeader.jsx` — reusable page header with actions
  - `frontend/src/theme/components.css` — added ~350 lines of layout component styles + responsive rules
  - `frontend/src/App.jsx` — replaced Navigation import with AppShell, wrapped all pages in AppShell
  - `frontend/vite.config.js` — added vitest test configuration
  - `frontend/src/test/setup.js` — test setup file for @testing-library/jest-dom
  - `frontend/src/components/layout/__tests__/Sidebar.test.jsx` — 10 tests
  - `frontend/src/components/layout/__tests__/Breadcrumb.test.jsx` — 5 tests
  - `frontend/src/components/layout/__tests__/StatCard.test.jsx` — 7 tests
  - `frontend/src/components/layout/__tests__/PageHeader.test.jsx` — 5 tests
  - `frontend/src/components/layout/__tests__/AppShell.test.jsx` — 6 tests
- **Tools/Dependencies**: lucide-react, vitest, @testing-library/react, @testing-library/jest-dom, jsdom
- **Status**: Complete
- **Tests**: 33 tests passing (5 test suites)

> ⚠️ No user test performed for this chunk.

### 2026-02-06 — Phase 2: Compensation Tracking (Chunk 11)

- **Task**: Implement full compensation tracking module — database migration, audit middleware, API routes, 7 frontend components, CSS styles, App.jsx routing, breadcrumb updates, and unit tests.
- **Decisions**:
  - Migration uses INTEGER FKs referencing `users(id)` and `tenants(id)` — not UUID as the prompt spec suggested — because the actual schema uses SERIAL (INTEGER) PKs
  - No separate `employees` table exists; `users` IS the employees table
  - Created `compensation_audit_log` as append-only table with salary field redaction middleware
  - Access control: Employee (own data), Manager (direct reports, current salary only), HR/Admin (full), Director (aggregates only)
  - Pay review workflow: draft → submitted → hr_review → approved → applied (with rejected branch)
  - CSS bar charts used for reports (no additional charting dependency)
  - CSV export for compensation reports
  - 7 tables with RLS policies and 11 indexes
- **Changes**:
  - `backend/migrations/034_compensation_tracking.sql` — 7 tables: pay_bands, compensation_records, benefits, review_cycles, pay_reviews, pay_slips, compensation_audit_log
  - `backend/src/middleware/compensationAudit.js` — Audit middleware with sensitive field redaction
  - `backend/src/routes/compensation.js` — Full CRUD routes (~700 lines) for all compensation features
  - `backend/src/server.js` — Registered compensation routes at `/api/compensation`
  - `frontend/src/components/compensation/CompensationDashboard.jsx` — Dashboard with stat cards and quick links
  - `frontend/src/components/compensation/EmployeeSalaryView.jsx` — Salary timeline, band position, benefits, pay slips
  - `frontend/src/components/compensation/PayBandManager.jsx` — CRUD table for pay bands
  - `frontend/src/components/compensation/PayReviewWorkflow.jsx` — Review cycle management with kanban columns
  - `frontend/src/components/compensation/BenefitsEditor.jsx` — Card-based benefits CRUD
  - `frontend/src/components/compensation/CompensationReports.jsx` — Gender pay gap and department cost reports with CSV export
  - `frontend/src/components/compensation/CompensationAuditLog.jsx` — Filterable audit log with pagination
  - `frontend/src/components/layout/Breadcrumb.jsx` — Added compensation sub-page entries to PAGE_MAP
  - `frontend/src/App.jsx` — Added 6 compensation imports and 7 page routes
  - `frontend/src/theme/components.css` — Added ~400 lines of compensation component styles
  - `frontend/src/components/compensation/__tests__/CompensationDashboard.test.jsx` — 5 tests
  - `frontend/src/components/compensation/__tests__/PayBandManager.test.jsx` — 5 tests
  - `frontend/src/components/compensation/__tests__/CompensationAuditLog.test.jsx` — 4 tests
  - `frontend/src/components/compensation/__tests__/auditRedaction.test.jsx` — 5 tests
- **Tools/Dependencies**: No new dependencies (uses existing lucide-react, vitest stack)
- **Status**: Complete
- **Tests**: 52 tests passing (9 test suites)

> ⚠️ No user test performed for this chunk.

### 2026-02-06 — Phase 2E: Integration Testing & Bug Fixes

- **Task**: Run integration tests against live database per CLAUDE-CODE-PROMPT.md section 2E (steps 1-7). Fix bugs discovered during testing.
- **Decisions**:
  - Gender pay gap report: `users` table has no `gender` column — query now groups by pay band only (ready to add gender grouping when column exists)
  - Department costs report: `users` table has no `department` column — query groups by role as a proxy (ready to switch when department column exists)
  - Aggregates endpoint was missing `authorize()` middleware — added `authorize('Admin', 'HR', 'Finance', 'Director')` for proper access control
- **Integration Test Results (all 7 steps)**:
  1. **Create pay bands**: 3 bands (Junior/Mid/Senior) created and listed via API
  2. **Add compensation records**: 3 records for 2 employees, including a promotion/raise
  3. **Self-service view**: Employee sees own salary history + band info; denied access to others
  4. **Manager view**: Manager sees only current salary for direct reports; denied for non-reports
  5. **Pay review workflow**: Full lifecycle — draft → submitted → hr_review → approved → applied
  6. **Audit log**: 21 entries captured — all creates, views, updates logged; salary fields correctly show "REDACTED"
  7. **Access control**: Stats/reports blocked for employees; aggregates now requires Admin/HR/Finance/Director role
- **Bugs Found & Fixed**:
  - `reports/gender-pay-gap`: Query referenced non-existent `u.gender` column → fixed to group by pay band
  - `reports/department-costs`: Query referenced non-existent `u.department` column → fixed to group by role
  - `reports/aggregates`: Missing `authorize()` middleware → added role check (Admin/HR/Finance/Director)
- **Changes**:
  - `backend/src/routes/compensation.js` — fixed 3 report endpoints
- **Status**: Complete
- **Tests**: 52 unit tests passing, 7/7 integration test steps passing

### 2026-02-06 — Tier-Linked Pay Bands with Bonus Schemes & Responsibility Allowances

- **Task**: Add optional features to associate pay bands with tiers, configure bonus calculation schemes (percentage or fixed), and add responsibility allowances. All features toggle-based — Admin enables per-tenant.
- **Decisions**:
  - All three features (tier-band linking, bonus schemes, responsibility allowances) are opt-in via `compensation_settings` toggles — Admin enables them independently
  - Bonus calculation supports both percentage (of base salary or total compensation) and fixed amounts, with min_service_months eligibility filtering
  - When a bonus assignment is "applied", a `benefits` record (type=bonus) is created for full traceability
  - Allowance assignments support ongoing (no end_date) or time-limited with end dates
  - Total compensation endpoint aggregates base salary + bonuses + allowances + benefits with annualisation
  - Used existing `tier_definitions` FK (tier_level INTEGER) and `additional_roles` FK for allowance links
- **Integration Test Results (all 8 steps)**:
  1. **Settings toggle**: Enabled all 3 feature flags via PUT `/settings`
  2. **Pay band with tier**: Created "Manager Band" linked to tier 60 (Manager)
  3. **Bonus scheme**: Created percentage (10%) and fixed (£500) schemes with tier/band restrictions
  4. **Calculate bonuses**: 2 eligible employees found for unrestricted company-wide scheme
  5. **Approve & apply**: Bonus approved, then applied — benefits record created with `applied_benefit_id` link
  6. **Responsibility allowance**: Created "Fire Warden" £150/month, assigned to employee
  7. **Total compensation**: £41,000 base + £500 bonus + £1,800 allowances = £43,300 annual
  8. **Access control**: Employee blocked from scheme CRUD and settings update; audit log captures all actions
- **Bugs Found & Fixed**:
  - Bonus apply INSERT referenced non-existent `benefit_name` column → fixed to use `description`
  - Total compensation SELECT referenced non-existent `benefit_name` → fixed to use `description`
- **Changes**:
  - `backend/migrations/035_tier_linked_compensation.sql` — 6 new tables: compensation_settings, bonus_schemes, responsibility_allowances, employee_bonus_assignments, employee_allowance_assignments + ALTER pay_bands ADD tier_level
  - `backend/src/middleware/compensationAudit.js` — Added calculation_value, amount, calculated_amount, base_amount to SENSITIVE_FIELDS
  - `backend/src/routes/compensation.js` — ~500 new lines: settings, bonus CRUD/calculate/assignments/apply, allowances CRUD/assign/assignments, total-compensation, pay-bands/by-tier. Updated pay-bands POST/PUT for tier_level
  - `frontend/src/components/compensation/CompensationSettingsPanel.jsx` — Admin toggle switches for feature flags
  - `frontend/src/components/compensation/BonusSchemeManager.jsx` — Schemes table, create/edit modal, calculate preview, assignment approve/reject/apply
  - `frontend/src/components/compensation/ResponsibilityAllowanceManager.jsx` — Allowances table, assign modal, assignment end-date
  - `frontend/src/components/compensation/PayBandManager.jsx` — Added optional tier_level dropdown (visible when tier-band linking enabled)
  - `frontend/src/components/compensation/CompensationDashboard.jsx` — Added conditional quick links for bonus/allowances/settings
  - `frontend/src/App.jsx` — 3 new imports + 3 new routes
  - `frontend/src/components/layout/Breadcrumb.jsx` — 3 new page entries
  - `frontend/src/theme/components.css` — ~250 lines: settings panel, toggle switches, bonus/allowance tables, assignment badges, modals
  - `frontend/src/components/compensation/__tests__/CompensationSettingsPanel.test.jsx` — 3 tests
  - `frontend/src/components/compensation/__tests__/BonusSchemeManager.test.jsx` — 5 tests
  - `frontend/src/components/compensation/__tests__/ResponsibilityAllowanceManager.test.jsx` — 4 tests
- **Tools/Dependencies**: No new dependencies
- **Status**: Complete
- **Tests**: 64 unit tests passing (12 test suites), 8/8 integration test steps passing

> ⚠️ No user test performed for this chunk.

### 2026-02-06 — UI Bug Fixes from Browser Testing

- **Task**: Fix 7 issues found during browser testing: team performance table alignment, breadcrumb navigation, pay band assignment, sidebar mobile scaling, empty settings page, dashboard bento tiles.
- **Decisions**:
  - Full CSS variable migration of TeamPerformance.css — replaced all dark theme hardcoded colours with HeadofficeOS design tokens
  - Breadcrumb section crumbs mapped to parent page keys via SECTION_NAV lookup
  - Sidebar uses slide-in drawer pattern on mobile with backdrop overlay, hamburger button in header bar
  - AdminSettingsPage created as a hub page linking to Role Management, Compensation Settings, Compliance
  - Pay band assignment uses existing POST `/api/compensation/records` endpoint with a new GET `/pay-bands/:id/employees` endpoint
  - Dashboard bento grid uses StatCard components for Leave Balance, Policy Compliance, Documents, Notifications, Leave Approvals, Feedback
- **Changes**:
  - `frontend/src/components/TeamPerformance.css` — Full theme migration: all `#2a2a4e`/`#666`/`#888` → CSS variables; `.review-date` alignment fix with gap + nowrap
  - `frontend/src/components/layout/Breadcrumb.jsx` — Added SECTION_NAV map; section crumbs now clickable with navigation keys
  - `frontend/src/components/layout/Sidebar.jsx` — Added `mobileOpen`/`onMobileClose` props, mobile-open CSS class
  - `frontend/src/components/layout/AppShell.jsx` — Added hamburger toggle button, mobile menu state, backdrop overlay
  - `frontend/src/theme/components.css` — Rewrote mobile responsive rules: sidebar drawer, backdrop, hamburger button; added AdminSettingsPage styles
  - `frontend/src/components/admin/AdminSettingsPage.jsx` — New settings hub page (admin-only)
  - `frontend/src/components/compensation/PayBandManager.jsx` — Added Assign Employees modal with employee select, salary input, effective date
  - `frontend/src/components/Dashboard.jsx` — Added StatCard bento-grid section with key stats
  - `frontend/src/App.jsx` — Added AdminSettingsPage import and `settings` route handler
  - `backend/src/routes/compensation.js` — Added GET `/pay-bands/:id/employees` endpoint
- **Tools/Dependencies**: No new dependencies
- **Status**: Complete
- **Tests**: 64 unit tests passing (12 test suites), production build compiles

### 2026-02-06 11:45 UTC — Browser-tested UI fixes (round 2)
- **Task**: Fix remaining issues from browser testing — sidebar not resizing, dashboard layout, button theming
- **Decisions**:
  - Made AppShell single source of truth for sidebar collapsed state (was duplicated in Sidebar)
  - Changed Dashboard from full-width bento grid to two-column layout per user request (main content left, stat cards right column)
  - Widened dashboard max-width from 800px to 1200px
  - Fixed TeamPerformance table: moved `display: flex` from `<td>` to inner `<div>` for proper alignment
  - Replaced hardcoded purple on policy-btn and recruitment-btn with theme CSS variables
- **Changes**:
  - `frontend/src/components/layout/Sidebar.jsx` — Removed internal collapsed state, uses props from AppShell
  - `frontend/src/components/layout/AppShell.jsx` — Single source of truth for collapsed state
  - `frontend/src/components/layout/__tests__/Sidebar.test.jsx` — Updated for prop-driven collapse
  - `frontend/src/components/Dashboard.jsx` — Two-column layout with stat cards in right aside
  - `frontend/src/components/TeamPerformance.jsx` — review-date flex moved to inner div
  - `frontend/src/theme/components.css` — Dashboard layout CSS, policy/recruitment button theme fix
- **Tools/Dependencies**: No new dependencies
- **Status**: Complete — user tested and approved
- **Tests**: 64 unit tests passing (12 test suites), production build compiles

### 2026-02-06 — OpportunitiesPage Component (Internal Opportunities Browse)

- **Task**: Create the employee-facing browse page for internal job opportunities at `frontend/src/components/opportunities/OpportunitiesPage.jsx`.
- **Decisions**:
  - Used `apiFetch` (raw Response wrapper) matching existing codebase pattern, with manual `.json()` parsing
  - Client-side filtering for search (title), department, and employment_type — departments and employment types extracted dynamically from fetched data
  - Bento-grid layout with clickable card buttons for accessibility
  - Status badge logic: "No deadline", "Closed", "Closes today", "X days left" with urgency classes at 7 days or fewer
  - Salary displayed as GBP with en-GB locale formatting, only when `show_salary` is true
  - Employment type labels mapped from snake_case to human-readable (full_time -> "Full Time")
  - BEM-style CSS class naming consistent with existing components
- **Changes**:
  - `frontend/src/components/opportunities/OpportunitiesPage.jsx` — new file
- **Tools/Dependencies**: No new dependencies (uses existing React, apiFetch)
- **Status**: Complete

> No user test performed for this chunk.

### 2026-02-06 — ApplicationForm Component (Opportunity Application Modal)

- **Task**: Create the modal form component for submitting applications to internal opportunities at `frontend/src/components/opportunities/ApplicationForm.jsx`.
- **Decisions**:
  - Used `apiFetch` (raw Response wrapper) matching existing codebase pattern — checks `response.status` directly for 201/409
  - Cover letter is optional — textarea with placeholder but no required validation
  - 409 Conflict handled specifically with a user-friendly "already applied" message
  - Click propagation stopped on modal dialog to prevent accidental backdrop close
  - Submit button disabled while request in-flight to prevent double-submission
  - ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-label` on close button, `role="alert"` on error
- **Changes**:
  - `frontend/src/components/opportunities/ApplicationForm.jsx` — new file
- **Tools/Dependencies**: No new dependencies (uses existing React useState, apiFetch)
- **Status**: Complete

> No user test performed for this chunk.

### 2026-02-06 — OpportunitiesAdminPage Component (HR/Admin Management)

- **Task**: Create the HR/Admin management page for internal opportunities at `frontend/src/components/opportunities/OpportunitiesAdminPage.jsx`.
- **Decisions**:
  - Used `apiFetch` (raw Response wrapper) matching existing codebase pattern, with manual `.json()` parsing
  - Inline create/edit form (not a modal) toggled by `showCreateForm` state — keeps the admin workflow simple
  - Status-based action buttons: draft (Edit/Publish/Delete), open (Edit/Close/Mark Filled), closed/filled (View only)
  - Delete requires `window.confirm` before proceeding
  - Publish calls POST `/api/opportunities/:id/publish`, Close calls POST `/api/opportunities/:id/close`, Mark Filled sends `{ filled: true }` to the close endpoint
  - Status filter dropdown filters client-side from the full fetched list
  - Form handles salary as numbers, converts empty strings to null before sending
  - BEM-style CSS class naming: `opportunities-admin`, `opportunity-form`, `opportunity-actions` etc.
  - Status badges use `status-badge status-badge--{status}` class pattern consistent with existing components
  - ARIA labels on all interactive elements for accessibility
  - All API errors caught with try/catch and displayed in a dismissible error banner
- **Changes**:
  - `frontend/src/components/opportunities/OpportunitiesAdminPage.jsx` — new file
- **Tools/Dependencies**: No new dependencies (uses existing React, apiFetch)
- **Status**: Complete

> No user test performed for this chunk.

### 2026-02-06 — MyApplicationsPage Component (User's Submitted Applications)

- **Task**: Create the MyApplicationsPage component at `frontend/src/components/opportunities/MyApplicationsPage.jsx` to display the current user's submitted opportunity applications.
- **Decisions**:
  - Used `apiFetch` matching existing codebase pattern for GET `/api/opportunities/applications/mine` and PUT withdraw endpoint
  - Status badges use `status-badge status-badge--{status}` class pattern for 8 statuses: submitted, reviewing, shortlisted, interview, offered, accepted, rejected, withdrawn
  - Withdraw button hidden for accepted/withdrawn applications, requires `window.confirm` before proceeding
  - `withdrawingId` state tracks in-progress withdrawal to disable the button and show "Withdrawing..." text
  - Dates formatted with `en-GB` locale (e.g. "6 Feb 2026")
  - Error state shown with retry button; non-blocking error banner shown when withdraw fails but applications are already loaded
  - ARIA labels on opportunity title links and withdraw buttons for accessibility
- **Changes**:
  - `frontend/src/components/opportunities/MyApplicationsPage.jsx` — new file
- **Tools/Dependencies**: No new dependencies (uses existing React, apiFetch)
- **Status**: Complete

> No user test performed for this chunk.

### 2026-02-06 — OpportunityDetailPage Component (Single Opportunity View)

- **Task**: Create the full detail view for a single internal opportunity at `frontend/src/components/opportunities/OpportunityDetailPage.jsx`.
- **Decisions**:
  - Used `apiFetch` (raw Response wrapper) matching existing codebase pattern, with manual `.json()` parsing
  - Fetches GET `/api/opportunities/${opportunityId}` on mount; re-fetches after successful application submission to update `my_application`
  - Description and requirements rendered as paragraphs split by `\n` with empty lines filtered out
  - Salary displayed as GBP with en-GB locale formatting, only when `show_salary` is true and both min/max exist
  - Application status: if `my_application` exists, shows "You applied on [date] -- Status: [badge]" instead of Apply button
  - If opportunity is open and no application exists, shows "Apply Now" button that opens ApplicationForm modal
  - If opportunity is not open, shows a closed notice message
  - Employment type labels mapped from snake_case to human-readable via shared label map
  - BEM-style CSS class naming: `opportunity-detail`, `opportunity-detail__header`, `opportunity-detail__meta`, `opportunity-detail__body`, `opportunity-detail__actions`
  - ARIA labels on loading state, error alerts, application status, and all buttons
- **Changes**:
  - `frontend/src/components/opportunities/OpportunityDetailPage.jsx` — new file
- **Tools/Dependencies**: No new dependencies (uses existing React, apiFetch, ApplicationForm)
- **Status**: Complete

> No user test performed for this chunk.

### 2026-02-06 12:15 UTC — Chunk 12: Internal Opportunities (Complete)
- **Task**: Build internal job board — employees browse and apply, HR manages postings
- **Decisions**:
  - Used SERIAL INTEGER PKs (not UUID) to match existing schema conventions
  - Migration numbered 036 (035 already taken by tier-linked compensation)
  - Kept opportunities routes under `/api/opportunities` with applications nested as sub-routes
  - Sidebar nav item "Opportunities" with Megaphone icon, visible to all users
  - Admin pages gated to Admin/Manager roles in both App.jsx routing and backend authorize middleware
  - Employee-facing detail page shows "Apply Now" or existing application status
  - HR notes on applications are never exposed to applicants (excluded from /applications/mine query)
  - Status workflows: Opportunity: draft→open→closed/filled; Application: submitted→reviewing→shortlisted→interview→offered→accepted (with rejected/withdrawn branches)
- **Changes**:
  - `backend/migrations/036_internal_opportunities.sql` — internal_opportunities + internal_applications tables with indexes
  - `backend/src/routes/opportunities.js` — Full CRUD + publish/close + applications endpoints with auth
  - `backend/src/server.js` — Registered opportunities routes
  - `frontend/src/components/opportunities/OpportunitiesPage.jsx` — Employee browse page with filters and card grid
  - `frontend/src/components/opportunities/OpportunityDetailPage.jsx` — Full opportunity detail with apply
  - `frontend/src/components/opportunities/ApplicationForm.jsx` — Modal application form
  - `frontend/src/components/opportunities/MyApplicationsPage.jsx` — Employee's applications list with withdraw
  - `frontend/src/components/opportunities/OpportunitiesAdminPage.jsx` — HR management (CRUD, publish, close)
  - `frontend/src/components/opportunities/ApplicationsReviewPage.jsx` — HR application review with status updates
  - `frontend/src/components/layout/Sidebar.jsx` — Added Opportunities nav item
  - `frontend/src/components/layout/Breadcrumb.jsx` — Added opportunity page entries
  - `frontend/src/App.jsx` — Added imports and routes for 5 opportunity pages
  - `frontend/src/theme/components.css` — ~500 lines of themed CSS for opportunities
  - `frontend/src/components/opportunities/__tests__/` — 4 test files (OpportunitiesPage, MyApplications, ApplicationForm, AdminPage)
- **Tools/Dependencies**: No new dependencies (lucide-react Megaphone icon already available)
- **Status**: Complete
- **Tests**: 81 unit tests passing (16 test suites), production build compiles

> ⚠️ No user test performed for this chunk.

---

### 2026-02-06 14:20 UTC — Opportunities Dashboard Integration

- **Task**: Add seed data for internal opportunities, dashboard stat card, and scrolling ticker tape banner
- **Decisions**:
  - Seeded 5 realistic care-sector job opportunities directly into the database (Senior Care Assistant, Kitchen Team Leader, Activities Coordinator, Night Care Assistant, HR Administrator)
  - Added an "Opportunities" StatCard to the dashboard right-side aside column showing count of open positions
  - Built a ticker tape banner at the top of the dashboard displaying scrolling job postings with title, salary range, and posted date
  - Used `requestAnimationFrame` for the ticker animation instead of CSS `@keyframes` — CSS approach failed to scroll due to browser width calculation issues with `translateX(-50%)`
  - Ticker pauses on hover, clicks through to the Opportunities page, and uses edge-fade masking for smooth visual appearance
  - Changed `openOpportunities` state from a count (number) to the full array of opportunity objects to support both the stat card and ticker
- **Changes**:
  - `frontend/src/components/Dashboard.jsx` — Added `useRef`/`useCallback` imports, `openOpportunities` now stores full array, added `formatSalary`/`formatTickerDate` helpers, added `requestAnimationFrame` scroll loop with hover pause, added ticker banner JSX
  - `frontend/src/theme/components.css` — Added ~60 lines of ticker banner CSS (`.ticker-banner`, `__track`, `__item`, `.ticker-salary`, `.ticker-date`, `.ticker-separator`, edge-fade mask)
- **Tools/Dependencies**: No new dependencies
- **Status**: Complete — user tested and approved in browser
- **Tests**: 81 unit tests passing (16 test suites), production build compiles
- **Git**: Committed `8851d8d`, pushed to `origin/main`

### 2026-02-06 14:45 UTC — Chunk 13: Org Chart

- **Task**: Add interactive organisational chart page visualising company hierarchy from `manager_id` relationships.
- **Decisions**:
  - No migration needed — `manager_id` already exists on `users` table (migration 002)
  - Single flat query + JS tree build: Map lookup → attach children to parents → orphans become roots
  - Custom CSS flexbox tree with CSS connector lines (no chart library dependency)
  - Pan via mousedown+drag → CSS transform translate; zoom via scroll wheel → CSS transform scale (clamped 0.3–2.0)
  - Search finds nodes by name/email/employee number, highlights and scrolls into view
  - EmployeeQuickCard popup reuses existing modal pattern; manager reassignment calls existing PUT `/api/users/:id/assign-manager`
  - Replaced `Unfold`/`Fold` icons with `Expand`/`Shrink` (not available in installed lucide-react version)
  - Org Chart nav item gated to Admin/Manager in both Sidebar filter and App.jsx route
- **Changes**:
  - `backend/src/controllers/userController.js` — Added `getOrgChart` controller (flat query + JS tree build)
  - `backend/src/routes/users.js` — Added `GET /org-chart` route before `/:id` catch-all
  - `frontend/src/components/OrgChartPage.jsx` — Page container with fetch, search, highlight, quick card state
  - `frontend/src/components/OrgChart.jsx` — Tree renderer with pan/zoom, expand/collapse all controls
  - `frontend/src/components/OrgNode.jsx` — Recursive card with initials avatar, CSS connectors, expand/collapse toggle
  - `frontend/src/components/EmployeeQuickCard.jsx` — Modal with employee details, View Profile, Reassign Manager
  - `frontend/src/theme/components.css` — ~200 lines of org chart CSS using CSS custom properties
  - `frontend/src/components/layout/Sidebar.jsx` — Added `Org Chart` nav item with Network icon (Admin/Manager only)
  - `frontend/src/components/layout/Breadcrumb.jsx` — Added `org-chart` page entry under People section
  - `frontend/src/App.jsx` — Added OrgChartPage import and route
  - `frontend/src/components/__tests__/OrgChartPage.test.jsx` — 7 tests (loading, tree render, count, error, search, quick card, empty)
  - `frontend/src/components/__tests__/OrgNode.test.jsx` — 9 tests (render, expand/collapse, toggle, highlight, click, badge, leaf)
- **Tools/Dependencies**: No new dependencies (uses existing lucide-react, vitest stack)
- **Status**: Complete
- **Tests**: 97 unit tests passing (18 test suites), production build compiles

> ⚠️ No user test performed for this chunk.

### 2026-02-06 15:30 UTC — Chunk 14: Goals Dashboard

- **Task**: Add goal-setting and tracking system with personal goals, manager-assigned goals, progress tracking, comments/updates timeline, and team goals view.
- **Decisions**:
  - Used INTEGER serial PKs (not UUIDs as the spec suggested) to match existing codebase convention
  - Migration numbered 037 (not 036 as spec suggested — 036 already used by opportunities)
  - Express middleware auth (authenticate, authorize) instead of Supabase RLS
  - CSS custom properties (BEM naming) instead of TailwindCSS
  - Goals have 4 categories (performance, development, project, personal) and 3 priorities (low, medium, high)
  - Status lifecycle: draft → active → completed/cancelled
  - Progress 0–100 with step-5 slider
  - Goal updates table tracks progress changes and comments with author names
  - Manager assignment verified via direct reports check (managers assign to reports, admins to anyone)
  - Team goals grouped by owner name with search filtering
  - Overdue detection: active goals where target_date < today
  - Goals page accessible to all users; Team Goals page gated to Admin/Manager
- **Changes**:
  - `backend/migrations/037_goals.sql` — goals + goal_updates tables with indexes
  - `backend/src/routes/goals.js` — Full CRUD + stats + team + progress + updates (~727 lines)
  - `backend/src/server.js` — Registered goals routes
  - `frontend/src/components/goals/GoalCard.jsx` — Goal card with category badge, priority, progress bar, overdue detection
  - `frontend/src/components/goals/GoalForm.jsx` — Create/edit modal with assign-to dropdown for managers
  - `frontend/src/components/goals/GoalProgressUpdate.jsx` — Progress slider modal with comment
  - `frontend/src/components/goals/GoalsDashboardPage.jsx` — Main page with stats cards, filter tabs, category filter, goals grid
  - `frontend/src/components/goals/GoalDetailModal.jsx` — Full goal view with update timeline, comment form, edit/delete/complete
  - `frontend/src/components/goals/TeamGoalsPage.jsx` — Manager team view grouped by owner with search
  - `frontend/src/theme/components.css` — ~450 lines of goals CSS (stats cards, filters, cards, badges, progress bars, detail modal, timeline, empty states, responsive)
  - `frontend/src/components/layout/Sidebar.jsx` — Added Goals nav item with Target icon
  - `frontend/src/components/layout/Breadcrumb.jsx` — Added goals and team-goals page entries
  - `frontend/src/App.jsx` — Added GoalsDashboardPage and TeamGoalsPage imports and routes
  - `frontend/src/components/__tests__/GoalsDashboardPage.test.jsx` — 7 tests (loading, stats, goals list, error, empty, create modal, filter tabs)
  - `frontend/src/components/__tests__/GoalCard.test.jsx` — 13 tests (render, badges, progress, actions, callbacks, completed, overdue, owner, assigned)
- **Tools/Dependencies**: No new dependencies (uses existing lucide-react, vitest stack)
- **Status**: Complete
- **Tests**: 117 unit tests passing (20 test suites), production build compiles

> ⚠️ No user test performed for this chunk.

### 2026-02-06 16:20 UTC — Chunk 15: Announcements

- **Task**: Add company announcements system with HR/Admin management, employee viewing, read tracking, and dashboard ticker integration.
- **Decisions**:
  - INTEGER serial PKs, Express middleware auth (not UUID/Supabase as spec suggested)
  - Migration 038 (announcements + announcement_reads tables)
  - 5 categories (general, urgent, policy, event, celebration) with colour-coded badges
  - 4 priorities (low, normal, high, urgent) — urgent gets red border accent
  - Status lifecycle: draft → published → archived
  - Read tracking via announcement_reads table with ON CONFLICT upsert
  - Auto-mark as read when detail modal opens (fire-and-forget)
  - Dashboard ticker: urgent/pinned announcements added alongside opportunities, with category badge + NEW indicator
  - Admin page uses table layout matching existing OpportunitiesAdminPage pattern
  - Read receipts modal shows employee list with read/unread status and coverage percentage
  - Announcements nav item visible to all users; Admin page gated to Admin role
- **Changes**:
  - `backend/migrations/038_announcements.sql` — announcements + announcement_reads tables with indexes
  - `backend/src/routes/announcements.js` — 12 API endpoints (~430 lines)
  - `backend/src/server.js` — Registered announcements routes
  - `frontend/src/components/announcements/AnnouncementCard.jsx` — Card with category badge, priority, pinned icon, unread dot, content preview
  - `frontend/src/components/announcements/AnnouncementDetailModal.jsx` — Full view with auto-mark-as-read
  - `frontend/src/components/announcements/AnnouncementForm.jsx` — Create/edit modal with Save as Draft / Publish
  - `frontend/src/components/announcements/AnnouncementsPage.jsx` — Employee view with filter tabs (All/Unread/Pinned) and category filter
  - `frontend/src/components/announcements/AnnouncementsAdminPage.jsx` — Admin table with status-based actions
  - `frontend/src/components/announcements/AnnouncementReadReceipts.jsx` — Read receipts modal with coverage stats
  - `frontend/src/components/Dashboard.jsx` — Ticker integration: fetches `/announcements/ticker`, combines with opportunities
  - `frontend/src/theme/components.css` — ~350 lines announcements CSS
  - `frontend/src/components/layout/Sidebar.jsx` — Added Announcements nav item with Bell icon
  - `frontend/src/components/layout/Breadcrumb.jsx` — Added announcements + announcements-admin page entries
  - `frontend/src/App.jsx` — Added AnnouncementsPage and AnnouncementsAdminPage imports and routes
  - `frontend/src/components/__tests__/AnnouncementsPage.test.jsx` — 7 tests
  - `frontend/src/components/__tests__/AnnouncementCard.test.jsx` — 12 tests
- **Tools/Dependencies**: No new dependencies
- **Status**: Complete
- **Tests**: 136 unit tests passing (22 test suites), production build compiles

> ⚠️ No user test performed for this chunk.

### 2026-02-06 17:00 UTC — Chunk 16: GDPR Data Export

- **Task**: Add GDPR-compliant data export functionality — employees can request a copy of all their personal data (Subject Access Request), HR/Admin can manage deletion requests.
- **Decisions**:
  - INTEGER SERIAL PKs and Express middleware auth (not UUID/Supabase RLS as spec suggested)
  - Migration 039 (data_requests + data_request_logs tables)
  - Export requests auto-generate immediately (no HR approval needed for exports)
  - Deletion requests require Admin approval (actual data deletion is future work — currently marks as completed)
  - ZIP archive generated using `archiver` npm package, stored at `backend/uploads/exports/{tenantId}/`
  - Queries 28 tables across 8 categories (profile, personal, documents, leave, compliance, performance, compensation, goals, probation, hr_cases, offboarding, opportunities, activity, absence)
  - Password hash explicitly excluded from user profile export
  - HR case notes filtered by `visible_to_employee = true` — HR-only notes not included
  - Rate limit: 3 export requests per 24 hours (in-route check, not middleware)
  - Download links expire after 30 days; admin cleanup endpoint deletes files from disk
  - Download uses blob fetch pattern (matching existing document download approach)
  - Single sidebar nav item "My Data" visible to all users; admin page accessible via button for Admin/HR Manager
- **Changes**:
  - `backend/migrations/039_gdpr_data_requests.sql` — data_requests + data_request_logs tables with indexes
  - `backend/src/routes/gdpr.js` — 8 API endpoints + ZIP generation service (~580 lines)
  - `backend/src/server.js` — Registered GDPR routes at `/api/gdpr`
  - `backend/package.json` — Added `archiver` dependency
  - `frontend/src/components/gdpr/GDPRPage.jsx` — Employee self-service page (request export, download, history table)
  - `frontend/src/components/gdpr/GDPRAdminPage.jsx` — HR/Admin management (table, filters, detail modal, deletion modal)
  - `frontend/src/components/gdpr/GDPRRequestDetail.jsx` — Request detail modal with activity timeline and approve/reject
  - `frontend/src/components/gdpr/DataDeletionModal.jsx` — Deletion request creation with confirmation
  - `frontend/src/components/layout/Sidebar.jsx` — Added "My Data" nav item with Shield icon
  - `frontend/src/components/layout/Breadcrumb.jsx` — Added gdpr + gdpr-admin page entries
  - `frontend/src/App.jsx` — Added GDPRPage and GDPRAdminPage imports and routes
  - `frontend/src/theme/components.css` — ~300 lines GDPR CSS (page, table, badges, detail modal, timeline, deletion modal, responsive)
  - `frontend/src/components/__tests__/GDPRPage.test.jsx` — 12 tests
  - `frontend/src/components/__tests__/GDPRAdminPage.test.jsx` — 8 tests
- **Tools/Dependencies**: archiver (new backend dependency for ZIP generation)
- **Status**: Complete
- **Tests**: 156 unit tests passing (24 test suites), production build compiles

> ⚠️ No user test performed for this chunk.
