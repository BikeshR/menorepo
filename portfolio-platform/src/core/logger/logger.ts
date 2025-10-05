/**
 * Structured Logger
 *
 * Replaces console.log/console.error with structured logging.
 *
 * Benefits:
 * - Structured log data (easy to search and analyze)
 * - Log levels (debug, info, warn, error)
 * - Contextual information
 * - Can integrate with logging services (Sentry, LogRocket, etc.)
 * - Better than console.error everywhere
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/core/logger/logger'
 *
 * logger.info('User logged in', { userId: '123' })
 * logger.error('Database connection failed', { error, database: 'postgres' })
 * ```
 */

import { env } from '@/core/config/env'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  environment: string
}

class Logger {
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment = env.NODE_ENV === 'development'
  }

  /**
   * Log a message with context
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      environment: env.NODE_ENV,
    }

    // In development, use colored console output
    if (this.isDevelopment) {
      this.logToConsole(entry)
    } else {
      // In production, log as JSON for log aggregation services
      this.logAsJson(entry)

      // Send to external logging service (e.g., Sentry, LogRocket)
      this.sendToExternalService(entry)
    }
  }

  /**
   * Log to console with colors (development)
   */
  private logToConsole(entry: LogEntry): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
    }
    const reset = '\x1b[0m'

    const color = colors[entry.level]
    const prefix = `${color}[${entry.level.toUpperCase()}]${reset}`
    const timestamp = `\x1b[90m${entry.timestamp}${reset}`

    console.log(`${timestamp} ${prefix} ${entry.message}`)

    if (entry.context) {
      console.log('  Context:', entry.context)
    }
  }

  /**
   * Log as JSON (production)
   */
  private logAsJson(entry: LogEntry): void {
    console.log(JSON.stringify(entry))
  }

  /**
   * Send to external logging service
   * TODO: Integrate with Sentry, LogRocket, or other services
   */
  private sendToExternalService(entry: LogEntry): void {
    // Only send errors and warnings to external services to save costs
    if (entry.level === 'error' || entry.level === 'warn') {
      // TODO: Send to Sentry
      // Sentry.captureMessage(entry.message, {
      //   level: entry.level,
      //   extra: entry.context,
      // })
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context)
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  /**
   * Log an exception with stack trace
   */
  exception(error: Error | unknown, message?: string, context?: LogContext): void {
    const errorMessage = message || 'An exception occurred'
    const errorContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    }

    this.log('error', errorMessage, errorContext)
  }

  /**
   * Create a child logger with default context
   * Useful for adding module/service name to all logs
   */
  child(defaultContext: LogContext): Logger {
    const childLogger = new Logger()
    const originalLog = childLogger.log.bind(childLogger)

    childLogger.log = (level: LogLevel, message: string, context?: LogContext) => {
      originalLog(level, message, { ...defaultContext, ...context })
    }

    return childLogger
  }
}

/**
 * Global logger instance
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/core/logger/logger'
 *
 * logger.info('Operation completed')
 * logger.error('Operation failed', { error, userId: '123' })
 * ```
 */
export const logger = new Logger()

/**
 * Create module-specific logger with default context
 *
 * Usage:
 * ```typescript
 * const moduleLogger = createLogger({ module: 'portfolio' })
 * moduleLogger.info('Syncing portfolio') // Automatically includes module: 'portfolio'
 * ```
 */
export function createLogger(defaultContext: LogContext): Logger {
  return logger.child(defaultContext)
}
