// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GDPRPage Tests
 * Tests for the employee GDPR self-service page: loading, request list,
 * error handling, export button, download, and admin link visibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GDPRPage from '../gdpr/GDPRPage';

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

const mockUser = { id: 1, full_name: 'Test User', role_name: 'Employee', tenant_id: 1 };
const mockNavigate = vi.fn();

/* Sample request data */
const mockRequests = [
  {
    id: 1,
    request_type: 'export',
    status: 'completed',
    created_at: '2026-02-01T10:00:00Z',
    expires_at: '2026-03-03T10:00:00Z',
    file_path: 'exports/1/export_1_2026-02-01.zip',
    file_size_bytes: 45678,
    requested_by_name: 'Test User'
  },
  {
    id: 2,
    request_type: 'export',
    status: 'expired',
    created_at: '2026-01-01T10:00:00Z',
    expires_at: '2026-01-31T10:00:00Z',
    file_path: null,
    file_size_bytes: null,
    requested_by_name: 'Test User'
  },
  {
    id: 3,
    request_type: 'deletion',
    status: 'rejected',
    created_at: '2026-01-15T10:00:00Z',
    expires_at: null,
    file_path: null,
    file_size_bytes: null,
    rejection_reason: 'Retention period not met',
    requested_by_name: 'HR Admin'
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GDPRPage', () => {
  it('shows loading state initially', () => {
    // Return a never-resolving promise to keep loading state
    api.get.mockReturnValue(new Promise(() => {}));
    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);
    expect(screen.getByText('Loading your data requests…')).toBeInTheDocument();
  });

  it('renders request history after loading', async () => {
    api.get.mockResolvedValue({ requests: mockRequests });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Request History')).toBeInTheDocument();
      // Two export requests + one deletion — use getAllByText for multiples
      expect(screen.getAllByText('Data Export')).toHaveLength(2);
      expect(screen.getByText('Data Deletion')).toBeInTheDocument();
    });
  });

  it('shows error banner on fetch failure', async () => {
    api.get.mockRejectedValue(new Error('Network error'));

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load your data requests. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no requests', async () => {
    api.get.mockResolvedValue({ requests: [] });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('No data requests yet')).toBeInTheDocument();
    });
  });

  it('renders the "Request My Data" export button', async () => {
    api.get.mockResolvedValue({ requests: [] });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Request a copy of your data')).toBeInTheDocument();
    });
  });

  it('shows download button for completed non-expired exports', async () => {
    api.get.mockResolvedValue({ requests: mockRequests });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      // First request is completed with future expiry — should have download button
      expect(screen.getByLabelText('Download export 1')).toBeInTheDocument();
    });
  });

  it('shows rejection reason for rejected requests', async () => {
    api.get.mockResolvedValue({ requests: mockRequests });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/Retention period not met/)).toBeInTheDocument();
    });
  });

  it('shows expired note for expired requests', async () => {
    api.get.mockResolvedValue({ requests: mockRequests });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Link expired')).toBeInTheDocument();
    });
  });

  it('shows GDPR information box', async () => {
    api.get.mockResolvedValue({ requests: [] });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Your rights under UK GDPR')).toBeInTheDocument();
    });
  });

  it('shows admin link for Admin users', async () => {
    const adminUser = { ...mockUser, role_name: 'Admin' };
    api.get.mockResolvedValue({ requests: [] });

    render(<GDPRPage user={adminUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Manage data requests')).toBeInTheDocument();
    });
  });

  it('hides admin link for regular employees', async () => {
    api.get.mockResolvedValue({ requests: [] });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.queryByLabelText('Manage data requests')).not.toBeInTheDocument();
    });
  });

  it('calls export endpoint when button is clicked', async () => {
    api.get.mockResolvedValue({ requests: [] });
    api.post.mockResolvedValue({ request: { id: 4, status: 'completed' } });

    render(<GDPRPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Request a copy of your data')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Request a copy of your data'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/gdpr/export');
    });
  });
});
