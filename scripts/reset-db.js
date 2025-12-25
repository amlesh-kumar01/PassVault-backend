#!/usr/bin/env node

/**
 * Database Reset Script
 * WARNING: This will DROP all tables and re-initialize the database
 * Use only in development!
 */

const readline = require('readline');
const { Pool } = require('pg');
const initializeDatabase = require('./init-db');
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

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function resetDatabase() {
  const client = await pool.connect();
  
  try {
    // Check environment
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Cannot reset database in production!');
      process.exit(1);
    }
    
    console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!');
    console.log('Database:', poolConfig.database || 'neon');
    console.log('');
    
    const confirmed = await askConfirmation('Type "yes" to confirm: ');
    
    if (!confirmed) {
      console.log('❌ Reset cancelled');
      process.exit(0);
    }
    
    console.log('\n🗑️  Dropping all tables...');
    
    // Drop tables in correct order (respecting foreign keys)
    await client.query('DROP TABLE IF EXISTS vaults CASCADE;');
    await client.query('DROP TABLE IF EXISTS devices CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    await client.query('DROP TABLE IF EXISTS migrations CASCADE;');
    
    // Drop functions
    await client.query('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;');
    
    console.log('✅ All tables dropped');
    
  } catch (error) {
    console.error('❌ Error dropping tables:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  
  // Re-initialize database
  console.log('\n📦 Re-initializing database...');
  await initializeDatabase();
}

// Run if called directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('\n✨ Database reset complete!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}

module.exports = resetDatabase;
