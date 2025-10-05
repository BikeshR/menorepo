import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { AppError } from '@/core/errors/app-error'
import { Result } from '@/core/types/result.types'
import { requireAuth, withAuth } from '../middleware'

// Mock the isAuthenticated function
vi.mock('@/lib/auth/session', () => ({
  isAuthenticated: vi.fn(),
}))

import { isAuthenticated } from '@/lib/auth/session'

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('withAuth', () => {
    it('should execute function when authenticated', async () => {
      // Mock authenticated user
      ;(isAuthenticated as Mock).mockResolvedValue(true)

      const mockFn = vi.fn(async () => Result.ok({ data: 'success' }))
      const wrappedFn = withAuth(mockFn)

      const result = await wrappedFn()

      expect(isAuthenticated).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ data: 'success' })
      }
    })

    it('should return error when not authenticated', async () => {
      // Mock unauthenticated user
      ;(isAuthenticated as Mock).mockResolvedValue(false)

      const mockFn = vi.fn(async () => Result.ok({ data: 'success' }))
      const wrappedFn = withAuth(mockFn)

      const result = await wrappedFn()

      expect(isAuthenticated).toHaveBeenCalledTimes(1)
      expect(mockFn).not.toHaveBeenCalled() // Should not execute function
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED')
        expect(result.error.userMessage).toBe('You must be logged in to perform this action')
      }
    })

    it('should pass arguments to wrapped function', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(true)

      const mockFn = vi.fn(async (id: string, name: string) => Result.ok({ id, name }))
      const wrappedFn = withAuth(mockFn)

      const result = await wrappedFn('123', 'John')

      expect(mockFn).toHaveBeenCalledWith('123', 'John')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ id: '123', name: 'John' })
      }
    })

    it('should preserve error results from wrapped function', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(true)

      const mockFn = vi.fn(async () =>
        Result.fail({
          code: 'NOT_FOUND',
          message: 'User not found',
          userMessage: 'User not found',
        })
      )
      const wrappedFn = withAuth(mockFn)

      const result = await wrappedFn()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('requireAuth', () => {
    it('should execute function when authenticated', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(true)

      const mockFn = vi.fn(async () => ({ data: 'success' }))
      const wrappedFn = requireAuth(mockFn)

      const result = await wrappedFn()

      expect(isAuthenticated).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ data: 'success' })
    })

    it('should throw when not authenticated', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(false)

      const mockFn = vi.fn(async () => ({ data: 'success' }))
      const wrappedFn = requireAuth(mockFn)

      await expect(wrappedFn()).rejects.toThrow(AppError)

      expect(isAuthenticated).toHaveBeenCalledTimes(1)
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should throw AppError with correct code', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(false)

      const mockFn = vi.fn(async () => ({ data: 'success' }))
      const wrappedFn = requireAuth(mockFn)

      try {
        await wrappedFn()
      } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        if (error instanceof AppError) {
          expect(error.code).toBe('UNAUTHORIZED')
        }
      }
    })

    it('should pass arguments to wrapped function', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(true)

      const mockFn = vi.fn(async (id: string) => ({ id }))
      const wrappedFn = requireAuth(mockFn)

      const result = await wrappedFn('123')

      expect(mockFn).toHaveBeenCalledWith('123')
      expect(result).toEqual({ id: '123' })
    })
  })

  describe('Real-world usage patterns', () => {
    it('should work with server actions returning Result', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(true)

      // Simulating a server action
      const syncPortfolio = withAuth(async () => {
        // Simulate API call
        const positions = await Promise.resolve([{ ticker: 'AAPL', quantity: 10 }])

        return Result.ok({
          positionsSynced: positions.length,
          totalValue: 1000,
        })
      })

      const result = await syncPortfolio()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.positionsSynced).toBe(1)
        expect(result.data.totalValue).toBe(1000)
      }
    })

    it('should work with data fetching functions', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(true)

      const getPortfolio = requireAuth(async () => {
        return {
          id: '123',
          name: 'Main Portfolio',
          totalValue: 10000,
        }
      })

      const portfolio = await getPortfolio()

      expect(portfolio.id).toBe('123')
      expect(portfolio.totalValue).toBe(10000)
    })

    it('should handle auth failure gracefully in UI', async () => {
      ;(isAuthenticated as Mock).mockResolvedValue(false)

      const fetchData = withAuth(async () => Result.ok({ data: [] }))

      const result = await fetchData()

      // UI can check result.success and show login prompt
      if (!result.success) {
        expect(result.error.userMessage).toBe('You must be logged in to perform this action')
        // In real UI: redirect to login or show error message
      }
    })
  })
})
