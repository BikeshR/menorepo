'use client'

import React from 'react'
import { useAuth, usePermissions, useRole } from './hooks'

// Higher-order component for protecting pages
export function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  requiredPermissions: string[] = []
) {
  return function AuthenticatedComponent(props: T) {
    const { isAuthenticated, isLoading, hasPermission } = useAuth()
    
    if (isLoading) {
      return <div>Loading...</div> // You can replace with a proper loading component
    }
    
    if (!isAuthenticated) {
      return null // This will be handled by middleware redirect
    }
    
    if (requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every(permission => 
        hasPermission(permission)
      )
      
      if (!hasAllPermissions) {
        return <div>Access denied. You don't have the required permissions.</div>
      }
    }
    
    return <WrappedComponent {...props} />
  }
}

// Permission checking utilities for components
export const PermissionGate: React.FC<{
  permissions?: string[]
  roles?: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}> = ({ permissions = [], roles = [], children, fallback = null }) => {
  const { hasAnyPermission } = usePermissions()
  const { hasAnyRole } = useRole()
  
  const hasRequiredPermissions = permissions.length === 0 || hasAnyPermission(permissions)
  const hasRequiredRoles = roles.length === 0 || hasAnyRole(roles)
  
  if (hasRequiredPermissions && hasRequiredRoles) {
    return <>{children}</>
  }
  
  return <>{fallback}</>
}

// Role-based component wrapper
export const RoleGate: React.FC<{
  allowedRoles: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}> = ({ allowedRoles, children, fallback = null }) => {
  const { hasAnyRole } = useRole()
  
  if (hasAnyRole(allowedRoles)) {
    return <>{children}</>
  }
  
  return <>{fallback}</>
}

// Loading component for authentication states
export const AuthLoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

// Access denied component
export const AccessDenied: React.FC<{ message?: string }> = ({ 
  message = "You don't have permission to access this resource." 
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

// Protected route wrapper
export const ProtectedRoute: React.FC<{
  children: React.ReactNode
  requiredPermissions?: string[]
  requiredRoles?: string[]
  fallback?: React.ReactNode
}> = ({ 
  children, 
  requiredPermissions = [], 
  requiredRoles = [], 
  fallback = <AccessDenied /> 
}) => {
  const { isAuthenticated, isLoading } = useAuth()
  const { hasAnyPermission } = usePermissions()
  const { hasAnyRole } = useRole()
  
  if (isLoading) {
    return <AuthLoadingSpinner />
  }
  
  if (!isAuthenticated) {
    return null // This will be handled by middleware redirect
  }
  
  const hasRequiredPermissions = requiredPermissions.length === 0 || hasAnyPermission(requiredPermissions)
  const hasRequiredRoles = requiredRoles.length === 0 || hasAnyRole(requiredRoles)
  
  if (!hasRequiredPermissions || !hasRequiredRoles) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}