'use client'

import { ArrowDownRight, ArrowUpRight, Check, Edit, RefreshCw, Trash2, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import {
  deleteTransaction,
  syncKrakenTransactionHistory,
  syncTransactionHistory,
  updateTransaction,
} from '../actions'
import { ManualTransactionForm } from './ManualTransactionForm'

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
  const [isKrakenSyncing, setIsKrakenSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ quantity: string; price: string; fee: string }>({
    quantity: '',
    price: '',
    fee: '',
  })
  const [isPending, startTransition] = useTransition()

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

  const handleKrakenSync = async () => {
    setIsKrakenSyncing(true)
    setSyncMessage(null)

    try {
      const result = await syncKrakenTransactionHistory(100)

      if (result.success) {
        setSyncMessage(result.message)
        // Refresh the page to show new transactions
        window.location.reload()
      } else {
        setSyncMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      setSyncMessage(
        `Failed to sync Kraken: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsKrakenSyncing(false)
    }
  }

  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id)
    setEditValues({
      quantity: tx.quantity.toString(),
      price: tx.price.toString(),
      fee: tx.fee?.toString() || '0',
    })
  }

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      const result = await updateTransaction(id, {
        quantity: Number.parseFloat(editValues.quantity),
        price: Number.parseFloat(editValues.price),
        fee: Number.parseFloat(editValues.fee),
      })

      if (result.success) {
        setSyncMessage('Transaction updated successfully')
        window.location.reload()
      } else {
        setSyncMessage(`Error: ${result.error}`)
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this transaction?')) return

    startTransition(async () => {
      const result = await deleteTransaction(id)

      if (result.success) {
        setTransactions(transactions.filter((tx) => tx.id !== id))
        setSyncMessage('Transaction deleted successfully')
      } else {
        setSyncMessage(`Error: ${result.error}`)
      }
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditValues({ quantity: '', price: '', fee: '' })
  }

  if (transactions.length === 0) {
    return (
      <div>
        <ManualTransactionForm />
        <div className="border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing || isKrakenSyncing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Trading212'}
              </button>
              <button
                type="button"
                onClick={handleKrakenSync}
                disabled={isSyncing || isKrakenSyncing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isKrakenSyncing ? 'animate-spin' : ''}`} />
                {isKrakenSyncing ? 'Syncing...' : 'Sync Kraken'}
              </button>
            </div>
          </div>

          {syncMessage && (
            <div
              className={`mb-4 p-3 rounded-lg ${syncMessage.startsWith('Error') ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100' : 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'}`}
            >
              {syncMessage}
            </div>
          )}

          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No transaction history found</p>
            <p className="text-sm">
              Click "Sync Transactions" to import your trading history from Trading212
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <ManualTransactionForm />
      <div className="border rounded-lg p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <p className="text-sm text-muted-foreground">{transactions.length} transactions</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing || isKrakenSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Trading212'}
            </button>
            <button
              type="button"
              onClick={handleKrakenSync}
              disabled={isSyncing || isKrakenSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${isKrakenSyncing ? 'animate-spin' : ''}`} />
              {isKrakenSyncing ? 'Syncing...' : 'Sync Kraken'}
            </button>
          </div>
        </div>

        {syncMessage && (
          <div
            className={`mb-4 p-3 rounded-lg ${syncMessage.startsWith('Error') ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100' : 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'}`}
          >
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
                <th className="text-right py-3 px-4 text-sm font-semibold">Fee</th>
                <th className="text-right py-3 px-4 text-sm font-semibold">Total</th>
                <th className="text-right py-3 px-4 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const isBuy = tx.transaction_type === 'buy'
                const date = new Date(tx.executed_at)
                const isEditing = editingId === tx.id
                const canEdit = tx.source === 'manual' // Only allow editing manual transactions

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
                        <p className="text-xs text-muted-foreground">
                          {tx.asset_name || 'Unknown'}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.000001"
                          value={editValues.quantity}
                          onChange={(e) =>
                            setEditValues({ ...editValues, quantity: e.target.value })
                          }
                          className="w-24 px-2 py-1 border rounded text-sm bg-background text-right"
                          disabled={isPending}
                        />
                      ) : (
                        tx.quantity.toFixed(6)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.price}
                          onChange={(e) => setEditValues({ ...editValues, price: e.target.value })}
                          className="w-24 px-2 py-1 border rounded text-sm bg-background text-right"
                          disabled={isPending}
                        />
                      ) : (
                        <>
                          {tx.currency === 'GBP' ? '£' : tx.currency === 'EUR' ? '€' : '$'}
                          {tx.price.toFixed(2)}
                        </>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.fee}
                          onChange={(e) => setEditValues({ ...editValues, fee: e.target.value })}
                          className="w-20 px-2 py-1 border rounded text-sm bg-background text-right"
                          disabled={isPending}
                        />
                      ) : (
                        <>
                          {tx.currency === 'GBP' ? '£' : tx.currency === 'EUR' ? '€' : '$'}
                          {(tx.fee || 0).toFixed(2)}
                        </>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-medium">
                        {tx.currency === 'GBP' ? '£' : tx.currency === 'EUR' ? '€' : '$'}
                        {tx.total_value.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(tx.id)}
                            disabled={isPending}
                            className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded disabled:opacity-50"
                          >
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isPending}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEdit(tx)}
                                disabled={isPending}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded disabled:opacity-50"
                              >
                                <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(tx.id)}
                                disabled={isPending}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </button>
                            </>
                          )}
                          {!canEdit && (
                            <span className="text-xs text-muted-foreground">{tx.source}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
