/**
 * BaseApiClient
 *
 * Abstract base class for all external API integrations.
 *
 * Benefits:
 * - Standardized HTTP request handling
 * - Automatic error handling and retries
 * - Request/response logging
 * - Rate limiting support
 * - Type-safe responses
 * - Consistent API client patterns
 *
 * Usage:
 * ```typescript
 * export class Trading212Client extends BaseApiClient {
 *   constructor() {
 *     super({
 *       baseUrl: env.TRADING212_BASE_URL!,
 *       apiKey: env.TRADING212_API_KEY!,
 *       timeout: 30000,
 *     })
 *   }
 *
 *   async getPortfolio(): Promise<Position[]> {
 *     return this.get<Position[]>('/api/v0/equity/portfolio')
 *   }
 *
 *   async createOrder(order: CreateOrderDto): Promise<Order> {
 *     return this.post<Order>('/api/v0/equity/orders', order)
 *   }
 * }
 * ```
 */

import { AppError } from '@/core/errors/app-error'
import { ErrorCode } from '@/core/errors/error-codes'
import { createLogger } from '@/core/logger/logger'

export interface BaseApiClientConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
  headers?: Record<string, string>
  retries?: number
  retryDelay?: number
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}

/**
 * Base API client for external integrations
 */
export abstract class BaseApiClient {
  protected baseUrl: string
  protected apiKey?: string
  protected timeout: number
  protected defaultHeaders: Record<string, string>
  protected retries: number
  protected retryDelay: number
  protected logger: ReturnType<typeof createLogger>

  constructor(config: BaseApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = config.apiKey
    this.timeout = config.timeout ?? 30000 // 30 seconds default
    this.defaultHeaders = config.headers ?? {}
    this.retries = config.retries ?? 3
    this.retryDelay = config.retryDelay ?? 1000 // 1 second default

    const clientName = this.constructor.name
    this.logger = createLogger({ client: clientName })
  }

  /**
   * Make an HTTP request with automatic error handling and retries
   *
   * @param method - HTTP method
   * @param endpoint - API endpoint (will be appended to baseUrl)
   * @param body - Request body (for POST, PUT, PATCH)
   * @param options - Additional request options
   * @returns Parsed response data
   */
  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const retries = options?.retries ?? this.retries
    const timeout = options?.timeout ?? this.timeout

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...options?.headers,
    }

    // Add API key if provided
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout),
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    // Attempt request with retries
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.logger.info(`${method} ${endpoint}`, {
          attempt: attempt + 1,
          maxRetries: retries + 1,
        })

        const startTime = Date.now()
        const response = await fetch(url, fetchOptions)
        const duration = Date.now() - startTime

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.retryDelay

          this.logger.warn('Rate limited, retrying after delay', {
            endpoint,
            delay,
            attempt: attempt + 1,
          })

          if (attempt < retries) {
            await this.sleep(delay)
            continue
          }

          throw AppError.rateLimit('API rate limit exceeded')
        }

        // Handle non-OK responses
        if (!response.ok) {
          const errorText = await response.text()
          let errorData: unknown

          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { message: errorText }
          }

          this.logger.error(`API request failed: ${response.status}`, {
            endpoint,
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            duration,
          })

          // Map HTTP status to AppError
          switch (response.status) {
            case 400:
              throw AppError.validation('Invalid request', errorData)
            case 401:
              throw AppError.unauthorized('API authentication failed')
            case 403:
              throw AppError.forbidden('API access denied')
            case 404:
              throw AppError.notFound(`Resource at ${endpoint}`)
            case 500:
            case 502:
            case 503:
            case 504:
              // Retry on server errors
              if (attempt < retries) {
                this.logger.warn('Server error, retrying', {
                  endpoint,
                  status: response.status,
                  attempt: attempt + 1,
                })
                await this.sleep(this.retryDelay * (attempt + 1))
                continue
              }
              throw AppError.externalApi(
                this.constructor.name,
                `Server error: ${response.status}`,
                ErrorCode.API_UNAVAILABLE,
                errorData
              )
            default:
              throw AppError.externalApi(
                this.constructor.name,
                `HTTP ${response.status}: ${response.statusText}`,
                ErrorCode.API_UNAVAILABLE,
                errorData
              )
          }
        }

        // Parse response
        const contentType = response.headers.get('content-type')
        let data: T

        if (contentType?.includes('application/json')) {
          data = await response.json()
        } else {
          // Non-JSON response (e.g., empty 204 response)
          data = (await response.text()) as T
        }

        this.logger.info(`${method} ${endpoint} completed`, {
          status: response.status,
          duration,
        })

        return data
      } catch (error) {
        lastError = error as Error

        // Don't retry on AppError (except rate limits, handled above)
        if (error instanceof AppError) {
          throw error
        }

        // Retry on network errors
        if (attempt < retries) {
          this.logger.warn('Request failed, retrying', {
            endpoint,
            error: (error as Error).message,
            attempt: attempt + 1,
          })
          await this.sleep(this.retryDelay * (attempt + 1))
        }
      }
    }

    // All retries exhausted
    this.logger.exception(lastError, `API request failed after ${retries + 1} attempts`, {
      endpoint,
    })

    throw AppError.externalApi(
      this.constructor.name,
      `Request failed after ${retries + 1} attempts`,
      ErrorCode.API_UNAVAILABLE,
      { originalError: lastError }
    )
  }

  /**
   * Make a GET request
   */
  protected async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options)
  }

  /**
   * Make a POST request
   */
  protected async post<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, body, options)
  }

  /**
   * Make a PUT request
   */
  protected async put<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, body, options)
  }

  /**
   * Make a DELETE request
   */
  protected async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options)
  }

  /**
   * Make a PATCH request
   */
  protected async patch<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', endpoint, body, options)
  }

  /**
   * Sleep for a specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
