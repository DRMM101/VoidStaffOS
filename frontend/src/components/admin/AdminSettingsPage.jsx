// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — Admin Settings Page
 * Hub page linking to all admin settings areas:
 * Role Management, Compensation Settings, and system info.
 */

import { Users, PoundSterling, Shield, Info } from 'lucide-react';

/* Settings card definitions — each links to a sub-page */
const SETTINGS_CARDS = [
  {
    key: 'role-management',
    label: 'Role Management',
    description: 'Manage user roles, tiers, and additional responsibilities.',
    icon: Users,
  },
  {
    key: 'compensation-settings',
    label: 'Compensation Settings',
    description: 'Toggle bonus schemes, responsibility allowances, and tier-band linking.',
    icon: PoundSterling,
  },
  {
    key: 'compliance',
    label: 'Compliance',
    description: 'Right to Work, DBS checks, and document verification.',
    icon: Shield,
  },
];

function AdminSettingsPage({ user, onNavigate }) {
  /* Guard — only Admin can access */
  if (user.role_name !== 'Admin') {
    return (
      <div className="settings-page">
        <p className="settings-page__denied">Only administrators can access settings.</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Page heading */}
      <div className="settings-page__header">
        <h2>Settings</h2>
        <p className="settings-page__subtitle">Manage system configuration and admin tools.</p>
      </div>

      {/* Settings cards grid */}
      <div className="settings-page__grid">
        {SETTINGS_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              className="settings-page__card"
              onClick={() => onNavigate(card.key)}
              aria-label={`Go to ${card.label}`}
            >
              <div className="settings-page__card-icon">
                <Icon size={24} />
              </div>
              <div className="settings-page__card-body">
                <h3>{card.label}</h3>
                <p>{card.description}</p>
              </div>
            </button>
          );
        })}

        {/* System info placeholder — not a link */}
        <div className="settings-page__card settings-page__card--info">
          <div className="settings-page__card-icon">
            <Info size={24} />
          </div>
          <div className="settings-page__card-body">
            <h3>System Information</h3>
            <p>VoidStaffOS v0.1.0</p>
            <p className="settings-page__meta">Tenant: Default &middot; Node.js + PostgreSQL</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminSettingsPage;
