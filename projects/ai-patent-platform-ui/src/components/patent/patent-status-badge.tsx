import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type PatentStatus = 'draft' | 'pending' | 'granted' | 'rejected' | 'abandoned'

interface PatentStatusBadgeProps {
  status: PatentStatus
  className?: string
}

const statusConfig = {
  draft: {
    label: 'Draft',
    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  },
  granted: {
    label: 'Granted',
    className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  },
  abandoned: {
    label: 'Abandoned',
    className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800',
  },
}

export function PatentStatusBadge({ status, className }: PatentStatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}