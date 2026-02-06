// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — SecuritySettingsPage Tests
 * Tests for loading, MFA status display, enable/disable buttons,
 * session list, password change form, and policy validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SecuritySettingsPage from '../security/SecuritySettingsPage';

/* Mock the api module */
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn()
  }
}));

import api from '../../utils/api';

const mockUser = { id: 1, full_name: 'Test User', role_name: 'Employee', tenant_id: 1 };
const mockNavigate = vi.fn();

/* Default MFA status response (disabled) */
const mfaDisabled = { mfa_enabled: false, mfa_enabled_at: null, backup_codes_remaining: 0 };

/* MFA enabled response */
const mfaEnabled = {
  mfa_enabled: true,
  mfa_enabled_at: '2026-02-01T10:00:00Z',
  backup_codes_remaining: 8
};

/* Sample sessions */
const mockSessions = [
  { id: 1, device_name: 'Chrome on Windows', ip_address: '192.168.1.1', last_active: '2026-02-06T10:00:00Z', is_current: true },
  { id: 2, device_name: 'Firefox on Mac', ip_address: '10.0.0.1', last_active: '2026-02-05T15:00:00Z', is_current: false }
];

/* Password policy */
const mockPolicy = {
  min_length: 8,
  require_uppercase: true,
  require_number: true,
  require_special: false
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SecuritySettingsPage', () => {
  it('shows loading state initially', () => {
    // Return never-resolving promises to keep loading state
    api.get.mockReturnValue(new Promise(() => {}));
    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);
    expect(screen.getByText('Loading security settings…')).toBeInTheDocument();
  });

  it('renders MFA disabled state with enable button', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('mfa/status')) return Promise.resolve(mfaDisabled);
      if (url.includes('sessions')) return Promise.resolve({ sessions: [] });
      if (url.includes('password-policy')) return Promise.resolve({ policy: mockPolicy });
      return Promise.resolve({});
    });

    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable two-factor authentication')).toBeInTheDocument();
    });
  });

  it('renders MFA enabled state with disable button and backup count', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('mfa/status')) return Promise.resolve(mfaEnabled);
      if (url.includes('sessions')) return Promise.resolve({ sessions: [] });
      if (url.includes('password-policy')) return Promise.resolve({ policy: mockPolicy });
      return Promise.resolve({});
    });

    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText(/8 backup codes remaining/)).toBeInTheDocument();
      expect(screen.getByLabelText('Disable two-factor authentication')).toBeInTheDocument();
    });
  });

  it('renders active sessions with current badge', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('mfa/status')) return Promise.resolve(mfaDisabled);
      if (url.includes('sessions')) return Promise.resolve({ sessions: mockSessions });
      if (url.includes('password-policy')) return Promise.resolve({ policy: mockPolicy });
      return Promise.resolve({});
    });

    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
      expect(screen.getByText('Firefox on Mac')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
    });
  });

  it('shows Log Out All Other Sessions button when multiple sessions', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('mfa/status')) return Promise.resolve(mfaDisabled);
      if (url.includes('sessions')) return Promise.resolve({ sessions: mockSessions });
      if (url.includes('password-policy')) return Promise.resolve({ policy: mockPolicy });
      return Promise.resolve({});
    });

    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Log out all other sessions')).toBeInTheDocument();
    });
  });

  it('renders password change form with policy validation', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('mfa/status')) return Promise.resolve(mfaDisabled);
      if (url.includes('sessions')) return Promise.resolve({ sessions: [] });
      if (url.includes('password-policy')) return Promise.resolve({ policy: mockPolicy });
      return Promise.resolve({});
    });

    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    });
  });

  it('shows password error when new passwords do not match', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('mfa/status')) return Promise.resolve(mfaDisabled);
      if (url.includes('sessions')) return Promise.resolve({ sessions: [] });
      if (url.includes('password-policy')) return Promise.resolve({ policy: mockPolicy });
      return Promise.resolve({});
    });

    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    // Type mismatching passwords
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Mismatch1' } });

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('shows error banner when MFA status fetch fails', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('mfa/status')) return Promise.reject(new Error('Network error'));
      if (url.includes('sessions')) return Promise.resolve({ sessions: [] });
      if (url.includes('password-policy')) return Promise.resolve({ policy: mockPolicy });
      return Promise.resolve({});
    });

    render(<SecuritySettingsPage user={mockUser} onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load security settings.')).toBeInTheDocument();
    });
  });
});
