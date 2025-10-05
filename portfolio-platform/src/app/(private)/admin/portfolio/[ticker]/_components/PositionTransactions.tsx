import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

type Transaction = {
  id: string
  transaction_type: string
  quantity: number
  price: number
  total_value: number
  currency: string
  executed_at: string
}

interface PositionTransactionsProps {
  transactions: Transaction[]
}

export function PositionTransactions({ transactions }: PositionTransactionsProps) {
  if (transactions.length === 0) {
    return null
  }

  // Calculate total bought/sold
  const totalBought = transactions
    .filter((t) => t.transaction_type === 'buy')
    .reduce((sum, t) => sum + t.quantity, 0)

  const totalSold = transactions
    .filter((t) => t.transaction_type === 'sell')
    .reduce((sum, t) => sum + t.quantity, 0)

  const totalInvested = transactions
    .filter((t) => t.transaction_type === 'buy')
    .reduce((sum, t) => sum + t.total_value, 0)

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Transaction History</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">Total Bought</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {totalBought.toFixed(2)}
          </p>
        </div>
        <div className="border rounded-lg p-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">Total Sold</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {totalSold.toFixed(2)}
          </p>
        </div>
        <div className="border rounded-lg p-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">Total Invested</p>
          <p className="text-lg font-bold">
            £{totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 text-sm font-semibold">Date</th>
              <th className="text-left py-2 px-3 text-sm font-semibold">Type</th>
              <th className="text-right py-2 px-3 text-sm font-semibold">Quantity</th>
              <th className="text-right py-2 px-3 text-sm font-semibold">Price</th>
              <th className="text-right py-2 px-3 text-sm font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const isBuy = tx.transaction_type === 'buy'
              const date = new Date(tx.executed_at)
              const currencySymbol = tx.currency === 'GBP' ? '£' : tx.currency === 'EUR' ? '€' : '$'

              return (
                <tr key={tx.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-3 text-sm">
                    {date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {isBuy ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span
                        className={`text-sm font-medium ${isBuy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                      >
                        {isBuy ? 'BUY' : 'SELL'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-sm">{tx.quantity.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-sm">
                    {currencySymbol}{tx.price.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-sm font-medium">
                    {currencySymbol}{tx.total_value.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
