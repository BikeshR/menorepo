/**
 * Authentication Middleware for Server Actions
 *
 * Provides reusable auth wrappers to eliminate duplicate auth checks.
 *
 * Usage:
 * ```typescript
 * export const myAction = withAuth(async () => {
 *   // No need to check auth here - it's already done!
 *   return Result.ok({ data: 'success' })
 * })
 * ```
 */

import { AppError } from '@/core/errors/app-error'
import { Result } from '@/core/types/result.types'
import { isAuthenticated } from '@/lib/auth/session'

/**
 * Wraps a server action with authentication check
 *
 * If user is not authenticated, returns an error Result.
 * If user is authenticated, executes the function.
 *
 * @example
 * export const syncPortfolio = withAuth(async () => {
 *   // User is guaranteed to be authenticated here
 *   const data = await portfolioService.sync()
 *   return Result.ok(data)
 * })
 */
export function withAuth<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<Result<TReturn>>
) {
  return async (...args: TArgs): Promise<Result<TReturn>> => {
    // Check if user is authenticated
    const authenticated = await isAuthenticated()

    if (!authenticated) {
      // Return standardized error
      return Result.fail({
        code: 'UNAUTHORIZED',
        message: 'User is not authenticated',
        userMessage: 'You must be logged in to perform this action',
      })
    }

    // User is authenticated - proceed with function
    return fn(...args)
  }
}

/**
 * Wraps a server action with authentication check (non-Result version)
 *
 * For functions that return data directly without Result wrapper.
 * Throws AppError if not authenticated.
 *
 * @example
 * export const getPortfolio = requireAuth(async () => {
 *   return await portfolioRepo.getAll()
 * })
 */
export function requireAuth<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    const authenticated = await isAuthenticated()

    if (!authenticated) {
      throw AppError.unauthorized()
    }

    return fn(...args)
  }
}

/**
 * Higher-order function for role-based access control (future enhancement)
 *
 * Currently, this is a single-user app, so role checking is not needed.
 * This is a placeholder for future multi-user scenarios.
 *
 * @example
 * export const adminAction = withRole('admin', async () => {
 *   return Result.ok({ data: 'admin only' })
 * })
 */
export function withRole<TArgs extends unknown[], TReturn>(
  _role: string,
  fn: (...args: TArgs) => Promise<Result<TReturn>>
) {
  return withAuth(async (...args: TArgs) => {
    // TODO: Implement role checking when multi-user support is added
    // For now, all authenticated users have all permissions (single-user app)
    return fn(...args)
  })
}

/**
 * Utility to check authentication status
 * Re-export for convenience
 */
export { isAuthenticated }
