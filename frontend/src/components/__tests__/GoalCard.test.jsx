// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — GoalCard Tests
 * Tests for the goal card component: rendering, badges, progress bar,
 * overdue detection, actions, and completed state.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GoalCard from '../goals/GoalCard';

/* Sample active goal */
const activeGoal = {
  id: 1,
  title: 'Complete leadership training',
  category: 'development',
  priority: 'high',
  status: 'active',
  progress: 65,
  target_date: '2026-12-31',
  assigned_by_name: null
};

/* Sample completed goal */
const completedGoal = {
  ...activeGoal,
  id: 2,
  status: 'completed',
  progress: 100,
  completed_at: '2026-03-01'
};

/* Sample overdue goal (target date in the past) */
const overdueGoal = {
  ...activeGoal,
  id: 3,
  target_date: '2020-01-01'
};

const mockCallbacks = {
  onView: vi.fn(),
  onUpdateProgress: vi.fn(),
  onComplete: vi.fn()
};

describe('GoalCard', () => {
  it('renders goal title', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    expect(screen.getByText('Complete leadership training')).toBeInTheDocument();
  });

  it('renders category badge', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  it('renders priority indicator', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('renders progress percentage', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('shows View, Update, and Complete buttons for active goals', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('calls onView when View is clicked', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    fireEvent.click(screen.getByText('View'));
    expect(mockCallbacks.onView).toHaveBeenCalledWith(activeGoal);
  });

  it('calls onUpdateProgress when Update is clicked', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    fireEvent.click(screen.getByText('Update'));
    expect(mockCallbacks.onUpdateProgress).toHaveBeenCalledWith(activeGoal);
  });

  it('calls onComplete when Complete is clicked', () => {
    render(<GoalCard goal={activeGoal} {...mockCallbacks} />);
    fireEvent.click(screen.getByText('Complete'));
    expect(mockCallbacks.onComplete).toHaveBeenCalledWith(activeGoal);
  });

  it('shows only View button for completed goals', () => {
    render(<GoalCard goal={completedGoal} {...mockCallbacks} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('View');
  });

  it('shows Completed badge for completed goals', () => {
    render(<GoalCard goal={completedGoal} {...mockCallbacks} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('adds overdue class and indicator for overdue goals', () => {
    render(<GoalCard goal={overdueGoal} {...mockCallbacks} />);
    // The card should have the overdue class
    const card = screen.getByRole('article');
    expect(card.className).toContain('goal-card--overdue');
  });

  it('shows owner name when showOwner is true', () => {
    const goalWithOwner = { ...activeGoal, owner_name: 'Jane Smith' };
    render(<GoalCard goal={goalWithOwner} showOwner={true} {...mockCallbacks} />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows assigned by name when goal is manager-assigned', () => {
    const assignedGoal = { ...activeGoal, assigned_by_name: 'Boss Man' };
    render(<GoalCard goal={assignedGoal} {...mockCallbacks} />);
    expect(screen.getByText('Assigned by Boss Man')).toBeInTheDocument();
  });
});
