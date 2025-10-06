'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AssetAllocationChartProps {
  data: Array<{
    name: string
    value: number
    percentage: number
    holdings: number
  }>
}

interface PieLabelProps {
  index: number
}

const ASSET_COLORS: Record<string, string> = {
  STOCK: '#2563eb',
  ETF: '#7c3aed',
  CRYPTO: '#ea580c',
}

export function AssetAllocationChart({ data }: AssetAllocationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
        <CardDescription>Distribution by asset type</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
              label={(props: PieLabelProps) => {
                const entry = data[props.index]
                return `${entry.name} ${entry.percentage.toFixed(1)}%`
              }}
            >
              {data.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={ASSET_COLORS[entry.name] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `£${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                'Value',
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        {/* Details */}
        <div className="mt-4 grid grid-cols-1 gap-2">
          {data.map((asset) => (
            <div
              key={asset.name}
              className="flex items-center justify-between p-2 rounded-md bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: ASSET_COLORS[asset.name] || '#94a3b8' }}
                />
                <span className="text-sm font-medium">{asset.name}</span>
                <span className="text-xs text-muted-foreground">({asset.holdings} holdings)</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">
                  £
                  {asset.value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-muted-foreground">{asset.percentage.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
