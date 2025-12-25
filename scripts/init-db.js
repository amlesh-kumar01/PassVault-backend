#!/usr/bin/env node

/**
 * Database Initialization Script
 * Runs init.sql to create tables, functions, and triggers
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

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connecting to database...');
    
    // Read init.sql file
    const initSqlPath = path.join(__dirname, '..', 'init.sql');
    const sql = fs.readFileSync(initSqlPath, 'utf8');
    
    console.log('📄 Running init.sql...');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ Database initialized successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - devices');
    console.log('   - vaults');
    console.log('🔧 Triggers and functions created');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('\n✨ Initialization complete!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}

module.exports = initializeDatabase;
