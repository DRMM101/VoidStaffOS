// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * VoidStaffOS — OrgNode Tests
 * Tests for the recursive org chart node component:
 * render, toggle expand/collapse, highlight, click handler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrgNode from '../OrgNode';

/* Sample node with children */
const mockNode = {
  id: 1,
  full_name: 'Jane Doe',
  email: 'jane@test.com',
  employee_number: 'EMP100',
  tier: 2,
  role_name: 'Manager',
  manager_id: null,
  direct_reports: 2,
  children: [
    {
      id: 2,
      full_name: 'John Smith',
      email: 'john@test.com',
      employee_number: 'EMP101',
      tier: 4,
      role_name: 'Employee',
      manager_id: 1,
      direct_reports: 0,
      children: []
    },
    {
      id: 3,
      full_name: 'Sara Jones',
      email: 'sara@test.com',
      employee_number: 'EMP102',
      tier: 4,
      role_name: 'Employee',
      manager_id: 1,
      direct_reports: 0,
      children: []
    }
  ]
};

/* Leaf node — no children */
const leafNode = {
  id: 5,
  full_name: 'Leaf Worker',
  email: 'leaf@test.com',
  tier: 4,
  role_name: 'Employee',
  manager_id: 1,
  direct_reports: 0,
  children: []
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrgNode', () => {
  it('renders node card with name and role', () => {
    const expandedNodes = new Set([1, 2, 3]);
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={null}
        onNodeClick={vi.fn()}
      />
    );
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('renders children when expanded', () => {
    const expandedNodes = new Set([1]);
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={null}
        onNodeClick={vi.fn()}
      />
    );
    /* Children should be visible */
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Sara Jones')).toBeInTheDocument();
  });

  it('hides children when collapsed', () => {
    /* Parent node NOT in expandedNodes — children should be hidden */
    const expandedNodes = new Set();
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={null}
        onNodeClick={vi.fn()}
      />
    );
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Sara Jones')).not.toBeInTheDocument();
  });

  it('calls onToggleExpand when toggle is clicked', () => {
    const expandedNodes = new Set([1]);
    const onToggle = vi.fn();
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={onToggle}
        highlightId={null}
        onNodeClick={vi.fn()}
      />
    );

    /* Click the toggle button (collapse icon) */
    const toggleBtn = screen.getByLabelText('Collapse');
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('applies highlighted class when highlightId matches', () => {
    const expandedNodes = new Set([1]);
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={1}
        onNodeClick={vi.fn()}
      />
    );

    /* The card button should have the highlighted class */
    const card = screen.getByLabelText(/Jane Doe/i);
    expect(card).toHaveClass('org-node__card--highlighted');
  });

  it('does not show highlighted class for non-matching id', () => {
    const expandedNodes = new Set([1]);
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={999}
        onNodeClick={vi.fn()}
      />
    );

    const card = screen.getByLabelText(/Jane Doe/i);
    expect(card).not.toHaveClass('org-node__card--highlighted');
  });

  it('calls onNodeClick when card is clicked', () => {
    const expandedNodes = new Set([1]);
    const onClick = vi.fn();
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={null}
        onNodeClick={onClick}
      />
    );

    const card = screen.getByLabelText(/Jane Doe/i);
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledWith(mockNode);
  });

  it('shows direct reports count badge', () => {
    const expandedNodes = new Set([1]);
    render(
      <OrgNode
        node={mockNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={null}
        onNodeClick={vi.fn()}
      />
    );

    /* Badge showing 2 direct reports */
    expect(screen.getByLabelText('2 direct reports')).toBeInTheDocument();
  });

  it('does not show toggle or badge for leaf nodes', () => {
    const expandedNodes = new Set();
    render(
      <OrgNode
        node={leafNode}
        expandedNodes={expandedNodes}
        onToggleExpand={vi.fn()}
        highlightId={null}
        onNodeClick={vi.fn()}
      />
    );

    expect(screen.getByText('Leaf Worker')).toBeInTheDocument();
    /* No collapse/expand toggle */
    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument();
  });
});
