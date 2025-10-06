'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SectorBreakdownChartProps {
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

const COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#65a30d',
  '#059669',
  '#0891b2',
  '#4f46e5',
]

export function SectorBreakdownChart({ data }: SectorBreakdownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sector Allocation</CardTitle>
        <CardDescription>Portfolio distribution across sectors</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props: PieLabelProps) => {
                const entry = data[props.index]
                return `${entry.name} ${entry.percentage.toFixed(1)}%`
              }}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
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

        {/* Table view */}
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-semibold">Sector Details</h4>
          <div className="space-y-2">
            {data.map((sector, index) => (
              <div
                key={sector.name}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{sector.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({sector.holdings} holdings)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    £
                    {sector.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sector.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
