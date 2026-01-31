/**
 * VoidStaffOS - Navigation Component
 * Main navigation header with dropdown menus.
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

import { useState, useRef, useEffect } from 'react';

function Navigation({ currentPage, onNavigate, onLogout, isAdmin, isManager }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const navRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (page) => {
    onNavigate(page);
    setOpenDropdown(null);
  };

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  // Check if any item in a dropdown is active
  const isDropdownActive = (pages) => pages.includes(currentPage);

  return (
    <header className="nav-header">
      <h1 className="nav-logo">VoidStaffOS</h1>
      <nav className="nav-links" ref={navRef}>
        {/* Dashboard - standalone */}
        <button
          className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNavigate('dashboard')}
        >
          Dashboard
        </button>

        {/* People dropdown */}
        <div className="nav-dropdown">
          <button
            className={`nav-link dropdown-trigger ${isDropdownActive(['employees', 'reviews', 'my-reports']) ? 'active' : ''}`}
            onClick={() => toggleDropdown('people')}
          >
            People
            <span className="dropdown-arrow">{openDropdown === 'people' ? '▴' : '▾'}</span>
          </button>
          {openDropdown === 'people' && (
            <div className="dropdown-menu">
              <button
                className={`dropdown-item ${currentPage === 'employees' ? 'active' : ''}`}
                onClick={() => handleNavigate('employees')}
              >
                Employees
              </button>
              <button
                className={`dropdown-item ${currentPage === 'reviews' ? 'active' : ''}`}
                onClick={() => handleNavigate('reviews')}
              >
                Snapshots
              </button>
              <button
                className={`dropdown-item ${currentPage === 'my-reports' ? 'active' : ''}`}
                onClick={() => handleNavigate('my-reports')}
              >
                My Reports
              </button>
            </div>
          )}
        </div>

        {/* Absence - standalone for quick access */}
        <button
          className={`nav-link ${currentPage === 'absence' ? 'active' : ''}`}
          onClick={() => handleNavigate('absence')}
        >
          Absence
        </button>

        {/* Company dropdown */}
        <div className="nav-dropdown">
          <button
            className={`nav-link dropdown-trigger ${isDropdownActive(['policies', 'documents', 'emergency']) ? 'active' : ''}`}
            onClick={() => toggleDropdown('company')}
          >
            Company
            <span className="dropdown-arrow">{openDropdown === 'company' ? '▴' : '▾'}</span>
          </button>
          {openDropdown === 'company' && (
            <div className="dropdown-menu">
              <button
                className={`dropdown-item ${currentPage === 'policies' ? 'active' : ''}`}
                onClick={() => handleNavigate('policies')}
              >
                Policies
              </button>
              <button
                className={`dropdown-item ${currentPage === 'documents' ? 'active' : ''}`}
                onClick={() => handleNavigate('documents')}
              >
                Documents
              </button>
              <button
                className={`dropdown-item ${currentPage === 'emergency' ? 'active' : ''}`}
                onClick={() => handleNavigate('emergency')}
              >
                Emergency Info
              </button>
            </div>
          )}
        </div>

        {/* Admin dropdown - only for managers/admins */}
        {(isAdmin || isManager) && (
          <div className="nav-dropdown">
            <button
              className={`nav-link dropdown-trigger ${isDropdownActive(['compliance', 'probation', 'insights', 'role-management']) ? 'active' : ''}`}
              onClick={() => toggleDropdown('admin')}
            >
              Admin
              <span className="dropdown-arrow">{openDropdown === 'admin' ? '▴' : '▾'}</span>
            </button>
            {openDropdown === 'admin' && (
              <div className="dropdown-menu">
                <button
                  className={`dropdown-item ${currentPage === 'compliance' ? 'active' : ''}`}
                  onClick={() => handleNavigate('compliance')}
                >
                  Compliance
                </button>
                <button
                  className={`dropdown-item ${currentPage === 'probation' ? 'active' : ''}`}
                  onClick={() => handleNavigate('probation')}
                >
                  Probation
                </button>
                <button
                  className={`dropdown-item ${currentPage === 'insights' ? 'active' : ''}`}
                  onClick={() => handleNavigate('insights')}
                >
                  Absence Insights
                </button>
                {isAdmin && (
                  <button
                    className={`dropdown-item ${currentPage === 'role-management' ? 'active' : ''}`}
                    onClick={() => handleNavigate('role-management')}
                  >
                    Roles
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
      <button onClick={onLogout} className="logout-btn">
        Logout
      </button>
    </header>
  );
}

export default Navigation;
