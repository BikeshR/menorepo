'use client'

import { Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// Static initial suggestions for instant load
const INITIAL_SUGGESTIONS = [
  'What are your key technical skills?',
  'Tell me about your recent projects',
  'What is your professional experience?',
  'Are you available for work?',
]

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  showSuggestions?: boolean
  suggestions?: string[] // Follow-up suggestions from AI responses
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  showSuggestions = true,
  suggestions = INITIAL_SUGGESTIONS,
}: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    if (!disabled) {
      onSendMessage(suggestion)
    }
  }

  return (
    <div className="w-full space-y-3">
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about Bikesh..."
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || !input.trim()}
          className="h-12 w-12 flex-shrink-0"
        >
          <Send className="h-5 w-5" />
          <span className="sr-only">Send message</span>
        </Button>
      </form>

      {/* Suggested Questions */}
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suggested questions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleSuggestionClick(question)}
                disabled={disabled}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
