/**
 * VoidStaffOS - Quarterly Report Component
 * Displays quarterly performance report with charts.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * TRADE SECRET: Contains proprietary algorithms.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

import { useState, useEffect, useRef } from 'react';

// Simple SVG Line Chart Component
function LineChart({ data, dataKeys, colors, height = 200 }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data available</div>;
  }

  const width = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max values
  let minVal = 10, maxVal = 0;
  data.forEach(d => {
    dataKeys.forEach(key => {
      if (d[key] !== null && d[key] !== undefined) {
        minVal = Math.min(minVal, d[key]);
        maxVal = Math.max(maxVal, d[key]);
      }
    });
  });

  // Add padding to range
  minVal = Math.max(0, Math.floor(minVal) - 1);
  maxVal = Math.min(10, Math.ceil(maxVal) + 1);

  const xScale = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v) => padding.top + chartHeight - ((v - minVal) / (maxVal - minVal)) * chartHeight;

  // Generate paths for each data key
  const paths = dataKeys.map((key, keyIndex) => {
    const points = data
      .map((d, i) => d[key] !== null ? { x: xScale(i), y: yScale(d[key]), value: d[key] } : null)
      .filter(p => p !== null);

    if (points.length < 2) return null;

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <g key={key}>
        <path
          d={pathD}
          fill="none"
          stroke={colors[keyIndex]}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={colors[keyIndex]}
            className="chart-point"
          >
            <title>{key}: {p.value}</title>
          </circle>
        ))}
      </g>
    );
  });

  // Y-axis labels
  const yLabels = [];
  for (let i = minVal; i <= maxVal; i += 2) {
    yLabels.push(
      <text
        key={i}
        x={padding.left - 10}
        y={yScale(i)}
        textAnchor="end"
        alignmentBaseline="middle"
        className="chart-label"
      >
        {i}
      </text>
    );
  }

  // X-axis labels (show every 2nd week)
  const xLabels = data
    .filter((_, i) => i % 2 === 0 || i === data.length - 1)
    .map((d, i, arr) => {
      const originalIndex = data.indexOf(d);
      const weekLabel = d.week_ending ? d.week_ending.substring(5) : `W${originalIndex + 1}`;
      return (
        <text
          key={originalIndex}
          x={xScale(originalIndex)}
          y={height - 10}
          textAnchor="middle"
          className="chart-label"
        >
          {weekLabel}
        </text>
      );
    });

  // Grid lines
  const gridLines = [];
  for (let i = minVal; i <= maxVal; i += 2) {
    gridLines.push(
      <line
        key={i}
        x1={padding.left}
        y1={yScale(i)}
        x2={width - padding.right}
        y2={yScale(i)}
        className="chart-grid"
      />
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart">
      {gridLines}
      {yLabels}
      {xLabels}
      {paths}
    </svg>
  );
}

// Bar Chart for Monthly Comparison
function ComparisonChart({ data, height = 180 }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data available</div>;
  }

  const width = 400;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barWidth = chartWidth / data.length / 3;
  const groupWidth = chartWidth / data.length;

  const maxVal = 10;
  const yScale = (v) => v !== null ? padding.top + chartHeight - (v / maxVal) * chartHeight : padding.top + chartHeight;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="comparison-chart">
      {/* Grid lines */}
      {[0, 2, 4, 6, 8, 10].map(v => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={yScale(v)}
            x2={width - padding.right}
            y2={yScale(v)}
            className="chart-grid"
          />
          <text
            x={padding.left - 10}
            y={yScale(v)}
            textAnchor="end"
            alignmentBaseline="middle"
            className="chart-label"
          >
            {v}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const groupX = padding.left + i * groupWidth + groupWidth / 2;

        return (
          <g key={d.month}>
            {/* Manager bar */}
            {d.manager.velocity !== null && (
              <rect
                x={groupX - barWidth - 2}
                y={yScale(d.manager.velocity)}
                width={barWidth}
                height={chartHeight - (yScale(d.manager.velocity) - padding.top)}
                className="bar-manager"
              >
                <title>Manager: {d.manager.velocity}</title>
              </rect>
            )}

            {/* Self bar */}
            {d.self.velocity !== null && (
              <rect
                x={groupX + 2}
                y={yScale(d.self.velocity)}
                width={barWidth}
                height={chartHeight - (yScale(d.self.velocity) - padding.top)}
                className="bar-self"
              >
                <title>Self: {d.self.velocity}</title>
              </rect>
            )}

            {/* Month label */}
            <text
              x={groupX}
              y={height - 10}
              textAnchor="middle"
              className="chart-label"
            >
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TrendIndicator({ trend, label }) {
  const icons = {
    improving: '↑',
    stable: '→',
    declining: '↓'
  };

  const labels = {
    improving: 'Improving',
    stable: 'Stable',
    declining: 'Declining'
  };

  return (
    <div className={`trend-indicator ${trend}`}>
      <span className="trend-icon">{icons[trend]}</span>
      <span className="trend-label">{labels[trend]}</span>
    </div>
  );
}

function MetricSummaryCard({ label, value, previousValue, trend, color }) {
  const diff = previousValue !== null && value !== null ? (value - previousValue).toFixed(2) : null;
  const diffPrefix = diff > 0 ? '+' : '';

  return (
    <div className={`metric-summary-card ${color}`}>
      <div className="metric-summary-label">{label}</div>
      <div className="metric-summary-value">{value !== null ? value : '-'}</div>
      {diff !== null && (
        <div className={`metric-summary-diff ${diff >= 0 ? 'positive' : 'negative'}`}>
          {diffPrefix}{diff} vs prev quarter
        </div>
      )}
      <TrendIndicator trend={trend} />
    </div>
  );
}

function QuarterlyReport({ employeeId, onClose, user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [quarters, setQuarters] = useState([]);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const reportRef = useRef(null);

  useEffect(() => {
    fetchAvailableQuarters();
  }, [employeeId]);

  useEffect(() => {
    if (selectedQuarter) {
      fetchReport();
    }
  }, [selectedQuarter]);

  const fetchAvailableQuarters = async () => {
    try {
      const response = await fetch(`/api/reports/quarters/${employeeId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok) {
        setQuarters(data.quarters);
        // Default to current quarter
        const now = new Date();
        const currentQ = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
        const defaultQuarter = data.quarters.find(q => q.value === currentQ) || data.quarters[0];
        if (defaultQuarter) {
          setSelectedQuarter(defaultQuarter.value);
        } else {
          setLoading(false);
        }
      } else {
        setError(data.error);
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to fetch available quarters');
      setLoading(false);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/reports/quarterly/${employeeId}/${selectedQuarter}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok) {
        setReport(data.report);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch quarterly report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    // Create a printable version
    const printContent = reportRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quarterly Report - ${report.employee.full_name} - ${report.quarter.label}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
          }
          h1, h2, h3 { color: #f9f6f2; }
          .report-header { margin-bottom: 30px; border-bottom: 2px solid #134e4a; padding-bottom: 20px; }
          .employee-info { display: flex; gap: 40px; margin-top: 10px; }
          .info-item { }
          .info-label { color: #666; font-size: 12px; }
          .info-value { font-weight: 600; }
          .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
          .metric-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
          .metric-value { font-size: 32px; font-weight: 700; color: #134e4a; }
          .metric-label { color: #666; font-size: 14px; margin-bottom: 8px; }
          .trend { font-size: 14px; margin-top: 8px; }
          .trend.improving { color: #2ed573; }
          .trend.stable { color: #ffc107; }
          .trend.declining { color: #ff4757; }
          .chart-section { margin: 30px 0; page-break-inside: avoid; }
          .chart-placeholder { background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Quarterly Performance Report</h1>
          <h2>${report.quarter.label}</h2>
          <div class="employee-info">
            <div class="info-item">
              <div class="info-label">Employee</div>
              <div class="info-value">${report.employee.full_name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Department</div>
              <div class="info-value">${report.employee.department || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Manager</div>
              <div class="info-value">${report.employee.manager_name || 'N/A'}</div>
            </div>
          </div>
        </div>

        <h3>Summary Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Velocity</div>
            <div class="metric-value">${report.quarter_averages.velocity ?? '-'}</div>
            <div class="trend ${report.trends.velocity}">${report.trends.velocity === 'improving' ? '↑ Improving' : report.trends.velocity === 'declining' ? '↓ Declining' : '→ Stable'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Friction</div>
            <div class="metric-value">${report.quarter_averages.friction ?? '-'}</div>
            <div class="trend ${report.trends.friction}">${report.trends.friction === 'improving' ? '↑ Improving' : report.trends.friction === 'declining' ? '↓ Declining' : '→ Stable'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Cohesion</div>
            <div class="metric-value">${report.quarter_averages.cohesion ?? '-'}</div>
            <div class="trend ${report.trends.cohesion}">${report.trends.cohesion === 'improving' ? '↑ Improving' : report.trends.cohesion === 'declining' ? '↓ Declining' : '→ Stable'}</div>
          </div>
        </div>

        <h3>Weekly Performance Data</h3>
        <table>
          <thead>
            <tr>
              <th>Week Ending</th>
              <th>Velocity</th>
              <th>Friction</th>
              <th>Cohesion</th>
              <th>Reviewer</th>
            </tr>
          </thead>
          <tbody>
            ${report.weekly_trends.map(w => `
              <tr>
                <td>${w.week_ending}</td>
                <td>${w.velocity ?? '-'}</td>
                <td>${w.friction ?? '-'}</td>
                <td>${w.cohesion ?? '-'}</td>
                <td>${w.reviewer_name || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${report.previous_quarter ? `
        <h3>Quarter Comparison</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>${report.previous_quarter.label}</th>
              <th>${report.quarter.label}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Velocity</td>
              <td>${report.previous_quarter.velocity ?? '-'}</td>
              <td>${report.quarter_averages.velocity ?? '-'}</td>
              <td>${report.quarter_comparison?.velocity_diff !== null ? (report.quarter_comparison.velocity_diff >= 0 ? '+' : '') + report.quarter_comparison.velocity_diff : '-'}</td>
            </tr>
            <tr>
              <td>Friction</td>
              <td>${report.previous_quarter.friction ?? '-'}</td>
              <td>${report.quarter_averages.friction ?? '-'}</td>
              <td>${report.quarter_comparison?.friction_diff !== null ? (report.quarter_comparison.friction_diff >= 0 ? '+' : '') + report.quarter_comparison.friction_diff : '-'}</td>
            </tr>
            <tr>
              <td>Cohesion</td>
              <td>${report.previous_quarter.cohesion ?? '-'}</td>
              <td>${report.quarter_averages.cohesion ?? '-'}</td>
              <td>${report.quarter_comparison?.cohesion_diff !== null ? (report.quarter_comparison.cohesion_diff >= 0 ? '+' : '') + report.quarter_comparison.cohesion_diff : '-'}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          <p>Generated on ${new Date(report.generated_at).toLocaleString()}</p>
          <p>VoidStaff OS - Quarterly Performance Report</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getMetricColor = (value) => {
    if (value === null) return 'neutral';
    if (value >= 6.5) return 'green';
    if (value >= 5) return 'amber';
    return 'red';
  };

  if (loading) {
    return (
      <div className="quarterly-report-container">
        <div className="loading">Loading quarterly report...</div>
      </div>
    );
  }

  return (
    <div className="quarterly-report-container">
      <div className="quarterly-report-header">
        <div className="header-left">
          <h2>Quarterly Performance Report</h2>
          <div className="quarter-selector">
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
            >
              {quarters.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={handleExportPDF} className="export-btn">
            Export PDF
          </button>
          <button onClick={onClose} className="back-btn">
            Back
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {report && (
        <div className="quarterly-report-content" ref={reportRef}>
          {/* Employee Info */}
          <div className="report-employee-info">
            <div className="employee-name">{report.employee.full_name}</div>
            <div className="employee-details">
              <span>{report.employee.department || 'No Department'}</span>
              <span className="separator">|</span>
              <span>Manager: {report.employee.manager_name || 'None'}</span>
              <span className="separator">|</span>
              <span>{report.quarter_averages.reviews_count} reviews this quarter</span>
            </div>
          </div>

          {/* Summary Metrics */}
          <div className="report-section">
            <h3>Summary Metrics</h3>
            <div className="summary-metrics-grid">
              <MetricSummaryCard
                label="Velocity"
                value={report.quarter_averages.velocity}
                previousValue={report.previous_quarter?.velocity}
                trend={report.trends.velocity}
                color={getMetricColor(report.quarter_averages.velocity)}
              />
              <MetricSummaryCard
                label="Friction"
                value={report.quarter_averages.friction}
                previousValue={report.previous_quarter?.friction}
                trend={report.trends.friction}
                color={getMetricColor(report.quarter_averages.friction)}
              />
              <MetricSummaryCard
                label="Cohesion"
                value={report.quarter_averages.cohesion}
                previousValue={report.previous_quarter?.cohesion}
                trend={report.trends.cohesion}
                color={getMetricColor(report.quarter_averages.cohesion)}
              />
            </div>
          </div>

          {/* Weekly Trends Charts */}
          <div className="report-section">
            <h3>Weekly Trends (13 Weeks)</h3>
            <div className="charts-grid">
              <div className="chart-card">
                <h4>Velocity</h4>
                <LineChart
                  data={report.weekly_trends}
                  dataKeys={['velocity']}
                  colors={['#134e4a']}
                />
              </div>
              <div className="chart-card">
                <h4>Friction</h4>
                <LineChart
                  data={report.weekly_trends}
                  dataKeys={['friction']}
                  colors={['#3498db']}
                />
              </div>
              <div className="chart-card">
                <h4>Cohesion</h4>
                <LineChart
                  data={report.weekly_trends}
                  dataKeys={['cohesion']}
                  colors={['#2ed573']}
                />
              </div>
            </div>
          </div>

          {/* All Metrics Combined */}
          <div className="report-section">
            <h3>All Metrics Overview</h3>
            <div className="chart-card full-width">
              <LineChart
                data={report.weekly_trends}
                dataKeys={['velocity', 'friction', 'cohesion']}
                colors={['#134e4a', '#3498db', '#2ed573']}
                height={250}
              />
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-color" style={{background: '#134e4a'}}></span> Velocity</span>
                <span className="legend-item"><span className="legend-color" style={{background: '#3498db'}}></span> Friction</span>
                <span className="legend-item"><span className="legend-color" style={{background: '#2ed573'}}></span> Cohesion</span>
              </div>
            </div>
          </div>

          {/* Monthly Comparison */}
          <div className="report-section">
            <h3>Monthly Manager vs Self Comparison</h3>
            <div className="comparison-charts-grid">
              {['velocity', 'friction', 'cohesion'].map(metric => (
                <div className="chart-card" key={metric}>
                  <h4>{metric.charAt(0).toUpperCase() + metric.slice(1)}</h4>
                  <ComparisonChart
                    data={report.monthly_comparison.map(m => ({
                      month: m.month,
                      manager: { [metric]: m.manager[metric] },
                      self: { [metric]: m.self[metric] }
                    }))}
                  />
                  <div className="chart-legend small">
                    <span className="legend-item"><span className="legend-color manager"></span> Manager</span>
                    <span className="legend-item"><span className="legend-color self"></span> Self</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Previous Quarter Comparison */}
          {report.previous_quarter && (
            <div className="report-section">
              <h3>Quarter-over-Quarter Comparison</h3>
              <div className="quarter-comparison-card">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>{report.previous_quarter.label}</th>
                      <th>{report.quarter.label}</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Velocity</td>
                      <td>{report.previous_quarter.velocity ?? '-'}</td>
                      <td>{report.quarter_averages.velocity ?? '-'}</td>
                      <td className={report.quarter_comparison?.velocity_diff >= 0 ? 'positive' : 'negative'}>
                        {report.quarter_comparison?.velocity_diff !== null
                          ? (report.quarter_comparison.velocity_diff >= 0 ? '+' : '') + report.quarter_comparison.velocity_diff
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td>Friction</td>
                      <td>{report.previous_quarter.friction ?? '-'}</td>
                      <td>{report.quarter_averages.friction ?? '-'}</td>
                      <td className={report.quarter_comparison?.friction_diff >= 0 ? 'positive' : 'negative'}>
                        {report.quarter_comparison?.friction_diff !== null
                          ? (report.quarter_comparison.friction_diff >= 0 ? '+' : '') + report.quarter_comparison.friction_diff
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td>Cohesion</td>
                      <td>{report.previous_quarter.cohesion ?? '-'}</td>
                      <td>{report.quarter_averages.cohesion ?? '-'}</td>
                      <td className={report.quarter_comparison?.cohesion_diff >= 0 ? 'positive' : 'negative'}>
                        {report.quarter_comparison?.cohesion_diff !== null
                          ? (report.quarter_comparison.cohesion_diff >= 0 ? '+' : '') + report.quarter_comparison.cohesion_diff
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td>Reviews Count</td>
                      <td>{report.previous_quarter.reviews_count}</td>
                      <td>{report.quarter_averages.reviews_count}</td>
                      <td>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Weekly Data Table */}
          <div className="report-section">
            <h3>Detailed Weekly Data</h3>
            <div className="weekly-data-table">
              <table>
                <thead>
                  <tr>
                    <th>Week Ending</th>
                    <th>Velocity</th>
                    <th>Friction</th>
                    <th>Cohesion</th>
                    <th>Tasks</th>
                    <th>Volume</th>
                    <th>Problem</th>
                    <th>Comm.</th>
                    <th>Lead.</th>
                    <th>Reviewer</th>
                  </tr>
                </thead>
                <tbody>
                  {report.weekly_trends.map((week, i) => (
                    <tr key={i} className={week.has_data ? '' : 'no-data'}>
                      <td>{week.week_ending}</td>
                      <td>{week.velocity ?? '-'}</td>
                      <td>{week.friction ?? '-'}</td>
                      <td>{week.cohesion ?? '-'}</td>
                      <td>{week.tasks_completed ?? '-'}</td>
                      <td>{week.work_volume ?? '-'}</td>
                      <td>{week.problem_solving ?? '-'}</td>
                      <td>{week.communication ?? '-'}</td>
                      <td>{week.leadership ?? '-'}</td>
                      <td>{week.reviewer_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Report Footer */}
          <div className="report-footer">
            <span>Generated on {new Date(report.generated_at).toLocaleString()}</span>
          </div>
        </div>
      )}

      {!report && !error && quarters.length === 0 && (
        <div className="no-data-message">
          No review data available for quarterly reports.
        </div>
      )}
    </div>
  );
}

export default QuarterlyReport;
