# Product Requirements Document (PRD)
## Portfolio Platform

**Document Version:** 1.0
**Date:** 2025-01-04
**Status:** Draft - Awaiting Review
**Owner:** Bikesh Rana

---

## 1. Executive Summary

### 1.1 Purpose
A unified web application serving dual purposes:
- **Public Portfolio**: Showcase working projects and technical capabilities for job hunting
- **Private Dashboard**: Host personal tools and applications for individual use

### 1.2 Vision Statement
Build a modular, extensible platform that demonstrates full-stack development expertise while providing practical personal tools, all deployed using modern cloud infrastructure.

### 1.3 Success Criteria
- Seamless separation of public/private content
- Easy addition of new projects with minimal code coupling
- Production deployment on Vercel + Supabase + Appwrite
- Showcase of modern development practices and patterns

---

## 2. Target Audience

### 2.1 Primary Users
- **Recruiters**: Technical recruiters evaluating full-stack development skills
- **Fellow Developers**: Peers reviewing technical implementation and code quality
- **Self (Admin)**: Single authenticated user managing private tools

### 2.2 User Characteristics
- High technical literacy
- Comfortable with detailed technical content
- Values substance over aesthetics (functionality > polish)

---

## 3. Product Scope

### 3.1 In Scope (MVP)

#### Public Features
- Landing page with professional introduction
- About page (dummy content for MVP)
- Projects showcase page
- Contact information
- At least one dummy public project demonstration
- Dark mode UI (no light mode)
- Responsive design (mobile-first approach)

#### Private Features
- Authentication system (single user)
- Protected dashboard with project links
- At least one dummy private project demonstration
- Route-level and API-level access control

#### Technical Features
- Next.js 15 with App Router and TypeScript
- Supabase integration (PostgreSQL + Auth)
- Appwrite integration (Storage + Functions capability)
- Automated CI/CD pipeline to Vercel
- Modular project structure for easy extensibility
- Modern React patterns (Server Components, Server Actions)

### 3.2 Out of Scope (MVP)

#### Deferred to v2+
- Investment Portfolio Analyzer (first post-MVP project)
- Multiple backend services in different languages
- External API integrations (broker APIs, data feeds)
- Advanced analytics and monitoring
- User management (multi-user support)
- Comment/like systems
- Notification system
- Scheduled tasks/cron jobs
- Real-time features (WebSockets, SSE)
- Blog/CMS functionality
- Light mode theme
- Internationalization
- E2E testing (added later as showcase)

---

## 4. Functional Requirements

### 4.1 Authentication & Authorization

#### FR-AUTH-001: User Authentication
- **Description**: Single admin user can authenticate using username/password
- **Provider**: Supabase Auth
- **Session**: Server-side with httpOnly cookies
- **Scope**: Both route-level and API endpoint protection

#### FR-AUTH-002: Public Access
- **Description**: All public routes accessible without authentication
- **No Analytics**: View counts not tracked

#### FR-AUTH-003: Private Access
- **Description**: All routes under `/admin/*` require authentication
- **Redirect**: Unauthenticated users redirect to login page
- **RLS**: Database-level security via Supabase Row Level Security

### 4.2 Public Features

#### FR-PUB-001: Landing Page
- **Description**: Hero section with name and title
- **Content**: Dummy content for MVP
- **CTA**: Clear navigation to projects and contact

#### FR-PUB-002: About Page
- **Description**: Professional background and skills
- **Content**: Placeholder for MVP, detailed later

#### FR-PUB-003: Projects Showcase
- **Description**: Grid/list of public projects
- **Details**: Basic project cards with title, description, tech stack
- **No Filtering**: Simple list, no search/categories for MVP

#### FR-PUB-004: Contact Information
- **Description**: Email, GitHub, LinkedIn links
- **No Form**: Direct links only for MVP

### 4.3 Private Features

#### FR-PRIV-001: Dashboard
- **Description**: Central hub for private projects
- **Layout**: Sidebar navigation + main content area
- **Content**: Simple links to available private projects

#### FR-PRIV-002: Project Isolation
- **Description**: Each private project is self-contained
- **Structure**: Own routes, components, API endpoints, types
- **Modularity**: Adding new project requires minimal changes to core

### 4.4 Project Management

#### FR-PROJ-001: Code-Based Configuration
- **Description**: Projects defined in code, not database
- **Registration**: Manual code changes + config file update
- **No UI**: No admin interface for adding projects in MVP

#### FR-PROJ-002: Project Structure
- **Routes**: Each project has dedicated route group
- **Components**: Project-specific components in `_components`
- **API**: Project-specific endpoints in `/api/[project-name]`
- **Types**: Project-specific types in `/types/projects/[project-name].ts`

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **Page Load**: Target < 3s on 3G connection
- **Lighthouse**: Aim for 90+ performance score
- **Optimization**: ISR, lazy loading, code splitting where applicable
- **Caching**: Appropriate cache headers for static assets

### 5.2 Scalability
- **Traffic**: Designed for low traffic (< 1000 monthly visitors initially)
- **Architecture**: Built to scale if needed (serverless, edge functions)
- **Database**: Supabase free tier (500MB, 50K MAU sufficient)

### 5.3 Security
- **Auth**: Industry-standard auth via Supabase
- **RLS**: Database-level security policies
- **HTTPS**: Enforced via Vercel
- **Secrets**: Environment variables, never committed to Git
- **CORS**: Configured appropriately for API endpoints

### 5.4 Reliability
- **Uptime**: Dependent on Vercel/Supabase SLAs (99.9%+)
- **Error Handling**: Graceful degradation, user-friendly error messages
- **Backups**: Not required for MVP (Supabase provides automatic backups)

### 5.5 Maintainability
- **Code Quality**: Strict TypeScript, Biome.js linting/formatting
- **Documentation**: Architecture decisions documented
- **Modularity**: Clear separation of concerns
- **Testing**: Unit tests for critical paths (minimal coverage)

### 5.6 Browser Support
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **No Legacy**: No IE11 or older browser support
- **Mobile**: Responsive design, tested on iOS/Android

### 5.7 Accessibility
- **Level**: Basic WCAG compliance via Radix primitives
- **Priority**: Low for MVP (inherits from component library)

---

## 6. Technical Stack

### 6.1 Frontend
- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix + Tailwind)
- **State Management**:
  - Local: `useState`
  - Global: Zustand
  - Server: React Query (TanStack Query)
  - Server Actions where appropriate
- **Forms**: React Hook Form + Zod validation
- **Tooling**: Biome.js (linting + formatting)

### 6.2 Backend
- **BFF Layer**: Next.js API Routes + Server Actions (hosted on Vercel)
- **Serverless Functions**:
  - Supabase Edge Functions (TypeScript, Deno)
  - Appwrite Functions (Node, Python, Go, Rust)
- **Future**: Dedicated services on Render.com/Koyeb if needed

### 6.3 Database & Storage
- **Primary Database**: Supabase (PostgreSQL)
- **File Storage**: Appwrite Cloud
- **ORM**: TBD during implementation (Prisma/Drizzle/Supabase client)
- **Migrations**: Supabase CLI with version-controlled migration files

### 6.4 Authentication
- **Provider**: Supabase Auth
- **Method**: Email/password (username/password)
- **Session**: Server-side, httpOnly cookies
- **Security**: Row Level Security (RLS) policies

### 6.5 Deployment & DevOps
- **Frontend Hosting**: Vercel
- **Database**: Supabase Cloud (free tier)
- **Storage/Functions**: Appwrite Cloud (free tier)
- **CI/CD**:
  - Vercel: Auto-deploy on push to `main`
  - Supabase/Appwrite: GitHub Actions
- **Environments**:
  - `main` branch = Production
  - `dev` branch = Testing
- **Domain**: TBD (may purchase via Vercel)

### 6.6 Monitoring & Analytics
- **Error Tracking**: Not in MVP
- **Analytics**: Not in MVP
- **Logging**: Platform-native (Vercel logs, Supabase logs)

---

## 7. User Stories

### 7.1 Public Visitor Stories

**US-001**: As a recruiter, I want to see a professional landing page so that I can quickly understand the developer's skills.

**US-002**: As a fellow developer, I want to browse public projects so that I can see practical implementations.

**US-003**: As a visitor, I want to view project details so that I can understand the technical approach and technologies used.

**US-004**: As a visitor, I want to easily contact the developer so that I can reach out for opportunities.

### 7.2 Admin User Stories

**US-005**: As the admin, I want to log in securely so that I can access private tools.

**US-006**: As the admin, I want to access an admin panel so that I can navigate to different private projects.

**US-007**: As the admin, I want to add new projects easily so that I can extend the platform without major refactoring.

**US-008**: As the admin, I want private projects to be completely hidden from public users so that personal tools remain secure.

---

## 8. Design Principles

### 8.1 Modularity First
- Each project is self-contained
- Minimal coupling between projects
- Shared utilities are truly shared (not project-specific)

### 8.2 Convention Over Configuration
- Follow Next.js App Router conventions
- Use standard folder structures
- Minimize configuration files

### 8.3 Serverless & Edge-First
- Prefer serverless functions over dedicated servers
- Use edge runtime where possible
- Keep cold starts minimal

### 8.4 Type Safety Everywhere
- Strict TypeScript mode
- No `any` types without explicit reason
- End-to-end type safety (frontend → backend → database)

### 8.5 Developer Experience
- Fast local development
- Clear error messages
- Simple setup process
- Automated formatting/linting

---

## 9. Constraints & Assumptions

### 9.1 Constraints
- **Budget**: Free tiers only (Vercel, Supabase, Appwrite)
- **Time**: No hard deadlines, but prefer incremental delivery
- **Team**: Solo developer (all decisions by owner)
- **Scope**: Single admin user (no multi-tenancy in MVP)

### 9.2 Assumptions
- Vercel free tier sufficient for expected traffic
- Supabase free tier (500MB DB) sufficient
- Appwrite free tier sufficient for storage needs
- No need for premium features (monitoring, analytics) in MVP
- Modern browsers only (no legacy support)
- User has technical background (no need for extensive help/onboarding)

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Free tier limitations exceeded | High | Low | Monitor usage, upgrade if needed |
| Platform vendor lock-in | Medium | Medium | Abstract external dependencies, use standard interfaces |
| Complexity creep | Medium | High | Strict MVP scope, defer features to v2+ |
| Authentication vulnerabilities | High | Low | Use established auth provider (Supabase), follow security best practices |

### 10.2 Product Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Overly complex for simple needs | Low | Medium | Keep MVP minimal, iterate based on actual usage |
| Poor project modularity | High | Medium | Design folder structure carefully, enforce boundaries |
| Difficult to add new projects | Medium | Medium | Test with 2-3 dummy projects, refine before real implementation |

---

## 11. Open Questions

1. **Design System Colors**: Need to finalize color palette - should we use a popular theme (e.g., GitHub Dark, VS Code Dark) or create custom?

2. **Project Names**: How to name dummy projects in MVP for demonstration purposes?

3. **Contact Form**: MVP has direct links only - is a contact form needed later, or external (email, LinkedIn) sufficient?

4. **Domain Name**: Should domain be purchased before or after MVP completion?

5. **Future Backend Services**: When adding dedicated services (Python/Go/Rust), should we create a separate GitHub repo or monorepo?

---

## 12. Success Metrics (Post-MVP)

While not tracked in MVP, future success can be measured by:

- **Technical Showcase**: Positive feedback from recruiters/developers
- **Personal Utility**: Active use of private tools (e.g., investment portfolio)
- **Extensibility**: Time to add new project (target: < 1 day per simple project)
- **Performance**: Consistent lighthouse scores 90+
- **Reliability**: Zero downtime incidents

---

## 13. Approval & Sign-off

**Prepared By**: Claude (AI Assistant)
**Reviewed By**: Bikesh Rana
**Approval Status**: Pending Review
**Next Steps**: Review and approve, then proceed to System Architecture Document

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-04 | Claude | Initial draft based on requirements gathering |

---

**END OF DOCUMENT**
