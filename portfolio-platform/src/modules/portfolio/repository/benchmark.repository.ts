/**
 * Benchmark Repository
 *
 * Handles all database operations for benchmark price data (S&P 500, etc.).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository } from '@/core/database/base.repository'
import type { BenchmarkPrice } from '../types'

export class BenchmarkRepository extends BaseRepository<BenchmarkPrice> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'benchmark_prices')
  }

  /**
   * Get latest prices for all benchmarks
   */
  async getLatestPrices(): Promise<BenchmarkPrice[]> {
    return this.executeQuery(
      () =>
        this.supabase
          .from('benchmark_prices')
          .select('*')
          .order('date', { ascending: false })
          .limit(10), // Assuming we track ~5 benchmarks, get 2 days worth
      'Failed to fetch latest benchmark prices'
    )
  }

  /**
   * Get price history for a specific benchmark
   */
  async getPriceHistory(symbol: string, days: number): Promise<BenchmarkPrice[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    return this.executeQuery(
      () =>
        this.supabase
          .from('benchmark_prices')
          .select('*')
          .eq('symbol', symbol)
          .gte('date', cutoffDateStr)
          .order('date', { ascending: true }),
      'Failed to fetch benchmark price history',
      { symbol, days }
    )
  }

  /**
   * Upsert benchmark prices (insert or update if exists for same symbol/date)
   */
  async upsertPrices(
    prices: Array<{
      symbol: string
      name: string
      price: number
      date: string
    }>
  ): Promise<void> {
    if (prices.length === 0) {
      return
    }

    await this.executeMutation(
      () =>
        this.supabase.from('benchmark_prices').upsert(
          prices.map((p) => ({
            symbol: p.symbol,
            name: p.name,
            price: p.price,
            date: p.date,
          })),
          {
            onConflict: 'symbol,date',
          }
        ),
      'Failed to upsert benchmark prices',
      { count: prices.length }
    )
  }

  /**
   * Get the latest price for a specific benchmark
   */
  async getLatestPrice(symbol: string): Promise<BenchmarkPrice | null> {
    return this.executeOptionalQuery(
      () =>
        this.supabase
          .from('benchmark_prices')
          .select('*')
          .eq('symbol', symbol)
          .order('date', { ascending: false })
          .limit(1)
          .single(),
      'Failed to fetch latest benchmark price',
      { symbol }
    )
  }
}
