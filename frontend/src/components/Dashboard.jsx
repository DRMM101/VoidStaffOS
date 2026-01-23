function Dashboard({ user, onLogout }) {
  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>VoidStaffOS</h1>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </header>

      <main className="dashboard-main">
        <div className="welcome-card">
          <h2>Welcome, {user.full_name}!</h2>
          <div className="user-info">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.role_name}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
