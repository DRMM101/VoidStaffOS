// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — OpportunitiesPage Tests
 * Tests for the employee-facing opportunity browse page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OpportunitiesPage from '../OpportunitiesPage';

/* Mock apiFetch */
vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockUser = { id: 1, full_name: 'Test User', role_name: 'Employee', tenant_id: 1 };
const mockNavigate = vi.fn();

/* Sample opportunity data */
const mockOpportunities = [
  {
    id: 1, title: 'Senior Carer', department: 'Care', location: 'London',
    employment_type: 'full_time', status: 'open', show_salary: true,
    salary_range_min: 28000, salary_range_max: 35000,
    posted_at: '2026-02-01T10:00:00Z', closes_at: '2026-03-01T23:59:59Z'
  },
  {
    id: 2, title: 'Kitchen Assistant', department: 'Catering', location: 'Manchester',
    employment_type: 'part_time', status: 'open', show_salary: false,
    posted_at: '2026-02-03T10:00:00Z', closes_at: null
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpportunitiesPage', () => {
  it('renders loading state initially', () => {
    /* apiFetch never resolves — stays in loading */
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<OpportunitiesPage user={mockUser} onNavigate={mockNavigate} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders opportunity cards after fetch', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockOpportunities
    });

    render(<OpportunitiesPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Senior Carer')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Assistant')).toBeInTheDocument();
    });
  });

  it('shows salary when show_salary is true', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockOpportunities
    });

    render(<OpportunitiesPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      /* Senior Carer has show_salary=true */
      expect(screen.getByText(/£28,000/)).toBeInTheDocument();
    });
  });

  it('renders empty state when no opportunities', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => []
    });

    render(<OpportunitiesPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/no opportunities/i)).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' })
    });

    render(<OpportunitiesPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/failed|error/i)).toBeInTheDocument();
    });
  });
});
