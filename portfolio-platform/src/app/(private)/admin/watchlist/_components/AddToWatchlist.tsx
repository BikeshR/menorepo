'use client'

import { Plus } from 'lucide-react'
import { useId, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { addToWatchlist } from '../actions'

export function AddToWatchlist() {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const formId = useId()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const ticker = formData.get('ticker') as string
    const name = formData.get('name') as string
    const asset_type = formData.get('asset_type') as 'stock' | 'etf' | 'crypto'
    const notes = formData.get('notes') as string
    const target_price = formData.get('target_price') as string

    startTransition(async () => {
      const result = await addToWatchlist({
        ticker: ticker.toUpperCase(),
        name,
        asset_type,
        notes: notes || undefined,
        target_price: target_price ? Number.parseFloat(target_price) : undefined,
      })

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Added to watchlist' })
        // Reset form
        ;(e.target as HTMLFormElement).reset()
        setTimeout(() => {
          setIsOpen(false)
          setMessage(null)
        }, 1500)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to add to watchlist' })
      }
    })
  }

  if (!isOpen) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setIsOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add to Watchlist
        </Button>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Add to Watchlist</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Cancel
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium mb-1">
              Name *
            </label>
            <input
              type="text"
              id={`${formId}-name`}
              name="name"
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

          <div>
            <label htmlFor={`${formId}-target_price`} className="block text-sm font-medium mb-1">
              Target Price (Optional)
            </label>
            <input
              type="number"
              id={`${formId}-target_price`}
              name="target_price"
              step="0.01"
              placeholder="150.00"
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isPending}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-notes`} className="block text-sm font-medium mb-1">
            Notes (Optional)
          </label>
          <textarea
            id={`${formId}-notes`}
            name="notes"
            rows={3}
            placeholder="Why are you watching this asset?"
            className="w-full px-3 py-2 border rounded-md bg-background"
            disabled={isPending}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Adding...' : 'Add to Watchlist'}
          </Button>
        </div>
      </form>
    </div>
  )
}
