/**
 * VoidStaffOS - Emergency Quick View
 * Manager view of team emergency contacts (limited info).
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';

const relationshipLabels = {
  spouse: 'Spouse',
  partner: 'Partner',
  parent: 'Parent',
  sibling: 'Sibling',
  child: 'Child',
  friend: 'Friend',
  colleague: 'Colleague',
  other: 'Other'
};

function EmergencyQuickView({ user }) {
  const [teamContacts, setTeamContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isManager = user && (user.tier >= 50 || user.role_name === 'Admin' || user.role_name === 'HR Manager');

  useEffect(() => {
    if (isManager) {
      fetchTeamContacts();
    }
  }, [isManager]);

  const fetchTeamContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/emergency/team', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTeamContacts(data);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load team contacts');
      }
    } catch (err) {
      console.error('Error fetching team contacts:', err);
      setError('Failed to load team emergency contacts');
    } finally {
      setLoading(false);
    }
  };

  if (!isManager) {
    return (
      <div className="emergency-quick-view">
        <div className="error-message">
          Manager access required (Tier 50+) to view team emergency contacts.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading team emergency contacts...</div>;
  }

  const filteredContacts = teamContacts.filter(contact =>
    contact.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.contact_name && contact.contact_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="emergency-quick-view">
      <div className="quick-view-header">
        <div>
          <h2>Team Emergency Contacts</h2>
          <p className="quick-view-subtitle">
            Quick access to your team members' primary emergency contacts.
          </p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="quick-view-search">
        <input
          type="text"
          placeholder="Search by employee or contact name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="quick-view-notice">
        <p>
          <strong>Note:</strong> This view shows limited information for emergency use only.
          For full details, contact HR.
        </p>
      </div>

      {filteredContacts.length === 0 ? (
        <div className="no-data-message">
          {teamContacts.length === 0
            ? 'No team members found or no emergency contacts on file.'
            : 'No matching team members found.'}
        </div>
      ) : (
        <div className="quick-view-table-container">
          <table className="quick-view-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee #</th>
                <th>Emergency Contact</th>
                <th>Relationship</th>
                <th>Phone</th>
                <th>Next of Kin</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => (
                <tr key={contact.employee_id} className={!contact.contact_id ? 'no-contact' : ''}>
                  <td>
                    <strong>{contact.employee_name}</strong>
                  </td>
                  <td>{contact.employee_number || '-'}</td>
                  <td>
                    {contact.contact_name || (
                      <span className="warning-text">No contact on file</span>
                    )}
                  </td>
                  <td>
                    {contact.relationship
                      ? relationshipLabels[contact.relationship] || contact.relationship
                      : '-'}
                  </td>
                  <td>
                    {contact.mobile || contact.phone || '-'}
                    {contact.mobile && contact.phone && (
                      <div className="secondary-phone">{contact.phone}</div>
                    )}
                  </td>
                  <td>
                    {contact.is_next_of_kin ? (
                      <span className="nok-indicator">Yes</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="quick-view-summary">
        <p>
          Showing {filteredContacts.length} of {teamContacts.length} team members
          {filteredContacts.filter(c => !c.contact_id).length > 0 && (
            <span className="warning-text">
              {' '}({filteredContacts.filter(c => !c.contact_id).length} without emergency contacts)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export default EmergencyQuickView;
