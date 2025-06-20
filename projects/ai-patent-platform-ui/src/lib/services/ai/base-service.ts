import { 
  AIServiceConfig, 
  StreamingConfig, 
  AIStreamChunk, 
  AIStreamingResponse,
  AIServiceError,
  AIRateLimitError,
  AIQuotaExceededError,
  AIModelUnavailableError
} from './types'

export abstract class BaseAIService {
  protected config: AIServiceConfig
  protected abortController?: AbortController

  constructor(config: AIServiceConfig) {
    this.config = {
      temperature: 0.3,
      maxTokens: 4000,
      timeout: 30000,
      retryAttempts: 3,
      ...config,
    }
  }

  // Abstract methods to be implemented by specific AI providers
  abstract makeRequest<T>(
    endpoint: string,
    data: Record<string, unknown>,
    options?: {
      streaming?: boolean
      timeout?: number
    }
  ): Promise<T>

  abstract createStreamingRequest<T>(
    endpoint: string,
    data: Record<string, unknown>,
    streamingConfig: StreamingConfig
  ): Promise<AIStreamingResponse>

  // Common utility methods
  protected async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      await this.handleErrorResponse(response)
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    }

    throw new AIServiceError(
      'Invalid response format',
      'INVALID_RESPONSE_FORMAT',
      response.status
    )
  }

  protected async handleErrorResponse(response: Response): Promise<never> {
    const contentType = response.headers.get('content-type')
    let errorData: any = {}

    try {
      if (contentType?.includes('application/json')) {
        errorData = await response.json()
      } else {
        errorData = { message: await response.text() }
      }
    } catch {
      errorData = { message: 'Unknown error occurred' }
    }

    const message = errorData.message || errorData.error?.message || 'AI service error'

    switch (response.status) {
      case 429:
        const retryAfter = response.headers.get('retry-after')
        throw new AIRateLimitError(
          message,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        )
      case 402:
        throw new AIQuotaExceededError(message)
      case 503:
        throw new AIModelUnavailableError(message, this.config.model)
      default:
        throw new AIServiceError(
          message,
          errorData.code || 'UNKNOWN_ERROR',
          response.status,
          errorData
        )
    }
  }

  protected async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxAttempts: number = this.config.retryAttempts || 3
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await requestFn()
      } catch (error) {
        lastError = error as Error

        // Don't retry client errors (4xx) except rate limits
        if (error instanceof AIServiceError && 
            error.statusCode && 
            error.statusCode >= 400 && 
            error.statusCode < 500 && 
            !(error instanceof AIRateLimitError)) {
          throw error
        }

        // Handle rate limiting with exponential backoff
        if (error instanceof AIRateLimitError) {
          const delay = error.retryAfter 
            ? error.retryAfter * 1000 
            : Math.min(1000 * Math.pow(2, attempt - 1), 30000)
          
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }

        // Exponential backoff for other errors
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }

  protected createAbortController(): AbortController {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()
    return this.abortController
  }

  protected async createStreamingResponse<T>(
    response: Response,
    streamingConfig: StreamingConfig,
    operationId: string
  ): Promise<AIStreamingResponse> {
    const abortController = this.createAbortController()
    
    return {
      operationId,
      onChunk: streamingConfig.onChunk || (() => {}),
      onComplete: streamingConfig.onComplete || (() => {}),
      onError: streamingConfig.onError || (() => {}),
      cancel: () => {
        abortController.abort()
      },
    }
  }

  protected async processStreamingResponse(
    response: Response,
    streamingConfig: StreamingConfig,
    operationId: string
  ): Promise<void> {
    if (!response.body) {
      throw new AIServiceError('No response body for streaming', 'NO_STREAM_BODY')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let chunkCount = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          streamingConfig.onComplete?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = this.parseStreamChunk(line, operationId, chunkCount++)
              if (chunk) {
                streamingConfig.onChunk?.(chunk)
                
                if (chunk.type === 'progress' && chunk.progress !== undefined) {
                  streamingConfig.onProgress?.(chunk.progress)
                }
                
                if (chunk.type === 'error') {
                  throw new AIServiceError(
                    chunk.error || 'Streaming error',
                    'STREAM_ERROR'
                  )
                }
              }
            } catch (error) {
              console.warn('Failed to parse stream chunk:', line, error)
            }
          }
        }
      }
    } catch (error) {
      streamingConfig.onError?.(error as Error)
      throw error
    } finally {
      reader.releaseLock()
    }
  }

  protected parseStreamChunk(
    line: string, 
    operationId: string, 
    chunkIndex: number
  ): AIStreamChunk | null {
    // Handle Server-Sent Events format
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      
      if (data === '[DONE]') {
        return {
          id: `${operationId}-${chunkIndex}`,
          type: 'complete',
          timestamp: Date.now(),
        }
      }

      try {
        const parsed = JSON.parse(data)
        return {
          id: `${operationId}-${chunkIndex}`,
          type: 'content',
          content: parsed.content || parsed.text || parsed.delta?.content,
          metadata: parsed.metadata,
          progress: parsed.progress,
          timestamp: Date.now(),
        }
      } catch {
        // Fallback for plain text chunks
        return {
          id: `${operationId}-${chunkIndex}`,
          type: 'content',
          content: data,
          timestamp: Date.now(),
        }
      }
    }

    return null
  }

  protected buildHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': 'SolveIntelligence-UI/1.0',
      ...additionalHeaders,
    }
  }

  protected buildRequestBody(data: Record<string, unknown>): string {
    return JSON.stringify({
      model: this.config.model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      ...data,
    })
  }

  // Public utility methods
  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  public updateConfig(updates: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  public getConfig(): AIServiceConfig {
    return { ...this.config }
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      // Implement a simple health check endpoint call
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(5000),
      })
      
      return response.ok
    } catch {
      return false
    }
  }
}