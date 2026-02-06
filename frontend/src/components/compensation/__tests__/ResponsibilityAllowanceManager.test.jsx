// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — ResponsibilityAllowanceManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ResponsibilityAllowanceManager from '../ResponsibilityAllowanceManager';

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockAllowances = [
  {
    id: '1', allowance_name: 'Fire Warden', amount: '150.00',
    frequency: 'monthly', tier_name: null, band_name: null,
    additional_role_name: 'Fire Warden', is_active: true
  },
  {
    id: '2', allowance_name: 'First Aider', amount: '100.00',
    frequency: 'monthly', tier_name: 'Team Lead', band_name: null,
    additional_role_name: null, is_active: true
  }
];

const mockAssignments = [
  {
    id: 'a1', employee_name: 'Jane Smith', allowance_name: 'Fire Warden',
    amount: '150.00', start_date: '2026-01-01', end_date: null
  }
];

const mockUser = { id: 1, role_name: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockImplementation((url) => {
    if (url.includes('responsibility-allowances')) return Promise.resolve({ ok: true, json: async () => ({ data: mockAllowances }) });
    if (url.includes('allowance-assignments')) return Promise.resolve({ ok: true, json: async () => ({ data: mockAssignments }) });
    if (url.includes('pay-bands')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    if (url.includes('tiers')) return Promise.resolve({ ok: true, json: async () => ([]) });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
});

describe('ResponsibilityAllowanceManager', () => {
  it('renders allowances table with data', async () => {
    render(<ResponsibilityAllowanceManager user={mockUser} />);

    await waitFor(() => {
      // 'Fire Warden' appears as both allowance name and role name, so use getAllByText
      expect(screen.getAllByText('Fire Warden').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('First Aider')).toBeInTheDocument();
    });
  });

  it('shows New Allowance button for admin', async () => {
    render(<ResponsibilityAllowanceManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('+ New Allowance')).toBeInTheDocument();
    });
  });

  it('opens create modal when button clicked', async () => {
    render(<ResponsibilityAllowanceManager user={mockUser} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('+ New Allowance'));
    });

    expect(screen.getByText('New Responsibility Allowance')).toBeInTheDocument();
  });

  it('renders assignments tab with data', async () => {
    render(<ResponsibilityAllowanceManager user={mockUser} />);

    await waitFor(() => {
      const tab = screen.getByText(/Assignments/);
      fireEvent.click(tab);
    });

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Ongoing')).toBeInTheDocument();
    });
  });
});
