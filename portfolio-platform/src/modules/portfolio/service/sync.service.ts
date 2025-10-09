/**
 * Sync Service
 *
 * Handles syncing portfolio data from external brokers (Trading212, Kraken).
 * Contains all business logic for processing positions, normalizing data,
 * and creating snapshots.
 */

import { BaseService } from '@/core/services/base.service'
import type { Result } from '@/core/types/result.types'
import {
  convertToBaseCurrency,
  countryToRegion,
  exchangeToCountry,
  normalizeCurrency,
  parseTrading212Ticker,
  type Trading212Client,
} from '@/lib/integrations/trading212'
import type { PortfolioRepository } from '../repository/portfolio.repository'
import type { StockRepository } from '../repository/stock.repository'
import type { CreateStockDto, SyncResult } from '../types'

export class SyncService extends BaseService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly stockRepository: StockRepository,
    private readonly trading212Client: Trading212Client
  ) {
    super('SyncService')
  }

  /**
   * Sync portfolio from Trading212
   *
   * Fetches current positions from Trading212 API, processes them,
   * stores in database, and creates a snapshot.
   */
  async syncTradingPortfolio(): Promise<Result<SyncResult>> {
    return this.executeOperation('syncTradingPortfolio', async () => {
      // Get or create portfolio
      const portfolio = await this.portfolioRepository.getOrCreateMain()

      // Fetch data from Trading212
      const [positions, cash, instruments] = await Promise.all([
        this.trading212Client.getPortfolio(),
        this.trading212Client.getCash(),
        this.trading212Client.getInstruments(),
      ])

      this.logger.info('Fetched Trading212 data', {
        positionsCount: positions.length,
        cashBalance: cash.total,
      })

      // Create instrument lookup map
      const instrumentMap = new Map(instruments.map((i) => [i.ticker, i]))

      // Process positions into stock DTOs
      const stocks: CreateStockDto[] = []
      let totalValue = 0

      for (const position of positions) {
        const instrument = instrumentMap.get(position.ticker)
        const { symbol, exchange } = parseTrading212Ticker(position.ticker)
        const country = exchangeToCountry(exchange)
        const region = countryToRegion(country)

        // Normalize currency
        const currencyCode = instrument?.currencyCode || 'USD'
        const { baseCurrency } = normalizeCurrency(currencyCode)

        // Convert prices to base currency
        const normalizedAveragePrice = convertToBaseCurrency(position.averagePrice, currencyCode)
        const normalizedCurrentPrice = convertToBaseCurrency(position.currentPrice, currencyCode)
        const normalizedPpl = convertToBaseCurrency(position.ppl, currencyCode)

        const marketValue = position.quantity * normalizedCurrentPrice
        const gainLossPct =
          normalizedAveragePrice > 0
            ? ((normalizedCurrentPrice - normalizedAveragePrice) / normalizedAveragePrice) * 100
            : 0

        // Determine asset type
        let assetType: 'stock' | 'etf' = 'stock'
        if (instrument?.type === 'ETF') {
          assetType = 'etf'
        }

        stocks.push({
          portfolio_id: portfolio.id,
          ticker: position.ticker,
          name: instrument?.name || symbol,
          asset_type: assetType,
          isin: instrument?.isin ?? null,
          currency: baseCurrency,
          quantity: position.quantity,
          average_cost: normalizedAveragePrice,
          current_price: normalizedCurrentPrice,
          gain_loss: normalizedPpl,
          gain_loss_pct: gainLossPct,
          market_value: marketValue,
          custom_group: null,
          custom_tags: null,
          exchange: exchange ?? null,
          country: country ?? null,
          region: region ?? null,
          initial_fill_date: position.initialFillDate ?? null,
          last_synced_at: new Date().toISOString(),
          sector: null,
          industry: null,
        })

        totalValue += marketValue
      }

      // Upsert all stocks
      await this.stockRepository.upsertMany(stocks)

      this.logger.info('Upserted stocks', { count: stocks.length })

      // Calculate snapshot data
      const totalCostBasis = stocks.reduce((sum, s) => sum + s.quantity * (s.average_cost ?? 0), 0)
      const totalGainLoss = totalValue - totalCostBasis
      const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0

      // Create snapshot
      const snapshotDate = new Date().toISOString().split('T')[0]
      await this.portfolioRepository.upsertSnapshot({
        portfolio_id: portfolio.id,
        snapshot_date: snapshotDate,
        total_value: totalValue,
        cash_balance: cash.total,
        total_cost_basis: totalCostBasis,
        total_gain_loss: totalGainLoss,
        total_gain_loss_pct: totalGainLossPct,
        positions_count: stocks.length,
      })

      this.logger.info('Created portfolio snapshot', {
        date: snapshotDate,
        totalValue,
        positionsCount: stocks.length,
      })

      return {
        positionsSynced: stocks.length,
        totalValue,
        snapshotCreated: true,
      }
    })
  }

  /**
   * Test Trading212 connection
   *
   * Makes a simple API call to verify credentials work.
   */
  async testTrading212Connection(): Promise<
    Result<{
      cashBalance: number
      authenticated: boolean
    }>
  > {
    return this.executeOperation('testTrading212Connection', async () => {
      const cash = await this.trading212Client.getCash()

      return {
        cashBalance: cash.total,
        authenticated: true,
      }
    })
  }
}
