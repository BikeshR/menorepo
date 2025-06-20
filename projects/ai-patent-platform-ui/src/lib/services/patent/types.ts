// Patent service types and interfaces
export interface PatentAPI {
  // CRUD operations
  getPatents(params: GetPutantsParams): Promise<PaginatedResponse<Patent>>
  getPatent(id: string): Promise<Patent>
  createPatent(data: CreatePatentRequest): Promise<Patent>
  updatePatent(id: string, data: UpdatePatentRequest): Promise<Patent>
  deletePatent(id: string): Promise<void>
  
  // Claims operations
  getPatentClaims(patentId: string): Promise<PatentClaim[]>
  updatePatentClaims(patentId: string, claims: PatentClaim[]): Promise<PatentClaim[]>
  addPatentClaim(patentId: string, claim: Omit<PatentClaim, 'id'>): Promise<PatentClaim>
  updatePatentClaim(patentId: string, claimId: string, data: Partial<PatentClaim>): Promise<PatentClaim>
  deletePatentClaim(patentId: string, claimId: string): Promise<void>
  
  // Prosecution operations
  getProsecutionHistory(patentId: string): Promise<ProsecutionEvent[]>
  addProsecutionEvent(patentId: string, event: Omit<ProsecutionEvent, 'id'>): Promise<ProsecutionEvent>
  
  // Search and discovery
  searchPatents(query: SearchQuery): Promise<SearchResponse<Patent>>
  getPatentsByInventor(inventorId: string): Promise<Patent[]>
  getPatentsByAssignee(assignee: string): Promise<Patent[]>
  getRelatedPatents(patentId: string): Promise<Patent[]>
  
  // Analytics
  getPatentAnalytics(params: AnalyticsParams): Promise<PatentAnalytics>
  getFilingTrends(params: TrendParams): Promise<FilingTrends>
  getPortfolioMetrics(assignee?: string): Promise<PortfolioMetrics>
  
  // Bulk operations
  bulkUpdatePatents(updates: BulkUpdateRequest[]): Promise<BulkUpdateResponse>
  bulkDeletePatents(patentIds: string[]): Promise<BulkDeleteResponse>
  exportPatents(params: ExportParams): Promise<ExportResponse>
}

// Core types (re-exported from stores for consistency)
export type { 
  Patent, 
  PatentClaim, 
  PatentDrawing, 
  PatentCitation, 
  ProsecutionEvent 
} from '@/lib/stores/types'

// Request types
export interface GetPutantsParams {
  page?: number
  limit?: number
  status?: PatentStatus[]
  dateFrom?: Date
  dateTo?: Date
  inventors?: string[]
  assignee?: string[]
  classifications?: string[]
  search?: string
  sortBy?: PatentSortField
  sortOrder?: 'asc' | 'desc'
}

export interface CreatePatentRequest {
  title: string
  inventors: Array<{
    name: string
    email?: string
  }>
  assignee?: string
  abstract: string
  description: string
  claims?: Omit<PatentClaim, 'id' | 'lastModified'>[]
  drawings?: Omit<PatentDrawing, 'id'>[]
  classifications?: string[]
  priorityClaims?: Array<{
    applicationNumber: string
    filingDate: Date
    country: string
  }>
}

export interface UpdatePatentRequest {
  title?: string
  inventors?: Array<{
    id?: string
    name: string
    email?: string
  }>
  assignee?: string
  abstract?: string
  description?: string
  status?: PatentStatus
  classifications?: string[]
}

export interface SearchQuery {
  q: string
  fields?: PatentSearchField[]
  filters?: SearchFilters
  fuzzy?: boolean
  proximity?: number
  boost?: Record<string, number>
  highlight?: boolean
  facets?: string[]
  page?: number
  limit?: number
}

export interface SearchFilters {
  status?: PatentStatus[]
  dateRange?: {
    field: 'filingDate' | 'publicationDate' | 'grantDate'
    from?: Date
    to?: Date
  }
  inventors?: string[]
  assignee?: string[]
  classifications?: {
    ipc?: string[]
    cpc?: string[]
    uspc?: string[]
  }
  jurisdiction?: string[]
  hasDrawings?: boolean
  aiGenerated?: boolean
}

export interface BulkUpdateRequest {
  patentId: string
  updates: UpdatePatentRequest
}

export interface ExportParams {
  patentIds?: string[]
  format: 'csv' | 'xlsx' | 'json' | 'xml' | 'pdf'
  fields?: string[]
  includeDrawings?: boolean
  includeClaims?: boolean
  includeProsecutionHistory?: boolean
}

// Response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
  facets?: Record<string, Array<{ value: string; count: number }>>
}

export interface SearchResponse<T> extends PaginatedResponse<T> {
  query: SearchQuery
  executionTime: number
  suggestions?: string[]
  highlights?: Record<string, string[]>
}

export interface BulkUpdateResponse {
  successful: string[]
  failed: Array<{
    patentId: string
    error: string
  }>
  totalProcessed: number
}

export interface BulkDeleteResponse {
  deleted: string[]
  failed: Array<{
    patentId: string
    error: string
  }>
  totalProcessed: number
}

export interface ExportResponse {
  downloadUrl: string
  filename: string
  expiresAt: Date
  fileSize: number
  recordCount: number
}

// Analytics types
export interface PatentAnalytics {
  totalPatents: number
  statusDistribution: Record<PatentStatus, number>
  filingTrends: Array<{
    period: string
    count: number
    status: PatentStatus
  }>
  topInventors: Array<{
    name: string
    patentCount: number
    successRate: number
  }>
  topAssignees: Array<{
    name: string
    patentCount: number
    marketValue: number
  }>
  classificationDistribution: Array<{
    classification: string
    count: number
    percentage: number
  }>
  averageProcessingTime: {
    filing: number
    examination: number
    grant: number
  }
  aiMetrics: {
    aiGeneratedContent: number
    aiAssistedFiling: number
    confidenceScores: {
      average: number
      distribution: Record<string, number>
    }
  }
}

export interface FilingTrends {
  period: 'monthly' | 'quarterly' | 'yearly'
  data: Array<{
    date: Date
    filings: number
    grants: number
    rejections: number
    abandonments: number
    pendingApplications: number
  }>
  predictions?: Array<{
    date: Date
    predictedFilings: number
    confidence: number
  }>
}

export interface PortfolioMetrics {
  totalValue: number
  portfolioStrength: number
  geographicCoverage: Array<{
    country: string
    patentCount: number
    marketValue: number
  }>
  technologyAreas: Array<{
    area: string
    patentCount: number
    strength: number
    competitivePosition: 'leading' | 'competitive' | 'lagging'
  }>
  expirationSchedule: Array<{
    year: number
    expiringPatents: number
    maintenanceFees: number
  }>
  risks: Array<{
    type: 'expiration' | 'invalidation' | 'non_payment'
    severity: 'high' | 'medium' | 'low'
    affectedPatents: string[]
    description: string
    mitigation: string
  }>
}

export interface AnalyticsParams {
  assignee?: string
  dateFrom?: Date
  dateTo?: Date
  groupBy?: 'status' | 'inventor' | 'classification' | 'month' | 'year'
  includeAI?: boolean
}

export interface TrendParams {
  period: 'monthly' | 'quarterly' | 'yearly'
  dateFrom?: Date
  dateTo?: Date
  assignee?: string
  includePredictions?: boolean
  predictionMonths?: number
}

// Enum types
export type PatentStatus = 'draft' | 'pending' | 'granted' | 'rejected' | 'abandoned'

export type PatentSortField = 
  | 'title'
  | 'filingDate'
  | 'publicationDate'
  | 'grantDate'
  | 'status'
  | 'inventor'
  | 'assignee'
  | 'classification'
  | 'relevance'

export type PatentSearchField = 
  | 'title'
  | 'abstract'
  | 'description'
  | 'claims'
  | 'inventor'
  | 'assignee'
  | 'classification'
  | 'all'

// Error types
export class PatentServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'PatentServiceError'
  }
}

export class PatentNotFoundError extends PatentServiceError {
  constructor(patentId: string) {
    super(`Patent not found: ${patentId}`, 'PATENT_NOT_FOUND', 404)
    this.name = 'PatentNotFoundError'
  }
}

export class PatentValidationError extends PatentServiceError {
  constructor(message: string, public validationErrors: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400, { validationErrors })
    this.name = 'PatentValidationError'
  }
}

export class PatentPermissionError extends PatentServiceError {
  constructor(action: string, patentId?: string) {
    super(
      `Permission denied for ${action}${patentId ? ` on patent ${patentId}` : ''}`,
      'PERMISSION_DENIED',
      403
    )
    this.name = 'PatentPermissionError'
  }
}