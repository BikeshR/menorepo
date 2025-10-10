import { Github, Linkedin, LogIn, Mail } from 'lucide-react'
import Link from 'next/link'
import { Chat } from '@/components/chat/Chat'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with Login Button */}
      <header className="absolute top-0 right-0 p-4 sm:p-6 z-10">
        <Link href="/login">
          <Button variant="outline" className="gap-2">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Login</span>
          </Button>
        </Link>
      </header>

      {/* Main Content - Chat Interface */}
      <main className="flex-1 flex flex-col">
        <Chat />
      </main>

      {/* Footer */}
      <footer className="border-t py-4 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">&copy; 2025 Bikesh Rana. All rights reserved.</p>

          <div className="flex items-center gap-4">
            {/* Social Icons */}
            <div className="flex items-center gap-2">
              <Link
                href="https://github.com/BikeshR"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="GitHub"
              >
                <Github className="h-4 w-4" />
              </Link>
              <Link
                href="https://www.linkedin.com/in/bikesh-rana"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </Link>
              <Link
                href="mailto:bksh.rana@gmail.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Email"
              >
                <Mail className="h-4 w-4" />
              </Link>
            </div>

            {/* Separator */}
            <span className="text-muted-foreground/30">|</span>

            {/* Traditional Portfolio - Under Construction */}
            <span className="text-muted-foreground text-xs">
              Traditional portfolio under construction
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
