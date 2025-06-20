export interface User {
  id: string
  name: string
  email: string
  role: 'attorney' | 'paralegal' | 'counsel' | 'admin'
  permissions: string[]
  preferences: UserPreferences
  avatar?: string
  firm?: {
    id: string
    name: string
    subscription: 'basic' | 'pro' | 'enterprise'
  }
}

export interface UserPreferences {
  aiConfidenceThreshold: number
  autoSave: boolean
  notifications: {
    email: boolean
    inApp: boolean
    deadlines: boolean
    aiSuggestions: boolean
  }
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
}

export interface AIOperation {
  id: string
  type: 'patent_claims' | 'prior_art_search' | 'invention_analysis' | 'patent_draft'
  status: 'idle' | 'processing' | 'streaming' | 'completed' | 'failed'
  progress: number
  input: Record<string, unknown>
  output?: AIResponse
  error?: string
  startedAt: Date
  completedAt?: Date
  estimatedDuration?: number
}

export interface AIResponse {
  data: string | object
  confidence: number
  reasoning: string[]
  alternatives: Array<{
    data: string | object
    confidence: number
    reasoning: string[]
  }>
  humanReviewRequired: boolean
  sources: Array<{
    id: string
    title: string
    url?: string
    relevance: number
  }>
  metadata: Record<string, unknown>
}

export interface Patent {
  id: string
  title: string
  status: 'draft' | 'pending' | 'granted' | 'rejected' | 'abandoned'
  filingDate: Date
  publicationDate?: Date
  grantDate?: Date
  inventors: Array<{
    id: string
    name: string
    email?: string
  }>
  assignee: string
  abstract: string
  claims: PatentClaim[]
  description: string
  drawings: PatentDrawing[]
  classifications: string[]
  citations: PatentCitation[]
  prosecutionHistory: ProsecutionEvent[]
  aiGeneratedContent: Array<{
    section: string
    content: string
    confidence: number
    humanReviewed: boolean
  }>
}

export interface PatentClaim {
  id: string
  number: number
  type: 'independent' | 'dependent'
  dependsOn?: number[]
  text: string
  aiGenerated: boolean
  confidence?: number
  humanReviewed: boolean
  lastModified: Date
}

export interface PatentDrawing {
  id: string
  figureNumber: string
  title: string
  url: string
  aiGenerated: boolean
  confidence?: number
}

export interface PatentCitation {
  id: string
  type: 'patent' | 'non_patent_literature'
  patentNumber?: string
  title: string
  date: Date
  relevance: number
  aiIdentified: boolean
}

export interface ProsecutionEvent {
  id: string
  date: Date
  type: 'filing' | 'office_action' | 'response' | 'allowance' | 'rejection'
  description: string
  documents: Array<{
    id: string
    name: string
    url: string
  }>
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actions?: Array<{
    label: string
    action: () => void
  }>
  relatedEntity?: {
    type: 'patent' | 'ai_operation' | 'deadline'
    id: string
  }
}

export interface UIState {
  sidebarCollapsed: boolean
  activeModal: string | null
  selectedPatents: string[]
  bulkOperationMode: boolean
  searchQuery: string
  filters: {
    status: string[]
    dateRange: [Date, Date] | null
    inventors: string[]
    assignee: string[]
    classifications: string[]
  }
  sorting: {
    field: string
    direction: 'asc' | 'desc'
  }
}