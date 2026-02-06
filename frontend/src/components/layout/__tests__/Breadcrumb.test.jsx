// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Breadcrumb Component Tests
 * Tests for breadcrumb trail generation and navigation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Breadcrumb from '../Breadcrumb';

describe('Breadcrumb', () => {
  it('renders Home as the only crumb for dashboard page', () => {
    render(<Breadcrumb currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    // No separator should appear for single crumb
    expect(screen.queryByText('Employees')).not.toBeInTheDocument();
  });

  it('renders section + page crumbs for a nested page', () => {
    render(<Breadcrumb currentPage="employees" onNavigate={vi.fn()} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
  });

  it('navigates to dashboard when Home crumb is clicked', () => {
    const onNavigate = vi.fn();
    render(<Breadcrumb currentPage="employees" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Go to Home'));
    expect(onNavigate).toHaveBeenCalledWith('dashboard');
  });

  it('marks the last crumb as active with aria-current', () => {
    render(<Breadcrumb currentPage="compliance" onNavigate={vi.fn()} />);
    const activeCrumb = screen.getByText('Compliance');
    expect(activeCrumb.closest('[aria-current="page"]')).toBeInTheDocument();
  });

  it('renders correct breadcrumb for absence page', () => {
    render(<Breadcrumb currentPage="absence" onNavigate={vi.fn()} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Leave')).toBeInTheDocument();
    expect(screen.getByText('Absence Dashboard')).toBeInTheDocument();
  });
});
