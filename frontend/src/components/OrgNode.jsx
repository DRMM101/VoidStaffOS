// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — OrgNode Component
 * Recursive card renderer for org chart tree nodes.
 * Displays employee card with initials avatar, name, role,
 * direct reports count, and CSS connector lines to children.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Generate initials from a full name (first + last initial)
 * @param {string} name - Full name string
 * @returns {string} Up to 2 initials
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  // Take first letter of first and last parts
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Tier-to-colour mapping for avatar backgrounds
 * Null (Admin) gets a distinct colour; tiers 1-5 get progressively lighter
 */
function getTierColour(tier) {
  if (tier === null || tier === undefined) return 'var(--color-primary)';
  if (tier <= 1) return '#2563eb'; // blue-600
  if (tier <= 2) return '#0891b2'; // cyan-600
  if (tier <= 3) return '#059669'; // emerald-600
  if (tier <= 4) return '#d97706'; // amber-600
  return '#6b7280'; // gray-500
}

function OrgNode({
  node,
  expandedNodes,
  onToggleExpand,
  highlightId,
  onNodeClick,
  depth = 0
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isHighlighted = highlightId === node.id;

  return (
    <div
      className="org-node"
      data-node-id={node.id}
    >
      {/* The card itself */}
      <button
        className={`org-node__card ${isHighlighted ? 'org-node__card--highlighted' : ''}`}
        onClick={() => onNodeClick(node)}
        aria-label={`${node.full_name}, ${node.role_name || 'Employee'}`}
        type="button"
      >
        {/* Initials avatar */}
        <div
          className="org-node__avatar"
          style={{ backgroundColor: getTierColour(node.tier) }}
          aria-hidden="true"
        >
          {getInitials(node.full_name)}
        </div>

        {/* Name and role */}
        <div className="org-node__info">
          <span className="org-node__name">{node.full_name}</span>
          <span className="org-node__role">{node.role_name || 'Employee'}</span>
        </div>

        {/* Direct reports badge */}
        {hasChildren && (
          <span className="org-node__badge" aria-label={`${node.direct_reports} direct reports`}>
            {node.direct_reports}
          </span>
        )}

        {/* Expand/collapse toggle for nodes with children */}
        {hasChildren && (
          <span
            className="org-node__toggle"
            onClick={(e) => {
              // Stop propagation so card click doesn't also fire
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleExpand(node.id);
              }
            }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>

      {/* Children container with CSS connector lines */}
      {hasChildren && isExpanded && (
        <div className="org-node__children">
          {node.children.map(child => (
            <OrgNode
              key={child.id}
              node={child}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              highlightId={highlightId}
              onNodeClick={onNodeClick}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default OrgNode;
