'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

type CryptoPosition = {
  asset_code: string
  symbol: string
  name: string | null
  quantity: number
  average_cost: number | null
  current_price: number | null
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
}

interface CryptoTableProps {
  positions: CryptoPosition[]
}

export function CryptoTable({ positions }: CryptoTableProps) {
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
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const isPositive = (position.gain_loss || 0) >= 0
            return (
              <tr key={position.asset_code} className="border-b hover:bg-muted/50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{position.symbol}</span>
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      CRYPTO
                    </span>
                  </div>
                </td>
                <td className="p-3 max-w-xs truncate">{position.name || position.symbol}</td>
                <td className="p-3 text-right font-mono">
                  {position.quantity.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                  })}
                </td>
                <td className="p-3 text-right font-mono">
                  ${position.average_cost?.toFixed(2) || '0.00'}
                </td>
                <td className="p-3 text-right font-mono">
                  ${position.current_price?.toFixed(2) || '0.00'}
                </td>
                <td className="p-3 text-right font-mono font-semibold">
                  $
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
                        {isPositive ? '+' : ''}${Math.abs(position.gain_loss || 0).toFixed(2)}
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
