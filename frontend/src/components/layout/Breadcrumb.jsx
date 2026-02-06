// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Breadcrumb Component
 * Auto-generates breadcrumb trail from the current route/page key.
 * Supports clickable crumbs for navigation.
 */

import { ChevronRight, Home } from 'lucide-react';

/* Map section labels to their parent navigation page key */
const SECTION_NAV = {
  'Compensation': 'compensation',
  'People': 'employees',
  'Leave': 'absence',
  'Company': 'policies',
  'Admin': 'dashboard',
  'Cases': 'hr-cases',
  'Opportunities': 'opportunities',
  'Goals': 'goals',
  'Announcements': 'announcements',
  'My Data': 'gdpr',
  'Security': 'security',
};

/* Map page keys to breadcrumb metadata: section and display label */
const PAGE_MAP = {
  dashboard:        { section: null, label: 'Dashboard' },
  employees:        { section: 'People', label: 'Employees' },
  reviews:          { section: 'People', label: 'Snapshots' },
  'review-detail':  { section: 'People', label: 'Review Detail' },
  'my-reports':     { section: 'People', label: 'My Reports' },
  absence:          { section: 'Leave', label: 'Absence Dashboard' },
  policies:         { section: 'Company', label: 'Policies' },
  documents:        { section: 'Company', label: 'Documents' },
  emergency:        { section: 'Company', label: 'Emergency Info' },
  compliance:       { section: 'Admin', label: 'Compliance' },
  probation:        { section: 'Admin', label: 'Probation' },
  insights:         { section: 'Admin', label: 'Absence Insights' },
  offboarding:      { section: 'Admin', label: 'Offboarding' },
  'hr-cases':       { section: 'Cases', label: 'HR Cases' },
  'role-management':{ section: 'Admin', label: 'Roles' },
  compensation:             { section: null, label: 'Compensation' },
  'compensation-me':        { section: 'Compensation', label: 'My Compensation' },
  'compensation-employee':  { section: 'Compensation', label: 'Employee Compensation' },
  'compensation-pay-bands': { section: 'Compensation', label: 'Pay Bands' },
  'compensation-reviews':   { section: 'Compensation', label: 'Pay Reviews' },
  'compensation-reports':   { section: 'Compensation', label: 'Reports' },
  'compensation-audit':     { section: 'Compensation', label: 'Audit Log' },
  'compensation-bonus-schemes': { section: 'Compensation', label: 'Bonus Schemes' },
  'compensation-allowances':    { section: 'Compensation', label: 'Responsibility Allowances' },
  'compensation-settings':      { section: 'Compensation', label: 'Settings' },
  opportunities:            { section: null, label: 'Opportunities' },
  'opportunity-detail':     { section: 'Opportunities', label: 'Opportunity Detail' },
  'my-applications':        { section: 'Opportunities', label: 'My Applications' },
  'opportunities-admin':    { section: 'Opportunities', label: 'Manage Opportunities' },
  'applications-review':    { section: 'Opportunities', label: 'Review Applications' },
  settings:                 { section: 'Admin', label: 'Settings' },
  goals:                    { section: null, label: 'Goals' },
  'team-goals':             { section: 'Goals', label: 'Team Goals' },
  announcements:            { section: null, label: 'Announcements' },
  'announcements-admin':    { section: 'Announcements', label: 'Manage Announcements' },
  gdpr:                     { section: null, label: 'My Data' },
  'gdpr-admin':             { section: 'My Data', label: 'Data Requests' },
  security:                 { section: null, label: 'Security' },
  'admin-security':         { section: 'Admin', label: 'Security' },
  'org-chart':              { section: 'People', label: 'Org Chart' },
};

function Breadcrumb({ currentPage, onNavigate }) {
  /* Build breadcrumb crumbs array from page map */
  const pageInfo = PAGE_MAP[currentPage] || { section: null, label: currentPage };
  const crumbs = [];

  // Home crumb is always first
  crumbs.push({ key: 'dashboard', label: 'Home', icon: Home });

  // Section crumb if the page belongs to a section group
  if (pageInfo.section) {
    crumbs.push({ key: SECTION_NAV[pageInfo.section] || null, label: pageInfo.section });
  }

  // Current page crumb (not clickable — it's the active page)
  if (currentPage !== 'dashboard') {
    crumbs.push({ key: null, label: pageInfo.label, active: true });
  }

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb__list">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const Icon = crumb.icon;

          return (
            <li key={index} className="breadcrumb__item">
              {/* Separator between crumbs */}
              {index > 0 && (
                <ChevronRight size={14} className="breadcrumb__separator" aria-hidden="true" />
              )}

              {/* Clickable crumb or plain text for current page */}
              {crumb.key && !isLast ? (
                <button
                  className="breadcrumb__link"
                  onClick={() => onNavigate(crumb.key)}
                  aria-label={`Go to ${crumb.label}`}
                >
                  {Icon && <Icon size={14} className="breadcrumb__icon" aria-hidden="true" />}
                  <span>{crumb.label}</span>
                </button>
              ) : (
                <span
                  className={`breadcrumb__text ${isLast ? 'breadcrumb__text--active' : ''}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {Icon && <Icon size={14} className="breadcrumb__icon" aria-hidden="true" />}
                  <span>{crumb.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
