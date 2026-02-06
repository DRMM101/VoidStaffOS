/**
 * HeadOfficeOS - Probation Module
 * Main probation management interface.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState } from 'react';
import ProbationDashboard from './probation/ProbationDashboard';
import ProbationStatus from './probation/ProbationStatus';
import ProbationReviewForm from './probation/ProbationReviewForm';

function Probation({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProbation, setSelectedProbation] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);

  const isHR = user && (user.tier >= 60 || user.role_name === 'Admin' || user.role_name === 'HR Manager');
  const isManager = user && (user.tier >= 50 || user.role_name === 'Admin' || user.role_name === 'HR Manager');

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setSelectedProbation(null);
    setSelectedReview(null);
  };

  const handleSelectProbation = (probation) => {
    setSelectedProbation(probation);
    // Could navigate to detail view or expand
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return isHR ? (
          <ProbationDashboard
            user={user}
            onSelectProbation={handleSelectProbation}
          />
        ) : (
          <div className="access-denied">
            <p>HR access required to view the probation dashboard.</p>
          </div>
        );
      case 'my-probation':
        return <ProbationStatus user={user} />;
      default:
        return null;
    }
  };

  return (
    <div className="probation-container">
      <div className="probation-header">
        <div>
          <h1>Probation Management</h1>
          <p className="probation-subtitle">Track and manage employee probation periods</p>
        </div>
      </div>

      <div className="probation-tabs">
        {isHR && (
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabClick('dashboard')}
          >
            Dashboard
          </button>
        )}
        <button
          type="button"
          className={`tab-btn ${activeTab === 'my-probation' ? 'active' : ''}`}
          onClick={() => handleTabClick('my-probation')}
        >
          My Probation
        </button>
      </div>

      <div className="probation-content">
        {renderTabContent()}
      </div>

      {/* Review Form Modal */}
      {selectedReview && (
        <ProbationReviewForm
          reviewId={selectedReview.id}
          onClose={() => setSelectedReview(null)}
          onSuccess={() => {
            setSelectedReview(null);
            // Refresh
          }}
        />
      )}
    </div>
  );
}

export default Probation;
