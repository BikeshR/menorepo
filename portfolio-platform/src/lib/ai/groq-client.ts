import { GROQ_MODELS, getSmartFallbackChain, getWorkingModel, setWorkingModel } from './groq-config'

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqChatRequest {
  messages: GroqChatMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface GroqError {
  error?: {
    message?: string
    type?: string
  }
}

/**
 * Check if error indicates model deprecation/decommission or incompatibility
 * These errors should trigger trying the next model in the fallback chain
 */
function shouldTryNextModel(error: GroqError, statusCode?: number): boolean {
  // Rate limit errors should NOT trigger fallback - they apply to all models
  if (statusCode === 429) {
    return false
  }

  const message = error?.error?.message?.toLowerCase() || ''
  return (
    message.includes('decommission') ||
    message.includes('deprecated') ||
    message.includes('no longer supported') ||
    message.includes('not found') ||
    message.includes('max_tokens') || // Token limit errors (model incompatibility)
    message.includes('context_window') // Context window errors
  )
}

/**
 * Call Groq API with automatic model fallback
 * Tries models in order until one works
 *
 * Uses smart selection:
 * 1. Queries Groq API for available models (cached for 1 hour)
 * 2. Scores models algorithmically based on API fields (params, tokens, context, recency)
 * 3. Randomly selects from top 3 for variety
 * 4. Falls back to remaining models if selected one fails
 */
export async function callGroqWithFallback(
  apiKey: string,
  request: GroqChatRequest
): Promise<Response> {
  // Get dynamic list of available models sorted by quality (or fallback to hardcoded)
  const availableModels = await getSmartFallbackChain(apiKey)

  // Take top 3 models and randomly select one for variety
  const top3 = availableModels.slice(0, 3)
  const randomIndex = Math.floor(Math.random() * top3.length)
  const selectedModel = top3[randomIndex]

  // Build fallback chain: selected model first, then the rest
  const modelsToTry = [selectedModel, ...availableModels.filter((m) => m !== selectedModel)]

  console.log(`\n🎲 Randomly selected from top 3: ${selectedModel}`)
  console.log(`📋 Top 3 were: ${top3.join(', ')}\n`)

  let lastError: Error | null = null

  for (const modelId of modelsToTry) {
    try {
      console.log(`🤖 Trying model: ${modelId}`)

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          ...request,
        }),
      })

      // If successful, cache this model and return
      if (response.ok) {
        setWorkingModel(modelId)
        console.log(`✅ Success with model: ${modelId}`)
        return response
      }

      // Check if it's a deprecation error
      const errorText = await response.text()
      let errorData: GroqError = {}

      try {
        errorData = JSON.parse(errorText)
      } catch {
        // Not JSON, that's ok
      }

      // Check if it's a rate limit error
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        const resetTime = retryAfter ? `${retryAfter} seconds` : 'a few moments'
        throw new Error(
          `RATE_LIMIT: Groq API rate limit exceeded. Please try again in ${resetTime}. This is a Groq service limit, not an error with the portfolio.`
        )
      }

      if (shouldTryNextModel(errorData, response.status)) {
        console.warn(`⚠️  Model ${modelId} incompatible or deprecated, trying next...`)
        continue // Try next model
      }

      // If it's another error (auth, etc), throw it
      // Don't try other models for non-compatibility errors
      throw new Error(`Groq API error (${response.status}): ${errorText.substring(0, 200)}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`❌ Error with model ${modelId}:`, lastError.message)

      // If it's not a model compatibility error, stop trying
      if (
        !lastError.message.includes('deprecated') &&
        !lastError.message.includes('decommission') &&
        !lastError.message.includes('max_tokens') &&
        !lastError.message.includes('context_window')
      ) {
        throw lastError
      }
    }
  }

  // All models failed
  throw new Error(`All Groq models failed. Last error: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Get current model info for logging/display
 */
export function getCurrentModelInfo() {
  const modelId = getWorkingModel()
  if (!modelId) return null

  const model = GROQ_MODELS.find((m) => m.id === modelId)

  // If model found in config, return full info
  if (model) return model

  // Otherwise, return basic info with just the ID
  return {
    id: modelId,
    name: modelId, // Use ID as name for unknown models
    contextWindow: 131072,
    speed: 'fast' as const,
    quality: 'good' as const,
    description: 'Dynamically discovered model',
  }
}
