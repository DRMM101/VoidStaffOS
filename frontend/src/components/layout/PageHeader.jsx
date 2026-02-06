// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — PageHeader Component
 * Reusable page header with title, subtitle, and optional action buttons.
 * Sits at the top of each page within the content area.
 */

/**
 * @param {string}  title     - Page title (required)
 * @param {string}  [subtitle] - Optional subtitle text
 * @param {React.ReactNode} [actions] - Action buttons rendered on the right
 * @param {string}  [className] - Additional CSS class
 */
function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`page-header ${className}`}>
      {/* Title + subtitle block */}
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>

      {/* Action buttons (right-aligned) */}
      {actions && (
        <div className="page-header__actions">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
