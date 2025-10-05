/**
 * Watchlist Service
 *
 * Business logic for watchlist operations.
 */

import { AppError } from '@/core/errors/app-error'
import { BaseService } from '@/core/services/base.service'
import type { Result } from '@/core/types/result.types'
import type { WatchlistRepository } from '../repository/watchlist.repository'
import type { CreateWatchlistItemDto, UpdateWatchlistItemDto, WatchlistItem } from '../types'

export class WatchlistService extends BaseService {
  constructor(private readonly repository: WatchlistRepository) {
    super('WatchlistService')
  }

  /**
   * Get all watchlist items
   */
  async getAll(): Promise<Result<WatchlistItem[]>> {
    return this.executeOperation('getAll', async () => {
      return this.repository.getAll()
    })
  }

  /**
   * Add item to watchlist
   */
  async addItem(item: CreateWatchlistItemDto): Promise<Result<WatchlistItem>> {
    return this.executeOperation(
      'addItem',
      async () => {
        // Validate ticker
        this.validate(item.ticker.length > 0, 'Ticker is required', { ticker: item.ticker })

        // Check if ticker already exists
        const exists = await this.repository.existsByTicker(item.ticker)
        if (exists) {
          throw AppError.validation(`${item.ticker.toUpperCase()} is already in your watchlist`, {
            ticker: item.ticker,
          })
        }

        // Create the watchlist item
        return this.repository.create(item)
      },
      { ticker: item.ticker }
    )
  }

  /**
   * Update watchlist item
   */
  async updateItem(id: string, updates: UpdateWatchlistItemDto): Promise<Result<WatchlistItem>> {
    return this.executeOperation(
      'updateItem',
      async () => {
        // Check if item exists
        const existingItem = await this.repository.getById(id)
        this.assertExists(existingItem, 'Watchlist item')

        // Update the item
        return this.repository.update(id, updates)
      },
      { id }
    )
  }

  /**
   * Remove item from watchlist
   */
  async removeItem(id: string): Promise<Result<void>> {
    return this.executeOperation(
      'removeItem',
      async () => {
        // Check if item exists
        const existingItem = await this.repository.getById(id)
        this.assertExists(existingItem, 'Watchlist item')

        // Delete the item
        await this.repository.delete(id)
      },
      { id }
    )
  }
}
