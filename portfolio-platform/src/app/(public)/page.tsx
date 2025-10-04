import { Github, Linkedin, LogIn, Mail } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with Login Button */}
      <header className="absolute top-0 right-0 p-6">
        <Link href="/login">
          <Button variant="outline" className="gap-2">
            <LogIn className="h-4 w-4" />
            Login
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Name and Title */}
          <div className="space-y-2">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">Bikesh Rana</h1>
            <p className="text-xl sm:text-2xl text-muted-foreground">Full-Stack Developer</p>
          </div>

          {/* Under Construction Message */}
          <div className="space-y-4 py-8">
            <div className="inline-block px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-medium text-primary">Under Construction</p>
            </div>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Building something great. Check back soon for the full portfolio experience.
            </p>
          </div>

          {/* Contact Links */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="https://github.com/BikeshR"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              <Button variant="ghost" size="icon" className="h-12 w-12">
                <Github className="h-6 w-6" />
                <span className="sr-only">GitHub</span>
              </Button>
            </Link>
            <Link
              href="https://www.linkedin.com/in/bikesh-rana"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              <Button variant="ghost" size="icon" className="h-12 w-12">
                <Linkedin className="h-6 w-6" />
                <span className="sr-only">LinkedIn</span>
              </Button>
            </Link>
            <Link href="mailto:bksh.rana@gmail.com" className="hover:text-primary transition-colors">
              <Button variant="ghost" size="icon" className="h-12 w-12">
                <Mail className="h-6 w-6" />
                <span className="sr-only">Email</span>
              </Button>
            </Link>
          </div>

          {/* Footer Note */}
          <div className="pt-8">
            <p className="text-sm text-muted-foreground">Last updated: October 2025</p>
          </div>
        </div>
      </main>
    </div>
  )
}
