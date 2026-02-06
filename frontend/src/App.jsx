/**
 * HeadOfficeOS - Main Application Component
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
import AdminSettingsPage from './components/admin/AdminSettingsPage';
import OpportunitiesPage from './components/opportunities/OpportunitiesPage';
import OpportunityDetailPage from './components/opportunities/OpportunityDetailPage';
import MyApplicationsPage from './components/opportunities/MyApplicationsPage';
import OpportunitiesAdminPage from './components/opportunities/OpportunitiesAdminPage';
import ApplicationsReviewPage from './components/opportunities/ApplicationsReviewPage';
import GoalsDashboardPage from './components/goals/GoalsDashboardPage';
import TeamGoalsPage from './components/goals/TeamGoalsPage';
import AnnouncementsPage from './components/announcements/AnnouncementsPage';
import AnnouncementsAdminPage from './components/announcements/AnnouncementsAdminPage';
import GDPRPage from './components/gdpr/GDPRPage';
import GDPRAdminPage from './components/gdpr/GDPRAdminPage';
import OrgChartPage from './components/OrgChartPage';
import SecuritySettingsPage from './components/security/SecuritySettingsPage';
import AdminSecuritySettings from './components/security/AdminSecuritySettings';
import SessionTimeoutWarning from './components/security/SessionTimeoutWarning';
import MFASetupWizard from './components/security/MFASetupWizard';
import AppShell from './components/layout/AppShell';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [navParams, setNavParams] = useState(null);

  // Session timeout in minutes (default 480 = 8hrs, updated from tenant policy on login)
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(480);

  // MFA enforcement — when tenant policy is 'required' and user hasn't set up MFA
  const [forceMfaSetup, setForceMfaSetup] = useState(false);

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

  /**
   * Handle login — set user and check if MFA setup must be forced
   */
  const handleLogin = (userData, securityInfo = {}) => {
    setUser(userData);
    // If tenant MFA policy is 'required' and user hasn't enabled MFA, force setup
    if (securityInfo.mfa_policy === 'required' && !securityInfo.mfa_enabled) {
      setForceMfaSetup(true);
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = user.role_name === 'Admin';
  const isManager = user.role_name === 'Manager';
  const canCreateReviews = isAdmin || isManager;

  // Block access to the app until MFA is set up (tenant policy = required)
  if (forceMfaSetup) {
    return (
      <div className="mfa-force-setup">
        <div className="mfa-force-setup__banner" role="alert">
          Your organisation requires two-factor authentication. Please set up 2FA to continue.
        </div>
        <MFASetupWizard
          onComplete={() => setForceMfaSetup(false)}
          onCancel={handleLogout}
        />
      </div>
    );
  }

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
      {/* Internal Opportunities sub-pages */}
      {currentPage === 'opportunities' && <OpportunitiesPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'opportunity-detail' && <OpportunityDetailPage user={user} opportunityId={navParams?.opportunityId} onNavigate={handleNavigate} />}
      {currentPage === 'my-applications' && <MyApplicationsPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'opportunities-admin' && (isAdmin || isManager) && <OpportunitiesAdminPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'applications-review' && (isAdmin || isManager) && <ApplicationsReviewPage user={user} opportunityId={navParams?.opportunityId} onNavigate={handleNavigate} />}
      {/* Goals pages */}
      {currentPage === 'goals' && <GoalsDashboardPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'team-goals' && (isAdmin || isManager) && <TeamGoalsPage user={user} onNavigate={handleNavigate} />}
      {/* Announcements pages */}
      {currentPage === 'announcements' && <AnnouncementsPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'announcements-admin' && isAdmin && <AnnouncementsAdminPage user={user} onNavigate={handleNavigate} />}
      {/* GDPR pages */}
      {currentPage === 'gdpr' && <GDPRPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'gdpr-admin' && (isAdmin || user.role_name === 'HR Manager') && <GDPRAdminPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'org-chart' && (isAdmin || isManager) && <OrgChartPage user={user} onNavigate={handleNavigate} />}
      {/* Security pages — accessible to all users */}
      {currentPage === 'security' && <SecuritySettingsPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'admin-security' && isAdmin && <AdminSecuritySettings user={user} onNavigate={handleNavigate} />}
      {currentPage === 'settings' && isAdmin && <AdminSettingsPage user={user} onNavigate={handleNavigate} />}
      {currentPage === 'role-management' && isAdmin && <RoleManagement user={user} />}

      {/* Session timeout warning — rendered globally, auto-logs out on expiry */}
      <SessionTimeoutWarning
        timeoutMinutes={sessionTimeoutMinutes}
        onLogout={handleLogout}
      />
    </AppShell>
  );
}

export default App;
