/**
 * Sync Service Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trading212Client } from '@/lib/integrations/trading212'
import type { PortfolioRepository } from '../../repository/portfolio.repository'
import type { StockRepository } from '../../repository/stock.repository'
import { SyncService } from '../sync.service'

// Mock the trading212 utilities
vi.mock('@/lib/integrations/trading212', async () => {
  const actual = await vi.importActual('@/lib/integrations/trading212')
  return {
    ...actual,
    parseTrading212Ticker: (ticker: string) => ({
      symbol: ticker.split('_')[0],
      exchange: ticker.split('_')[1] || 'US',
    }),
    exchangeToCountry: (exchange: string) => {
      const map: Record<string, string> = {
        US: 'United States',
        LSE: 'United Kingdom',
      }
      return map[exchange] || 'Unknown'
    },
    countryToRegion: (country: string) => {
      const map: Record<string, string> = {
        'United States': 'Americas',
        'United Kingdom': 'Europe',
      }
      return map[country] || 'Other'
    },
    normalizeCurrency: (code: string) => ({
      baseCurrency: code === 'GBX' ? 'GBP' : code,
      conversionRate: code === 'GBX' ? 100 : 1,
    }),
    convertToBaseCurrency: (amount: number, code: string) => {
      return code === 'GBX' ? amount / 100 : amount
    },
  }
})

describe('SyncService', () => {
  let service: SyncService
  let mockPortfolioRepo: any
  let mockStockRepo: any
  let mockTrading212Client: any

  const mockPortfolio = {
    id: 'portfolio-1',
    user_id: 'user-1',
    name: 'Main Portfolio',
    description: 'Test portfolio',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    // Mock PortfolioRepository
    mockPortfolioRepo = {
      getOrCreateMain: vi.fn(),
      upsertSnapshot: vi.fn(),
    }

    // Mock StockRepository
    mockStockRepo = {
      upsertMany: vi.fn(),
    }

    // Mock Trading212Client
    mockTrading212Client = {
      getPortfolio: vi.fn(),
      getCash: vi.fn(),
      getInstruments: vi.fn(),
    }

    service = new SyncService(
      mockPortfolioRepo as unknown as PortfolioRepository,
      mockStockRepo as unknown as StockRepository,
      mockTrading212Client as unknown as Trading212Client
    )
  })

  describe('syncTradingPortfolio', () => {
    it('should sync portfolio successfully', async () => {
      // Setup mocks
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          quantity: 10,
          averagePrice: 150,
          currentPrice: 180,
          ppl: 300,
          initialFillDate: '2024-01-01',
        },
        {
          ticker: 'GOOGL_US',
          quantity: 5,
          averagePrice: 2800,
          currentPrice: 3000,
          ppl: 1000,
          initialFillDate: '2024-01-02',
        },
      ])

      mockTrading212Client.getCash.mockResolvedValue({
        total: 1000,
      })

      mockTrading212Client.getInstruments.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          name: 'Apple Inc.',
          isin: 'US0378331005',
          currencyCode: 'USD',
          type: 'STOCK',
        },
        {
          ticker: 'GOOGL_US',
          name: 'Alphabet Inc.',
          isin: 'US02079K3059',
          currencyCode: 'USD',
          type: 'STOCK',
        },
      ])

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({
        id: 'snapshot-1',
        portfolio_id: 'portfolio-1',
        snapshot_date: '2024-01-01',
        total_value: 16800,
        cash_balance: 1000,
      })

      // Execute
      const result = await service.syncTradingPortfolio()

      // Verify
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        positionsSynced: 2,
        totalValue: 16800, // (10 * 180) + (5 * 3000)
        snapshotCreated: true,
      })

      expect(mockPortfolioRepo.getOrCreateMain).toHaveBeenCalled()
      expect(mockTrading212Client.getPortfolio).toHaveBeenCalled()
      expect(mockTrading212Client.getCash).toHaveBeenCalled()
      expect(mockTrading212Client.getInstruments).toHaveBeenCalled()
      expect(mockStockRepo.upsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            ticker: 'AAPL_US',
            quantity: 10,
            average_cost: 150,
            current_price: 180,
          }),
          expect.objectContaining({
            ticker: 'GOOGL_US',
            quantity: 5,
            average_cost: 2800,
            current_price: 3000,
          }),
        ])
      )
      expect(mockPortfolioRepo.upsertSnapshot).toHaveBeenCalled()
    })

    it('should handle ETF asset type correctly', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([
        {
          ticker: 'SPY_US',
          quantity: 10,
          averagePrice: 400,
          currentPrice: 420,
          ppl: 200,
        },
      ])

      mockTrading212Client.getCash.mockResolvedValue({ total: 0 })

      mockTrading212Client.getInstruments.mockResolvedValue([
        {
          ticker: 'SPY_US',
          name: 'SPDR S&P 500 ETF',
          isin: 'US78462F1030',
          currencyCode: 'USD',
          type: 'ETF',
        },
      ])

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({})

      const result = await service.syncTradingPortfolio()

      expect(result.success).toBe(true)
      expect(mockStockRepo.upsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            ticker: 'SPY_US',
            asset_type: 'etf',
          }),
        ])
      )
    })

    it('should normalize GBX currency to GBP', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([
        {
          ticker: 'LLOY_LSE',
          quantity: 100,
          averagePrice: 5000, // 50.00 GBP in pence
          currentPrice: 5500, // 55.00 GBP in pence
          ppl: 5000, // 50.00 GBP in pence
        },
      ])

      mockTrading212Client.getCash.mockResolvedValue({ total: 0 })

      mockTrading212Client.getInstruments.mockResolvedValue([
        {
          ticker: 'LLOY_LSE',
          name: 'Lloyds Banking Group',
          isin: 'GB0008706128',
          currencyCode: 'GBX', // Pence
          type: 'STOCK',
        },
      ])

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({})

      const result = await service.syncTradingPortfolio()

      expect(result.success).toBe(true)
      expect(mockStockRepo.upsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            ticker: 'LLOY_LSE',
            currency: 'GBP', // Normalized
            average_cost: 50, // Converted from pence
            current_price: 55, // Converted from pence
            gain_loss: 50, // Converted from pence
          }),
        ])
      )
    })

    it('should calculate gain/loss percentage correctly', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          quantity: 10,
          averagePrice: 100,
          currentPrice: 120,
          ppl: 200,
        },
      ])

      mockTrading212Client.getCash.mockResolvedValue({ total: 0 })
      mockTrading212Client.getInstruments.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          name: 'Apple Inc.',
          currencyCode: 'USD',
          type: 'STOCK',
        },
      ])

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({})

      const result = await service.syncTradingPortfolio()

      expect(result.success).toBe(true)
      expect(mockStockRepo.upsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            gain_loss_pct: 20, // (120 - 100) / 100 * 100 = 20%
          }),
        ])
      )
    })

    it('should parse ticker for exchange and country data', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          quantity: 10,
          averagePrice: 150,
          currentPrice: 180,
          ppl: 300,
        },
      ])

      mockTrading212Client.getCash.mockResolvedValue({ total: 0 })
      mockTrading212Client.getInstruments.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          name: 'Apple Inc.',
          currencyCode: 'USD',
          type: 'STOCK',
        },
      ])

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({})

      const result = await service.syncTradingPortfolio()

      expect(result.success).toBe(true)
      expect(mockStockRepo.upsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            exchange: 'US',
            country: 'United States',
            region: 'Americas',
          }),
        ])
      )
    })

    it('should create snapshot with correct calculations', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          quantity: 10,
          averagePrice: 100,
          currentPrice: 120,
          ppl: 200,
        },
        {
          ticker: 'GOOGL_US',
          quantity: 5,
          averagePrice: 2000,
          currentPrice: 2200,
          ppl: 1000,
        },
      ])

      mockTrading212Client.getCash.mockResolvedValue({ total: 500 })
      mockTrading212Client.getInstruments.mockResolvedValue([
        { ticker: 'AAPL_US', name: 'Apple', currencyCode: 'USD', type: 'STOCK' },
        { ticker: 'GOOGL_US', name: 'Alphabet', currencyCode: 'USD', type: 'STOCK' },
      ])

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({})

      await service.syncTradingPortfolio()

      expect(mockPortfolioRepo.upsertSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolio_id: 'portfolio-1',
          total_value: 12200, // (10 * 120) + (5 * 2200) = 1200 + 11000
          cash_balance: 500,
          total_cost_basis: 11000, // (10 * 100) + (5 * 2000) = 1000 + 10000
          total_gain_loss: 1200, // 12200 - 11000
          total_gain_loss_pct: expect.closeTo(10.91, 2), // 1200 / 11000 * 100
          positions_count: 2,
        })
      )
    })

    it('should handle empty portfolio', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([])
      mockTrading212Client.getCash.mockResolvedValue({ total: 1000 })
      mockTrading212Client.getInstruments.mockResolvedValue([])

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({})

      const result = await service.syncTradingPortfolio()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        positionsSynced: 0,
        totalValue: 0,
        snapshotCreated: true,
      })

      // upsertMany should still be called with empty array (it handles this case)
      expect(mockStockRepo.upsertMany).toHaveBeenCalledWith([])
    })

    it('should handle API errors and return Result with error', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockRejectedValue(new Error('API connection failed'))

      const result = await service.syncTradingPortfolio()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('syncTradingPortfolio failed')
    })

    it('should handle repository errors', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      mockTrading212Client.getPortfolio.mockResolvedValue([
        {
          ticker: 'AAPL_US',
          quantity: 10,
          averagePrice: 150,
          currentPrice: 180,
          ppl: 300,
        },
      ])
      mockTrading212Client.getCash.mockResolvedValue({ total: 0 })
      mockTrading212Client.getInstruments.mockResolvedValue([
        { ticker: 'AAPL_US', name: 'Apple', currencyCode: 'USD', type: 'STOCK' },
      ])

      mockStockRepo.upsertMany.mockRejectedValue(new Error('Database error'))

      const result = await service.syncTradingPortfolio()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should fetch Trading212 data in parallel', async () => {
      mockPortfolioRepo.getOrCreateMain.mockResolvedValue(mockPortfolio)

      const startTime = Date.now()

      // Simulate async delays
      mockTrading212Client.getPortfolio.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 10))
      )
      mockTrading212Client.getCash.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ total: 0 }), 10))
      )
      mockTrading212Client.getInstruments.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 10))
      )

      mockStockRepo.upsertMany.mockResolvedValue(undefined)
      mockPortfolioRepo.upsertSnapshot.mockResolvedValue({})

      await service.syncTradingPortfolio()

      const duration = Date.now() - startTime

      // If sequential, it would take ~30ms. Parallel should be ~10ms.
      // With some overhead, expect less than 25ms.
      expect(duration).toBeLessThan(25)
    })
  })

  describe('testTrading212Connection', () => {
    it('should test connection successfully', async () => {
      mockTrading212Client.getCash.mockResolvedValue({
        total: 5000,
      })

      const result = await service.testTrading212Connection()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        cashBalance: 5000,
        authenticated: true,
      })
      expect(mockTrading212Client.getCash).toHaveBeenCalled()
    })

    it('should handle connection errors', async () => {
      mockTrading212Client.getCash.mockRejectedValue(new Error('Unauthorized'))

      const result = await service.testTrading212Connection()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('testTrading212Connection failed')
    })

    it('should return Result type for type safety', async () => {
      mockTrading212Client.getCash.mockResolvedValue({ total: 1000 })

      const result = await service.testTrading212Connection()

      // Type check - should have either data or error
      if (result.success) {
        expect(result.data.cashBalance).toBeDefined()
        expect(result.data.authenticated).toBeDefined()
      } else {
        expect(result.error).toBeDefined()
      }
    })
  })
})
