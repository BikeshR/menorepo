'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Snapshot = {
  snapshot_date: string
  total_value: number
  total_cost_basis: number | null
  total_gain_loss: number | null
  total_return_pct: number | null
}

interface PerformanceChartProps {
  snapshots: Snapshot[]
  currencySymbol?: string
}

export function PerformanceChart({ snapshots, currencySymbol = '£' }: PerformanceChartProps) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">
          No historical data available yet. Sync your portfolio daily to build performance history.
        </p>
      </div>
    )
  }

  // Transform data for the chart
  const chartData = snapshots.map((snapshot) => ({
    date: new Date(snapshot.snapshot_date).toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
    }),
    value: snapshot.total_value,
    costBasis: snapshot.total_cost_basis || 0,
    gainLoss: snapshot.total_gain_loss || 0,
  }))

  // Determine if portfolio is overall positive or negative
  const latestSnapshot = snapshots[snapshots.length - 1]
  const isPositive = (latestSnapshot?.total_gain_loss || 0) >= 0

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Portfolio Performance</h3>
        <div className="text-sm text-muted-foreground">Last {snapshots.length} days</div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickLine={{ stroke: 'currentColor' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickLine={{ stroke: 'currentColor' }}
              tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              formatter={(value: number) => [
                `${currencySymbol}${value.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
                'Value',
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="costBasis"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Portfolio Value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-12 border-t-2 border-dashed border-muted-foreground" />
          <span>Cost Basis</span>
        </div>
      </div>
    </div>
  )
}
