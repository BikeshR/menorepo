'use server'

import { revalidatePath } from 'next/cache'
import { isAuthenticated } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

export type WatchlistItem = {
  id: string
  ticker: string
  name: string
  asset_type: 'stock' | 'etf' | 'crypto'
  notes: string | null
  target_price: number | null
  added_at: string
}

/**
 * Get all watchlist items
 */
export async function getWatchlist(): Promise<WatchlistItem[] | null> {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return null
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .order('added_at', { ascending: false })

    if (error) {
      console.error('Error fetching watchlist:', error)
      return null
    }

    return data as WatchlistItem[]
  } catch (error) {
    console.error('Error in getWatchlist:', error)
    return null
  }
}

/**
 * Add item to watchlist
 */
export async function addToWatchlist(params: {
  ticker: string
  name: string
  asset_type: 'stock' | 'etf' | 'crypto'
  notes?: string
  target_price?: number
}) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = createServiceClient()

    const { error } = await supabase.from('watchlist').insert({
      ticker: params.ticker.toUpperCase(),
      name: params.name,
      asset_type: params.asset_type,
      notes: params.notes || null,
      target_price: params.target_price || null,
    })

    if (error) {
      // Check for duplicate ticker
      if (error.code === '23505') {
        return { success: false, error: `${params.ticker} is already in your watchlist` }
      }
      console.error('Error adding to watchlist:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/watchlist')
    return { success: true, message: `${params.ticker} added to watchlist` }
  } catch (error) {
    console.error('Error in addToWatchlist:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add to watchlist',
    }
  }
}

/**
 * Remove item from watchlist
 */
export async function removeFromWatchlist(id: string) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = createServiceClient()

    const { error } = await supabase.from('watchlist').delete().eq('id', id)

    if (error) {
      console.error('Error removing from watchlist:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/watchlist')
    return { success: true, message: 'Removed from watchlist' }
  } catch (error) {
    console.error('Error in removeFromWatchlist:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove from watchlist',
    }
  }
}

/**
 * Update watchlist item
 */
export async function updateWatchlistItem(
  id: string,
  updates: {
    notes?: string
    target_price?: number
  }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('watchlist')
      .update({
        notes: updates.notes,
        target_price: updates.target_price,
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating watchlist item:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/watchlist')
    return { success: true, message: 'Watchlist item updated' }
  } catch (error) {
    console.error('Error in updateWatchlistItem:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update watchlist item',
    }
  }
}
