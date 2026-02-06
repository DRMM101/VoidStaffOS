// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — CompensationSettingsPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CompensationSettingsPanel from '../CompensationSettingsPanel';

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CompensationSettingsPanel', () => {
  it('shows access denied for non-admin users', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ enable_tier_band_linking: false, enable_bonus_schemes: false, enable_responsibility_allowances: false })
    });

    render(<CompensationSettingsPanel user={{ id: 1, role_name: 'Employee' }} />);

    await waitFor(() => {
      expect(screen.getByText(/only administrators/i)).toBeInTheDocument();
    });
  });

  it('renders toggle switches for admin users', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ enable_tier_band_linking: false, enable_bonus_schemes: true, enable_responsibility_allowances: false })
    });

    render(<CompensationSettingsPanel user={{ id: 1, role_name: 'Admin' }} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Enable tier-band linking')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable bonus schemes')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable responsibility allowances')).toBeInTheDocument();
    });
  });

  it('shows save button', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ enable_tier_band_linking: false, enable_bonus_schemes: false, enable_responsibility_allowances: false })
    });

    render(<CompensationSettingsPanel user={{ id: 1, role_name: 'Admin' }} />);

    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
  });
});
