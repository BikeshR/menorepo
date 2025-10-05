'use client'

import { RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { calculatePortfolioIRR } from '@/lib/utils/irr'
import { enrichStockSectorData, syncKrakenPortfolio, syncTradingPortfolio } from '../actions'
import { AllocationTreemap } from './AllocationTreemap'
import { CryptoTable } from './CryptoTable'
import { PositionsTable } from './PositionsTable'

type Portfolio = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

type Snapshot = {
  id: string
  total_value: number
  total_cost_basis: number | null
  total_gain_loss: number | null
  total_return_pct: number | null
  cash_balance: number | null
  snapshot_date: string
  created_at: string
} | null

type Position = {
  id: string
  ticker: string
  name: string
  asset_type: string
  quantity: number
  average_cost: number | null
  current_price: number | null
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
  exchange: string | null
  country: string | null
  region: string | null
  sector: string | null
  currency: string | null
  last_synced_at: string | null
}

type CryptoPosition = {
  id: string
  asset_code: string
  symbol: string
  name: string | null
  quantity: number
  average_cost: number | null
  current_price: number | null
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
  last_synced_at: string | null
}

type SyncLog = {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  error_message: string | null
} | null

type Transaction = {
  id: string
  transaction_type: string
  total_value: number
  executed_at: string
}

interface PortfolioOverviewProps {
  portfolio: Portfolio
  latestSnapshot: Snapshot
  positions: Position[]
  cryptoPositions: CryptoPosition[]
  latestSync: SyncLog
  latestCryptoSync: SyncLog
  transactions?: Transaction[]
}

export function PortfolioOverview({
  latestSnapshot,
  positions,
  cryptoPositions,
  latestSync,
  transactions = [],
}: PortfolioOverviewProps) {
  const [isStocksPending, startStocksTransition] = useTransition()
  const [isCryptoPending, startCryptoTransition] = useTransition()
  const [isEnrichPending, startEnrichTransition] = useTransition()
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message?: string
  } | null>(null)

  const handleStocksSync = () => {
    setSyncResult(null)
    startStocksTransition(async () => {
      const result = await syncTradingPortfolio()
      setSyncResult(result)
    })
  }

  const handleCryptoSync = () => {
    setSyncResult(null)
    startCryptoTransition(async () => {
      const result = await syncKrakenPortfolio()
      setSyncResult(result)
    })
  }

  const handleEnrichSectors = () => {
    setSyncResult(null)
    startEnrichTransition(async () => {
      const result = await enrichStockSectorData(5)
      setSyncResult({
        success: result.success,
        message: result.message,
      })
    })
  }

  // Count stocks missing sector data
  const stocksWithoutSector = positions.filter((p) => !p.sector).length

  const totalValue = latestSnapshot?.total_value || 0
  const totalGainLoss = latestSnapshot?.total_gain_loss || 0
  const totalReturnPct = latestSnapshot?.total_return_pct || 0
  const cashBalance = latestSnapshot?.cash_balance || 0

  const isPositiveReturn = totalGainLoss >= 0
  const lastUpdated = latestSync?.completed_at
    ? new Date(latestSync.completed_at).toLocaleString()
    : 'Never'

  // Determine primary currency from positions (most common currency)
  // TODO: In Phase 2, implement multi-currency support with conversion to base currency
  const currencies = positions.map((p) => p.currency).filter(Boolean)
  const primaryCurrency = currencies.length > 0 ? currencies[0] : 'GBP'
  const currencySymbol = primaryCurrency === 'GBP' ? '£' : primaryCurrency === 'EUR' ? '€' : '$'

  // Calculate portfolio IRR if transactions available
  const portfolioIRR = transactions.length > 0 ? calculatePortfolioIRR(transactions, totalValue) : null
  const irrDisplay =
    portfolioIRR !== null ? `${(portfolioIRR * 100).toFixed(2)}%` : 'N/A'

  return (
    <div className="space-y-6">
      {/* Sync Status Banner */}
      {syncResult && (
        <div
          className={`p-4 rounded-lg border ${
            syncResult.success
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={
              syncResult.success
                ? 'text-green-900 dark:text-green-100'
                : 'text-red-900 dark:text-red-100'
            }
          >
            {syncResult.message}
          </p>
        </div>
      )}

      {/* Header with Sync Buttons */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          {stocksWithoutSector > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {stocksWithoutSector} stocks missing sector data
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleStocksSync}
            disabled={isStocksPending || isCryptoPending || isEnrichPending}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isStocksPending ? 'animate-spin' : ''}`} />
            {isStocksPending ? 'Syncing...' : 'Sync Stocks'}
          </Button>
          <Button
            onClick={handleCryptoSync}
            disabled={isStocksPending || isCryptoPending || isEnrichPending}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isCryptoPending ? 'animate-spin' : ''}`} />
            {isCryptoPending ? 'Syncing...' : 'Sync Crypto'}
          </Button>
          {stocksWithoutSector > 0 && (
            <Button
              onClick={handleEnrichSectors}
              disabled={isStocksPending || isCryptoPending || isEnrichPending}
              variant="secondary"
              className="gap-2"
            >
              <Sparkles className={`h-4 w-4 ${isEnrichPending ? 'animate-pulse' : ''}`} />
              {isEnrichPending ? 'Enriching...' : 'Add Sectors (5)'}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <div className="p-6 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Value</p>
          <p className="text-3xl font-bold">
            {currencySymbol}
            {totalValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cash: {currencySymbol}
            {cashBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Total Gain/Loss */}
        <div className="p-6 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Gain/Loss</p>
          <div className="flex items-center gap-2">
            <p
              className={`text-3xl font-bold ${
                isPositiveReturn
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {isPositiveReturn ? '+' : ''}
              {currencySymbol}
              {Math.abs(totalGainLoss).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            {isPositiveReturn ? (
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
          </div>
          <p
            className={`text-sm mt-1 ${
              isPositiveReturn
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isPositiveReturn ? '+' : ''}
            {totalReturnPct.toFixed(2)}%
          </p>
        </div>

        {/* Positions Count */}
        <div className="p-6 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground mb-1">Holdings</p>
          <p className="text-3xl font-bold">{positions.length + cryptoPositions.length}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {positions.filter((p) => p.asset_type === 'stock').length} Stocks,{' '}
            {positions.filter((p) => p.asset_type === 'etf').length} ETFs, {cryptoPositions.length}{' '}
            Crypto
          </p>
        </div>

        {/* IRR */}
        <div className="p-6 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground mb-1">
            IRR
            <span className="ml-1 text-xs">(Annualized)</span>
          </p>
          <p
            className={`text-3xl font-bold ${
              portfolioIRR !== null && portfolioIRR >= 0
                ? 'text-green-600 dark:text-green-400'
                : portfolioIRR !== null
                  ? 'text-red-600 dark:text-red-400'
                  : ''
            }`}
          >
            {irrDisplay}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {transactions.length > 0
              ? `From ${transactions.length} transactions`
              : 'No transactions yet'}
          </p>
        </div>
      </div>

      {/* Allocation Treemap */}
      {positions.length > 0 && (
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Portfolio Allocation</h2>
          <AllocationTreemap positions={positions} />
        </div>
      )}

      {/* Stock Positions Table */}
      {positions.length > 0 && (
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Stock & ETF Holdings</h2>
          <PositionsTable positions={positions} />
        </div>
      )}

      {/* Crypto Positions Table */}
      {cryptoPositions.length > 0 && (
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Crypto Holdings</h2>
          <CryptoTable positions={cryptoPositions} />
        </div>
      )}

      {/* Empty State */}
      {positions.length === 0 && cryptoPositions.length === 0 && (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">No Positions</h3>
          <p className="text-muted-foreground mb-4">
            Click "Sync Stocks" to fetch your positions from Trading212 or "Sync Crypto" to fetch
            from Kraken
          </p>
        </div>
      )}
    </div>
  )
}
