/**
 * Metrics Service
 *
 * Handles portfolio analytics and performance calculations.
 */

import { BaseService } from '@/core/services/base.service'
import type { Result } from '@/core/types/result.types'
import { calculateCorrelationMatrix } from '@/lib/utils/correlation'
import type { BenchmarkRepository } from '../repository/benchmark.repository'
import type { PortfolioRepository } from '../repository/portfolio.repository'
import type { StockRepository } from '../repository/stock.repository'
import type {
  BenchmarkComparison,
  CorrelationMatrix,
  IndustryBreakdown,
  PortfolioMetrics,
} from '../types'

export class MetricsService extends BaseService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly stockRepository: StockRepository,
    readonly _benchmarkRepository: BenchmarkRepository
  ) {
    super('MetricsService')
  }

  /**
   * Calculate portfolio metrics
   */
  async calculateMetrics(): Promise<Result<PortfolioMetrics>> {
    return this.executeOperation('calculateMetrics', async () => {
      const portfolio = await this.portfolioRepository.getOrCreateMain()
      const snapshots = await this.portfolioRepository.getHistoricalSnapshots(portfolio.id, 365)

      // Calculate returns
      if (snapshots.length < 2) {
        return {
          totalReturn: 0,
          totalReturnPct: 0,
          annualizedReturn: 0,
          irr: 0,
          sharpeRatio: null,
          maxDrawdown: null,
          volatility: null,
          bestDay: null,
          worstDay: null,
        }
      }

      const firstSnapshot = snapshots[0]
      const lastSnapshot = snapshots[snapshots.length - 1]
      const totalReturn = lastSnapshot.total_value - firstSnapshot.total_cost_basis
      const totalReturnPct =
        firstSnapshot.total_cost_basis > 0
          ? (totalReturn / firstSnapshot.total_cost_basis) * 100
          : 0

      // Calculate daily returns
      const dailyReturns: Array<{ date: string; return: number }> = []
      for (let i = 1; i < snapshots.length; i++) {
        const prevValue = snapshots[i - 1].total_value
        const currValue = snapshots[i].total_value
        const dailyReturn = prevValue > 0 ? ((currValue - prevValue) / prevValue) * 100 : 0

        dailyReturns.push({
          date: snapshots[i].snapshot_date,
          return: dailyReturn,
        })
      }

      // Find best and worst days
      const bestDay =
        dailyReturns.length > 0
          ? dailyReturns.reduce((max, day) => (day.return > max.return ? day : max))
          : null

      const worstDay =
        dailyReturns.length > 0
          ? dailyReturns.reduce((min, day) => (day.return < min.return ? day : min))
          : null

      // Calculate volatility (standard deviation of daily returns)
      const avgReturn = dailyReturns.reduce((sum, day) => sum + day.return, 0) / dailyReturns.length
      const variance =
        dailyReturns.reduce((sum, day) => sum + (day.return - avgReturn) ** 2, 0) /
        dailyReturns.length
      const volatility = Math.sqrt(variance)

      // Annualized return (simple approximation)
      const daysPassed = snapshots.length - 1
      const annualizedReturn = daysPassed > 0 ? (totalReturnPct / daysPassed) * 365 : totalReturnPct

      return {
        totalReturn,
        totalReturnPct,
        annualizedReturn,
        irr: annualizedReturn, // Simplified - would need cash flows for true IRR
        sharpeRatio: volatility > 0 ? annualizedReturn / volatility : null,
        maxDrawdown: null, // Would need to calculate peak-to-trough
        volatility,
        bestDay,
        worstDay,
      }
    })
  }

  /**
   * Calculate correlation matrix for portfolio holdings
   */
  async getCorrelationMatrix(days = 90): Promise<Result<CorrelationMatrix>> {
    return this.executeOperation(
      'getCorrelationMatrix',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()
        const stocks = await this.stockRepository.getAllByPortfolio(portfolio.id)

        if (stocks.length < 2) {
          return {
            tickers: stocks.map((s) => s.ticker),
            matrix: [],
          }
        }

        const tickers = stocks.map((s) => s.ticker)

        // Would need historical price data for each ticker
        // For now, return placeholder
        const result = calculateCorrelationMatrix({})

        return {
          tickers,
          matrix: result?.matrix ?? [],
        }
      },
      { days }
    )
  }

  /**
   * Get industry breakdown
   */
  async getIndustryBreakdown(): Promise<Result<IndustryBreakdown>> {
    return this.executeOperation('getIndustryBreakdown', async () => {
      const portfolio = await this.portfolioRepository.getOrCreateMain()
      const stocks = await this.stockRepository.getAllByPortfolio(portfolio.id)

      // Group by industry
      const industryMap = new Map<string, { value: number; count: number }>()

      let totalValue = 0

      for (const stock of stocks) {
        const industry = stock.industry || 'Unknown'
        const value = stock.quantity * stock.current_price
        totalValue += value

        const existing = industryMap.get(industry) || { value: 0, count: 0 }
        industryMap.set(industry, {
          value: existing.value + value,
          count: existing.count + 1,
        })
      }

      // Convert to array and calculate percentages
      const breakdown = Array.from(industryMap.entries()).map(([industry, data]) => ({
        industry,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        count: data.count,
      }))

      // Sort by value descending
      breakdown.sort((a, b) => b.value - a.value)

      return { breakdown }
    })
  }

  /**
   * Compare portfolio to benchmarks
   */
  async getBenchmarkComparison(days = 30): Promise<Result<BenchmarkComparison>> {
    return this.executeOperation(
      'getBenchmarkComparison',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()
        const snapshots = await this.portfolioRepository.getHistoricalSnapshots(portfolio.id, days)

        // Portfolio returns
        const portfolioReturns = snapshots.map((s) => ({
          date: s.snapshot_date,
          value: s.total_value,
        }))

        const portfolioTotalReturn =
          snapshots.length > 1
            ? ((snapshots[snapshots.length - 1].total_value - snapshots[0].total_value) /
                snapshots[0].total_value) *
              100
            : 0

        // Benchmark returns (placeholder - would fetch from benchmark_prices)
        const benchmarks = [
          {
            symbol: 'SPY',
            name: 'S&P 500',
            returns: [],
            totalReturn: 0,
          },
        ]

        return {
          portfolio: {
            returns: portfolioReturns,
            totalReturn: portfolioTotalReturn,
          },
          benchmarks,
        }
      },
      { days }
    )
  }
}
