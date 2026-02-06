// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — CompensationReports
 * Gender pay gap and department cost reports with CSS bar charts.
 * Includes CSV export. HR/Director access.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import PageHeader from '../layout/PageHeader';

function CompensationReports({ user }) {
  const [activeTab, setActiveTab] = useState('gender');
  const [genderData, setGenderData] = useState([]);
  const [deptData, setDeptData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch both reports on mount
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [genderRes, deptRes] = await Promise.all([
          apiFetch('/api/compensation/reports/gender-pay-gap'),
          apiFetch('/api/compensation/reports/department-costs')
        ]);

        if (genderRes.ok) {
          const data = await genderRes.json();
          setGenderData(data.data);
        }
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDeptData(data.data);
        }
      } catch (err) {
        console.error('Fetch reports error:', err);
        setError('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  // Format currency for display
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  };

  // Export data as CSV
  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get max value for bar chart scaling
  const getMaxValue = (data, field) => {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(d => Number(d[field]) || 0));
  };

  if (loading) return <div className="loading">Loading reports...</div>;

  return (
    <div className="compensation-reports">
      <PageHeader
        title="Compensation Reports"
        subtitle="Pay gap analysis and cost breakdown"
      />

      {error && <div className="alert alert--error">{error}</div>}

      {/* Tab navigation */}
      <div className="comp-tabs">
        <button
          className={`comp-tab ${activeTab === 'gender' ? 'comp-tab--active' : ''}`}
          onClick={() => setActiveTab('gender')}
        >
          Gender Pay Gap
        </button>
        <button
          className={`comp-tab ${activeTab === 'department' ? 'comp-tab--active' : ''}`}
          onClick={() => setActiveTab('department')}
        >
          Department Costs
        </button>
      </div>

      {/* Gender Pay Gap Report */}
      {activeTab === 'gender' && (
        <div className="report-section">
          <div className="report-section__header">
            <h3>Gender Pay Gap by Band</h3>
            <button className="btn btn--sm btn--secondary"
              onClick={() => exportCSV(genderData, 'gender_pay_gap')}>
              Export CSV
            </button>
          </div>

          {genderData.length === 0 ? (
            <div className="empty-state"><p>No data available. Add compensation records with gender information to generate this report.</p></div>
          ) : (
            <div className="report-chart">
              {/* Group by band for side-by-side bars */}
              {(() => {
                const bands = [...new Set(genderData.map(d => d.band_name || 'Unassigned'))];
                const maxSalary = getMaxValue(genderData, 'mean_salary');

                return bands.map(band => (
                  <div key={band} className="chart-group">
                    <h4 className="chart-group__label">{band}</h4>
                    {genderData
                      .filter(d => (d.band_name || 'Unassigned') === band)
                      .map((row, i) => (
                        <div key={i} className="chart-bar-row">
                          <span className="chart-bar-label">{row.gender || 'Unknown'} ({row.employee_count})</span>
                          <div className="chart-bar-track">
                            <div
                              className={`chart-bar chart-bar--${(row.gender || 'unknown').toLowerCase()}`}
                              style={{ width: `${(Number(row.mean_salary) / maxSalary) * 100}%` }}
                            >
                              <span className="chart-bar__value">{formatCurrency(row.mean_salary)}</span>
                            </div>
                          </div>
                          <span className="chart-bar-median">Median: {formatCurrency(row.median_salary)}</span>
                        </div>
                      ))
                    }
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Department Costs Report */}
      {activeTab === 'department' && (
        <div className="report-section">
          <div className="report-section__header">
            <h3>Department Cost Breakdown</h3>
            <button className="btn btn--sm btn--secondary"
              onClick={() => exportCSV(deptData, 'department_costs')}>
              Export CSV
            </button>
          </div>

          {deptData.length === 0 ? (
            <div className="empty-state"><p>No department cost data available.</p></div>
          ) : (
            <div className="report-chart">
              {(() => {
                const maxCost = getMaxValue(deptData, 'total_cost');
                return deptData.map((dept, i) => (
                  <div key={i} className="chart-bar-row chart-bar-row--dept">
                    <span className="chart-bar-label">{dept.department || 'Unassigned'}</span>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar chart-bar--dept"
                        style={{ width: `${(Number(dept.total_cost) / maxCost) * 100}%` }}
                      >
                        <span className="chart-bar__value">{formatCurrency(dept.total_cost)}</span>
                      </div>
                    </div>
                    <div className="chart-bar-stats">
                      <span>{dept.headcount} people</span>
                      <span>Avg: {formatCurrency(dept.avg_salary)}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CompensationReports;
