/**
 * VoidStaffOS - Migration Runner
 * Executes all database migrations in sequence.
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

const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

const runMigrations = async () => {
  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    console.log('Running migrations...');
    
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log('Executing: ' + file);
      await pool.query(sql);
      console.log('Completed: ' + file);
    }
    
    console.log('All migrations completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
};

runMigrations();
