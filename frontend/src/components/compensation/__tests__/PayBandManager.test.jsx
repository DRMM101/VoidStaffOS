// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — PayBandManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PayBandManager from '../PayBandManager';

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockBands = [
  { id: '1', band_name: 'Junior', grade: 1, min_salary: 25000, mid_salary: 30000, max_salary: 35000, currency: 'GBP' },
  { id: '2', band_name: 'Senior', grade: 3, min_salary: 45000, mid_salary: 55000, max_salary: 65000, currency: 'GBP' }
];

const mockUser = { id: 1, role_name: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PayBandManager', () => {
  it('renders pay bands table with data', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ data: mockBands }) });

    render(<PayBandManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Junior')).toBeInTheDocument();
      expect(screen.getByText('Senior')).toBeInTheDocument();
    });
  });

  it('shows empty state when no bands exist', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    render(<PayBandManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('No pay bands defined yet')).toBeInTheDocument();
    });
  });

  it('opens create modal when New Pay Band button clicked', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ data: mockBands }) });

    render(<PayBandManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('+ New Pay Band')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ New Pay Band'));
    expect(screen.getByText('New Pay Band')).toBeInTheDocument();
    expect(screen.getByLabelText('Band Name *')).toBeInTheDocument();
  });

  it('opens edit modal when Edit button clicked', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ data: mockBands }) });

    render(<PayBandManager user={mockUser} />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
    });

    expect(screen.getByText('Edit Pay Band')).toBeInTheDocument();
  });

  it('renders table headers correctly', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ data: mockBands }) });

    render(<PayBandManager user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Band Name')).toBeInTheDocument();
      expect(screen.getByText('Grade')).toBeInTheDocument();
      expect(screen.getByText('Min Salary')).toBeInTheDocument();
      expect(screen.getByText('Mid Salary')).toBeInTheDocument();
      expect(screen.getByText('Max Salary')).toBeInTheDocument();
    });
  });
});
