'use client'

import { useState, useTransition } from 'react'
import { Trash2, Edit, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { removeFromWatchlist, updateWatchlistItem, type WatchlistItem } from '../actions'

interface WatchlistTableProps {
  initialWatchlist: WatchlistItem[]
}

export function WatchlistTable({ initialWatchlist }: WatchlistTableProps) {
  const [watchlist, setWatchlist] = useState(initialWatchlist)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editTargetPrice, setEditTargetPrice] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    if (!confirm('Remove this item from your watchlist?')) return

    startTransition(async () => {
      const result = await removeFromWatchlist(id)
      if (result.success) {
        setWatchlist(watchlist.filter((item) => item.id !== id))
      }
    })
  }

  const handleEdit = (item: WatchlistItem) => {
    setEditingId(item.id)
    setEditNotes(item.notes || '')
    setEditTargetPrice(item.target_price?.toString() || '')
  }

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      const result = await updateWatchlistItem(id, {
        notes: editNotes,
        target_price: editTargetPrice ? Number.parseFloat(editTargetPrice) : undefined,
      })

      if (result.success) {
        setWatchlist(
          watchlist.map((item) =>
            item.id === id
              ? {
                  ...item,
                  notes: editNotes,
                  target_price: editTargetPrice ? Number.parseFloat(editTargetPrice) : null,
                }
              : item,
          ),
        )
        setEditingId(null)
      }
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditNotes('')
    setEditTargetPrice('')
  }

  if (watchlist.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">No items in watchlist</h3>
        <p className="text-muted-foreground">Add stocks, ETFs, or crypto to track potential investments</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Ticker</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Target Price</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Added</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {watchlist.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono font-semibold">{item.ticker}</td>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      item.asset_type === 'stock'
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : item.asset_type === 'etf'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                    }`}
                  >
                    {item.asset_type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {editingId === item.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editTargetPrice}
                      onChange={(e) => setEditTargetPrice(e.target.value)}
                      className="w-24 px-2 py-1 border rounded text-sm bg-background"
                      placeholder="Price"
                    />
                  ) : item.target_price ? (
                    `$${item.target_price.toFixed(2)}`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {editingId === item.id ? (
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm bg-background"
                      placeholder="Add notes..."
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground truncate block">
                      {item.notes || '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(item.added_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === item.id ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isPending}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(item)}
                        disabled={isPending}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
