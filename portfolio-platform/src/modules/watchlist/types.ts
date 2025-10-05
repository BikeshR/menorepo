/**
 * Watchlist Types
 */

export type WatchlistItem = {
  id: string
  ticker: string
  name: string
  asset_type: 'stock' | 'etf' | 'crypto'
  notes: string | null
  target_price: number | null
  added_at: string
}

export type CreateWatchlistItemDto = {
  ticker: string
  name: string
  asset_type: 'stock' | 'etf' | 'crypto'
  notes?: string | null
  target_price?: number | null
}

export type UpdateWatchlistItemDto = {
  notes?: string | null
  target_price?: number | null
}
