import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
}

export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <div className={cn('space-y-4 mb-12', className)}>
      <h1 className="text-4xl md:text-5xl font-bold">{title}</h1>
      {description && <p className="text-xl text-muted-foreground max-w-3xl">{description}</p>}
    </div>
  )
}
