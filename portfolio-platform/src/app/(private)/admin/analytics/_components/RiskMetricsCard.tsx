'use client'

import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface RiskMetricsCardProps {
  metrics: {
    sharpeRatio: number | null
    maxDrawdown: number | null
    volatility: number | null
    var95: number | null
    cvar95: number | null
  } | null
}

export function RiskMetricsCard({ metrics }: RiskMetricsCardProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Metrics</CardTitle>
          <CardDescription>Portfolio risk analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not enough historical data to calculate risk metrics
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Metrics</CardTitle>
        <CardDescription>Portfolio risk and volatility analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Sharpe Ratio */}
          <div className="p-4 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Sharpe Ratio</span>
            </div>
            <div className="text-2xl font-bold">
              {metrics.sharpeRatio !== null ? metrics.sharpeRatio.toFixed(2) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Risk-adjusted return</p>
          </div>

          {/* Max Drawdown */}
          <div className="p-4 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Max Drawdown</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {metrics.maxDrawdown !== null ? `${(metrics.maxDrawdown * 100).toFixed(2)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Largest peak-to-trough decline</p>
          </div>

          {/* Volatility */}
          <div className="p-4 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Volatility (σ)</span>
            </div>
            <div className="text-2xl font-bold">
              {metrics.volatility !== null ? `${(metrics.volatility * 100).toFixed(2)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Annual standard deviation</p>
          </div>

          {/* Value at Risk (95%) */}
          <div className="p-4 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">VaR (95%)</span>
            </div>
            <div className="text-2xl font-bold">
              {metrics.var95 !== null ? `${(metrics.var95 * 100).toFixed(2)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum 1-day loss (95% confidence)
            </p>
          </div>
        </div>

        {/* Interpretation guide */}
        <div className="mt-6 p-3 bg-muted/50 rounded-md">
          <h4 className="text-sm font-semibold mb-2">Interpretation</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              • <strong>Sharpe Ratio:</strong> &gt;1 is good, &gt;2 is excellent, &gt;3 is
              exceptional
            </li>
            <li>
              • <strong>Max Drawdown:</strong> Lower is better (indicates resilience in downturns)
            </li>
            <li>
              • <strong>Volatility:</strong> Lower indicates more stable returns
            </li>
            <li>
              • <strong>VaR 95%:</strong> Expected maximum loss on 95% of trading days
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
