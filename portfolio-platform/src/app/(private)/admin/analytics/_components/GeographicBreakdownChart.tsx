'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface GeographicBreakdownChartProps {
  data: Array<{
    region: string
    value: number
    percentage: number
    holdings: number
    countries: string[]
  }>
}

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#65a30d']

export function GeographicBreakdownChart({ data }: GeographicBreakdownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Diversification</CardTitle>
        <CardDescription>Portfolio distribution across regions</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="region" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [
                `£${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                'Value',
              ]}
            />
            <Legend />
            <Bar dataKey="value" name="Portfolio Value" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${entry.region}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Details table */}
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-semibold">Regional Details</h4>
          <div className="space-y-2">
            {data.map((region, index) => (
              <div
                key={region.region}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{region.region}</span>
                  </div>
                  <div className="ml-5 text-xs text-muted-foreground">
                    {region.countries.join(', ')} • {region.holdings} holdings
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    £
                    {region.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {region.percentage.toFixed(1)}%
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
