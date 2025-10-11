'use client'

import { Github, Linkedin, LogIn, Mail } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Chat } from '@/components/chat/Chat'
import { ThemeColorPicker } from '@/components/theme/ThemeColorPicker'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const [hasMessages, setHasMessages] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with backdrop blur - visible on all screen sizes */}
      <header className="absolute top-0 right-0 p-4 sm:p-6 z-10">
        <div className="flex items-center gap-2 backdrop-blur-md bg-background/80 rounded-lg px-3 py-2 border border-border/50">
          <ThemeColorPicker />
          <Link href="/login">
            <Button variant="outline" className="gap-2">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content - Chat Interface */}
      <main className={`flex-1 flex flex-col ${hasMessages ? 'pb-16 sm:pb-0' : ''}`}>
        <Chat onMessagesChange={setHasMessages} />
      </main>

      {/* Mobile Bottom Toolbar - Only shown when chat has messages */}
      {hasMessages && (
        <div className="fixed bottom-0 left-0 right-0 sm:hidden border-t bg-background/95 backdrop-blur-md p-3 z-20 shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <ThemeColorPicker />
            <Link href="/login">
              <Button variant="outline" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </Button>
            </Link>
          </div>
        </div>
      )}

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
