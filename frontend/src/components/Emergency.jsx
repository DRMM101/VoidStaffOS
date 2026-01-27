/**
 * VoidStaffOS - Emergency Module
 * Main emergency contacts and medical information interface.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState } from 'react';
import EmergencyContacts from './EmergencyContacts';
import MedicalInfo from './MedicalInfo';
import EmergencyQuickView from './EmergencyQuickView';

function Emergency({ user }) {
  const [activeTab, setActiveTab] = useState('contacts');

  const isManager = user && (user.tier >= 50 || user.role_name === 'Admin' || user.role_name === 'HR Manager');

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contacts':
        return <EmergencyContacts user={user} />;
      case 'medical':
        return <MedicalInfo user={user} />;
      case 'team':
        return <EmergencyQuickView user={user} />;
      default:
        return <EmergencyContacts user={user} />;
    }
  };

  return (
    <div className="emergency-container">
      <div className="emergency-page-header">
        <h1>Emergency Information</h1>
        <p className="emergency-page-subtitle">
          Manage your emergency contacts and medical information
        </p>
      </div>

      <div className="emergency-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => handleTabClick('contacts')}
        >
          My Contacts
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'medical' ? 'active' : ''}`}
          onClick={() => handleTabClick('medical')}
        >
          Medical Info
        </button>
        {isManager && (
          <button
            type="button"
            className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => handleTabClick('team')}
          >
            Team Contacts
          </button>
        )}
      </div>

      <div className="emergency-content">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default Emergency;
