// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — OrgChartPage Component
 * Page container for the interactive organisational chart.
 * Fetches org chart data, manages search/highlight, and
 * renders OrgChart + EmployeeQuickCard popup.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import api from '../utils/api';
import OrgChart from './OrgChart';
import EmployeeQuickCard from './EmployeeQuickCard';

function OrgChartPage({ user, onNavigate }) {
  // Tree data from API
  const [tree, setTree] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  // Loading / error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Search input and matching node highlight
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightId, setHighlightId] = useState(null);
  // Selected employee for quick card popup
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Role checks for EmployeeQuickCard actions
  const isAdmin = user?.role_name === 'Admin';
  const isManager = user?.role_name === 'Manager';

  /**
   * Fetch the org chart tree from the API.
   * Called on mount and after manager reassignment.
   */
  const fetchOrgChart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/users/org-chart');
      setTree(data.tree || []);
      setTotalEmployees(data.total_employees || 0);
    } catch (err) {
      console.error('Failed to fetch org chart:', err);
      setError(err.message || 'Failed to load organisational chart');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  /**
   * Search handler: find matching node in tree and highlight it.
   * Searches by name, email, or employee number (case-insensitive).
   */
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);

    if (!term.trim()) {
      setHighlightId(null);
      return;
    }

    const lower = term.toLowerCase();

    // Recursive search through the tree
    const findNode = (nodes) => {
      for (const node of nodes) {
        if (
          node.full_name?.toLowerCase().includes(lower) ||
          node.email?.toLowerCase().includes(lower) ||
          node.employee_number?.toLowerCase().includes(lower)
        ) {
          return node.id;
        }
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const foundId = findNode(tree);
    setHighlightId(foundId);

    // Scroll the highlighted node into view
    if (foundId) {
      setTimeout(() => {
        const el = document.querySelector(`[data-node-id="${foundId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }, 100);
    }
  }, [tree]);

  /** Handle node click — open quick card popup */
  const handleNodeClick = useCallback((node) => {
    setSelectedEmployee(node);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="org-chart-page" aria-busy="true">
        <p className="empty-state">Loading organisational chart…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="org-chart-page">
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={fetchOrgChart} className="btn-secondary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="org-chart-page">
      {/* Page header with search */}
      <div className="org-chart-page__header">
        <div className="org-chart-page__title-row">
          <h2>Organisation Chart</h2>
          <span className="org-chart-page__count">{totalEmployees} employees</span>
        </div>

        {/* Search input */}
        <div className="org-chart-page__search">
          <Search size={16} className="org-chart-page__search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by name, email, or employee number…"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search employees in org chart"
            className="org-chart-page__search-input"
          />
          {searchTerm && highlightId === null && (
            <span className="org-chart-page__no-results">No match found</span>
          )}
        </div>
      </div>

      {/* The interactive org chart tree */}
      {tree.length > 0 ? (
        <OrgChart
          tree={tree}
          highlightId={highlightId}
          onNodeClick={handleNodeClick}
        />
      ) : (
        <div className="empty-state">
          <p>No employees found in the organisational chart.</p>
        </div>
      )}

      {/* Employee quick card popup */}
      {selectedEmployee && (
        <EmployeeQuickCard
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onNavigate={onNavigate}
          onRefresh={fetchOrgChart}
          isAdmin={isAdmin}
          isManager={isManager}
        />
      )}
    </div>
  );
}

export default OrgChartPage;
