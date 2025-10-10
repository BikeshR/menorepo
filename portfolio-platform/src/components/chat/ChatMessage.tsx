import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MessageRole = 'user' | 'assistant'

export interface Message {
  role: MessageRole
  content: string
  id: string
  modelName?: string
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        {!isUser && message.modelName && (
          <p className="text-xs text-muted-foreground mt-2 opacity-70">via {message.modelName}</p>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
      )}
    </div>
  )
}
