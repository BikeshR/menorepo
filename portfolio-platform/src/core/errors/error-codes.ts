/**
 * Standardized Error Codes
 *
 * Use these codes for consistent error handling across the application.
 * Each code maps to a specific error scenario.
 */

export enum ErrorCode {
  // ============================================
  // Authentication & Authorization
  // ============================================
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // ============================================
  // Validation Errors
  // ============================================
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // ============================================
  // External API Errors
  // ============================================
  TRADING212_ERROR = 'TRADING212_ERROR',
  KRAKEN_ERROR = 'KRAKEN_ERROR',
  ALPHA_VANTAGE_ERROR = 'ALPHA_VANTAGE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  API_TIMEOUT = 'API_TIMEOUT',
  API_UNAVAILABLE = 'API_UNAVAILABLE',

  // ============================================
  // Database Errors
  // ============================================
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // ============================================
  // Business Logic Errors
  // ============================================
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  INVALID_OPERATION = 'INVALID_OPERATION',
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',

  // ============================================
  // System Errors
  // ============================================
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

/**
 * Map error codes to HTTP status codes
 */
export const errorCodeToHttpStatus: Record<ErrorCode, number> = {
  // Auth
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,

  // Validation
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,

  // External APIs
  [ErrorCode.TRADING212_ERROR]: 502,
  [ErrorCode.KRAKEN_ERROR]: 502,
  [ErrorCode.ALPHA_VANTAGE_ERROR]: 502,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.API_TIMEOUT]: 504,
  [ErrorCode.API_UNAVAILABLE]: 503,

  // Database
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.CONSTRAINT_VIOLATION]: 409,

  // Business Logic
  [ErrorCode.INSUFFICIENT_DATA]: 422,
  [ErrorCode.CALCULATION_ERROR]: 500,
  [ErrorCode.INVALID_OPERATION]: 400,
  [ErrorCode.PRECONDITION_FAILED]: 412,

  // System
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.CONFIGURATION_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
}
