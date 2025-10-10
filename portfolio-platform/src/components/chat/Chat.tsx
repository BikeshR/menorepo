'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ChatInput } from './ChatInput'
import { ChatMessage, type Message } from './ChatMessage'

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

                // Update or add assistant message
                setMessages((prev) => {
                  const existingIndex = prev.findIndex((m) => m.id === assistantMessageId)
                  if (existingIndex >= 0) {
                    const updated = [...prev]
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      content: assistantMessage,
                    }
                    return updated
                  }
                  return [
                    ...prev,
                    {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: assistantMessage,
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
      // Add error message with details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `I'm sorry, I'm having trouble responding right now.

Error: ${errorMessage}

Please try again or contact Bikesh directly at bksh.rana@gmail.com`,
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
