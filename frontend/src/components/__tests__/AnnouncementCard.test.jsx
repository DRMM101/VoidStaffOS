// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — AnnouncementCard Tests
 * Tests for the announcement card: render, badges, priority,
 * pinned, unread dot, content truncation, and click handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnouncementCard from '../announcements/AnnouncementCard';

/* Sample announcements */
const normalAnnouncement = {
  id: 1,
  title: 'Office closure Friday',
  content: 'The office will be closed this Friday for maintenance work.',
  category: 'general',
  priority: 'normal',
  pinned: false,
  read: true,
  author_name: 'Admin User',
  published_at: '2026-02-01'
};

const urgentAnnouncement = {
  ...normalAnnouncement,
  id: 2,
  title: 'Emergency building evacuation drill',
  category: 'urgent',
  priority: 'urgent',
  read: false
};

const pinnedAnnouncement = {
  ...normalAnnouncement,
  id: 3,
  title: 'Pinned important notice',
  pinned: true,
  read: false
};

const longContentAnnouncement = {
  ...normalAnnouncement,
  id: 4,
  content: 'A'.repeat(200) // Longer than 120 chars
};

const mockClick = vi.fn();

describe('AnnouncementCard', () => {
  it('renders announcement title', () => {
    render(<AnnouncementCard announcement={normalAnnouncement} onClick={mockClick} />);
    expect(screen.getByText('Office closure Friday')).toBeInTheDocument();
  });

  it('renders category badge', () => {
    render(<AnnouncementCard announcement={normalAnnouncement} onClick={mockClick} />);
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('renders author name', () => {
    render(<AnnouncementCard announcement={normalAnnouncement} onClick={mockClick} />);
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('renders content preview', () => {
    render(<AnnouncementCard announcement={normalAnnouncement} onClick={mockClick} />);
    expect(screen.getByText(/office will be closed/i)).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    render(<AnnouncementCard announcement={normalAnnouncement} onClick={mockClick} />);
    fireEvent.click(screen.getByRole('article'));
    expect(mockClick).toHaveBeenCalledWith(normalAnnouncement);
  });

  it('shows urgent priority indicator for urgent announcements', () => {
    render(<AnnouncementCard announcement={urgentAnnouncement} onClick={mockClick} />);
    expect(screen.getByText('urgent')).toBeInTheDocument();
    // Card should have urgent class
    const card = screen.getByRole('article');
    expect(card.className).toContain('announcement-card--urgent');
  });

  it('shows unread dot for unread announcements', () => {
    render(<AnnouncementCard announcement={urgentAnnouncement} onClick={mockClick} />);
    expect(screen.getByLabelText('Unread')).toBeInTheDocument();
  });

  it('does not show unread dot for read announcements', () => {
    render(<AnnouncementCard announcement={normalAnnouncement} onClick={mockClick} />);
    expect(screen.queryByLabelText('Unread')).not.toBeInTheDocument();
  });

  it('shows pin icon for pinned announcements', () => {
    render(<AnnouncementCard announcement={pinnedAnnouncement} onClick={mockClick} />);
    expect(screen.getByLabelText('Pinned announcement')).toBeInTheDocument();
  });

  it('does not show pin icon for non-pinned announcements', () => {
    render(<AnnouncementCard announcement={normalAnnouncement} onClick={mockClick} />);
    expect(screen.queryByLabelText('Pinned announcement')).not.toBeInTheDocument();
  });

  it('truncates long content', () => {
    render(<AnnouncementCard announcement={longContentAnnouncement} onClick={mockClick} />);
    // The preview should end with ellipsis and be shorter than original
    const preview = screen.getByText(/A+…/);
    expect(preview.textContent.length).toBeLessThan(200);
  });

  it('renders urgent category badge with correct class', () => {
    render(<AnnouncementCard announcement={urgentAnnouncement} onClick={mockClick} />);
    const badge = screen.getByText('Urgent');
    expect(badge.className).toContain('announcement-badge--red');
  });
});
