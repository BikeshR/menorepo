import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DashboardCardProps {
  title: string
  value: string | React.ReactNode
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  className?: string
}

export function DashboardCard({
  title,
  value,
  description,
  icon,
  trend,
  className
}: DashboardCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
        {trend && (
          <div className={cn(
            'text-xs mt-1 flex items-center',
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          )}>
            <span className={cn(
              'inline-block w-0 h-0 mr-1',
              trend.isPositive 
                ? 'border-l-2 border-r-2 border-b-2 border-transparent border-b-green-600'
                : 'border-l-2 border-r-2 border-t-2 border-transparent border-t-red-600'
            )} />
            {trend.value}
          </div>
        )}
      </CardContent>
    </Card>
  )
}