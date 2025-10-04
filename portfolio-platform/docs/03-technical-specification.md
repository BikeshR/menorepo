# Technical Specification Document
## Portfolio Platform

**Document Version:** 1.0
**Date:** 2025-01-04
**Status:** Draft - Awaiting Review
**Owner:** Bikesh Rana

---

## 1. Overview

This document provides detailed technical specifications for the Portfolio Platform MVP, including API contracts, data models, component specifications, and implementation details.

**Last Updated:** January 2025
**Versions:** Next.js 15.5, React 19, Tailwind CSS 4.1, Biome 2.2.5

### 1.1 Installation Quick Start

```bash
# Create Next.js 15 project with Tailwind 4
npx create-next-app@latest portfolio-platform --typescript --app

# Navigate to project
cd portfolio-platform

# Install core dependencies
npm install @supabase/ssr @supabase/supabase-js node-appwrite
npm install @tanstack/react-query zustand
npm install react-hook-form zod @hookform/resolvers
npm install lucide-react class-variance-authority clsx tailwind-merge

# Install Tailwind 4 and animation library
npm install -D tailwindcss@next @tailwindcss/vite tw-animate-css

# Install Biome.js
npm install -D @biomejs/biome

# Initialize shadcn/ui with Tailwind v4 support (use canary)
npx shadcn@canary init

# Initialize Supabase
npx supabase init
```

---

## 2. Technology Stack Details

### 2.0 Important Version Notes & Breaking Changes

#### Tailwind CSS v4 (Major Breaking Changes)
- **No `tailwind.config.ts` file**: Configuration now done via CSS `@theme` directive
- **Import syntax**: Use `@import "tailwindcss"` instead of `@tailwind` directives
- **Animation library**: `tailwindcss-animate` replaced with `tw-animate-css`
- **Color format**: OKLCH recommended over HSL for better color manipulation
- **Browser support**: Safari 16.4+, Chrome 111+, Firefox 128+ (no older browser support)
- **Border/Ring defaults**: No longer default to gray colors, use `currentColor`
- **Size utilities**: Use `size-*` (e.g., `size-10`) instead of `w-10 h-10`
- **No PostCSS needed**: Tailwind v4 has built-in CSS processing

#### Next.js 15.5
- **React 19 stable** support
- **Turbopack stable** for development (`next dev --turbo`)
- **New APIs**: `after()`, `forbidden()`, `unauthorized()`
- Breaking changes from v14: See official upgrade guide

#### React 19
- **Stable release** (December 2024)
- **Actions**: Simplified async operations, form handling
- **New hooks**: useActionState, useFormStatus, useOptimistic, use()
- **Server Components**: Fully stable
- **Removed APIs**: Some legacy APIs deprecated

#### Supabase SSR v0.7
- **Migrated from Auth Helpers**: Use `@supabase/ssr` instead of deprecated `@supabase/auth-helpers-nextjs`
- **Better Next.js 15 integration**: Improved cookie handling for App Router
- **Breaking change**: Different client creation pattern

#### Zustand v5
- **React 18+ required**: Dropped support for React 17 and below
- **useSyncExternalStore**: Now uses native React hook instead of polyfill
- **Custom equality**: Use `createWithEqualityFn` for custom equality functions
- **setState replace flag**: Must provide complete state object when `replace: true`

#### Biome v2
- **Type inference**: New multi-file analysis capabilities
- **Suppression ranges**: `// biome-ignore-start` and `// biome-ignore-end`
- **Improved import organizer**: Better handling of side-effect imports

---

### 2.1 Core Dependencies

```json
{
  "dependencies": {
    "next": "^15.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.0",

    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.48.0",

    "node-appwrite": "^19.0.0",

    "@tanstack/react-query": "^5.90.0",
    "zustand": "^5.0.8",

    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-slot": "^1.1.1",

    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.8.0",

    "react-hook-form": "^7.63.0",
    "zod": "^3.24.1",
    "@hookform/resolvers": "^3.10.0",

    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.2.5",
    "@tailwindcss/vite": "^4.1.0",
    "tw-animate-css": "^1.0.1",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.6",
    "@types/react-dom": "^19.0.2",
    "tailwindcss": "^4.1.0",
    "supabase": "^1.220.0"
  }
}
```

### 2.2 Configuration Files

#### biome.json
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

#### tsconfig.json
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

#### globals.css (Tailwind 4 Configuration)
```css
@import "tailwindcss";
@import "tw-animate-css";

/* Theme configuration using @theme directive (Tailwind v4) */
@theme {
  /* Color system using OKLCH for better color manipulation */
  --color-border: oklch(0.9 0.02 240);
  --color-input: oklch(0.9 0.02 240);
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

**Note:** Tailwind CSS v4 no longer uses `tailwind.config.ts`. Configuration is done via CSS using the `@theme` directive. The `@import "tailwindcss"` replaces the old `@tailwind` directives.

#### next.config.ts
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

## 3. Project Structure

### 3.1 Complete Folder Structure

```
portfolio-platform/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    # Landing page
│   │   │   ├── about/
│   │   │   │   └── page.tsx
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx                # Projects listing
│   │   │   │   └── demo-project/           # Dummy public project
│   │   │   │       └── page.tsx
│   │   │   └── contact/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (private)/
│   │   │   ├── layout.tsx                  # Admin layout with auth
│   │   │   ├── admin/
│   │   │   │   └── page.tsx                # Admin home/dashboard
│   │   │   └── demo-private/               # Dummy private project
│   │   │       ├── page.tsx
│   │   │       ├── actions.ts              # Server actions
│   │   │       └── _components/
│   │   │           └── DemoComponent.tsx
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── callback/
│   │   │   │   │   └── route.ts            # OAuth callback
│   │   │   │   └── logout/
│   │   │   │       └── route.ts
│   │   │   └── demo-private/
│   │   │       └── data/
│   │   │           └── route.ts            # Example API route
│   │   │
│   │   ├── layout.tsx                      # Root layout
│   │   ├── globals.css                     # Global styles
│   │   └── error.tsx                       # Global error boundary
│   │
│   ├── components/
│   │   ├── ui/                             # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   └── dialog.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileNav.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── LogoutButton.tsx
│   │   │
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       └── PageHeader.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Client component client
│   │   │   ├── server.ts                   # Server component client
│   │   │   └── middleware.ts               # Middleware client
│   │   │
│   │   ├── appwrite/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   │
│   │   ├── utils.ts                        # cn() helper, etc.
│   │   └── constants.ts
│   │
│   ├── stores/
│   │   ├── auth.store.ts                   # Auth state (Zustand)
│   │   └── demo.store.ts                   # Demo project state
│   │
│   ├── types/
│   │   ├── global.d.ts
│   │   ├── supabase.ts                     # Generated from DB
│   │   └── projects/
│   │       └── demo-private.ts
│   │
│   └── middleware.ts                       # Next.js middleware
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20250104000000_initial_schema.sql
│   └── functions/
│       └── demo-function/
│           └── index.ts
│
├── appwrite/
│   └── functions/
│       └── demo-function/
│           └── index.js
│
├── public/
│   ├── images/
│   └── icons/
│
├── .github/
│   └── workflows/
│       ├── supabase-deploy.yml
│       └── appwrite-deploy.yml
│
├── docs/
│   ├── 01-product-requirements.md
│   ├── 02-system-architecture.md
│   ├── 03-technical-specification.md
│   ├── 04-database-schema.md
│   ├── 05-setup-guide.md
│   └── 06-mvp-roadmap.md
│
├── .env.local
├── .env.example
├── .gitignore
├── biome.json
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md

**Note:** No `tailwind.config.ts` file in Tailwind v4. All configuration is in `src/app/globals.css`.
```

---

## 4. Type Definitions

### 4.1 Core Types

#### types/global.d.ts
```typescript
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
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type User = {
  id: string
  email: string
  created_at: string
}

export type Session = {
  access_token: string
  refresh_token: string
  expires_at: number
  user: User
}
```

#### types/projects/demo-private.ts
```typescript
export type DemoData = {
  id: string
  userId: string
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export type CreateDemoDataInput = {
  title: string
  content: string
}

export type UpdateDemoDataInput = Partial<CreateDemoDataInput> & {
  id: string
}
```

---

## 5. Authentication Implementation

### 5.1 Supabase Client Setup

#### lib/supabase/server.ts
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/global'

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
          } catch (error) {
            // Handle middleware context where cookies are read-only
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle middleware context
          }
        },
      },
    }
  )
}
```

#### lib/supabase/client.ts
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/global'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### lib/supabase/middleware.ts
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/global'

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
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}
```

### 5.2 Middleware

#### middleware.ts
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Update session
  const response = await updateSession(request)

  // Check auth for admin routes
  if (pathname.startsWith('/admin')) {
    const supabase = createClient(request, response)
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

### 5.3 Login Page

#### app/login/page.tsx
```typescript
import { LoginForm } from '@/components/auth/LoginForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/admin')
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Admin Login</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to access the admin panel
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
```

#### components/auth/LoginForm.tsx
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  )
}
```

---

## 6. API Routes Specification

### 6.1 Authentication Endpoints

#### POST /api/auth/logout
```typescript
// app/api/auth/logout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

### 6.2 Demo Private Project Endpoints

#### GET /api/demo-private/data
```typescript
// app/api/demo-private/data/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  // Check auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch data (RLS automatically filters by user_id)
  const { data, error } = await supabase
    .from('demo_private_data')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
```

#### POST /api/demo-private/data
```typescript
export async function POST(request: Request) {
  const supabase = createClient()

  // Check auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, content } = body

  // Validate
  if (!title || !content) {
    return NextResponse.json(
      { error: 'Title and content are required' },
      { status: 400 }
    )
  }

  // Insert (user_id automatically set by RLS)
  const { data, error } = await supabase
    .from('demo_private_data')
    .insert({
      user_id: user.id,
      title,
      content,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
```

---

## 7. Server Actions

### 7.1 Demo Private Project Actions

#### app/(private)/demo-private/actions.ts
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createDemoDataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  content: z.string().min(1, 'Content is required').max(1000),
})

export async function createDemoData(formData: FormData) {
  const supabase = createClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Validate input
  const parsed = createDemoDataSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { title, content } = parsed.data

  // Insert
  const { error } = await supabase.from('demo_private_data').insert({
    user_id: user.id,
    title,
    content,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/demo-private')

  return { success: true }
}

export async function deleteDemoData(id: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('demo_private_data')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/demo-private')

  return { success: true }
}
```

---

## 8. Component Specifications

### 8.1 Layout Components

#### components/layout/Header.tsx
```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          Portfolio
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/about" className="text-sm hover:text-primary">
            About
          </Link>
          <Link href="/projects" className="text-sm hover:text-primary">
            Projects
          </Link>
          <Link href="/contact" className="text-sm hover:text-primary">
            Contact
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Login</Link>
          </Button>
        </nav>

        {/* Mobile nav - implement MobileNav component */}
      </div>
    </header>
  )
}
```

#### components/layout/Sidebar.tsx
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { LayoutDashboard, FolderOpen } from 'lucide-react'

const navItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Demo Private',
    href: '/admin/demo-private',
    icon: FolderOpen,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/10">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="text-xl font-bold">
          Admin Panel
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-4">
        <LogoutButton />
      </div>
    </aside>
  )
}
```

### 8.2 Auth Components

#### components/auth/LogoutButton.tsx
```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <Button
      onClick={handleLogout}
      variant="outline"
      className="w-full justify-start gap-2"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  )
}
```

---

## 9. Page Specifications

### 9.1 Public Pages

#### app/(public)/page.tsx (Landing)
```typescript
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="container mx-auto px-4">
      <section className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Bikesh Rana
        </h1>
        <p className="mt-6 text-xl text-muted-foreground">
          Full Stack Developer | Building modern web applications
        </p>

        <div className="mt-10 flex gap-4">
          <Button asChild size="lg">
            <Link href="/projects">View Projects</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/contact">Get in Touch</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
```

#### app/(public)/projects/page.tsx
```typescript
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'

const projects = [
  {
    slug: 'demo-project',
    title: 'Demo Project',
    description: 'A demonstration of project showcase capabilities',
    tech: ['Next.js', 'TypeScript', 'Tailwind CSS'],
  },
]

export default function ProjectsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold">Projects</h1>
      <p className="mt-2 text-muted-foreground">
        Explore my portfolio of web applications
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link key={project.slug} href={`/projects/${project.slug}`}>
            <Card className="h-full transition-shadow hover:shadow-lg">
              <CardHeader>
                <CardTitle>{project.title}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full bg-muted px-3 py-1 text-xs"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

### 9.2 Private Pages

#### app/(private)/layout.tsx
```typescript
import { Sidebar } from '@/components/layout/Sidebar'

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
```

#### app/(private)/admin/page.tsx
```typescript
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { FolderOpen } from 'lucide-react'

const privateProjects = [
  {
    title: 'Demo Private Project',
    description: 'A demonstration of private project functionality',
    href: '/admin/demo-private',
  },
]

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your private projects and tools
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {privateProjects.map((project) => (
          <Link key={project.href} href={project.href}>
            <Card className="h-full transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{project.title}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

#### app/(private)/demo-private/page.tsx
```typescript
import { createClient } from '@/lib/supabase/server'
import { DemoComponent } from './_components/DemoComponent'

export default async function DemoPrivatePage() {
  const supabase = createClient()

  const { data: demoData } = await supabase
    .from('demo_private_data')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-3xl font-bold">Demo Private Project</h1>
      <p className="mt-2 text-muted-foreground">
        This is a demonstration of a private project with data persistence
      </p>

      <div className="mt-8">
        <DemoComponent initialData={demoData || []} />
      </div>
    </div>
  )
}
```

---

## 10. State Management

### 10.1 Zustand Store Example (v5)

#### stores/auth.store.ts
```typescript
import { create } from 'zustand'
import type { User } from '@/types/global'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
}

// Zustand v5 syntax - uses native useSyncExternalStore
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))

// For custom equality (if needed), use createWithEqualityFn
import { createWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'

export const useAuthStoreWithShallow = createWithEqualityFn<AuthState>(
  (set) => ({
    user: null,
    setUser: (user) => set({ user }),
  }),
  shallow
)
```

### 10.2 React Query Setup

#### app/layout.tsx (excerpt)
```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

---

## 11. Environment Variables

### 11.1 Required Variables

#### .env.example
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Appwrite
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT=your-project-id
APPWRITE_API_KEY=your-api-key

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 12. Testing Strategy

### 12.1 Unit Testing Example

```typescript
// __tests__/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })
})
```

---

## 13. Performance Optimizations

### 13.1 Image Optimization
```typescript
import Image from 'next/image'

<Image
  src="/images/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority
  className="rounded-lg"
/>
```

### 13.2 Dynamic Imports
```typescript
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
})
```

### 13.3 Route Configuration
```typescript
// app/(public)/page.tsx
export const revalidate = 60 // ISR: revalidate every 60 seconds

// app/(public)/about/page.tsx
export const dynamic = 'force-static' // Static generation

// app/(private)/admin/page.tsx
export const dynamic = 'force-dynamic' // Always SSR
```

---

## 14. Error Handling

### 14.1 Global Error Boundary

#### app/error.tsx
```typescript
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  )
}
```

### 14.2 API Error Handling Pattern
```typescript
try {
  const response = await fetch('/api/demo-private/data')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Request failed')
  }

  const data = await response.json()
  return data
} catch (error) {
  console.error('API Error:', error)
  return { error: error instanceof Error ? error.message : 'Unknown error' }
}
```

---

## 15. Security Headers

### 15.1 next.config.ts Security
```typescript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}
```

---

## 16. Deployment Checklist

### 16.1 Pre-Deployment
- [ ] All environment variables set in Vercel
- [ ] Supabase project created and configured
- [ ] Appwrite project created and configured
- [ ] Database migrations applied
- [ ] Admin user created in Supabase Auth
- [ ] GitHub Actions secrets configured
- [ ] Build succeeds locally (`npm run build`)
- [ ] Type checking passes (`tsc --noEmit`)
- [ ] Biome linting passes (`npx biome check .`)
- [ ] Tailwind CSS 4 setup verified (no `tailwind.config.ts`, check `globals.css`)
- [ ] shadcn/ui components using `tw-animate-css` (not `tailwindcss-animate`)
- [ ] Browser compatibility verified (Chrome 111+, Safari 16.4+, Firefox 128+)

### 16.2 Post-Deployment
- [ ] Verify public pages accessible
- [ ] Verify admin login works
- [ ] Test protected routes redirect correctly
- [ ] Check API routes return expected data
- [ ] Verify RLS policies work
- [ ] Test on mobile devices
- [ ] Check Lighthouse scores
- [ ] Monitor Vercel logs for errors

---

## 17. Approval & Next Steps

**Prepared By**: Claude (AI Assistant)
**Reviewed By**: Bikesh Rana
**Approval Status**: Pending Review
**Next Document**: Database Schema & Migration Plan

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-04 | Claude | Initial technical specification |
| 1.1 | 2025-01-04 | Claude | Updated to latest versions: Next.js 15.5, React 19, Tailwind 4.1, Biome 2.2.5, Zustand 5, Supabase SSR 0.7, TanStack Query 5.90 |

---

**END OF DOCUMENT**
