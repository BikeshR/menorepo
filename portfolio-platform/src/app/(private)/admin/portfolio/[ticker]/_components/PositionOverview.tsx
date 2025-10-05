import { TrendingDown, TrendingUp } from 'lucide-react'
import { calculatePositionIRR } from '@/lib/utils/irr'

type StockPosition = {
  ticker: string
  name: string
  quantity: number
  average_cost: number | null
  current_price: number | null
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
  currency: string | null
  sector: string | null
  country: string | null
  region: string | null
}

type CryptoPosition = {
  symbol: string
  name: string | null
  quantity: number
  average_cost: number | null
  current_price: number | null
  market_value: number | null
  gain_loss: number | null
  gain_loss_pct: number | null
}

type Transaction = {
  id: string
  transaction_type: string
  total_value: number
  executed_at: string
}

interface PositionOverviewProps {
  position: StockPosition | CryptoPosition
  type: 'stock' | 'crypto'
  transactions?: Transaction[]
}

export function PositionOverview({ position, type, transactions = [] }: PositionOverviewProps) {
  const isStock = type === 'stock'
  const stockPosition = isStock ? (position as StockPosition) : null

  const marketValue = position.market_value || 0
  const gainLoss = position.gain_loss || 0
  const gainLossPct = position.gain_loss_pct || 0
  const currentPrice = position.current_price || 0
  const averageCost = position.average_cost || 0

  const currency = isStock ? stockPosition?.currency || 'GBP' : 'USD'
  const currencySymbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'

  const isProfit = gainLoss >= 0

  // Calculate position IRR if transactions available
  const positionIRR =
    transactions.length > 0 ? calculatePositionIRR(transactions, marketValue) : null
  const irrDisplay = positionIRR !== null ? `${(positionIRR * 100).toFixed(2)}%` : 'N/A'

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Market Value */}
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Market Value</p>
        <p className="text-2xl font-bold">
          {currencySymbol}
          {marketValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>

      {/* Quantity */}
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Quantity</p>
        <p className="text-2xl font-bold">
          {position.quantity.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">shares</p>
      </div>

      {/* Current Price */}
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Current Price</p>
        <p className="text-2xl font-bold">
          {currencySymbol}
          {currentPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Avg: {currencySymbol}
          {averageCost.toFixed(2)}
        </p>
      </div>

      {/* Gain/Loss */}
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
        <div className="flex items-center gap-2">
          {isProfit ? (
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
          <p
            className={`text-2xl font-bold ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {gainLoss >= 0 ? '+' : ''}
            {currencySymbol}
            {Math.abs(gainLoss).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <p
          className={`text-sm font-medium ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {gainLossPct >= 0 ? '+' : ''}
          {gainLossPct.toFixed(2)}%
        </p>
      </div>

      {/* IRR */}
      {transactions.length > 0 && (
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">
            IRR
            <span className="ml-1 text-xs">(Annualized)</span>
          </p>
          <p
            className={`text-2xl font-bold ${
              positionIRR !== null && positionIRR >= 0
                ? 'text-green-600 dark:text-green-400'
                : positionIRR !== null
                  ? 'text-red-600 dark:text-red-400'
                  : ''
            }`}
          >
            {irrDisplay}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            From {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Stock-specific metadata */}
      {isStock && stockPosition && (
        <>
          {stockPosition.sector && (
            <div className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground">Sector</p>
              <p className="text-lg font-semibold">{stockPosition.sector}</p>
            </div>
          )}
          {stockPosition.country && (
            <div className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground">Country</p>
              <p className="text-lg font-semibold">{stockPosition.country}</p>
              {stockPosition.region && (
                <p className="text-xs text-muted-foreground mt-1">{stockPosition.region}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
