/**
 * HeadOfficeOS - Test User Generator
 * Generates test users with manager assignments.
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
const bcrypt = require('bcrypt');
const pool = require('../src/config/database');

const SALT_ROUNDS = 10;

async function generateTestUsers() {
  console.log('Starting test user generation...');

  try {
    // Get role IDs
    const rolesResult = await pool.query('SELECT id, role_name FROM roles');
    const roles = {};
    rolesResult.rows.forEach(r => {
      roles[r.role_name] = r.id;
    });

    console.log('Available roles:', Object.keys(roles).join(', '));

    // Test users configuration
    const testUsers = [
      {
        email: 'test1@test.com',
        full_name: 'Alice Johnson',
        role: 'Employee',
        start_date: '2024-03-15'
      },
      {
        email: 'test2@test.com',
        full_name: 'Bob Williams',
        role: 'Employee',
        start_date: '2023-09-01'
      },
      {
        email: 'test3@test.com',
        full_name: 'Carol Davis',
        role: 'Manager',
        start_date: '2022-06-15'
      },
      {
        email: 'test4@test.com',
        full_name: 'David Brown',
        role: 'Employee',
        start_date: '2024-01-08'
      },
      {
        email: 'test5@test.com',
        full_name: 'Emma Wilson',
        role: 'Manager',
        start_date: '2023-02-20'
      }
    ];

    const password = 'test123';
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const createdUsers = [];

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];

      // Check if user already exists
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);

      if (existing.rows.length > 0) {
        console.log(`User ${user.email} already exists, skipping...`);
        createdUsers.push({ ...user, id: existing.rows[0].id });
        continue;
      }

      // Generate employee number
      const empNumber = 'EMP' + String(100 + i + 1).padStart(3, '0');

      const result = await pool.query(
        `INSERT INTO users (email, full_name, password_hash, role_id, start_date, employee_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, full_name, employee_number`,
        [user.email, user.full_name, passwordHash, roles[user.role], user.start_date, empNumber]
      );

      const createdUser = result.rows[0];
      createdUsers.push({ ...user, id: createdUser.id, employee_number: createdUser.employee_number });
      console.log(`Created: ${createdUser.full_name} (${createdUser.email}) - ${createdUser.employee_number}`);
    }

    // Assign managers
    // test3 (Carol Davis - Manager) manages test1, test2, test4
    const carolId = createdUsers.find(u => u.email === 'test3@test.com').id;
    const managedByCarol = ['test1@test.com', 'test2@test.com', 'test4@test.com'];

    for (const email of managedByCarol) {
      const userId = createdUsers.find(u => u.email === email).id;
      await pool.query(
        'UPDATE users SET manager_id = $1 WHERE id = $2',
        [carolId, userId]
      );
      console.log(`Assigned ${email} to manager Carol Davis`);
    }

    // Summary
    console.log('\n--- Test Users Created ---');
    console.log('Password for all: test123');
    console.log('\nUser List:');
    for (const user of createdUsers) {
      const managerName = managedByCarol.includes(user.email) ? ' (Manager: Carol Davis)' : '';
      console.log(`  ${user.email} - ${user.full_name} (${user.role})${managerName}`);
    }

    console.log('\nManager Assignments:');
    console.log('  Carol Davis (test3@test.com) manages:');
    console.log('    - Alice Johnson (test1@test.com)');
    console.log('    - Bob Williams (test2@test.com)');
    console.log('    - David Brown (test4@test.com)');
    console.log('  Emma Wilson (test5@test.com) - no direct reports yet');

    console.log('\nTest data generation complete!');

  } catch (error) {
    console.error('Error generating test users:', error);
  } finally {
    await pool.end();
  }
}

generateTestUsers();
