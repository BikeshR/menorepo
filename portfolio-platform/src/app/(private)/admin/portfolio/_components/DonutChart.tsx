'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface DonutChartProps {
  data: Array<{
    name: string
    value: number
    color: string
  }>
  title: string
  showPercentage?: boolean
}

const CustomTooltip = ({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: Array<{ payload: { name: string; value: number } }>
  total: number
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const percentage = ((data.value / total) * 100).toFixed(1)
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-semibold">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          £
          {data.value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="text-sm font-medium">{percentage}%</p>
      </div>
    )
  }
  return null
}

export function DonutChart({ data, title, showPercentage = true }: DonutChartProps) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0)

  // Filter out zero values
  const filteredData = data.filter((entry) => entry.value > 0)

  if (filteredData.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No data available
        </div>
      </div>
    )
  }

  const renderCustomLabel = (props: {
    cx?: string | number
    cy?: string | number
    midAngle?: number
    innerRadius?: number
    outerRadius?: number
    percent?: number
  }) => {
    const cx = typeof props.cx === 'number' ? props.cx : 0
    const cy = typeof props.cy === 'number' ? props.cy : 0
    const { midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props
    if (percent < 0.05) return null // Don't show label if less than 5%

    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={filteredData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showPercentage ? renderCustomLabel : undefined}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            paddingAngle={2}
          >
            {filteredData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip total={total} />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => {
              if (!entry.payload) return value
              const percentage = ((entry.payload.value / total) * 100).toFixed(1)
              return `${value} (${percentage}%)`
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
