// Core AI service types
export interface AIServiceConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  retryAttempts?: number
}

export interface StreamingConfig {
  enabled: boolean
  chunkSize?: number
  onProgress?: (progress: number) => void
  onChunk?: (chunk: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export interface AIModelCapabilities {
  supportsStreaming: boolean
  maxContextLength: number
  supportedOperations: AIOperationType[]
  confidenceScoring: boolean
  reasoningExplanation: boolean
  multiModalSupport: boolean
}

export type AIOperationType = 
  | 'patent_claims_generation'
  | 'prior_art_search'
  | 'invention_analysis'
  | 'patent_drafting'
  | 'claim_analysis'
  | 'novelty_assessment'
  | 'freedom_to_operate'
  | 'patent_landscape'

// Request/Response types for different AI operations
export interface PatentClaimsGenerationRequest {
  inventionDescription: string
  technicalField?: string
  backgroundArt?: string[]
  inventionSummary?: string
  detailedDescription?: string
  drawings?: Array<{
    figureNumber: string
    description: string
    elements: string[]
  }>
  existingClaims?: string[]
  claimCount?: number
  claimType?: 'independent' | 'dependent' | 'both'
  jurisdiction?: string
  language?: string
  style?: 'broad' | 'narrow' | 'balanced'
  context?: {
    patentId?: string
    priorArt?: Array<{
      id: string
      title: string
      relevance: number
    }>
    competitorPatents?: string[]
  }
}

export interface PatentClaimsGenerationResponse {
  claims: Array<{
    number: number
    type: 'independent' | 'dependent'
    dependsOn?: number[]
    text: string
    scope: 'broad' | 'medium' | 'narrow'
    noveltyAssessment: {
      score: number
      reasoning: string[]
      potentialIssues: string[]
    }
    enforceabilityScore: number
  }>
  alternativeClaims: Array<{
    claim: string
    rationale: string
    confidence: number
  }>
  confidence: number
  reasoning: string[]
  recommendations: string[]
  metadata: {
    processingTime: number
    tokensUsed: number
    model: string
  }
}

export interface PriorArtSearchRequest {
  query: string
  inventionDescription?: string
  keywords?: string[]
  classifications?: {
    ipc?: string[]
    cpc?: string[]
    uspc?: string[]
  }
  dateRange?: {
    from?: Date
    to?: Date
  }
  jurisdictions?: string[]
  documentTypes?: ('patent' | 'application' | 'literature')[]
  excludePatents?: string[]
  maxResults?: number
  semanticSearch?: boolean
  language?: string
}

export interface PriorArtSearchResponse {
  results: Array<{
    id: string
    type: 'patent' | 'application' | 'literature'
    title: string
    abstract: string
    inventors?: string[]
    assignee?: string
    publicationDate: Date
    filingDate?: Date
    patentNumber?: string
    applicationNumber?: string
    classifications: string[]
    relevanceScore: number
    similarityAnalysis: {
      overlapAreas: string[]
      keyDifferences: string[]
      noveltyImpact: 'high' | 'medium' | 'low'
    }
    citations: Array<{
      patentNumber: string
      relevance: number
    }>
    url?: string
  }>
  searchMetadata: {
    totalResults: number
    searchTime: number
    queryExpansions: string[]
    relevanceThreshold: number
  }
  noveltyAssessment: {
    overallNoveltyScore: number
    criticalPriorArt: string[]
    recommendations: string[]
  }
  confidence: number
  reasoning: string[]
}

export interface InventionAnalysisRequest {
  title: string
  description: string
  technicalField?: string
  problemStatement?: string
  solution?: string
  advantages?: string[]
  drawings?: Array<{
    id: string
    description: string
    url?: string
  }>
  context?: {
    industry: string
    targetMarkets: string[]
    competitorAnalysis?: Array<{
      name: string
      products: string[]
      patents: string[]
    }>
  }
  analysisType?: ('patentability' | 'freedom_to_operate' | 'landscape' | 'comprehensive')[]
}

export interface InventionAnalysisResponse {
  patentabilityAssessment: {
    score: number
    noveltyScore: number
    nonObviousnessScore: number
    utilityScore: number
    reasoning: string[]
    recommendations: string[]
    potentialClaims: string[]
  }
  freedomToOperateAnalysis?: {
    riskLevel: 'low' | 'medium' | 'high'
    blockingPatents: Array<{
      patentNumber: string
      title: string
      riskScore: number
      expirationDate: Date
      workaroundPossibility: 'easy' | 'difficult' | 'impossible'
    }>
    recommendations: string[]
  }
  patentLandscape?: {
    competitorActivity: Array<{
      assignee: string
      patentCount: number
      recentActivity: boolean
      keyPatents: string[]
    }>
    technologyTrends: string[]
    whitespaceOpportunities: string[]
  }
  confidence: number
  reasoning: string[]
  nextSteps: string[]
}

export interface PatentDraftingRequest {
  invention: {
    title: string
    field: string
    background: string
    summary: string
    detailedDescription: string
    claims: string[]
    drawings?: Array<{
      figureNumber: string
      description: string
      detailedDescription: string
    }>
  }
  inventors: Array<{
    name: string
    address: string
    citizenship?: string
  }>
  assignee?: {
    name: string
    address: string
    type: 'individual' | 'corporation' | 'government'
  }
  filingDetails: {
    jurisdiction: string
    language: string
    priorityClaims?: Array<{
      applicationNumber: string
      filingDate: Date
      country: string
    }>
    relatedApplications?: Array<{
      type: 'continuation' | 'divisional' | 'cip'
      applicationNumber: string
    }>
  }
  draftingOptions: {
    style: 'formal' | 'detailed' | 'concise'
    includeAlternatives: boolean
    emphasizeCommercialAspects: boolean
    includeDefensiveElements: boolean
  }
}

export interface PatentDraftingResponse {
  sections: {
    title: string
    field: string
    background: string
    briefSummary: string
    briefDescriptionOfDrawings: string
    detailedDescription: string
    claims: string
    abstract: string
  }
  formattedDocument: string
  alternativeSections?: {
    [sectionName: string]: string[]
  }
  qualityMetrics: {
    clarityScore: number
    completenessScore: number
    consistencyScore: number
    complianceScore: number
  }
  suggestions: Array<{
    section: string
    suggestion: string
    importance: 'high' | 'medium' | 'low'
  }>
  confidence: number
  reasoning: string[]
  reviewChecklist: string[]
}

// Streaming response types
export interface AIStreamChunk {
  id: string
  type: 'content' | 'metadata' | 'progress' | 'error' | 'complete'
  content?: string
  metadata?: Record<string, unknown>
  progress?: number
  error?: string
  timestamp: number
}

export interface AIStreamingResponse {
  operationId: string
  onChunk: (chunk: AIStreamChunk) => void
  onComplete: (finalResponse: any) => void
  onError: (error: Error) => void
  cancel: () => void
}

// Error types
export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

export class AIRateLimitError extends AIServiceError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429)
    this.name = 'AIRateLimitError'
  }
}

export class AIQuotaExceededError extends AIServiceError {
  constructor(message: string) {
    super(message, 'QUOTA_EXCEEDED', 402)
    this.name = 'AIQuotaExceededError'
  }
}

export class AIModelUnavailableError extends AIServiceError {
  constructor(message: string, public modelName: string) {
    super(message, 'MODEL_UNAVAILABLE', 503)
    this.name = 'AIModelUnavailableError'
  }
}