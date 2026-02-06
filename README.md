<!--
  VoidStaffOS - Main Project Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS

**Proprietary Employee Performance Management System**

VoidStaffOS is a comprehensive employee management platform featuring blind performance reviews, leave management, 360 feedback, ACAS-compliant HR case management, and multi-tenant support with enterprise-grade security. Built on the HeadofficeOS neutral design system for a warm, professional aesthetic with white-label support.

---

## Features

### Performance Management
- **Blind Reviews**: Manager and employee submit weekly assessments independently
- **KPI Reveal**: Ratings only visible after both parties commit
- **Traffic Light System**: Visual red/amber/green performance indicators
- **Velocity, Friction, Cohesion**: Proprietary KPI calculations

### Leave Management
- Leave request workflow with manager approval
- Notice period calculation and policy enforcement
- Leave balance tracking
- Calendar integration

### Team Management
- Hierarchical manager structure with tier system
- Employee transfers and orphan adoption
- Team performance dashboards
- Direct report management

### 360 Feedback
- Quarterly peer feedback
- Composite KPI aggregation
- Anonymous feedback collection

### Notifications
- Real-time notification system
- Review reminders and overdue alerts
- Leave approval notifications
- Team change notifications

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Inter (Google Fonts) |
| Design System | HeadofficeOS Neutral — CSS custom properties, white-label ready |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Auth | Session cookies (HttpOnly) |
| Security | Helmet, CSRF protection, bcrypt |

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repository-url>
cd VoidStaffOS

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials and SESSION_SECRET

# Run migrations (001 through 033)
psql -U your_user -d your_db -f migrations/001_initial_schema.sql
# ... through 033_hr_cases.sql

# Start backend
npm run dev

# Frontend setup (new terminal)
cd ../frontend
npm install
npm run dev
```

### Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

---

## Project Structure

```
VoidStaffOS/
├── backend/
│   ├── migrations/          # SQL migration files
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── controllers/     # Business logic
│   │   ├── middleware/      # Auth, CSRF, security
│   │   ├── repositories/    # Data access layer
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Audit logging
│   │   └── server.js        # Express entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── theme/           # HeadofficeOS neutral design system
│   │   │   ├── variables.css    # Design tokens (CSS custom properties)
│   │   │   ├── base.css         # Reset, typography, body defaults
│   │   │   ├── components.css   # All component styles
│   │   │   └── themes/
│   │   │       └── default.css  # StaffOS product accent (Dusty Blue)
│   │   ├── utils/           # API utilities
│   │   ├── App.jsx          # Root component
│   │   └── main.jsx         # Entry point
│   └── package.json
├── docs/
│   ├── API_REFERENCE.md     # API documentation
│   ├── COMPONENT_MAP.md     # Architecture overview
│   ├── DATABASE_SCHEMA.md   # Database documentation
│   └── SECURITY.md          # Security architecture
├── LICENSE.md               # Proprietary licence
├── NOTICE.md                # Copyright notice
└── README.md                # This file
```

---

## Security Overview

VoidStaffOS implements enterprise-grade security:

| Feature | Implementation |
|---------|----------------|
| Authentication | Session-based with HttpOnly cookies |
| CSRF Protection | Double-submit cookie pattern |
| Password Storage | bcrypt with 10 rounds |
| Multi-Tenant | tenant_id isolation on all data |
| Security Headers | Helmet with CSP, HSTS |
| Audit Logging | All sensitive operations logged |
| Rate Limiting | 100 req/min global, 10 req/min auth |

See [docs/SECURITY.md](docs/SECURITY.md) for full details.

---

## Available Modules

| Module | Status | Description |
|--------|--------|-------------|
| Core | ✅ Active | Employee management, roles, tenants |
| LeaveOS | ✅ Active | Leave request management with approvals |
| Sick & Statutory | ✅ Active | Sick leave, RTW interviews, urgent notifications |
| FeedbackOS | ✅ Active | 360 quarterly feedback system |
| PolicyOS | ✅ Active | Policy management with acknowledgment tracking |
| Document Storage | ✅ Active | Secure employee document management |
| ComplianceOS | ✅ Active | RTW/DBS verification tracking (CQC-ready) |
| EmergencyOS | ✅ Active | Emergency contacts and medical info |
| ProbationOS | ✅ Active | Probation period tracking and reviews |
| InsightsOS | ✅ Active | Absence pattern detection & Bradford Factor |
| OffboardingOS | ✅ Active | Exit workflow, checklists, handovers |
| HR Cases | ✅ Active | ACAS-compliant PIP, Disciplinary, Grievance |
| LearnOS | 📋 Planned | Learning management |
| AssetOS | 📋 Planned | Asset tracking |
| TimeOS | 📋 Planned | Time tracking |
| ExpenseOS | 📋 Planned | Expense management |

---

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/voidstaff_db

# Session Security
SESSION_SECRET=change-this-to-a-long-random-string

# Server
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

---

## API Documentation

Full API documentation available at [docs/API_REFERENCE.md](docs/API_REFERENCE.md).

**Key Endpoints:**
- `POST /api/auth/login` - Authentication
- `GET /api/auth/me` - Current user
- `GET /api/users` - List users
- `POST /api/reviews` - Create review
- `POST /api/leave/request` - Submit leave

---

## Development

### Running Tests

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### Code Style

- ES6+ JavaScript
- React functional components with hooks
- Express.js middleware pattern
- PostgreSQL with parameterised queries

---

## Licence

**PROPRIETARY AND CONFIDENTIAL**

Copyright © 2026 D.R.M. Manthorpe. All rights reserved.

This software is proprietary and confidential. Used and distributed under licence only. Unauthorized copying, modification, distribution, or use is strictly prohibited without prior written consent.

See [LICENSE.md](LICENSE.md) for full licence terms.

---

## Support

For support and security issues, contact the author directly.

**Author:** D.R.M. Manthorpe
