# Development Setup Guide
## Portfolio Platform

**Document Version:** 1.0
**Date:** 2025-01-04
**Status:** Draft - Awaiting Review
**Owner:** Bikesh Rana

---

## 1. Overview

This guide provides step-by-step instructions for setting up the Portfolio Platform development environment from scratch.

**Estimated Setup Time**: 30-45 minutes

### 1.1 Prerequisites

Before starting, ensure you have:

- **Node.js**: v20 or higher ([Download](https://nodejs.org/))
- **npm**: v10 or higher (comes with Node.js)
- **Git**: Latest version ([Download](https://git-scm.com/))
- **Docker Desktop**: For local Supabase (optional but recommended) ([Download](https://www.docker.com/products/docker-desktop/))
- **Code Editor**: VS Code recommended ([Download](https://code.visualstudio.com/))
- **GitHub Account**: For repository and CI/CD
- **Supabase Account**: Free tier ([Sign up](https://supabase.com/))
- **Appwrite Account**: Free tier ([Sign up](https://appwrite.io/))
- **Vercel Account**: Free tier ([Sign up](https://vercel.com/))

### 1.2 Verification

Check your installations:

```bash
node --version  # Should be v20.x.x or higher
npm --version   # Should be v10.x.x or higher
git --version   # Any recent version
docker --version # For local Supabase
```

---

## 2. Project Initialization

### 2.1 Create Next.js Project

```bash
# Navigate to your workspace
cd ~/Desktop/workspace/personal/menorepo

# Create Next.js 15 project with TypeScript and Tailwind
npx create-next-app@latest portfolio-platform \
  --typescript \
  --app \
  --tailwind \
  --src-dir \
  --import-alias "@/*"

# Navigate into project
cd portfolio-platform
```

**Prompts you'll see:**
- ✔ Would you like to use ESLint? → **No** (we use Biome.js)
- ✔ Would you like to use Turbopack? → **Yes**
- ✔ Initialize a new git repository? → **Yes**

### 2.2 Initialize Git Repository

```bash
# If not already initialized
git init

# Create initial commit
git add .
git commit -m "Initial Next.js 15 setup"

# Create GitHub repository (via GitHub CLI or manually on github.com)
gh repo create portfolio-platform --private --source=. --remote=origin

# Or add remote manually
git remote add origin https://github.com/YOUR_USERNAME/portfolio-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 3. Install Dependencies

### 3.1 Core Dependencies

```bash
# Supabase
npm install @supabase/ssr@^0.7.0 @supabase/supabase-js@^2.48.0

# Appwrite
npm install node-appwrite@^19.0.0

# State Management
npm install @tanstack/react-query@^5.90.0 zustand@^5.0.8

# Forms & Validation
npm install react-hook-form@^7.63.0 zod@^3.24.1 @hookform/resolvers@^3.10.0

# UI Utilities
npm install lucide-react@^0.468.0 class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^2.8.0
```

### 3.2 Dev Dependencies

```bash
# Tailwind CSS 4
npm install -D tailwindcss@^4.1.0 @tailwindcss/vite@^4.1.0

# Animations
npm install -D tw-animate-css@^1.0.1

# Biome.js
npm install -D @biomejs/biome@^2.2.5

# Supabase CLI
npm install -D supabase@^1.220.0

# Type definitions
npm install -D @types/node@^22.10.0 @types/react@^19.0.6 @types/react-dom@^19.0.2
```

### 3.3 Verify Installation

```bash
npm list --depth=0
```

Should show all installed packages with correct versions.

---

## 4. Configure Tooling

### 4.1 Biome.js Configuration

Create `biome.json` at project root:

```bash
npx biome init
```

Replace contents with:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.2.5/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useConst": "error",
        "noVar": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "asNeeded"
    }
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

### 4.2 Update package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "type-check": "tsc --noEmit",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:migration": "supabase migration new",
    "db:push": "supabase db push",
    "db:types": "supabase gen types typescript --local > src/types/supabase.ts"
  }
}
```

### 4.3 TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4.4 Tailwind CSS 4 Setup

**Remove default Tailwind files** (if created by Next.js):

```bash
rm -f tailwind.config.ts postcss.config.js postcss.config.mjs
```

**Update `src/app/globals.css`**:

```css
@import "tailwindcss";
@import "tw-animate-css";

/* Theme configuration using @theme directive (Tailwind v4) */
@theme {
  /* Color system using OKLCH for better color manipulation */
  --color-border: oklch(0.2 0.02 240);
  --color-input: oklch(0.2 0.02 240);
  --color-ring: oklch(0.6 0.1 240);
  --color-background: oklch(0.05 0.01 240);
  --color-foreground: oklch(0.98 0.01 240);

  --color-primary: oklch(0.7 0.15 240);
  --color-primary-foreground: oklch(0.98 0.01 240);

  --color-secondary: oklch(0.2 0.05 240);
  --color-secondary-foreground: oklch(0.98 0.01 240);

  --color-destructive: oklch(0.55 0.2 20);
  --color-destructive-foreground: oklch(0.98 0.01 240);

  --color-muted: oklch(0.15 0.02 240);
  --color-muted-foreground: oklch(0.7 0.02 240);

  --color-accent: oklch(0.25 0.05 240);
  --color-accent-foreground: oklch(0.98 0.01 240);

  --color-popover: oklch(0.08 0.01 240);
  --color-popover-foreground: oklch(0.98 0.01 240);

  --color-card: oklch(0.08 0.01 240);
  --color-card-foreground: oklch(0.98 0.01 240);

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}

/* Base styles */
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

### 4.5 Next.js Configuration

Update `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.appwrite.io',
      },
    ],
  },
}

export default nextConfig
```

---

## 5. Setup shadcn/ui

### 5.1 Initialize shadcn/ui

```bash
# Use canary version for Tailwind v4 support
npx shadcn@canary init
```

**Prompts:**
- ✔ Would you like to use TypeScript? → **Yes**
- ✔ Which style would you like to use? → **Default**
- ✔ Which color would you like to use as base color? → **Slate**
- ✔ Where is your global CSS file? → **src/app/globals.css**
- ✔ Would you like to use CSS variables for colors? → **Yes**
- ✔ Where is your tailwind config located? → **Not needed (using globals.css)**
- ✔ Configure the import alias for components? → **@/components**
- ✔ Configure the import alias for utils? → **@/lib/utils**

### 5.2 Install Initial Components

```bash
npx shadcn@canary add button
npx shadcn@canary add card
npx shadcn@canary add input
npx shadcn@canary add label
npx shadcn@canary add dropdown-menu
npx shadcn@canary add avatar
npx shadcn@canary add dialog
```

This creates:
- `src/components/ui/` folder with components
- `src/lib/utils.ts` with `cn()` helper

---

## 6. Setup Supabase

### 6.1 Initialize Supabase Locally

```bash
# Initialize Supabase in project
npx supabase init

# Start local Supabase (requires Docker)
npx supabase start
```

**Note the output** - save these credentials:
```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
anon key: eyJhbGc...
service_role key: eyJhbGc...
```

### 6.2 Create Supabase Project (Cloud)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - **Name**: portfolio-platform
   - **Database Password**: (generate strong password and save it)
   - **Region**: Closest to you (e.g., London for UK)
   - **Pricing Plan**: Free
4. Click "Create new project"
5. Wait for provisioning (~2 minutes)

### 6.3 Get Supabase Credentials

From Supabase Dashboard → Settings → API:

- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: `eyJhbGc...`
- **service_role secret key**: `eyJhbGc...` (keep secret!)

### 6.4 Link Local to Cloud

```bash
# Login to Supabase CLI
npx supabase login

# Link local project to cloud
npx supabase link --project-ref YOUR_PROJECT_REF
```

Find `PROJECT_REF` in your Supabase project URL: `https://PROJECT_REF.supabase.co`

---

## 7. Setup Appwrite

### 7.1 Create Appwrite Project (Cloud)

1. Go to [cloud.appwrite.io](https://cloud.appwrite.io/)
2. Create account / Sign in
3. Click "Create Project"
4. Fill in:
   - **Name**: portfolio-platform
   - **Project ID**: (auto-generated or custom)
5. Click "Create"

### 7.2 Get Appwrite Credentials

From Appwrite Console → Settings:

- **API Endpoint**: `https://cloud.appwrite.io/v1`
- **Project ID**: `xxxxx`

Create API Key:
1. Go to Overview → Integrations → API Keys
2. Click "Create API Key"
3. Name: `portfolio-platform-server`
4. Scopes: Select all (for development)
5. Save the **Secret** (shown once!)

### 7.3 Create Storage Bucket

1. Go to Storage
2. Click "Create bucket"
3. Name: `portfolio-public`
4. Permissions:
   - Read: `role:all` (anyone can read)
   - Create/Update/Delete: Authenticated users only
5. Click "Create"

Repeat for `portfolio-private` with stricter permissions.

---

## 8. Environment Variables

### 8.1 Create .env.local

Create `.env.local` at project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Appwrite
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT=your-project-id-here
APPWRITE_API_KEY=your-api-key-here

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 8.2 Create .env.example

Create `.env.example` for documentation (no real values):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Appwrite
NEXT_PUBLIC_APPWRITE_ENDPOINT=
NEXT_PUBLIC_APPWRITE_PROJECT=
APPWRITE_API_KEY=

# Next.js
NEXT_PUBLIC_APP_URL=
```

### 8.3 Update .gitignore

Ensure `.env.local` is ignored:

```bash
# Add to .gitignore if not already there
echo ".env.local" >> .gitignore
```

---

## 9. Database Setup

### 9.1 Create Migration Files

```bash
# Create migrations directory (if not exists)
mkdir -p supabase/migrations

# Create initial migration
npx supabase migration new initial_schema

# Create demo data migration
npx supabase migration new demo_private_data

# Create RLS policies migration
npx supabase migration new rls_policies
```

### 9.2 Add Migration SQL

**Copy SQL from Database Schema document** (04-database-schema.md) into:

- `supabase/migrations/TIMESTAMP_initial_schema.sql`
- `supabase/migrations/TIMESTAMP_demo_private_data.sql`
- `supabase/migrations/TIMESTAMP_rls_policies.sql`

### 9.3 Apply Migrations Locally

```bash
# Reset local DB and apply all migrations
npx supabase db reset

# Check migration status
npx supabase migration list
```

### 9.4 Apply Migrations to Cloud

```bash
# Push migrations to Supabase cloud
npx supabase db push
```

### 9.5 Generate TypeScript Types

```bash
# Generate types from local database
npm run db:types

# Or from cloud
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/supabase.ts
```

---

## 10. Create Directory Structure

### 10.1 Create Folders

```bash
# Create core directories
mkdir -p src/components/{ui,layout,auth,shared}
mkdir -p src/lib/{supabase,appwrite}
mkdir -p src/stores
mkdir -p src/types/projects
mkdir -p src/app/{api,\(public\),\(private\)}/
mkdir -p supabase/{migrations,functions}
mkdir -p appwrite/functions
```

### 10.2 Create Utility Files

**Create `src/lib/utils.ts`** (if not created by shadcn):

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Create `src/lib/constants.ts`**:

```typescript
export const APP_NAME = 'Portfolio Platform'
export const APP_DESCRIPTION = 'Personal portfolio and project showcase'
```

---

## 11. Setup Supabase Clients

### 11.1 Server Client

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Handle middleware context where cookies are read-only
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Handle middleware context
          }
        },
      },
    }
  )
}
```

### 11.2 Client Component Client

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 11.3 Middleware Client

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}
```

---

## 12. Setup Authentication

### 12.1 Create Middleware

Create `src/middleware.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Update session
  const response = await updateSession(request)

  // Check auth for admin routes
  if (pathname.startsWith('/admin')) {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 12.2 Create Admin User

In Supabase Dashboard:
1. Go to Authentication → Users
2. Click "Add user"
3. Fill in:
   - **Email**: your@email.com
   - **Password**: (strong password)
   - **Auto Confirm User**: Yes
4. Click "Create user"

Or via SQL:

```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'your@email.com',
  crypt('your-password', gen_salt('bf')),
  NOW()
);
```

---

## 13. Test Development Environment

### 13.1 Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` - should see Next.js welcome page.

### 13.2 Verify Supabase Connection

Create test file `src/app/api/test-supabase/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase.from('demo_private_data').select('count')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: data })
}
```

Visit `http://localhost:3000/api/test-supabase` - should return count.

### 13.3 Run Linting & Type Check

```bash
# Biome linting
npm run lint

# TypeScript check
npm run type-check

# Both should pass with no errors
```

---

## 14. Setup GitHub Actions (CI/CD)

### 14.1 Create Workflows Directory

```bash
mkdir -p .github/workflows
```

### 14.2 Create Supabase Deploy Workflow

Create `.github/workflows/supabase-deploy.yml`:

```yaml
name: Deploy Supabase Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
```

### 14.3 Add GitHub Secrets

In GitHub repository settings → Secrets and variables → Actions:

Add secrets:
- `SUPABASE_ACCESS_TOKEN` (from Supabase account settings)
- `SUPABASE_DB_PASSWORD` (your database password)
- `SUPABASE_PROJECT_ID` (from project settings)

---

## 15. Setup Vercel Deployment

### 15.1 Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 15.2 Deploy via Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import Git Repository (select your GitHub repo)
3. Configure Project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
4. Add Environment Variables (copy from `.env.local`)
5. Click "Deploy"

### 15.3 Configure Auto-Deploy

Vercel automatically deploys on every push to `main` branch.

**To change**:
- Settings → Git → Production Branch → Set to `main`
- Settings → Git → Deploy Hooks → Add webhook for manual triggers

---

## 16. Verification Checklist

Before proceeding to development:

- [ ] Node.js v20+ installed
- [ ] All npm dependencies installed successfully
- [ ] Biome.js running (`npm run lint` passes)
- [ ] TypeScript compiling (`npm run type-check` passes)
- [ ] Tailwind CSS 4 working (check `globals.css`)
- [ ] shadcn/ui components installed and working
- [ ] Supabase local running (`npx supabase status`)
- [ ] Supabase cloud project created
- [ ] Database migrations applied (local and cloud)
- [ ] TypeScript types generated from database
- [ ] Appwrite project created
- [ ] Environment variables configured (`.env.local`)
- [ ] Supabase clients created (server, client, middleware)
- [ ] Middleware protecting `/admin` routes
- [ ] Admin user created in Supabase Auth
- [ ] Dev server running (`npm run dev`)
- [ ] Test API route working
- [ ] GitHub repository created and pushed
- [ ] GitHub Actions secrets configured
- [ ] Vercel project created and deployed

---

## 17. Common Setup Issues

### 17.1 Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**:
```bash
# Start Docker Desktop
# Wait for Docker to fully start
# Then retry: npx supabase start
```

### 17.2 Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

### 17.3 Supabase Connection Failed

**Error**: `Failed to connect to Supabase`

**Solution**:
1. Check `.env.local` variables are correct
2. Verify project URL and keys from Supabase dashboard
3. Ensure Supabase project is active (not paused)
4. Check network/firewall settings

### 17.4 Type Generation Fails

**Error**: `Could not generate types`

**Solution**:
```bash
# Ensure Supabase is running
npx supabase status

# Ensure migrations are applied
npx supabase db reset

# Regenerate types
npm run db:types
```

### 17.5 Biome Not Found

**Error**: `biome: command not found`

**Solution**:
```bash
# Run via npx
npx biome check .

# Or ensure it's in devDependencies
npm install -D @biomejs/biome@latest
```

---

## 18. Next Steps

Once setup is complete:

1. **Review Documentation**: Familiarize yourself with all docs (PRD, Architecture, Technical Spec, Database Schema)
2. **Start Development**: Follow the MVP Implementation Roadmap (06-mvp-roadmap.md)
3. **Create Feature Branch**: `git checkout -b feature/initial-setup`
4. **Implement Core Features**: Start with authentication, then layouts, then projects
5. **Test Locally**: Ensure everything works before deploying
6. **Deploy to Production**: Push to `main` branch

---

## 19. Development Workflow

### 19.1 Daily Workflow

```bash
# 1. Start local Supabase
npm run db:start

# 2. Start dev server
npm run dev

# 3. Work on features

# 4. Before committing:
npm run lint:fix
npm run type-check

# 5. Commit and push
git add .
git commit -m "feat: description"
git push

# 6. Stop Supabase when done
npm run db:stop
```

### 19.2 Database Changes

```bash
# 1. Create migration
npm run db:migration add_new_table

# 2. Edit migration file in supabase/migrations/

# 3. Test locally
npm run db:reset

# 4. Regenerate types
npm run db:types

# 5. Deploy to cloud
npm run db:push
```

---

## 20. Useful Commands Reference

```bash
# Development
npm run dev                  # Start dev server with Turbopack
npm run build                # Build for production
npm run start                # Start production server

# Code Quality
npm run lint                 # Check code with Biome
npm run lint:fix             # Fix code issues
npm run format               # Format code
npm run type-check           # TypeScript type checking

# Database
npm run db:start             # Start local Supabase
npm run db:stop              # Stop local Supabase
npm run db:reset             # Reset local DB (applies migrations)
npm run db:migration         # Create new migration
npm run db:push              # Push migrations to cloud
npm run db:types             # Generate TypeScript types

# Supabase Direct
npx supabase status          # Check Supabase status
npx supabase studio          # Open Supabase Studio
npx supabase functions       # Manage edge functions
npx supabase gen types       # Generate types

# Git
git status                   # Check status
git add .                    # Stage changes
git commit -m "message"      # Commit with message
git push                     # Push to remote
```

---

## 21. Approval & Next Steps

**Prepared By**: Claude (AI Assistant)
**Reviewed By**: Bikesh Rana
**Approval Status**: Pending Review
**Next Document**: MVP Implementation Roadmap

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-04 | Claude | Initial development setup guide |

---

**END OF DOCUMENT**
