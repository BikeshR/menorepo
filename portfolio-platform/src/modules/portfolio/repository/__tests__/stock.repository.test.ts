/**
 * Stock Repository Tests
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/errors/app-error'
import type { CreateStockDto, Stock } from '../../types'
import { StockRepository } from '../stock.repository'

describe('StockRepository', () => {
  let repository: StockRepository
  let mockSupabase: any

  const mockStock: Stock = {
    id: 'stock-1',
    portfolio_id: 'portfolio-1',
    ticker: 'AAPL_US',
    name: 'Apple Inc.',
    asset_type: 'stock',
    isin: 'US0378331005',
    currency: 'USD',
    quantity: 10,
    average_cost: 150,
    current_price: 180,
    gain_loss: 300,
    gain_loss_pct: 20,
    exchange: 'NASDAQ',
    country: 'US',
    region: 'Americas',
    initial_fill_date: '2024-01-01',
    last_synced_at: '2024-01-01T00:00:00Z',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    market_cap: 3000000000000,
    pe_ratio: 28.5,
    dividend_yield: 0.5,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const createMockStockDto = (overrides?: Partial<CreateStockDto>): CreateStockDto => ({
    portfolio_id: 'portfolio-1',
    ticker: 'AAPL_US',
    name: 'Apple Inc.',
    asset_type: 'stock',
    isin: 'US0378331005',
    currency: 'USD',
    quantity: 10,
    average_cost: 150,
    current_price: 180,
    gain_loss: 300,
    gain_loss_pct: 20,
    exchange: 'NASDAQ',
    country: 'US',
    region: 'Americas',
    initial_fill_date: '2024-01-01',
    last_synced_at: '2024-01-01T00:00:00Z',
    ...overrides,
  })

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
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(response),
        maybeSingle: vi.fn().mockResolvedValue(response),
        then: vi.fn((resolve) => Promise.resolve(response).then(resolve)),
      }
      return mock
    }

    mockSupabase = createChainableMock({ data: null, error: null })
    repository = new StockRepository(mockSupabase as unknown as SupabaseClient)
  })

  describe('getAllByPortfolio', () => {
    it('should return all stocks for a portfolio ordered by price', async () => {
      const stocks = [mockStock, { ...mockStock, id: 'stock-2', ticker: 'GOOGL_US' }]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: stocks, error: null }).then(resolve)
      )

      const result = await repository.getAllByPortfolio('portfolio-1')

      expect(result).toEqual(stocks)
      expect(mockSupabase.from).toHaveBeenCalledWith('stocks')
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.order).toHaveBeenCalledWith('current_price', { ascending: false })
    })

    it('should return empty array when no stocks exist', async () => {
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

  describe('getByTicker', () => {
    it('should return stock by ticker', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockStock,
        error: null,
      })

      const result = await repository.getByTicker('portfolio-1', 'AAPL_US')

      expect(result).toEqual(mockStock)
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('ticker', 'AAPL_US')
    })

    it('should return null when stock not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Postgres "no rows" error
      })

      const result = await repository.getByTicker('portfolio-1', 'NONEXISTENT')

      expect(result).toBeNull()
    })
  })

  describe('upsert', () => {
    it('should upsert a stock position', async () => {
      const stockDto = createMockStockDto()

      mockSupabase.single.mockResolvedValue({
        data: mockStock,
        error: null,
      })

      const result = await repository.upsert(stockDto)

      expect(result).toEqual(mockStock)
      expect(mockSupabase.from).toHaveBeenCalledWith('stocks')
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolio_id: stockDto.portfolio_id,
          ticker: stockDto.ticker,
          name: stockDto.name,
          quantity: stockDto.quantity,
        }),
        { onConflict: 'portfolio_id,ticker' }
      )
    })

    it('should handle optional fields as null', async () => {
      const stockDto = createMockStockDto({
        sector: undefined,
        industry: undefined,
        market_cap: undefined,
      })

      mockSupabase.single.mockResolvedValue({
        data: { ...mockStock, sector: null, industry: null, market_cap: null },
        error: null,
      })

      const _result = await repository.upsert(stockDto)

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: null,
          industry: null,
          market_cap: null,
        }),
        { onConflict: 'portfolio_id,ticker' }
      )
    })

    it('should throw AppError on upsert failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed', code: 'UPSERT_ERROR' },
      })

      await expect(repository.upsert(createMockStockDto())).rejects.toThrow(AppError)
    })
  })

  describe('upsertMany', () => {
    it('should upsert multiple stocks in bulk', async () => {
      const stocks = [
        createMockStockDto({ ticker: 'AAPL_US' }),
        createMockStockDto({ ticker: 'GOOGL_US' }),
        createMockStockDto({ ticker: 'MSFT_US' }),
      ]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.upsertMany(stocks)

      expect(mockSupabase.from).toHaveBeenCalledWith('stocks')
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ ticker: 'AAPL_US' }),
          expect.objectContaining({ ticker: 'GOOGL_US' }),
          expect.objectContaining({ ticker: 'MSFT_US' }),
        ]),
        { onConflict: 'portfolio_id,ticker' }
      )
    })

    it('should handle empty array without making database call', async () => {
      await repository.upsertMany([])

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should convert undefined optional fields to null', async () => {
      const stocks = [
        createMockStockDto({
          sector: undefined,
          industry: undefined,
        }),
      ]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.upsertMany(stocks)

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            sector: null,
            industry: null,
          }),
        ]),
        { onConflict: 'portfolio_id,ticker' }
      )
    })

    it('should throw AppError on bulk upsert failure', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: null,
          error: { message: 'Bulk upsert failed', code: 'BULK_ERROR' },
        }).then(resolve)
      )

      await expect(repository.upsertMany([createMockStockDto()])).rejects.toThrow(AppError)
    })
  })

  describe('updateFundamentals', () => {
    it('should update stock fundamentals', async () => {
      const fundamentals = {
        sector: 'Technology',
        industry: 'Software',
        marketCap: 2000000000000,
        peRatio: 25.5,
        dividendYield: 1.2,
      }

      mockSupabase.single.mockResolvedValue({
        data: { ...mockStock, ...fundamentals },
        error: null,
      })

      const _result = await repository.updateFundamentals('portfolio-1', 'AAPL_US', fundamentals)

      expect(mockSupabase.from).toHaveBeenCalledWith('stocks')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        sector: fundamentals.sector,
        industry: fundamentals.industry,
        market_cap: fundamentals.marketCap,
        pe_ratio: fundamentals.peRatio,
        dividend_yield: fundamentals.dividendYield,
      })
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('ticker', 'AAPL_US')
    })

    it('should handle partial fundamental updates', async () => {
      const fundamentals = {
        sector: 'Technology',
        // other fields undefined
      }

      mockSupabase.single.mockResolvedValue({
        data: mockStock,
        error: null,
      })

      await repository.updateFundamentals('portfolio-1', 'AAPL_US', fundamentals)

      expect(mockSupabase.update).toHaveBeenCalledWith({
        sector: 'Technology',
        industry: null,
        market_cap: null,
        pe_ratio: null,
        dividend_yield: null,
      })
    })

    it('should throw AppError on update failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed', code: 'UPDATE_ERROR' },
      })

      await expect(repository.updateFundamentals('portfolio-1', 'AAPL_US', {})).rejects.toThrow(
        AppError
      )
    })
  })

  describe('deleteAllByPortfolio', () => {
    it('should delete all stocks for a portfolio', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.deleteAllByPortfolio('portfolio-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('stocks')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
    })

    it('should throw AppError on delete failure', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: null,
          error: { message: 'Delete failed', code: 'DELETE_ERROR' },
        }).then(resolve)
      )

      await expect(repository.deleteAllByPortfolio('portfolio-1')).rejects.toThrow(AppError)
    })
  })

  describe('getStocksNeedingEnrichment', () => {
    it('should return stocks with missing sector or industry', async () => {
      const stocksNeedingEnrichment = [
        { ...mockStock, sector: null },
        { ...mockStock, id: 'stock-2', industry: null },
      ]

      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: stocksNeedingEnrichment, error: null }).then(resolve)
      )

      const result = await repository.getStocksNeedingEnrichment('portfolio-1')

      expect(result).toEqual(stocksNeedingEnrichment)
      expect(mockSupabase.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1')
      expect(mockSupabase.or).toHaveBeenCalledWith('sector.is.null,industry.is.null')
      expect(mockSupabase.order).toHaveBeenCalledWith('current_price', { ascending: false })
    })

    it('should respect limit parameter', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      await repository.getStocksNeedingEnrichment('portfolio-1', 5)

      expect(mockSupabase.limit).toHaveBeenCalledWith(5)
    })

    it('should not apply limit when not provided', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      await repository.getStocksNeedingEnrichment('portfolio-1')

      expect(mockSupabase.limit).not.toHaveBeenCalled()
    })

    it('should return empty array when all stocks are enriched', async () => {
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )

      const result = await repository.getStocksNeedingEnrichment('portfolio-1')

      expect(result).toEqual([])
    })
  })

  describe('integration scenarios', () => {
    it('should handle sync workflow: upsertMany then getAllByPortfolio', async () => {
      const newStocks = [
        createMockStockDto({ ticker: 'AAPL_US' }),
        createMockStockDto({ ticker: 'GOOGL_US' }),
      ]

      // Upsert
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )

      await repository.upsertMany(newStocks)

      // Get all
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: newStocks.map((dto, i) => ({ ...mockStock, id: `stock-${i}`, ticker: dto.ticker })),
          error: null,
        }).then(resolve)
      )

      const result = await repository.getAllByPortfolio('portfolio-1')

      expect(result).toHaveLength(2)
    })

    it('should handle enrichment workflow: get stocks needing enrichment then update', async () => {
      // Get stocks needing enrichment
      mockSupabase.then = vi.fn((resolve) =>
        Promise.resolve({
          data: [{ ...mockStock, sector: null, industry: null }],
          error: null,
        }).then(resolve)
      )

      const stocksToEnrich = await repository.getStocksNeedingEnrichment('portfolio-1', 5)

      expect(stocksToEnrich).toHaveLength(1)

      // Update fundamentals
      mockSupabase.single.mockResolvedValue({
        data: { ...mockStock, sector: 'Technology', industry: 'Software' },
        error: null,
      })

      const updated = await repository.updateFundamentals('portfolio-1', 'AAPL_US', {
        sector: 'Technology',
        industry: 'Software',
      })

      expect(updated.sector).toBe('Technology')
      expect(updated.industry).toBe('Software')
    })
  })
})
