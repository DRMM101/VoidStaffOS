/**
 * VoidStaffOS - Candidate Notes Component
 * Notes management for candidates.
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

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import './CandidateNotes.css';

const NOTE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview_feedback', label: 'Interview Feedback' },
  { value: 'reference', label: 'Reference' },
  { value: 'concern', label: 'Concern' },
  { value: 'positive', label: 'Positive' }
];

export default function CandidateNotes({ candidateId, onNoteAdded }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    note_type: 'general',
    content: '',
    is_private: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotes();
  }, [candidateId]);

  async function fetchNotes() {
    try {
      const response = await fetch(`/api/pipeline/candidates/${candidateId}/notes`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.content.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await apiFetch(`/api/pipeline/candidates/${candidateId}/notes`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add note');
      }

      setFormData({ note_type: 'general', content: '', is_private: false });
      setShowForm(false);
      fetchNotes();
      if (onNoteAdded) onNoteAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function getNoteTypeIcon(type) {
    switch (type) {
      case 'screening': return '🔍';
      case 'interview_feedback': return '💬';
      case 'reference': return '📋';
      case 'concern': return '⚠️';
      case 'positive': return '✨';
      case 'stage_change': return '➡️';
      case 'offer': return '📄';
      default: return '📝';
    }
  }

  function getNoteTypeClass(type) {
    switch (type) {
      case 'concern': return 'note-concern';
      case 'positive': return 'note-positive';
      case 'stage_change': return 'note-stage';
      case 'offer': return 'note-offer';
      default: return '';
    }
  }

  if (loading) return <div className="loading">Loading notes...</div>;

  return (
    <div className="candidate-notes">
      <div className="notes-header">
        <h4>Notes ({notes.length})</h4>
        <button
          className="btn-add-note"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {showForm && (
        <form className="note-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select
                value={formData.note_type}
                onChange={e => setFormData({ ...formData, note_type: e.target.value })}
              >
                {NOTE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_private}
                  onChange={e => setFormData({ ...formData, is_private: e.target.checked })}
                />
                Private (only you and admin can see)
              </label>
            </div>
          </div>

          <div className="form-group">
            <textarea
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter your note..."
              rows={4}
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      )}

      <div className="notes-list">
        {notes.map(note => (
          <div key={note.id} className={`note-item ${getNoteTypeClass(note.note_type)}`}>
            <div className="note-header">
              <span className="note-type">
                {getNoteTypeIcon(note.note_type)} {note.note_type.replace('_', ' ')}
              </span>
              {note.is_private && <span className="private-badge">Private</span>}
              <span className="note-meta">
                {note.author_name} - {new Date(note.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="note-content">
              {note.content}
            </div>
            {note.from_stage && note.to_stage && (
              <div className="stage-change-info">
                {note.from_stage} → {note.to_stage}
              </div>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <p className="no-notes">No notes yet</p>
        )}
      </div>
    </div>
  );
}
