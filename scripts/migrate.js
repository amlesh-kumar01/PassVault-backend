#!/usr/bin/env node

/**
 * Database Migration Script
 * Runs all pending migrations in the migrations/ directory
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
    };

const pool = new Pool(poolConfig);
const migrationsDir = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Migrations table ready');
  } catch (error) {
    console.error('❌ Error creating migrations table:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function getExecutedMigrations() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT name FROM migrations ORDER BY id ASC'
    );
    return result.rows.map(row => row.name);
  } catch (error) {
    console.error('❌ Error fetching executed migrations:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function executeMigration(filename) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Read migration file
    const migrationPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`📄 Executing migration: ${filename}`);
    
    // Execute migration
    await client.query(sql);
    
    // Record migration
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [filename]
    );
    
    await client.query('COMMIT');
    console.log(`✅ Migration completed: ${filename}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${filename}`);
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('📁 Created migrations directory');
    }
    
    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }
    
    // Get executed migrations
    const executed = await getExecutedMigrations();
    
    // Filter pending migrations
    const pending = files.filter(f => !executed.includes(f));
    
    if (pending.length === 0) {
      console.log('✨ All migrations are up to date!');
      return;
    }
    
    console.log(`📊 Found ${pending.length} pending migration(s)`);
    
    // Execute pending migrations
    for (const file of pending) {
      await executeMigration(file);
    }
    
    console.log('\n✨ All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}

module.exports = runMigrations;
