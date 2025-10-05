'use client'

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

type Position = {
  ticker: string
  name: string
  market_value: number | null
  sector: string | null
}

type CryptoPosition = {
  symbol: string
  market_value: number | null
}

interface DiversificationMetricsProps {
  positions: Position[]
  cryptoPositions: CryptoPosition[]
}

export function DiversificationMetrics({
  positions,
  cryptoPositions,
}: DiversificationMetricsProps) {
  // Calculate total portfolio value
  const totalValue =
    positions.reduce((sum, p) => sum + (p.market_value || 0), 0) +
    cryptoPositions.reduce((sum, c) => sum + (c.market_value || 0), 0)

  if (totalValue === 0) return null

  // Calculate largest holding concentration
  const allHoldings = [
    ...positions.map((p) => ({ symbol: p.ticker, value: p.market_value || 0 })),
    ...cryptoPositions.map((c) => ({ symbol: c.symbol, value: c.market_value || 0 })),
  ].sort((a, b) => b.value - a.value)

  const largestHolding = allHoldings[0]
  const largestHoldingPct = (largestHolding.value / totalValue) * 100

  // Calculate sector concentration
  const sectorTotals: Record<string, number> = {}
  for (const position of positions) {
    if (position.sector) {
      sectorTotals[position.sector] =
        (sectorTotals[position.sector] || 0) + (position.market_value || 0)
    }
  }

  const largestSector = Object.entries(sectorTotals).sort((a, b) => b[1] - a[1])[0]
  const largestSectorPct = largestSector ? (largestSector[1] / totalValue) * 100 : 0

  // Calculate diversification score (0-100)
  // Based on number of holdings and concentration metrics
  const numHoldings = allHoldings.filter((h) => h.value > 0).length
  const holdingsScore = Math.min(numHoldings / 20, 1) * 40 // Max 40 points for 20+ holdings
  const concentrationScore = Math.max(0, 100 - largestHoldingPct) * 0.3 // Max 30 points for low concentration
  const sectorScore = Math.max(0, 100 - largestSectorPct) * 0.3 // Max 30 points for low sector concentration
  const diversificationScore = Math.round(holdingsScore + concentrationScore + sectorScore)

  // Determine risk level
  const getRiskLevel = (score: number) => {
    if (score >= 70)
      return {
        label: 'Well Diversified',
        color: 'text-green-600 dark:text-green-400',
        icon: CheckCircle2,
      }
    if (score >= 50)
      return {
        label: 'Moderately Diversified',
        color: 'text-blue-600 dark:text-blue-400',
        icon: Info,
      }
    return {
      label: 'Concentrated Portfolio',
      color: 'text-amber-600 dark:text-amber-400',
      icon: AlertTriangle,
    }
  }

  const riskLevel = getRiskLevel(diversificationScore)
  const RiskIcon = riskLevel.icon

  // Warnings
  const warnings: string[] = []
  if (largestHoldingPct > 30) {
    warnings.push(
      `Largest holding (${largestHolding.symbol}) represents ${largestHoldingPct.toFixed(1)}% of portfolio`
    )
  }
  if (largestSectorPct > 50 && largestSector) {
    warnings.push(
      `${largestSector[0]} sector represents ${largestSectorPct.toFixed(1)}% of portfolio`
    )
  }
  if (numHoldings < 10) {
    warnings.push(
      `Portfolio contains only ${numHoldings} holdings - consider adding more for diversification`
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Diversification Analysis</h3>

      {/* Diversification Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Diversification Score</span>
          <div className="flex items-center gap-2">
            <RiskIcon className={`h-4 w-4 ${riskLevel.color}`} />
            <span className={`text-sm font-medium ${riskLevel.color}`}>{riskLevel.label}</span>
          </div>
        </div>
        <div className="relative h-4 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all"
            style={{ width: `${diversificationScore}%` }}
          />
        </div>
        <p className="text-2xl font-bold mt-2">{diversificationScore}/100</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Holdings</p>
          <p className="text-xl font-semibold">{numHoldings}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Largest Holding</p>
          <p className="text-xl font-semibold">{largestHoldingPct.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{largestHolding.symbol}</p>
        </div>
        {largestSector && (
          <div>
            <p className="text-sm text-muted-foreground">Largest Sector</p>
            <p className="text-xl font-semibold">{largestSectorPct.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{largestSector[0]}</p>
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-900 dark:text-amber-100">{warning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
