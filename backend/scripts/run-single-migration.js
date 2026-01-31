/**
 * Run a single migration file
 * Usage: node scripts/run-single-migration.js 033_pip_disciplinary_grievance.sql
 */

const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: node scripts/run-single-migration.js <migration-file>');
    process.exit(1);
  }

  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    const filePath = path.join(migrationsDir, filename);

    if (!fs.existsSync(filePath)) {
      console.error('Migration file not found:', filePath);
      process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log('Executing:', filename);
    await pool.query(sql);
    console.log('Completed:', filename);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
};

runMigration();
