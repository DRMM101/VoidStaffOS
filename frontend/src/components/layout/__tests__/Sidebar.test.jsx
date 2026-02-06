// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Sidebar Component Tests
 * Tests for sidebar rendering, navigation, role-based visibility,
 * and prop-driven collapse behaviour.
 * Note: collapsed state is now managed by AppShell and passed via props.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';

/* Default props for all tests — collapsed=false (expanded) */
const defaultProps = {
  currentPage: 'dashboard',
  onNavigate: vi.fn(),
  onLogout: vi.fn(),
  isAdmin: true,
  isManager: false,
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  mobileOpen: false,
  onMobileClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidebar', () => {
  it('renders all expected nav items for admin user', () => {
    render(<Sidebar {...defaultProps} />);
    /* Admin should see all items including Settings */
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();
    expect(screen.getByText('Leave')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Compensation')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('hides Compliance and Settings for regular employee', () => {
    render(<Sidebar {...defaultProps} isAdmin={false} isManager={false} />);
    expect(screen.queryByText('Compliance')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows Compliance for manager but hides Settings', () => {
    render(<Sidebar {...defaultProps} isAdmin={false} isManager={true} />);
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('calls onNavigate when a nav item is clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('People'));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('employees');
  });

  it('calls onLogout when logout button is clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Logout'));
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  it('marks active page with aria-current', () => {
    render(<Sidebar {...defaultProps} currentPage="employees" />);
    const activeButton = screen.getByText('People').closest('button');
    expect(activeButton).toHaveAttribute('aria-current', 'page');
  });

  it('shows brand text when expanded (collapsed=false)', () => {
    render(<Sidebar {...defaultProps} collapsed={false} />);
    expect(screen.getByText('StaffOS')).toBeInTheDocument();
  });

  it('hides brand text when collapsed (collapsed=true)', () => {
    render(<Sidebar {...defaultProps} collapsed={true} />);
    /* Brand and labels hidden when collapsed */
    expect(screen.queryByText('StaffOS')).not.toBeInTheDocument();
  });

  it('calls onToggleCollapsed when toggle button is clicked', () => {
    render(<Sidebar {...defaultProps} collapsed={false} />);
    const toggleBtn = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(toggleBtn);
    /* AppShell's onToggleCollapsed should be called */
    expect(defaultProps.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('calls onMobileClose when navigating on mobile', () => {
    render(<Sidebar {...defaultProps} mobileOpen={true} />);
    fireEvent.click(screen.getByText('People'));
    expect(defaultProps.onMobileClose).toHaveBeenCalled();
  });
});
