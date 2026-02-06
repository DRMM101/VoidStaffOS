// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — GDPRAdminPage Tests
 * Tests for the HR/Admin GDPR request management page: loading,
 * request table, filters, detail modal, and deletion modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GDPRAdminPage from '../gdpr/GDPRAdminPage';

/* Mock the api module */
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  },
  apiFetch: vi.fn(),
  getCSRFToken: vi.fn(() => 'mock-csrf-token')
}));

import api from '../../utils/api';

const mockAdmin = { id: 1, full_name: 'Admin User', role_name: 'Admin', tenant_id: 1 };
const mockNavigate = vi.fn();

/* Sample admin request data with employee info */
const mockRequests = [
  {
    id: 1,
    employee_name: 'John Smith',
    employee_email: 'john@example.com',
    employee_number: 'EMP001',
    request_type: 'export',
    status: 'completed',
    created_at: '2026-02-01T10:00:00Z',
    processed_by_name: 'Admin User'
  },
  {
    id: 2,
    employee_name: 'Jane Doe',
    employee_email: 'jane@example.com',
    employee_number: 'EMP002',
    request_type: 'deletion',
    status: 'pending',
    created_at: '2026-02-05T14:00:00Z',
    processed_by_name: null
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GDPRAdminPage', () => {
  it('shows loading state initially', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);
    expect(screen.getByText('Loading data requests…')).toBeInTheDocument();
  });

  it('renders request table after loading', async () => {
    api.get.mockResolvedValue({ requests: mockRequests, total: 2 });

    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
  });

  it('shows error banner on fetch failure', async () => {
    api.get.mockRejectedValue(new Error('Network error'));

    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load data requests. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no requests match filters', async () => {
    api.get.mockResolvedValue({ requests: [], total: 0 });

    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('No data requests found')).toBeInTheDocument();
    });
  });

  it('renders filter dropdowns', async () => {
    api.get.mockResolvedValue({ requests: mockRequests, total: 2 });

    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by type')).toBeInTheDocument();
      expect(screen.getByLabelText('Search by employee name or email')).toBeInTheDocument();
    });
  });

  it('shows deletion request button', async () => {
    api.get.mockResolvedValue({ requests: mockRequests, total: 2 });

    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Create deletion request')).toBeInTheDocument();
    });
  });

  it('shows cleanup button', async () => {
    api.get.mockResolvedValue({ requests: mockRequests, total: 2 });

    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Clean up expired exports')).toBeInTheDocument();
    });
  });

  it('displays employee number under name', async () => {
    api.get.mockResolvedValue({ requests: mockRequests, total: 2 });

    render(<GDPRAdminPage user={mockAdmin} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('EMP001')).toBeInTheDocument();
      expect(screen.getByText('EMP002')).toBeInTheDocument();
    });
  });
});
