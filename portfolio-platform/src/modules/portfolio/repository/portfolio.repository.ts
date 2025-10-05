/**
 * Portfolio Repository
 *
 * Handles all database operations for portfolios and snapshots.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository } from '@/core/database/base.repository'
import type { CreatePortfolioDto, CreateSnapshotDto, Portfolio, PortfolioSnapshot } from '../types'

export class PortfolioRepository extends BaseRepository<Portfolio> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'portfolios')
  }

  /**
   * Get the main portfolio (single-user system)
   * Returns null if no portfolio exists
   */
  async getMain(): Promise<Portfolio | null> {
    return this.executeOptionalQuery(
      () => this.supabase.from('portfolios').select('*').limit(1).single(),
      'Failed to fetch main portfolio'
    )
  }

  /**
   * Get or create the main portfolio
   * Ensures a portfolio always exists
   */
  async getOrCreateMain(): Promise<Portfolio> {
    const existing = await this.getMain()

    if (existing) {
      return existing
    }

    // Create default portfolio
    return this.create({
      name: 'Main Portfolio',
      description: 'Investment portfolio tracking stocks, ETFs, and crypto',
    })
  }

  /**
   * Create a new portfolio
   */
  async create(data: CreatePortfolioDto): Promise<Portfolio> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('portfolios')
          .insert({
            name: data.name,
            description: data.description ?? null,
          })
          .select()
          .single(),
      'Failed to create portfolio',
      { name: data.name }
    )
  }

  /**
   * Create a portfolio snapshot
   */
  async createSnapshot(data: CreateSnapshotDto): Promise<PortfolioSnapshot> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('portfolio_snapshots')
          .insert({
            portfolio_id: data.portfolio_id,
            snapshot_date: data.snapshot_date,
            total_value: data.total_value,
            cash_balance: data.cash_balance,
            total_cost_basis: data.total_cost_basis,
            total_gain_loss: data.total_gain_loss,
            total_gain_loss_pct: data.total_gain_loss_pct,
            positions_count: data.positions_count,
          })
          .select()
          .single(),
      'Failed to create portfolio snapshot',
      { portfolioId: data.portfolio_id, date: data.snapshot_date }
    )
  }

  /**
   * Get latest snapshot for a portfolio
   */
  async getLatestSnapshot(portfolioId: string): Promise<PortfolioSnapshot | null> {
    return this.executeOptionalQuery(
      () =>
        this.supabase
          .from('portfolio_snapshots')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .single(),
      'Failed to fetch latest portfolio snapshot',
      { portfolioId }
    )
  }

  /**
   * Get historical snapshots for a portfolio
   */
  async getHistoricalSnapshots(portfolioId: string, days: number): Promise<PortfolioSnapshot[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    return this.executeQuery(
      () =>
        this.supabase
          .from('portfolio_snapshots')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .gte('snapshot_date', cutoffDateStr)
          .order('snapshot_date', { ascending: true }),
      'Failed to fetch historical snapshots',
      { portfolioId, days }
    )
  }

  /**
   * Upsert a snapshot (insert or update if exists for same date)
   */
  async upsertSnapshot(data: CreateSnapshotDto): Promise<PortfolioSnapshot> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('portfolio_snapshots')
          .upsert(
            {
              portfolio_id: data.portfolio_id,
              snapshot_date: data.snapshot_date,
              total_value: data.total_value,
              cash_balance: data.cash_balance,
              total_cost_basis: data.total_cost_basis,
              total_gain_loss: data.total_gain_loss,
              total_gain_loss_pct: data.total_gain_loss_pct,
              positions_count: data.positions_count,
            },
            {
              onConflict: 'portfolio_id,snapshot_date',
            }
          )
          .select()
          .single(),
      'Failed to upsert portfolio snapshot',
      { portfolioId: data.portfolio_id, date: data.snapshot_date }
    )
  }
}
