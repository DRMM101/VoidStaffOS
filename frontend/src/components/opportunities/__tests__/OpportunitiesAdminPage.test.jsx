// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — OpportunitiesAdminPage Tests
 * Tests for the HR management page for opportunities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OpportunitiesAdminPage from '../OpportunitiesAdminPage';

/* Mock apiFetch */
vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockUser = { id: 2, full_name: 'Admin User', role_name: 'Admin', tenant_id: 1 };
const mockNavigate = vi.fn();

const mockOpportunities = [
  {
    id: 1, title: 'Senior Carer', department: 'Care', status: 'draft',
    applicant_count: 0, posted_at: null, closes_at: null
  },
  {
    id: 2, title: 'Kitchen Assistant', department: 'Catering', status: 'open',
    applicant_count: 3, posted_at: '2026-02-01T10:00:00Z', closes_at: '2026-03-01T23:59:59Z'
  },
  {
    id: 3, title: 'Driver', department: 'Transport', status: 'closed',
    applicant_count: 5, posted_at: '2026-01-15T10:00:00Z', closes_at: '2026-02-01T23:59:59Z'
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpportunitiesAdminPage', () => {
  it('renders all opportunities in table', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockOpportunities
    });

    render(<OpportunitiesAdminPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Senior Carer')).toBeInTheDocument();
      expect(screen.getByText('Kitchen Assistant')).toBeInTheDocument();
      expect(screen.getByText('Driver')).toBeInTheDocument();
    });
  });

  it('shows create opportunity button', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockOpportunities
    });

    render(<OpportunitiesAdminPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/create opportunity/i)).toBeInTheDocument();
    });
  });

  it('shows publish button for draft opportunities', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockOpportunities
    });

    render(<OpportunitiesAdminPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/publish/i)).toBeInTheDocument();
    });
  });

  it('shows applicant count', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockOpportunities
    });

    render(<OpportunitiesAdminPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      /* Kitchen Assistant has 3 applicants */
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });
});
