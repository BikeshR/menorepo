'use client'

import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { syncTransactionHistory } from '../actions'

type Transaction = {
  id: string
  ticker: string
  asset_name: string | null
  asset_type: string
  transaction_type: string
  quantity: number
  price: number
  total_value: number
  fee: number | null
  currency: string
  executed_at: string
  source: string
}

interface TransactionHistoryProps {
  initialTransactions: Transaction[]
}

export function TransactionHistory({ initialTransactions }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncMessage(null)

    try {
      const result = await syncTransactionHistory(200)

      if (result.success) {
        setSyncMessage(result.message)
        // Refresh the page to show new transactions
        window.location.reload()
      } else {
        setSyncMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      setSyncMessage(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Transaction History</h3>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Transactions'}
          </button>
        </div>

        {syncMessage && (
          <div className={`mb-4 p-3 rounded-lg ${syncMessage.startsWith('Error') ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100' : 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'}`}>
            {syncMessage}
          </div>
        )}

        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">No transaction history found</p>
          <p className="text-sm">Click "Sync Transactions" to import your trading history from Trading212</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Transaction History</h3>
          <p className="text-sm text-muted-foreground">{transactions.length} transactions</p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Transactions'}
        </button>
      </div>

      {syncMessage && (
        <div className={`mb-4 p-3 rounded-lg ${syncMessage.startsWith('Error') ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100' : 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'}`}>
          {syncMessage}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-sm font-semibold">Date</th>
              <th className="text-left py-3 px-4 text-sm font-semibold">Type</th>
              <th className="text-left py-3 px-4 text-sm font-semibold">Asset</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Quantity</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Price</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const isBuy = tx.transaction_type === 'buy'
              const date = new Date(tx.executed_at)

              return (
                <tr key={tx.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 text-sm">
                    {date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-3 px-4">
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
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium">{tx.ticker}</p>
                      <p className="text-xs text-muted-foreground">{tx.asset_name || 'Unknown'}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-sm">{tx.quantity.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-sm">
                    {tx.currency === 'GBP' ? '£' : tx.currency === 'EUR' ? '€' : '$'}
                    {tx.price.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-medium">
                      {tx.currency === 'GBP' ? '£' : tx.currency === 'EUR' ? '€' : '$'}
                      {tx.total_value.toFixed(2)}
                    </span>
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
