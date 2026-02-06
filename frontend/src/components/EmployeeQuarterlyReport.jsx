/**
 * HeadOfficeOS - Employee Quarterly Report Component
 * Displays employee's personal quarterly performance report.
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

  let minVal = 10, maxVal = 0;
  data.forEach(d => {
    dataKeys.forEach(key => {
      if (d[key] !== null && d[key] !== undefined) {
        minVal = Math.min(minVal, d[key]);
        maxVal = Math.max(maxVal, d[key]);
      }
    });
  });

  minVal = Math.max(0, Math.floor(minVal) - 1);
  maxVal = Math.min(10, Math.ceil(maxVal) + 1);

  const xScale = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v) => padding.top + chartHeight - ((v - minVal) / (maxVal - minVal)) * chartHeight;

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

function TrendIndicator({ trend }) {
  const icons = {
    improving: '↑',
    stable: '→',
    declining: '↓'
  };

  const labels = {
    improving: 'Improving',
    stable: 'Stable',
    declining: 'Needs Focus'
  };

  return (
    <div className={`trend-indicator ${trend}`}>
      <span className="trend-icon">{icons[trend]}</span>
      <span className="trend-label">{labels[trend]}</span>
    </div>
  );
}

function MetricSummaryCard({ label, value, managerValue, selfValue, trend, color }) {
  const hasBothValues = managerValue !== null && selfValue !== null;
  const diff = hasBothValues ? (selfValue - managerValue).toFixed(2) : null;

  return (
    <div className={`metric-summary-card ${color}`}>
      <div className="metric-summary-label">{label}</div>
      <div className="metric-summary-value">{value !== null ? value : '-'}</div>
      {hasBothValues && (
        <div className="comparison-detail">
          <div className="comparison-row">
            <span className="comparison-label">Manager:</span>
            <span className="comparison-value">{managerValue}</span>
          </div>
          <div className="comparison-row">
            <span className="comparison-label">Self:</span>
            <span className="comparison-value">{selfValue}</span>
          </div>
          <div className={`comparison-diff ${parseFloat(diff) >= 0 ? 'positive' : 'negative'}`}>
            Gap: {parseFloat(diff) >= 0 ? '+' : ''}{diff}
          </div>
        </div>
      )}
      <TrendIndicator trend={trend} />
    </div>
  );
}

function ImprovementCard({ metric, trend, value }) {
  if (trend !== 'declining' && value >= 6.5) return null;

  const tips = {
    velocity: [
      'Focus on completing tasks efficiently',
      'Break down large tasks into smaller deliverables',
      'Prioritize high-impact work items'
    ],
    friction: [
      'Improve communication with stakeholders',
      'Provide more frequent status updates',
      'Document decisions and rationale'
    ],
    cohesion: [
      'Participate more actively in team discussions',
      'Share knowledge with teammates',
      'Take initiative in problem-solving sessions'
    ]
  };

  const metricTips = tips[metric.toLowerCase()] || [];

  return (
    <div className="improvement-card">
      <h4>{metric}</h4>
      <p className="improvement-status">
        {trend === 'declining' ? 'Trending down' : value < 5 ? 'Below target' : 'Needs attention'}
      </p>
      <ul className="improvement-tips">
        {metricTips.map((tip, i) => (
          <li key={i}>{tip}</li>
        ))}
      </ul>
    </div>
  );
}

function EmployeeQuarterlyReport({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [quarters, setQuarters] = useState([]);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const reportRef = useRef(null);

  useEffect(() => {
    fetchAvailableQuarters();
  }, [user.id]);

  useEffect(() => {
    if (selectedQuarter) {
      fetchReport();
    }
  }, [selectedQuarter]);

  const fetchAvailableQuarters = async () => {
    try {
      const response = await fetch(`/api/reports/quarters/${user.id}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok) {
        setQuarters(data.quarters);
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
      const response = await fetch(`/api/reports/quarterly/${user.id}/${selectedQuarter}`, {
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

  const getMetricColor = (value) => {
    if (value === null) return 'neutral';
    if (value >= 6.5) return 'green';
    if (value >= 5) return 'amber';
    return 'red';
  };

  // Calculate average self-assessment values
  const getSelfAverage = (metric) => {
    if (!report?.monthly_comparison) return null;
    const values = report.monthly_comparison
      .map(m => m.self[metric])
      .filter(v => v !== null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
  };

  if (loading) {
    return (
      <div className="employee-report-container">
        <div className="loading">Loading your performance report...</div>
      </div>
    );
  }

  return (
    <div className="employee-report-container">
      <div className="employee-report-header">
        <div className="header-left">
          <h2>My Performance Report</h2>
          {quarters.length > 0 && (
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
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {report && (
        <div className="employee-report-content" ref={reportRef}>
          {/* Summary Section */}
          <div className="report-section highlight-section">
            <h3>Your Quarter Summary</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-value">{report.quarter_averages.reviews_count}</span>
                <span className="stat-label">Manager Snapshots</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{report.quarter_averages.self_assessments_count}</span>
                <span className="stat-label">Self Assessments</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{report.quarter_averages.weeks_with_data}/13</span>
                <span className="stat-label">Weeks Tracked</span>
              </div>
            </div>
          </div>

          {/* KPI Cards with Self vs Manager Comparison */}
          <div className="report-section">
            <h3>Key Performance Indicators</h3>
            <p className="section-description">
              Compare your self-assessments with your manager's ratings
            </p>
            <div className="summary-metrics-grid">
              <MetricSummaryCard
                label="Velocity"
                value={report.quarter_averages.velocity}
                managerValue={report.quarter_averages.velocity}
                selfValue={getSelfAverage('velocity')}
                trend={report.trends.velocity}
                color={getMetricColor(report.quarter_averages.velocity)}
              />
              <MetricSummaryCard
                label="Friction"
                value={report.quarter_averages.friction}
                managerValue={report.quarter_averages.friction}
                selfValue={getSelfAverage('friction')}
                trend={report.trends.friction}
                color={getMetricColor(report.quarter_averages.friction)}
              />
              <MetricSummaryCard
                label="Cohesion"
                value={report.quarter_averages.cohesion}
                managerValue={report.quarter_averages.cohesion}
                selfValue={getSelfAverage('cohesion')}
                trend={report.trends.cohesion}
                color={getMetricColor(report.quarter_averages.cohesion)}
              />
            </div>
          </div>

          {/* Areas for Improvement */}
          <div className="report-section">
            <h3>Focus Areas</h3>
            <div className="improvement-grid">
              <ImprovementCard
                metric="Velocity"
                trend={report.trends.velocity}
                value={report.quarter_averages.velocity}
              />
              <ImprovementCard
                metric="Friction"
                trend={report.trends.friction}
                value={report.quarter_averages.friction}
              />
              <ImprovementCard
                metric="Cohesion"
                trend={report.trends.cohesion}
                value={report.quarter_averages.cohesion}
              />
            </div>
            {report.trends.velocity !== 'declining' &&
             report.trends.friction !== 'declining' &&
             report.trends.cohesion !== 'declining' &&
             report.quarter_averages.velocity >= 6.5 &&
             report.quarter_averages.friction >= 6.5 &&
             report.quarter_averages.cohesion >= 6.5 && (
              <div className="all-good-message">
                Great job! All your metrics are on track. Keep up the excellent work!
              </div>
            )}
          </div>

          {/* Progress Over Time */}
          <div className="report-section">
            <h3>Your Progress Over Time</h3>
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

          {/* Monthly Self vs Manager */}
          <div className="report-section">
            <h3>Monthly Self vs Manager Assessment</h3>
            <div className="monthly-comparison-table">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Metric</th>
                    <th>Manager</th>
                    <th>Self</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {report.monthly_comparison.map((month, idx) => (
                    ['velocity', 'friction', 'cohesion'].map((metric, mIdx) => (
                      <tr key={`${idx}-${metric}`}>
                        {mIdx === 0 && <td rowSpan="3">{month.month}</td>}
                        <td className="metric-name">{metric.charAt(0).toUpperCase() + metric.slice(1)}</td>
                        <td>{month.manager[metric] ?? '-'}</td>
                        <td>{month.self[metric] ?? '-'}</td>
                        <td className={
                          month.manager[metric] && month.self[metric]
                            ? (month.self[metric] - month.manager[metric]) >= 0 ? 'positive' : 'negative'
                            : ''
                        }>
                          {month.manager[metric] && month.self[metric]
                            ? (month.self[metric] - month.manager[metric] >= 0 ? '+' : '') +
                              (month.self[metric] - month.manager[metric]).toFixed(2)
                            : '-'}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Previous Quarter Comparison */}
          {report.previous_quarter && (
            <div className="report-section">
              <h3>Compared to Last Quarter</h3>
              <div className="quarter-comparison-simple">
                <div className={`comparison-item ${report.quarter_comparison?.velocity_diff >= 0 ? 'positive' : 'negative'}`}>
                  <span className="comparison-metric">Velocity</span>
                  <span className="comparison-change">
                    {report.quarter_comparison?.velocity_diff !== null
                      ? (report.quarter_comparison.velocity_diff >= 0 ? '+' : '') + report.quarter_comparison.velocity_diff
                      : '-'}
                  </span>
                </div>
                <div className={`comparison-item ${report.quarter_comparison?.friction_diff >= 0 ? 'positive' : 'negative'}`}>
                  <span className="comparison-metric">Friction</span>
                  <span className="comparison-change">
                    {report.quarter_comparison?.friction_diff !== null
                      ? (report.quarter_comparison.friction_diff >= 0 ? '+' : '') + report.quarter_comparison.friction_diff
                      : '-'}
                  </span>
                </div>
                <div className={`comparison-item ${report.quarter_comparison?.cohesion_diff >= 0 ? 'positive' : 'negative'}`}>
                  <span className="comparison-metric">Cohesion</span>
                  <span className="comparison-change">
                    {report.quarter_comparison?.cohesion_diff !== null
                      ? (report.quarter_comparison.cohesion_diff >= 0 ? '+' : '') + report.quarter_comparison.cohesion_diff
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="report-footer">
            <span>Report for {report.quarter.label} | Generated on {new Date(report.generated_at).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {!report && !error && quarters.length === 0 && (
        <div className="no-data-message">
          <h3>No Performance Data Yet</h3>
          <p>Your manager hasn't submitted any performance snapshots for you yet.</p>
          <p>Check back after your first weekly review!</p>
        </div>
      )}
    </div>
  );
}

export default EmployeeQuarterlyReport;
