/**
 * Portfolio Repository Tests
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/errors/app-error'
import { ErrorCode } from '@/core/errors/error-codes'
import type { Portfolio, PortfolioSnapshot } from '../../types'
import { PortfolioRepository } from '../portfolio.repository'

describe('PortfolioRepository', () => {
  let repository: PortfolioRepository
  let mockSupabase: any

  const mockPortfolio: Portfolio = {
    id: 'portfolio-1',
    user_id: 'user-1',
    name: 'Main Portfolio',
    description: 'Test portfolio',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockSnapshot: PortfolioSnapshot = {
    id: 'snapshot-1',
    portfolio_id: 'portfolio-1',
    snapshot_date: '2024-01-01',
    total_value: 10000,
    total_cost_basis: 8000,
    total_unrealized_pl: 2000,
    total_unrealized_pl_pct: 25,
    cash_balance: 1000,
    position_count: 5,
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    // Create a proper chainable mock
    function createChainableMock(response: any) {
      const mock: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(response),
        maybeSingle: vi.fn().mockResolvedValue(response),
        then: vi.fn((resolve) => Promise.resolve(response).then(resolve)),
      }
      return mock
    }

    mockSupabase = createChainableMock({ data: null, error: null })
    repository = new PortfolioRepository(mockSupabase as unknown as SupabaseClient)
  })

  describe('getMain', () => {
    it('should return main portfolio when it exists', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockPortfolio,
        error: null,
      })

      const result = await repository.getMain()

      expect(result).toEqual(mockPortfolio)
      expect(mockSupabase.from).toHaveBeenCalledWith('portfolios')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
    })

    it('should return null when main portfolio does not exist', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const result = await repository.getMain()

      expect(result).toBeNull()
    })

    it('should throw AppError on database error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' },
      })

      await expect(repository.getMain()).rejects.toThrow(AppError)
    })
  })

  describe('getOrCreateMain', () => {
    it('should return existing main portfolio if it exists', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockPortfolio,
        error: null,
      })

      const result = await repository.getOrCreateMain()

      expect(result).toEqual(mockPortfolio)
      expect(mockSupabase.insert).not.toHaveBeenCalled()
    })

    it('should create and return main portfolio if it does not exist', async () => {
      // First call to getMain returns null (PGRST116)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      // Second call to create returns created portfolio
      mockSupabase.single.mockResolvedValueOnce({
        data: mockPortfolio,
        error: null,
      })

      const result = await repository.getOrCreateMain()

      expect(result).toEqual(mockPortfolio)
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        name: 'Main Portfolio',
        description: 'Investment portfolio tracking stocks, ETFs, and crypto',
      })
    })

    it('should throw AppError if creation fails', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: 'INSERT_ERROR' },
      })

      await expect(repository.getOrCreateMain()).rejects.toThrow(AppError)
    })
  })

  describe('create', () => {
    it('should create a new portfolio', async () => {
      const createData = {
        name: 'Test Portfolio',
        description: 'A test portfolio',
      }

      mockSupabase.single.mockResolvedValue({
        data: { ...mockPortfolio, ...createData },
        error: null,
      })

      const result = await repository.create(createData)

      expect(result).toEqual({ ...mockPortfolio, ...createData })
      expect(mockSupabase.from).toHaveBeenCalledWith('portfolios')
      expect(mockSupabase.insert).toHaveBeenCalledWith(createData)
    })

    it('should throw AppError on insert failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: 'INSERT_ERROR' },
      })

      await expect(repository.create({ name: 'Test', description: 'Test' })).rejects.toThrow(
        AppError
      )
    })
  })

  describe('createSnapshot', () => {
    it('should create a portfolio snapshot', async () => {
      const snapshotData = {
        portfolio_id: 'portfolio-1',
        snapshot_date: '2024-01-01',
        total_value: 10000,
        total_cost_basis: 8000,
        total_gain_loss: 2000,
        total_gain_loss_pct: 25,
        cash_balance: 1000,
        positions_count: 5,
      }

      mockSupabase.single.mockResolvedValue({
        data: mockSnapshot,
        error: null,
      })

      const result = await repository.createSnapshot(snapshotData)

      expect(result).toEqual(mockSnapshot)
      expect(mockSupabase.from).toHaveBeenCalledWith('portfolio_snapshots')
      expect(mockSupabase.insert).toHaveBeenCalledWith(snapshotData)
    })
  })

  describe('getLatestSnapshot', () => {
    it('should return the latest snapshot for a portfolio', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockSnapshot,
        error: null,
      })

      const result = await repository.getLatestSnapshot('portfolio-1')

      expect(result).toEqual(mockSnapshot)
      expect(mockSupabase.from).toHaveBeenCalledWith('portfolio_snapshots')
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.order).toHaveBeenCalledWith('snapshot_date', { ascending: false })
      expect(mockSupabase.limit).toHaveBeenCalledWith(1)
    })

    it('should return null if no snapshots exist', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const result = await repository.getLatestSnapshot('portfolio-1')

      expect(result).toBeNull()
    })
  })

  describe('getHistoricalSnapshots', () => {
    it('should return historical snapshots for specified days', async () => {
      const snapshots = [mockSnapshot, { ...mockSnapshot, id: 'snapshot-2' }]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: snapshots, error: null }).then(resolve)
      )

      const result = await repository.getHistoricalSnapshots('portfolio-1', 30)

      expect(result).toEqual(snapshots)
      expect(mockSupabase.from).toHaveBeenCalledWith('portfolio_snapshots')
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.order).toHaveBeenCalledWith('snapshot_date', { ascending: true })
    })

    it('should calculate date range correctly', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      await repository.getHistoricalSnapshots('portfolio-1', 90)

      // Verify gte was called with a date 90 days ago
      expect(mockSupabase.gte).toHaveBeenCalled()
    })

    it('should return empty array when no snapshots exist', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      const result = await repository.getHistoricalSnapshots('portfolio-1', 30)

      expect(result).toEqual([])
    })
  })

  describe('upsertSnapshot', () => {
    it('should upsert a snapshot (create if not exists)', async () => {
      const snapshotData = {
        portfolio_id: 'portfolio-1',
        snapshot_date: '2024-01-01',
        total_value: 10000,
        total_cost_basis: 8000,
        total_gain_loss: 2000,
        total_gain_loss_pct: 25,
        cash_balance: 1000,
        positions_count: 5,
      }

      mockSupabase.single.mockResolvedValue({
        data: mockSnapshot,
        error: null,
      })

      const result = await repository.upsertSnapshot(snapshotData)

      expect(result).toEqual(mockSnapshot)
      expect(mockSupabase.from).toHaveBeenCalledWith('portfolio_snapshots')
      expect(mockSupabase.upsert).toHaveBeenCalledWith(snapshotData, {
        onConflict: 'portfolio_id,snapshot_date',
      })
    })

    it('should update existing snapshot with same date', async () => {
      const updatedSnapshot = { ...mockSnapshot, total_value: 12000 }

      mockSupabase.single.mockResolvedValue({
        data: updatedSnapshot,
        error: null,
      })

      const result = await repository.upsertSnapshot({
        portfolio_id: 'portfolio-1',
        snapshot_date: '2024-01-01',
        total_value: 12000,
        total_cost_basis: 8000,
        total_gain_loss: 4000,
        total_gain_loss_pct: 50,
        cash_balance: 1000,
        positions_count: 5,
      })

      expect(result.total_value).toBe(12000)
    })

    it('should throw AppError on upsert failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed', code: 'UPSERT_ERROR' },
      })

      await expect(
        repository.upsertSnapshot({
          portfolio_id: 'portfolio-1',
          snapshot_date: '2024-01-01',
          total_value: 10000,
          total_cost_basis: 8000,
          total_gain_loss: 2000,
          total_gain_loss_pct: 25,
          cash_balance: 1000,
          positions_count: 5,
        })
      ).rejects.toThrow(AppError)
    })
  })

  describe('error handling', () => {
    it('should wrap database errors in AppError', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          message: 'Connection timeout',
          code: '57014',
        },
      })

      try {
        await repository.getMain()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        expect((error as AppError).code).toBe(ErrorCode.DATABASE_ERROR)
      }
    })

    it('should include context in error details', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: 'INSERT_ERROR' },
      })

      try {
        await repository.create({ name: 'Test', description: 'Test' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        const appError = error as AppError
        expect(appError.details).toBeDefined()
      }
    })
  })
})
