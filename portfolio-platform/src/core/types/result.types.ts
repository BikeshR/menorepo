/**
 * Result Type Pattern
 *
 * Standardized return type for operations that can succeed or fail.
 * Inspired by Rust's Result<T, E> and functional programming patterns.
 *
 * Benefits:
 * - Type-safe error handling
 * - No throwing exceptions in business logic
 * - Explicit success/failure states
 * - Easy to test and reason about
 */

export type Result<T> = SuccessResult<T> | ErrorResult

export type SuccessResult<T> = {
  success: true
  data: T
}

export type ErrorResult = {
  success: false
  error: {
    code: string
    message: string
    userMessage: string
    details?: unknown
  }
}

/**
 * Helper functions to create Result types
 */
export const Result = {
  /**
   * Create a successful result
   *
   * @example
   * return Result.ok({ userId: '123', name: 'John' })
   */
  ok: <T>(data: T): SuccessResult<T> => ({
    success: true,
    data,
  }),

  /**
   * Create a failed result
   *
   * @example
   * return Result.fail({
   *   code: 'NOT_FOUND',
   *   message: 'User not found in database',
   *   userMessage: 'The requested user could not be found',
   * })
   */
  fail: (error: {
    code: string
    message: string
    userMessage: string
    details?: unknown
  }): ErrorResult => ({
    success: false,
    error,
  }),
}

/**
 * Type guard to check if result is successful
 *
 * @example
 * const result = await someOperation()
 * if (isSuccess(result)) {
 *   console.log(result.data) // TypeScript knows this is SuccessResult
 * }
 */
export function isSuccess<T>(result: Result<T>): result is SuccessResult<T> {
  return result.success === true
}

/**
 * Type guard to check if result is an error
 *
 * @example
 * const result = await someOperation()
 * if (isError(result)) {
 *   console.error(result.error.message)
 * }
 */
export function isError<T>(result: Result<T>): result is ErrorResult {
  return result.success === false
}

/**
 * Unwrap a successful result or throw an error
 * Use with caution - prefer pattern matching with isSuccess/isError
 *
 * @example
 * const data = unwrap(result) // Throws if result is an error
 */
export function unwrap<T>(result: Result<T>): T {
  if (isSuccess(result)) {
    return result.data
  }
  throw new Error(result.error.message)
}

/**
 * Unwrap a result or return a default value
 *
 * @example
 * const data = unwrapOr(result, { userId: 'guest' })
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data
  }
  return defaultValue
}
