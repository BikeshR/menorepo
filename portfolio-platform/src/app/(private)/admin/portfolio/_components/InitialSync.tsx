'use client'

import { RefreshCw, Wifi } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { syncTradingPortfolio, testTrading212Connection } from '../actions'

export function InitialSync() {
  const [isPending, startTransition] = useTransition()
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean
    message: string
    error?: string
    details?: {
      cashBalance?: number
    }
  } | null>(null)

  const handleSync = () => {
    setSyncResult(null)
    setConnectionResult(null)
    startTransition(async () => {
      const result = await syncTradingPortfolio()
      setSyncResult(result)

      // Reload page on success to show the data
      if (result.success) {
        window.location.reload()
      }
    })
  }

  const handleTestConnection = async () => {
    setConnectionResult(null)
    setSyncResult(null)
    setIsTestingConnection(true)

    try {
      const result = await testTrading212Connection()
      setConnectionResult(result)
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Error messages */}
      {syncResult && !syncResult.success && (
        <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <p className="text-red-900 dark:text-red-100">{syncResult.message}</p>
          {syncResult.error && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">{syncResult.error}</p>
          )}
        </div>
      )}

      {/* Connection test result */}
      {connectionResult && (
        <div
          className={`p-4 rounded-lg border ${
            connectionResult.success
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={
              connectionResult.success
                ? 'text-green-900 dark:text-green-100'
                : 'text-red-900 dark:text-red-100'
            }
          >
            {connectionResult.message}
          </p>
          {connectionResult.error && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">{connectionResult.error}</p>
          )}
          {connectionResult.details?.cashBalance !== undefined && (
            <p className="text-sm text-green-700 dark:text-green-300 mt-2">
              Cash balance: ${connectionResult.details.cashBalance.toFixed(2)}
            </p>
          )}
        </div>
      )}

      <div className="border border-dashed rounded-lg p-12 text-center space-y-4">
        <h2 className="text-xl font-semibold">No Portfolio Data</h2>
        <p className="text-muted-foreground">
          Sync your Trading212 account to start tracking your investments
        </p>
        <div className="pt-4 flex gap-3 justify-center">
          <Button
            onClick={handleTestConnection}
            disabled={isTestingConnection || isPending}
            variant="outline"
            className="gap-2"
          >
            <Wifi className={`h-4 w-4 ${isTestingConnection ? 'animate-pulse' : ''}`} />
            {isTestingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            onClick={handleSync}
            disabled={isPending || isTestingConnection}
            size="lg"
            className="gap-2"
          >
            <RefreshCw className={`h-5 w-5 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Syncing Portfolio...' : 'Sync Portfolio'}
          </Button>
        </div>
        {isPending && (
          <p className="text-sm text-muted-foreground">
            This may take a few moments while we fetch your data...
          </p>
        )}
      </div>
    </div>
  )
}
