/**
 * VoidStaffOS - Document Manager Component
 * HR view for managing all employee documents.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 27/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Document Storage
 */

import { useState, useEffect } from 'react';
import api from '../utils/api';
import DocumentList from './DocumentList';
import DocumentUpload from './DocumentUpload';
import ExpiryDashboard from './ExpiryDashboard';

function DocumentManager({ user }) {
  const [view, setView] = useState('employees'); // 'employees', 'expiring', 'upload'
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (view === 'employees') {
      fetchEmployees();
    }
  }, [view]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await api.get('/documents/by-employee');
      setEmployees(data.employees || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (selectedEmployee) {
    return (
      <div className="document-manager">
        <div className="manager-header">
          <button className="btn btn-back" onClick={() => setSelectedEmployee(null)}>
            &larr; Back to Employees
          </button>
          <h2>{selectedEmployee.full_name}'s Documents</h2>
          <button
            className="btn btn-primary"
            onClick={() => setView('upload')}
          >
            + Upload Document
          </button>
        </div>

        {view === 'upload' ? (
          <DocumentUpload
            user={user}
            employeeId={selectedEmployee.employee_id}
            onClose={() => setView('employees')}
            onSuccess={() => {
              setView('employees');
              // Refresh will happen when we go back
            }}
          />
        ) : (
          <DocumentList
            user={user}
            employeeId={selectedEmployee.employee_id}
            isManager={true}
            onUpload={() => setView('upload')}
          />
        )}

        <style>{`
          .document-manager {
            padding: 20px;
          }

          .manager-header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 25px;
          }

          .manager-header h2 {
            flex: 1;
            margin: 0;
            color: #e0e0e0;
          }

          .btn-back {
            background: #e8e2d9;
            color: #e0e0e0;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }

          .btn-back:hover {
            background: #3a3a5a;
          }

          .btn-primary {
            background: #134e4a;
            color: #fff;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="document-manager">
      <div className="manager-header">
        <h2>Document Manager</h2>
        <div className="header-tabs">
          <button
            className={`tab-btn ${view === 'employees' ? 'active' : ''}`}
            onClick={() => setView('employees')}
          >
            By Employee
          </button>
          <button
            className={`tab-btn ${view === 'expiring' ? 'active' : ''}`}
            onClick={() => setView('expiring')}
          >
            Expiring Documents
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {view === 'expiring' ? (
        <ExpiryDashboard user={user} />
      ) : (
        <>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading">Loading employees...</div>
          ) : (
            <div className="employees-table-container">
              <table className="employees-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee #</th>
                    <th>Documents</th>
                    <th>Expired</th>
                    <th>Expiring Soon</th>
                    <th>Last Upload</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.employee_id}>
                      <td>
                        <div className="employee-info">
                          <span className="employee-name">{emp.full_name}</span>
                          <span className="employee-email">{emp.email}</span>
                        </div>
                      </td>
                      <td className="emp-number">{emp.employee_number || '-'}</td>
                      <td className="doc-count">
                        <span className="count-badge">{emp.active_documents || 0}</span>
                      </td>
                      <td className="doc-count">
                        {emp.expired_documents > 0 ? (
                          <span className="count-badge expired">{emp.expired_documents}</span>
                        ) : (
                          <span className="count-none">-</span>
                        )}
                      </td>
                      <td className="doc-count">
                        {emp.expiring_soon > 0 ? (
                          <span className="count-badge warning">{emp.expiring_soon}</span>
                        ) : (
                          <span className="count-none">-</span>
                        )}
                      </td>
                      <td className="date-cell">{formatDate(emp.last_upload)}</td>
                      <td>
                        <button
                          className="btn-view"
                          onClick={() => setSelectedEmployee(emp)}
                        >
                          View Documents
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredEmployees.length === 0 && (
                <div className="empty-state">
                  <p>No employees found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        .document-manager {
          padding: 20px;
        }

        .manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .manager-header h2 {
          margin: 0;
          color: #e0e0e0;
        }

        .header-tabs {
          display: flex;
          gap: 10px;
        }

        .tab-btn {
          padding: 10px 20px;
          background: #e8e2d9;
          border: none;
          border-radius: 8px;
          color: #a0a0a0;
          cursor: pointer;
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: #3a3a5a;
        }

        .tab-btn.active {
          background: #134e4a;
          color: #fff;
        }

        .search-bar {
          margin-bottom: 20px;
        }

        .search-bar input {
          width: 100%;
          max-width: 400px;
          padding: 12px 15px;
          background: #ffffff;
          border: 1px solid #e8e2d9;
          border-radius: 8px;
          color: #e0e0e0;
          font-size: 0.95rem;
        }

        .search-bar input:focus {
          outline: none;
          border-color: #134e4a;
        }

        .employees-table-container {
          overflow-x: auto;
        }

        .employees-table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
        }

        .employees-table th {
          text-align: left;
          padding: 15px;
          background: #f9f6f2;
          color: #a0a0a0;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
        }

        .employees-table td {
          padding: 15px;
          border: 1px solid #e8e2d9;
          color: #e0e0e0;
        }

        .employees-table tr:hover {
          background: #f9f6f2;
        }

        .employee-info {
          display: flex;
          flex-direction: column;
        }

        .employee-name {
          font-weight: 500;
        }

        .employee-email {
          font-size: 0.85rem;
          color: #808080;
        }

        .emp-number {
          font-family: monospace;
          color: #a0a0a0;
        }

        .doc-count {
          text-align: center;
        }

        .count-badge {
          display: inline-block;
          min-width: 28px;
          padding: 4px 10px;
          background: #e8e2d9;
          border-radius: 12px;
          font-weight: 600;
        }

        .count-badge.expired {
          background: #ff6b6b;
          color: #fff;
        }

        .count-badge.warning {
          background: #f7b731;
          color: #134e4a;
        }

        .count-none {
          color: #555;
        }

        .date-cell {
          color: #808080;
          font-size: 0.9rem;
        }

        .btn-view {
          padding: 8px 15px;
          background: #e8e2d9;
          border: none;
          border-radius: 6px;
          color: #134e4a;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .btn-view:hover {
          background: #3a3a5a;
        }

        .error-message {
          background: #2a1a1a;
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .loading {
          text-align: center;
          color: #808080;
          padding: 40px;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #808080;
        }
      `}</style>
    </div>
  );
}

export default DocumentManager;
