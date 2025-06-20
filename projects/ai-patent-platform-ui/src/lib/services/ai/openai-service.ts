import { BaseAIService } from './base-service'
import { 
  AIServiceConfig, 
  StreamingConfig, 
  AIStreamingResponse,
  PatentClaimsGenerationRequest,
  PatentClaimsGenerationResponse,
  PriorArtSearchRequest,
  PriorArtSearchResponse,
  InventionAnalysisRequest,
  InventionAnalysisResponse,
  PatentDraftingRequest,
  PatentDraftingResponse,
  AIServiceError
} from './types'

export class OpenAIService extends BaseAIService {
  constructor(config: Omit<AIServiceConfig, 'baseUrl'> & { baseUrl?: string }) {
    super({
      baseUrl: 'https://api.openai.com/v1',
      ...config,
    })
  }

  async makeRequest<T>(
    endpoint: string,
    data: Record<string, unknown>,
    options: {
      streaming?: boolean
      timeout?: number
    } = {}
  ): Promise<T> {
    const abortController = this.createAbortController()
    const timeout = options.timeout || this.config.timeout

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, timeout)

    try {
      const response = await this.retryRequest(async () => {
        const result = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: this.buildRequestBody({
            ...data,
            stream: options.streaming || false,
          }),
          signal: abortController.signal,
        })

        if (!result.ok) {
          await this.handleErrorResponse(result)
        }

        return result
      })

      return await this.handleResponse<T>(response)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async createStreamingRequest<T>(
    endpoint: string,
    data: Record<string, unknown>,
    streamingConfig: StreamingConfig
  ): Promise<AIStreamingResponse> {
    const abortController = this.createAbortController()
    const operationId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: this.buildRequestBody({
          ...data,
          stream: true,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      // Start processing the stream in the background
      this.processStreamingResponse(response, streamingConfig, operationId)
        .catch(error => {
          streamingConfig.onError?.(error)
        })

      return {
        operationId,
        onChunk: streamingConfig.onChunk || (() => {}),
        onComplete: streamingConfig.onComplete || (() => {}),
        onError: streamingConfig.onError || (() => {}),
        cancel: () => {
          abortController.abort()
        },
      }
    } catch (error) {
      streamingConfig.onError?.(error as Error)
      throw error
    }
  }

  // Patent Claims Generation
  async generatePatentClaims(
    request: PatentClaimsGenerationRequest,
    streamingConfig?: StreamingConfig
  ): Promise<PatentClaimsGenerationResponse | AIStreamingResponse> {
    const prompt = this.buildPatentClaimsPrompt(request)
    
    const requestData = {
      messages: [
        {
          role: 'system',
          content: `You are an expert patent attorney specializing in claim drafting. Generate high-quality patent claims based on the provided invention description. Follow these guidelines:

1. Create clear, precise, and legally sound claims
2. Ensure proper claim hierarchy (independent and dependent claims)
3. Use appropriate claim language and terminology
4. Consider prior art and avoid obvious elements
5. Provide confidence scores and reasoning
6. Suggest alternative claim formulations

Always respond with valid JSON matching the PatentClaimsGenerationResponse schema.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    }

    if (streamingConfig?.enabled) {
      return this.createStreamingRequest('/chat/completions', requestData, streamingConfig)
    }

    return this.makeRequest<PatentClaimsGenerationResponse>('/chat/completions', requestData)
  }

  // Prior Art Search
  async searchPriorArt(
    request: PriorArtSearchRequest
  ): Promise<PriorArtSearchResponse> {
    const prompt = this.buildPriorArtSearchPrompt(request)
    
    const requestData = {
      messages: [
        {
          role: 'system',
          content: `You are an expert patent searcher and prior art analyst. Perform comprehensive prior art searches and analyze the results for novelty assessment. Provide detailed relevance scoring and similarity analysis.

Always respond with valid JSON matching the PriorArtSearchResponse schema.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    }

    return this.makeRequest<PriorArtSearchResponse>('/chat/completions', requestData)
  }

  // Invention Analysis
  async analyzeInvention(
    request: InventionAnalysisRequest
  ): Promise<InventionAnalysisResponse> {
    const prompt = this.buildInventionAnalysisPrompt(request)
    
    const requestData = {
      messages: [
        {
          role: 'system',
          content: `You are an expert patent analyst specializing in patentability assessment, freedom to operate analysis, and patent landscape analysis. Provide comprehensive analysis with actionable insights.

Always respond with valid JSON matching the InventionAnalysisResponse schema.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    }

    return this.makeRequest<InventionAnalysisResponse>('/chat/completions', requestData)
  }

  // Patent Drafting
  async generatePatentDraft(
    request: PatentDraftingRequest,
    streamingConfig?: StreamingConfig
  ): Promise<PatentDraftingResponse | AIStreamingResponse> {
    const prompt = this.buildPatentDraftingPrompt(request)
    
    const requestData = {
      messages: [
        {
          role: 'system',
          content: `You are an expert patent attorney specializing in patent drafting. Create comprehensive, well-structured patent applications that meet all formal requirements and provide strong protection.

Always respond with valid JSON matching the PatentDraftingResponse schema.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    }

    if (streamingConfig?.enabled) {
      return this.createStreamingRequest('/chat/completions', requestData, streamingConfig)
    }

    return this.makeRequest<PatentDraftingResponse>('/chat/completions', requestData)
  }

  // Prompt building helpers
  private buildPatentClaimsPrompt(request: PatentClaimsGenerationRequest): string {
    return `
Generate patent claims for the following invention:

Title: ${request.inventionDescription}
Technical Field: ${request.technicalField || 'Not specified'}
Invention Summary: ${request.inventionSummary || 'Not provided'}

${request.detailedDescription ? `Detailed Description:\n${request.detailedDescription}\n` : ''}

${request.drawings?.length ? `
Drawings:
${request.drawings.map(d => `Figure ${d.figureNumber}: ${d.description}\nElements: ${d.elements.join(', ')}`).join('\n')}
` : ''}

${request.existingClaims?.length ? `
Existing Claims to consider:
${request.existingClaims.join('\n')}
` : ''}

Requirements:
- Generate ${request.claimCount || 10} claims
- Claim type: ${request.claimType || 'both'}
- Style: ${request.style || 'balanced'}
- Jurisdiction: ${request.jurisdiction || 'US'}
- Language: ${request.language || 'English'}

${request.context?.priorArt?.length ? `
Prior Art to consider:
${request.context.priorArt.map(pa => `${pa.title} (Relevance: ${pa.relevance})`).join('\n')}
` : ''}

Please provide a comprehensive response with claims, alternatives, confidence scores, and detailed reasoning.
    `.trim()
  }

  private buildPriorArtSearchPrompt(request: PriorArtSearchRequest): string {
    return `
Perform prior art search for:

Query: ${request.query}
${request.inventionDescription ? `Invention Description: ${request.inventionDescription}` : ''}

Search Parameters:
- Keywords: ${request.keywords?.join(', ') || 'Not specified'}
- Classifications: ${Object.entries(request.classifications || {}).map(([type, codes]) => `${type.toUpperCase()}: ${codes.join(', ')}`).join('; ') || 'Not specified'}
- Date Range: ${request.dateRange?.from?.toDateString() || 'No start'} to ${request.dateRange?.to?.toDateString() || 'No end'}
- Jurisdictions: ${request.jurisdictions?.join(', ') || 'All'}
- Document Types: ${request.documentTypes?.join(', ') || 'All'}
- Max Results: ${request.maxResults || 50}
- Semantic Search: ${request.semanticSearch ? 'Enabled' : 'Disabled'}

${request.excludePatents?.length ? `Exclude Patents: ${request.excludePatents.join(', ')}` : ''}

Please provide comprehensive search results with relevance scoring, similarity analysis, and novelty assessment.
    `.trim()
  }

  private buildInventionAnalysisPrompt(request: InventionAnalysisRequest): string {
    return `
Analyze the following invention:

Title: ${request.title}
Description: ${request.description}
Technical Field: ${request.technicalField || 'Not specified'}
Problem Statement: ${request.problemStatement || 'Not provided'}
Solution: ${request.solution || 'Not provided'}

${request.advantages?.length ? `Advantages:\n${request.advantages.map(a => `- ${a}`).join('\n')}` : ''}

${request.drawings?.length ? `
Drawings:
${request.drawings.map(d => `${d.id}: ${d.description}`).join('\n')}
` : ''}

${request.context ? `
Context:
- Industry: ${request.context.industry}
- Target Markets: ${request.context.targetMarkets?.join(', ') || 'Not specified'}
${request.context.competitorAnalysis?.length ? `
- Competitor Analysis:
${request.context.competitorAnalysis.map(c => `  ${c.name}: ${c.products.join(', ')} (Patents: ${c.patents.join(', ')})`).join('\n')}
` : ''}
` : ''}

Analysis Types Requested: ${request.analysisType?.join(', ') || 'Comprehensive'}

Please provide detailed analysis including patentability assessment, freedom to operate (if requested), patent landscape (if requested), and actionable recommendations.
    `.trim()
  }

  private buildPatentDraftingPrompt(request: PatentDraftingRequest): string {
    return `
Draft a patent application for:

Title: ${request.invention.title}
Technical Field: ${request.invention.field}
Background: ${request.invention.background}
Summary: ${request.invention.summary}
Detailed Description: ${request.invention.detailedDescription}

Claims:
${request.invention.claims.join('\n')}

${request.invention.drawings?.length ? `
Drawings:
${request.invention.drawings.map(d => `Figure ${d.figureNumber}: ${d.description}\n${d.detailedDescription}`).join('\n\n')}
` : ''}

Inventors:
${request.inventors.map(i => `${i.name}, ${i.address}${i.citizenship ? ` (${i.citizenship})` : ''}`).join('\n')}

${request.assignee ? `Assignee: ${request.assignee.name}, ${request.assignee.address} (${request.assignee.type})` : ''}

Filing Details:
- Jurisdiction: ${request.filingDetails.jurisdiction}
- Language: ${request.filingDetails.language}
${request.filingDetails.priorityClaims?.length ? `- Priority Claims: ${request.filingDetails.priorityClaims.map(p => `${p.applicationNumber} (${p.country}, ${p.filingDate.toDateString()})`).join('; ')}` : ''}

Drafting Options:
- Style: ${request.draftingOptions.style}
- Include Alternatives: ${request.draftingOptions.includeAlternatives}
- Emphasize Commercial Aspects: ${request.draftingOptions.emphasizeCommercialAspects}
- Include Defensive Elements: ${request.draftingOptions.includeDefensiveElements}

Please provide a complete, professional patent application with all required sections, quality metrics, and suggestions for improvement.
    `.trim()
  }
}