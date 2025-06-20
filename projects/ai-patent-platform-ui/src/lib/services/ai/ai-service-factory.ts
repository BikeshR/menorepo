import { OpenAIService } from './openai-service'
import { BaseAIService } from './base-service'
import { AIServiceConfig } from './types'

export type AIProvider = 'openai' | 'anthropic' | 'solve-intelligence'

export interface AIProviderConfig extends Omit<AIServiceConfig, 'model'> {
  provider: AIProvider
  model?: string
}

// Factory for creating AI service instances
export class AIServiceFactory {
  private static instances: Map<string, BaseAIService> = new Map()

  static create(config: AIProviderConfig): BaseAIService {
    const key = `${config.provider}-${config.model || 'default'}`
    
    if (this.instances.has(key)) {
      return this.instances.get(key)!
    }

    let service: BaseAIService

    switch (config.provider) {
      case 'openai':
        service = new OpenAIService({
          ...config,
          model: config.model || 'gpt-4-turbo-preview',
        })
        break
      
      case 'anthropic':
        // TODO: Implement AnthropicService when available
        throw new Error('Anthropic service not yet implemented')
      
      case 'solve-intelligence':
        // TODO: Implement SolveIntelligenceService for custom models
        throw new Error('Solve Intelligence service not yet implemented')
      
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`)
    }

    this.instances.set(key, service)
    return service
  }

  static get(provider: AIProvider, model?: string): BaseAIService | undefined {
    const key = `${provider}-${model || 'default'}`
    return this.instances.get(key)
  }

  static clear(): void {
    // Cancel all active operations before clearing
    for (const service of this.instances.values()) {
      service.cancel()
    }
    this.instances.clear()
  }

  static getAvailableProviders(): AIProvider[] {
    return ['openai'] // Add 'anthropic', 'solve-intelligence' when implemented
  }

  static getRecommendedModels(provider: AIProvider): string[] {
    switch (provider) {
      case 'openai':
        return [
          'gpt-4-turbo-preview',
          'gpt-4',
          'gpt-3.5-turbo',
        ]
      case 'anthropic':
        return [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ]
      case 'solve-intelligence':
        return [
          'patent-claims-v1',
          'prior-art-search-v1',
          'invention-analysis-v1',
        ]
      default:
        return []
    }
  }

  static getProviderCapabilities(provider: AIProvider) {
    switch (provider) {
      case 'openai':
        return {
          supportsStreaming: true,
          maxContextLength: 128000, // GPT-4 Turbo
          supportedOperations: [
            'patent_claims_generation',
            'prior_art_search',
            'invention_analysis',
            'patent_drafting',
          ],
          confidenceScoring: true,
          reasoningExplanation: true,
          multiModalSupport: true,
        }
      case 'anthropic':
        return {
          supportsStreaming: true,
          maxContextLength: 200000, // Claude 3
          supportedOperations: [
            'patent_claims_generation',
            'prior_art_search',
            'invention_analysis',
            'patent_drafting',
          ],
          confidenceScoring: true,
          reasoningExplanation: true,
          multiModalSupport: true,
        }
      case 'solve-intelligence':
        return {
          supportsStreaming: true,
          maxContextLength: 100000,
          supportedOperations: [
            'patent_claims_generation',
            'prior_art_search',
            'invention_analysis',
            'patent_drafting',
            'claim_analysis',
            'novelty_assessment',
            'freedom_to_operate',
            'patent_landscape',
          ],
          confidenceScoring: true,
          reasoningExplanation: true,
          multiModalSupport: false,
        }
      default:
        return null
    }
  }
}

// Default service instance management
export class DefaultAIService {
  private static defaultService: BaseAIService | null = null
  private static config: AIProviderConfig | null = null

  static initialize(config: AIProviderConfig): void {
    this.config = config
    this.defaultService = AIServiceFactory.create(config)
  }

  static get(): BaseAIService {
    if (!this.defaultService) {
      throw new Error('Default AI service not initialized. Call DefaultAIService.initialize() first.')
    }
    return this.defaultService
  }

  static getConfig(): AIProviderConfig | null {
    return this.config
  }

  static isInitialized(): boolean {
    return this.defaultService !== null
  }

  static reset(): void {
    if (this.defaultService) {
      this.defaultService.cancel()
    }
    this.defaultService = null
    this.config = null
  }
}

// Environment-based configuration helper
export const createAIServiceFromEnv = (): BaseAIService => {
  const provider = (process.env.NEXT_PUBLIC_AI_PROVIDER as AIProvider) || 'openai'
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || ''
  const model = process.env.AI_MODEL
  const baseUrl = process.env.AI_BASE_URL

  if (!apiKey) {
    throw new Error(`AI API key not found. Set AI_API_KEY or OPENAI_API_KEY environment variable.`)
  }

  const config: AIProviderConfig = {
    provider,
    apiKey,
    ...(model && { model }),
    ...(baseUrl && { baseUrl }),
  }

  return AIServiceFactory.create(config)
}

// Service health monitoring
export class AIServiceMonitor {
  private static healthChecks: Map<string, { lastCheck: Date; isHealthy: boolean }> = new Map()

  static async checkHealth(provider: AIProvider, model?: string): Promise<boolean> {
    const key = `${provider}-${model || 'default'}`
    const service = AIServiceFactory.get(provider, model)
    
    if (!service) {
      return false
    }

    try {
      const isHealthy = await service.healthCheck()
      this.healthChecks.set(key, { lastCheck: new Date(), isHealthy })
      return isHealthy
    } catch {
      this.healthChecks.set(key, { lastCheck: new Date(), isHealthy: false })
      return false
    }
  }

  static getHealthStatus(provider: AIProvider, model?: string): { lastCheck?: Date; isHealthy?: boolean } | null {
    const key = `${provider}-${model || 'default'}`
    return this.healthChecks.get(key) || null
  }

  static async checkAllServices(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()
    
    for (const provider of AIServiceFactory.getAvailableProviders()) {
      const models = AIServiceFactory.getRecommendedModels(provider)
      
      for (const model of models) {
        const key = `${provider}-${model}`
        try {
          const isHealthy = await this.checkHealth(provider, model)
          results.set(key, isHealthy)
        } catch {
          results.set(key, false)
        }
      }
    }
    
    return results
  }
}