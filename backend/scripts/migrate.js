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
