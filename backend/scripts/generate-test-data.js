/**
 * VoidStaffOS - Test Data Generator
 * Generates test data for quarterly reports.
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

require('dotenv').config();
const pool = require('../src/config/database');

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
  return Math.round(Math.min(max, Math.max(min, value))); // Integer only
}

async function generateTestData() {
  console.log('Starting test data generation...');

  try {
    // First, ensure we have a test employee
    // Check if test@test.com exists
    let testEmployee = await pool.query(
      "SELECT id, full_name FROM users WHERE email = 'test@test.com'"
    );

    if (testEmployee.rows.length === 0) {
      console.log('Creating test employee (test@test.com)...');
      // Get the Employee role ID
      const roleResult = await pool.query(
        "SELECT id FROM roles WHERE role_name = 'Employee'"
      );
      const employeeRoleId = roleResult.rows[0]?.id || 3;

      // Get a manager to assign
      const managerResult = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.role_name IN ('Manager', 'Admin')
         LIMIT 1`
      );
      const managerId = managerResult.rows[0]?.id;

      // Create the test employee
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash('test123', 10);

      const createResult = await pool.query(
        `INSERT INTO users (email, full_name, password_hash, role_id, start_date, manager_id)
         VALUES ('test@test.com', 'Test Employee', $1, $2, '2024-01-01', $3)
         RETURNING id, full_name`,
        [passwordHash, employeeRoleId, managerId]
      );
      testEmployee = { rows: [createResult.rows[0]] };
      console.log(`Created test employee: ${testEmployee.rows[0].full_name} (ID: ${testEmployee.rows[0].id})`);
    } else {
      console.log(`Found existing test employee: ${testEmployee.rows[0].full_name} (ID: ${testEmployee.rows[0].id})`);
    }

    const employeeId = testEmployee.rows[0].id;
    const employeeName = testEmployee.rows[0].full_name;

    // Get a manager to create reviews
    const managerResult = await pool.query(
      `SELECT u.id, u.full_name FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.role_name IN ('Manager', 'Admin')
       LIMIT 1`
    );

    if (managerResult.rows.length === 0) {
      console.error('No manager found. Please create a manager first.');
      process.exit(1);
    }

    const managerId = managerResult.rows[0].id;
    const managerName = managerResult.rows[0].full_name;
    console.log(`Using manager: ${managerName} (ID: ${managerId})`);

    // Generate data for Q1 2025
    const year = 2025;
    const quarter = 1;
    console.log(`\nGenerating data for Q${quarter} ${year}...`);

    // Get all Fridays in Q1 2025
    const fridays = getFridaysInQuarter(year, quarter);
    console.log(`Found ${fridays.length} Fridays in Q${quarter} ${year}`);

    // Delete existing reviews for this quarter
    const startDate = `${year}-01-01`;
    const endDate = `${year}-03-31`;

    const deleteResult = await pool.query(
      `DELETE FROM reviews
       WHERE employee_id = $1
       AND review_date >= $2
       AND review_date <= $3
       RETURNING id`,
      [employeeId, startDate, endDate]
    );
    console.log(`Deleted ${deleteResult.rowCount} existing reviews`);

    // Generate trend parameters
    const trends = {
      tasks_completed: { base: 6.5, direction: 0.12 },  // Improving
      work_volume: { base: 5.8, direction: 0.08 },      // Slowly improving
      problem_solving: { base: 7.0, direction: 0.05 },  // Stable/improving
      communication: { base: 5.2, direction: 0.15 },    // Improving significantly
      leadership: { base: 4.8, direction: 0.1 }         // Improving from low base
    };

    let createdCount = 0;

    // Generate manager reviews for each Friday
    for (let i = 0; i < fridays.length; i++) {
      const weekFriday = fridays[i];
      const weekIndex = i;

      // Apply trend over time with some variance
      const tasksRating = generateRating(trends.tasks_completed.base + trends.tasks_completed.direction * weekIndex, 0.8);
      const volumeRating = generateRating(trends.work_volume.base + trends.work_volume.direction * weekIndex, 0.7);
      const problemRating = generateRating(trends.problem_solving.base + trends.problem_solving.direction * weekIndex, 0.5);
      const commRating = generateRating(trends.communication.base + trends.communication.direction * weekIndex, 0.9);
      const leaderRating = generateRating(trends.leadership.base + trends.leadership.direction * weekIndex, 0.6);

      const achievements = [
        'Completed sprint deliverables ahead of schedule',
        'Successfully resolved customer escalation',
        'Implemented new testing framework',
        'Led team standup effectively',
        'Delivered presentation to stakeholders',
        'Improved deployment pipeline efficiency',
        'Mentored junior team member',
        'Completed documentation updates',
        'Fixed critical production bug',
        'Participated in architecture review',
        'Streamlined code review process',
        'Completed security audit tasks',
        'Enhanced monitoring dashboards'
      ];

      await pool.query(
        `INSERT INTO reviews (
          employee_id, reviewer_id, review_date,
          tasks_completed, work_volume, problem_solving, communication, leadership,
          goals, achievements, areas_for_improvement,
          is_self_assessment, is_committed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          employeeId,
          managerId,
          weekFriday,
          tasksRating,
          volumeRating,
          problemRating,
          commRating,
          leaderRating,
          `Continue working on Q${quarter} objectives. Focus on improving velocity.`,
          achievements[weekIndex % achievements.length],
          commRating < 6 ? 'Work on providing more frequent status updates' : (leaderRating < 6 ? 'Take more initiative in team meetings' : 'Continue current trajectory'),
          false,
          true
        ]
      );
      createdCount++;
    }

    console.log(`Created ${createdCount} manager reviews`);

    // Generate 3 monthly self-assessments
    const selfAssessmentWeeks = [2, 6, 10]; // Roughly monthly
    for (const weekIndex of selfAssessmentWeeks) {
      if (weekIndex >= fridays.length) continue;

      const weekFriday = fridays[weekIndex];

      // Self-assessments tend to be slightly higher than manager assessments
      const selfBias = 0.3;
      const tasksRating = generateRating(trends.tasks_completed.base + trends.tasks_completed.direction * weekIndex + selfBias, 0.5);
      const volumeRating = generateRating(trends.work_volume.base + trends.work_volume.direction * weekIndex + selfBias, 0.4);
      const problemRating = generateRating(trends.problem_solving.base + trends.problem_solving.direction * weekIndex + selfBias, 0.3);
      const commRating = generateRating(trends.communication.base + trends.communication.direction * weekIndex + selfBias, 0.5);
      const leaderRating = generateRating(trends.leadership.base + trends.leadership.direction * weekIndex + selfBias, 0.4);

      await pool.query(
        `INSERT INTO reviews (
          employee_id, reviewer_id, review_date,
          tasks_completed, work_volume, problem_solving, communication, leadership,
          goals, achievements, areas_for_improvement,
          is_self_assessment, is_committed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          employeeId,
          employeeId,
          weekFriday,
          tasksRating,
          volumeRating,
          problemRating,
          commRating,
          leaderRating,
          `Personal goals: Continue skill development and contribute to team success`,
          `Self-reflection: Made good progress on assigned tasks and improved communication with stakeholders`,
          `Areas I want to improve: Time management and documentation practices`,
          true,
          true
        ]
      );
    }

    console.log(`Created ${selfAssessmentWeeks.length} self-assessments`);

    // Summary
    console.log('\n✅ Test data generation complete!');
    console.log(`Employee: ${employeeName} (ID: ${employeeId})`);
    console.log(`Quarter: Q${quarter} ${year}`);
    console.log(`Manager reviews: ${fridays.length}`);
    console.log(`Self-assessments: ${selfAssessmentWeeks.length}`);
    console.log(`Total reviews: ${fridays.length + selfAssessmentWeeks.length}`);
    console.log('\nLogin credentials for test employee:');
    console.log('  Email: test@test.com');
    console.log('  Password: test123');

  } catch (error) {
    console.error('Error generating test data:', error);
  } finally {
    await pool.end();
  }
}

generateTestData();
