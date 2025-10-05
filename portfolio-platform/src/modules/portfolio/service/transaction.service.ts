/**
 * Transaction Service
 *
 * Handles transaction management and syncing from external sources.
 */

import { BaseService } from '@/core/services/base.service'
import type { Result } from '@/core/types/result.types'
import type { Trading212Client } from '@/lib/integrations/trading212'
import type { PortfolioRepository } from '../repository/portfolio.repository'
import type { TransactionRepository } from '../repository/transaction.repository'
import type { CreateTransactionDto, Transaction, UpdateTransactionDto } from '../types'

export class TransactionService extends BaseService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly trading212Client?: Trading212Client
  ) {
    super('TransactionService')
  }

  /**
   * Get transaction history
   */
  async getHistory(limit?: number): Promise<Result<Transaction[]>> {
    return this.executeOperation(
      'getHistory',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()
        return this.transactionRepository.getAllByPortfolio(portfolio.id, limit)
      },
      { limit }
    )
  }

  /**
   * Add a manual transaction
   */
  async addTransaction(data: {
    ticker: string
    action: 'buy' | 'sell' | 'dividend'
    quantity: number
    price: number
    fee?: number
    currency: string
    transactionDate: string
    notes?: string
  }): Promise<Result<Transaction>> {
    return this.executeOperation(
      'addTransaction',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()

        // Validate
        this.validate(data.ticker.length > 0, 'Ticker is required')
        this.validate(data.quantity > 0, 'Quantity must be positive')
        this.validate(data.price > 0, 'Price must be positive')

        // Calculate total amount
        let totalAmount = data.quantity * data.price
        if (data.action === 'buy') {
          totalAmount += data.fee || 0
        } else if (data.action === 'sell') {
          totalAmount -= data.fee || 0
        }

        const transaction: CreateTransactionDto = {
          portfolio_id: portfolio.id,
          ticker: data.ticker.toUpperCase(),
          action: data.action,
          quantity: data.quantity,
          price: data.price,
          total_amount: totalAmount,
          fee: data.fee ?? null,
          currency: data.currency,
          transaction_date: data.transactionDate,
          source: 'manual',
          source_id: null,
          notes: data.notes ?? null,
        }

        return this.transactionRepository.create(transaction)
      },
      { ticker: data.ticker, action: data.action }
    )
  }

  /**
   * Update a transaction
   */
  async updateTransaction(id: string, updates: UpdateTransactionDto): Promise<Result<Transaction>> {
    return this.executeOperation(
      'updateTransaction',
      async () => {
        return this.transactionRepository.update(id, updates)
      },
      { id }
    )
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<Result<void>> {
    return this.executeOperation(
      'deleteTransaction',
      async () => {
        await this.transactionRepository.delete(id)
      },
      { id }
    )
  }

  /**
   * Sync transaction history from Trading212
   */
  async syncTrading212Transactions(maxTransactions = 200): Promise<
    Result<{
      transactionsSynced: number
      newTransactions: number
    }>
  > {
    return this.executeOperation(
      'syncTrading212Transactions',
      async () => {
        this.validate(!!this.trading212Client, 'Trading212 client not configured')

        const _portfolio = await this.portfolioRepository.getOrCreateMain()

        // Fetch transactions from Trading212
        // Note: Trading212 API doesn't have a direct transactions endpoint,
        // so this would need to use the exports/history endpoint
        // For now, returning a placeholder
        this.logger.warn('Trading212 transaction sync not fully implemented yet')

        return {
          transactionsSynced: 0,
          newTransactions: 0,
        }
      },
      { maxTransactions }
    )
  }
}
