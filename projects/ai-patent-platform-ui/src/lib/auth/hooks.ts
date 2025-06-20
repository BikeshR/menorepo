import { useSession, signIn, signOut } from 'next-auth/react'
import { useAuthStore } from '@/lib/stores'
import { useEffect } from 'react'
import type { User } from '@/lib/stores/types'

// Enhanced useAuth hook that integrates NextAuth with Zustand
export const useAuth = () => {
  const { data: session, status, update } = useSession()
  const { 
    user: storeUser, 
    isAuthenticated: storeAuthenticated,
    login: storeLogin,
    logout: storeLogout,
    updateUser: storeUpdateUser,
    setLoading: setStoreLoading,
    setError: setStoreError,
    clearError: clearStoreError,
    isLoading: storeLoading,
    error: storeError,
  } = useAuthStore()

  // Sync NextAuth session with Zustand store
  useEffect(() => {
    if (status === 'loading') {
      setStoreLoading(true)
      return
    }

    setStoreLoading(false)

    if (session?.user && !storeAuthenticated) {
      const user: User = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role as any,
        permissions: session.user.permissions || [],
        avatar: session.user.image,
        firm: session.user.firmId ? {
          id: session.user.firmId,
          name: '', // Will be populated from API
          subscription: 'basic',
        } : undefined,
        preferences: {
          aiConfidenceThreshold: 0.7,
          autoSave: true,
          notifications: {
            email: true,
            inApp: true,
            deadlines: true,
            aiSuggestions: true,
          },
          theme: 'light',
          language: 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }
      
      storeLogin(user)
      clearStoreError()
    } else if (!session?.user && storeAuthenticated) {
      storeLogout()
    }
  }, [session, status, storeAuthenticated, storeLogin, storeLogout, setStoreLoading, clearStoreError])

  const login = async (email: string, password: string) => {
    try {
      setStoreLoading(true)
      clearStoreError()
      
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setStoreError(result.error)
        return { success: false, error: result.error }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      setStoreError(message)
      return { success: false, error: message }
    } finally {
      setStoreLoading(false)
    }
  }

  const loginWithProvider = async (provider: 'google' | 'github') => {
    try {
      setStoreLoading(true)
      clearStoreError()
      
      const result = await signIn(provider, {
        callbackUrl: '/',
      })

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      setStoreError(message)
      return { success: false, error: message }
    } finally {
      setStoreLoading(false)
    }
  }

  const logout = async () => {
    try {
      setStoreLoading(true)
      await signOut({ callbackUrl: '/' })
      storeLogout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setStoreLoading(false)
    }
  }

  const updateSession = async (data: Partial<User>) => {
    try {
      // Update the NextAuth session
      await update({
        role: data.role,
        firmId: data.firm?.id,
        permissions: data.permissions,
      })

      // Update the Zustand store
      storeUpdateUser(data)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed'
      setStoreError(message)
      return { success: false, error: message }
    }
  }

  const refreshSession = async () => {
    try {
      setStoreLoading(true)
      await update()
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refresh failed'
      setStoreError(message)
      return { success: false, error: message }
    } finally {
      setStoreLoading(false)
    }
  }

  return {
    // User data
    user: storeUser,
    session,
    
    // Authentication state
    isAuthenticated: storeAuthenticated && !!session,
    isLoading: status === 'loading' || storeLoading,
    error: storeError,
    
    // Authentication methods
    login,
    loginWithProvider,
    logout,
    
    // Session management
    updateSession,
    refreshSession,
    
    // Utility methods
    clearError: clearStoreError,
    
    // Permission helpers
    hasPermission: (permission: string) => 
      storeUser?.permissions?.includes(permission) ?? false,
    hasRole: (role: string) => 
      storeUser?.role === role,
    hasAnyRole: (roles: string[]) => 
      storeUser?.role ? roles.includes(storeUser.role) : false,
  }
}

// Permission-based hooks
export const usePermissions = () => {
  const { user } = useAuth()
  
  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) ?? false
  }
  
  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission))
  }
  
  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission))
  }

  return {
    permissions: user?.permissions || [],
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}

// Role-based hooks
export const useRole = () => {
  const { user } = useAuth()
  
  const hasRole = (role: string): boolean => {
    return user?.role === role
  }
  
  const hasAnyRole = (roles: string[]): boolean => {
    return user?.role ? roles.includes(user.role) : false
  }
  
  const isAttorney = () => hasRole('attorney')
  const isParalegal = () => hasRole('paralegal')
  const isCounsel = () => hasRole('counsel')
  const isAdmin = () => hasRole('admin')

  return {
    role: user?.role,
    hasRole,
    hasAnyRole,
    isAttorney,
    isParalegal,
    isCounsel,
    isAdmin,
  }
}

// Firm-based hooks
export const useFirm = () => {
  const { user } = useAuth()
  
  return {
    firm: user?.firm,
    firmId: user?.firm?.id,
    subscription: user?.firm?.subscription,
    hasFirm: !!user?.firm,
  }
}

// User preferences hook
export const useUserPreferences = () => {
  const { user, updateSession } = useAuth()
  const { updatePreferences } = useAuthStore()
  
  const updateUserPreferences = async (preferences: Partial<User['preferences']>) => {
    if (!user) return { success: false, error: 'No user logged in' }
    
    try {
      // Update local store immediately
      updatePreferences(preferences)
      
      // Update session
      await updateSession({
        preferences: {
          ...user.preferences,
          ...preferences,
        },
      })
      
      // Persist to backend
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update preferences')
      }
      
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed'
      return { success: false, error: message }
    }
  }
  
  return {
    preferences: user?.preferences,
    updatePreferences: updateUserPreferences,
  }
}