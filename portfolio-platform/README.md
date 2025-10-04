# Portfolio Platform

A modern, modular portfolio platform built with Next.js 15, featuring a public portfolio site and a private admin area for managing projects and content.

**🌐 Live Production Site**: [https://www.bikesh.dev](https://www.bikesh.dev)

## Overview

This is a full-stack portfolio platform designed with modularity and scalability in mind. It showcases a clean separation between public-facing content and private administrative functionality, demonstrating modern web development patterns and best practices.

### Key Features

- **Public Portfolio Site**
  - Responsive landing page with hero section
  - Project showcase with detailed project pages
  - About page with bio and skills
  - Contact information page
  - Dark theme optimized for readability

- **Private Admin Area**
  - Single-user authentication with secure session management
  - Admin dashboard with project overview
  - Demo CRUD interface for managing private data
  - Protected routes with middleware

- **Modern Architecture**
  - Server Components and Server Actions for optimal performance
  - Type-safe database queries with generated TypeScript types
  - Optimistic UI updates for instant feedback
  - Automated database migrations via CI/CD

## Tech Stack

### Frontend
- **Next.js 15.5.4** - React framework with App Router
- **React 19.2.0** - UI library with latest concurrent features
- **TypeScript 5.9.3** - Type safety and developer experience
- **Tailwind CSS 4.1.14** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible UI components

### Backend & Database
- **Supabase PostgreSQL** - Serverless PostgreSQL database
- **iron-session 8.0.4** - Secure cookie-based session management
- **Server Actions** - Type-safe server mutations
- **Zod** - Runtime validation and type safety

### DevOps & Tools
- **Vercel** - Deployment platform with edge functions
- **GitHub Actions** - CI/CD for automated migrations
- **Biome.js** - Fast linter and formatter
- **Docker** - Local Supabase development

## Architecture Highlights

### Authentication
Single-user authentication using iron-session with credentials stored in environment variables. No signup flow - designed for a personal portfolio with one admin user.

### Data Layer
- Server Components fetch data directly from PostgreSQL
- Server Actions handle mutations with automatic revalidation
- Generated TypeScript types ensure type safety across the stack
- No Row Level Security (RLS) - application-level authentication

### Deployment
- Automated deployments via Vercel on push to `main`
- Database migrations auto-deployed via GitHub Actions
- Environment variables managed in Vercel dashboard
- Custom domain with automatic HTTPS

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/BikeshR/menorepo.git
   cd menorepo/portfolio-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start local Supabase**
   ```bash
   npx supabase start
   ```

   This will output your local Supabase credentials. Save these for the next step.

4. **Configure environment variables**

   Create `.env.local` in the project root:
   ```bash
   # Admin Authentication
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   SESSION_SECRET=your-32-character-random-string

   # Supabase (Local)
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key

   # Appwrite (Optional - for file uploads)
   NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
   APPWRITE_API_KEY=your-api-key
   ```

5. **Apply database migrations**
   ```bash
   npm run db:reset
   npm run db:types
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run Biome linter
- `npm run lint:fix` - Fix linting issues
- `npm run type-check` - Run TypeScript type checking
- `npm run db:reset` - Reset local database and apply migrations
- `npm run db:types` - Generate TypeScript types from database schema

## Production Deployment

### Environment Variables (Vercel)

Configure these in your Vercel project settings:

```bash
# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-production-password
SESSION_SECRET=your-production-32-character-random-string

# Supabase (Production)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key

# Appwrite (Optional)
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
```

### Database Migrations

Database migrations are automatically deployed via GitHub Actions when you push changes to the `main` branch:

1. Add migration file to `supabase/migrations/`
2. Commit and push to `main`
3. GitHub Actions automatically applies migration to production Supabase

**GitHub Secrets Required:**
- `SUPABASE_PROJECT_REF` - Your Supabase project reference ID
- `SUPABASE_ACCESS_TOKEN` - Personal access token from Supabase
- `SUPABASE_DB_PASSWORD` - Your Supabase database password

## Project Structure

```
portfolio-platform/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/          # Public routes (landing, projects, etc.)
│   │   ├── (private)/         # Protected admin routes
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout components (Header, Footer)
│   │   └── shared/           # Shared components
│   ├── lib/                   # Utility functions and clients
│   │   ├── auth/             # Authentication utilities
│   │   ├── supabase/         # Supabase clients
│   │   └── appwrite/         # Appwrite clients
│   └── types/                 # TypeScript type definitions
├── supabase/
│   └── migrations/            # Database migration files
├── docs/                      # Project documentation
└── .github/
    └── workflows/             # GitHub Actions workflows
```

## Database Schema

The database uses PostgreSQL via Supabase with the following main tables:

- `demo_private_data` - Demo CRUD table for admin area (title, content, timestamps)

Migrations are version-controlled in `supabase/migrations/` and automatically applied via GitHub Actions.

## Development Workflow

### Creating a New Feature

1. Create a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the project structure

3. Test locally
   ```bash
   npm run lint
   npm run type-check
   npm run build
   ```

4. Commit with conventional commits
   ```bash
   git commit -m "feat: add your feature description"
   ```

5. Push and create a pull request
   ```bash
   git push origin feature/your-feature-name
   ```

### Adding a Database Migration

1. Create a new migration file
   ```bash
   npx supabase migration new your_migration_name
   ```

2. Edit the migration file in `supabase/migrations/`

3. Apply locally to test
   ```bash
   npm run db:reset
   ```

4. Commit and push - GitHub Actions will apply to production

## Security Notes

- Authentication uses secure cookie-based sessions with iron-session
- Session cookies are HTTP-only, secure in production, and SameSite=lax
- Admin credentials stored in environment variables (never in code)
- Middleware protects all `/admin` routes
- No RLS policies - application-level authentication only

## Performance

- **First Load JS**: ~102 kB shared
- **Largest Route**: /admin/demo-private at 114 kB total
- **Middleware**: 41.5 kB
- Server Components for optimal data fetching
- Static pages pre-rendered at build time
- Dynamic pages rendered on-demand

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- `01-product-requirements.md` - Product vision and requirements
- `02-system-architecture.md` - System design and architecture
- `03-technical-specification.md` - Detailed technical specifications
- `04-database-schema.md` - Database design and schema
- `05-setup-guide.md` - Development environment setup
- `06-mvp-roadmap.md` - MVP implementation roadmap and progress

## Contributing

This is a personal portfolio project, but feedback and suggestions are welcome! Please open an issue to discuss any changes.

## License

This project is private and proprietary.

## Author

**Bikesh Rana**
- Website: [https://www.bikesh.dev](https://www.bikesh.dev)
- GitHub: [@BikeshR](https://github.com/BikeshR)

## Acknowledgments

Built with modern web technologies and best practices:
- Next.js team for the incredible framework
- Vercel for seamless deployment
- Supabase for the database platform
- shadcn for the beautiful UI components

---

**Version**: 1.0.0
**Last Updated**: October 2025
