/**
 * Transaction Repository
 *
 * Handles all database operations for portfolio transactions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository } from '@/core/database/base.repository'
import type { CreateTransactionDto, Transaction, UpdateTransactionDto } from '../types'

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'transactions')
  }

  /**
   * Get all transactions for a portfolio
   */
  async getAllByPortfolio(portfolioId: string, limit?: number): Promise<Transaction[]> {
    let query = this.supabase
      .from('transactions')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('transaction_date', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    return this.executeQuery(() => query, 'Failed to fetch transactions', { portfolioId, limit })
  }

  /**
   * Get transactions by source
   */
  async getBySource(
    portfolioId: string,
    source: 'trading212' | 'kraken' | 'manual'
  ): Promise<Transaction[]> {
    return this.executeQuery(
      () =>
        this.supabase
          .from('transactions')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .eq('source', source)
          .order('transaction_date', { ascending: false }),
      'Failed to fetch transactions by source',
      { portfolioId, source }
    )
  }

  /**
   * Create a transaction
   */
  async create(transaction: CreateTransactionDto): Promise<Transaction> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('transactions')
          .insert({
            portfolio_id: transaction.portfolio_id,
            ticker: transaction.ticker,
            action: transaction.action,
            quantity: transaction.quantity,
            price: transaction.price,
            total_amount: transaction.total_amount,
            fee: transaction.fee ?? null,
            currency: transaction.currency,
            transaction_date: transaction.transaction_date,
            source: transaction.source,
            source_id: transaction.source_id ?? null,
            notes: transaction.notes ?? null,
          })
          .select()
          .single(),
      'Failed to create transaction',
      { ticker: transaction.ticker, action: transaction.action }
    )
  }

  /**
   * Bulk create transactions
   */
  async createMany(transactions: CreateTransactionDto[]): Promise<void> {
    if (transactions.length === 0) {
      return
    }

    await this.executeBulkMutation(
      () =>
        this.supabase.from('transactions').insert(
          transactions.map((t) => ({
            portfolio_id: t.portfolio_id,
            ticker: t.ticker,
            action: t.action,
            quantity: t.quantity,
            price: t.price,
            total_amount: t.total_amount,
            fee: t.fee ?? null,
            currency: t.currency,
            transaction_date: t.transaction_date,
            source: t.source,
            source_id: t.source_id ?? null,
            notes: t.notes ?? null,
          }))
        ),
      'Failed to create transactions',
      { count: transactions.length }
    )
  }

  /**
   * Update a transaction
   */
  async update(id: string, updates: UpdateTransactionDto): Promise<Transaction> {
    return this.executeMutation(
      () =>
        this.supabase
          .from('transactions')
          .update({
            quantity: updates.quantity,
            price: updates.price,
            total_amount: updates.total_amount,
            fee: updates.fee,
            notes: updates.notes,
          })
          .eq('id', id)
          .select()
          .single(),
      'Failed to update transaction',
      { id }
    )
  }

  /**
   * Delete a transaction
   */
  async delete(id: string): Promise<void> {
    await this.executeDelete(
      () => this.supabase.from('transactions').delete().eq('id', id),
      'Failed to delete transaction',
      { id }
    )
  }

  /**
   * Delete all transactions by source
   * Useful when re-syncing from an external source
   */
  async deleteBySource(portfolioId: string, source: 'trading212' | 'kraken'): Promise<void> {
    await this.executeDelete(
      () =>
        this.supabase
          .from('transactions')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('source', source),
      'Failed to delete transactions by source',
      { portfolioId, source }
    )
  }

  /**
   * Check if a transaction already exists by source_id
   */
  async existsBySourceId(portfolioId: string, sourceId: string): Promise<boolean> {
    const count = await this.executeCount(
      () =>
        this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('portfolio_id', portfolioId)
          .eq('source_id', sourceId),
      'Failed to check transaction existence',
      { portfolioId, sourceId }
    )

    return count > 0
  }
}
