// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — EmployeeSalaryView
 * Shows an employee's salary timeline, current band position bar,
 * benefits cards, and pay slip downloads.
 * Used for both self-service (/compensation/me) and HR view (/compensation/employee/:id).
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import PageHeader from '../layout/PageHeader';

function EmployeeSalaryView({ user, employeeId, isSelfService = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine which API endpoint to call
  const endpoint = isSelfService
    ? '/api/compensation/me'
    : `/api/compensation/employee/${employeeId}`;

  // Fetch compensation data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiFetch(endpoint);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          const errData = await response.json();
          setError(errData.error || 'Failed to load compensation data');
        }
      } catch (err) {
        console.error('Salary view error:', err);
        setError('Failed to load compensation data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [endpoint]);

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  // Calculate band position percentage (0-100)
  const getBandPosition = (current, min, max) => {
    if (!current || !min || !max || max === min) return 50;
    const pos = ((Number(current) - Number(min)) / (Number(max) - Number(min))) * 100;
    return Math.max(0, Math.min(100, pos));
  };

  if (loading) return <div className="loading">Loading salary data...</div>;
  if (error) return <div className="alert alert--error">{error}</div>;
  if (!data) return null;

  const { salary_history, current_salary, benefits, pay_slips } = data;

  return (
    <div className="salary-view">
      <PageHeader
        title={isSelfService ? 'My Compensation' : 'Employee Compensation'}
        subtitle={isSelfService ? 'Your salary and benefits' : `Employee ID: ${employeeId}`}
      />

      {/* Current salary + band position */}
      {current_salary && (
        <div className="salary-current-card">
          <div className="salary-current-card__header">
            <h3>Current Salary</h3>
            <span className="salary-current-card__amount">{formatCurrency(current_salary.base_salary)}</span>
          </div>

          {/* Band and FTE info */}
          <div className="salary-current-card__meta">
            {current_salary.band_name && (
              <span className="salary-badge">{current_salary.band_name} (Grade {current_salary.grade})</span>
            )}
            {current_salary.fte_percentage && current_salary.fte_percentage !== '100.00' && (
              <span className="salary-badge salary-badge--info">{current_salary.fte_percentage}% FTE</span>
            )}
            <span className="salary-date">Effective: {formatDate(current_salary.effective_date)}</span>
          </div>

          {/* Band position bar — shows where current salary falls within min-max */}
          {current_salary.band_min && current_salary.band_max && (
            <div className="band-position">
              <div className="band-position__labels">
                <span>Min: {formatCurrency(current_salary.band_min)}</span>
                <span>Mid: {formatCurrency(current_salary.band_mid)}</span>
                <span>Max: {formatCurrency(current_salary.band_max)}</span>
              </div>
              <div className="band-position__bar">
                {/* Midpoint marker */}
                <div className="band-position__midpoint" style={{ left: '50%' }} />
                {/* Current salary marker */}
                <div
                  className="band-position__marker"
                  style={{
                    left: `${getBandPosition(current_salary.base_salary, current_salary.band_min, current_salary.band_max)}%`
                  }}
                  title={`Current: ${formatCurrency(current_salary.base_salary)}`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Salary timeline / history */}
      {salary_history && salary_history.length > 0 && (
        <div className="salary-history">
          <h3 className="comp-section-title">Salary History</h3>
          <div className="salary-timeline">
            {salary_history.map((record, index) => (
              <div key={record.id} className={`salary-timeline__item ${index === 0 ? 'salary-timeline__item--current' : ''}`}>
                <div className="salary-timeline__dot" />
                <div className="salary-timeline__content">
                  <span className="salary-timeline__amount">{formatCurrency(record.base_salary)}</span>
                  <span className="salary-timeline__date">{formatDate(record.effective_date)}</span>
                  {record.reason && <span className="salary-timeline__reason">{record.reason}</span>}
                  {record.band_name && <span className="salary-timeline__band">{record.band_name}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benefits cards */}
      {benefits && benefits.length > 0 && (
        <div className="salary-benefits">
          <h3 className="comp-section-title">Benefits</h3>
          <div className="benefits-grid">
            {benefits.map((benefit) => (
              <div key={benefit.id} className="benefit-card">
                <div className="benefit-card__header">
                  <span className="benefit-card__type">{benefit.benefit_type}</span>
                  <span className="benefit-card__frequency">{benefit.frequency}</span>
                </div>
                {benefit.provider && <span className="benefit-card__provider">{benefit.provider}</span>}
                {benefit.value && (
                  <span className="benefit-card__value">{formatCurrency(benefit.value)}</span>
                )}
                {(benefit.employer_contribution || benefit.employee_contribution) && (
                  <div className="benefit-card__contributions">
                    {benefit.employer_contribution && (
                      <span>Employer: {formatCurrency(benefit.employer_contribution)}</span>
                    )}
                    {benefit.employee_contribution && (
                      <span>Employee: {formatCurrency(benefit.employee_contribution)}</span>
                    )}
                  </div>
                )}
                <div className="benefit-card__dates">
                  <span>From: {formatDate(benefit.start_date)}</span>
                  {benefit.end_date && <span>To: {formatDate(benefit.end_date)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pay slips */}
      {pay_slips && pay_slips.length > 0 && (
        <div className="salary-payslips">
          <h3 className="comp-section-title">Pay Slips</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pay_slips.map((slip) => (
                <tr key={slip.id}>
                  <td>{formatDate(slip.period_start)} — {formatDate(slip.period_end)}</td>
                  <td>
                    {slip.document_id ? (
                      <a href={`/api/documents/${slip.document_id}/download`}
                         className="btn btn--sm btn--secondary"
                         target="_blank" rel="noopener noreferrer">
                        Download
                      </a>
                    ) : (
                      <span className="text-muted">No document</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {(!salary_history || salary_history.length === 0) && (!benefits || benefits.length === 0) && (
        <div className="empty-state">
          <p>No compensation records found.</p>
        </div>
      )}
    </div>
  );
}

export default EmployeeSalaryView;
