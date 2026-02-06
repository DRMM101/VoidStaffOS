// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — PageHeader Component Tests
 * Tests for page header rendering with title, subtitle, and actions.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from '../PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Employees" />);
    expect(screen.getByText('Employees')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Dashboard" subtitle="Welcome back" />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('does not render subtitle element when not provided', () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.querySelector('.page-header__subtitle')).toBeNull();
  });

  it('renders action buttons when provided', () => {
    render(
      <PageHeader
        title="People"
        actions={<button>Add Employee</button>}
      />
    );
    expect(screen.getByText('Add Employee')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageHeader title="Test" className="custom-class" />
    );
    expect(container.querySelector('.page-header.custom-class')).toBeInTheDocument();
  });
});
