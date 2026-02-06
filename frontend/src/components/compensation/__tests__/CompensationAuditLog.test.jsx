// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — CompensationAuditLog Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CompensationAuditLog from '../CompensationAuditLog';

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const mockEntries = [
  {
    id: '1', accessed_by_name: 'John Admin', action: 'view',
    table_name: 'compensation_records', employee_name: 'Jane Employee',
    field_changed: null, old_value: null, new_value: null,
    ip_address: '127.0.0.1', created_at: '2026-02-06T10:00:00Z'
  },
  {
    id: '2', accessed_by_name: 'John Admin', action: 'create',
    table_name: 'pay_bands', employee_name: null,
    field_changed: null, old_value: null, new_value: null,
    ip_address: '127.0.0.1', created_at: '2026-02-06T09:30:00Z'
  }
];

const mockUser = { id: 1, role_name: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CompensationAuditLog', () => {
  it('renders audit entries in table', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockEntries, total: 2, limit: 50, offset: 0 })
    });

    render(<CompensationAuditLog user={mockUser} />);

    await waitFor(() => {
      // Both entries share the same accessed_by_name, so use getAllByText
      expect(screen.getAllByText('John Admin').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('compensation_records')).toBeInTheDocument();
      expect(screen.getByText('Jane Employee')).toBeInTheDocument();
    });
  });

  it('shows filter controls', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, limit: 50, offset: 0 })
    });

    render(<CompensationAuditLog user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Action')).toBeInTheDocument();
      expect(screen.getByLabelText('Employee ID')).toBeInTheDocument();
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });
  });

  it('shows empty state when no entries', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, limit: 50, offset: 0 })
    });

    render(<CompensationAuditLog user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('No audit entries found')).toBeInTheDocument();
    });
  });

  it('renders audit action badges', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockEntries, total: 2, limit: 50, offset: 0 })
    });

    render(<CompensationAuditLog user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('view')).toBeInTheDocument();
      expect(screen.getByText('create')).toBeInTheDocument();
    });
  });
});
