'use client'

import React from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { queryClient } from '@/lib/query'
import { DefaultAIService, DefaultPatentService } from '@/lib/services'
import { useAuth } from '@/lib/auth'

// Services Provider - Initialize services when user authenticates
const ServicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth()

  React.useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize AI service with user's API keys
      if (!DefaultAIService.isInitialized()) {
        try {
          DefaultAIService.initialize({
            provider: 'openai',
            apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
            model: 'gpt-4-turbo-preview',
          })
        } catch (error) {
          console.error('Failed to initialize AI service:', error)
        }
      }

      // Initialize Patent service
      if (!DefaultPatentService.isInitialized()) {
        try {
          DefaultPatentService.initialize({
            baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
            apiKey: process.env.NEXT_PUBLIC_API_KEY || '',
          })
        } catch (error) {
          console.error('Failed to initialize Patent service:', error)
        }
      }
    }
  }, [isAuthenticated, user])

  return <>{children}</>
}

// Online/Offline Status Provider
const OnlineStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial status
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  React.useEffect(() => {
    // Update UI store with online status
    const { useUIStore } = require('@/lib/stores')
    useUIStore.getState().setOnlineStatus(isOnline)
  }, [isOnline])

  return <>{children}</>
}

// Keyboard Shortcuts Provider
const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { useUIStore } = require('@/lib/stores')
  const { commandPaletteOpen, setCommandPaletteOpen, keyboardShortcutsEnabled } = useUIStore()

  React.useEffect(() => {
    if (!keyboardShortcutsEnabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Command palette: Cmd+K or Ctrl+K
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
        return
      }

      // Other global shortcuts can be added here
      // For example:
      // - Cmd+N for new patent
      // - Cmd+S for save
      // - Cmd+F for search
      // - Esc for cancel/close modals
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen, keyboardShortcutsEnabled])

  return <>{children}</>
}

// Error Boundary for React Query
class QueryErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Query Error Boundary caught an error:', error, errorInfo)
    
    // Log to your error reporting service
    // logErrorToService(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">
              There was an error loading the application. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Performance Monitor (only in development)
const PerformanceMonitor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Monitor performance metrics
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            console.log(`${entry.name}: ${entry.duration}ms`)
          }
        }
      })

      observer.observe({ entryTypes: ['measure'] })

      return () => observer.disconnect()
    }
  }, [])

  return <>{children}</>
}

// Main Providers Component
export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              <ServicesProvider>
                <OnlineStatusProvider>
                  <KeyboardShortcutsProvider>
                    <PerformanceMonitor>
                      {children}
                      <Toaster />
                      {process.env.NODE_ENV === 'development' && (
                        <ReactQueryDevtools 
                          initialIsOpen={false} 
                          buttonPosition="bottom-left"
                        />
                      )}
                    </PerformanceMonitor>
                  </KeyboardShortcutsProvider>
                </OnlineStatusProvider>
              </ServicesProvider>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    </QueryErrorBoundary>
  )
}