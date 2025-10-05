'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface BenchmarkComparisonProps {
  metrics: {
    volatility: number
    beta: number
    averageReturn: number
    totalReturn: number
    sharpeRatio: number
    var95: number
    var99: number
    cvar95: number
  }
  portfolioData: Array<{
    date: string
    portfolioValue: number
    benchmarkValue: number
  }>
  currencySymbol?: string
}

export function BenchmarkComparison({
  metrics,
  portfolioData,
  currencySymbol = '£',
}: BenchmarkComparisonProps) {
  // Normalize data to percentage change from first value
  const normalizedData = portfolioData.map((d, i) => {
    if (i === 0) {
      return {
        date: d.date,
        portfolio: 0,
        benchmark: 0,
      }
    }

    const portfolioChange =
      ((d.portfolioValue - portfolioData[0].portfolioValue) / portfolioData[0].portfolioValue) *
      100
    const benchmarkChange =
      ((d.benchmarkValue - portfolioData[0].benchmarkValue) / portfolioData[0].benchmarkValue) *
      100

    return {
      date: d.date,
      portfolio: portfolioChange,
      benchmark: benchmarkChange,
    }
  })

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{
      name: string
      value: number
      color: string
      payload: {
        date: string
        portfolio: number
        benchmark: number
      }
    }>
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold mb-1">{payload[0]?.payload?.date}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value >= 0 ? '+' : ''}
              {entry.value.toFixed(2)}%
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Benchmark Comparison (vs S&P 500)</h3>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Beta</p>
          <p className="text-2xl font-bold">
            {metrics.beta.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.beta > 1 ? 'More volatile' : metrics.beta < 1 ? 'Less volatile' : 'Same volatility'}
          </p>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Volatility</p>
          <p className="text-2xl font-bold">{metrics.volatility.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">Annualized</p>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
          <p className="text-2xl font-bold">{metrics.sharpeRatio.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.sharpeRatio > 1 ? 'Good' : metrics.sharpeRatio > 0 ? 'Fair' : 'Poor'}
          </p>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Total Return</p>
          <div className="flex items-center gap-1">
            {metrics.totalReturn >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <p
              className={`text-2xl font-bold ${
                metrics.totalReturn >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {metrics.totalReturn >= 0 ? '+' : ''}
              {metrics.totalReturn.toFixed(2)}%
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Period return</p>
        </div>
      </div>

      {/* Risk Metrics - VaR */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3">Risk Metrics (Value at Risk)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-muted-foreground">VaR (95%)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {metrics.var95.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Daily loss threshold</p>
          </div>

          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-muted-foreground">VaR (99%)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {metrics.var99.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Extreme loss threshold</p>
          </div>

          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-muted-foreground">CVaR (95%)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {metrics.cvar95.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Expected shortfall</p>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={normalizedData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value)
              return `${date.getMonth() + 1}/${date.getDate()}`
            }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="portfolio"
            name="Your Portfolio"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            name="S&P 500"
            stroke="hsl(142, 71%, 45%)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Interpretation */}
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <h4 className="text-sm font-semibold mb-2">What does this mean?</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            <strong>Beta:</strong> Measures portfolio volatility relative to S&P 500.{' '}
            {metrics.beta > 1
              ? `Your portfolio is ${((metrics.beta - 1) * 100).toFixed(0)}% more volatile than the market.`
              : metrics.beta < 1
                ? `Your portfolio is ${((1 - metrics.beta) * 100).toFixed(0)}% less volatile than the market.`
                : 'Your portfolio moves in sync with the market.'}
          </li>
          <li>
            <strong>Sharpe Ratio:</strong> Risk-adjusted return (higher is better). Above 1 is good, above
            2 is excellent.
          </li>
          <li>
            <strong>Volatility:</strong> Annualized standard deviation of returns. Lower means more stable.
          </li>
          <li>
            <strong>VaR (95%):</strong> Maximum expected daily loss that won't be exceeded 95% of the time.
            There's a 5% chance of losing more than this on any given day.
          </li>
          <li>
            <strong>VaR (99%):</strong> Maximum expected daily loss that won't be exceeded 99% of the time.
            This represents extreme market conditions.
          </li>
          <li>
            <strong>CVaR (Expected Shortfall):</strong> Average loss when VaR threshold is breached.
            This gives you a better idea of potential losses in worst-case scenarios.
          </li>
        </ul>
      </div>
    </div>
  )
}
