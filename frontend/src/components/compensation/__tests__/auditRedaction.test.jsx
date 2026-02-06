// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — Audit Redaction Logic Tests
 * Tests the redactValue function from compensation audit middleware.
 * (Testing the logic as a pure function — no DB dependency)
 */

import { describe, it, expect } from 'vitest';

// Inline the redaction logic for testing (mirrors backend middleware)
const SENSITIVE_FIELDS = new Set([
  'base_salary', 'min_salary', 'mid_salary', 'max_salary',
  'current_salary', 'proposed_salary', 'approved_salary',
  'value', 'employer_contribution', 'employee_contribution',
  'budget_total', 'budget_remaining'
]);

function redactValue(fieldName, value) {
  if (value === null || value === undefined) return null;
  if (SENSITIVE_FIELDS.has(fieldName)) return 'REDACTED';
  return String(value);
}

describe('Audit Redaction', () => {
  it('redacts salary fields', () => {
    expect(redactValue('base_salary', 50000)).toBe('REDACTED');
    expect(redactValue('proposed_salary', 55000)).toBe('REDACTED');
    expect(redactValue('approved_salary', 52000)).toBe('REDACTED');
    expect(redactValue('min_salary', 30000)).toBe('REDACTED');
    expect(redactValue('max_salary', 70000)).toBe('REDACTED');
  });

  it('redacts contribution fields', () => {
    expect(redactValue('employer_contribution', 500)).toBe('REDACTED');
    expect(redactValue('employee_contribution', 200)).toBe('REDACTED');
  });

  it('redacts budget fields', () => {
    expect(redactValue('budget_total', 1000000)).toBe('REDACTED');
    expect(redactValue('budget_remaining', 500000)).toBe('REDACTED');
  });

  it('does NOT redact non-sensitive fields', () => {
    expect(redactValue('band_name', 'Senior Developer')).toBe('Senior Developer');
    expect(redactValue('status', 'approved')).toBe('approved');
    expect(redactValue('reason', 'Annual review')).toBe('Annual review');
    expect(redactValue('grade', 3)).toBe('3');
  });

  it('returns null for null/undefined values', () => {
    expect(redactValue('base_salary', null)).toBeNull();
    expect(redactValue('base_salary', undefined)).toBeNull();
    expect(redactValue('status', null)).toBeNull();
  });
});
