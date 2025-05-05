# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands
- Build: `npm run build` (from project directories)
- Lint: `npm run lint` (includes ESLint and Prettier checks)
- Test: `npm test` (runs Jest tests)
- Single test: `npm test -- -t "test name"` (runs specific test)

## Code Style Guidelines
- **TypeScript**: Strict typing with interfaces for all data structures
- **Formatting**: 2-space indentation, 80-char line length
- **Imports**: Group imports (React, third-party, local) with blank lines
- **Error handling**: Use try/catch with custom error classes
- **Components**: Functional components with hooks (no class components)
- **State**: Redux for global state, React Query for API state
- **Testing**: Jest + React Testing Library, aim for 80%+ coverage
- **Documentation**: JSDoc comments for exported functions/components

## Architecture Standards
- Follow domain-driven design principles
- Implement clean architecture layers (UI, domain, data)
- Use container/presentation component pattern
- Prefer small, focused components with single responsibilities
- Avoid prop drilling with context or state management