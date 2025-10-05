'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type StockHistory = {
  snapshot_date: string
  market_value: number
  price: number
  quantity: number
}

type CryptoHistory = {
  snapshot_date: string
  market_value: number
  price: number
  quantity: number
}

interface PositionChartProps {
  history: StockHistory[] | CryptoHistory[]
  type: 'stock' | 'crypto'
  ticker: string
}

export function PositionChart({ history, type, ticker }: PositionChartProps) {
  if (history.length === 0) {
    return null
  }

  // Format data for chart
  const chartData = history.map((h) => ({
    date: h.snapshot_date,
    value: h.market_value,
    price: h.price,
  }))

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
        value: number
        price: number
      }
    }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold mb-1">{data.date}</p>
          <p className="text-sm">
            Value: £{data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground">
            Price: £{data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Position History (Last 90 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
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
            tickFormatter={(value) => `£${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            name="Market Value"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
