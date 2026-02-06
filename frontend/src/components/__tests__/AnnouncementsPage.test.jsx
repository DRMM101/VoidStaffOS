// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — AnnouncementsPage Tests
 * Tests for the announcements page: loading, list render, error,
 * filter tabs, empty state, and card click.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AnnouncementsPage from '../announcements/AnnouncementsPage';

/* Mock the api module */
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  },
  apiFetch: vi.fn()
}));

import api from '../../utils/api';

const mockUser = { id: 1, full_name: 'Test User', role_name: 'Employee', tenant_id: 1 };
const mockNavigate = vi.fn();

/* Sample announcements data */
const mockAnnouncements = [
  {
    id: 1,
    title: 'Office closure Friday',
    content: 'The office will be closed this Friday for maintenance.',
    category: 'general',
    priority: 'normal',
    status: 'published',
    pinned: false,
    read: false,
    author_name: 'Admin User',
    published_at: '2026-02-01'
  },
  {
    id: 2,
    title: 'New policy update',
    content: 'Please review the updated HR policy document.',
    category: 'policy',
    priority: 'high',
    status: 'published',
    pinned: true,
    read: true,
    author_name: 'HR Manager',
    published_at: '2026-01-28'
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnnouncementsPage', () => {
  it('shows loading state initially', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    render(<AnnouncementsPage user={mockUser} onNavigate={mockNavigate} />);
    expect(screen.getByText('Loading announcements…')).toBeInTheDocument();
  });

  it('renders announcement cards after loading', async () => {
    api.get.mockResolvedValue({ announcements: mockAnnouncements });

    render(<AnnouncementsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Office closure Friday')).toBeInTheDocument();
      expect(screen.getByText('New policy update')).toBeInTheDocument();
    });
  });

  it('shows error banner on fetch failure', async () => {
    api.get.mockRejectedValue(new Error('Network error'));

    render(<AnnouncementsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load announcements. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no announcements', async () => {
    api.get.mockResolvedValue({ announcements: [] });

    render(<AnnouncementsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('No announcements')).toBeInTheDocument();
    });
  });

  it('renders filter tabs', async () => {
    api.get.mockResolvedValue({ announcements: mockAnnouncements });

    render(<AnnouncementsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Unread/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Pinned/i })).toBeInTheDocument();
    });
  });

  it('shows unread count badge', async () => {
    api.get.mockResolvedValue({ announcements: mockAnnouncements });

    render(<AnnouncementsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      // 1 unread announcement
      expect(screen.getByText('1 unread')).toBeInTheDocument();
    });
  });

  it('shows Manage button for admin users', async () => {
    const adminUser = { ...mockUser, role_name: 'Admin' };
    api.get.mockResolvedValue({ announcements: mockAnnouncements });

    render(<AnnouncementsPage user={adminUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Manage announcements')).toBeInTheDocument();
    });
  });
});
