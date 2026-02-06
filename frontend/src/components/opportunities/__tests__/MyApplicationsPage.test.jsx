// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — MyApplicationsPage Tests
 * Tests for the employee's application list and withdraw flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MyApplicationsPage from '../MyApplicationsPage';

/* Mock apiFetch — returns a Response-like object */
vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockUser = { id: 1, full_name: 'Test User', role_name: 'Employee', tenant_id: 1 };
const mockNavigate = vi.fn();

const mockApplications = [
  {
    id: 10, opportunity_id: 1, opportunity_title: 'Senior Carer',
    opportunity_department: 'Care', status: 'submitted',
    created_at: '2026-02-05T10:00:00Z'
  },
  {
    id: 11, opportunity_id: 2, opportunity_title: 'Kitchen Assistant',
    opportunity_department: 'Catering', status: 'interview',
    created_at: '2026-02-04T09:00:00Z'
  },
  {
    id: 12, opportunity_id: 3, opportunity_title: 'Driver',
    opportunity_department: 'Transport', status: 'withdrawn',
    created_at: '2026-02-01T08:00:00Z'
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MyApplicationsPage', () => {
  it('renders applications table after fetch', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApplications
    });

    render(<MyApplicationsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Senior Carer')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Assistant')).toBeInTheDocument();
      expect(screen.getByText('Driver')).toBeInTheDocument();
    });
  });

  it('shows withdraw button only for non-accepted, non-withdrawn applications', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApplications
    });

    render(<MyApplicationsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      /* submitted and interview should have withdraw buttons; withdrawn should not */
      const withdrawBtns = screen.getAllByRole('button', { name: /withdraw/i });
      expect(withdrawBtns.length).toBe(2);
    });
  });

  it('renders empty state when no applications', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => []
    });

    render(<MyApplicationsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/not submitted any applications/i)).toBeInTheDocument();
    });
  });
});
