/**
 * HeadOfficeOS - Candidate Pipeline Progress Component
 * Visual progress indicator for candidate stages.
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
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

import './CandidatePipelineProgress.css';

const STAGES = [
  { id: 'application', label: 'Application' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview_requested', label: 'Interview' },
  { id: 'interview_scheduled', label: 'Scheduled' },
  { id: 'interview_complete', label: 'Interviewed' },
  { id: 'final_shortlist', label: 'Shortlist' },
  { id: 'offer_made', label: 'Offer' },
  { id: 'offer_accepted', label: 'Accepted' }
];

const TERMINAL_STAGES = ['offer_declined', 'rejected', 'withdrawn'];

export default function CandidatePipelineProgress({ currentStage, stageHistory }) {
  const currentIndex = STAGES.findIndex(s => s.id === currentStage);
  const isTerminal = TERMINAL_STAGES.includes(currentStage);

  function getStageStatus(stage, index) {
    if (isTerminal) {
      // Check if this stage was reached before terminal
      const wasReached = stageHistory.some(h => h.to_stage === stage.id);
      return wasReached ? 'completed' : 'future';
    }

    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'future';
  }

  function formatStageName(stage) {
    return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className="pipeline-progress">
      <div className="progress-bar">
        {STAGES.map((stage, index) => {
          const status = getStageStatus(stage, index);
          return (
            <div key={stage.id} className={`progress-step ${status}`}>
              <div className="step-dot">
                {status === 'completed' && <span>✓</span>}
                {status === 'current' && <span>{index + 1}</span>}
                {status === 'future' && <span>{index + 1}</span>}
              </div>
              <span className="step-label">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {isTerminal && (
        <div className={`terminal-status ${currentStage}`}>
          {formatStageName(currentStage)}
        </div>
      )}

      {currentStage === 'further_assessment' && (
        <div className="assessment-badge">
          Further Assessment Required
        </div>
      )}
    </div>
  );
}
