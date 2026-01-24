const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

async function runMigration(filename) {
  const migrationPath = path.join(__dirname, '..', 'migrations', filename);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log(`Running migration: ${filename}`);
    await pool.query(sql);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node run-migration.js <migration-file.sql>');
  process.exit(1);
}

runMigration(filename);
