/**
 * VoidStaffOS - Dashboard Component
 * Main user dashboard with navigation tiles.
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import SelfReflectionForm from './SelfReflectionForm';
import LeaveRequest from './LeaveRequest';
import MyLeaveRequests from './MyLeaveRequests';
import ManagerLeaveApprovals from './ManagerLeaveApprovals';
import NotificationBell from './NotificationBell';
import Notifications from './Notifications';
import OnboardingDashboard from './OnboardingDashboard';
import PreColleaguePortal from './PreColleaguePortal';
import RecruitmentDashboard from './RecruitmentDashboard';
import RecruitmentRequestForm from './RecruitmentRequestForm';
import MyRecruitmentRequests from './MyRecruitmentRequests';
import RecruitmentApprovals from './RecruitmentApprovals';
import TeamPerformance from './TeamPerformance';
import StatCard from './layout/StatCard';
import PendingFeedback from './PendingFeedback';
import QuarterlyFeedbackDashboard from './QuarterlyFeedbackDashboard';
import QuarterlyCompositeView from './QuarterlyCompositeView';

function TrafficLight({ status }) {
  if (!status) return <span className="traffic-light neutral"></span>;
  return <span className={`traffic-light ${status}`}></span>;
}

function getMetricStatus(value) {
  if (value == null) return null;
  if (value < 5) return 'red';
  if (value < 6.5) return 'amber';
  return 'green';
}

function getStatusEmoji(status) {
  if (status === 'green') return '\u{1F7E2}';
  if (status === 'amber') return '\u{1F7E0}';
  if (status === 'red') return '\u{1F534}';
  return '';
}

function calculateVelocity(review) {
  const { tasks_completed, work_volume, problem_solving } = review;
  if (tasks_completed == null || work_volume == null || problem_solving == null) return null;
  return Math.round((tasks_completed + work_volume + problem_solving) / 3 * 100) / 100;
}

function calculateFriction(review) {
  const velocity = calculateVelocity(review);
  if (velocity == null || review.communication == null) return null;
  return Math.round((velocity + review.communication) / 2 * 100) / 100;
}

function calculateCohesion(review) {
  const { problem_solving, communication, leadership } = review;
  if (problem_solving == null || communication == null || leadership == null) return null;
  return Math.round((problem_solving + communication + leadership) / 3 * 100) / 100;
}

// Get the most recent Friday
function getMostRecentFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 5 ? 0 : (day < 5 ? day + 2 : day - 5);
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

// Get reflection status based on day of week
function getReflectionUrgency() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const isFriday = dayOfWeek === 5;

  if (isFriday) {
    return { color: 'green', text: 'Due Today' };
  }

  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    return { color: 'amber', text: 'Due This Week' };
  }

  // Weekend
  return { color: 'red', text: 'Overdue' };
}

// Calculate delta between two values
function getDelta(selfValue, managerValue) {
  if (selfValue == null || managerValue == null) return null;
  const delta = selfValue - managerValue;
  if (Math.abs(delta) < 0.01) return { value: 0, text: 'Same' };
  if (delta > 0) return { value: delta, text: `+${delta.toFixed(2)} higher` };
  return { value: delta, text: `${delta.toFixed(2)} lower` };
}

function KPIComparison({ label, selfValue, managerValue }) {
  const selfStatus = getMetricStatus(selfValue);
  const managerStatus = getMetricStatus(managerValue);
  const delta = getDelta(selfValue, managerValue);

  return (
    <div className="kpi-comparison-item">
      <div className="kpi-comparison-label">{label}</div>
      <div className="kpi-comparison-values">
        <div className="kpi-comparison-row">
          <span className="comparison-label">Manager:</span>
          <span className="comparison-value">
            {managerValue ?? '-'} {getStatusEmoji(managerStatus)}
          </span>
        </div>
        <div className="kpi-comparison-row">
          <span className="comparison-label">You:</span>
          <span className="comparison-value">
            {selfValue ?? '-'} {getStatusEmoji(selfStatus)}
          </span>
        </div>
        {delta && delta.value !== 0 && (
          <div className={`kpi-delta ${delta.value > 0 ? 'higher' : 'lower'}`}>
            {delta.text}
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ user, onNavigate }) {
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState(null);
  const [showReflectionForm, setShowReflectionForm] = useState(false);
  const [myReflectionStatus, setMyReflectionStatus] = useState(null);
  const [currentWeekFriday, setCurrentWeekFriday] = useState(getMostRecentFriday());

  // Leave-related state
  const [showLeaveRequest, setShowLeaveRequest] = useState(false);
  const [showMyLeave, setShowMyLeave] = useState(false);
  const [showLeaveApprovals, setShowLeaveApprovals] = useState(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [myLeaveBalance, setMyLeaveBalance] = useState(null);

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPreColleaguePortal, setShowPreColleaguePortal] = useState(false);

  // Recruitment state
  const [showRecruitmentDashboard, setShowRecruitmentDashboard] = useState(false);
  const [showRecruitmentRequest, setShowRecruitmentRequest] = useState(false);
  const [showMyRecruitmentRequests, setShowMyRecruitmentRequests] = useState(false);
  const [showRecruitmentApprovals, setShowRecruitmentApprovals] = useState(false);
  const [pendingRecruitmentApprovals, setPendingRecruitmentApprovals] = useState(0);

  // 360 Feedback state
  const [showPendingFeedback, setShowPendingFeedback] = useState(false);
  const [showFeedbackDashboard, setShowFeedbackDashboard] = useState(false);
  const [showCompositeView, setShowCompositeView] = useState(false);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

  // Policy state
  const [policyStats, setPolicyStats] = useState(null);

  // Document state
  const [documentStats, setDocumentStats] = useState(null);

  // Internal opportunities — full list for ticker + count for stat card
  const [openOpportunities, setOpenOpportunities] = useState([]);

  // Ticker announcements — urgent/pinned published announcements
  const [tickerAnnouncements, setTickerAnnouncements] = useState([]);

  const isManager = user.role_name === 'Manager' || user.role_name === 'Admin';
  const isAdmin = user.role_name === 'Admin';
  const isHR = user.role_name === 'HR Manager' || user.role_name === 'Admin';

  useEffect(() => {
    fetchMyLatestSnapshot();
    fetchMyReflectionStatus();
    fetchMyLeaveBalance();
    fetchUnreadNotifications();
    checkOverdueSnapshots();
    fetchPendingFeedbackCount();
    fetchPolicyStats();
    fetchDocumentStats();
    fetchOpenOpportunities();
    fetchTickerAnnouncements();
    if (isManager) {
      fetchTeamStats();
      fetchPendingLeaveCount();
      fetchPendingRecruitmentApprovals();
    }
  }, [user.id]);

  const fetchPendingFeedbackCount = async () => {
    try {
      const response = await fetch('/api/feedback/pending', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setPendingFeedbackCount(data.pending_feedback?.length || 0);
      }
    } catch (err) {
      console.error('Failed to fetch pending feedback count');
    }
  };

  const fetchPolicyStats = async () => {
    try {
      const response = await fetch('/api/policies/my-stats', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setPolicyStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch policy stats');
    }
  };

  const fetchDocumentStats = async () => {
    try {
      const response = await fetch('/api/documents/my-stats', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setDocumentStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch document stats');
    }
  };

  /* Fetch open internal opportunities (full list for ticker banner) */
  const fetchOpenOpportunities = async () => {
    try {
      const response = await fetch('/api/opportunities', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setOpenOpportunities(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch open opportunities');
    }
  };

  /* Fetch urgent/pinned announcements for the ticker banner */
  const fetchTickerAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements/ticker', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setTickerAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Failed to fetch ticker announcements');
    }
  };

  const fetchPendingRecruitmentApprovals = async () => {
    try {
      const response = await fetch('/api/recruitment/my-approvals', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setPendingRecruitmentApprovals(data.pending_approvals?.length || 0);
      }
    } catch (err) {
      console.error('Failed to fetch pending recruitment approvals');
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setUnreadNotificationCount(data.unread_count);
      }
    } catch (err) {
      console.error('Failed to fetch unread notifications');
    }
  };

  const checkOverdueSnapshots = async () => {
    try {
      await apiFetch('/api/notifications/check-overdue', {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to check overdue snapshots');
    }
  };

  const fetchMyLatestSnapshot = async () => {
    try {
      const response = await fetch('/api/reviews/my-latest', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok && data.review) {
        setLatestSnapshot(data.review);
      }
    } catch (err) {
      console.error('Failed to fetch latest snapshot');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyReflectionStatus = async () => {
    try {
      const response = await fetch('/api/reviews/my-reflection-status', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setMyReflectionStatus(data);
        setCurrentWeekFriday(data.current_week_friday);
      }
    } catch (err) {
      console.error('Failed to fetch reflection status');
    }
  };

  const fetchTeamStats = async () => {
    try {
      const response = await fetch('/api/users/my-team', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setTeamStats({
          totalEmployees: data.employees?.length || 0,
          employees: data.employees || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch team stats');
    }
  };

  const fetchMyLeaveBalance = async () => {
    try {
      const response = await fetch('/api/leave/my-balance', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setMyLeaveBalance(data.balance);
      }
    } catch (err) {
      console.error('Failed to fetch leave balance');
    }
  };

  const fetchPendingLeaveCount = async () => {
    try {
      const response = await fetch('/api/leave/pending-count', {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setPendingLeaveCount(data.pending_count);
      }
    } catch (err) {
      console.error('Failed to fetch pending leave count');
    }
  };

  const handleReflectionSubmit = async (formData) => {
    try {
      // Create the self-reflection
      const createResponse = await apiFetch('/api/reviews/self-reflection', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const createData = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createData.error);
      }

      // Commit the self-reflection immediately
      const commitResponse = await apiFetch(`/api/reviews/self-reflection/${createData.review.id}/commit`, {
        method: 'POST'
      });

      const commitData = await commitResponse.json();
      if (!commitResponse.ok) {
        throw new Error(commitData.error);
      }

      setShowReflectionForm(false);
      fetchMyLatestSnapshot();
      fetchMyReflectionStatus();
    } catch (err) {
      throw err;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatWeekEnding = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const velocity = latestSnapshot ? calculateVelocity(latestSnapshot) : null;
  const friction = latestSnapshot ? calculateFriction(latestSnapshot) : null;
  const cohesion = latestSnapshot ? calculateCohesion(latestSnapshot) : null;

  const reflectionUrgency = getReflectionUrgency();

  // Determine reflection state
  const hasReflection = myReflectionStatus?.has_current_week_reflection;
  const selfCommitted = myReflectionStatus?.self_committed;
  const managerCommitted = myReflectionStatus?.manager_committed;
  const bothCommitted = myReflectionStatus?.both_committed;

  // Get KPI data for comparison (only available when both committed)
  const selfReflection = myReflectionStatus?.self_reflection;
  const managerReview = myReflectionStatus?.manager_review;

  /**
   * Format a salary value as a compact GBP string.
   * e.g. 28000 → "£28k", 32500 → "£32.5k"
   */
  const formatSalary = (val) => {
    if (!val) return null;
    const k = val / 1000;
    return `£${k % 1 === 0 ? k : k.toFixed(1)}k`;
  };

  /**
   * Format an ISO date string into a short date for the ticker.
   * e.g. "2026-02-01T00:00:00Z" → "1 Feb"
   */
  const formatTickerDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return null;
    }
  };

  /* ---- Ticker scrolling via JS (requestAnimationFrame) ---- */
  const tickerRef = useRef(null);    // the scrolling track element
  const rafRef = useRef(null);       // animation frame id
  const posRef = useRef(0);          // current x offset in pixels
  const pausedRef = useRef(false);   // true while user hovers
  const speedPx = 0.8;              // pixels per frame (~48 px/s at 60fps)

  // Combine opportunities + announcements into unified ticker items
  const tickerItems = [
    ...openOpportunities.map(opp => ({ type: 'opportunity', ...opp })),
    ...tickerAnnouncements.map(ann => ({ type: 'announcement', ...ann }))
  ];

  useEffect(() => {
    const track = tickerRef.current;
    if (!track || tickerItems.length === 0) return;

    const step = () => {
      if (!pausedRef.current) {
        posRef.current -= speedPx;
        // When we've scrolled past the first copy, reset seamlessly
        const halfWidth = track.scrollWidth / 2;
        if (Math.abs(posRef.current) >= halfWidth) {
          posRef.current = 0;
        }
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    // Cleanup on unmount or when items change
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [openOpportunities, tickerAnnouncements]);

  return (
    <div className="dashboard-content">
      {/* Ticker tape banner — scrolling opportunities + urgent/pinned announcements */}
      {tickerItems.length > 0 && (
        <div
          className="ticker-banner"
          role="marquee"
          aria-label="Updates and opportunities"
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => { pausedRef.current = false; }}
        >
          <div className="ticker-banner__track" ref={tickerRef}>
            {/* Duplicate the items so the loop is seamless */}
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <span
                className="ticker-banner__item"
                key={`${item.type}-${item.id}-${idx}`}
                onClick={() => onNavigate(item.type === 'announcement' ? 'announcements' : 'opportunities')}
              >
                {/* Opportunity items show title + salary */}
                {item.type === 'opportunity' && (
                  <>
                    <strong>{item.title}</strong>
                    {item.show_salary && item.salary_range_min && item.salary_range_max && (
                      <span className="ticker-salary">
                        {formatSalary(item.salary_range_min)}–{formatSalary(item.salary_range_max)}
                      </span>
                    )}
                    {item.posted_at && (
                      <span className="ticker-date">
                        Posted {formatTickerDate(item.posted_at)}
                      </span>
                    )}
                  </>
                )}

                {/* Announcement items show category badge + title + NEW if unread */}
                {item.type === 'announcement' && (
                  <>
                    <span className={`ticker-badge ticker-badge--${item.category === 'urgent' ? 'red' : 'teal'}`}>
                      {item.category}
                    </span>
                    <strong>{item.title}</strong>
                    {!item.read && (
                      <span className="ticker-new">NEW</span>
                    )}
                  </>
                )}

                <span className="ticker-separator" aria-hidden="true">&#x2022;</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="welcome-card">
        <div className="welcome-header">
          <h2>Welcome, {user.full_name}!</h2>
          <NotificationBell onViewAll={() => setShowNotifications(true)} onNavigate={onNavigate} />
        </div>
        <div className="user-info">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role_name}</p>
        </div>

        {/* Pending Actions Summary */}
        {(pendingLeaveCount > 0 || (!hasReflection && !selfCommitted) || unreadNotificationCount > 0) && (
          <div className="pending-actions-summary">
            <span className="pending-actions-label">Pending Actions:</span>
            {!hasReflection && !selfCommitted && (
              <span className="pending-action-item reflection">
                Weekly reflection due
              </span>
            )}
            {isManager && pendingLeaveCount > 0 && (
              <span className="pending-action-item leave">
                {pendingLeaveCount} leave request{pendingLeaveCount !== 1 ? 's' : ''} awaiting approval
              </span>
            )}
            {unreadNotificationCount > 0 && (
              <span className="pending-action-item notifications">
                {unreadNotificationCount} unread notification{unreadNotificationCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        <div className="quick-actions">
          <button onClick={() => setShowLeaveRequest(true)} className="quick-action-btn leave-btn">
            Request Leave
          </button>
          <button onClick={() => setShowMyLeave(true)} className="quick-action-btn">
            My Leave ({myLeaveBalance?.remaining ?? '-'} days)
          </button>
          {isManager && (
            <button
              onClick={() => setShowLeaveApprovals(true)}
              className={`quick-action-btn approvals-btn ${pendingLeaveCount > 0 ? 'has-pending' : ''}`}
            >
              Leave Approvals
              {pendingLeaveCount > 0 && (
                <span className="pending-badge">{pendingLeaveCount}</span>
              )}
            </button>
          )}
          {isHR && (
            <button
              onClick={() => setShowOnboarding(true)}
              className="quick-action-btn onboarding-btn"
            >
              Onboarding
            </button>
          )}
          {isHR && (
            <button
              onClick={() => setShowRecruitmentDashboard(true)}
              className="quick-action-btn recruitment-btn"
            >
              Recruitment Pipeline
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setShowRecruitmentRequest(true)}
              className="quick-action-btn"
            >
              Request Hire
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setShowMyRecruitmentRequests(true)}
              className="quick-action-btn"
            >
              My Requests
            </button>
          )}
          {isManager && pendingRecruitmentApprovals > 0 && (
            <button
              onClick={() => setShowRecruitmentApprovals(true)}
              className="quick-action-btn approvals-btn has-pending"
            >
              Hire Approvals
              <span className="pending-badge">{pendingRecruitmentApprovals}</span>
            </button>
          )}
          {pendingFeedbackCount > 0 && (
            <button
              onClick={() => setShowPendingFeedback(true)}
              className="quick-action-btn feedback-btn has-pending"
            >
              360 Feedback
              <span className="pending-badge">{pendingFeedbackCount}</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowFeedbackDashboard(true)}
              className="quick-action-btn"
            >
              Feedback Cycles
            </button>
          )}
          <button
            onClick={() => onNavigate('policies')}
            className={`quick-action-btn policy-btn ${policyStats?.pending > 0 ? 'has-pending' : ''}`}
          >
            Policies
            {policyStats?.pending > 0 && (
              <span className="pending-badge">{policyStats.pending}</span>
            )}
          </button>
          <button
            onClick={() => onNavigate('documents')}
            className={`quick-action-btn document-btn ${documentStats?.expiring_soon > 0 ? 'has-warning' : ''}`}
          >
            Documents
            {documentStats?.expiring_soon > 0 && (
              <span className="warning-badge">{documentStats.expiring_soon}</span>
            )}
          </button>
        </div>

        {/* Policy Summary Card */}
        {policyStats && (
          <div className="policy-summary-card">
            <div className="policy-summary-header">
              <span className="policy-icon">&#128220;</span>
              <span className="policy-title">Policy Compliance</span>
            </div>
            <div className="policy-stats-row">
              <div className="policy-stat">
                <span className="stat-value">{policyStats.acknowledged}</span>
                <span className="stat-label">Acknowledged</span>
              </div>
              <div className="policy-stat pending">
                <span className="stat-value">{policyStats.pending}</span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="policy-stat">
                <span className="stat-value">{policyStats.compliance_rate}%</span>
                <span className="stat-label">Compliance</span>
              </div>
            </div>
            {policyStats.upcoming_renewals?.length > 0 && (
              <div className="upcoming-renewals">
                <span className="renewal-label">Upcoming renewals:</span>
                {policyStats.upcoming_renewals.slice(0, 2).map(r => (
                  <span key={r.id} className="renewal-item">
                    {r.title} - {new Date(r.next_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Document Summary Card */}
        {documentStats && (
          <div className="document-summary-card">
            <div className="document-summary-header">
              <span className="document-icon">&#128196;</span>
              <span className="document-title">My Documents</span>
            </div>
            <div className="document-stats-row">
              <div className="document-stat">
                <span className="stat-value">{documentStats.active || 0}</span>
                <span className="stat-label">Active</span>
              </div>
              <div className={`document-stat ${documentStats.expiring_soon > 0 ? 'warning' : ''}`}>
                <span className="stat-value">{documentStats.expiring_soon || 0}</span>
                <span className="stat-label">Expiring Soon</span>
              </div>
              <div className={`document-stat ${documentStats.expired > 0 ? 'expired' : ''}`}>
                <span className="stat-value">{documentStats.expired || 0}</span>
                <span className="stat-label">Expired</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout: main content left, stat cards right */}
      <div className="dashboard-layout">
        {/* Left column — main content cards */}
        <div className="dashboard-layout__main">

      {/* My Weekly Reflection Card */}
      <div className="dashboard-card reflection-card">
        <div className="card-header">
          <h3>My Weekly Reflection</h3>
          <span className="week-ending-label">
            Week ending: {formatWeekEnding(currentWeekFriday)}
          </span>
        </div>

        {/* State 1: Both committed - Show KPI comparison */}
        {bothCommitted && selfReflection && managerReview ? (
          <div className="reflection-complete">
            <div className="reflection-status-badge complete">
              <span className="status-icon">&#10003;</span>
              Week Complete
            </div>

            <div className="kpi-comparison-section">
              <h4>Performance Comparison</h4>
              <p className="comparison-subtitle">Manager's assessment vs your self-reflection</p>

              <div className="kpi-comparison-grid">
                <KPIComparison
                  label="Velocity"
                  selfValue={calculateVelocity(selfReflection)}
                  managerValue={calculateVelocity(managerReview)}
                />
                <KPIComparison
                  label="Friction"
                  selfValue={calculateFriction(selfReflection)}
                  managerValue={calculateFriction(managerReview)}
                />
                <KPIComparison
                  label="Cohesion"
                  selfValue={calculateCohesion(selfReflection)}
                  managerValue={calculateCohesion(managerReview)}
                />
              </div>
            </div>
          </div>
        ) : selfCommitted && !managerCommitted ? (
          /* State 2: Employee committed, waiting for manager */
          <div className="reflection-waiting">
            <div className="reflection-status-badge waiting">
              <span className="status-icon">&#8987;</span>
              Waiting for Manager Review
            </div>
            <p className="waiting-message">
              Your self-reflection has been committed. Once your manager commits their weekly review,
              you'll be able to see both assessments and compare KPIs.
            </p>
            <div className="waiting-indicator">
              <div className="commit-status">
                <span className="status-check done">&#10003;</span>
                <span>Your reflection committed</span>
              </div>
              <div className="commit-status">
                <span className="status-check pending">&#8230;</span>
                <span>Manager review pending</span>
              </div>
            </div>
          </div>
        ) : (
          /* State 3: Not started - Show button to start reflection */
          <div className="reflection-pending">
            <p className="reflection-prompt">
              Take a moment to reflect on your week. How did you perform?
            </p>

            {/* Previous quarter context hint */}
            {myReflectionStatus?.previous_quarter_averages && (
              <div className="quarter-context-hint">
                Your {myReflectionStatus.previous_quarter_averages.quarter} averages:
                Velocity {myReflectionStatus.previous_quarter_averages.velocity},
                Friction {myReflectionStatus.previous_quarter_averages.friction},
                Cohesion {myReflectionStatus.previous_quarter_averages.cohesion}
              </div>
            )}

            <button
              onClick={() => setShowReflectionForm(true)}
              className={`reflection-btn ${reflectionUrgency.color}`}
            >
              <span className="reflection-btn-icon">&#x1F4DD;</span>
              Complete This Week's Reflection
              <span className={`status-badge small ${reflectionUrgency.color}`}>
                {reflectionUrgency.text}
              </span>
            </button>

            <p className="blind-hint">
              Your ratings will be hidden until both you and your manager commit.
            </p>
          </div>
        )}
      </div>

      {/* My Performance Section (Manager's review of me) */}
      <div className="dashboard-card my-performance-card">
        <div className="card-header">
          <h3>My Performance</h3>
          {onNavigate && (
            <button
              onClick={() => onNavigate('my-reports')}
              className="view-reports-btn"
            >
              View My Reports
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-small">Loading...</div>
        ) : latestSnapshot ? (
          <div className="performance-content">
            <div className="snapshot-meta">
              <span className="snapshot-date">
                Week ending: {formatDate(latestSnapshot.review_date)}
              </span>
              {latestSnapshot.is_self_assessment ? (
                <span className="snapshot-type self">Self Assessment</span>
              ) : (
                <span className="snapshot-type manager">Manager Review</span>
              )}
            </div>
            <div className="kpi-row">
              <div className="kpi-item">
                <div className="kpi-header">
                  <span className="kpi-label">Velocity</span>
                  <TrafficLight status={getMetricStatus(velocity)} />
                </div>
                <span className="kpi-value">{velocity ?? '-'}</span>
              </div>
              <div className="kpi-item">
                <div className="kpi-header">
                  <span className="kpi-label">Friction</span>
                  <TrafficLight status={getMetricStatus(friction)} />
                </div>
                <span className="kpi-value">{friction ?? '-'}</span>
              </div>
              <div className="kpi-item">
                <div className="kpi-header">
                  <span className="kpi-label">Cohesion</span>
                  <TrafficLight status={getMetricStatus(cohesion)} />
                </div>
                <span className="kpi-value">{cohesion ?? '-'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-data-message">
            <p>No manager performance snapshots yet.</p>
            <p className="hint">Your manager will create snapshots during weekly reviews.</p>
          </div>
        )}
      </div>

      {/* Manager's Team Section */}
      {isManager && teamStats && (
        <div className="dashboard-card team-card">
          <div className="card-header">
            <h3>My Team</h3>
            {onNavigate && (
              <button
                onClick={() => onNavigate('employees')}
                className="view-team-btn"
              >
                Manage Team
              </button>
            )}
          </div>
          <div className="team-content">
            <div className="team-stat">
              <span className="stat-number">{teamStats.totalEmployees}</span>
              <span className="stat-label">Direct Reports</span>
            </div>
            {teamStats.employees.length > 0 && (
              <div className="team-list">
                <h4>Team Members</h4>
                <ul>
                  {teamStats.employees.slice(0, 5).map(emp => (
                    <li key={emp.id}>
                      <span className="emp-name">{emp.full_name}</span>
                      <span className="emp-role">{emp.role_name}</span>
                    </li>
                  ))}
                  {teamStats.employees.length > 5 && (
                    <li className="more-employees">
                      +{teamStats.employees.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Performance Section */}
      {isManager && (
        <TeamPerformance
          user={user}
          onCreateSnapshot={(member) => {
            // Navigate to employee page to create snapshot
            if (onNavigate) {
              onNavigate('employees', { selectedEmployee: member.id });
            }
          }}
          onViewMember={(member) => {
            // Navigate to employee page to view member
            if (onNavigate) {
              onNavigate('employees', { selectedEmployee: member.id });
            }
          }}
        />
      )}

        </div>{/* end dashboard-layout__main */}

        {/* Right column — key stats sidebar */}
        <aside className="dashboard-layout__aside">
          {/* Leave Balance */}
          <StatCard
            label="Leave Balance"
            value={`${myLeaveBalance?.remaining ?? '-'} days`}
            subtitle={myLeaveBalance ? `${myLeaveBalance.used || 0} used of ${myLeaveBalance.entitlement || '-'}` : undefined}
            onClick={() => setShowMyLeave(true)}
          />

          {/* Internal Opportunities */}
          {openOpportunities.length > 0 && (
            <StatCard
              label="Opportunities"
              value={openOpportunities.length}
              subtitle="Open positions"
              trend="up"
              onClick={() => onNavigate('opportunities')}
            />
          )}

          {/* Policy Compliance */}
          {policyStats && (
            <StatCard
              label="Policy Compliance"
              value={`${policyStats.compliance_rate || 0}%`}
              subtitle={policyStats.pending > 0 ? `${policyStats.pending} pending` : 'All acknowledged'}
              trend={policyStats.pending > 0 ? 'down' : 'up'}
              onClick={() => onNavigate('policies')}
            />
          )}

          {/* Documents */}
          {documentStats && (
            <StatCard
              label="Documents"
              value={documentStats.active || 0}
              subtitle={documentStats.expiring_soon > 0 ? `${documentStats.expiring_soon} expiring soon` : 'All current'}
              trend={documentStats.expiring_soon > 0 ? 'down' : 'flat'}
              onClick={() => onNavigate('documents')}
            />
          )}

          {/* Notifications */}
          {unreadNotificationCount > 0 && (
            <StatCard
              label="Notifications"
              value={unreadNotificationCount}
              subtitle="Unread"
              onClick={() => setShowNotifications(true)}
            />
          )}

          {/* Manager: Pending Leave Approvals */}
          {isManager && pendingLeaveCount > 0 && (
            <StatCard
              label="Leave Approvals"
              value={pendingLeaveCount}
              subtitle="Pending"
              onClick={() => setShowLeaveApprovals(true)}
            />
          )}

          {/* Manager: Pending Feedback */}
          {pendingFeedbackCount > 0 && (
            <StatCard
              label="360 Feedback"
              value={pendingFeedbackCount}
              subtitle="Pending requests"
              onClick={() => setShowPendingFeedback(true)}
            />
          )}
        </aside>
      </div>{/* end dashboard-layout */}

      {/* Self-Reflection Form Modal */}
      {showReflectionForm && (
        <SelfReflectionForm
          onSubmit={handleReflectionSubmit}
          onClose={() => setShowReflectionForm(false)}
          previousQuarterAverages={myReflectionStatus?.previous_quarter_averages}
        />
      )}

      {/* Leave Request Modal */}
      {showLeaveRequest && (
        <LeaveRequest
          onClose={() => setShowLeaveRequest(false)}
          onSubmit={() => {
            setShowLeaveRequest(false);
            fetchMyLeaveBalance();
          }}
        />
      )}

      {/* My Leave Requests Modal */}
      {showMyLeave && (
        <MyLeaveRequests
          onClose={() => {
            setShowMyLeave(false);
            fetchMyLeaveBalance();
          }}
        />
      )}

      {/* Manager Leave Approvals Modal */}
      {showLeaveApprovals && (
        <ManagerLeaveApprovals
          user={user}
          onClose={() => {
            setShowLeaveApprovals(false);
            fetchPendingLeaveCount();
          }}
        />
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <Notifications
          onClose={() => {
            setShowNotifications(false);
            fetchUnreadNotifications();
          }}
          onNavigate={onNavigate}
        />
      )}

      {/* Onboarding Dashboard (Admin) */}
      {showOnboarding && (
        <OnboardingDashboard
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {/* Pre-Colleague Portal */}
      {showPreColleaguePortal && (
        <PreColleaguePortal
          user={user}
          onClose={() => setShowPreColleaguePortal(false)}
        />
      )}

      {/* Recruitment Dashboard (HR/Admin) */}
      {showRecruitmentDashboard && (
        <div className="modal-overlay" onClick={() => setShowRecruitmentDashboard(false)}>
          <div className="modal-fullscreen" onClick={e => e.stopPropagation()}>
            <div className="modal-close-bar">
              <button onClick={() => setShowRecruitmentDashboard(false)}>Close</button>
            </div>
            <RecruitmentDashboard />
          </div>
        </div>
      )}

      {/* Recruitment Request Form */}
      {showRecruitmentRequest && (
        <RecruitmentRequestForm
          onClose={() => setShowRecruitmentRequest(false)}
          onSubmit={() => {
            setShowRecruitmentRequest(false);
          }}
        />
      )}

      {/* My Recruitment Requests */}
      {showMyRecruitmentRequests && (
        <MyRecruitmentRequests
          onClose={() => setShowMyRecruitmentRequests(false)}
        />
      )}

      {/* Recruitment Approvals */}
      {showRecruitmentApprovals && (
        <RecruitmentApprovals
          onClose={() => {
            setShowRecruitmentApprovals(false);
            fetchPendingRecruitmentApprovals();
          }}
        />
      )}

      {/* Pending 360 Feedback */}
      {showPendingFeedback && (
        <PendingFeedback
          onClose={() => {
            setShowPendingFeedback(false);
            fetchPendingFeedbackCount();
          }}
        />
      )}

      {/* Quarterly Feedback Dashboard (Admin) */}
      {showFeedbackDashboard && (
        <QuarterlyFeedbackDashboard
          onClose={() => setShowFeedbackDashboard(false)}
        />
      )}

      {/* Quarterly Composite View */}
      {showCompositeView && (
        <QuarterlyCompositeView
          employeeId={user.id}
          quarter={showCompositeView}
          employeeName={user.full_name}
          onClose={() => setShowCompositeView(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
