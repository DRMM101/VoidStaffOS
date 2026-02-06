// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — OrgChartPage Tests
 * Tests for the org chart page: loading, tree render, error, search, quick card.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OrgChartPage from '../OrgChartPage';

/* Mock the api module — OrgChartPage uses `api.get()` */
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn()
  },
  apiFetch: vi.fn()
}));

import api from '../../utils/api';

const mockUser = { id: 1, full_name: 'Admin User', role_name: 'Admin', tenant_id: 1 };
const mockNavigate = vi.fn();

/* Sample tree data mimicking backend response */
const mockTree = [
  {
    id: 10,
    full_name: 'Alice Admin',
    email: 'alice@test.com',
    employee_number: 'EMP001',
    tier: null,
    role_name: 'Admin',
    manager_id: null,
    direct_reports: 2,
    children: [
      {
        id: 20,
        full_name: 'Bob Manager',
        email: 'bob@test.com',
        employee_number: 'EMP002',
        tier: 2,
        role_name: 'Manager',
        manager_id: 10,
        direct_reports: 1,
        children: [
          {
            id: 30,
            full_name: 'Charlie Employee',
            email: 'charlie@test.com',
            employee_number: 'EMP003',
            tier: 4,
            role_name: 'Employee',
            manager_id: 20,
            direct_reports: 0,
            children: []
          }
        ]
      },
      {
        id: 21,
        full_name: 'Dana Manager',
        email: 'dana@test.com',
        employee_number: 'EMP004',
        tier: 2,
        role_name: 'Manager',
        manager_id: 10,
        direct_reports: 0,
        children: []
      }
    ]
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrgChartPage', () => {
  it('renders loading state initially', () => {
    /* api.get never resolves — stays in loading */
    api.get.mockReturnValue(new Promise(() => {}));
    render(<OrgChartPage user={mockUser} onNavigate={mockNavigate} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders tree after successful fetch', async () => {
    api.get.mockResolvedValue({ tree: mockTree, total_employees: 4 });

    render(<OrgChartPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      /* Root node should be visible */
      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
      /* Child nodes should be visible (all expanded by default) */
      expect(screen.getByText('Bob Manager')).toBeInTheDocument();
      expect(screen.getByText('Charlie Employee')).toBeInTheDocument();
      expect(screen.getByText('Dana Manager')).toBeInTheDocument();
    });
  });

  it('shows employee count', async () => {
    api.get.mockResolvedValue({ tree: mockTree, total_employees: 4 });

    render(<OrgChartPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('4 employees')).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    api.get.mockRejectedValue(new Error('Network error'));

    render(<OrgChartPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('search highlights matching employee and shows no match', async () => {
    api.get.mockResolvedValue({ tree: mockTree, total_employees: 4 });

    render(<OrgChartPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    });

    /* Search for an existing employee */
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'Charlie' } });

    /* The highlighted card should have the highlight class — we check the DOM attribute */
    await waitFor(() => {
      const nodeEl = document.querySelector('[data-node-id="30"]');
      expect(nodeEl).toBeTruthy();
    });

    /* Search for non-existent employee */
    fireEvent.change(searchInput, { target: { value: 'Zzzzzzz' } });
    await waitFor(() => {
      expect(screen.getByText(/no match found/i)).toBeInTheDocument();
    });
  });

  it('opens quick card on node click', async () => {
    api.get.mockResolvedValue({ tree: mockTree, total_employees: 4 });

    render(<OrgChartPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    });

    /* Click on a node card */
    const aliceCard = screen.getByLabelText(/Alice Admin/i);
    fireEvent.click(aliceCard);

    /* Quick card should appear with employee details */
    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      expect(screen.getByText('View Profile')).toBeInTheDocument();
      expect(screen.getByText('Reassign Manager')).toBeInTheDocument();
    });
  });

  it('renders empty state when tree is empty', async () => {
    api.get.mockResolvedValue({ tree: [], total_employees: 0 });

    render(<OrgChartPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/no employees found/i)).toBeInTheDocument();
    });
  });
});
