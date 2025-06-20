# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a personal development monorepo containing boilerplates and projects for different technologies:

```
menorepo/
├── boilerplates/
│   └── react/          # Complete React 19 + TypeScript boilerplate
└── projects/
    ├── stock-analyser/  # Python stock analysis tool with Claude integration  
    └── t212-portfolio/  # Trading212 portfolio export tool
```

## Common Development Commands

### React Boilerplate (`/boilerplates/react/`)
```bash
# Development
npm run dev                    # Start dev server (port 3000)
npm run build                  # Production build
npm run preview               # Preview production build

# Code Quality
npm run lint                  # Check code quality with Biome
npm run lint:fix             # Fix linting issues
npm run format               # Format code with Biome
npm run type-check           # TypeScript type checking

# Testing
npm run test                 # Unit tests with Vitest
npm run test:coverage        # Test coverage report
npm run test:e2e            # End-to-end tests with Playwright
npm run test:e2e:ui         # Playwright UI interface
```

### Stock Analyser (`/projects/stock-analyser/`)
```bash
./setup.sh                           # Setup virtual environment
python src/main.py                   # Run analysis workflow
python src/main.py --verbose         # Verbose logging
python src/main.py --claude-command  # Custom Claude command
```

### T212 Portfolio (`/projects/t212-portfolio/`)
```bash
pipenv install              # Install dependencies
pipenv shell               # Activate environment
python main.py             # Run portfolio export
```

## Architecture Overview

### React Boilerplate Architecture
- **Stack:** React 19.1.0 + TypeScript 5.8 + Vite 6.3 + Tailwind CSS 4.1
- **State Management:** Layered approach using Zustand + TanStack Query + Context API
- **Testing:** Vitest (unit) + React Testing Library (integration) + Playwright (E2E) + MSW (API mocking)
- **Code Quality:** Biome.js for unified linting/formatting (25x faster than Prettier)
- **Forms:** React Hook Form + Zod validation for complex forms, React 19 native forms for simple cases

### Stock Analyser Workflow
Two-phase analysis process:
1. **Individual Analysis:** Fetch stock data from SimplyWall.st API → Generate AI investment memos → Cache results
2. **Portfolio Optimization:** Aggregate analyses → Generate allocation recommendations

**Key Features:**
- AI-powered investment memo generation using Claude CLI
- YAML-based watchlist management
- Rate limiting and data caching
- Historical tracking and analysis

### Development Patterns

#### State Management Strategy (React)
- **Local state:** `useState` for component-specific data
- **Global static:** Context API for themes, auth, locale
- **Complex state:** Zustand for business logic
- **Server state:** TanStack Query for API data

#### File Organization
- **React:** Co-located tests with source files, absolute imports using `@/` alias
- **Python:** Clear separation of concerns with dedicated modules for API, analysis, and CLI

#### Testing Strategy
- **Unit Tests:** Fast feedback with Vitest
- **Integration Tests:** Component interactions with RTL
- **E2E Tests:** Full user flows with Playwright
- **API Mocking:** MSW for reliable integration testing

## Technology Stack Details

### React Boilerplate
- **React 19 Features:** Server Actions, enhanced Suspense, use API
- **TypeScript 5.8:** Strict mode with enhanced type safety
- **Vite 6:** ESNext targeting, manual chunking, vendor/UI chunk splitting
- **shadcn/ui:** Component library with built-in accessibility
- **Biome.js:** Unified toolchain for linting and formatting

### Python Projects
- **Stock Analyser:** pandas, requests, PyYAML, Claude CLI integration
- **T212 Portfolio:** pandas, requests, Trading212 API integration
- **Environment Management:** Pipenv and virtual environments

## Development Workflow

1. **For React Development:** Use the comprehensive boilerplate with modern React 19 patterns
2. **For New Projects:** Copy boilerplate structure and customize per requirements  
3. **For Financial Analysis:** Leverage stock-analyser with AI-powered insights
4. **For Portfolio Tracking:** Use T212 integration for data export and analysis

## Code Quality Standards

- **TypeScript:** Strict mode enabled with comprehensive type checking
- **Pre-commit Hooks:** Husky + lint-staged for automated quality checks
- **Performance:** Manual memoization, code splitting, concurrent React features
- **Accessibility:** shadcn/ui components with built-in a11y support