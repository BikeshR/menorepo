'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TopHoldingsTableProps {
  data: Array<{
    ticker: string
    name: string
    value: number
    percentage: number
    sector: string | null
    gainLoss: number
    gainLossPct: number
  }>
}

export function TopHoldingsTable({ data }: TopHoldingsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Holdings</CardTitle>
        <CardDescription>Largest positions by portfolio weight</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Ticker</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((holding) => (
                <TableRow key={holding.ticker}>
                  <TableCell className="font-medium">{holding.ticker}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{holding.name}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {holding.sector || 'Unknown'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    £
                    {holding.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {holding.percentage.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className={`flex items-center justify-end gap-1 ${holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {holding.gainLoss >= 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      <span className="font-medium">{holding.gainLossPct.toFixed(2)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
