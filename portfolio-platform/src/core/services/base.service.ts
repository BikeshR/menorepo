/**
 * BaseService
 *
 * Abstract base class for all business logic services.
 *
 * Benefits:
 * - Standardized error handling across all services
 * - Automatic logging for all operations
 * - Type-safe Result<T> return values
 * - Consistent operation execution patterns
 * - Eliminates duplicate try/catch blocks
 *
 * Usage:
 * ```typescript
 * export class SyncService extends BaseService {
 *   constructor(
 *     private readonly trading212Client: Trading212Client,
 *     private readonly stockRepository: StockRepository
 *   ) {
 *     super('SyncService')
 *   }
 *
 *   async syncPortfolio(userId: string): Promise<Result<SyncData>> {
 *     return this.executeOperation(
 *       'syncPortfolio',
 *       async () => {
 *         // Business logic here
 *         const positions = await this.trading212Client.getPortfolio()
 *         await this.stockRepository.upsertMany(positions)
 *         return { positionsSynced: positions.length }
 *       },
 *       { userId }
 *     )
 *   }
 * }
 * ```
 */

import { AppError } from '@/core/errors/app-error'
import { createLogger, type LogContext, logger } from '@/core/logger/logger'
import { Result } from '@/core/types/result.types'

/**
 * Base service for business logic operations
 *
 * Provides:
 * - Automatic error handling with Result<T>
 * - Structured logging for all operations
 * - Consistent error messages
 */
export abstract class BaseService {
  protected logger: ReturnType<typeof createLogger>

  /**
   * @param serviceName - Name of the service (for logging context)
   */
  constructor(serviceName?: string) {
    this.logger = serviceName ? createLogger({ service: serviceName }) : logger
  }

  /**
   * Execute a service operation with automatic error handling and logging
   *
   * @param operationName - Name of the operation (for logging)
   * @param fn - Operation function to execute
   * @param context - Optional context for logging
   * @returns Result<T> with success or error
   */
  protected async executeOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<Result<T>> {
    const startTime = Date.now()

    try {
      this.logger.info(`Starting ${operationName}`, context)

      const result = await fn()

      const duration = Date.now() - startTime

      this.logger.info(`${operationName} completed successfully`, {
        ...context,
        duration: `${duration}ms`,
      })

      return Result.ok(result)
    } catch (error) {
      const duration = Date.now() - startTime

      // If it's already an AppError, use it directly
      if (error instanceof AppError) {
        this.logger.error(`${operationName} failed`, {
          ...context,
          error: error.toJSON(),
          duration: `${duration}ms`,
        })

        return Result.fail(error.toJSON())
      }

      // Log the unexpected error
      this.logger.exception(error, `${operationName} failed`, {
        ...context,
        duration: `${duration}ms`,
      })

      // Wrap in AppError
      const appError = AppError.internal(`${operationName} failed`, {
        originalError: error,
        ...context,
      })

      return Result.fail(appError.toJSON())
    }
  }

  /**
   * Execute a service operation that doesn't require Result wrapper
   * Useful for internal methods that will be wrapped by public methods
   *
   * @param operationName - Name of the operation (for logging)
   * @param fn - Operation function to execute
   * @param context - Optional context for logging
   * @returns The operation result directly
   * @throws AppError if operation fails
   */
  protected async executeInternalOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now()

    try {
      this.logger.debug(`Starting internal operation: ${operationName}`, context)

      const result = await fn()

      const duration = Date.now() - startTime

      this.logger.debug(`Internal operation ${operationName} completed`, {
        ...context,
        duration: `${duration}ms`,
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      // If it's already an AppError, re-throw it
      if (error instanceof AppError) {
        this.logger.error(`Internal operation ${operationName} failed`, {
          ...context,
          error: error.toJSON(),
          duration: `${duration}ms`,
        })

        throw error
      }

      // Log the unexpected error
      this.logger.exception(error, `Internal operation ${operationName} failed`, {
        ...context,
        duration: `${duration}ms`,
      })

      // Wrap in AppError and throw
      throw AppError.internal(`${operationName} failed`, {
        originalError: error,
        ...context,
      })
    }
  }

  /**
   * Validate input and throw AppError if invalid
   *
   * @param condition - Validation condition
   * @param errorMessage - Error message if validation fails
   * @param details - Optional error details
   * @throws AppError if validation fails
   */
  protected validate(
    condition: boolean,
    errorMessage: string,
    details?: unknown
  ): asserts condition {
    if (!condition) {
      throw AppError.validation(errorMessage, details)
    }
  }

  /**
   * Assert that a value is not null/undefined
   *
   * @param value - Value to check
   * @param resourceName - Name of the resource for error message
   * @throws AppError.notFound if value is null/undefined
   */
  protected assertExists<T>(value: T | null | undefined, resourceName: string): asserts value is T {
    if (value === null || value === undefined) {
      throw AppError.notFound(resourceName)
    }
  }

  /**
   * Execute multiple operations in parallel with error handling
   *
   * @param operations - Array of operations to execute
   * @returns Result<T[]> with all results or first error
   */
  protected async executeParallel<T>(operations: Array<() => Promise<T>>): Promise<Result<T[]>> {
    try {
      const results = await Promise.all(operations.map((op) => op()))
      return Result.ok(results)
    } catch (error) {
      if (error instanceof AppError) {
        return Result.fail(error.toJSON())
      }

      const appError = AppError.internal('Parallel operation failed', {
        originalError: error,
      })

      return Result.fail(appError.toJSON())
    }
  }
}
