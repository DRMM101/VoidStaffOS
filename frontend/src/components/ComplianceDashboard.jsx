/**
 * HeadOfficeOS - Compliance Dashboard
 * Overview of RTW and DBS compliance status.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';

function ComplianceDashboard({ user, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compliance/dashboard', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'compliant': return 'status-compliant';
      case 'expiring': return 'status-warning';
      case 'update_due': return 'status-warning';
      case 'expired': return 'status-danger';
      case 'action_required': return 'status-danger';
      case 'missing': return 'status-missing';
      default: return '';
    }
  };

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const filteredEmployees = dashboardData?.employees?.filter(emp => {
    if (filter === 'all') return true;
    if (filter === 'rtw_issues') return emp.rtw_compliance !== 'compliant';
    if (filter === 'dbs_issues') return emp.dbs_compliance !== 'compliant';
    if (filter === 'compliant') return emp.rtw_compliance === 'compliant' && emp.dbs_compliance === 'compliant';
    return true;
  }) || [];

  if (loading) {
    return <div className="loading">Loading compliance data...</div>;
  }

  if (!dashboardData) {
    return <div className="error-message">Failed to load compliance data</div>;
  }

  const { stats } = dashboardData;

  return (
    <div className="compliance-dashboard">
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Total Employees</h3>
          <div className="stat-value">{stats.total_employees}</div>
        </div>

        <div className="stat-card rtw-card">
          <h3>RTW Status</h3>
          <div className="stat-breakdown">
            <div className="stat-row compliant">
              <span>Compliant</span>
              <span>{stats.rtw.compliant}</span>
            </div>
            <div className="stat-row warning">
              <span>Expiring</span>
              <span>{stats.rtw.expiring}</span>
            </div>
            <div className="stat-row danger">
              <span>Expired</span>
              <span>{stats.rtw.expired}</span>
            </div>
            <div className="stat-row missing">
              <span>Missing</span>
              <span>{stats.rtw.missing}</span>
            </div>
          </div>
        </div>

        <div className="stat-card dbs-card">
          <h3>DBS Status</h3>
          <div className="stat-breakdown">
            <div className="stat-row compliant">
              <span>Compliant</span>
              <span>{stats.dbs.compliant}</span>
            </div>
            <div className="stat-row warning">
              <span>Expiring/Update Due</span>
              <span>{stats.dbs.expiring + stats.dbs.update_due}</span>
            </div>
            <div className="stat-row danger">
              <span>Expired/Action Req</span>
              <span>{stats.dbs.expired + stats.dbs.action_required}</span>
            </div>
            <div className="stat-row missing">
              <span>Missing</span>
              <span>{stats.dbs.missing}</span>
            </div>
          </div>
        </div>

        <div className="stat-card tasks-card">
          <h3>Pending Tasks</h3>
          <div className="stat-value">{stats.pending_tasks}</div>
        </div>
      </div>

      <div className="dashboard-filters">
        <label>Filter:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Employees</option>
          <option value="rtw_issues">RTW Issues</option>
          <option value="dbs_issues">DBS Issues</option>
          <option value="compliant">Fully Compliant</option>
        </select>
        <button className="btn-refresh" onClick={fetchDashboard}>
          Refresh
        </button>
      </div>

      <div className="compliance-table-container">
        <table className="compliance-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee #</th>
              <th>RTW Status</th>
              <th>RTW Expiry</th>
              <th>DBS Level</th>
              <th>DBS Status</th>
              <th>DBS Expiry</th>
              <th>Update Service</th>
              <th>Tasks</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">No employees match the selected filter</td>
              </tr>
            ) : (
              filteredEmployees.map(emp => (
                <tr key={emp.employee_id}>
                  <td>{emp.full_name}</td>
                  <td>{emp.employee_number || '-'}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(emp.rtw_compliance)}`}>
                      {formatStatus(emp.rtw_compliance)}
                    </span>
                  </td>
                  <td>{formatDate(emp.rtw_expiry)}</td>
                  <td>{emp.dbs_level ? emp.dbs_level.replace('_', ' + ') : '-'}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(emp.dbs_compliance)}`}>
                      {formatStatus(emp.dbs_compliance)}
                    </span>
                  </td>
                  <td>{formatDate(emp.dbs_expiry)}</td>
                  <td>
                    {emp.update_service_registered ? (
                      <span className="update-service-badge">Yes</span>
                    ) : '-'}
                  </td>
                  <td>
                    {emp.pending_tasks > 0 ? (
                      <span className="task-badge">{emp.pending_tasks}</span>
                    ) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ComplianceDashboard;
