'use client'

import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPortfolioETFStatus, refreshPortfolioETFs, refreshSingleETF } from '../actions'

interface ETFDataManagerProps {
  portfolioId: string
}

type ETFStatus = {
  ticker: string
  name: string
  isin: string | null
  marketValue: number
  lastScraped: string | null
  status: 'pending' | 'success' | 'failed' | 'stale' | 'missing_isin'
  daysOld: number | null
}

export function ETFDataManager({ portfolioId }: ETFDataManagerProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [etfStatuses, setEtfStatuses] = useState<ETFStatus[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const loadETFStatus = async () => {
    setIsLoadingStatus(true)
    setStatusMessage(null)
    try {
      const result = await getPortfolioETFStatus(portfolioId)
      if (result.success) {
        setEtfStatuses(result.data)
        setShowDetails(true)
      } else {
        setStatusMessage({ type: 'error', message: result.error || 'Failed to load ETF status' })
      }
    } catch (_error) {
      setStatusMessage({ type: 'error', message: 'Failed to load ETF status' })
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    setStatusMessage({ type: 'info', message: 'Refreshing ETFs... This may take a few minutes.' })

    try {
      const result = await refreshPortfolioETFs(portfolioId)

      if (result.success) {
        setStatusMessage({
          type: 'success',
          message: result.message || `Refreshed ${result.refreshed} ETFs successfully`,
        })
        // Reload status
        await loadETFStatus()
      } else {
        setStatusMessage({
          type: 'error',
          message: result.error || 'Failed to refresh ETFs',
        })
      }
    } catch (_error) {
      setStatusMessage({ type: 'error', message: 'Failed to refresh ETF data' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRefreshSingle = async (ticker: string, isin: string) => {
    setStatusMessage({ type: 'info', message: `Updating ${ticker}...` })

    try {
      const result = await refreshSingleETF(ticker, isin)

      if (result.success) {
        setStatusMessage({ type: 'success', message: `${ticker} refreshed successfully` })
        await loadETFStatus()
      } else {
        setStatusMessage({
          type: 'error',
          message: result.error || `Failed to refresh ${ticker}`,
        })
      }
    } catch (_error) {
      setStatusMessage({ type: 'error', message: `Failed to refresh ${ticker}` })
    }
  }

  const getStatusIcon = (status: ETFStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'stale':
        return <Clock className="h-4 w-4 text-orange-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />
      case 'missing_isin':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: ETFStatus) => {
    if (status.status === 'missing_isin') {
      return <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">No ISIN</span>
    }

    if (!status.lastScraped) {
      return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Never</span>
    }

    if (status.daysOld === null) {
      return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Unknown</span>
    }

    if (status.daysOld > 30) {
      return (
        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
          {status.daysOld}d old
        </span>
      )
    }

    if (status.daysOld === 0) {
      return <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Today</span>
    }

    return (
      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
        {status.daysOld}d ago
      </span>
    )
  }

  const staleCount = etfStatuses.filter((etf) => etf.daysOld !== null && etf.daysOld > 30).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>ETF Data Management</CardTitle>
            <CardDescription>
              Manage ETF breakdown data from justETF (cached for 30 days)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!showDetails && (
              <Button variant="outline" onClick={loadETFStatus} disabled={isLoadingStatus}>
                {isLoadingStatus ? 'Loading...' : 'View Status'}
              </Button>
            )}
            <Button onClick={handleRefreshAll} disabled={isRefreshing}>
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh All ETFs
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mb-4 p-3 rounded-md border ${
              statusMessage.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : statusMessage.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <p className="text-sm">{statusMessage.message}</p>
          </div>
        )}

        {showDetails ? (
          etfStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No ETFs found in portfolio
            </p>
          ) : (
            <>
              {staleCount > 0 && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <p className="text-sm text-orange-800">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    {staleCount} ETF{staleCount > 1 ? 's' : ''} with data older than 30 days
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {etfStatuses.map((etf) => (
                  <div
                    key={etf.ticker}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(etf.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{etf.ticker}</span>
                          {getStatusBadge(etf)}
                        </div>
                        <div className="text-sm text-muted-foreground">{etf.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          £
                          {etf.marketValue.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                    </div>
                    {etf.isin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshSingle(etf.ticker, etf.isin as string)}
                        className="ml-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Click "View Status" to see ETF data freshness
          </p>
        )}
      </CardContent>
    </Card>
  )
}
