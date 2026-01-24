import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Reviews from './components/Reviews';
import EmployeeQuarterlyReport from './components/EmployeeQuarterlyReport';
import Navigation from './components/Navigation';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentPage('dashboard');
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';
  const canCreateReviews = isAdmin || isManager;

  return (
    <div className="app-container">
      <Navigation
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isManager={isManager}
      />
      <main className="main-content">
        {currentPage === 'dashboard' && <Dashboard user={user} onNavigate={setCurrentPage} />}
        {currentPage === 'employees' && <Employees user={user} />}
        {currentPage === 'reviews' && <Reviews user={user} canCreate={canCreateReviews} />}
        {currentPage === 'review-detail' && <Reviews user={user} canCreate={canCreateReviews} viewMode="detail" />}
        {currentPage === 'my-reports' && <EmployeeQuarterlyReport user={user} />}
      </main>
    </div>
  );
}

export default App;
