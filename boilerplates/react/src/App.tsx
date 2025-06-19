import { Code, Database, Github, Monitor, Moon, Sun, TestTube, Zap } from "lucide-react";
import { useState } from "react";
import { PostsList } from "@/components/examples/PostsList";
import { LoginForm } from "@/components/forms/LoginForm";
import { UserProfileForm } from "@/components/forms/UserProfileForm";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/userStore";

type Tab = "overview" | "forms" | "state" | "data";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { theme, setTheme } = useTheme();
  const user = useUserStore((state) => state.user);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Zap },
    { id: "forms" as const, label: "Forms", icon: Code },
    { id: "state" as const, label: "State", icon: Database },
    { id: "data" as const, label: "Data", icon: TestTube },
  ];

  const ThemeIcon = theme === "dark" ? Sun : theme === "light" ? Moon : Monitor;

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">React Boilerplate 2025</h1>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Cutting-edge
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              title={`Current theme: ${theme}`}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex h-12 items-center space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex h-12 items-center space-x-2 border-b-2 px-1 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Welcome to React Boilerplate 2025
              </h2>
              <p className="mt-2 text-lg text-muted-foreground">
                A cutting-edge React 19 boilerplate showcasing modern development practices and
                tools.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border bg-card p-6 text-card-foreground">
                <h3 className="font-semibold">⚡ Performance First</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Built with Vite 6, Biome.js (25x faster), and React 19 for optimal performance.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6 text-card-foreground">
                <h3 className="font-semibold">🔧 Modern Tooling</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  TypeScript 5.8, Tailwind CSS, shadcn/ui, and comprehensive testing setup.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6 text-card-foreground">
                <h3 className="font-semibold">📱 Production Ready</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pre-configured with state management, forms, testing, and deployment setup.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-6">
              <h3 className="text-lg font-semibold">Technology Stack</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium">Core</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• React 19 with Server Actions</li>
                    <li>• TypeScript 5.8 with strict mode</li>
                    <li>• Vite 6 with Environment API</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium">State & Forms</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Zustand for global state</li>
                    <li>• TanStack Query v5 for server state</li>
                    <li>• React Hook Form + Zod validation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium">Development</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Biome.js for linting & formatting</li>
                    <li>• Husky + lint-staged pre-commit</li>
                    <li>• Path aliases with @ imports</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium">Testing</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Vitest + React Testing Library</li>
                    <li>• MSW v2 for API mocking</li>
                    <li>• Playwright for E2E testing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "forms" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold">Form Examples</h2>
              <p className="text-muted-foreground">
                Demonstrating both React 19 native forms and React Hook Form with validation.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">React 19 Native Form</h3>
                <LoginForm />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">React Hook Form + Zod</h3>
                <div className="rounded-lg border p-6">
                  <UserProfileForm />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "state" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold">State Management</h2>
              <p className="text-muted-foreground">
                Examples of local state, Context API, and Zustand store usage.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border p-6">
                <h3 className="font-semibold mb-4">Theme Context (Context API)</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Current theme: {theme}</p>
                  <button
                    type="button"
                    onClick={cycleTheme}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Cycle Theme
                  </button>
                </div>
              </div>

              <div className="rounded-lg border p-6">
                <h3 className="font-semibold mb-4">User Store (Zustand)</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    User: {user ? user.name : "Not logged in"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This demonstrates Zustand state management with persistence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold">Data Fetching</h2>
              <p className="text-muted-foreground">
                TanStack Query v5 examples with caching, mutations, and error handling.
              </p>
            </div>

            <PostsList />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
