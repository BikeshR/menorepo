import { Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
        <div className="text-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Style paragraphs
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              // Style links
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {children}
                </a>
              ),
              // Style code blocks
              code: ({ className, children }) => {
                const isInline = !className
                return isInline ? (
                  <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs">
                    {children}
                  </code>
                ) : (
                  <code className="block bg-black/10 dark:bg-white/10 p-2 rounded text-xs overflow-x-auto">
                    {children}
                  </code>
                )
              },
              // Style lists
              ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              // Style headings
              h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
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
