/**
 * Groq AI Model Configuration with Dynamic Fallback
 *
 * The system automatically discovers available models via Groq API and scores them
 * based on parameters, token limits, context window, and recency.
 *
 * Models are tried in ranked order (best → worst). If a model hits its daily rate limit,
 * the system automatically tries the next model in the ranked list.
 *
 * Completely dynamic - no hardcoded model names needed for fallback logic.
 */

export interface GroqModel {
  id: string
  name: string
  contextWindow: number
  speed: 'blazing' | 'very-fast' | 'fast'
  quality: 'excellent' | 'great' | 'good'
  description: string
}

export interface GroqAPIModel {
  id: string
  object: string
  created: number
  owned_by: string
  active: boolean
  context_window: number
  max_completion_tokens: number
}

export const GROQ_MODELS: GroqModel[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    contextWindow: 8192,
    speed: 'very-fast',
    quality: 'excellent',
    description: 'Latest Llama 3.3 - Best balance of speed and quality',
  },
  {
    id: 'llama3-70b-8192',
    name: 'Llama 3 70B',
    contextWindow: 8192,
    speed: 'fast',
    quality: 'great',
    description: 'Stable Llama 3 - Reliable fallback',
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    contextWindow: 32768,
    speed: 'fast',
    quality: 'great',
    description: 'Large context window - Good for detailed conversations',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    contextWindow: 131072,
    speed: 'blazing',
    quality: 'good',
    description: 'Fastest model - Use when speed is critical',
  },
]

// Get model IDs for fallback chain
export const MODEL_FALLBACK_CHAIN = GROQ_MODELS.map((m) => m.id)

// Cache for the currently working model (in-memory, resets on server restart)
let workingModel: string | null = null

// Cache for available models from Groq API
let availableModels: string[] | null = null
let lastModelFetch: number = 0
const MODEL_CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Score a model based purely on API-provided fields
 * Higher score = better model
 */
function scoreModel(model: GroqAPIModel): number {
  // 1. Extract parameter count from ID (e.g., "70b" -> 70)
  const paramMatch = model.id.toLowerCase().match(/(\d+)b/)
  const paramCount = paramMatch ? parseInt(paramMatch[1]) : 8 // Default 8B if unparseable

  // Use square root to prevent large models from dominating
  // 120B→10.95, 70B→8.37, 32B→5.66, 17B→4.12, 8B→2.83
  const paramScore = Math.sqrt(paramCount) * 1000

  // 2. Max completion tokens (logarithmic scale)
  // log(131072)≈11.78, log(65536)≈11.09, log(32768)≈10.40, log(8192)≈9.01
  const tokenScore = Math.log(model.max_completion_tokens) * 800

  // 3. Context window (logarithmic scale, lower weight)
  const contextScore = Math.log(model.context_window) * 300

  // 4. Recency bonus (newer models = better training techniques)
  const nowInSeconds = Date.now() / 1000
  const ageInYears = (nowInSeconds - model.created) / (365.25 * 24 * 60 * 60)
  // Brand new = +500, 1yr old = +300, 2yr = +100, 3yr+ = 0
  const recencyScore = Math.max(0, 500 - ageInYears * 200)

  const totalScore = paramScore + tokenScore + contextScore + recencyScore

  console.log(
    `📊 Model ${model.id}: params=${paramCount}B, score=${totalScore.toFixed(0)} (param=${paramScore.toFixed(0)}, token=${tokenScore.toFixed(0)}, context=${contextScore.toFixed(0)}, recency=${recencyScore.toFixed(0)})`
  )

  return totalScore
}

export function getWorkingModel(): string | null {
  return workingModel
}

export function setWorkingModel(modelId: string): void {
  workingModel = modelId
  console.log(`✅ Working model set to: ${modelId}`)
}

export function resetWorkingModel(): void {
  workingModel = null
  console.log('🔄 Working model cache reset')
}

/**
 * Fetch available models from Groq API
 * Returns cached result if fetched within last hour
 */
export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  const now = Date.now()

  // Return cached if still valid
  if (availableModels && now - lastModelFetch < MODEL_CACHE_TTL) {
    return availableModels
  }

  try {
    console.log('🔍 Fetching available models from Groq API...')

    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`)
    }

    const data = await response.json()

    // Log the full response structure for debugging
    console.log('📋 Available Models API Response:', JSON.stringify(data, null, 2))

    const allModels: GroqAPIModel[] = data.data || []

    // Filter for chat models only (exclude embeddings, TTS, guard models, etc.)
    const chatModels = allModels.filter(
      (model) =>
        (model.id.includes('llama') ||
          model.id.includes('mixtral') ||
          model.id.includes('gemma') ||
          model.id.includes('gpt-oss') ||
          model.id.includes('kimi') ||
          model.id.includes('qwen') ||
          model.id.includes('compound')) &&
        !model.id.includes('guard') && // Exclude guard models (for content filtering)
        !model.id.includes('prompt-guard') && // Exclude prompt guard models
        !model.id.includes('tts') && // Exclude text-to-speech models
        !model.id.includes('whisper') && // Exclude speech-to-text models
        !model.id.includes('allam') && // Exclude ALLAM models (low token limit)
        model.max_completion_tokens >= 8192 // Must support reasonable response length
    )

    console.log(`\n🎯 Scoring ${chatModels.length} chat-capable models...\n`)

    // Score and sort models (best first)
    const scoredModels = chatModels.map((model) => ({
      model,
      score: scoreModel(model),
    }))

    scoredModels.sort((a, b) => b.score - a.score)

    console.log('\n🏆 Final Rankings:')
    scoredModels.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.model.id} - Score: ${item.score.toFixed(0)}`)
    })

    const sortedModelIds = scoredModels.map((item) => item.model.id)

    availableModels = sortedModelIds
    lastModelFetch = now

    console.log(`\n✅ Returning ${sortedModelIds.length} models sorted by quality`)
    console.log(`📋 Fallback strategy: Try models in ranked order until one succeeds`)
    return sortedModelIds
  } catch (error) {
    console.error('❌ Failed to fetch available models:', error)
    // Return fallback list
    return MODEL_FALLBACK_CHAIN
  }
}

/**
 * Get smart fallback chain:
 * 1. Try to fetch from Groq API (dynamic, always up-to-date)
 * 2. Fall back to our hardcoded list if API fails
 */
export async function getSmartFallbackChain(apiKey: string): Promise<string[]> {
  const dynamicModels = await fetchAvailableModels(apiKey)

  // If we got models from API, use them
  if (dynamicModels.length > 0) {
    return dynamicModels
  }

  // Otherwise use our fallback list
  console.warn('⚠️  Using hardcoded fallback models')
  return MODEL_FALLBACK_CHAIN
}
