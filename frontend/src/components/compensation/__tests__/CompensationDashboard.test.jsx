// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — CompensationDashboard Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CompensationDashboard from '../CompensationDashboard';

// Mock the apiFetch utility
vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockStats = {
  total_payroll: 500000,
  average_salary: 50000,
  employee_count: 10,
  active_review_cycles: 1,
  upcoming_changes: 3,
  pending_reviews: 5
};

const mockUser = { id: 1, role_name: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CompensationDashboard', () => {
  it('renders loading state initially', () => {
    // apiFetch returns a never-resolving promise
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<CompensationDashboard user={mockUser} onNavigate={vi.fn()} />);
    expect(screen.getByText('Loading compensation data...')).toBeInTheDocument();
  });

  it('renders stat cards when data loads', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockStats
    });

    render(<CompensationDashboard user={mockUser} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Total Annual Payroll')).toBeInTheDocument();
      expect(screen.getByText('Average Salary')).toBeInTheDocument();
      expect(screen.getByText('Active Review Cycles')).toBeInTheDocument();
      expect(screen.getByText('Upcoming Changes')).toBeInTheDocument();
    });
  });

  it('renders quick links', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockStats
    });

    render(<CompensationDashboard user={mockUser} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Pay Bands')).toBeInTheDocument();
      expect(screen.getByText('Pay Reviews')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' })
    });

    render(<CompensationDashboard user={mockUser} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load compensation statistics')).toBeInTheDocument();
    });
  });

  it('navigates when quick link is clicked', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockStats
    });
    const onNavigate = vi.fn();

    render(<CompensationDashboard user={mockUser} onNavigate={onNavigate} />);

    await waitFor(() => {
      screen.getByText('Pay Bands').closest('button').click();
    });

    expect(onNavigate).toHaveBeenCalledWith('compensation-pay-bands');
  });
});
