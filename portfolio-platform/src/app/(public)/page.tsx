import { ArrowRight, Code2, FolderGit2, LineChart } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center space-y-8">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Portfolio Platform
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Showcase your projects and manage your portfolio in one place
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            <Link href="/projects">
              <Button size="lg" className="w-full sm:w-auto group">
                View Projects
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Get in Touch
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16 md:py-24 bg-muted/50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">What You&apos;ll Find Here</h2>
            <p className="text-muted-foreground text-lg">
              A showcase of projects and professional tools
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Code2 className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Public Projects</CardTitle>
                <CardDescription>
                  Browse through curated projects and technical demos
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <FolderGit2 className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Open Source</CardTitle>
                <CardDescription>
                  Explore open-source contributions and personal experiments
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <LineChart className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Admin Tools</CardTitle>
                <CardDescription>Private portfolio management and analytics tools</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <h3 className="text-2xl md:text-3xl font-bold">Built with Modern Technologies</h3>
          <p className="text-muted-foreground">
            Next.js 15, React 19, Tailwind CSS 4, TypeScript, Supabase
          </p>
        </div>
      </section>
    </div>
  )
}
