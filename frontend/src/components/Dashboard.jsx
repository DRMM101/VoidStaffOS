function Dashboard({ user }) {
  return (
    <div className="dashboard-content">
      <div className="welcome-card">
        <h2>Welcome, {user.full_name}!</h2>
        <div className="user-info">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role_name}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
