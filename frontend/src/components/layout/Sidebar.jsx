// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Sidebar Component
 * Collapsible sidebar navigation with icons and labels.
 * Collapsed state is managed by AppShell (single source of truth)
 * and passed down via props.
 */

import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarOff,
  FileText,
  PoundSterling,
  ShieldCheck,
  BarChart3,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';

/* Map page keys to sidebar nav items with icons and labels */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'employees', label: 'People', icon: Users },
  { key: 'hr-cases', label: 'Cases', icon: Briefcase },
  { key: 'absence', label: 'Leave', icon: CalendarOff },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'compensation', label: 'Compensation', icon: PoundSterling },
  { key: 'opportunities', label: 'Opportunities', icon: Megaphone },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'reviews', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function Sidebar({ currentPage, onNavigate, onLogout, isAdmin, isManager, collapsed, onToggleCollapsed, mobileOpen, onMobileClose }) {

  /* Determine which nav items to show based on user role */
  const visibleItems = NAV_ITEMS.filter((item) => {
    // Compliance is admin/manager only
    if (item.key === 'compliance' && !isAdmin && !isManager) return false;
    // Settings is admin only
    if (item.key === 'settings' && !isAdmin) return false;
    // Compensation placeholder — show for all (will be gated on backend)
    return true;
  });

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar--collapsed' : 'sidebar--expanded'} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}
      aria-label="Main navigation"
    >
      {/* Logo / hamburger toggle area */}
      <div className="sidebar__header">
        <button
          className="sidebar__toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
        {/* Show brand text only when expanded */}
        {!collapsed && <span className="sidebar__brand">StaffOS</span>}
      </div>

      {/* Navigation items */}
      <nav className="sidebar__nav" role="navigation">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.key;

          return (
            <button
              key={item.key}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => { onNavigate(item.key); if (onMobileClose) onMobileClose(); }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator bar (left accent) */}
              {isActive && <span className="sidebar__accent-bar" aria-hidden="true" />}
              <Icon size={20} className="sidebar__icon" aria-hidden="true" />
              {/* Label hidden when collapsed */}
              {!collapsed && <span className="sidebar__label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Logout button at bottom */}
      <div className="sidebar__footer">
        <button
          className="sidebar__item sidebar__item--logout"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={20} className="sidebar__icon" aria-hidden="true" />
          {!collapsed && <span className="sidebar__label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
