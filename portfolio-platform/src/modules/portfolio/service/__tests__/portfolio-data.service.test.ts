/**
 * Portfolio Data Service Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortfolioRepository } from '../../repository/portfolio.repository'
import type { StockRepository } from '../../repository/stock.repository'
import { PortfolioDataService } from '../portfolio-data.service'

describe('PortfolioDataService', () => {
  let service: PortfolioDataService
  let mockPortfolioRepo: any
  let mockStockRepo: any

  const mockPortfolio = {
    id: 'portfolio-1',
    user_id: 'user-1',
    name: 'Main Portfolio',
    description: 'Test portfolio',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockStocks = [
    {
      id: 'stock-1',
      portfolio_id: 'portfolio-1',
      ticker: 'AAPL_US',
      name: 'Apple Inc.',
      asset_type: 'stock',
      quantity: 10,
      average_cost: 100,
      current_price: 120,
      gain_loss: 200,
      gain_loss_pct: 20,
      sector: 'Technology',
      industry: 'Consumer Electronics',
      market_cap: 3000000000000,
      pe_ratio: 28.5,
      dividend_yield: 0.5,
      currency: 'USD',
      exchange: 'NASDAQ',
      country: 'US',
      region: 'Americas',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'stock-2',
      portfolio_id: 'portfolio-1',
      ticker: 'GOOGL_US',
      name: 'Alphabet Inc.',
      asset_type: 'stock',
      quantity: 5,
      average_cost: 2000,
      current_price: 2200,
      gain_loss: 1000,
      gain_loss_pct: 10,
      sector: 'Technology',
      industry: 'Internet',
      market_cap: 1800000000000,
      pe_ratio: 25.0,
      dividend_yield: null,
      currency: 'USD',
      exchange: 'NASDAQ',
      country: 'US',
      region: 'Americas',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]

  const mockSnapshot = {
    id: 'snapshot-1',
    portfolio_id: 'portfolio-1',
    snapshot_date: '2024-01-01',
    total_value: 12200,
    total_cost_basis: 11000,
    total_gain_loss: 1200,
    total_gain_loss_pct: 10.91,
    cash_balance: 500,
    positions_count: 2,
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    mockPortfolioRepo = {
      getOrCreateMain: vi.fn(),
      getLatestSnapshot: vi.fn(),
      getHistoricalSnapshots: vi.fn(),
    }

    mockStockRepo = {
      getAllByPortfolio: vi.fn(),
      getByTicker: vi.fn(),
    }

    service = new PortfolioDataService(
      mockPortfolioRepo as unknown as PortfolioRepository,
      mockStockRepo as unknown as StockRepository
    )
  })

  describe('getSummary', () => {
    it('should return portfolio summary with all stocks', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getAllByPortfolio.mockResolvedValue(mockStocks)
      mockPortfolioRepo.getLatestSnapshot.mockResolvedValue(mockSnapshot)

      const result = await service.getSummary()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        portfolio: mockPortfolio,
        totalValue: 12200, // (10 * 120) + (5 * 2200)
        cashBalance: 500,
        totalCostBasis: 11000, // (10 * 100) + (5 * 2000)
        totalGainLoss: 1200, // 12200 - 11000
        totalGainLossPct: expect.closeTo(10.91, 2), // 1200 / 11000 * 100
        positionsCount: 2,
        stocks: mockStocks,
      })
    })

    it('should calculate summary for empty portfolio', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getAllByPortfolio.mockResolvedValue([])
      mockPortfolioRepo.getLatestSnapshot.mockResolvedValue(null)

      const result = await service.getSummary()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        portfolio: mockPortfolio,
        totalValue: 0,
        cashBalance: 0,
        totalCostBasis: 0,
        totalGainLoss: 0,
        totalGainLossPct: 0,
        positionsCount: 0,
        stocks: [],
      })
    })

    it('should handle missing snapshot gracefully', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getAllByPortfolio.mockResolvedValue(mockStocks)
      mockPortfolioRepo.getLatestSnapshot.mockResolvedValue(null)

      const result = await service.getSummary()

      expect(result.success).toBe(true)
      expect(result.data?.cashBalance).toBe(0) // Default when no snapshot
    })

    it('should calculate gain/loss percentage correctly', async () => {
      const singleStock = [
        {
          ...mockStocks[0],
          quantity: 10,
          average_cost: 100,
          current_price: 150,
        },
      ]

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getAllByPortfolio.mockResolvedValue(singleStock)
      mockPortfolioRepo.getLatestSnapshot.mockResolvedValue(null)

      const result = await service.getSummary()

      expect(result.success).toBe(true)
      expect(result.data?.totalValue).toBe(1500) // 10 * 150
      expect(result.data?.totalCostBasis).toBe(1000) // 10 * 100
      expect(result.data?.totalGainLoss).toBe(500) // 1500 - 1000
      expect(result.data?.totalGainLossPct).toBe(50) // 500 / 1000 * 100
    })

    it('should handle zero cost basis without division by zero', async () => {
      const zeroCostStock = [
        {
          ...mockStocks[0],
          quantity: 10,
          average_cost: 0,
          current_price: 100,
        },
      ]

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getAllByPortfolio.mockResolvedValue(zeroCostStock)
      mockPortfolioRepo.getLatestSnapshot.mockResolvedValue(null)

      const result = await service.getSummary()

      expect(result.success).toBe(true)
      expect(result.data?.totalGainLossPct).toBe(0) // Should not be NaN or Infinity
    })

    it('should return error Result on repository failure', async () => {
      mockPortfolioRepo.getOrCreateMain.mockRejectedValue(new Error('Database connection failed'))

      const result = await service.getSummary()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('getSummary failed')
    })
  })

  describe('getHistory', () => {
    it('should return historical snapshots', async () => {
      const snapshots = [
        {
          ...mockSnapshot,
          snapshot_date: '2024-01-01',
          total_value: 10000,
        },
        {
          ...mockSnapshot,
          id: 'snapshot-2',
          snapshot_date: '2024-01-02',
          total_value: 10500,
        },
        {
          ...mockSnapshot,
          id: 'snapshot-3',
          snapshot_date: '2024-01-03',
          total_value: 11000,
        },
      ]

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockPortfolioRepo.getHistoricalSnapshots.mockResolvedValue(snapshots)

      const result = await service.getHistory(30)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
      expect(result.data).toEqual([
        {
          date: '2024-01-01',
          totalValue: 10000,
          cashBalance: mockSnapshot.cash_balance,
          totalCostBasis: mockSnapshot.total_cost_basis,
          totalGainLoss: mockSnapshot.total_gain_loss,
          totalGainLossPct: mockSnapshot.total_gain_loss_pct,
          positionsCount: mockSnapshot.positions_count,
        },
        {
          date: '2024-01-02',
          totalValue: 10500,
          cashBalance: mockSnapshot.cash_balance,
          totalCostBasis: mockSnapshot.total_cost_basis,
          totalGainLoss: mockSnapshot.total_gain_loss,
          totalGainLossPct: mockSnapshot.total_gain_loss_pct,
          positionsCount: mockSnapshot.positions_count,
        },
        {
          date: '2024-01-03',
          totalValue: 11000,
          cashBalance: mockSnapshot.cash_balance,
          totalCostBasis: mockSnapshot.total_cost_basis,
          totalGainLoss: mockSnapshot.total_gain_loss,
          totalGainLossPct: mockSnapshot.total_gain_loss_pct,
          positionsCount: mockSnapshot.positions_count,
        },
      ])
    })

    it('should respect days parameter', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockPortfolioRepo.getHistoricalSnapshots.mockResolvedValue([])

      await service.getHistory(90)

      expect(mockPortfolioRepo.getHistoricalSnapshots).toHaveBeenCalledWith('portfolio-1', 90)
    })

    it('should use default days parameter', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockPortfolioRepo.getHistoricalSnapshots.mockResolvedValue([])

      await service.getHistory()

      expect(mockPortfolioRepo.getHistoricalSnapshots).toHaveBeenCalledWith('portfolio-1', 30)
    })

    it('should return empty array when no snapshots exist', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockPortfolioRepo.getHistoricalSnapshots.mockResolvedValue([])

      const result = await service.getHistory(30)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should return error Result on repository failure', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockPortfolioRepo.getHistoricalSnapshots.mockRejectedValue(new Error('Query timeout'))

      const result = await service.getHistory(30)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getPositionDetails', () => {
    it('should return position details for existing stock', async () => {
      const stock = mockStocks[0]

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getByTicker.mockResolvedValue(stock)

      const result = await service.getPositionDetails('AAPL_US')

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        stock,
        fundamentals: {
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: 3000000000000,
          peRatio: 28.5,
          dividendYield: 0.5,
          description: null,
        },
      })
    })

    it('should handle stock with null fundamentals', async () => {
      const stockWithoutFundamentals = {
        ...mockStocks[0],
        sector: null,
        industry: null,
        market_cap: null,
        pe_ratio: null,
        dividend_yield: null,
      }

      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getByTicker.mockResolvedValue(stockWithoutFundamentals)

      const result = await service.getPositionDetails('AAPL_US')

      expect(result.success).toBe(true)
      expect(result.data?.fundamentals).toEqual({
        sector: null,
        industry: null,
        marketCap: null,
        peRatio: null,
        dividendYield: null,
        description: null,
      })
    })

    it('should return error when position not found', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getByTicker.mockResolvedValue(null)

      const result = await service.getPositionDetails('NONEXISTENT_US')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('Position for ticker NONEXISTENT_US')
    })

    it('should pass ticker to repository correctly', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getByTicker.mockResolvedValue(mockStocks[0])

      await service.getPositionDetails('GOOGL_US')

      expect(mockStockRepo.getByTicker).toHaveBeenCalledWith('portfolio-1', 'GOOGL_US')
    })

    it('should return error Result on repository failure', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getByTicker.mockRejectedValue(new Error('Database error'))

      const result = await service.getPositionDetails('AAPL_US')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Result type consistency', () => {
    it('should always return Result type for getSummary', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getAllByPortfolio.mockResolvedValue(mockStocks)
      mockPortfolioRepo.getLatestSnapshot.mockResolvedValue(mockSnapshot)

      const result = await service.getSummary()

      expect(result).toHaveProperty('success')
      if (result.success) {
        expect(result).toHaveProperty('data')
      } else {
        expect(result).toHaveProperty('error')
      }
    })

    it('should always return Result type for getHistory', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockPortfolioRepo.getHistoricalSnapshots.mockResolvedValue([])

      const result = await service.getHistory()

      expect(result).toHaveProperty('success')
      if (result.success) {
        expect(result).toHaveProperty('data')
      } else {
        expect(result).toHaveProperty('error')
      }
    })

    it('should always return Result type for getPositionDetails', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)
      mockStockRepo.getByTicker.mockResolvedValue(mockStocks[0])

      const result = await service.getPositionDetails('AAPL_US')

      expect(result).toHaveProperty('success')
      if (result.success) {
        expect(result).toHaveProperty('data')
      } else {
        expect(result).toHaveProperty('error')
      }
    })
  })
})
