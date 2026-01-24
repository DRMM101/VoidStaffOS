# VoidStaffOS Backend

Express.js REST API for the VoidStaffOS employee management system.

## Structure

```
src/
├── config/
│   └── database.js      # PostgreSQL connection pool
├── controllers/
│   ├── authController.js        # Login, JWT generation
│   ├── userController.js        # User CRUD, transfers, adoptions
│   ├── reviewController.js      # Performance reviews, KPI calculations
│   ├── leaveController.js       # Leave requests, approvals
│   ├── notificationController.js # Notifications CRUD and triggers
│   └── reportController.js      # Team performance reports
├── middleware/
│   └── auth.js          # JWT authentication, role authorization
├── routes/
│   ├── auth.js          # POST /api/auth/login
│   ├── users.js         # /api/users/* endpoints
│   ├── reviews.js       # /api/reviews/* endpoints
│   ├── leave.js         # /api/leave/* endpoints
│   ├── notifications.js # /api/notifications/* endpoints
│   ├── reports.js       # /api/reports/* endpoints
│   └── dev.js           # Development utilities
└── server.js            # Express app configuration
```

## Key Concepts

### Authentication
- JWT-based authentication
- Tokens include user ID, email, role, and tier
- 24-hour expiration
- Stored in localStorage on frontend

### Authorization
- Role-based: Admin, Manager, Employee, Compliance Officer
- Tier-based: 1 (Executive) to 5 (Entry), null for Admin
- Managers can only manage lower-tier employees
- Visibility filtered by relationship (manager → direct reports)

### Blind Reviews
- Manager and employee both create reviews for same week
- Neither sees the other's ratings until both commit
- Text fields hidden from managers viewing team self-reflections
- KPIs revealed only after both parties commit

### Leave Policy
- Notice: 2x days for 1-4 day requests, 30 days for 5+ days
- Working days calculation excludes weekends
- Auto-skip reviews during approved leave (>2 days)

## Environment Variables

```env
DATABASE_URL=postgres://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
PORT=3001
```

## Running

```bash
# Install dependencies
npm install

# Development (with nodemon)
npm run dev

# Production
npm start
```

## Database Migrations

Migrations are in `../migrations/`. Run them in order:

```bash
psql -U voidstaff -d voidstaff_db -f migrations/001_initial_schema.sql
# ... through 009_notifications.sql
```

## API Documentation

See `/docs/API_REFERENCE.md` for complete endpoint documentation.
