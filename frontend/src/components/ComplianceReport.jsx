/**
 * HeadOfficeOS - Compliance Report
 * CQC-ready compliance report generation.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

import { useState, useEffect } from 'react';

function ComplianceReport({ user, reportTitle = 'Compliance Report' }) {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compliance/report', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const formatStatus = (status) => {
    if (!status) return 'N/A';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const generatePDF = () => {
    setGenerating(true);

    // Create printable content
    const printContent = document.getElementById('compliance-report-content');
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle} - ${formatDate(new Date())}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #333;
            padding: 20px;
            max-width: 100%;
          }
          .report-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
          }
          .report-header h1 {
            font-size: 24px;
            margin: 0 0 5px 0;
            color: #1e40af;
          }
          .report-header p {
            margin: 5px 0;
            color: #666;
          }
          .summary-section {
            display: flex;
            justify-content: space-around;
            margin-bottom: 30px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
          }
          .summary-box {
            text-align: center;
            padding: 10px 20px;
          }
          .summary-box h3 {
            font-size: 12px;
            color: #666;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }
          .summary-box .value {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
          }
          .summary-box .value.warning { color: #d97706; }
          .summary-box .value.danger { color: #dc2626; }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #1e40af;
            margin: 25px 0 15px 0;
            padding-bottom: 5px;
            border-bottom: 1px solid #e2e8f0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #e2e8f0;
            padding: 8px 6px;
            text-align: left;
          }
          th {
            background: #f1f5f9;
            font-weight: bold;
            color: #334155;
          }
          tr:nth-child(even) { background: #f8fafc; }
          .status-compliant { color: #059669; font-weight: bold; }
          .status-expiring { color: #d97706; font-weight: bold; }
          .status-expired { color: #dc2626; font-weight: bold; }
          .status-missing { color: #6b7280; font-weight: bold; }
          .status-action { color: #dc2626; font-weight: bold; }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
          .no-print { display: none; }
          @media print {
            body { padding: 0; }
            .summary-section { break-inside: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      setGenerating(false);
    }, 500);
  };

  if (loading) {
    return <div className="loading">Loading report data...</div>;
  }

  if (!reportData) {
    return <div className="error-message">Failed to load report data</div>;
  }

  const { summary, employees, pending_tasks } = reportData;

  const getStatusClass = (status) => {
    switch (status) {
      case 'compliant': return 'status-compliant';
      case 'expiring':
      case 'update_due': return 'status-expiring';
      case 'expired': return 'status-expired';
      case 'missing': return 'status-missing';
      case 'action_required': return 'status-action';
      default: return '';
    }
  };

  return (
    <div className="compliance-report">
      <div className="report-actions">
        <button
          className="btn-primary"
          onClick={generatePDF}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate PDF Report'}
        </button>
        <button className="btn-secondary" onClick={fetchReportData}>
          Refresh Data
        </button>
      </div>

      <div id="compliance-report-content" className="report-content">
        <div className="report-header">
          <h1>{reportTitle}</h1>
          <p>Right to Work and DBS Verification Status</p>
          <p>Generated: {formatDate(new Date())} at {new Date().toLocaleTimeString('en-GB')}</p>
        </div>

        <div className="summary-section">
          <div className="summary-box">
            <h3>Total Employees</h3>
            <div className="value">{summary.total_employees}</div>
          </div>
          <div className="summary-box">
            <h3>RTW Compliance</h3>
            <div className={`value ${summary.rtw_compliance_rate < 100 ? 'warning' : ''}`}>
              {summary.rtw_compliance_rate}%
            </div>
          </div>
          <div className="summary-box">
            <h3>DBS Compliance</h3>
            <div className={`value ${summary.dbs_compliance_rate < 100 ? 'warning' : ''}`}>
              {summary.dbs_compliance_rate}%
            </div>
          </div>
          <div className="summary-box">
            <h3>Pending Tasks</h3>
            <div className={`value ${summary.pending_tasks > 0 ? 'danger' : ''}`}>
              {summary.pending_tasks}
            </div>
          </div>
        </div>

        <h2 className="section-title">Employee Compliance Status</h2>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee #</th>
              <th>RTW Type</th>
              <th>RTW Status</th>
              <th>RTW Expiry</th>
              <th>DBS Level</th>
              <th>DBS Status</th>
              <th>DBS Expiry</th>
              <th>Update Service</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.employee_id}>
                <td>{emp.full_name}</td>
                <td>{emp.employee_number || '-'}</td>
                <td>{emp.rtw_type?.replace(/_/g, ' ') || '-'}</td>
                <td className={getStatusClass(emp.rtw_compliance)}>
                  {formatStatus(emp.rtw_compliance)}
                </td>
                <td>{formatDate(emp.rtw_expiry)}</td>
                <td>{emp.dbs_level?.replace('_', '+') || '-'}</td>
                <td className={getStatusClass(emp.dbs_compliance)}>
                  {formatStatus(emp.dbs_compliance)}
                </td>
                <td>{formatDate(emp.dbs_expiry)}</td>
                <td>{emp.update_service_registered ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {pending_tasks && pending_tasks.length > 0 && (
          <>
            <h2 className="section-title">Pending Compliance Tasks</h2>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Employee</th>
                  <th>Due Date</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {pending_tasks.map(task => (
                  <tr key={task.id}>
                    <td>{task.title}</td>
                    <td>{task.employee_name}</td>
                    <td>{formatDate(task.due_date)}</td>
                    <td>{task.task_type?.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="footer">
          <p>HeadOfficeOS - {reportTitle}</p>
          <p>This report is for internal compliance monitoring purposes.</p>
          <p>Generated by {user?.full_name || 'System'}</p>
        </div>
      </div>
    </div>
  );
}

export default ComplianceReport;
