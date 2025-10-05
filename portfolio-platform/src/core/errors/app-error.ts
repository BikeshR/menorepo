/**
 * Application Error Class
 *
 * Standardized error class with error codes, user-friendly messages,
 * and proper error categorization.
 *
 * Use this instead of throwing generic Error objects.
 */

import { ErrorCode, errorCodeToHttpStatus } from './error-codes'

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly userMessage: string
  public readonly details?: unknown
  public readonly statusCode: number

  constructor(
    code: ErrorCode,
    message: string,
    userMessage?: string,
    details?: unknown,
    statusCode?: number
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.userMessage = userMessage || message
    this.details = details
    this.statusCode = statusCode || errorCodeToHttpStatus[code] || 500

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  /**
   * Convert to plain object for logging or API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      details: this.details,
      statusCode: this.statusCode,
      stack: this.stack,
    }
  }

  // ============================================
  // Factory Methods for Common Errors
  // ============================================

  /**
   * User is not authenticated
   */
  static unauthorized(message = 'Not authenticated', details?: unknown): AppError {
    return new AppError(
      ErrorCode.UNAUTHORIZED,
      message,
      'You must be logged in to perform this action',
      details,
      401
    )
  }

  /**
   * User is authenticated but doesn't have permission
   */
  static forbidden(message = 'Forbidden', details?: unknown): AppError {
    return new AppError(
      ErrorCode.FORBIDDEN,
      message,
      'You do not have permission to perform this action',
      details,
      403
    )
  }

  /**
   * Resource not found
   */
  static notFound(resource: string, details?: unknown): AppError {
    return new AppError(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      `The requested ${resource.toLowerCase()} could not be found`,
      details,
      404
    )
  }

  /**
   * Validation error
   */
  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 'Invalid input provided', details, 400)
  }

  /**
   * Database error
   */
  static database(message: string, details?: unknown): AppError {
    return new AppError(
      ErrorCode.DATABASE_ERROR,
      message,
      'A database error occurred. Please try again.',
      details,
      500
    )
  }

  /**
   * Rate limit exceeded
   */
  static rateLimit(message: string, details?: unknown): AppError {
    return new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      'Rate limit exceeded. Please try again later.',
      details,
      429
    )
  }

  /**
   * External API error
   */
  static externalApi(
    service: string,
    message: string,
    code: ErrorCode,
    details?: unknown
  ): AppError {
    return new AppError(
      code,
      message,
      `Failed to connect to ${service}. Please try again later.`,
      details,
      502
    )
  }

  /**
   * Internal server error
   */
  static internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      message,
      'An unexpected error occurred. Please try again.',
      details,
      500
    )
  }

  /**
   * Resource already exists (conflict)
   */
  static conflict(resource: string, details?: unknown): AppError {
    return new AppError(
      ErrorCode.ALREADY_EXISTS,
      `${resource} already exists`,
      `This ${resource.toLowerCase()} already exists`,
      details,
      409
    )
  }

  /**
   * Insufficient data for operation
   */
  static insufficientData(message: string, details?: unknown): AppError {
    return new AppError(
      ErrorCode.INSUFFICIENT_DATA,
      message,
      'Insufficient data to perform this operation',
      details,
      422
    )
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
