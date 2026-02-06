// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — AppShell Component
 * Top-level layout wrapper: sidebar + header bar + content area.
 * Manages sidebar collapsed state and provides layout structure.
 */

import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import Sidebar from './Sidebar';
import Breadcrumb from './Breadcrumb';

/* Storage key — shared with Sidebar so both stay in sync */
const STORAGE_KEY = 'voidstaffos-sidebar-collapsed';

/* Context-aware action button labels per page */
const PAGE_ACTIONS = {
  employees:    { label: 'Add Employee', page: 'employees' },
  'hr-cases':   { label: 'New Case', page: 'hr-cases' },
  absence:      { label: 'Request Leave', page: 'absence' },
  policies:     { label: 'New Policy', page: 'policies' },
  documents:    { label: 'Upload Document', page: 'documents' },
  compliance:   { label: 'Add Check', page: 'compliance' },
  offboarding:  { label: 'Initiate Offboarding', page: 'offboarding' },
  compensation: { label: 'Add Record', page: 'compensation' },
};

function AppShell({
  currentPage,
  onNavigate,
  onLogout,
  isAdmin,
  isManager,
  onActionClick,
  children
}) {
  /* Read initial sidebar state from localStorage */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  /* Get context-aware action button for current page */
  const pageAction = PAGE_ACTIONS[currentPage] || null;

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'app-shell--collapsed' : 'app-shell--expanded'}`}>
      {/* Collapsible sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        isAdmin={isAdmin}
        isManager={isManager}
      />

      {/* Main area: header bar + content */}
      <div className="app-shell__main">
        {/* Sticky header bar */}
        <header className="header-bar">
          {/* Left side: breadcrumb trail */}
          <Breadcrumb currentPage={currentPage} onNavigate={onNavigate} />

          {/* Right side: search + contextual action button */}
          <div className="header-bar__actions">
            {/* Search input placeholder — will trigger Cmd+K palette later */}
            <div className="header-bar__search">
              <Search size={16} className="header-bar__search-icon" aria-hidden="true" />
              <input
                type="text"
                className="header-bar__search-input"
                placeholder="Search... (Ctrl+K)"
                readOnly
                aria-label="Search"
              />
            </div>

            {/* Context-aware action button */}
            {pageAction && onActionClick && (
              <button
                className="header-bar__action-btn"
                onClick={() => onActionClick(pageAction.page)}
                aria-label={pageAction.label}
              >
                <Plus size={16} aria-hidden="true" />
                <span>{pageAction.label}</span>
              </button>
            )}
          </div>
        </header>

        {/* Content area — full remaining width */}
        <main className="app-shell__content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
