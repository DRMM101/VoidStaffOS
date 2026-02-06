// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — AppShell Component Tests
 * Tests for the overall layout shell: sidebar, header, and content area.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppShell from '../AppShell';

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

describe('AppShell', () => {
  it('renders sidebar navigation', () => {
    render(<AppShell {...defaultProps}><div>Content</div></AppShell>);
    // Sidebar should contain nav items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
  });

  it('renders breadcrumb in header bar', () => {
    render(<AppShell {...defaultProps} currentPage="employees"><div>Content</div></AppShell>);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
  });

  it('renders children in content area', () => {
    render(
      <AppShell {...defaultProps}>
        <div data-testid="page-content">Hello World</div>
      </AppShell>
    );
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders search input placeholder', () => {
    render(<AppShell {...defaultProps}><div>Content</div></AppShell>);
    expect(screen.getByPlaceholderText('Search... (Ctrl+K)')).toBeInTheDocument();
  });

  it('renders Logout button in sidebar', () => {
    render(<AppShell {...defaultProps}><div>Content</div></AppShell>);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('has correct aria-label on sidebar', () => {
    render(<AppShell {...defaultProps}><div>Content</div></AppShell>);
    expect(screen.getByLabelText('Main navigation')).toBeInTheDocument();
  });
});
