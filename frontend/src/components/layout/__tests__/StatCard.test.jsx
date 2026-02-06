// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — StatCard Component Tests
 * Tests for stat card rendering, trends, and click behaviour.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Employees" value={42} />);
    expect(screen.getByText('Total Employees')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders trend up with value', () => {
    render(<StatCard label="Growth" value="120" trend="up" trendValue="+5%" />);
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard label="Active" value={10} subtitle="this month" />);
    expect(screen.getByText('this month')).toBeInTheDocument();
  });

  it('calls onClick when card is clickable', () => {
    const onClick = vi.fn();
    render(<StatCard label="Click Me" value={1} onClick={onClick} />);

    fireEvent.click(screen.getByText('Click Me').closest('.stat-card'));
    expect(onClick).toHaveBeenCalled();
  });

  it('has role=button when onClick is provided', () => {
    render(<StatCard label="Clickable" value={1} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not render trend section when no trend prop', () => {
    const { container } = render(<StatCard label="No Trend" value={0} />);
    expect(container.querySelector('.stat-card__trend')).toBeNull();
  });

  it('supports keyboard activation on clickable cards', () => {
    const onClick = vi.fn();
    render(<StatCard label="KB" value={1} onClick={onClick} />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalled();
  });
});
