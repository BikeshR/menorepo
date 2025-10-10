'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ChatInput } from './ChatInput'
import { ChatMessage, type Message } from './ChatMessage'

/**
 * Remove reasoning/thinking tokens that some models (like Qwen3) output
 * These are internal reasoning artifacts that shouldn't be shown to users
 *
 * Also handles incomplete tags during streaming by hiding content after unclosed tags
 */
function cleanReasoningTokens(content: string): string {
  // First, remove complete reasoning blocks
  let cleaned = content
    // Remove <think>...</think> blocks
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    // Remove <thinking>...</thinking> blocks
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // Remove <thought>...</thought> blocks
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    // Remove <reasoning>...</reasoning> blocks
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    // Clean up extra whitespace/newlines left behind
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  // Check for unclosed reasoning tags (incomplete during streaming)
  const unclosedTags = [
    /<think>/gi,
    /<thinking>/gi,
    /<thought>/gi,
    /<reasoning>/gi,
  ]

  for (const tagPattern of unclosedTags) {
    const match = cleaned.match(tagPattern)
    if (match && match.index !== undefined) {
      // Found an unclosed tag - hide everything from that point onward
      cleaned = cleaned.substring(0, match.index).trim()
      break
    }
  }

  return cleaned
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      })

      if (!response.ok) {
        // Try to get error details from response
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('API Error:', response.status, errorData)
        throw new Error(errorData.error || `Failed to get response (${response.status})`)
      }

      // Capture model info from response headers
      const modelName = response.headers.get('X-Model-Name') || undefined

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let assistantMessage = ''
      const assistantMessageId = `assistant-${Date.now()}`

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content

              if (content) {
                assistantMessage += content

                // Clean reasoning tokens before displaying
                const cleanedMessage = cleanReasoningTokens(assistantMessage)

                // Update or add assistant message
                setMessages((prev) => {
                  const existingIndex = prev.findIndex((m) => m.id === assistantMessageId)
                  if (existingIndex >= 0) {
                    const updated = [...prev]
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      content: cleanedMessage,
                    }
                    return updated
                  }
                  return [
                    ...prev,
                    {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: cleanedMessage,
                      modelName,
                    },
                  ]
                })
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)

      // Parse error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check if it's a rate limit error
      const isRateLimit = errorMessage.includes('RATE_LIMIT')

      let userMessage: string
      if (isRateLimit) {
        // Extract retry time if available
        const retryMatch = errorMessage.match(/in (\d+ seconds|a few moments)/)
        const retryTime = retryMatch ? retryMatch[1] : 'a few moments'

        userMessage = `⏱️ **Rate Limit Reached**

The AI service (Groq) has temporarily limited requests. This is a service-wide limit, not an issue with the portfolio.

**Please try again in ${retryTime}.**

In the meantime, you can reach out directly:
- Email: bksh.rana@gmail.com
- LinkedIn: [linkedin.com/in/bikesh-rana](https://www.linkedin.com/in/bikesh-rana)`
      } else {
        // Generic error
        userMessage = `I'm sorry, I'm having trouble responding right now.

**Error**: ${errorMessage}

Please try again or contact Bikesh directly at bksh.rana@gmail.com`
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: userMessage,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const showSuggestions = messages.length === 0

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center space-y-2 py-12">
            <h2 className="text-2xl font-semibold">What would you like to know about Bikesh?</h2>
            <p className="text-muted-foreground">
              Ask me anything about experience, projects, or skills
            </p>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex gap-3 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-sm text-muted-foreground">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-background px-4 py-4">
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          showSuggestions={showSuggestions}
        />
      </div>
    </div>
  )
}
