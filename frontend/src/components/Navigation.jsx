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
