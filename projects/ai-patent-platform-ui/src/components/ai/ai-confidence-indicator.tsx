import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AIConfidenceIndicatorProps {
  confidence: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showPercentage?: boolean
}

export function AIConfidenceIndicator({ 
  confidence, 
  size = 'md', 
  className,
  showPercentage = true 
}: AIConfidenceIndicatorProps) {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) {
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
    } else if (conf >= 0.6) {
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
    } else {
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
    }
  }

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 0.8) return 'High'
    if (conf >= 0.6) return 'Medium'
    return 'Low'
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  }

  const percentage = Math.round(confidence * 100)

  return (
    <Badge
      variant="outline"
      className={cn(
        getConfidenceColor(confidence),
        sizeClasses[size],
        className
      )}
    >
      {getConfidenceLabel(confidence)}
      {showPercentage && ` (${percentage}%)`}
    </Badge>
  )
}