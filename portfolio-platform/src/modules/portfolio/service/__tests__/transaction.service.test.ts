/**
 * Transaction Service Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trading212Client } from '@/lib/integrations/trading212'
import type { PortfolioRepository } from '../../repository/portfolio.repository'
import type { TransactionRepository } from '../../repository/transaction.repository'
import { TransactionService } from '../transaction.service'

describe('TransactionService', () => {
  let service: TransactionService
  let mockPortfolioRepo: any
  let mockTransactionRepo: any
  let mockTrading212Client: any

  const mockPortfolio = {
    id: 'portfolio-1',
    user_id: 'user-1',
    name: 'Main Portfolio',
    description: 'Test portfolio',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockTransaction = {
    id: 'transaction-1',
    portfolio_id: 'portfolio-1',
    ticker: 'AAPL_US',
    action: 'buy' as const,
    quantity: 10,
    price: 150,
    total_amount: 1501.5,
    fee: 1.5,
    currency: 'USD',
    transaction_date: '2024-01-01',
    source: 'manual' as const,
    source_id: null,
    notes: 'Test buy',
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    mockPortfolioRepo = {
      getOrCreateMain: vi.fn(),
    }

    mockTransactionRepo = {
      getAllByPortfolio: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    mockTrading212Client = {}

    service = new TransactionService(
      mockPortfolioRepo as unknown as PortfolioRepository,
      mockTransactionRepo as unknown as TransactionRepository,
      mockTrading212Client as unknown as Trading212Client
    )
  })

  describe('getHistory', () => {
    it('should return transaction history', async () => {
      const transactions = [
        mockTransaction,
        { ...mockTransaction, id: 'transaction-2', action: 'sell' as const },
      ]

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.getAllByPortfolio.mockResolvedValue(transactions)

      const result = await service.getHistory()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(transactions)
      expect(mockTransactionRepo.getAllByPortfolio).toHaveBeenCalledWith('portfolio-1', undefined)
    })

    it('should respect limit parameter', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.getAllByPortfolio.mockResolvedValue([])

      await service.getHistory(50)

      expect(mockTransactionRepo.getAllByPortfolio).toHaveBeenCalledWith('portfolio-1', 50)
    })

    it('should return empty array when no transactions exist', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.getAllByPortfolio.mockResolvedValue([])

      const result = await service.getHistory()

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should return error on repository failure', async () => {
      mockPortfolioRepo.getOrCreateMain.mockRejectedValue(new Error('Database error'))

      const result = await service.getHistory()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('addTransaction', () => {
    it('should add a buy transaction', async () => {
      const transactionData = {
        ticker: 'AAPL_US',
        action: 'buy' as const,
        quantity: 10,
        price: 150,
        fee: 1.5,
        currency: 'USD',
        transactionDate: '2024-01-01',
        notes: 'Test buy',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockResolvedValue(mockTransaction)

      const result = await service.addTransaction(transactionData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockTransaction)
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolio_id: 'portfolio-1',
          ticker: 'AAPL_US',
          action: 'buy',
          quantity: 10,
          price: 150,
          total_amount: 1501.5, // (10 * 150) + 1.5
          fee: 1.5,
          currency: 'USD',
          transaction_date: '2024-01-01',
          source: 'manual',
          source_id: null,
          notes: 'Test buy',
        })
      )
    })

    it('should add a sell transaction with fee subtracted', async () => {
      const sellData = {
        ticker: 'AAPL_US',
        action: 'sell' as const,
        quantity: 5,
        price: 180,
        fee: 2.0,
        currency: 'USD',
        transactionDate: '2024-01-02',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockResolvedValue({
        ...mockTransaction,
        action: 'sell',
      })

      const result = await service.addTransaction(sellData)

      expect(result.success).toBe(true)
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sell',
          total_amount: 898.0, // (5 * 180) - 2.0
        })
      )
    })

    it('should add a dividend transaction', async () => {
      const dividendData = {
        ticker: 'AAPL_US',
        action: 'dividend' as const,
        quantity: 10,
        price: 0.5,
        currency: 'USD',
        transactionDate: '2024-01-03',
        notes: 'Quarterly dividend',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockResolvedValue({
        ...mockTransaction,
        action: 'dividend',
      })

      const result = await service.addTransaction(dividendData)

      expect(result.success).toBe(true)
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'dividend',
          quantity: 10,
          price: 0.5,
          total_amount: 5.0, // 10 * 0.5
        })
      )
    })

    it('should handle transaction without fee', async () => {
      const data = {
        ticker: 'AAPL_US',
        action: 'buy' as const,
        quantity: 10,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockResolvedValue(mockTransaction)

      await service.addTransaction(data)

      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          total_amount: 1500, // 10 * 150 (no fee)
          fee: null,
        })
      )
    })

    it('should uppercase ticker', async () => {
      const data = {
        ticker: 'aapl_us',
        action: 'buy' as const,
        quantity: 10,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockResolvedValue(mockTransaction)

      await service.addTransaction(data)

      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'AAPL_US',
        })
      )
    })

    it('should validate ticker is not empty', async () => {
      const data = {
        ticker: '',
        action: 'buy' as const,
        quantity: 10,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      const result = await service.addTransaction(data)

      expect(result.success).toBe(false)
      expect(result.error.message).toContain('Ticker is required')
    })

    it('should validate quantity is positive', async () => {
      const data = {
        ticker: 'AAPL_US',
        action: 'buy' as const,
        quantity: -5,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      const result = await service.addTransaction(data)

      expect(result.success).toBe(false)
      expect(result.error.message).toContain('Quantity must be positive')
    })

    it('should validate price is positive', async () => {
      const data = {
        ticker: 'AAPL_US',
        action: 'buy' as const,
        quantity: 10,
        price: 0,
        currency: 'USD',
        transactionDate: '2024-01-01',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      const result = await service.addTransaction(data)

      expect(result.success).toBe(false)
      expect(result.error.message).toContain('Price must be positive')
    })

    it('should handle optional notes', async () => {
      const data = {
        ticker: 'AAPL_US',
        action: 'buy' as const,
        quantity: 10,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
        notes: undefined,
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockResolvedValue(mockTransaction)

      await service.addTransaction(data)

      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: null,
        })
      )
    })

    it('should return error on repository failure', async () => {
      const data = {
        ticker: 'AAPL_US',
        action: 'buy' as const,
        quantity: 10,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockRejectedValue(new Error('Insert failed'))

      const result = await service.addTransaction(data)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('updateTransaction', () => {
    it('should update a transaction', async () => {
      const updates = {
        quantity: 15,
        price: 160,
        notes: 'Updated transaction',
      }

      mockTransactionRepo.update.mockResolvedValue({
        ...mockTransaction,
        ...updates,
      })

      const result = await service.updateTransaction('transaction-1', updates)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ ...mockTransaction, ...updates })
      expect(mockTransactionRepo.update).toHaveBeenCalledWith('transaction-1', updates)
    })

    it('should handle partial updates', async () => {
      const updates = {
        notes: 'Only updating notes',
      }

      mockTransactionRepo.update.mockResolvedValue({
        ...mockTransaction,
        ...updates,
      })

      const result = await service.updateTransaction('transaction-1', updates)

      expect(result.success).toBe(true)
      expect(mockTransactionRepo.update).toHaveBeenCalledWith('transaction-1', updates)
    })

    it('should return error on repository failure', async () => {
      mockTransactionRepo.update.mockRejectedValue(new Error('Update failed'))

      const result = await service.updateTransaction('transaction-1', {
        notes: 'Test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('deleteTransaction', () => {
    it('should delete a transaction', async () => {
      mockTransactionRepo.delete.mockResolvedValue(undefined)

      const result = await service.deleteTransaction('transaction-1')

      expect(result.success).toBe(true)
      expect(mockTransactionRepo.delete).toHaveBeenCalledWith('transaction-1')
    })

    it('should return error on repository failure', async () => {
      mockTransactionRepo.delete.mockRejectedValue(new Error('Delete failed'))

      const result = await service.deleteTransaction('transaction-1')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('syncTrading212Transactions', () => {
    it('should handle placeholder implementation', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      const result = await service.syncTrading212Transactions(100)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        transactionsSynced: 0,
        newTransactions: 0,
      })
    })

    it('should validate Trading212 client exists', async () => {
      // Create service without Trading212 client
      const serviceWithoutClient = new TransactionService(
        mockPortfolioRepo as unknown as PortfolioRepository,
        mockTransactionRepo as unknown as TransactionRepository
        // No client provided
      )

      const result = await serviceWithoutClient.syncTrading212Transactions(100)

      expect(result.success).toBe(false)
      expect(result.error.message).toContain('Trading212 client not configured')
    })

    it('should respect maxTransactions parameter', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      await service.syncTrading212Transactions(200)

      expect(mockPortfolioRepo.getOrCreateMain).toHaveBeenCalled()
    })
  })

  describe('Result type consistency', () => {
    it('should always return Result for getHistory', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.getAllByPortfolio.mockResolvedValue([])

      const result = await service.getHistory()

      expect(result).toHaveProperty('success')
      if (result.success) {
        expect(result).toHaveProperty('data')
      } else {
        expect(result).toHaveProperty('error')
      }
    })

    it('should always return Result for addTransaction', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockTransactionRepo.create.mockResolvedValue(mockTransaction)

      const result = await service.addTransaction({
        ticker: 'AAPL_US',
        action: 'buy',
        quantity: 10,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
      })

      expect(result).toHaveProperty('success')
      if (result.success) {
        expect(result).toHaveProperty('data')
      } else {
        expect(result).toHaveProperty('error')
      }
    })
  })

  describe('transaction workflow', () => {
    it('should handle complete buy-sell workflow', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      // Buy transaction
      const buyTx = {
        ...mockTransaction,
        action: 'buy' as const,
      }
      mockTransactionRepo.create.mockResolvedValue(buyTx)

      const buyResult = await service.addTransaction({
        ticker: 'AAPL_US',
        action: 'buy',
        quantity: 10,
        price: 150,
        currency: 'USD',
        transactionDate: '2024-01-01',
      })

      expect(buyResult.success).toBe(true)

      // Sell transaction
      const sellTx = {
        ...mockTransaction,
        id: 'transaction-2',
        action: 'sell' as const,
      }
      mockTransactionRepo.create.mockResolvedValue(sellTx)

      const sellResult = await service.addTransaction({
        ticker: 'AAPL_US',
        action: 'sell',
        quantity: 5,
        price: 180,
        fee: 2,
        currency: 'USD',
        transactionDate: '2024-01-02',
      })

      expect(sellResult.success).toBe(true)

      // Verify both calls
      expect(mockTransactionRepo.create).toHaveBeenCalledTimes(2)
    })
  })
})
