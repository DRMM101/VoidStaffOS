import './CandidatePipelineCard.css';

export default function CandidatePipelineCard({ candidate, stageInfo, onDragStart, onClick }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div
      className="pipeline-card"
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
    >
      <div className="card-header">
        <span className="candidate-name">{candidate.full_name}</span>
        <span
          className="stage-badge"
          style={{ backgroundColor: stageInfo?.color || '#6b7280' }}
        >
          {stageInfo?.label || candidate.recruitment_stage}
        </span>
      </div>
      <div className="card-body">
        {candidate.role_title && (
          <div className="card-role">{candidate.role_title}</div>
        )}
        <div className="card-email">{candidate.email}</div>
      </div>
      <div className="card-footer">
        <span className="card-date">
          {formatDate(candidate.recruitment_stage_updated_at)}
        </span>
      </div>
    </div>
  );
}
