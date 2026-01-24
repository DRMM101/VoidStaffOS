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
├── App.jsx                     # Root component, routing
├── App.css                     # Global styles
└── main.jsx                    # Entry point
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

- Dark theme (#1a1a2e background)
- Purple accent (#7f5af0)
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
- Token stored in localStorage
- User object passed as prop from App

## API Communication

All API calls use fetch with JWT header:

```javascript
const token = localStorage.getItem('token');
const response = await fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});
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
