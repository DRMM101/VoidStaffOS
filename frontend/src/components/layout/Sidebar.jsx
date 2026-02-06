// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Sidebar Component
 * Collapsible sidebar navigation with icons and labels.
 * Stores collapsed/expanded preference in localStorage.
 */

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarOff,
  FileText,
  PoundSterling,
  ShieldCheck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu
} from 'lucide-react';

/* Map page keys to sidebar nav items with icons and labels */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'employees', label: 'People', icon: Users },
  { key: 'hr-cases', label: 'Cases', icon: Briefcase },
  { key: 'absence', label: 'Leave', icon: CalendarOff },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'compensation', label: 'Compensation', icon: PoundSterling },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'reviews', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

/* Storage key for sidebar collapsed state */
const STORAGE_KEY = 'voidstaffos-sidebar-collapsed';

function Sidebar({ currentPage, onNavigate, onLogout, isAdmin, isManager }) {
  /* Read saved preference or default to expanded */
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  /* Persist collapsed state to localStorage whenever it changes */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [collapsed]);

  /* Toggle sidebar collapsed/expanded */
  const toggleCollapsed = () => setCollapsed((prev) => !prev);

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
      className={`sidebar ${collapsed ? 'sidebar--collapsed' : 'sidebar--expanded'}`}
      aria-label="Main navigation"
    >
      {/* Logo / hamburger toggle area */}
      <div className="sidebar__header">
        <button
          className="sidebar__toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
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
              onClick={() => onNavigate(item.key)}
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
