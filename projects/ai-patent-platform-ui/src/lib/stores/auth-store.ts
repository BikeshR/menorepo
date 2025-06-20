import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User, UserPreferences } from './types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (user: User) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        login: (user: User) => {
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          }, false, 'auth/login')
        },

        logout: () => {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          }, false, 'auth/logout')
        },

        updateUser: (updates: Partial<User>) => {
          const { user } = get()
          if (!user) return

          set({
            user: { ...user, ...updates },
          }, false, 'auth/updateUser')
        },

        updatePreferences: (preferences: Partial<UserPreferences>) => {
          const { user } = get()
          if (!user) return

          set({
            user: {
              ...user,
              preferences: { ...user.preferences, ...preferences },
            },
          }, false, 'auth/updatePreferences')
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading }, false, 'auth/setLoading')
        },

        setError: (error: string | null) => {
          set({ error }, false, 'auth/setError')
        },

        clearError: () => {
          set({ error: null }, false, 'auth/clearError')
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
)

// Selectors for better performance
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthError = () => useAuthStore((state) => state.error)