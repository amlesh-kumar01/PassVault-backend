#!/usr/bin/env node

/**
 * Create Migration Script
 * Generates a new timestamped migration file
 * 
 * Usage: npm run migration:create "add_user_preferences"
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'migrations');

function createMigration(name) {
  // Validate name
  if (!name || name.trim() === '') {
    console.error('❌ Error: Migration name is required');
    console.log('\nUsage: npm run migration:create "migration_name"');
    process.exit(1);
  }
  
  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    console.log('📁 Created migrations directory');
  }
  
  // Generate timestamp
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  // Create filename
  const filename = `${timestamp}_${name.replace(/\s+/g, '_')}.sql`;
  const filepath = path.join(migrationsDir, filename);
  
  // Migration template
  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here

-- Example:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Rollback instructions (commented):
-- To rollback this migration, run:
-- ALTER TABLE users DROP COLUMN IF EXISTS phone;
`;
  
  // Write file
  fs.writeFileSync(filepath, template, 'utf8');
  
  console.log('✅ Migration file created:');
  console.log(`   ${filename}`);
  console.log('\nEdit the file and add your SQL, then run:');
  console.log('   npm run migrate');
}

// Get migration name from command line
const migrationName = process.argv[2];

if (require.main === module) {
  createMigration(migrationName);
}

module.exports = createMigration;
