/**
 * Transaction Repository Tests
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/errors/app-error'
import type { CreateTransactionDto, Transaction } from '../../types'
import { TransactionRepository } from '../transaction.repository'

describe('TransactionRepository', () => {
  let repository: TransactionRepository
  let mockSupabase: any

  const mockTransaction: Transaction = {
    id: 'transaction-1',
    portfolio_id: 'portfolio-1',
    ticker: 'AAPL_US',
    action: 'buy',
    quantity: 10,
    price: 150,
    total_amount: 1500,
    fee: 1.5,
    currency: 'USD',
    transaction_date: '2024-01-01',
    source: 'manual',
    source_id: null,
    notes: 'Test transaction',
    created_at: '2024-01-01T00:00:00Z',
  }

  const createMockTransactionDto = (
    overrides?: Partial<CreateTransactionDto>
  ): CreateTransactionDto => ({
    portfolio_id: 'portfolio-1',
    ticker: 'AAPL_US',
    action: 'buy',
    quantity: 10,
    price: 150,
    total_amount: 1500,
    fee: 1.5,
    currency: 'USD',
    transaction_date: '2024-01-01',
    source: 'manual',
    source_id: null,
    notes: 'Test transaction',
    ...overrides,
  })

  beforeEach(() => {
    // Create a proper chainable mock
    // The key is that the chain is thenable (can be awaited)
    function createChainableMock(response: any) {
      const mock: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(response),
        maybeSingle: vi.fn().mockResolvedValue(response),
        then: vi.fn((resolve) => Promise.resolve(response).then(resolve)),
      }
      return mock
    }

    mockSupabase = createChainableMock({ data: null, error: null })
    repository = new TransactionRepository(mockSupabase as unknown as SupabaseClient)
  })

  describe('getAllByPortfolio', () => {
    it('should return all transactions for a portfolio ordered by date', async () => {
      const transactions = [
        mockTransaction,
        { ...mockTransaction, id: 'transaction-2', transaction_date: '2024-01-02' },
      ]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: transactions, error: null }).then(resolve)
      )

      const result = await repository.getAllByPortfolio('portfolio-1')

      expect(result).toEqual(transactions)
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.order).toHaveBeenCalledWith('transaction_date', { ascending: false })
    })

    it('should respect limit parameter', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [mockTransaction], error: null }).then(resolve)
      )

      await repository.getAllByPortfolio('portfolio-1', 10)

      expect(mockSupabase.limit).toHaveBeenCalledWith(10)
    })

    it('should not apply limit when not provided', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      await repository.getAllByPortfolio('portfolio-1')

      expect(mockSupabase.limit).not.toHaveBeenCalled()
    })

    it('should return empty array when no transactions exist', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      const result = await repository.getAllByPortfolio('portfolio-1')

      expect(result).toEqual([])
    })

    it('should throw AppError on database error', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: null,
          error: { message: 'Database error', code: 'DB_ERROR' },
        }).then(resolve)
      )

      await expect(repository.getAllByPortfolio('portfolio-1')).rejects.toThrow(AppError)
    })
  })

  describe('getBySource', () => {
    it('should return transactions filtered by source', async () => {
      const trading212Transactions = [
        { ...mockTransaction, source: 'trading212' },
        { ...mockTransaction, id: 'transaction-2', source: 'trading212' },
      ]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: trading212Transactions, error: null }).then(resolve)
      )

      const result = await repository.getBySource('portfolio-1', 'trading212')

      expect(result).toEqual(trading212Transactions)
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('source', 'trading212')
      expect(mockSupabase.order).toHaveBeenCalledWith('transaction_date', { ascending: false })
    })

    it('should work for each source type', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      await repository.getBySource('portfolio-1', 'manual')
      expect(mockSupabase.eq).toHaveBeenCalledWith('source', 'manual')

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      await repository.getBySource('portfolio-1', 'kraken')
      expect(mockSupabase.eq).toHaveBeenCalledWith('source', 'kraken')
    })

    it('should return empty array when no transactions match source', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      const result = await repository.getBySource('portfolio-1', 'kraken')

      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a transaction', async () => {
      const transactionDto = createMockTransactionDto()

      mockSupabase.single.mockResolvedValue({
        data: mockTransaction,
        error: null,
      })

      const result = await repository.create(transactionDto)

      expect(result).toEqual(mockTransaction)
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolio_id: transactionDto.portfolio_id,
          ticker: transactionDto.ticker,
          action: transactionDto.action,
          quantity: transactionDto.quantity,
          price: transactionDto.price,
          total_amount: transactionDto.total_amount,
        })
      )
    })

    it('should handle optional fields as null', async () => {
      const transactionDto = createMockTransactionDto({
        fee: undefined,
        source_id: undefined,
        notes: undefined,
      })

      mockSupabase.single.mockResolvedValue({
        data: { ...mockTransaction, fee: null, source_id: null, notes: null },
        error: null,
      })

      await repository.create(transactionDto)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          fee: null,
          source_id: null,
          notes: null,
        })
      )
    })

    it('should create buy transaction', async () => {
      const buyDto = createMockTransactionDto({ action: 'buy' })

      mockSupabase.single.mockResolvedValue({
        data: { ...mockTransaction, action: 'buy' },
        error: null,
      })

      const result = await repository.create(buyDto)

      expect(result.action).toBe('buy')
    })

    it('should create sell transaction', async () => {
      const sellDto = createMockTransactionDto({ action: 'sell' })

      mockSupabase.single.mockResolvedValue({
        data: { ...mockTransaction, action: 'sell' },
        error: null,
      })

      const result = await repository.create(sellDto)

      expect(result.action).toBe('sell')
    })

    it('should create dividend transaction', async () => {
      const dividendDto = createMockTransactionDto({ action: 'dividend', quantity: 0 })

      mockSupabase.single.mockResolvedValue({
        data: { ...mockTransaction, action: 'dividend' },
        error: null,
      })

      const result = await repository.create(dividendDto)

      expect(result.action).toBe('dividend')
    })

    it('should throw AppError on insert failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: 'INSERT_ERROR' },
      })

      await expect(repository.create(createMockTransactionDto())).rejects.toThrow(AppError)
    })
  })

  describe('createMany', () => {
    it('should create multiple transactions in bulk', async () => {
      const transactions = [
        createMockTransactionDto({ ticker: 'AAPL_US' }),
        createMockTransactionDto({ ticker: 'GOOGL_US' }),
        createMockTransactionDto({ ticker: 'MSFT_US' }),
      ]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.createMany(transactions)

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ ticker: 'AAPL_US' }),
          expect.objectContaining({ ticker: 'GOOGL_US' }),
          expect.objectContaining({ ticker: 'MSFT_US' }),
        ])
      )
    })

    it('should handle empty array without making database call', async () => {
      await repository.createMany([])

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should convert undefined optional fields to null', async () => {
      const transactions = [
        createMockTransactionDto({
          fee: undefined,
          source_id: undefined,
          notes: undefined,
        }),
      ]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.createMany(transactions)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            fee: null,
            source_id: null,
            notes: null,
          }),
        ])
      )
    })

    it('should throw AppError on bulk insert failure', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: null,
          error: { message: 'Bulk insert failed', code: 'BULK_ERROR' },
        }).then(resolve)
      )

      await expect(repository.createMany([createMockTransactionDto()])).rejects.toThrow(AppError)
    })
  })

  describe('update', () => {
    it('should update a transaction', async () => {
      const updates = {
        quantity: 15,
        price: 160,
        total_amount: 2400,
        fee: 2.0,
        notes: 'Updated notes',
      }

      mockSupabase.single.mockResolvedValue({
        data: { ...mockTransaction, ...updates },
        error: null,
      })

      const result = await repository.update('transaction-1', updates)

      expect(result).toEqual({ ...mockTransaction, ...updates })
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(mockSupabase.update).toHaveBeenCalledWith(updates)
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'transaction-1')
    })

    it('should handle partial updates', async () => {
      const updates = {
        notes: 'Only updating notes',
      }

      mockSupabase.single.mockResolvedValue({
        data: { ...mockTransaction, ...updates },
        error: null,
      })

      await repository.update('transaction-1', updates)

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Only updating notes' })
      )
    })

    it('should throw AppError on update failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed', code: 'UPDATE_ERROR' },
      })

      await expect(repository.update('transaction-1', { notes: 'Test' })).rejects.toThrow(AppError)
    })
  })

  describe('delete', () => {
    it('should delete a transaction by id', async () => {
      // DELETE operations return { data: null, error: null } on success
      // The executeDelete method handles this correctly
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.delete('transaction-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'transaction-1')
    })

    it('should throw AppError on delete failure', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: null,
          error: { message: 'Delete failed', code: 'DELETE_ERROR' },
        }).then(resolve)
      )

      await expect(repository.delete('transaction-1')).rejects.toThrow(AppError)
    })
  })

  describe('deleteBySource', () => {
    it('should delete all transactions from a specific source', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.deleteBySource('portfolio-1', 'trading212')

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('source', 'trading212')
    })

    it('should work for each external source', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.deleteBySource('portfolio-1', 'kraken')
      expect(mockSupabase.eq).toHaveBeenCalledWith('source', 'kraken')
    })

    it('should throw AppError on delete failure', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: null,
          error: { message: 'Delete failed', code: 'DELETE_ERROR' },
        }).then(resolve)
      )

      await expect(repository.deleteBySource('portfolio-1', 'trading212')).rejects.toThrow(AppError)
    })
  })

  describe('existsBySourceId', () => {
    it('should return true when transaction exists with source_id', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null, count: 1 }).then(resolve)
      )

      const result = await repository.existsBySourceId('portfolio-1', 'ext-123')

      expect(result).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(mockSupabase.select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('source_id', 'ext-123')
    })

    it('should return false when transaction does not exist', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(resolve)
      )

      const result = await repository.existsBySourceId('portfolio-1', 'nonexistent')

      expect(result).toBe(false)
    })

    it('should throw AppError on query failure', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: null,
          error: { message: 'Query failed', code: 'QUERY_ERROR' },
          count: null,
        }).then(resolve)
      )

      await expect(repository.existsBySourceId('portfolio-1', 'ext-123')).rejects.toThrow(AppError)
    })
  })

  describe('integration scenarios', () => {
    it('should handle sync workflow: check existence then create if not exists', async () => {
      // Check if transaction exists
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(resolve)
      )

      const exists = await repository.existsBySourceId('portfolio-1', 'ext-123')
      expect(exists).toBe(false)

      // Create transaction since it doesn't exist
      mockSupabase.single.mockResolvedValue({
        data: mockTransaction,
        error: null,
      })

      const created = await repository.create(
        createMockTransactionDto({ source_id: 'ext-123', source: 'trading212' })
      )

      expect(created).toBeDefined()
    })

    it('should handle bulk sync: delete by source then create many', async () => {
      // Delete old transactions
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.deleteBySource('portfolio-1', 'trading212')

      // Create new transactions
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      const newTransactions = [
        createMockTransactionDto({ source: 'trading212', source_id: 'ext-1' }),
        createMockTransactionDto({ source: 'trading212', source_id: 'ext-2' }),
      ]

      await repository.createMany(newTransactions)

      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it('should handle manual transaction workflow: create, update, delete', async () => {
      // Create
      mockSupabase.single.mockResolvedValue({
        data: mockTransaction,
        error: null,
      })

      const created = await repository.create(createMockTransactionDto())
      expect(created.id).toBe('transaction-1')

      // Update
      mockSupabase.single.mockResolvedValue({
        data: { ...mockTransaction, notes: 'Updated' },
        error: null,
      })

      const updated = await repository.update('transaction-1', { notes: 'Updated' })
      expect(updated.notes).toBe('Updated')

      // Delete
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.delete('transaction-1')
      expect(mockSupabase.delete).toHaveBeenCalled()
    })
  })
})
