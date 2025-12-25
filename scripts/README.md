# Database Scripts

This directory contains database management scripts for PassVault.

## Available Scripts

### 1. Initialize Database
Creates all tables, functions, and triggers from `init.sql`:

```bash
npm run db:init
```

**What it does:**
- Creates `users` table
- Creates `devices` table
- Creates `vaults` table
- Sets up triggers and functions
- Enables UUID extension

### 2. Run Migrations
Executes all pending migrations from the `migrations/` directory:

```bash
npm run db:migrate
```

**What it does:**
- Creates `migrations` tracking table if needed
- Runs only new migrations that haven't been executed
- Tracks executed migrations to prevent re-running
- Supports rollback information in comments

### 3. Create New Migration
Generates a timestamped migration file:

```bash
npm run migration:create "migration_name"
```

**Example:**
```bash
npm run migration:create "add_user_preferences"
```

**Output:**
- Creates `migrations/20251224_120000_add_user_preferences.sql`
- File includes template with rollback instructions

### 4. Reset Database
**WARNING:** Drops all tables and re-initializes (development only):

```bash
npm run db:reset
```

**What it does:**
- Prompts for confirmation
- Drops all tables
- Drops all functions
- Re-runs `init.sql`
- **Blocked in production environment**

## Directory Structure

```
backend/
├── scripts/
│   ├── init-db.js           # Initialize database
│   ├── migrate.js           # Run migrations
│   ├── create-migration.js  # Generate migration files
│   └── reset-db.js          # Reset database (dev only)
├── migrations/              # Migration files (auto-created)
│   └── YYYYMMDD_HHMMSS_description.sql
└── init.sql                 # Initial schema
```

## Migration File Format

Migration files are named: `YYYYMMDD_HHMMSS_description.sql`

Example: `20251224_120000_add_user_preferences.sql`

```sql
-- Migration: add_user_preferences
-- Created: 2025-12-24T12:00:00.000Z

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Rollback instructions:
-- ALTER TABLE users DROP COLUMN IF EXISTS preferences;
```

## Usage Examples

### First-Time Setup
```bash
# 1. Set DATABASE_URL in .env
# 2. Initialize database
npm run db:init

# 3. Start the server
npm start
```

### Adding a New Feature
```bash
# 1. Create migration
npm run migration:create "add_feature_name"

# 2. Edit the migration file in migrations/
# 3. Run migrations
npm run db:migrate
```

### Development Reset
```bash
# Reset database to clean state
npm run db:reset
```

## Environment Variables

Required in `.env`:

```env
# Option 1: Connection string (Neon DB)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Option 2: Individual parameters
DB_USER=passvault
DB_HOST=localhost
DB_NAME=passvault
DB_PASSWORD=your_password
DB_PORT=5432
```

## Notes

- All scripts use the database configuration from `src/config/db.js`
- Migrations are executed in alphabetical order (timestamp-based)
- Migration tracking prevents duplicate execution
- Reset script is blocked in production environment
- All scripts support both Neon DB and local PostgreSQL
