// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — GoalsDashboardPage Tests
 * Tests for the goals dashboard: loading, stats, goals list, filters,
 * empty state, create modal, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GoalsDashboardPage from '../goals/GoalsDashboardPage';

/* Mock the api module */
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  apiFetch: vi.fn()
}));

import api from '../../utils/api';

const mockUser = { id: 1, full_name: 'Test User', role_name: 'Employee', tenant_id: 1 };
const mockNavigate = vi.fn();

/* Sample goals data */
const mockGoals = [
  {
    id: 1,
    title: 'Complete leadership training',
    description: 'Finish all modules',
    category: 'development',
    priority: 'high',
    status: 'active',
    progress: 45,
    target_date: '2026-06-30',
    created_at: '2026-01-15',
    assigned_by_name: null
  },
  {
    id: 2,
    title: 'Quarterly sales target',
    description: null,
    category: 'performance',
    priority: 'medium',
    status: 'completed',
    progress: 100,
    target_date: '2026-03-31',
    created_at: '2026-01-01',
    completed_at: '2026-03-20',
    assigned_by_name: null
  }
];

const mockStats = {
  own: { total: 5, active: 3, completed: 1, overdue: 1 }
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GoalsDashboardPage', () => {
  it('shows loading state initially', () => {
    // Make the API hang so loading stays visible
    api.get.mockReturnValue(new Promise(() => {}));

    render(<GoalsDashboardPage user={mockUser} onNavigate={mockNavigate} />);
    expect(screen.getByText('Loading goals…')).toBeInTheDocument();
  });

  it('renders stats cards after loading', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/stats')) return Promise.resolve(mockStats);
      return Promise.resolve({ goals: mockGoals });
    });

    render(<GoalsDashboardPage user={mockUser} onNavigate={mockNavigate} />);

    // Wait for stats to appear
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // total
      expect(screen.getByText('3')).toBeInTheDocument(); // active
    });

    // Check stat labels exist within the stats region
    const statsRegion = screen.getByRole('region', { name: 'Goal statistics' });
    expect(statsRegion).toHaveTextContent('Total Goals');
    expect(statsRegion).toHaveTextContent('Active');
    expect(statsRegion).toHaveTextContent('Completed');
    expect(statsRegion).toHaveTextContent('Overdue');
  });

  it('renders goal cards after loading', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/stats')) return Promise.resolve(mockStats);
      return Promise.resolve({ goals: mockGoals });
    });

    render(<GoalsDashboardPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Complete leadership training')).toBeInTheDocument();
      expect(screen.getByText('Quarterly sales target')).toBeInTheDocument();
    });
  });

  it('shows error banner on fetch failure', async () => {
    api.get.mockRejectedValue(new Error('Network error'));

    render(<GoalsDashboardPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load goals. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no goals exist', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/stats')) return Promise.resolve({ own: { total: 0, active: 0, completed: 0, overdue: 0 } });
      return Promise.resolve({ goals: [] });
    });

    render(<GoalsDashboardPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('No goals found')).toBeInTheDocument();
      expect(screen.getByText('Create your first goal to get started.')).toBeInTheDocument();
    });
  });

  it('opens create goal form when Add Goal is clicked', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/stats')) return Promise.resolve(mockStats);
      if (url.includes('/my-team')) return Promise.resolve({ employees: [] });
      return Promise.resolve({ goals: mockGoals });
    });

    render(<GoalsDashboardPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Complete leadership training')).toBeInTheDocument();
    });

    // Click the Add Goal button
    fireEvent.click(screen.getByLabelText('Create new goal'));

    // The GoalForm modal should appear — check for the heading element
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Create goal' })).toBeInTheDocument();
    });
  });

  it('renders filter tabs', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/stats')) return Promise.resolve(mockStats);
      return Promise.resolve({ goals: mockGoals });
    });

    render(<GoalsDashboardPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Completed' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Overdue' })).toBeInTheDocument();
    });
  });
});
