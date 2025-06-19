# React Boilerplate 2025 🚀

A cutting-edge React 19 boilerplate showcasing modern development practices and tools for building production-ready applications.

## ✨ Features

### Core Technologies
- **React 19** - Latest with Server Actions, use API, and enhanced Suspense
- **TypeScript 5.8** - Strict mode with advanced type checking
- **Vite 6** - Lightning-fast development with Environment API
- **Biome.js** - Ultra-fast linting and formatting (25x faster than Prettier)

### State Management Strategy
- **useState** - Component-local state
- **Context API** - Simple global state (themes, auth, locale)
- **Zustand** - Complex global state (lightweight, performant)
- **TanStack Query v5** - Server state management with caching

### Form Handling
- **React 19 Native Forms** - Simple forms with Server Actions
- **React Hook Form v7** - Complex forms with advanced validation
- **Zod** - Schema validation (shared client/server)

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern, accessible component library
- **CSS Variables** - Dynamic theming support
- **Responsive Design** - Mobile-first approach

### Testing Strategy
- **Vitest** - Lightning-fast unit testing (4-20x faster than Jest)
- **React Testing Library** - Component testing best practices
- **MSW v2** - API mocking for reliable tests
- **Playwright** - End-to-end testing

### Developer Experience
- **Husky + lint-staged** - Pre-commit hooks for code quality
- **Path aliases** - Clean imports with @ syntax
- **Hot Module Replacement** - Instant development feedback
- **TypeScript IntelliSense** - Enhanced developer productivity

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd react-boilerplate-2025
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development**
   ```bash
   npm run dev
   ```

4. **Open browser**
   Navigate to `http://localhost:3000`

## 📝 Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Code Quality
```bash
npm run lint         # Run Biome.js linting
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Biome.js
npm run type-check   # TypeScript type checking
```

### Testing
```bash
npm run test         # Run unit tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
npm run test:e2e     # Run E2E tests
npm run test:e2e:ui  # Run E2E tests with UI
```

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── forms/          # Form components
│   ├── examples/       # Example components
│   └── ui/             # UI components (shadcn/ui)
├── contexts/           # React contexts
├── hooks/              # Custom hooks
├── lib/                # Utility libraries
├── stores/             # Zustand stores
├── styles/             # Global styles
├── types/              # TypeScript definitions
└── main.tsx           # Application entry point

tests/
├── e2e/               # Playwright E2E tests
├── mocks/             # MSW API mocks
├── unit/              # Unit tests
└── utils/             # Test utilities
```

## 🎯 State Management Decision Tree

### When to Use Each Approach
1. **useState** - Component-local state that doesn't need sharing
2. **Context API** - App-wide static data (auth status, theme, locale)
3. **Zustand** - Complex shared state with frequent updates
4. **TanStack Query** - Any server-side data (API calls, caching, mutations)

### Form Handling Decision Tree
1. **React 19 Native** - Simple forms (1-5 fields, basic validation, Server Actions)
2. **React Hook Form** - Complex forms (dynamic fields, cross-field validation, UI libraries)

## 🧪 Testing Philosophy

### Testing Strategy
- **Unit Tests** - Individual functions and components
- **Integration Tests** - Component interactions and hooks
- **E2E Tests** - Complete user workflows
- **API Mocking** - Reliable, fast tests with MSW

### Example Test Commands
```bash
# Run specific test file
npm run test LoginForm.test.tsx

# Run tests in watch mode
npm run test -- --watch

# Run E2E tests in specific browser
npm run test:e2e -- --project=chromium
```

## 🚀 Performance Features

### Build Optimizations
- **Code Splitting** - Automatic route-based splitting
- **Tree Shaking** - Remove unused code
- **Bundle Analysis** - Optimize bundle size
- **Modern JS** - Target modern browsers

### Runtime Performance
- **React 19 Features** - Enhanced Suspense, concurrent features
- **Selective Re-renders** - Zustand selective subscriptions
- **Query Caching** - Intelligent server state caching
- **Image Optimization** - Modern formats and lazy loading

## 🔧 Configuration

### Environment Variables
```bash
# API Configuration
VITE_API_URL=https://api.example.com

# App Configuration  
VITE_APP_TITLE=My App
VITE_APP_VERSION=1.0.0
```

### TypeScript Configuration
- **Strict mode** enabled for maximum type safety
- **Path aliases** configured for clean imports
- **Utility types** for advanced type manipulation

### Biome.js Configuration
- **Unified tooling** - Single tool for linting and formatting
- **Performance** - 25x faster than traditional tools
- **Zero config** - Works out of the box with sensible defaults

## 📚 Architecture Patterns

### Component Patterns
```typescript
// Compound Components
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>Content</DialogContent>
</Dialog>

// Custom Hooks
const { data, loading, error } = usePosts();

// Server Actions (React 19)
async function createPost(formData: FormData) {
  // Server-side logic
}
```

### State Management Patterns
```typescript
// Zustand Store
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 }))
}));

// TanStack Query
const { data } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts
});
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Docker Support
```bash
docker build -t react-boilerplate .
docker run -p 3000:3000 react-boilerplate
```

## 🤝 Contributing

1. **Code Style** - Enforced by Biome.js and pre-commit hooks
2. **Testing** - All features must include tests
3. **Documentation** - Update docs for new features
4. **TypeScript** - Maintain strict type safety

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Resources

- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TanStack Query](https://tanstack.com/query/)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [Biome.js](https://biomejs.dev/)

---

**Built with ❤️ for the React community**