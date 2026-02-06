/**
 * VoidStaffOS - Main Application Component
 * Root React component with routing and authentication.
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

import { useState, useEffect } from 'react';
import { apiFetch } from './utils/api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Reviews from './components/Reviews';
import EmployeeQuarterlyReport from './components/EmployeeQuarterlyReport';
import RoleManagement from './components/RoleManagement';
import Policies from './components/Policies';
import Documents from './components/Documents';
import Compliance from './components/Compliance';
import Emergency from './components/Emergency';
import Probation from './components/Probation';
import AbsenceDashboard from './components/AbsenceDashboard';
import InsightsDashboard from './components/InsightsDashboard';
import OffboardingDashboard from './components/OffboardingDashboard';
import HRCasesDashboard from './components/HRCasesDashboard';
import CompensationDashboard from './components/compensation/CompensationDashboard';
import EmployeeSalaryView from './components/compensation/EmployeeSalaryView';
import PayBandManager from './components/compensation/PayBandManager';
import PayReviewWorkflow from './components/compensation/PayReviewWorkflow';
import CompensationReports from './components/compensation/CompensationReports';
import CompensationAuditLog from './components/compensation/CompensationAuditLog';
import BonusSchemeManager from './components/compensation/BonusSchemeManager';
import ResponsibilityAllowanceManager from './components/compensation/ResponsibilityAllowanceManager';
import CompensationSettingsPanel from './components/compensation/CompensationSettingsPanel';
import AppShell from './components/layout/AppShell';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [navParams, setNavParams] = useState(null);

  // Enhanced navigation that supports parameters
  const handleNavigate = (page, params = null) => {
    if (typeof page === 'string') {
      setCurrentPage(page);
      setNavParams(params);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include' // Include session cookie
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (err) {
        // Session invalid or expired
        console.error('Auth check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST'
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
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
    <AppShell
      currentPage={currentPage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      isAdmin={isAdmin}
      isManager={isManager}
    >
      {/* Page routing — each page fills the AppShell content area */}
      {currentPage === 'dashboard' && <Dashboard user={user} onNavigate={handleNavigate} />}
      {currentPage === 'employees' && <Employees user={user} navParams={navParams} />}
      {currentPage === 'reviews' && <Reviews user={user} canCreate={canCreateReviews} />}
      {currentPage === 'review-detail' && <Reviews user={user} canCreate={canCreateReviews} viewMode="detail" />}
      {currentPage === 'my-reports' && <EmployeeQuarterlyReport user={user} />}
      {currentPage === 'policies' && <Policies user={user} />}
      {currentPage === 'documents' && <Documents user={user} />}
      {currentPage === 'emergency' && <Emergency user={user} />}
      {currentPage === 'absence' && <AbsenceDashboard user={user} navParams={navParams} />}
      {currentPage === 'compliance' && (isAdmin || isManager) && <Compliance user={user} />}
      {currentPage === 'probation' && (isAdmin || isManager) && <Probation user={user} />}
      {currentPage === 'insights' && (isAdmin || isManager) && <InsightsDashboard user={user} />}
      {currentPage === 'offboarding' && (isAdmin || isManager) && <OffboardingDashboard user={user} />}
      {currentPage === 'hr-cases' && <HRCasesDashboard user={user} />}
      {/* Compensation sub-pages */}
      {currentPage === 'compensation' && <CompensationDashboard user={user} onNavigate={handleNavigate} />}
      {currentPage === 'compensation-me' && <EmployeeSalaryView user={user} isSelfService={true} />}
      {currentPage === 'compensation-employee' && <EmployeeSalaryView user={user} employeeId={navParams?.employeeId} />}
      {currentPage === 'compensation-pay-bands' && <PayBandManager user={user} />}
      {currentPage === 'compensation-reviews' && <PayReviewWorkflow user={user} />}
      {currentPage === 'compensation-reports' && <CompensationReports user={user} />}
      {currentPage === 'compensation-audit' && <CompensationAuditLog user={user} />}
      {currentPage === 'compensation-bonus-schemes' && <BonusSchemeManager user={user} />}
      {currentPage === 'compensation-allowances' && <ResponsibilityAllowanceManager user={user} />}
      {currentPage === 'compensation-settings' && <CompensationSettingsPanel user={user} />}
      {currentPage === 'role-management' && isAdmin && <RoleManagement user={user} />}
    </AppShell>
  );
}

export default App;
