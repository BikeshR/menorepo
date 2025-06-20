import type {
  PatentAPI,
  Patent,
  PatentClaim,
  ProsecutionEvent,
  GetPutantsParams,
  CreatePatentRequest,
  UpdatePatentRequest,
  SearchQuery,
  SearchResponse,
  PaginatedResponse,
  PatentAnalytics,
  FilingTrends,
  PortfolioMetrics,
  AnalyticsParams,
  TrendParams,
  BulkUpdateRequest,
  BulkUpdateResponse,
  BulkDeleteResponse,
  ExportParams,
  ExportResponse,
  PatentServiceError,
  PatentNotFoundError,
  PatentValidationError,
  PatentPermissionError,
} from './types'

export class PatentService implements PatentAPI {
  private baseURL: string
  private apiKey: string
  private defaultHeaders: Record<string, string>

  constructor(config: { baseURL: string; apiKey: string }) {
    this.baseURL = config.baseURL.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = config.apiKey
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Version': '2024-01',
      'User-Agent': 'SolveIntelligence-UI/1.0',
    }
  }

  // Private utility methods
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      await this.handleErrorResponse(response)
    }

    // Handle empty responses (e.g., DELETE operations)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    }

    throw new PatentServiceError(
      'Invalid response format',
      'INVALID_RESPONSE_FORMAT',
      response.status
    )
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any = {}

    try {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        errorData = await response.json()
      } else {
        errorData = { message: await response.text() }
      }
    } catch {
      errorData = { message: 'Unknown error occurred' }
    }

    const message = errorData.message || errorData.error?.message || 'Patent service error'

    switch (response.status) {
      case 400:
        if (errorData.validationErrors) {
          throw new PatentValidationError(message, errorData.validationErrors)
        }
        throw new PatentServiceError(message, 'BAD_REQUEST', 400, errorData)
      case 401:
        throw new PatentServiceError('Authentication failed', 'UNAUTHORIZED', 401)
      case 403:
        throw new PatentPermissionError(errorData.action || 'access resource', errorData.patentId)
      case 404:
        if (errorData.patentId) {
          throw new PatentNotFoundError(errorData.patentId)
        }
        throw new PatentServiceError(message, 'NOT_FOUND', 404)
      case 409:
        throw new PatentServiceError(message, 'CONFLICT', 409, errorData)
      case 422:
        throw new PatentValidationError(message, errorData.validationErrors || {})
      case 429:
        throw new PatentServiceError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          429,
          { retryAfter: response.headers.get('retry-after') }
        )
      case 500:
        throw new PatentServiceError('Internal server error', 'INTERNAL_ERROR', 500)
      case 503:
        throw new PatentServiceError('Service unavailable', 'SERVICE_UNAVAILABLE', 503)
      default:
        throw new PatentServiceError(message, 'UNKNOWN_ERROR', response.status, errorData)
    }
  }

  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)))
        } else if (value instanceof Date) {
          searchParams.append(key, value.toISOString())
        } else {
          searchParams.append(key, String(value))
        }
      }
    })

    return searchParams.toString()
  }

  // CRUD operations
  async getPatents(params: GetPutantsParams = {}): Promise<PaginatedResponse<Patent>> {
    const queryString = this.buildQueryString(params)
    const endpoint = `/patents${queryString ? `?${queryString}` : ''}`
    
    return this.makeRequest<PaginatedResponse<Patent>>(endpoint, {
      method: 'GET',
    })
  }

  async getPatent(id: string): Promise<Patent> {
    return this.makeRequest<Patent>(`/patents/${id}`, {
      method: 'GET',
    })
  }

  async createPatent(data: CreatePatentRequest): Promise<Patent> {
    return this.makeRequest<Patent>('/patents', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePatent(id: string, data: UpdatePatentRequest): Promise<Patent> {
    return this.makeRequest<Patent>(`/patents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deletePatent(id: string): Promise<void> {
    await this.makeRequest<void>(`/patents/${id}`, {
      method: 'DELETE',
    })
  }

  // Claims operations
  async getPatentClaims(patentId: string): Promise<PatentClaim[]> {
    return this.makeRequest<PatentClaim[]>(`/patents/${patentId}/claims`, {
      method: 'GET',
    })
  }

  async updatePatentClaims(patentId: string, claims: PatentClaim[]): Promise<PatentClaim[]> {
    return this.makeRequest<PatentClaim[]>(`/patents/${patentId}/claims`, {
      method: 'PUT',
      body: JSON.stringify({ claims }),
    })
  }

  async addPatentClaim(patentId: string, claim: Omit<PatentClaim, 'id'>): Promise<PatentClaim> {
    return this.makeRequest<PatentClaim>(`/patents/${patentId}/claims`, {
      method: 'POST',
      body: JSON.stringify(claim),
    })
  }

  async updatePatentClaim(
    patentId: string, 
    claimId: string, 
    data: Partial<PatentClaim>
  ): Promise<PatentClaim> {
    return this.makeRequest<PatentClaim>(`/patents/${patentId}/claims/${claimId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deletePatentClaim(patentId: string, claimId: string): Promise<void> {
    await this.makeRequest<void>(`/patents/${patentId}/claims/${claimId}`, {
      method: 'DELETE',
    })
  }

  // Prosecution operations
  async getProsecutionHistory(patentId: string): Promise<ProsecutionEvent[]> {
    return this.makeRequest<ProsecutionEvent[]>(`/patents/${patentId}/prosecution`, {
      method: 'GET',
    })
  }

  async addProsecutionEvent(
    patentId: string, 
    event: Omit<ProsecutionEvent, 'id'>
  ): Promise<ProsecutionEvent> {
    return this.makeRequest<ProsecutionEvent>(`/patents/${patentId}/prosecution`, {
      method: 'POST',
      body: JSON.stringify(event),
    })
  }

  // Search and discovery
  async searchPatents(query: SearchQuery): Promise<SearchResponse<Patent>> {
    return this.makeRequest<SearchResponse<Patent>>('/patents/search', {
      method: 'POST',
      body: JSON.stringify(query),
    })
  }

  async getPatentsByInventor(inventorId: string): Promise<Patent[]> {
    const params = { inventors: [inventorId] }
    const response = await this.getPatents(params)
    return response.data
  }

  async getPatentsByAssignee(assignee: string): Promise<Patent[]> {
    const params = { assignee: [assignee] }
    const response = await this.getPatents(params)
    return response.data
  }

  async getRelatedPatents(patentId: string): Promise<Patent[]> {
    return this.makeRequest<Patent[]>(`/patents/${patentId}/related`, {
      method: 'GET',
    })
  }

  // Analytics
  async getPatentAnalytics(params: AnalyticsParams = {}): Promise<PatentAnalytics> {
    const queryString = this.buildQueryString(params)
    const endpoint = `/analytics/patents${queryString ? `?${queryString}` : ''}`
    
    return this.makeRequest<PatentAnalytics>(endpoint, {
      method: 'GET',
    })
  }

  async getFilingTrends(params: TrendParams): Promise<FilingTrends> {
    const queryString = this.buildQueryString(params)
    const endpoint = `/analytics/trends${queryString ? `?${queryString}` : ''}`
    
    return this.makeRequest<FilingTrends>(endpoint, {
      method: 'GET',
    })
  }

  async getPortfolioMetrics(assignee?: string): Promise<PortfolioMetrics> {
    const params = assignee ? { assignee } : {}
    const queryString = this.buildQueryString(params)
    const endpoint = `/analytics/portfolio${queryString ? `?${queryString}` : ''}`
    
    return this.makeRequest<PortfolioMetrics>(endpoint, {
      method: 'GET',
    })
  }

  // Bulk operations
  async bulkUpdatePatents(updates: BulkUpdateRequest[]): Promise<BulkUpdateResponse> {
    return this.makeRequest<BulkUpdateResponse>('/patents/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    })
  }

  async bulkDeletePatents(patentIds: string[]): Promise<BulkDeleteResponse> {
    return this.makeRequest<BulkDeleteResponse>('/patents/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ patentIds }),
    })
  }

  async exportPatents(params: ExportParams): Promise<ExportResponse> {
    return this.makeRequest<ExportResponse>('/patents/export', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Utility methods
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest<{ status: string }>('/health', {
        method: 'GET',
      })
      return true
    } catch {
      return false
    }
  }

  updateConfig(config: Partial<{ baseURL: string; apiKey: string }>): void {
    if (config.baseURL) {
      this.baseURL = config.baseURL.replace(/\/$/, '')
    }
    if (config.apiKey) {
      this.apiKey = config.apiKey
      this.defaultHeaders.Authorization = `Bearer ${config.apiKey}`
    }
  }

  getConfig(): { baseURL: string; apiKey: string } {
    return {
      baseURL: this.baseURL,
      apiKey: this.apiKey,
    }
  }
}

// Default service instance management
export class DefaultPatentService {
  private static instance: PatentService | null = null
  private static config: { baseURL: string; apiKey: string } | null = null

  static initialize(config: { baseURL: string; apiKey: string }): void {
    this.config = config
    this.instance = new PatentService(config)
  }

  static get(): PatentService {
    if (!this.instance) {
      throw new Error('Default patent service not initialized. Call DefaultPatentService.initialize() first.')
    }
    return this.instance
  }

  static getConfig(): { baseURL: string; apiKey: string } | null {
    return this.config
  }

  static isInitialized(): boolean {
    return this.instance !== null
  }

  static reset(): void {
    this.instance = null
    this.config = null
  }
}

// Environment-based configuration helper
export const createPatentServiceFromEnv = (): PatentService => {
  const baseURL = process.env.PATENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL
  const apiKey = process.env.PATENT_API_KEY || process.env.API_KEY

  if (!baseURL) {
    throw new Error('Patent API base URL not found. Set PATENT_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL environment variable.')
  }

  if (!apiKey) {
    throw new Error('Patent API key not found. Set PATENT_API_KEY or API_KEY environment variable.')
  }

  return new PatentService({ baseURL, apiKey })
}