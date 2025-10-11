'use client'

/**
 * QueryProvider Component
 *
 * Wraps the app with React Query's QueryClientProvider
 * Provides client-side data fetching and caching
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

type QueryProviderProps = {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prevent refetching on window focus for blockchain data
            refetchOnWindowFocus: false,
            // Retry failed requests
            retry: 2,
            // Cache blockchain data for 5 minutes
            staleTime: 1000 * 60 * 5,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
