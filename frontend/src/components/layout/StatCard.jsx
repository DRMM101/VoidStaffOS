// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — StatCard Component
 * Reusable stat card for bento grid dashboards.
 * Shows label, value, optional trend arrow, and optional subtitle.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * @param {string}  label     - Stat label (e.g. "Total Employees")
 * @param {string|number} value - Main stat value
 * @param {string}  [trend]   - 'up' | 'down' | 'flat' — shows trend arrow
 * @param {string}  [trendValue] - Text to show next to trend (e.g. "+5%")
 * @param {string}  [subtitle] - Secondary text below value
 * @param {string}  [className] - Additional CSS class
 * @param {Function} [onClick] - Click handler for the card
 */
function StatCard({ label, value, trend, trendValue, subtitle, className = '', onClick }) {
  /* Select the appropriate trend icon */
  const TrendIcon = trend === 'up' ? TrendingUp
    : trend === 'down' ? TrendingDown
    : trend === 'flat' ? Minus
    : null;

  /* Determine trend colour class */
  const trendClass = trend === 'up' ? 'stat-card__trend--up'
    : trend === 'down' ? 'stat-card__trend--down'
    : 'stat-card__trend--flat';

  return (
    <div
      className={`stat-card ${onClick ? 'stat-card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* Label at top */}
      <span className="stat-card__label">{label}</span>

      {/* Main value */}
      <span className="stat-card__value">{value}</span>

      {/* Trend indicator row */}
      {trend && (
        <span className={`stat-card__trend ${trendClass}`}>
          {TrendIcon && <TrendIcon size={16} aria-hidden="true" />}
          {trendValue && <span className="stat-card__trend-value">{trendValue}</span>}
        </span>
      )}

      {/* Optional subtitle */}
      {subtitle && <span className="stat-card__subtitle">{subtitle}</span>}
    </div>
  );
}

export default StatCard;
