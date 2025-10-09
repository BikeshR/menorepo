/**
 * Stock Repository
 *
 * Handles all database operations for stock positions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository } from '@/core/database/base.repository'
import type { CreateStockDto, Stock } from '../types'

export class StockRepository extends BaseRepository<Stock> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'stocks')
  }

  /**
   * Get all stocks for a portfolio
   */
  async getAllByPortfolio(portfolioId: string): Promise<Stock[]> {
    return this.executeQuery(
      () =>
        this.supabase
          .from('stocks')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .order('current_price', { ascending: false }),
      'Failed to fetch stocks',
      { portfolioId }
    )
  }

  /**
   * Get a stock by ticker for a specific portfolio
   */
  async getByTicker(portfolioId: string, ticker: string): Promise<Stock | null> {
    return this.executeOptionalQuery(
      () =>
        this.supabase
          .from('stocks')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', ticker)
          .single(),
      'Failed to fetch stock by ticker',
      { portfolioId, ticker }
    )
  }

  /**
   * Upsert a stock position (insert or update if exists)
   */
  async upsert(stock: CreateStockDto): Promise<Stock> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('stocks')
          .upsert(
            {
              portfolio_id: stock.portfolio_id,
              ticker: stock.ticker,
              name: stock.name,
              asset_type: stock.asset_type,
              isin: stock.isin,
              currency: stock.currency,
              quantity: stock.quantity,
              average_cost: stock.average_cost,
              current_price: stock.current_price,
              gain_loss: stock.gain_loss,
              gain_loss_pct: stock.gain_loss_pct,
              exchange: stock.exchange,
              country: stock.country,
              region: stock.region,
              initial_fill_date: stock.initial_fill_date,
              last_synced_at: stock.last_synced_at,
              sector: stock.sector ?? null,
              industry: stock.industry ?? null,
            },
            {
              onConflict: 'portfolio_id,ticker',
            }
          )
          .select()
          .single(),
      'Failed to upsert stock',
      { ticker: stock.ticker }
    )
  }

  /**
   * Upsert multiple stocks at once (for bulk sync operations)
   */
  async upsertMany(stocks: CreateStockDto[]): Promise<void> {
    if (stocks.length === 0) {
      return
    }

    await this.executeBulkMutation(
      () =>
        this.supabase.from('stocks').upsert(
          stocks.map((stock) => ({
            portfolio_id: stock.portfolio_id,
            ticker: stock.ticker,
            name: stock.name,
            asset_type: stock.asset_type,
            isin: stock.isin,
            currency: stock.currency,
            quantity: stock.quantity,
            average_cost: stock.average_cost,
            current_price: stock.current_price,
            gain_loss: stock.gain_loss,
            gain_loss_pct: stock.gain_loss_pct,
            exchange: stock.exchange,
            country: stock.country,
            region: stock.region,
            initial_fill_date: stock.initial_fill_date,
            last_synced_at: stock.last_synced_at,
            sector: stock.sector ?? null,
            industry: stock.industry ?? null,
          })),
          {
            onConflict: 'portfolio_id,ticker',
          }
        ),
      'Failed to upsert multiple stocks',
      { count: stocks.length }
    )
  }

  /**
   * Update stock fundamentals (enriched data)
   */
  async updateFundamentals(
    portfolioId: string,
    ticker: string,
    fundamentals: {
      sector?: string
      industry?: string
      marketCap?: number
      peRatio?: number
      dividendYield?: number
    }
  ): Promise<Stock> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('stocks')
          .update({
            sector: fundamentals.sector ?? null,
            industry: fundamentals.industry ?? null,
            market_cap: fundamentals.marketCap ?? null,
            pe_ratio: fundamentals.peRatio ?? null,
            dividend_yield: fundamentals.dividendYield ?? null,
          })
          .eq('portfolio_id', portfolioId)
          .eq('ticker', ticker)
          .select()
          .single(),
      'Failed to update stock fundamentals',
      { ticker }
    )
  }

  /**
   * Delete all stocks for a portfolio
   * Useful when doing a full re-sync
   */
  async deleteAllByPortfolio(portfolioId: string): Promise<void> {
    await this.executeDelete(
      () => this.supabase.from('stocks').delete().eq('portfolio_id', portfolioId),
      'Failed to delete all stocks',
      { portfolioId }
    )
  }

  /**
   * Get stocks with missing fundamentals
   */
  async getStocksNeedingEnrichment(portfolioId: string, limit?: number): Promise<Stock[]> {
    let query = this.supabase
      .from('stocks')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .or('sector.is.null,industry.is.null')
      .order('current_price', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    return this.executeQuery(() => query, 'Failed to fetch stocks needing enrichment', {
      portfolioId,
      limit,
    })
  }
}
