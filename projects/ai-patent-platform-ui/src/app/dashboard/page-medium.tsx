'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Icons } from '@/components/ui/icons'
import { DashboardCard } from '@/components/layout/dashboard-card'
import Link from 'next/link'

export default function DashboardPage() {
  const user = { name: 'John Doe' }
  
  // Dashboard stats
  const stats = {
    totalPatents: 3,
    pendingApplications: 1,
    grantedPatents: 1,
    draftPatents: 1,
    aiAssisted: 2,
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <DashboardCard
          title="Total Patents"
          value={stats.totalPatents.toString()}
          description="All patents in portfolio"
          icon={<Icons.fileText className="h-4 w-4" />}
        />
        
        <DashboardCard
          title="Pending"
          value={stats.pendingApplications.toString()}
          description="Under examination"
          icon={<Icons.clock className="h-4 w-4" />}
          className="border-amber-200 dark:border-amber-800"
        />
        
        <DashboardCard
          title="Granted"
          value={stats.grantedPatents.toString()}
          description="Successfully granted"
          icon={<Icons.checkCircle className="h-4 w-4" />}
          className="border-green-200 dark:border-green-800"
        />
        
        <DashboardCard
          title="Drafts"
          value={stats.draftPatents.toString()}
          description="Work in progress"
          icon={<Icons.edit className="h-4 w-4" />}
          className="border-blue-200 dark:border-blue-800"
        />
        
        <DashboardCard
          title="AI Assisted"
          value={stats.aiAssisted.toString()}
          description="With AI content"
          icon={<Icons.brain className="h-4 w-4" />}
          className="border-purple-200 dark:border-purple-800"
        />
      </div>

      {/* Recent Patents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Patents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Machine Learning Algorithm for Patent Classification</p>
                  <p className="text-sm text-muted-foreground">Status: Pending • Filed: Jan 15, 2024</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Quantum Computing Circuit Optimization</p>
                  <p className="text-sm text-muted-foreground">Status: Granted • Filed: Nov 20, 2023</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Biomedical Sensor Device</p>
                  <p className="text-sm text-muted-foreground">Status: Draft • Filed: Mar 01, 2024</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Suggestions</CardTitle>
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
    </div>
  )
}