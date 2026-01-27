/**
 * VoidStaffOS - Emergency Contacts
 * Employee emergency contact management with priority ordering.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const relationshipTypes = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'child', label: 'Child' },
  { value: 'friend', label: 'Friend' },
  { value: 'colleague', label: 'Colleague' },
  { value: 'other', label: 'Other' }
];

function EmergencyContacts({ user }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [error, setError] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [formData, setFormData] = useState({
    contact_name: '',
    relationship: 'spouse',
    phone: '',
    mobile: '',
    email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    country: 'United Kingdom',
    is_next_of_kin: false,
    notes: ''
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/emergency/contacts', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to load contacts');
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Failed to load emergency contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const url = editingContact
        ? `/api/emergency/contacts/${editingContact.id}`
        : '/api/emergency/contacts';
      const method = editingContact ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowForm(false);
        setEditingContact(null);
        resetForm();
        fetchContacts();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to save contact');
      }
    } catch (err) {
      console.error('Error saving contact:', err);
      setError('Failed to save contact');
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      contact_name: contact.contact_name || '',
      relationship: contact.relationship || 'spouse',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      email: contact.email || '',
      address_line1: contact.address_line1 || '',
      address_line2: contact.address_line2 || '',
      city: contact.city || '',
      postcode: contact.postcode || '',
      country: contact.country || 'United Kingdom',
      is_next_of_kin: contact.is_next_of_kin || false,
      notes: contact.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this emergency contact?')) {
      return;
    }

    try {
      const response = await apiFetch(`/api/emergency/contacts/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchContacts();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to delete contact');
      }
    } catch (err) {
      console.error('Error deleting contact:', err);
      setError('Failed to delete contact');
    }
  };

  const resetForm = () => {
    setFormData({
      contact_name: '',
      relationship: 'spouse',
      phone: '',
      mobile: '',
      email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      postcode: '',
      country: 'United Kingdom',
      is_next_of_kin: false,
      notes: ''
    });
  };

  // Drag and drop handlers for reordering
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newContacts = [...contacts];
    const [draggedContact] = newContacts.splice(draggedIndex, 1);
    newContacts.splice(dropIndex, 0, draggedContact);

    // Update local state immediately for responsiveness
    setContacts(newContacts);
    setDraggedIndex(null);

    // Send new order to server
    try {
      const order = newContacts.map(c => c.id);
      const response = await apiFetch('/api/emergency/contacts/reorder', {
        method: 'PUT',
        body: JSON.stringify({ order })
      });

      if (response.ok) {
        const updated = await response.json();
        setContacts(updated);
      } else {
        // Revert on error
        fetchContacts();
      }
    } catch (err) {
      console.error('Error reordering contacts:', err);
      fetchContacts();
    }
  };

  const formatRelationship = (rel) => {
    const found = relationshipTypes.find(r => r.value === rel);
    return found ? found.label : rel;
  };

  if (loading) {
    return <div className="loading">Loading emergency contacts...</div>;
  }

  return (
    <div className="emergency-contacts">
      <div className="emergency-header">
        <div>
          <h2>Emergency Contacts</h2>
          <p className="emergency-subtitle">
            Add up to 5 emergency contacts. Drag to reorder priority.
          </p>
        </div>
        {contacts.length < 5 && (
          <button
            className="btn-primary"
            onClick={() => {
              setEditingContact(null);
              resetForm();
              setShowForm(true);
            }}
          >
            + Add Contact
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal emergency-form-modal">
            <h3>{editingContact ? 'Edit Contact' : 'Add Emergency Contact'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Contact Name *</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Relationship *</label>
                  <select
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    required
                  >
                    {relationshipTypes.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Home phone"
                  />
                </div>
                <div className="form-group">
                  <label>Mobile</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="Mobile phone"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Address Line 1</label>
                <input
                  type="text"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Address Line 2</label>
                <input
                  type="text"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Postcode</label>
                  <input
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group checkbox-setting">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_next_of_kin}
                    onChange={(e) => setFormData({ ...formData, is_next_of_kin: e.target.checked })}
                  />
                  Designate as Next of Kin
                </label>
                <p className="setting-help">Only one contact can be designated as next of kin.</p>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="2"
                  placeholder="Any additional information"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => {
                  setShowForm(false);
                  setEditingContact(null);
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingContact ? 'Update' : 'Add'} Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="contacts-list">
        {contacts.length === 0 ? (
          <div className="no-data-message">
            <p>No emergency contacts added yet.</p>
            <p className="help-text">Add your emergency contacts so they can be reached in case of an emergency.</p>
          </div>
        ) : (
          contacts.map((contact, index) => (
            <div
              key={contact.id}
              className={`contact-card ${draggedIndex === index ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
            >
              <div className="contact-priority">
                <span className="priority-number">{index + 1}</span>
                <span className="drag-handle">&#9776;</span>
              </div>

              <div className="contact-details">
                <div className="contact-header">
                  <h4>{contact.contact_name}</h4>
                  <div className="contact-badges">
                    <span className="relationship-badge">{formatRelationship(contact.relationship)}</span>
                    {contact.is_next_of_kin && (
                      <span className="nok-badge">Next of Kin</span>
                    )}
                  </div>
                </div>

                <div className="contact-info">
                  {contact.phone && (
                    <div className="info-item">
                      <span className="info-label">Phone:</span>
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.mobile && (
                    <div className="info-item">
                      <span className="info-label">Mobile:</span>
                      <span>{contact.mobile}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="info-item">
                      <span className="info-label">Email:</span>
                      <span>{contact.email}</span>
                    </div>
                  )}
                  {(contact.address_line1 || contact.city) && (
                    <div className="info-item">
                      <span className="info-label">Address:</span>
                      <span>
                        {[contact.address_line1, contact.address_line2, contact.city, contact.postcode]
                          .filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {contact.notes && (
                  <div className="contact-notes">
                    <small>{contact.notes}</small>
                  </div>
                )}
              </div>

              <div className="contact-actions">
                <button className="btn-small" onClick={() => handleEdit(contact)}>Edit</button>
                <button className="btn-small btn-danger" onClick={() => handleDelete(contact.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmergencyContacts;
