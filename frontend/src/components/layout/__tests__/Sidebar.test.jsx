// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Sidebar Component Tests
 * Tests for sidebar rendering, collapse/expand, navigation, and role-based visibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';

/* Default props for all tests */
const defaultProps = {
  currentPage: 'dashboard',
  onNavigate: vi.fn(),
  onLogout: vi.fn(),
  isAdmin: true,
  isManager: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Sidebar', () => {
  it('renders all expected nav items for admin user', () => {
    render(<Sidebar {...defaultProps} />);
    // Admin should see all items including Settings
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

  it('shows brand text when expanded', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('StaffOS')).toBeInTheDocument();
  });

  it('hides brand text when collapsed', () => {
    // Set localStorage to collapsed before rendering
    localStorage.setItem('voidstaffos-sidebar-collapsed', 'true');
    render(<Sidebar {...defaultProps} />);
    expect(screen.queryByText('StaffOS')).not.toBeInTheDocument();
  });

  it('toggles collapsed state when toggle button is clicked', () => {
    render(<Sidebar {...defaultProps} />);
    // Initially expanded — brand should be visible
    expect(screen.getByText('StaffOS')).toBeInTheDocument();

    // Click the collapse toggle
    const toggleBtn = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(toggleBtn);

    // Now collapsed — brand hidden, nav labels hidden
    expect(screen.queryByText('StaffOS')).not.toBeInTheDocument();
  });

  it('persists collapsed state to localStorage', () => {
    render(<Sidebar {...defaultProps} />);
    const toggleBtn = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(toggleBtn);

    expect(localStorage.getItem('voidstaffos-sidebar-collapsed')).toBe('true');
  });
});
