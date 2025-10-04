# Database Schema & Migration Plan
## Portfolio Platform

**Document Version:** 1.0
**Date:** 2025-01-04
**Status:** Draft - Awaiting Review
**Owner:** Bikesh Rana

---

## 1. Overview

This document details the database schema design, migration strategy, and data management approach for the Portfolio Platform MVP using Supabase PostgreSQL.

### 1.1 Database Strategy

- **Primary Database**: Supabase PostgreSQL (managed)
- **Free Tier Limits**: 500MB database, 50K monthly active users
- **Expected Usage**: < 10MB for MVP
- **Security**: Row Level Security (RLS) enabled on all tables
- **Migrations**: Version-controlled SQL files via Supabase CLI
- **Backup**: Automatic daily backups by Supabase

---

## 2. Schema Design Principles

### 2.1 Naming Conventions

- **Tables**: `snake_case`, plural names (e.g., `demo_private_data`)
- **Columns**: `snake_case`
- **Primary Keys**: Always `id` of type `UUID`
- **Foreign Keys**: `{table_singular}_id` (e.g., `user_id`)
- **Timestamps**: `created_at`, `updated_at` (both `TIMESTAMPTZ`)
- **Boolean flags**: `is_{property}` (e.g., `is_active`)

### 2.2 Standard Columns

Every table includes:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()` (with trigger)

### 2.3 Project Namespacing

Tables are namespaced by project to maintain modularity:
- Demo project: `demo_private_data`
- Investment portfolio (future): `portfolio_positions`, `portfolio_transactions`
- Pattern: `{project}_{entity}`

---

## 3. Core Schema (MVP)

### 3.1 Authentication Schema

Supabase provides built-in authentication tables in the `auth` schema:

```sql
-- Managed by Supabase Auth (read-only for application)
auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- ... other Supabase auth fields
)
```

**Note**: We reference `auth.users(id)` for foreign keys but never directly modify this table.

### 3.2 Demo Private Project Schema

```sql
-- Demo private project data table
CREATE TABLE public.demo_private_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 100),
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_demo_private_data_user_id ON public.demo_private_data(user_id);
CREATE INDEX idx_demo_private_data_created_at ON public.demo_private_data(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE public.demo_private_data IS 'Sample data for demonstrating private project functionality';
COMMENT ON COLUMN public.demo_private_data.user_id IS 'Reference to the user who owns this data';
COMMENT ON COLUMN public.demo_private_data.title IS 'Title of the demo entry (max 100 chars)';
COMMENT ON COLUMN public.demo_private_data.content IS 'Content of the demo entry (max 1000 chars)';
```

---

## 4. Row Level Security (RLS) Policies

### 4.1 RLS Philosophy

- **Default Deny**: All tables have RLS enabled with no access by default
- **Explicit Allow**: Policies explicitly grant access based on conditions
- **User Isolation**: Users can only access their own data via `auth.uid()`
- **Service Role Bypass**: Backend service role key bypasses RLS for admin operations

### 4.2 Demo Private Data Policies

```sql
-- Enable RLS on demo_private_data table
ALTER TABLE public.demo_private_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data
CREATE POLICY "Users can view own demo data"
  ON public.demo_private_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert own demo data"
  ON public.demo_private_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own demo data"
  ON public.demo_private_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own data
CREATE POLICY "Users can delete own demo data"
  ON public.demo_private_data
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 4.3 Testing RLS Policies

```sql
-- Test as authenticated user (simulating auth.uid())
SET request.jwt.claim.sub = 'user-uuid-here';

-- Should only return rows where user_id matches
SELECT * FROM demo_private_data;

-- Reset
RESET request.jwt.claim.sub;
```

---

## 5. Database Functions & Triggers

### 5.1 Updated At Trigger

Automatically update `updated_at` timestamp on row modifications:

```sql
-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for demo_private_data
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.demo_private_data
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### 5.2 Soft Delete Function (Future)

For tables requiring soft deletes instead of hard deletes:

```sql
-- Add deleted_at column (when needed)
ALTER TABLE public.demo_private_data
  ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Function for soft delete
CREATE OR REPLACE FUNCTION public.soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.demo_private_data
  SET deleted_at = NOW()
  WHERE id = OLD.id;
  RETURN NULL; -- Prevent actual deletion
END;
$$ LANGUAGE plpgsql;

-- Trigger (only create when soft delete is needed)
-- CREATE TRIGGER soft_delete_demo_data
--   BEFORE DELETE ON public.demo_private_data
--   FOR EACH ROW
--   EXECUTE FUNCTION public.soft_delete();
```

**Note**: Not implemented in MVP, reserved for future use.

---

## 6. Migration Strategy

### 6.1 Migration File Structure

```
supabase/
├── config.toml                          # Supabase configuration
├── migrations/
│   ├── 20250104000001_initial_schema.sql
│   ├── 20250104000002_demo_private_data.sql
│   ├── 20250104000003_rls_policies.sql
│   └── 20250104000004_triggers.sql
└── seed.sql                             # Optional seed data
```

### 6.2 Migration Workflow

```bash
# 1. Initialize Supabase in project
supabase init

# 2. Link to remote project (after creating on Supabase dashboard)
supabase link --project-ref your-project-ref

# 3. Create a new migration
supabase migration new migration_name

# 4. Edit migration file in supabase/migrations/

# 5. Test migration locally (requires Docker)
supabase start
supabase db reset  # Applies all migrations to local DB

# 6. Verify migration
psql postgresql://postgres:postgres@localhost:54322/postgres

# 7. Deploy to production
supabase db push

# 8. Commit migration files to Git
git add supabase/migrations/
git commit -m "Add migration: migration_name"
```

### 6.3 Migration Best Practices

- **Idempotent**: Use `IF NOT EXISTS` and `IF EXISTS` for safe re-runs
- **One Purpose**: Each migration file does one thing
- **No Rollback**: Migrations are forward-only; create new migration to undo
- **Test Locally**: Always test on local Supabase before deploying
- **Sequential**: Filenames timestamped to ensure order
- **Comments**: Document what and why in SQL comments

---

## 7. Initial Migration Files

### 7.1 Migration 1: Initial Schema

**File**: `supabase/migrations/20250104000001_initial_schema.sql`

```sql
-- Initial schema setup for Portfolio Platform
-- Sets up core database functions and extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search (future)

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at() IS
  'Trigger function to automatically update updated_at timestamp';
```

### 7.2 Migration 2: Demo Private Data Table

**File**: `supabase/migrations/20250104000002_demo_private_data.sql`

```sql
-- Create demo_private_data table for MVP demonstration
-- This table showcases private project functionality with authentication

CREATE TABLE public.demo_private_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 100),
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_demo_private_data_user_id
  ON public.demo_private_data(user_id);

CREATE INDEX idx_demo_private_data_created_at
  ON public.demo_private_data(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.demo_private_data
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comments
COMMENT ON TABLE public.demo_private_data IS
  'Demonstration table for private project functionality';

COMMENT ON COLUMN public.demo_private_data.user_id IS
  'Foreign key to auth.users - owner of this data';

COMMENT ON COLUMN public.demo_private_data.title IS
  'Title of the demo entry (1-100 characters)';

COMMENT ON COLUMN public.demo_private_data.content IS
  'Content of the demo entry (1-1000 characters)';
```

### 7.3 Migration 3: Row Level Security Policies

**File**: `supabase/migrations/20250104000003_rls_policies.sql`

```sql
-- Enable Row Level Security and create policies for demo_private_data
-- Ensures users can only access their own data

-- Enable RLS
ALTER TABLE public.demo_private_data ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view their own data
CREATE POLICY "Users can view own demo data"
  ON public.demo_private_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT policy: Users can insert data with their user_id
CREATE POLICY "Users can insert own demo data"
  ON public.demo_private_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: Users can update their own data
CREATE POLICY "Users can update own demo data"
  ON public.demo_private_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy: Users can delete their own data
CREATE POLICY "Users can delete own demo data"
  ON public.demo_private_data
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comments on policies
COMMENT ON POLICY "Users can view own demo data" ON public.demo_private_data IS
  'Users can SELECT their own demo data via auth.uid()';

COMMENT ON POLICY "Users can insert own demo data" ON public.demo_private_data IS
  'Users can INSERT demo data with their own user_id';

COMMENT ON POLICY "Users can update own demo data" ON public.demo_private_data IS
  'Users can UPDATE their own demo data';

COMMENT ON POLICY "Users can delete own demo data" ON public.demo_private_data IS
  'Users can DELETE their own demo data';
```

---

## 8. TypeScript Type Generation

### 8.1 Generate Types from Database

Supabase can auto-generate TypeScript types from the database schema:

```bash
# Generate types
supabase gen types typescript --local > src/types/supabase.ts

# Or from remote
supabase gen types typescript --project-id your-project-ref > src/types/supabase.ts
```

### 8.2 Generated Types Structure

```typescript
// src/types/supabase.ts (auto-generated)
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      demo_private_data: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_private_data_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
```

### 8.3 Using Generated Types

```typescript
import type { Database } from '@/types/supabase'
import { createClient } from '@/lib/supabase/server'

// Type-safe database client
const supabase = createClient<Database>()

// Type-safe queries
const { data, error } = await supabase
  .from('demo_private_data')
  .select('*')
  .single()

// data is typed as Database['public']['Tables']['demo_private_data']['Row']
```

---

## 9. Seed Data (Optional)

### 9.1 Seed File

**File**: `supabase/seed.sql`

```sql
-- Seed data for development and testing
-- WARNING: Only run in development, not in production!

-- Note: You must create a user via Supabase Auth first
-- This seed assumes user ID: 00000000-0000-0000-0000-000000000000

INSERT INTO public.demo_private_data (user_id, title, content) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'First Demo Entry',
    'This is a sample demo entry to showcase the private project functionality.'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'Second Demo Entry',
    'Another example entry demonstrating data persistence and RLS policies.'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'Third Demo Entry',
    'A third entry showing how multiple records are handled in the UI.'
  );
```

### 9.2 Running Seed Data

```bash
# Load seed data into local database
supabase db reset

# Or manually
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed.sql
```

---

## 10. Database Monitoring & Maintenance

### 10.1 Performance Monitoring

**Via Supabase Dashboard:**
- Database size tracking
- Query performance insights
- Index usage statistics
- Connection pooling metrics

**Via SQL:**
```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Check unused indexes (candidates for removal)
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public';
```

### 10.2 Vacuum & Analyze

Supabase automatically handles `VACUUM` and `ANALYZE`, but you can manually trigger:

```sql
-- Analyze table statistics
ANALYZE public.demo_private_data;

-- Vacuum to reclaim storage
VACUUM public.demo_private_data;

-- Full vacuum (more thorough, locks table)
VACUUM FULL public.demo_private_data;
```

---

## 11. Backup & Recovery

### 11.1 Automatic Backups

- **Supabase Free Tier**: Daily backups, 7-day retention
- **Supabase Pro Tier**: Point-in-time recovery (PITR)

### 11.2 Manual Backup

```bash
# Backup entire database
pg_dump postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres > backup.sql

# Backup specific tables
pg_dump -t public.demo_private_data \
  postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres > demo_backup.sql

# Restore from backup
psql postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres < backup.sql
```

### 11.3 Backup Strategy (Recommended)

For production:
1. **Automated**: Rely on Supabase daily backups
2. **Manual**: Weekly export to S3/cloud storage (via CI/CD)
3. **Critical changes**: Manual backup before major migrations
4. **Test restores**: Monthly restore test to verify backup integrity

---

## 12. Future Schema Additions

### 12.1 Investment Portfolio Project (v2)

**Planned tables** (not in MVP):

```sql
-- Portfolio positions table
CREATE TABLE public.portfolio_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL CHECK (char_length(symbol) > 0 AND char_length(symbol) <= 10),
  name TEXT NOT NULL,
  quantity DECIMAL(18, 8) NOT NULL CHECK (quantity >= 0),
  avg_cost DECIMAL(18, 2) NOT NULL CHECK (avg_cost >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency IN ('GBP', 'USD', 'EUR')),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'etf', 'bond')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, symbol)
);

-- Portfolio transactions table
CREATE TABLE public.portfolio_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.portfolio_positions(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend', 'fee')),
  quantity DECIMAL(18, 8) NOT NULL,
  price DECIMAL(18, 2) NOT NULL,
  total_amount DECIMAL(18, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_portfolio_positions_user_id ON public.portfolio_positions(user_id);
CREATE INDEX idx_portfolio_positions_symbol ON public.portfolio_positions(symbol);
CREATE INDEX idx_portfolio_transactions_user_id ON public.portfolio_transactions(user_id);
CREATE INDEX idx_portfolio_transactions_date ON public.portfolio_transactions(transaction_date DESC);

-- RLS policies (similar pattern to demo_private_data)
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;

-- ... (policies follow same pattern as demo_private_data)
```

### 12.2 Extensibility Patterns

When adding new projects:

1. **Namespace tables**: `{project}_{entity}`
2. **Copy RLS pattern**: User isolation via `auth.uid()`
3. **Standard columns**: `id`, `user_id`, `created_at`, `updated_at`
4. **Triggers**: Apply `handle_updated_at()` trigger
5. **Indexes**: Always index `user_id` and frequently queried columns
6. **Migrations**: One migration per project, separate file

---

## 13. Database Configuration

### 13.1 Supabase Config

**File**: `supabase/config.toml`

```toml
[db]
# The database schema to use in the project
schema = "public"

# Port to use for the local database
port = 54322

[db.pooler]
enabled = true
port = 54329
pool_mode = "transaction"
default_pool_size = 20
max_client_conn = 100
```

### 13.2 Connection Pooling

Supabase uses **Supavisor** for connection pooling:

- **Transaction mode**: Default, reuses connections between transactions
- **Session mode**: For long-lived connections (not recommended for serverless)
- **Pool size**: Automatically managed based on free tier limits

**Usage in Next.js:**
```typescript
// Serverless-friendly: Use transaction mode via Supabase client
// No need to manage pooling manually
const supabase = createClient()
```

---

## 14. Schema Validation & Testing

### 14.1 Migration Testing Checklist

Before deploying migrations:

- [ ] Run `supabase db reset` locally to test all migrations from scratch
- [ ] Verify RLS policies work (try accessing data as different users)
- [ ] Check indexes are created (`\d+ table_name` in psql)
- [ ] Confirm triggers fire correctly (update a row, check `updated_at`)
- [ ] Generate TypeScript types and verify correctness
- [ ] Test seed data loads without errors
- [ ] Verify foreign key constraints work
- [ ] Check constraints prevent invalid data

### 14.2 RLS Testing Script

```sql
-- Set user context
SET request.jwt.claim.sub = 'user-uuid-1';

-- Should succeed: Insert own data
INSERT INTO demo_private_data (user_id, title, content)
VALUES ('user-uuid-1', 'Test', 'Content');

-- Should fail: Insert data for another user
INSERT INTO demo_private_data (user_id, title, content)
VALUES ('user-uuid-2', 'Test', 'Content'); -- ERROR

-- Should only see own data
SELECT * FROM demo_private_data; -- Returns only user-uuid-1 rows

-- Reset
RESET request.jwt.claim.sub;
```

---

## 15. Troubleshooting

### 15.1 Common Issues

**Issue**: RLS policies blocking all queries
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- List all policies on a table
SELECT * FROM pg_policies WHERE tablename = 'demo_private_data';

-- Temporarily disable RLS for debugging (NEVER in production)
ALTER TABLE public.demo_private_data DISABLE ROW LEVEL SECURITY;
```

**Issue**: Migration fails due to existing objects
```sql
-- Use IF EXISTS/IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.demo_private_data (...);
DROP POLICY IF EXISTS "policy_name" ON public.demo_private_data;
```

**Issue**: Foreign key constraint violation
```sql
-- Check if referenced user exists
SELECT id FROM auth.users WHERE id = 'user-uuid';

-- Check orphaned records
SELECT * FROM demo_private_data
WHERE user_id NOT IN (SELECT id FROM auth.users);
```

### 15.2 Reset Database (Development)

```bash
# Complete reset: Drops all data, re-runs migrations
supabase db reset

# Reset and load seed data
supabase db reset && psql $DB_URL -f supabase/seed.sql
```

---

## 16. Security Best Practices

### 16.1 RLS Security Checklist

- [x] RLS enabled on all public tables
- [x] Policies use `auth.uid()` for user isolation
- [x] No bypass for unauthenticated users (unless intended for public tables)
- [x] Service role key secured (never in client code)
- [x] Policies tested with multiple user contexts

### 16.2 SQL Injection Prevention

- **Use parameterized queries**: Supabase client handles this automatically
- **Never concatenate user input** into raw SQL
- **Validate input**: Check constraints in database + app-level validation

```typescript
// GOOD: Parameterized via Supabase client
const { data } = await supabase
  .from('demo_private_data')
  .select('*')
  .eq('title', userInput)

// BAD: String interpolation in raw SQL (DON'T DO THIS)
// const { data } = await supabase.rpc('raw_sql', {
//   query: `SELECT * FROM demo_private_data WHERE title = '${userInput}'`
// })
```

---

## 17. Approval & Next Steps

**Prepared By**: Claude (AI Assistant)
**Reviewed By**: Bikesh Rana
**Approval Status**: Pending Review
**Next Document**: Development Setup Guide

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-04 | Claude | Initial database schema and migration plan |

---

**END OF DOCUMENT**
