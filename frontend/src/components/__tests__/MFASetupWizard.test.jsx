// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — MFASetupWizard Tests
 * Tests for the 3-step MFA setup modal: QR display, digit input,
 * verification, backup codes display, copy, download, and done.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MFASetupWizard from '../security/MFASetupWizard';

/* Mock the api module */
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

import api from '../../utils/api';

const mockOnComplete = vi.fn();
const mockOnCancel = vi.fn();

/* Sample enroll response */
const enrollResponse = {
  secret: 'JBSWY3DPEHPK3PXP',
  qr_code_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
};

/* Sample verify response with backup codes */
const verifyResponse = {
  backup_codes: [
    'ABCD1234', 'EFGH5678', 'IJKL9012', 'MNOP3456', 'QRST7890',
    'UVWX1234', 'YZAB5678', 'CDEF9012', 'GHIJ3456', 'KLMN7890'
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default enroll response
  api.post.mockImplementation((url) => {
    if (url.includes('enroll')) return Promise.resolve(enrollResponse);
    if (url.includes('verify-setup')) return Promise.resolve(verifyResponse);
    return Promise.resolve({});
  });
});

describe('MFASetupWizard', () => {
  it('shows QR code on step 1 after enrollment', async () => {
    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(screen.getByAltText('Scan this QR code with your authenticator app')).toBeInTheDocument();
    });
  });

  it('displays manual secret key', async () => {
    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Manual setup key')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    });
  });

  it('shows step indicators with step 1 active', async () => {
    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Step 1 of 3')).toBeInTheDocument();
    });
  });

  it('advances to step 2 when Next is clicked', async () => {
    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Continue to verification')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Continue to verification'));

    // Step 2 should show digit inputs
    expect(screen.getByLabelText('Digit 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 6')).toBeInTheDocument();
  });

  it('shows backup codes after successful verification', async () => {
    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Go to step 2
    await waitFor(() => {
      expect(screen.getByLabelText('Continue to verification')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Continue to verification'));

    // Enter 6 digits — fire change on each
    const digitInputs = [];
    for (let i = 1; i <= 6; i++) {
      digitInputs.push(screen.getByLabelText(`Digit ${i}`));
    }
    ['1', '2', '3', '4', '5'].forEach((d, i) => {
      fireEvent.change(digitInputs[i], { target: { value: d } });
    });
    // Last digit triggers auto-submit
    fireEvent.change(digitInputs[5], { target: { value: '6' } });

    // Should advance to step 3 with backup codes
    await waitFor(() => {
      expect(screen.getByText('ABCD-1234')).toBeInTheDocument();
      expect(screen.getByText('EFGH-5678')).toBeInTheDocument();
    });
  });

  it('shows error on verification failure', async () => {
    api.post.mockImplementation((url) => {
      if (url.includes('enroll')) return Promise.resolve(enrollResponse);
      if (url.includes('verify-setup')) return Promise.reject(new Error('Invalid code'));
      return Promise.resolve({});
    });

    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Go to step 2
    await waitFor(() => {
      expect(screen.getByLabelText('Continue to verification')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Continue to verification'));

    // Click verify with manual submit
    const digitInputs = [];
    for (let i = 1; i <= 6; i++) {
      digitInputs.push(screen.getByLabelText(`Digit ${i}`));
    }
    ['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      fireEvent.change(digitInputs[i], { target: { value: d } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Invalid code/)).toBeInTheDocument();
    });
  });

  it('Done button is disabled until codes saved checkbox is checked', async () => {
    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Go through to step 3
    await waitFor(() => {
      expect(screen.getByLabelText('Continue to verification')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Continue to verification'));

    const digitInputs = [];
    for (let i = 1; i <= 6; i++) {
      digitInputs.push(screen.getByLabelText(`Digit ${i}`));
    }
    ['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      fireEvent.change(digitInputs[i], { target: { value: d } });
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Finish setup')).toBeInTheDocument();
    });

    // Done button should be disabled initially
    expect(screen.getByLabelText('Finish setup')).toBeDisabled();

    // Check the "I have saved" checkbox
    fireEvent.click(screen.getByLabelText('I have saved my backup codes'));

    // Now Done should be enabled
    expect(screen.getByLabelText('Finish setup')).not.toBeDisabled();
  });

  it('calls onCancel when cancel is clicked', async () => {
    render(<MFASetupWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });
});
