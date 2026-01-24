const pool = require('../config/database');

// Only allow in development mode
const isDev = process.env.NODE_ENV !== 'production';

// Get all Fridays in a quarter
function getFridaysInQuarter(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0);

  const fridays = [];
  let current = new Date(startDate);

  // Find first Friday
  const dayOfWeek = current.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  current.setDate(current.getDate() + daysUntilFriday);

  while (current <= endDate) {
    fridays.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }

  return fridays;
}

// Generate a random rating with some variance but trending in a direction
function generateRating(base, variance = 1, min = 1, max = 10) {
  const value = base + (Math.random() * variance * 2 - variance);
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10;
}

// Generate realistic test snapshots for quarterly reports
async function generateTestSnapshots(req, res) {
  if (!isDev) {
    return res.status(403).json({ error: 'This endpoint is only available in development mode' });
  }

  try {
    const { employeeId, quarter } = req.params;
    const { role_name } = req.user;

    // Only admin can generate test data
    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can generate test data' });
    }

    // Parse quarter (e.g., "2025-Q1")
    const match = quarter.match(/^(\d{4})-Q([1-4])$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid quarter format. Use YYYY-Q# (e.g., 2025-Q1)' });
    }

    const year = parseInt(match[1]);
    const q = parseInt(match[2]);

    // Verify employee exists
    const employeeResult = await pool.query(
      'SELECT id, full_name, manager_id FROM users WHERE id = $1',
      [employeeId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Get a manager for this employee (use their actual manager or find one)
    let managerId = employee.manager_id;
    if (!managerId) {
      const managerResult = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.role_name = 'Manager' OR r.role_name = 'Admin'
         LIMIT 1`
      );
      if (managerResult.rows.length > 0) {
        managerId = managerResult.rows[0].id;
      } else {
        return res.status(400).json({ error: 'No manager found to create reviews' });
      }
    }

    // Get all Fridays in the quarter
    const fridays = getFridaysInQuarter(year, q);

    // Delete existing reviews for this employee in this quarter (cleanup)
    const startDate = `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(q * 3).padStart(2, '0')}-31`;

    await pool.query(
      `DELETE FROM reviews
       WHERE employee_id = $1
       AND review_date >= $2
       AND review_date <= $3`,
      [employeeId, startDate, endDate]
    );

    // Generate trend parameters (some metrics improving, some declining, some stable)
    const trends = {
      tasks_completed: { base: 6 + Math.random() * 2, direction: Math.random() > 0.5 ? 0.1 : -0.05 },
      work_volume: { base: 5.5 + Math.random() * 2, direction: Math.random() > 0.6 ? 0.08 : -0.03 },
      problem_solving: { base: 6.5 + Math.random() * 1.5, direction: 0.05 }, // Generally improving
      communication: { base: 5 + Math.random() * 2, direction: Math.random() > 0.4 ? 0.06 : -0.08 },
      leadership: { base: 4.5 + Math.random() * 2, direction: 0.02 } // Slowly improving
    };

    const createdReviews = [];

    // Generate manager reviews for each Friday (13 weeks)
    for (let i = 0; i < fridays.length; i++) {
      const weekFriday = fridays[i];
      const weekIndex = i;

      // Apply trend over time
      const tasksRating = generateRating(trends.tasks_completed.base + trends.tasks_completed.direction * weekIndex, 0.8);
      const volumeRating = generateRating(trends.work_volume.base + trends.work_volume.direction * weekIndex, 0.7);
      const problemRating = generateRating(trends.problem_solving.base + trends.problem_solving.direction * weekIndex, 0.6);
      const commRating = generateRating(trends.communication.base + trends.communication.direction * weekIndex, 0.9);
      const leaderRating = generateRating(trends.leadership.base + trends.leadership.direction * weekIndex, 0.5);

      const result = await pool.query(
        `INSERT INTO reviews (
          employee_id, reviewer_id, review_date,
          tasks_completed, work_volume, problem_solving, communication, leadership,
          goals, achievements, areas_for_improvement,
          is_self_assessment, is_committed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          employeeId,
          managerId,
          weekFriday,
          tasksRating,
          volumeRating,
          problemRating,
          commRating,
          leaderRating,
          `Week ${weekIndex + 1} goals for ${employee.full_name}`,
          weekIndex > 0 ? `Completed previous week targets. Notable achievement in ${['project delivery', 'team collaboration', 'process improvement', 'client satisfaction'][weekIndex % 4]}.` : null,
          commRating < 6 ? 'Focus on communication and stakeholder updates.' : (leaderRating < 6 ? 'Take more initiative in team leadership.' : null),
          false,
          true // Commit the reviews
        ]
      );

      createdReviews.push({ type: 'manager', week: weekIndex + 1, id: result.rows[0].id, date: weekFriday });
    }

    // Generate 3 monthly self-assessments (one per month)
    const months = [0, 1, 2].map(m => {
      const monthStart = (q - 1) * 3 + m;
      // Find a Friday in the middle of each month
      const monthFridays = fridays.filter(f => {
        const d = new Date(f);
        return d.getMonth() === monthStart;
      });
      return monthFridays[Math.floor(monthFridays.length / 2)] || monthFridays[0];
    }).filter(f => f);

    for (let i = 0; i < months.length; i++) {
      const monthFriday = months[i];

      // Self-assessments tend to be slightly higher than manager assessments
      const selfBias = 0.5;
      const weekIndex = fridays.indexOf(monthFriday);

      const tasksRating = generateRating(trends.tasks_completed.base + trends.tasks_completed.direction * weekIndex + selfBias, 0.6);
      const volumeRating = generateRating(trends.work_volume.base + trends.work_volume.direction * weekIndex + selfBias, 0.5);
      const problemRating = generateRating(trends.problem_solving.base + trends.problem_solving.direction * weekIndex + selfBias, 0.4);
      const commRating = generateRating(trends.communication.base + trends.communication.direction * weekIndex + selfBias, 0.7);
      const leaderRating = generateRating(trends.leadership.base + trends.leadership.direction * weekIndex + selfBias, 0.4);

      const result = await pool.query(
        `INSERT INTO reviews (
          employee_id, reviewer_id, review_date,
          tasks_completed, work_volume, problem_solving, communication, leadership,
          goals, achievements, areas_for_improvement,
          is_self_assessment, is_committed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          employeeId,
          employeeId, // Self-assessment
          monthFriday,
          tasksRating,
          volumeRating,
          problemRating,
          commRating,
          leaderRating,
          `Personal goals for month ${i + 1}`,
          `Self-reflection: Made progress on ${['technical skills', 'project management', 'team dynamics', 'process optimization'][i % 4]}.`,
          `Working on improving ${['time management', 'documentation', 'cross-team collaboration'][i % 3]}.`,
          true,
          true
        ]
      );

      createdReviews.push({ type: 'self', month: i + 1, id: result.rows[0].id, date: monthFriday });
    }

    res.json({
      message: `Generated ${createdReviews.length} test snapshots for ${employee.full_name} in ${quarter}`,
      employee: {
        id: employee.id,
        name: employee.full_name
      },
      quarter,
      reviews: createdReviews,
      trends: {
        tasks_completed: trends.tasks_completed.direction > 0 ? 'improving' : 'declining',
        work_volume: trends.work_volume.direction > 0 ? 'improving' : 'declining',
        problem_solving: 'improving',
        communication: trends.communication.direction > 0 ? 'improving' : 'declining',
        leadership: 'stable/improving'
      }
    });
  } catch (error) {
    console.error('Generate test snapshots error:', error);
    res.status(500).json({ error: 'Failed to generate test snapshots' });
  }
}

// Clear all test data for an employee in a quarter
async function clearTestSnapshots(req, res) {
  if (!isDev) {
    return res.status(403).json({ error: 'This endpoint is only available in development mode' });
  }

  try {
    const { employeeId, quarter } = req.params;
    const { role_name } = req.user;

    if (role_name !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can clear test data' });
    }

    const match = quarter.match(/^(\d{4})-Q([1-4])$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid quarter format' });
    }

    const year = parseInt(match[1]);
    const q = parseInt(match[2]);

    const startDate = `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(q * 3).padStart(2, '0')}-31`;

    const result = await pool.query(
      `DELETE FROM reviews
       WHERE employee_id = $1
       AND review_date >= $2
       AND review_date <= $3
       RETURNING id`,
      [employeeId, startDate, endDate]
    );

    res.json({
      message: `Deleted ${result.rowCount} reviews for employee ${employeeId} in ${quarter}`
    });
  } catch (error) {
    console.error('Clear test snapshots error:', error);
    res.status(500).json({ error: 'Failed to clear test snapshots' });
  }
}

module.exports = {
  generateTestSnapshots,
  clearTestSnapshots
};
