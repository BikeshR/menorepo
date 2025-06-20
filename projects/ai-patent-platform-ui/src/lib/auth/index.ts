// Export all auth-related functionality
export * from './config'
export * from './hooks'
export * from './middleware'
export * from './components'

// Re-export commonly used items
export { useAuth, usePermissions, useRole, useFirm, useUserPreferences } from './hooks'
export { authMiddleware } from './middleware'
export { withAuth, PermissionGate, RoleGate, ProtectedRoute } from './components'