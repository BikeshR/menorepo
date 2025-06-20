import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { useUIStore } from '@/lib/stores'

// Global error handler for queries
const handleQueryError = (error: unknown) => {
  console.error('Query error:', error)
  
  // Add notification for user-facing errors
  if (error instanceof Error && error.message !== 'Network Error') {
    useUIStore.getState().addNotification({
      type: 'error',
      title: 'Request Failed',
      message: error.message,
    })
  }
}

// Global success handler for mutations
const handleMutationSuccess = (data: unknown, variables: unknown, context: unknown, mutation: any) => {
  // Invalidate related queries based on mutation meta
  if (mutation.meta?.invalidates) {
    const queryKeys = Array.isArray(mutation.meta.invalidates) 
      ? mutation.meta.invalidates 
      : [mutation.meta.invalidates]
    
    queryKeys.forEach((key: string) => {
      queryClient.invalidateQueries({ queryKey: [key] })
    })
  }

  // Show success notification if configured
  if (mutation.meta?.successMessage) {
    useUIStore.getState().addNotification({
      type: 'success',
      title: 'Success',
      message: mutation.meta.successMessage,
    })
  }
}

// Global error handler for mutations
const handleMutationError = (error: unknown, variables: unknown, context: unknown, mutation: any) => {
  console.error('Mutation error:', error)
  
  if (error instanceof Error) {
    useUIStore.getState().addNotification({
      type: 'error',
      title: 'Operation Failed',
      message: mutation.meta?.errorMessage || error.message,
    })
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleQueryError,
  }),
  mutationCache: new MutationCache({
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  }),
  defaultOptions: {
    queries: {
      // Stale time - how long data is considered fresh
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Cache time - how long inactive data stays in cache
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
      
      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes('4')) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus for critical data
      refetchOnWindowFocus: (query) => {
        // Only refetch patent and user data on window focus
        const criticalKeys = ['patents', 'user', 'notifications']
        return criticalKeys.some(key => 
          Array.isArray(query.queryKey) && query.queryKey.includes(key)
        )
      },
      
      // Network mode
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations only once
      retry: 1,
      
      // Network mode for mutations
      networkMode: 'online',
    },
  },
})

// Query key factories for consistent cache management
export const queryKeys = {
  // User queries
  user: () => ['user'] as const,
  userProfile: (userId: string) => ['user', 'profile', userId] as const,
  userPreferences: () => ['user', 'preferences'] as const,
  
  // Patent queries
  patents: () => ['patents'] as const,
  patentsList: (filters?: Record<string, unknown>) => ['patents', 'list', filters] as const,
  patent: (id: string) => ['patents', 'detail', id] as const,
  patentClaims: (id: string) => ['patents', 'claims', id] as const,
  patentProsecution: (id: string) => ['patents', 'prosecution', id] as const,
  
  // Search queries
  search: () => ['search'] as const,
  priorArtSearch: (query: string, filters?: Record<string, unknown>) => 
    ['search', 'prior-art', query, filters] as const,
  patentSearch: (query: string, filters?: Record<string, unknown>) => 
    ['search', 'patents', query, filters] as const,
  
  // AI queries
  ai: () => ['ai'] as const,
  aiOperations: () => ['ai', 'operations'] as const,
  aiOperation: (id: string) => ['ai', 'operations', id] as const,
  aiSuggestions: (contextId: string) => ['ai', 'suggestions', contextId] as const,
  
  // Analytics queries
  analytics: () => ['analytics'] as const,
  portfolioAnalytics: (timeRange?: string) => ['analytics', 'portfolio', timeRange] as const,
  filingTrends: (timeRange?: string) => ['analytics', 'filing-trends', timeRange] as const,
  
  // Notifications
  notifications: () => ['notifications'] as const,
  notificationsList: (unreadOnly?: boolean) => ['notifications', 'list', unreadOnly] as const,
} as const

// Prefetch utilities for common data
export const prefetchUserData = async (userId: string) => {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.userProfile(userId),
      queryFn: () => fetch(`/api/users/${userId}`).then(res => res.json()),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.userPreferences(),
      queryFn: () => fetch('/api/user/preferences').then(res => res.json()),
    }),
  ])
}

export const prefetchPatentData = async () => {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.patentsList(),
    queryFn: () => fetch('/api/patents').then(res => res.json()),
  })
}

// Cache invalidation utilities
export const invalidatePatentData = () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.patents() })
}

export const invalidateUserData = () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.user() })
}

export const invalidateAIData = () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.ai() })
}