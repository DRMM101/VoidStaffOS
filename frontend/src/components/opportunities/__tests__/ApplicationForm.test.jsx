// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — ApplicationForm Tests
 * Tests for the application submission modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApplicationForm from '../ApplicationForm';

/* Mock apiFetch */
vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../../utils/api';

const defaultProps = {
  opportunityId: 1,
  opportunityTitle: 'Senior Carer',
  onClose: vi.fn(),
  onSubmitted: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApplicationForm', () => {
  it('renders modal with opportunity title', () => {
    render(<ApplicationForm {...defaultProps} />);
    expect(screen.getByText(/apply for senior carer/i)).toBeInTheDocument();
  });

  it('renders cover letter textarea', () => {
    render(<ApplicationForm {...defaultProps} />);
    expect(screen.getByLabelText(/cover letter/i)).toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', () => {
    render(<ApplicationForm {...defaultProps} />);
    fireEvent.click(screen.getByText(/cancel/i));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('submits application successfully', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 10, status: 'submitted' })
    });

    render(<ApplicationForm {...defaultProps} />);

    /* Type cover letter */
    const textarea = screen.getByLabelText(/cover letter/i);
    fireEvent.change(textarea, { target: { value: 'I am interested in this role.' } });

    /* Submit */
    fireEvent.click(screen.getByText(/submit application/i));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/opportunities/applications',
        expect.objectContaining({ method: 'POST' })
      );
      expect(defaultProps.onSubmitted).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows error on duplicate application (409)', async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'You have already applied to this opportunity' })
    });

    render(<ApplicationForm {...defaultProps} />);
    fireEvent.click(screen.getByText(/submit application/i));

    await waitFor(() => {
      expect(screen.getByText(/already applied/i)).toBeInTheDocument();
    });
  });
});
