'use client'

import { BadgeDollarSign, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TaxTrackingCardProps {
  data: {
    summary: {
      shortTermGains: number
      shortTermLosses: number
      longTermGains: number
      longTermLosses: number
      netShortTerm: number
      netLongTerm: number
    }
    positions: Array<{
      ticker: string
      name: string
      gainLoss: number
      holdingPeriod: number | null
      holdingCategory: string
      acquisitionDate: string | null
      marketValue: number
    }>
    harvestingOpportunities: Array<{
      ticker: string
      gainLoss: number
      holdingCategory: string
    }>
  } | null
}

export function TaxTrackingCard({ data }: TaxTrackingCardProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tax Tracking</CardTitle>
          <CardDescription>Capital gains and tax optimization</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No tax data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Tracking</CardTitle>
        <CardDescription>Capital gains analysis and holding periods</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <BadgeDollarSign className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Short-term (&lt;1 year)</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gains:</span>
                <span className="text-green-600 font-medium">
                  £{data.summary.shortTermGains.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Losses:</span>
                <span className="text-red-600 font-medium">
                  £{data.summary.shortTermLosses.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-1">
                <span>Net:</span>
                <span
                  className={data.summary.netShortTerm >= 0 ? 'text-green-600' : 'text-red-600'}
                >
                  £{data.summary.netShortTerm.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Long-term (&gt;1 year)</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gains:</span>
                <span className="text-green-600 font-medium">
                  £{data.summary.longTermGains.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Losses:</span>
                <span className="text-red-600 font-medium">
                  £{data.summary.longTermLosses.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-1">
                <span>Net:</span>
                <span className={data.summary.netLongTerm >= 0 ? 'text-green-600' : 'text-red-600'}>
                  £{data.summary.netLongTerm.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Loss Harvesting Opportunities */}
        {data.harvestingOpportunities.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Tax Loss Harvesting Opportunities</h4>
            <div className="space-y-2">
              {data.harvestingOpportunities.map((opp) => (
                <div
                  key={opp.ticker}
                  className="flex items-center justify-between p-2 rounded-md border"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{opp.ticker}</span>
                    <Badge variant={opp.holdingCategory === 'Short-term' ? 'secondary' : 'outline'}>
                      {opp.holdingCategory}
                    </Badge>
                  </div>
                  <span className="text-red-600 font-medium text-sm">
                    £{Math.abs(opp.gainLoss).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Selling these positions can offset capital gains and reduce tax liability
            </p>
          </div>
        )}

        {/* Holdings by Period */}
        <div>
          <h4 className="text-sm font-semibold mb-3">All Holdings by Holding Period</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Ticker</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Acquisition</TableHead>
                  <TableHead className="text-right">Days Held</TableHead>
                  <TableHead className="text-right">Gain/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.positions.map((position) => (
                  <TableRow key={position.ticker}>
                    <TableCell className="font-medium">{position.ticker}</TableCell>
                    <TableCell>
                      <Badge
                        variant={position.holdingCategory === 'Long-term' ? 'default' : 'secondary'}
                      >
                        {position.holdingCategory}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {position.acquisitionDate
                        ? new Date(position.acquisitionDate).toLocaleDateString()
                        : 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {position.holdingPeriod !== null ? position.holdingPeriod : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium ${position.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        £{position.gainLoss.toLocaleString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Tax info */}
        <div className="p-3 bg-muted/50 rounded-md">
          <h4 className="text-sm font-semibold mb-2">Tax Treatment</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              • <strong>Short-term gains</strong> (&lt;1 year): Taxed as ordinary income
            </li>
            <li>
              • <strong>Long-term gains</strong> (&gt;1 year): Preferential capital gains tax rates
            </li>
            <li>
              • <strong>Tax loss harvesting:</strong> Losses can offset gains + £3,000 ordinary
              income
            </li>
            <li>• Consult a tax professional for personalized advice</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
