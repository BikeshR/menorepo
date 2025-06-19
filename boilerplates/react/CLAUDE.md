# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the React boilerplate.

## Boilerplate Overview

This is a cutting-edge React boilerplate designed to showcase 2025 best practices and provide a solid foundation for production-ready applications. It demonstrates expertise in the latest React ecosystem while maintaining simplicity and developer experience.

## Technology Stack & Best Practices

### Core Framework
- **React 19** with latest features (Server Actions, use API, Actions, enhanced Suspense)
- **TypeScript 5.8** with strict mode and latest performance optimizations
- **Vite 6** with Environment API and enhanced performance

### State Management
- **useState** for component-local state
- **Context API** for simple global state (themes, auth, locale - rarely changing data)
- **Zustand** for complex global state (lightweight, performant, selective subscriptions)
- **TanStack Query v5** for server state management (caching, synchronization, Suspense support)

### Form Handling
- **React 19 native forms** for simple forms (Server Actions, built-in validation)
- **React Hook Form v7** for complex forms (dynamic fields, advanced validation, UI library integration)
- **Zod** for schema validation (shared client/server validation)

### Styling & UI
- **Tailwind CSS** with custom prefix support
- **shadcn/ui** components (latest with OKLCH colors, new components like Carousel, Drawer)
- **Lucide React** for iconography
- **CSS-in-JS** with modern approach for dynamic styling

### Development Experience
- **Biome.js** for unified linting and formatting (25x faster than Prettier, 15x faster than ESLint)
- **Husky** with lint-staged for pre-commit hooks
- **TypeScript strict mode** with path mapping (@/ imports)
- **React DevTools** with React 19 support

### Testing Strategy
- **Vitest** for unit and integration tests (2025 preferred - 4-20x faster than Jest)
- **React Testing Library** for component testing
- **MSW v2** (Mock Service Worker) for API mocking
- **Playwright** for end-to-end testing

### Build & Deployment
- **Vite 6** with modern Sass API and enhanced bundling
- **Docker** containerization with multi-stage builds
- **GitHub Actions** for CI/CD pipeline
- **Environment-based configuration** with Vite 6 Environment API

## Architecture Principles

### React 19 Component Architecture
- **Composition over inheritance** with enhanced Server Components support
- **Server/Client component separation** for optimal performance
- **Custom hooks** for reusable logic extraction
- **use API** for resource consumption (Promises, Context)
- **Manual optimization** with memo/useMemo/useCallback when needed (until React Compiler stable)

### State Management Architecture
- **Local state first** - useState for component-specific state
- **Context for app-wide concerns** - authentication, theming, locale (rarely changing)
- **Zustand for shared business logic** - user preferences, UI state, cross-component data
- **Server state separation** - TanStack Query handles all server interactions
- **Form state isolation** - Choose appropriate tool based on complexity

### File Organization
- **Feature-based structure** over technical grouping
- **Index files** for clean imports
- **Absolute imports** with @ alias
- **Co-location** of related files (tests, styles, types)
- **Server/Client component separation** in file structure

### Performance Optimization (React 19)
- **Enhanced Suspense** for better loading states
- **Concurrent features** (useTransition, useDeferredValue)
- **Manual memoization** strategies (memo, useMemo, useCallback)
- **Code splitting** with React.lazy() and modern bundling
- **Image optimization** with next-gen formats

### Developer Experience
- **TypeScript 5.8** with enhanced performance and strict typing
- **Error boundaries** for graceful error handling
- **Loading states** with enhanced Suspense
- **Accessibility** (a11y) built into shadcn/ui components
- **React DevTools** with React 19 support

### Code Quality Standards
- **Biome.js unified tooling** - single configuration for linting and formatting
- **SOLID principles** in component design
- **DRY principle** with shared utilities and hooks
- **Consistent naming conventions** (PascalCase components, camelCase functions)
- **Comprehensive JSDoc** for complex functions and hooks

## Best Practices Demonstrated

### React 19 Patterns
- **Server Actions** for form handling and data mutations
- **Actions** for client-side form processing
- **use API** for reading resources in render
- **Enhanced Suspense** boundaries for better UX
- **Manual performance optimization** with memoization hooks

### Modern TypeScript Integration
- **Generic components** with enhanced type inference
- **Discriminated unions** for variant props
- **Template literal types** for better API design
- **Strict type checking** with TypeScript 5.8 optimizations

### 2025 Performance Patterns
- **Layered state management** prevents unnecessary re-renders
- **TanStack Query v5** with Suspense integration for server state
- **Zustand selective subscriptions** minimize component updates
- **Context API for static data** avoids performance pitfalls
- **Biome.js unified tooling** for ultra-fast linting and formatting
- **Vitest** for lightning-fast test execution
- **Vite 6** Environment API for optimal build performance

### Security & Quality
- **Content Security Policy** headers
- **XSS prevention** through proper sanitization
- **HTTPS enforcement** in production
- **Dependency vulnerability scanning**
- **Modern security practices** with latest tooling

## React 19 Production Benefits
- **Server Actions** simplify form handling and data mutations
- **Enhanced Suspense** provides better loading experiences
- **use API** enables cleaner resource consumption patterns
- **Improved hydration** with fewer client-server mismatches
- **Better TypeScript integration** with latest compiler features
- **Future-ready** for React Compiler when it reaches stable release

## State Management Decision Tree

### When to Use Each Approach
1. **useState** - Component-local state that doesn't need sharing
2. **Context API** - App-wide static data (auth status, theme, locale)
3. **Zustand** - Complex shared state with frequent updates
4. **TanStack Query** - Any server-side data (API calls, caching, mutations)

### Form Handling Decision Tree
1. **React 19 Native** - Simple forms (1-5 fields, basic validation, Server Actions)
2. **React Hook Form** - Complex forms (dynamic fields, cross-field validation, UI libraries)

## Performance Benefits of This Architecture
- **Minimal re-renders** through appropriate state separation
- **Selective updates** with Zustand subscriptions
- **Server state optimization** with TanStack Query caching
- **Form performance** with uncontrolled inputs (React Hook Form)
- **Ultra-fast linting and formatting** with Biome.js (25x faster than traditional tools)
- **Bundle size efficiency** - each tool serves specific needs without overlap
- **Single toolchain overhead** - no ESLint/Prettier configuration conflicts

This boilerplate serves as both a starting point for new projects and a demonstration of cutting-edge React 19 development practices suitable for enterprise-level applications in 2025.