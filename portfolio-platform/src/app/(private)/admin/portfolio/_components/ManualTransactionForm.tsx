'use client'

import { Plus, X } from 'lucide-react'
import { useId, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { addManualTransaction } from '../actions'

export function ManualTransactionForm() {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const formId = useId()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await addManualTransaction({
        ticker: formData.get('ticker') as string,
        asset_name: formData.get('asset_name') as string,
        asset_type: formData.get('asset_type') as 'stock' | 'etf' | 'crypto',
        transaction_type: formData.get('transaction_type') as 'buy' | 'sell',
        quantity: Number.parseFloat(formData.get('quantity') as string),
        price: Number.parseFloat(formData.get('price') as string),
        fee: formData.get('fee') ? Number.parseFloat(formData.get('fee') as string) : undefined,
        currency: formData.get('currency') as string,
        executed_at: formData.get('executed_at') as string,
      })

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Transaction added' })
        ;(e.target as HTMLFormElement).reset()
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to add transaction' })
      }
    })
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} variant="outline" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Manual Transaction
      </Button>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Add Manual Transaction</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'
              : 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor={`${formId}-ticker`} className="block text-sm font-medium mb-1">
              Ticker *
            </label>
            <input
              type="text"
              id={`${formId}-ticker`}
              name="ticker"
              required
              placeholder="AAPL"
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-asset_name`} className="block text-sm font-medium mb-1">
              Asset Name *
            </label>
            <input
              type="text"
              id={`${formId}-asset_name`}
              name="asset_name"
              required
              placeholder="Apple Inc."
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-asset_type`} className="block text-sm font-medium mb-1">
              Asset Type *
            </label>
            <select
              id={`${formId}-asset_type`}
              name="asset_type"
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            >
              <option value="stock">Stock</option>
              <option value="etf">ETF</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor={`${formId}-transaction_type`}
              className="block text-sm font-medium mb-1"
            >
              Transaction Type *
            </label>
            <select
              id={`${formId}-transaction_type`}
              name="transaction_type"
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-quantity`} className="block text-sm font-medium mb-1">
              Quantity *
            </label>
            <input
              type="number"
              id={`${formId}-quantity`}
              name="quantity"
              required
              step="0.000001"
              placeholder="10"
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-price`} className="block text-sm font-medium mb-1">
              Price per Unit *
            </label>
            <input
              type="number"
              id={`${formId}-price`}
              name="price"
              required
              step="0.01"
              placeholder="150.00"
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor={`${formId}-currency`} className="block text-sm font-medium mb-1">
              Currency *
            </label>
            <select
              id={`${formId}-currency`}
              name="currency"
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-fee`} className="block text-sm font-medium mb-1">
              Fee (Optional)
            </label>
            <input
              type="number"
              id={`${formId}-fee`}
              name="fee"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-executed_at`} className="block text-sm font-medium mb-1">
              Execution Date *
            </label>
            <input
              type="datetime-local"
              id={`${formId}-executed_at`}
              name="executed_at"
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Adding...' : 'Add Transaction'}
          </Button>
        </div>
      </form>
    </div>
  )
}
