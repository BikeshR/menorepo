import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'
import { portfolioContext } from '@/data/portfolio-context'
import { callGroqWithFallback, getCurrentModelInfo } from '@/lib/ai/groq-client'

// Read CV markdown file at module load time (cached)
let cvContent: string
try {
  cvContent = readFileSync(join(process.cwd(), 'src/data/cv.md'), 'utf-8')
  console.log('CV loaded successfully, length:', cvContent.length)
} catch (error) {
  console.error('Failed to load CV:', error)
  cvContent = 'CV file not found'
}

// Rate limiting using a simple in-memory store
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // requests per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(identifier)

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    })
    return true
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false
  }

  userLimit.count += 1
  return true
}

function getClientIdentifier(req: NextRequest): string {
  // Use IP address for rate limiting
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  return ip
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(req)
    if (!checkRateLimit(identifier)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { message } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      console.error('GROQ_API_KEY is not configured')
      return NextResponse.json({ error: 'Chat service is not configured' }, { status: 500 })
    }

    console.log('Groq API Key present:', apiKey ? 'Yes' : 'No')
    console.log('API Key length:', apiKey?.length)
    console.log('Message received:', message.substring(0, 50))

    // Build system prompt with portfolio context and CV
    const systemPrompt = `You are an AI assistant representing Bikesh Rana's portfolio website. Your role is to answer questions about Bikesh's professional background, projects, skills, and experience in a friendly and informative way.

BIKESH'S FULL CV (PRIMARY SOURCE - MOST DETAILED):
${cvContent}

ADDITIONAL STRUCTURED CONTEXT:
${JSON.stringify(portfolioContext, null, 2)}

GUIDELINES:
- Be enthusiastic but professional
- Keep responses concise (2-3 paragraphs maximum unless asked for detailed information)
- When asked about projects, highlight the most relevant ones with specific details from the CV
- When asked about skills, be specific about technologies and frameworks mentioned in the CV
- If asked about work experience, provide details from the Professional Experience section
- If asked about availability, refer to the Availability section in the CV
- Direct visitors to:
  - GitHub: https://github.com/BikeshR
  - LinkedIn: https://www.linkedin.com/in/bikesh-rana
  - Email: bksh.rana@gmail.com
- If you don't know something specific, be honest and suggest contacting Bikesh directly
- Always maintain a positive, helpful tone
- Use the CV as your primary source of truth for detailed information

Remember: You're representing Bikesh's professional brand. Be accurate, helpful, and authentic.`

    // Call Groq API with automatic model fallback
    console.log('Calling Groq API with smart model selection...')

    const response = await callGroqWithFallback(apiKey, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    })

    // Log which model is being used
    const modelInfo = getCurrentModelInfo()
    if (modelInfo) {
      console.log(`✅ Using model: ${modelInfo.name} (${modelInfo.id})`)
    }

    // Return streaming response with model info in headers
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Model-ID': modelInfo?.id || 'unknown',
        'X-Model-Name': modelInfo?.name || 'Unknown Model',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
