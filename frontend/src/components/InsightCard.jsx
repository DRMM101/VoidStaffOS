/**
 * HeadOfficeOS - Insight Card Component
 * Displays a single absence insight in a card format.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Author: D.R.M. Manthorpe
 * Module: Absence Insights
 */

function InsightCard({ insight, onClick, getPatternLabel, getPatternIcon, getPriorityColor }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: { bg: '#e3f2fd', color: '#1565c0', label: 'New' },
      pending_review: { bg: '#fff3e0', color: '#e65100', label: 'Pending' },
      reviewed: { bg: '#e8f5e9', color: '#2e7d32', label: 'Reviewed' },
      action_taken: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Actioned' },
      dismissed: { bg: '#f5f5f5', color: '#616161', label: 'Dismissed' }
    };
    const style = styles[status] || styles.pending_review;
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        background: style.bg,
        color: style.color,
        fontSize: '12px',
        fontWeight: '500'
      }}>
        {style.label}
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        borderLeft: `4px solid ${getPriorityColor(insight.priority)}`,
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Icon */}
      <div style={{
        fontSize: '28px',
        width: '48px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        borderRadius: '12px',
        flexShrink: 0
      }}>
        {getPatternIcon(insight.pattern_type)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px',
          flexWrap: 'wrap'
        }}>
          <span style={{
            fontWeight: '600',
            color: '#111',
            fontSize: '15px'
          }}>
            {insight.employee_name}
          </span>
          <span style={{
            color: '#111',
            fontSize: '13px'
          }}>
            {insight.employee_number}
          </span>
          {getStatusBadge(insight.status)}
          <span style={{
            padding: '4px 10px',
            borderRadius: '12px',
            background: `${getPriorityColor(insight.priority)}15`,
            color: getPriorityColor(insight.priority),
            fontSize: '12px',
            fontWeight: '500',
            textTransform: 'capitalize'
          }}>
            {insight.priority}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <span style={{
            background: '#e8f5e9',
            color: '#2e7d32',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {getPatternLabel(insight.pattern_type)}
          </span>
          <span style={{ color: '#111', fontSize: '13px' }}>
            Detected {formatDate(insight.detection_date)}
          </span>
        </div>

        <p style={{
          margin: 0,
          color: '#111',
          fontSize: '14px',
          lineHeight: 1.5
        }}>
          {insight.summary}
        </p>

        {insight.review_notes && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#f5f5f5',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#111'
          }}>
            <strong>Review note:</strong> {insight.review_notes}
          </div>
        )}
      </div>

      {/* Arrow */}
      <div style={{
        color: '#555',
        fontSize: '20px',
        alignSelf: 'center'
      }}>
        →
      </div>
    </div>
  );
}

export default InsightCard;
