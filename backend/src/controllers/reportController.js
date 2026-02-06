/**
 * HeadOfficeOS - Report Controller
 * Generates quarterly performance reports and trend analysis.
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
 * TRADE SECRET: Contains proprietary algorithms.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

const pool = require('../config/database');

// Parse quarter string (e.g., "2024-Q1") into date range
function parseQuarter(quarterStr) {
  const match = quarterStr.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    throw new Error('Invalid quarter format. Use YYYY-Q# (e.g., 2024-Q1)');
  }

  const year = parseInt(match[1]);
  const quarter = parseInt(match[2]);

  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0); // Last day of quarter

  return {
    year,
    quarter,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    label: `Q${quarter} ${year}`
  };
}

// Get previous quarter
function getPreviousQuarter(year, quarter) {
  if (quarter === 1) {
    return { year: year - 1, quarter: 4 };
  }
  return { year, quarter: quarter - 1 };
}

// Calculate trend direction based on data points
function calculateTrend(values) {
  if (!values || values.length < 2) return 'stable';

  const validValues = values.filter(v => v !== null);
  if (validValues.length < 2) return 'stable';

  // Compare first half average to second half average
  const mid = Math.floor(validValues.length / 2);
  const firstHalf = validValues.slice(0, mid);
  const secondHalf = validValues.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  const threshold = 0.5; // Significant change threshold

  if (diff > threshold) return 'improving';
  if (diff < -threshold) return 'declining';
  return 'stable';
}

// Calculate metric from review
function calculateVelocity(review) {
  const { tasks_completed, work_volume, problem_solving } = review;
  if (tasks_completed == null || work_volume == null || problem_solving == null) return null;
  return Math.round((tasks_completed + work_volume + problem_solving) / 3 * 100) / 100;
}

function calculateFriction(review) {
  const velocity = calculateVelocity(review);
  if (velocity == null || review.communication == null) return null;
  return Math.round((velocity + review.communication) / 2 * 100) / 100;
}

function calculateCohesion(review) {
  const { problem_solving, communication, leadership } = review;
  if (problem_solving == null || communication == null || leadership == null) return null;
  return Math.round((problem_solving + communication + leadership) / 3 * 100) / 100;
}

// Get all Fridays (week ending dates) in a quarter
function getWeekEndingsInQuarter(startDate, endDate) {
  const weeks = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Find first Friday
  let current = new Date(start);
  const dayOfWeek = current.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  current.setDate(current.getDate() + daysUntilFriday);

  while (current <= end) {
    weeks.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

// Get month labels for quarter
function getMonthsInQuarter(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const months = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 3; i++) {
    months.push({
      index: startMonth + i,
      name: monthNames[startMonth + i],
      year
    });
  }

  return months;
}

async function getQuarterlyReport(req, res) {
  try {
    const { employeeId, quarter } = req.params;
    const { role_name, id: userId } = req.user;

    // Parse quarter
    let quarterInfo;
    try {
      quarterInfo = parseQuarter(quarter);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Check permissions
    if (role_name !== 'Admin' && role_name !== 'Compliance Officer') {
      if (role_name === 'Manager') {
        const employeeCheck = await pool.query(
          'SELECT manager_id FROM users WHERE id = $1',
          [employeeId]
        );
        if (employeeCheck.rows.length === 0 || employeeCheck.rows[0].manager_id !== userId) {
          if (parseInt(employeeId) !== userId) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
        }
      } else if (parseInt(employeeId) !== userId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Get employee info
    const employeeResult = await pool.query(
      `SELECT u.id, u.full_name, u.email, r.role_name,
              m.full_name as manager_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.id = $1`,
      [employeeId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Get reviews for the quarter (using review_date as week ending date)
    const reviewsResult = await pool.query(
      `SELECT r.*, rv.full_name as reviewer_name
       FROM reviews r
       JOIN users rv ON r.reviewer_id = rv.id
       WHERE r.employee_id = $1
         AND r.review_date >= $2
         AND r.review_date <= $3
       ORDER BY r.review_date ASC`,
      [employeeId, quarterInfo.startDate, quarterInfo.endDate]
    );

    const reviews = reviewsResult.rows;

    // Get week endings for the quarter (13 weeks)
    const weekEndings = getWeekEndingsInQuarter(quarterInfo.startDate, quarterInfo.endDate);

    // Build weekly trend data (manager reviews only)
    const managerReviews = reviews.filter(r => !r.is_self_assessment);
    const weeklyTrends = weekEndings.map(weekEnding => {
      const review = managerReviews.find(r => {
        const reviewWeek = new Date(r.review_date).toISOString().split('T')[0];
        return reviewWeek === weekEnding;
      });

      if (review) {
        return {
          week_ending: weekEnding,
          velocity: calculateVelocity(review),
          friction: calculateFriction(review),
          cohesion: calculateCohesion(review),
          tasks_completed: review.tasks_completed,
          work_volume: review.work_volume,
          problem_solving: review.problem_solving,
          communication: review.communication,
          leadership: review.leadership,
          reviewer_name: review.reviewer_name,
          has_data: true
        };
      }

      return {
        week_ending: weekEnding,
        velocity: null,
        friction: null,
        cohesion: null,
        tasks_completed: null,
        work_volume: null,
        problem_solving: null,
        communication: null,
        leadership: null,
        reviewer_name: null,
        has_data: false
      };
    });

    // Build monthly comparison data
    const months = getMonthsInQuarter(quarterInfo.year, quarterInfo.quarter);
    const monthlyData = months.map(month => {
      const monthStart = new Date(month.year, month.index, 1);
      const monthEnd = new Date(month.year, month.index + 1, 0);

      const monthReviews = reviews.filter(r => {
        const reviewDate = new Date(r.review_date);
        return reviewDate >= monthStart && reviewDate <= monthEnd;
      });

      // Separate manager reviews from self-reviews
      const monthManagerReviews = monthReviews.filter(r => !r.is_self_assessment);
      const selfReviews = monthReviews.filter(r => r.is_self_assessment);

      const avgMetric = (arr, metricFn) => {
        const values = arr.map(metricFn).filter(v => v !== null);
        if (values.length === 0) return null;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
      };

      return {
        month: month.name,
        manager: {
          velocity: avgMetric(monthManagerReviews, calculateVelocity),
          friction: avgMetric(monthManagerReviews, calculateFriction),
          cohesion: avgMetric(monthManagerReviews, calculateCohesion),
          count: monthManagerReviews.length
        },
        self: {
          velocity: avgMetric(selfReviews, calculateVelocity),
          friction: avgMetric(selfReviews, calculateFriction),
          cohesion: avgMetric(selfReviews, calculateCohesion),
          count: selfReviews.length
        }
      };
    });

    // Calculate quarter averages (manager reviews only)
    const validVelocities = weeklyTrends.map(w => w.velocity).filter(v => v !== null);
    const validFrictions = weeklyTrends.map(w => w.friction).filter(v => v !== null);
    const validCohesions = weeklyTrends.map(w => w.cohesion).filter(v => v !== null);

    const quarterAverages = {
      velocity: validVelocities.length > 0
        ? Math.round(validVelocities.reduce((a, b) => a + b, 0) / validVelocities.length * 100) / 100
        : null,
      friction: validFrictions.length > 0
        ? Math.round(validFrictions.reduce((a, b) => a + b, 0) / validFrictions.length * 100) / 100
        : null,
      cohesion: validCohesions.length > 0
        ? Math.round(validCohesions.reduce((a, b) => a + b, 0) / validCohesions.length * 100) / 100
        : null,
      reviews_count: managerReviews.length,
      self_assessments_count: reviews.filter(r => r.is_self_assessment).length,
      weeks_with_data: weeklyTrends.filter(w => w.has_data).length
    };

    // Get previous quarter for comparison
    const prevQ = getPreviousQuarter(quarterInfo.year, quarterInfo.quarter);
    const prevQuarterStr = `${prevQ.year}-Q${prevQ.quarter}`;
    let prevQuarterInfo;
    try {
      prevQuarterInfo = parseQuarter(prevQuarterStr);
    } catch (err) {
      prevQuarterInfo = null;
    }

    let previousQuarter = null;
    if (prevQuarterInfo) {
      const prevReviewsResult = await pool.query(
        `SELECT * FROM reviews
         WHERE employee_id = $1
           AND review_date >= $2
           AND review_date <= $3
           AND is_self_assessment = false`,
        [employeeId, prevQuarterInfo.startDate, prevQuarterInfo.endDate]
      );

      const prevReviews = prevReviewsResult.rows;
      if (prevReviews.length > 0) {
        const prevVelocities = prevReviews.map(calculateVelocity).filter(v => v !== null);
        const prevFrictions = prevReviews.map(calculateFriction).filter(v => v !== null);
        const prevCohesions = prevReviews.map(calculateCohesion).filter(v => v !== null);

        previousQuarter = {
          label: prevQuarterInfo.label,
          velocity: prevVelocities.length > 0
            ? Math.round(prevVelocities.reduce((a, b) => a + b, 0) / prevVelocities.length * 100) / 100
            : null,
          friction: prevFrictions.length > 0
            ? Math.round(prevFrictions.reduce((a, b) => a + b, 0) / prevFrictions.length * 100) / 100
            : null,
          cohesion: prevCohesions.length > 0
            ? Math.round(prevCohesions.reduce((a, b) => a + b, 0) / prevCohesions.length * 100) / 100
            : null,
          reviews_count: prevReviews.length
        };
      }
    }

    // Calculate comparisons with previous quarter
    let quarterComparison = null;
    if (previousQuarter) {
      const calcDiff = (current, previous) => {
        if (current === null || previous === null) return null;
        return Math.round((current - previous) * 100) / 100;
      };

      quarterComparison = {
        velocity_diff: calcDiff(quarterAverages.velocity, previousQuarter.velocity),
        friction_diff: calcDiff(quarterAverages.friction, previousQuarter.friction),
        cohesion_diff: calcDiff(quarterAverages.cohesion, previousQuarter.cohesion)
      };
    }

    // Calculate trend directions
    const trends = {
      velocity: calculateTrend(weeklyTrends.map(w => w.velocity)),
      friction: calculateTrend(weeklyTrends.map(w => w.friction)),
      cohesion: calculateTrend(weeklyTrends.map(w => w.cohesion))
    };

    // Build response
    const report = {
      employee,
      quarter: quarterInfo,
      weekly_trends: weeklyTrends,
      monthly_comparison: monthlyData,
      quarter_averages: quarterAverages,
      previous_quarter: previousQuarter,
      quarter_comparison: quarterComparison,
      trends,
      generated_at: new Date().toISOString()
    };

    res.json({ report });
  } catch (error) {
    console.error('Quarterly report error:', error);
    res.status(500).json({ error: 'Failed to generate quarterly report' });
  }
}

// Get available quarters for an employee
async function getAvailableQuarters(req, res) {
  try {
    const { employeeId } = req.params;
    const { role_name, id: userId } = req.user;

    // Check permissions
    if (role_name !== 'Admin' && role_name !== 'Compliance Officer') {
      if (role_name === 'Manager') {
        const employeeCheck = await pool.query(
          'SELECT manager_id FROM users WHERE id = $1',
          [employeeId]
        );
        if (employeeCheck.rows.length === 0 || employeeCheck.rows[0].manager_id !== userId) {
          if (parseInt(employeeId) !== userId) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
        }
      } else if (parseInt(employeeId) !== userId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Get date range of reviews (using review_date)
    const result = await pool.query(
      `SELECT
        MIN(review_date) as earliest,
        MAX(review_date) as latest
       FROM reviews
       WHERE employee_id = $1 AND review_date IS NOT NULL`,
      [employeeId]
    );

    if (!result.rows[0].earliest) {
      return res.json({ quarters: [] });
    }

    const earliest = new Date(result.rows[0].earliest);
    const latest = new Date(result.rows[0].latest);

    // Generate all quarters between earliest and latest
    const quarters = [];
    let currentYear = earliest.getFullYear();
    let currentQuarter = Math.floor(earliest.getMonth() / 3) + 1;

    const latestYear = latest.getFullYear();
    const latestQuarter = Math.floor(latest.getMonth() / 3) + 1;

    while (currentYear < latestYear || (currentYear === latestYear && currentQuarter <= latestQuarter)) {
      quarters.push({
        value: `${currentYear}-Q${currentQuarter}`,
        label: `Q${currentQuarter} ${currentYear}`
      });

      currentQuarter++;
      if (currentQuarter > 4) {
        currentQuarter = 1;
        currentYear++;
      }
    }

    // Also add current quarter if not already included
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowQuarter = Math.floor(now.getMonth() / 3) + 1;
    const currentQStr = `${nowYear}-Q${nowQuarter}`;

    if (!quarters.find(q => q.value === currentQStr)) {
      quarters.push({
        value: currentQStr,
        label: `Q${nowQuarter} ${nowYear}`
      });
    }

    res.json({ quarters: quarters.reverse() }); // Most recent first
  } catch (error) {
    console.error('Get available quarters error:', error);
    res.status(500).json({ error: 'Failed to get available quarters' });
  }
}

module.exports = {
  getQuarterlyReport,
  getAvailableQuarters
};
