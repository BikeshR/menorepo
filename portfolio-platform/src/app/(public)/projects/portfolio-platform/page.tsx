import { ArrowLeft, ExternalLink, Github } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = {
  title: 'Portfolio Platform Project',
  description: 'A full-stack portfolio platform with public and private sections',
}

export default function PortfolioPlatformProjectPage() {
  return (
    <div className="container py-12 md:py-16 max-w-4xl">
      {/* Back Button */}
      <Link
        href="/projects"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Projects
      </Link>

      {/* Project Header */}
      <div className="space-y-4 mb-12">
        <h1 className="text-4xl md:text-5xl font-bold">Portfolio Platform</h1>
        <p className="text-xl text-muted-foreground">
          A modern full-stack portfolio platform showcasing both public projects and private admin
          tools
        </p>

        {/* Links */}
        <div className="flex flex-wrap gap-3 pt-4">
          <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <Github className="h-4 w-4 mr-2" />
              View Code
            </Button>
          </Link>
          <Link href="/" target="_blank" rel="noopener noreferrer">
            <Button>
              <ExternalLink className="h-4 w-4 mr-2" />
              Live Demo
            </Button>
          </Link>
        </div>
      </div>

      {/* Tech Stack */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Tech Stack</h2>
        <div className="flex flex-wrap gap-2">
          {[
            'Next.js 15',
            'React 19',
            'TypeScript',
            'Tailwind CSS 4',
            'Supabase',
            'PostgreSQL',
            'Vercel',
          ].map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Public Portfolio</CardTitle>
              <CardDescription>Showcase your work to the world</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Responsive project showcase</li>
                <li>• About page with skills and experience</li>
                <li>• Contact information</li>
                <li>• SEO optimized</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Private Admin Area</CardTitle>
              <CardDescription>Manage your portfolio and tools</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Secure authentication with Supabase</li>
                <li>• Profile management</li>
                <li>• Investment portfolio tracker</li>
                <li>• Admin dashboard</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modern Architecture</CardTitle>
              <CardDescription>Built with latest technologies</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• React Server Components</li>
                <li>• Server Actions for mutations</li>
                <li>• Row Level Security (RLS)</li>
                <li>• Optimistic updates with React Query</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Developer Experience</CardTitle>
              <CardDescription>Optimized for development</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• TypeScript for type safety</li>
                <li>• Biome.js for linting and formatting</li>
                <li>• Modular component architecture</li>
                <li>• Comprehensive documentation</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Project Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Project Overview</h2>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            This portfolio platform represents a modern approach to personal portfolio management,
            combining a public-facing showcase with private administrative tools. Built with the
            latest web technologies, it demonstrates best practices in full-stack development,
            authentication, and database design.
          </p>
          <p className="text-muted-foreground mt-4">
            The architecture prioritizes modularity and scalability, allowing for easy addition of
            new projects and features. Each component is built with reusability in mind, following
            React best practices and utilizing TypeScript for type safety throughout the
            application.
          </p>
        </div>
      </section>

      {/* Technical Highlights */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Technical Highlights</h2>
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-3 text-muted-foreground">
              <li>
                <strong className="text-foreground">Server-Side Rendering:</strong> Leverages
                Next.js 15 App Router for optimal performance and SEO
              </li>
              <li>
                <strong className="text-foreground">Authentication:</strong> Secure user
                authentication powered by Supabase Auth with JWT tokens
              </li>
              <li>
                <strong className="text-foreground">Database:</strong> PostgreSQL with Row Level
                Security (RLS) for data isolation
              </li>
              <li>
                <strong className="text-foreground">Styling:</strong> Tailwind CSS 4 with OKLCH
                color space for consistent theming
              </li>
              <li>
                <strong className="text-foreground">State Management:</strong> React Query for
                server state, Zustand for client state
              </li>
              <li>
                <strong className="text-foreground">Form Handling:</strong> React Hook Form with Zod
                validation for type-safe forms
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
