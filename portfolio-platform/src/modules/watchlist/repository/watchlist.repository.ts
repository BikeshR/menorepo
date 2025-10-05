/**
 * Watchlist Repository
 *
 * Handles all database operations for watchlist items.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository } from '@/core/database/base.repository'
import type { CreateWatchlistItemDto, UpdateWatchlistItemDto, WatchlistItem } from '../types'

export class WatchlistRepository extends BaseRepository<WatchlistItem> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'watchlist')
  }

  /**
   * Get all watchlist items ordered by added_at descending
   */
  async getAll(): Promise<WatchlistItem[]> {
    return this.executeQuery(
      () => this.supabase.from('watchlist').select('*').order('added_at', { ascending: false }),
      'Failed to fetch watchlist items'
    )
  }

  /**
   * Get watchlist item by ID
   */
  async getById(id: string): Promise<WatchlistItem | null> {
    return this.executeOptionalQuery(
      () => this.supabase.from('watchlist').select('*').eq('id', id).single(),
      'Failed to fetch watchlist item',
      { id }
    )
  }

  /**
   * Check if ticker already exists in watchlist
   */
  async existsByTicker(ticker: string): Promise<boolean> {
    const count = await this.executeCount(
      () =>
        this.supabase
          .from('watchlist')
          .select('*', { count: 'exact', head: true })
          .eq('ticker', ticker.toUpperCase()),
      'Failed to check if ticker exists',
      { ticker }
    )

    return count > 0
  }

  /**
   * Add item to watchlist
   */
  async create(item: CreateWatchlistItemDto): Promise<WatchlistItem> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('watchlist')
          .insert({
            ticker: item.ticker.toUpperCase(),
            name: item.name,
            asset_type: item.asset_type,
            notes: item.notes ?? null,
            target_price: item.target_price ?? null,
          })
          .select()
          .single(),
      'Failed to add item to watchlist',
      { ticker: item.ticker }
    )
  }

  /**
   * Update watchlist item
   */
  async update(id: string, updates: UpdateWatchlistItemDto): Promise<WatchlistItem> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('watchlist')
          .update({
            notes: updates.notes,
            target_price: updates.target_price,
          })
          .eq('id', id)
          .select()
          .single(),
      'Failed to update watchlist item',
      { id }
    )
  }

  /**
   * Delete watchlist item
   */
  async delete(id: string): Promise<void> {
    await this.executeMutation(
      () => this.supabase.from('watchlist').delete().eq('id', id),
      'Failed to delete watchlist item',
      { id }
    )
  }
}
