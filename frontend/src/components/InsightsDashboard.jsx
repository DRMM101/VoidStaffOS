/**
 * HeadOfficeOS - Absence Insights Dashboard
 * HR dashboard for reviewing detected absence patterns.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: Absence Insights
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import InsightCard from './InsightCard';
import InsightReviewModal from './InsightReviewModal';

function InsightsDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    fetchDashboard();
    fetchInsights();
  }, [activeTab, filterType]);

  const fetchDashboard = async () => {
    try {
      const data = await apiFetch('/api/absence-insights/dashboard');
      setDashboardData(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  const fetchInsights = async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/api/absence-insights?limit=100';
      // For pending tab, we fetch all and filter client-side since API takes single status
      if (activeTab === 'reviewed') {
        url += '&status=reviewed';
      } else if (activeTab === 'actioned') {
        url += '&status=action_taken';
      } else if (activeTab === 'dismissed') {
        url += '&status=dismissed';
      }
      // Note: pending tab doesn't add status filter - we filter below

      if (filterType) {
        url += `&pattern_type=${filterType}`;
      }

      const data = await apiFetch(url);
      let filteredInsights = data.insights || [];

      // Client-side filter for pending (new + pending_review)
      if (activeTab === 'pending') {
        filteredInsights = filteredInsights.filter(i =>
          i.status === 'new' || i.status === 'pending_review'
        );
      }

      setInsights(filteredInsights);
    } catch (err) {
      console.error('Fetch insights error:', err);
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const handleInsightClick = (insight) => {
    setSelectedInsight(insight);
  };

  const handleModalClose = () => {
    setSelectedInsight(null);
    fetchInsights();
    fetchDashboard();
  };

  const getPatternLabel = (type) => {
    const labels = {
      frequency: 'High Frequency',
      monday_friday: 'Monday/Friday Pattern',
      post_holiday: 'Post-Holiday',
      duration_trend: 'Duration Trend',
      short_notice: 'Short Notice',
      recurring_reason: 'Recurring Reason',
      seasonal: 'Seasonal'
    };
    return labels[type] || type;
  };

  const getPatternIcon = (type) => {
    const icons = {
      frequency: '📊',
      monday_friday: '📅',
      post_holiday: '🏖️',
      duration_trend: '📈',
      short_notice: '⏰',
      recurring_reason: '🔄',
      seasonal: '🍂'
    };
    return icons[type] || '📋';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#555';
    }
  };

  return (
    <div className="insights-dashboard" style={{ padding: '20px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>Absence Insights</h2>
        <p style={{ margin: '8px 0 0', color: '#fff', fontSize: '14px' }}>
          Wellbeing-focused absence pattern detection for HR review
        </p>
      </div>

      {/* Dashboard Overview */}
      {dashboardData && (
        <div className="insights-overview" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #2196f3'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#2196f3' }}>
              {dashboardData.overview?.pending_count || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              Pending Review
            </div>
          </div>

          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #f44336'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#f44336' }}>
              {dashboardData.overview?.high_priority_count || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              High Priority
            </div>
          </div>

          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #4caf50'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#4caf50' }}>
              {dashboardData.overview?.new_count || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              New This Week
            </div>
          </div>

          <div className="stat-card" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #9c27b0'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#9c27b0' }}>
              {dashboardData.overview?.recent_count || 0}
            </div>
            <div style={{ color: '#111', fontSize: '14px', marginTop: '4px' }}>
              Last 7 Days
            </div>
          </div>
        </div>
      )}

      {/* Pattern Breakdown */}
      {dashboardData?.pattern_breakdown && dashboardData.pattern_breakdown.length > 0 && (
        <div className="pattern-breakdown" style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#111' }}>
            Active Patterns by Type
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {dashboardData.pattern_breakdown.map(item => (
              <button
                key={item.pattern_type}
                onClick={() => setFilterType(filterType === item.pattern_type ? '' : item.pattern_type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: filterType === item.pattern_type ? '2px solid #1976d2' : '1px solid #e0e0e0',
                  background: filterType === item.pattern_type ? '#e3f2fd' : '#f5f5f5',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#111'
                }}
              >
                <span>{getPatternIcon(item.pattern_type)}</span>
                <span>{getPatternLabel(item.pattern_type)}</span>
                <span style={{
                  background: '#1976d2',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs" style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '12px'
      }}>
        {['pending', 'reviewed', 'actioned', 'dismissed'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab ? '#1976d2' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '600' : '500',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'pending' ? 'Pending Review' : tab}
          </button>
        ))}
      </div>

      {/* Insights List */}
      {error && (
        <div style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#111' }}>
          Loading insights...
        </div>
      ) : insights.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f5f5f5',
          borderRadius: '12px',
          color: '#111'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <h3 style={{ margin: '0 0 8px', color: '#111' }}>
            {activeTab === 'pending' ? 'All caught up!' : `No ${activeTab} insights`}
          </h3>
          <p style={{ margin: 0, fontSize: '14px' }}>
            {activeTab === 'pending'
              ? 'There are no absence patterns requiring review at this time.'
              : `No insights have been ${activeTab}.`}
          </p>
        </div>
      ) : (
        <div className="insights-list" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {insights.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onClick={() => handleInsightClick(insight)}
              getPatternLabel={getPatternLabel}
              getPatternIcon={getPatternIcon}
              getPriorityColor={getPriorityColor}
            />
          ))}
        </div>
      )}

      {/* Top Bradford Scores */}
      {dashboardData?.top_bradford_scores && dashboardData.top_bradford_scores.length > 0 && (
        <div className="bradford-section" style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#111' }}>
            Bradford Factor Scores
          </h3>
          <p style={{ fontSize: '13px', color: '#111', marginBottom: '16px' }}>
            Bradford Factor = S² × D (Spells squared × Days). Higher scores indicate more frequent short absences.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#111', fontSize: '13px' }}>Employee</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#111', fontSize: '13px' }}>Bradford</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#111', fontSize: '13px' }}>Absences (12m)</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#111', fontSize: '13px' }}>Days (12m)</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.top_bradford_scores.map(emp => {
                let bradfordColor = '#4caf50';
                if (emp.bradford_factor >= 500) bradfordColor = '#f44336';
                else if (emp.bradford_factor >= 200) bradfordColor = '#ff9800';

                return (
                  <tr key={emp.employee_id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '12px', color: '#111' }}>
                      <div style={{ fontWeight: '500' }}>{emp.employee_name}</div>
                      <div style={{ fontSize: '12px', color: '#111' }}>{emp.employee_number}</div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        background: bradfordColor,
                        color: '#fff',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        {emp.bradford_factor}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#111' }}>
                      {emp.total_absences_12m}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#111' }}>
                      {emp.total_sick_days_12m}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selectedInsight && (
        <InsightReviewModal
          insight={selectedInsight}
          onClose={handleModalClose}
          getPatternLabel={getPatternLabel}
          getPatternIcon={getPatternIcon}
          getPriorityColor={getPriorityColor}
        />
      )}
    </div>
  );
}

export default InsightsDashboard;
