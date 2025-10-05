/**
 * BaseRepository
 *
 * Abstract base class for all database repositories.
 *
 * Benefits:
 * - Eliminates duplicate error handling in every query
 * - Standardized logging for all database operations
 * - Type-safe query execution
 * - Centralized Supabase client management
 * - Consistent error handling with AppError
 *
 * Usage:
 * ```typescript
 * export class StockRepository extends BaseRepository<Stock> {
 *   async getByPortfolioId(portfolioId: string): Promise<Stock[]> {
 *     return this.executeQuery(
 *       () => this.supabase
 *         .from('stocks')
 *         .select('*')
 *         .eq('portfolio_id', portfolioId),
 *       'Failed to fetch stocks'
 *     )
 *   }
 *
 *   async create(stock: Omit<Stock, 'id'>): Promise<Stock> {
 *     return this.executeMutation(
 *       () => this.supabase
 *         .from('stocks')
 *         .insert(stock)
 *         .select()
 *         .single(),
 *       'Failed to create stock'
 *     )
 *   }
 * }
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/core/errors/app-error'
import { logger } from '@/core/logger/logger'

/**
 * Supabase query response type
 */
interface SupabaseResponse<T> {
  data: T | null
  error: {
    message: string
    details?: string
    hint?: string
    code?: string
  } | null
  count?: number | null
}

/**
 * Base repository for database operations
 *
 * Provides common methods for executing queries and mutations with:
 * - Automatic error handling
 * - Structured logging
 * - Type safety
 */
export abstract class BaseRepository<_T = unknown> {
  protected supabase: SupabaseClient
  protected tableName?: string

  /**
   * @param supabase - Supabase client instance
   * @param tableName - Optional table name for logging context
   */
  constructor(supabase: SupabaseClient, tableName?: string) {
    this.supabase = supabase
    this.tableName = tableName
  }

  /**
   * Execute a SELECT query with automatic error handling
   *
   * @param queryFn - Function that returns a Supabase query
   * @param errorMessage - Error message if query fails
   * @param context - Optional context for logging
   * @returns Query result data
   * @throws AppError if query fails
   */
  protected async executeQuery<TData>(
    queryFn: () => PromiseLike<SupabaseResponse<TData>>,
    errorMessage: string,
    context?: Record<string, unknown>
  ): Promise<TData> {
    try {
      const startTime = Date.now()

      const result = await queryFn()

      const duration = Date.now() - startTime

      if (result.error) {
        logger.error(errorMessage, {
          table: this.tableName,
          error: result.error,
          duration,
          ...context,
        })

        throw AppError.database(errorMessage, {
          supabaseError: result.error,
          table: this.tableName,
          ...context,
        })
      }

      if (result.data === null) {
        logger.warn('Query returned null', {
          table: this.tableName,
          errorMessage,
          duration,
          ...context,
        })

        throw AppError.database(`${errorMessage}: No data returned`, {
          table: this.tableName,
          ...context,
        })
      }

      logger.debug('Query executed successfully', {
        table: this.tableName,
        duration,
        ...context,
      })

      return result.data
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logger.exception(error, errorMessage, {
        table: this.tableName,
        ...context,
      })

      throw AppError.database(errorMessage, {
        originalError: error,
        table: this.tableName,
        ...context,
      })
    }
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE mutation with automatic error handling
   *
   * @param queryFn - Function that returns a Supabase mutation
   * @param errorMessage - Error message if mutation fails
   * @param context - Optional context for logging
   * @returns Mutation result data
   * @throws AppError if mutation fails
   */
  protected async executeMutation<TData>(
    queryFn: () => PromiseLike<SupabaseResponse<TData>>,
    errorMessage: string,
    context?: Record<string, unknown>
  ): Promise<TData> {
    try {
      const startTime = Date.now()

      const result = await queryFn()

      const duration = Date.now() - startTime

      if (result.error) {
        logger.error(errorMessage, {
          table: this.tableName,
          error: result.error,
          duration,
          ...context,
        })

        throw AppError.database(errorMessage, {
          supabaseError: result.error,
          table: this.tableName,
          ...context,
        })
      }

      if (result.data === null) {
        logger.warn('Mutation returned null', {
          table: this.tableName,
          errorMessage,
          duration,
          ...context,
        })

        throw AppError.database(`${errorMessage}: No data returned`, {
          table: this.tableName,
          ...context,
        })
      }

      logger.info('Mutation executed successfully', {
        table: this.tableName,
        duration,
        ...context,
      })

      return result.data
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logger.exception(error, errorMessage, {
        table: this.tableName,
        ...context,
      })

      throw AppError.database(errorMessage, {
        originalError: error,
        table: this.tableName,
        ...context,
      })
    }
  }

  /**
   * Execute a DELETE mutation
   *
   * DELETE operations return { data: null, error: null } on success.
   * This method doesn't throw on null data like executeMutation does.
   *
   * @param queryFn - Function that returns a Supabase DELETE query
   * @param errorMessage - Error message if delete fails
   * @param context - Optional context for logging
   * @returns void
   * @throws AppError if delete fails
   */
  protected async executeDelete(
    queryFn: () => PromiseLike<SupabaseResponse<unknown>>,
    errorMessage: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      const startTime = Date.now()

      const result = await queryFn()

      const duration = Date.now() - startTime

      if (result.error) {
        logger.error(errorMessage, {
          table: this.tableName,
          error: result.error,
          duration,
          ...context,
        })

        throw AppError.database(errorMessage, {
          supabaseError: result.error,
          table: this.tableName,
          ...context,
        })
      }

      logger.info('Delete executed successfully', {
        table: this.tableName,
        duration,
        ...context,
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logger.exception(error, errorMessage, {
        table: this.tableName,
        ...context,
      })

      throw AppError.database(errorMessage, {
        originalError: error,
        table: this.tableName,
        ...context,
      })
    }
  }

  /**
   * Execute a bulk INSERT/UPSERT mutation without SELECT
   *
   * Bulk operations without .select() return { data: null, error: null } on success.
   * This method doesn't throw on null data for performance reasons.
   *
   * @param queryFn - Function that returns a Supabase INSERT/UPSERT query
   * @param errorMessage - Error message if operation fails
   * @param context - Optional context for logging
   * @returns void
   * @throws AppError if operation fails
   */
  protected async executeBulkMutation(
    queryFn: () => PromiseLike<SupabaseResponse<unknown>>,
    errorMessage: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      const startTime = Date.now()

      const result = await queryFn()

      const duration = Date.now() - startTime

      if (result.error) {
        logger.error(errorMessage, {
          table: this.tableName,
          error: result.error,
          duration,
          ...context,
        })

        throw AppError.database(errorMessage, {
          supabaseError: result.error,
          table: this.tableName,
          ...context,
        })
      }

      logger.info('Bulk mutation executed successfully', {
        table: this.tableName,
        duration,
        ...context,
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logger.exception(error, errorMessage, {
        table: this.tableName,
        ...context,
      })

      throw AppError.database(errorMessage, {
        originalError: error,
        table: this.tableName,
        ...context,
      })
    }
  }

  /**
   * Execute a query that may return null (e.g., finding a single optional record)
   *
   * @param queryFn - Function that returns a Supabase query
   * @param errorMessage - Error message if query fails (not when null)
   * @param context - Optional context for logging
   * @returns Query result data or null
   * @throws AppError if query fails (but not when data is null)
   */
  protected async executeOptionalQuery<TData>(
    queryFn: () => PromiseLike<SupabaseResponse<TData>>,
    errorMessage: string,
    context?: Record<string, unknown>
  ): Promise<TData | null> {
    try {
      const startTime = Date.now()

      const result = await queryFn()

      const duration = Date.now() - startTime

      if (result.error) {
        // PGRST116 means "no rows returned" for .single() queries - this is expected for optional queries
        if (result.error.code === 'PGRST116') {
          logger.debug('Optional query returned no results', {
            table: this.tableName,
            duration,
            ...context,
          })
          return null
        }

        logger.error(errorMessage, {
          table: this.tableName,
          error: result.error,
          duration,
          ...context,
        })

        throw AppError.database(errorMessage, {
          supabaseError: result.error,
          table: this.tableName,
          ...context,
        })
      }

      logger.debug('Optional query executed successfully', {
        table: this.tableName,
        duration,
        found: result.data !== null,
        ...context,
      })

      return result.data
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logger.exception(error, errorMessage, {
        table: this.tableName,
        ...context,
      })

      throw AppError.database(errorMessage, {
        originalError: error,
        table: this.tableName,
        ...context,
      })
    }
  }

  /**
   * Execute a count query
   *
   * @param queryFn - Function that returns a Supabase count query
   * @param errorMessage - Error message if query fails
   * @param context - Optional context for logging
   * @returns Count result
   * @throws AppError if query fails
   */
  protected async executeCount(
    queryFn: () => PromiseLike<SupabaseResponse<unknown>>,
    errorMessage: string,
    context?: Record<string, unknown>
  ): Promise<number> {
    try {
      const startTime = Date.now()

      const result = await queryFn()

      const duration = Date.now() - startTime

      if (result.error) {
        logger.error(errorMessage, {
          table: this.tableName,
          error: result.error,
          duration,
          ...context,
        })

        throw AppError.database(errorMessage, {
          supabaseError: result.error,
          table: this.tableName,
          ...context,
        })
      }

      // Supabase count queries return the count in the count property
      const count = result.count ?? 0

      logger.debug('Count query executed successfully', {
        table: this.tableName,
        count,
        duration,
        ...context,
      })

      return count
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logger.exception(error, errorMessage, {
        table: this.tableName,
        ...context,
      })

      throw AppError.database(errorMessage, {
        originalError: error,
        table: this.tableName,
        ...context,
      })
    }
  }
}
