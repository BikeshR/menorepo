/**
 * Portfolio Data Service
 *
 * Handles retrieving portfolio data (summary, history, position details).
 */

import { BaseService } from '@/core/services/base.service'
import type { Result } from '@/core/types/result.types'
import type { PortfolioRepository } from '../repository/portfolio.repository'
import type { StockRepository } from '../repository/stock.repository'
import type { PortfolioSummary, PositionDetails } from '../types'

export class PortfolioDataService extends BaseService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly stockRepository: StockRepository
  ) {
    super('PortfolioDataService')
  }

  /**
   * Get portfolio summary with current positions
   */
  async getSummary(): Promise<Result<PortfolioSummary>> {
    return this.executeOperation('getSummary', async () => {
      // Get portfolio
      const portfolio = await this.portfolioRepository.getOrCreateMain()

      // Get all stocks
      const stocks = await this.stockRepository.getAllByPortfolio(portfolio.id)

      // Get latest snapshot for additional metrics
      const latestSnapshot = await this.portfolioRepository.getLatestSnapshot(portfolio.id)

      // Calculate current metrics
      const totalValue = stocks.reduce(
        (sum, stock) => sum + stock.quantity * (stock.current_price ?? 0),
        0
      )
      const totalCostBasis = stocks.reduce(
        (sum, stock) => sum + stock.quantity * (stock.average_cost ?? 0),
        0
      )
      const totalGainLoss = totalValue - totalCostBasis
      const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0

      return {
        portfolio,
        totalValue,
        cashBalance: latestSnapshot?.cash_balance ?? 0,
        totalCostBasis,
        totalGainLoss,
        totalGainLossPct,
        positionsCount: stocks.length,
        stocks,
      }
    })
  }

  /**
   * Get portfolio historical snapshots
   */
  async getHistory(days = 30): Promise<
    Result<
      Array<{
        date: string
        totalValue: number
        cashBalance: number
        totalCostBasis: number
        totalGainLoss: number
        totalGainLossPct: number
        positionsCount: number
      }>
    >
  > {
    return this.executeOperation(
      'getHistory',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()
        const snapshots = await this.portfolioRepository.getHistoricalSnapshots(portfolio.id, days)

        return snapshots.map((snapshot) => ({
          date: snapshot.snapshot_date,
          totalValue: snapshot.total_value,
          cashBalance: snapshot.cash_balance,
          totalCostBasis: snapshot.total_cost_basis,
          totalGainLoss: snapshot.total_gain_loss,
          totalGainLossPct: snapshot.total_gain_loss_pct,
          positionsCount: snapshot.positions_count,
        }))
      },
      { days }
    )
  }

  /**
   * Get detailed information for a specific position
   */
  async getPositionDetails(ticker: string): Promise<Result<PositionDetails>> {
    return this.executeOperation(
      'getPositionDetails',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()
        const stock = await this.stockRepository.getByTicker(portfolio.id, ticker)

        this.assertExists(stock, `Position for ticker ${ticker}`)

        return {
          stock,
          fundamentals: {
            sector: stock.sector,
            industry: stock.industry,
            marketCap: null,
            peRatio: null,
            dividendYield: null,
            description: null,
          },
        }
      },
      { ticker }
    )
  }
}
