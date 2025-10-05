'use client'

import { ResponsiveContainer, Treemap } from 'recharts'

type Position = {
  ticker: string
  name: string
  market_value: number | null
  gain_loss_pct: number | null
}

interface AllocationTreemapProps {
  positions: Position[]
}

// Custom content component for treemap cells
function CustomContent(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  ticker?: string
  size?: number
  gainLossPct?: number
}) {
  const { x = 0, y = 0, width = 0, height = 0, ticker, size, gainLossPct = 0 } = props

  // Don't render if too small
  if (width < 40 || height < 30) return null

  const isPositive = gainLossPct >= 0
  const bgColor = isPositive
    ? 'hsl(142 76% 36%)' // green-600
    : 'hsl(0 84% 60%)' // red-500

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: bgColor,
          stroke: '#fff',
          strokeWidth: 2,
          opacity: 0.9,
        }}
      />
      {width > 80 && height > 50 && (
        <g>
          <text
            x={x + width / 2}
            y={y + height / 2 - 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={14}
            fontWeight="bold"
          >
            {ticker}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
          >
            ${((size || 0) / 1000).toFixed(1)}k
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 28}
            textAnchor="middle"
            fill="#fff"
            fontSize={11}
          >
            {isPositive ? '+' : ''}
            {gainLossPct.toFixed(1)}%
          </text>
        </g>
      )}
      {width >= 40 && width < 80 && height >= 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={10}
          fontWeight="bold"
        >
          {ticker}
        </text>
      )}
    </g>
  )
}

export function AllocationTreemap({ positions }: AllocationTreemapProps) {
  // Transform positions data for treemap
  const data = positions
    .filter((p) => p.market_value && p.market_value > 0)
    .map((p) => ({
      name: p.name || p.ticker,
      ticker: p.ticker,
      size: p.market_value || 0,
      gainLossPct: p.gain_loss_pct || 0,
    }))
    .sort((a, b) => b.size - a.size)

  if (data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-muted-foreground">
        No allocation data available
      </div>
    )
  }

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          stroke="#fff"
          fill="#8884d8"
          content={<CustomContent />}
        />
      </ResponsiveContainer>
    </div>
  )
}
