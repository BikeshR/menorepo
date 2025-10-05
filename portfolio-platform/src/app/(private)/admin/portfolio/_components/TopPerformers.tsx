'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import Link from 'next/link'

type Position = {
  ticker: string
  name: string
  asset_type: string
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
}

type CryptoPosition = {
  symbol: string
  name: string | null
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
}

interface TopPerformersProps {
  positions: Position[]
  cryptoPositions: CryptoPosition[]
}

export function TopPerformers({ positions, cryptoPositions }: TopPerformersProps) {
  // Combine all holdings and filter out those without gain/loss data
  const allHoldings = [
    ...positions.map((p) => ({
      symbol: p.ticker,
      name: p.name,
      type: p.asset_type,
      value: p.market_value || 0,
      gainLoss: p.gain_loss || 0,
      gainLossPct: p.gain_loss_pct || 0,
    })),
    ...cryptoPositions.map((c) => ({
      symbol: c.symbol,
      name: c.name || c.symbol,
      type: 'crypto',
      value: c.market_value || 0,
      gainLoss: c.gain_loss || 0,
      gainLossPct: c.gain_loss_pct || 0,
    })),
  ].filter((h) => h.value > 0)

  // Sort by gain/loss percentage
  const sorted = [...allHoldings].sort((a, b) => b.gainLossPct - a.gainLossPct)

  // Get top 5 gainers and top 5 losers
  const topGainers = sorted.slice(0, 5)
  const topLosers = sorted.slice(-5).reverse()

  if (allHoldings.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Gainers */}
      <div className="border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold">Top Gainers</h3>
        </div>
        <div className="space-y-3">
          {topGainers.map((holding) => (
            <Link
              key={holding.symbol}
              href={`/admin/portfolio/${encodeURIComponent(holding.symbol)}`}
              className="flex items-center justify-between hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
            >
              <div className="flex-1">
                <p className="font-medium">{holding.symbol}</p>
                <p className="text-sm text-muted-foreground truncate">{holding.name}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600 dark:text-green-400">
                  +{holding.gainLossPct.toFixed(2)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  £
                  {Math.abs(holding.gainLoss).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-semibold">Top Losers</h3>
        </div>
        <div className="space-y-3">
          {topLosers.map((holding) => (
            <Link
              key={holding.symbol}
              href={`/admin/portfolio/${encodeURIComponent(holding.symbol)}`}
              className="flex items-center justify-between hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
            >
              <div className="flex-1">
                <p className="font-medium">{holding.symbol}</p>
                <p className="text-sm text-muted-foreground truncate">{holding.name}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {holding.gainLossPct.toFixed(2)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  £
                  {Math.abs(holding.gainLoss).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
