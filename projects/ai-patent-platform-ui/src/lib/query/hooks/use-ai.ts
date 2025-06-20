import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../query-client'
import { useAIStore } from '@/lib/stores'
import type { AIResponse } from '@/lib/stores/types'

// Types for AI API requests
interface AIPatentClaimsRequest {
  inventionDescription: string
  existingClaims?: string[]
  context?: {
    patentId?: string
    priorArt?: string[]
    targetJurisdiction?: string
  }
}

interface AIPriorArtSearchRequest {
  query: string
  inventionDescription?: string
  classifications?: string[]
  dateRange?: [Date, Date]
  excludePatents?: string[]
}

interface AIInventionAnalysisRequest {
  description: string
  drawings?: string[]
  existingPatents?: string[]
  context?: {
    industry?: string
    targetMarkets?: string[]
  }
}

interface AIPatentDraftRequest {
  inventionTitle: string
  inventionDescription: string
  inventors: Array<{ name: string; address?: string }>
  assignee?: string
  drawings?: Array<{ id: string; description: string }>
  existingClaims?: string[]
}

// Streaming response handler
interface StreamingAIResponse {
  id: string
  chunk: string
  isComplete: boolean
  error?: string
}

// API functions with streaming support
const generatePatentClaims = async (
  request: AIPatentClaimsRequest,
  onStream?: (chunk: StreamingAIResponse) => void
): Promise<AIResponse> => {
  const response = await fetch('/api/ai/generate-claims', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate patent claims: ${response.statusText}`)
  }

  // Handle streaming response if callback provided
  if (onStream && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              onStream(data)
            } catch (e) {
              console.warn('Failed to parse streaming data:', line)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  return response.json()
}

const searchPriorArt = async (request: AIPriorArtSearchRequest): Promise<AIResponse> => {
  const response = await fetch('/api/ai/search-prior-art', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to search prior art: ${response.statusText}`)
  }

  return response.json()
}

const analyzeInvention = async (request: AIInventionAnalysisRequest): Promise<AIResponse> => {
  const response = await fetch('/api/ai/analyze-invention', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to analyze invention: ${response.statusText}`)
  }

  return response.json()
}

const generatePatentDraft = async (
  request: AIPatentDraftRequest,
  onStream?: (chunk: StreamingAIResponse) => void
): Promise<AIResponse> => {
  const response = await fetch('/api/ai/generate-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate patent draft: ${response.statusText}`)
  }

  if (onStream && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              onStream(data)
            } catch (e) {
              console.warn('Failed to parse streaming data:', line)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  return response.json()
}

const fetchAISuggestions = async (contextId: string): Promise<AIResponse[]> => {
  const response = await fetch(`/api/ai/suggestions/${contextId}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch AI suggestions: ${response.statusText}`)
  }
  return response.json()
}

// Query hooks
export const useAISuggestions = (contextId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.aiSuggestions(contextId),
    queryFn: () => fetchAISuggestions(contextId),
    enabled: options?.enabled !== false && !!contextId,
    staleTime: 30 * 1000, // 30 seconds for AI suggestions
    refetchInterval: 60 * 1000, // Refetch every minute for active contexts
  })
}

// Mutation hooks with Zustand integration
export const useGeneratePatentClaims = () => {
  const { startOperation, updateOperation, completeOperation, failOperation, appendStreamingData } = useAIStore()

  return useMutation({
    mutationFn: async (request: AIPatentClaimsRequest) => {
      const operationId = startOperation({
        type: 'patent_claims',
        status: 'processing',
        input: request,
      })

      try {
        const result = await generatePatentClaims(request, (chunk) => {
          if (chunk.error) {
            failOperation(operationId, chunk.error)
          } else {
            appendStreamingData(operationId, chunk.chunk)
            updateOperation(operationId, { 
              status: chunk.isComplete ? 'completed' : 'streaming',
              progress: chunk.isComplete ? 100 : undefined,
            })
          }
        })

        completeOperation(operationId, result)
        return { result, operationId }
      } catch (error) {
        failOperation(operationId, error instanceof Error ? error.message : 'Unknown error')
        throw error
      }
    },
    meta: {
      successMessage: 'Patent claims generated successfully',
      errorMessage: 'Failed to generate patent claims',
    },
  })
}

export const useSearchPriorArt = () => {
  const { startOperation, completeOperation, failOperation } = useAIStore()

  return useMutation({
    mutationFn: async (request: AIPriorArtSearchRequest) => {
      const operationId = startOperation({
        type: 'prior_art_search',
        status: 'processing',
        input: request,
      })

      try {
        const result = await searchPriorArt(request)
        completeOperation(operationId, result)
        return { result, operationId }
      } catch (error) {
        failOperation(operationId, error instanceof Error ? error.message : 'Unknown error')
        throw error
      }
    },
    meta: {
      successMessage: 'Prior art search completed',
      errorMessage: 'Failed to search prior art',
    },
  })
}

export const useAnalyzeInvention = () => {
  const { startOperation, completeOperation, failOperation } = useAIStore()

  return useMutation({
    mutationFn: async (request: AIInventionAnalysisRequest) => {
      const operationId = startOperation({
        type: 'invention_analysis',
        status: 'processing',
        input: request,
      })

      try {
        const result = await analyzeInvention(request)
        completeOperation(operationId, result)
        return { result, operationId }
      } catch (error) {
        failOperation(operationId, error instanceof Error ? error.message : 'Unknown error')
        throw error
      }
    },
    meta: {
      successMessage: 'Invention analysis completed',
      errorMessage: 'Failed to analyze invention',
    },
  })
}

export const useGeneratePatentDraft = () => {
  const { startOperation, updateOperation, completeOperation, failOperation, appendStreamingData } = useAIStore()

  return useMutation({
    mutationFn: async (request: AIPatentDraftRequest) => {
      const operationId = startOperation({
        type: 'patent_draft',
        status: 'processing',
        input: request,
      })

      try {
        const result = await generatePatentDraft(request, (chunk) => {
          if (chunk.error) {
            failOperation(operationId, chunk.error)
          } else {
            appendStreamingData(operationId, chunk.chunk)
            updateOperation(operationId, { 
              status: chunk.isComplete ? 'completed' : 'streaming',
              progress: chunk.isComplete ? 100 : undefined,
            })
          }
        })

        completeOperation(operationId, result)
        return { result, operationId }
      } catch (error) {
        failOperation(operationId, error instanceof Error ? error.message : 'Unknown error')
        throw error
      }
    },
    meta: {
      successMessage: 'Patent draft generated successfully',
      errorMessage: 'Failed to generate patent draft',
    },
  })
}

// Utility hooks
export const useCancelAIOperation = () => {
  const { cancelOperation } = useAIStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (operationId: string) => {
      // Cancel the operation in the store
      cancelOperation(operationId)
      
      // Optionally call API to cancel server-side operation
      try {
        await fetch(`/api/ai/operations/${operationId}/cancel`, {
          method: 'POST',
        })
      } catch (error) {
        console.warn('Failed to cancel server-side operation:', error)
      }

      return operationId
    },
    onSuccess: () => {
      // Invalidate AI-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.ai() })
    },
  })
}

export const useRetryAIOperation = () => {
  const generateClaims = useGeneratePatentClaims()
  const searchPriorArt = useSearchPriorArt()
  const analyzeInvention = useAnalyzeInvention()
  const generateDraft = useGeneratePatentDraft()

  return (operationId: string, operation: any) => {
    switch (operation.type) {
      case 'patent_claims':
        return generateClaims.mutate(operation.input)
      case 'prior_art_search':
        return searchPriorArt.mutate(operation.input)
      case 'invention_analysis':
        return analyzeInvention.mutate(operation.input)
      case 'patent_draft':
        return generateDraft.mutate(operation.input)
      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }
}