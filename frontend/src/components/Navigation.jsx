/**
 * VoidStaffOS - Navigation Component
 * Main navigation header with menu links.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

function Navigation({ currentPage, onNavigate, onLogout, isAdmin, isManager }) {
  return (
    <header className="nav-header">
      <h1 className="nav-logo">VoidStaffOS</h1>
      <nav className="nav-links">
        <button
          className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`nav-link ${currentPage === 'employees' ? 'active' : ''}`}
          onClick={() => onNavigate('employees')}
        >
          Employees
        </button>
        <button
          className={`nav-link ${currentPage === 'reviews' ? 'active' : ''}`}
          onClick={() => onNavigate('reviews')}
        >
          Snapshots
        </button>
        <button
          className={`nav-link ${currentPage === 'my-reports' ? 'active' : ''}`}
          onClick={() => onNavigate('my-reports')}
        >
          My Reports
        </button>
      </nav>
      <button onClick={onLogout} className="logout-btn">
        Logout
      </button>
    </header>
  );
}

export default Navigation;
