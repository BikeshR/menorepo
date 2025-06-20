// Export all stores and their hooks
export * from './auth-store'
export * from './ai-store'
export * from './ui-store'
export * from './types'

// Store hydration utilities
export const hydrateStores = () => {
  // This function can be called on app initialization
  // to ensure all stores are properly hydrated from persistence
  
  // For now, stores handle their own hydration via persist middleware
  // but this could be extended for complex cross-store hydration logic
}

// Store reset utilities for testing
export const resetAllStores = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth-storage')
    window.location.reload()
  }
}