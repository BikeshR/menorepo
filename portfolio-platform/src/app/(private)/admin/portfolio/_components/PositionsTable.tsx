'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

type Position = {
  ticker: string
  name: string
  asset_type: string
  quantity: number
  average_cost: number | null
  current_price: number | null
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
  exchange: string | null
  country: string | null
  sector: string | null
  currency: string | null
}

interface PositionsTableProps {
  positions: Position[]
}

// Currency symbol mapping
const getCurrencySymbol = (currency: string | null): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    GBP: '£',
    EUR: '€',
    JPY: '¥',
    CHF: 'CHF ',
    CAD: 'CA$',
    AUD: 'A$',
    NZD: 'NZ$',
    SEK: 'kr ',
    NOK: 'kr ',
    DKK: 'kr ',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft ',
    ZAR: 'R',
    ILS: '₪',
  }
  return symbols[currency || ''] || currency || '$'
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3 font-semibold">Symbol</th>
            <th className="text-left p-3 font-semibold">Name</th>
            <th className="text-right p-3 font-semibold">Quantity</th>
            <th className="text-right p-3 font-semibold">Avg Cost</th>
            <th className="text-right p-3 font-semibold">Price</th>
            <th className="text-right p-3 font-semibold">Value</th>
            <th className="text-right p-3 font-semibold">Gain/Loss</th>
            <th className="text-left p-3 font-semibold">Country</th>
            <th className="text-left p-3 font-semibold">Sector</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const isPositive = (position.gain_loss || 0) >= 0
            const currencySymbol = getCurrencySymbol(position.currency)
            return (
              <tr key={position.ticker} className="border-b hover:bg-muted/50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{position.ticker.split('_')[0]}</span>
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      {position.asset_type.toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="p-3 max-w-xs truncate">{position.name}</td>
                <td className="p-3 text-right font-mono">{position.quantity.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">
                  {currencySymbol}
                  {position.average_cost?.toFixed(2) || '0.00'}
                </td>
                <td className="p-3 text-right font-mono">
                  {currencySymbol}
                  {position.current_price?.toFixed(2) || '0.00'}
                </td>
                <td className="p-3 text-right font-mono font-semibold">
                  {currencySymbol}
                  {position.market_value?.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || '0.00'}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-right">
                      <div
                        className={`font-mono font-semibold ${
                          isPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {currencySymbol}
                        {Math.abs(position.gain_loss || 0).toFixed(2)}
                      </div>
                      <div
                        className={`text-xs ${
                          isPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {(position.gain_loss_pct || 0).toFixed(2)}%
                      </div>
                    </div>
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                </td>
                <td className="p-3 text-sm">{position.country || position.exchange || '-'}</td>
                <td className="p-3 text-sm">{position.sector || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
