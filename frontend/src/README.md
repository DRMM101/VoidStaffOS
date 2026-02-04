<!--
  VoidStaffOS - Frontend Documentation
  Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
  Created: 24/01/2026
  Updated: 25/01/2026
  PROPRIETARY AND CONFIDENTIAL
-->

# VoidStaffOS Frontend

React application for the VoidStaffOS employee management system.

## Structure

```
src/
├── components/
│   ├── Dashboard.jsx           # Main landing page, KPI summary
│   ├── Login.jsx               # Authentication form
│   ├── Employees.jsx           # Employee list with status
│   ├── EmployeeForm.jsx        # Create/edit employee modal
│   ├── EmployeeProfile.jsx     # Detailed employee profile
│   ├── Reviews.jsx             # Review list view
│   ├── ReviewForm.jsx          # Manager creates reviews
│   ├── SelfReflectionForm.jsx  # Employee self-reflection
│   ├── MyReports.jsx           # Employee's own history
│   ├── LeaveRequest.jsx        # Submit leave request
│   ├── MyLeaveRequests.jsx     # Employee leave history
│   ├── ManagerLeaveApprovals.jsx # Approval queue
│   ├── NotificationBell.jsx    # Header notification icon
│   └── Notifications.jsx       # Full notification list
├── utils/
│   └── api.js                  # Fetch wrapper with credentials
├── App.jsx                     # Root component, routing, auth state
├── App.css                     # Global styles
└── main.jsx                    # Entry point
```

## Security

### Session-Based Authentication
- **No localStorage tokens** - sessions are HttpOnly cookies
- Browser automatically sends `staffos_sid` cookie with requests
- All fetch calls must include `credentials: 'include'`

### CSRF Protection
- State-changing requests (POST, PUT, PATCH, DELETE) require CSRF token
- Read token from `staffos_csrf` cookie
- Include in `X-CSRF-Token` header

### API Communication Pattern

```javascript
// Helper to get CSRF token from cookie
const getCsrfToken = () => {
  const match = document.cookie.match(/staffos_csrf=([^;]+)/);
  return match ? match[1] : '';
};

// GET request (no CSRF needed)
const response = await fetch('/api/endpoint', {
  credentials: 'include'  // Required for session cookies
});

// POST/PUT/DELETE request (CSRF required)
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken()
  },
  credentials: 'include',
  body: JSON.stringify(data)
});
```

## Key Features

### Dashboard
- Welcome card with quick actions
- Weekly reflection status (pending/waiting/complete)
- KPI comparison when both reviews committed
- Pending leave count badge for managers
- Notification bell with unread count

### Employees View
- Filterable employee list
- Review status indicators (traffic lights)
- Tier badges with color coding
- Click to view profile or create review

### Blind Review Flow
1. Employee sees "Complete This Week's Reflection" button
2. After submitting, sees "Waiting for Manager Review"
3. When both commit, sees KPI comparison

### Leave Management
- Request form with date picker
- Notice policy warning
- Balance display
- Manager approval queue with approve/reject

### Notifications
- Bell icon in header with badge
- Dropdown shows recent 10
- Full page view with filters
- Categories: Performance, Leave, Team

## Styling

- PropertyOS light design system (cream #f9f6f2 background)
- Dark Teal primary (#134e4a), Dusty Blue product accent (#b8c4d4)
- CSS custom properties in `theme/variables.css` — white-label ready
- Traffic light colors: green (#2ed573), amber (#ffa500), red (#ff4757)
- Tier badges color-coded by level

### CSS Classes

```css
/* Traffic lights */
.traffic-light.green { background: #2ed573; }
.traffic-light.amber { background: #ffa500; }
.traffic-light.red { background: #ff4757; }

/* Tier badges */
.tier-badge.tier-1 { color: gold; }      /* Executive */
.tier-badge.tier-2 { color: green; }     /* Senior */
.tier-badge.tier-3 { color: blue; }      /* Mid-Level */
.tier-badge.tier-4 { color: orange; }    /* Junior */
.tier-badge.tier-5 { color: gray; }      /* Entry */
.tier-badge.tier-admin { color: red; }   /* Admin */
```

## State Management

- Local state with useState/useEffect
- No external state library
- Auth state managed in App.jsx via session cookie
- User object passed as prop from App

### Auth State Check

```javascript
// App.jsx checks session on load
useEffect(() => {
  fetch('/api/auth/me', { credentials: 'include' })
    .then(res => res.ok ? res.json() : null)
    .then(data => setUser(data?.user || null));
}, []);
```

### Logout

```javascript
// Destroys server session and clears cookies
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include'
});
setUser(null);
```

## Running

```bash
# Install dependencies
npm install

# Development
npm run dev    # Runs on http://localhost:5173

# Build for production
npm run build
```

## Environment

Vite proxy configured to forward `/api` to backend:

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

## Browser Requirements

- Modern browser with cookie support
- Third-party cookies must be enabled for cross-origin development
- SameSite=Lax cookie policy requires same-site navigation
