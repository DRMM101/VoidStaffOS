// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — BonusSchemeManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BonusSchemeManager from '../BonusSchemeManager';

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockSchemes = [
  {
    id: '1', scheme_name: 'Annual Performance Bonus', calculation_type: 'percentage',
    calculation_value: '10.00', basis: 'base_salary', frequency: 'annual',
    tier_name: 'Manager', band_name: null, is_active: true
  },
  {
    id: '2', scheme_name: 'Retention Bonus', calculation_type: 'fixed',
    calculation_value: '5000.00', basis: 'base_salary', frequency: 'one-off',
    tier_name: null, band_name: 'Senior Developer', is_active: true
  }
];

const mockAssignments = [
  {
    id: 'a1', employee_name: 'Test User', scheme_name: 'Annual Performance Bonus',
    base_amount: '38000.00', calculated_amount: '3800.00', status: 'pending',
    effective_date: '2026-04-01'
  }
];

const mockUser = { id: 1, role_name: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
  // Default mock responses for all fetches
  apiFetch.mockImplementation((url) => {
    if (url.includes('bonus-schemes')) return Promise.resolve({ ok: true, json: async () => ({ data: mockSchemes }) });
    if (url.includes('bonus-assignments')) return Promise.resolve({ ok: true, json: async () => ({ data: mockAssignments }) });
    if (url.includes('pay-bands')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    if (url.includes('tiers')) return Promise.resolve({ ok: true, json: async () => ([]) });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
});

describe('BonusSchemeManager', () => {
  it('renders scheme table with data', async () => {
    render(<BonusSchemeManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Annual Performance Bonus')).toBeInTheDocument();
      expect(screen.getByText('Retention Bonus')).toBeInTheDocument();
    });
  });

  it('shows calculation type and value correctly', async () => {
    render(<BonusSchemeManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('10.00%')).toBeInTheDocument();
      expect(screen.getByText('percentage')).toBeInTheDocument();
    });
  });

  it('shows New Scheme button for admin users', async () => {
    render(<BonusSchemeManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('+ New Scheme')).toBeInTheDocument();
    });
  });

  it('opens create modal when New Scheme clicked', async () => {
    render(<BonusSchemeManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('+ New Scheme')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ New Scheme'));
    expect(screen.getByText('New Bonus Scheme')).toBeInTheDocument();
    expect(screen.getByText('Scheme Name *')).toBeInTheDocument();
  });

  it('renders assignments tab', async () => {
    render(<BonusSchemeManager user={mockUser} />);

    await waitFor(() => {
      const tab = screen.getByText(/Assignments/);
      fireEvent.click(tab);
    });

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });
});
