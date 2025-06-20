'use client'

import { useState } from 'react'
// import { usePatents } from '@/lib/query/hooks/use-patents'
// import { useAuth, usePermissions } from '@/lib/auth'
// import { useUIStore } from '@/lib/stores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { Icons } from '@/components/ui/icons'
import { PatentStatusBadge } from '@/components/patent/patent-status-badge'
import { AIConfidenceIndicator } from '@/components/ai/ai-confidence-indicator'
import { DashboardCard } from '@/components/layout/dashboard-card'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { format } from 'date-fns'

// Mock data for development - in real app this comes from API
const mockPatents = [
  {
    id: '1',
    title: 'Machine Learning Algorithm for Patent Classification',
    status: 'pending' as const,
    filingDate: new Date('2024-01-15'),
    inventors: [{ id: '1', name: 'Dr. Sarah Johnson' }],
    assignee: 'TechCorp Inc.',
    abstract: 'A novel machine learning approach for automatically classifying patents...',
    aiGeneratedContent: [
      { section: 'claims', content: '', confidence: 0.85, humanReviewed: true }
    ]
  },
  {
    id: '2', 
    title: 'Quantum Computing Circuit Optimization',
    status: 'granted' as const,
    filingDate: new Date('2023-11-20'),
    inventors: [{ id: '2', name: 'Prof. Michael Chen' }],
    assignee: 'Quantum Labs',
    abstract: 'An innovative method for optimizing quantum computing circuits...',
    aiGeneratedContent: []
  },
  {
    id: '3',
    title: 'Biomedical Sensor Device',
    status: 'draft' as const,
    filingDate: new Date('2024-03-01'),
    inventors: [{ id: '3', name: 'Dr. Emily Rodriguez' }],
    assignee: 'MedTech Solutions',
    abstract: 'A miniaturized biomedical sensor for continuous health monitoring...',
    aiGeneratedContent: [
      { section: 'description', content: '', confidence: 0.92, humanReviewed: false }
    ]
  }
]

const patentColumns = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }: any) => (
      <div className="max-w-[300px]">
        <Link 
          href={`/patents/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.getValue('title')}
        </Link>
        <div className="text-sm text-muted-foreground mt-1">
          {row.original.inventors.map((inv: any) => inv.name).join(', ')}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => (
      <PatentStatusBadge status={row.getValue('status')} />
    ),
  },
  {
    accessorKey: 'filingDate',
    header: 'Filing Date',
    cell: ({ row }: any) => (
      <span>{format(row.getValue('filingDate'), 'MMM dd, yyyy')}</span>
    ),
  },
  {
    accessorKey: 'assignee',
    header: 'Assignee',
  },
  {
    id: 'aiContent',
    header: 'AI Content',
    cell: ({ row }: any) => {
      const aiContent = row.original.aiGeneratedContent
      if (!aiContent || aiContent.length === 0) {
        return <span className="text-muted-foreground">None</span>
      }
      const avgConfidence = aiContent.reduce((sum: number, item: any) => sum + item.confidence, 0) / aiContent.length
      return <AIConfidenceIndicator confidence={avgConfidence} size="sm" />
    },
  },
  {
    id: 'actions',
    cell: ({ row }: any) => (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/patents/${row.original.id}`}>
            <Icons.eye className="h-4 w-4" />
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/patents/${row.original.id}/edit`}>
            <Icons.edit className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    ),
  },
]

export default function DashboardPage() {
  // const { user } = useAuth()
  // const { hasPermission } = usePermissions()
  // const { searchQuery, setSearchQuery, filters, updateFilters } = useUIStore()
  
  const user = { name: 'John Doe' }
  const hasPermission = () => true
  const searchQuery = ''
  const setSearchQuery = () => {}
  const filters = {}
  const updateFilters = () => {}
  
  const [selectedTab, setSelectedTab] = useState('overview')
  
  // Mock query - replace with real usePatents hook
  const { data: patentsData, isLoading, error } = {
    data: {
      data: mockPatents,
      pagination: {
        page: 1,
        limit: 10,
        total: 3,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      }
    },
    isLoading: false,
    error: null
  }

  // Dashboard stats (would come from analytics API)
  const stats = {
    totalPatents: 3,
    pendingApplications: 1,
    grantedPatents: 1,
    draftPatents: 1,
    aiAssisted: 2,
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
  }

  const handleStatusFilter = (status: string) => {
    const currentStatus = filters.status || []
    const newStatus = status === 'all' 
      ? [] 
      : currentStatus.includes(status)
        ? currentStatus.filter(s => s !== status)
        : [...currentStatus, status]
    
    updateFilters({ status: newStatus })
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Icons.alertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to load dashboard</h3>
            <p className="text-muted-foreground text-center">
              There was an error loading your dashboard data. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name}. Here's your patent portfolio overview.
          </p>
        </div>
        
        {hasPermission('patents:write') && (
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/invention-wizard">
                <Icons.plus className="mr-2 h-4 w-4" />
                New Invention
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/patents/create">
                <Icons.fileText className="mr-2 h-4 w-4" />
                File Patent
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <DashboardCard
          title="Total Patents"
          value={isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalPatents.toString()}
          description="All patents in portfolio"
          icon={<Icons.fileText className="h-4 w-4" />}
        />
        
        <DashboardCard
          title="Pending"
          value={isLoading ? <Skeleton className="h-8 w-16" /> : stats.pendingApplications.toString()}
          description="Under examination"
          icon={<Icons.clock className="h-4 w-4" />}
          className="border-amber-200 dark:border-amber-800"
        />
        
        <DashboardCard
          title="Granted"
          value={isLoading ? <Skeleton className="h-8 w-16" /> : stats.grantedPatents.toString()}
          description="Successfully granted"
          icon={<Icons.checkCircle className="h-4 w-4" />}
          className="border-green-200 dark:border-green-800"
        />
        
        <DashboardCard
          title="Drafts"
          value={isLoading ? <Skeleton className="h-8 w-16" /> : stats.draftPatents.toString()}
          description="Work in progress"
          icon={<Icons.edit className="h-4 w-4" />}
          className="border-blue-200 dark:border-blue-800"
        />
        
        <DashboardCard
          title="AI Assisted"
          value={isLoading ? <Skeleton className="h-8 w-16" /> : stats.aiAssisted.toString()}
          description="With AI content"
          icon={<Icons.brain className="h-4 w-4" />}
          className="border-purple-200 dark:border-purple-800"
        />
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patents">Patents</TabsTrigger>
          {hasPermission('analytics:read') && (
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          )}
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Patents */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Patents</CardTitle>
                <CardDescription>
                  Your most recently filed patents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[200px]" />
                          <Skeleton className="h-4 w-[160px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mockPatents.slice(0, 3).map((patent) => (
                      <div key={patent.id} className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Link 
                            href={`/patents/${patent.id}`}
                            className="font-medium hover:underline line-clamp-1"
                          >
                            {patent.title}
                          </Link>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <PatentStatusBadge status={patent.status} />
                            <span>•</span>
                            <span>{format(patent.filingDate, 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle>AI Suggestions</CardTitle>
                <CardDescription>
                  Recommendations to improve your portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Review pending claims</p>
                      <p className="text-sm text-muted-foreground">
                        2 patents have AI-generated claims that need human review
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mt-2" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Prior art search recommended</p>
                      <p className="text-sm text-muted-foreground">
                        Consider expanding prior art for "Quantum Computing Circuit"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Filing opportunity</p>
                      <p className="text-sm text-muted-foreground">
                        New invention idea detected in your research notes
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patents" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search patents..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <Select onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="granted">Granted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Patents Table */}
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={patentColumns}
                data={patentsData?.data || []}
                loading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Filing Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Charts coming soon...
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>AI Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  AI metrics coming soon...
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest actions in your patent portfolio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <Icons.checkCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Patent granted</p>
                    <p className="text-sm text-muted-foreground">
                      "Quantum Computing Circuit Optimization" was granted - 2 hours ago
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <Icons.brain className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">AI claims generated</p>
                    <p className="text-sm text-muted-foreground">
                      New claims generated for "Biomedical Sensor Device" - 1 day ago
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                    <Icons.fileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Patent filed</p>
                    <p className="text-sm text-muted-foreground">
                      "Machine Learning Algorithm" filed with USPTO - 3 days ago
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}