'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface IndustryBreakdownTableProps {
  data: Array<{
    industry: string
    sector: string
    value: number
    allocation: number
    holdings: number
    tickers: string[]
  }>
}

export function IndustryBreakdownTable({ data }: IndustryBreakdownTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Industry Breakdown</CardTitle>
        <CardDescription>Detailed view by industry classification</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.slice(0, 15).map((industry) => (
            <div
              key={industry.industry}
              className="p-3 rounded-md border bg-card hover:bg-muted/50"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-sm">{industry.industry}</div>
                  <div className="text-xs text-muted-foreground">{industry.sector}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    £
                    {industry.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {industry.allocation.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {industry.tickers.map((ticker) => (
                  <Badge key={ticker} variant="secondary" className="text-xs">
                    {ticker}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
