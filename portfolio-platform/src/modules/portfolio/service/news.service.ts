/**
 * News Service
 *
 * Handles fetching and aggregating news for portfolio holdings.
 */

import { BaseService } from '@/core/services/base.service'
import type { Result } from '@/core/types/result.types'
import type { PortfolioRepository } from '../repository/portfolio.repository'
import type { StockRepository } from '../repository/stock.repository'
import type { NewsArticle } from '../types'

export class NewsService extends BaseService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly stockRepository: StockRepository
  ) {
    super('NewsService')
  }

  /**
   * Get aggregated news for all portfolio holdings
   */
  async getPortfolioNews(limit = 10): Promise<Result<NewsArticle[]>> {
    return this.executeOperation(
      'getPortfolioNews',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()
        const stocks = await this.stockRepository.getAllByPortfolio(portfolio.id)

        // Get top holdings (by value)
        const topHoldings = stocks
          .map((s) => ({
            ticker: s.ticker,
            value: s.quantity * s.current_price,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5) // Top 5 holdings

        // Fetch news for top holdings
        // This would integrate with News API or similar
        // For now, returning placeholder
        this.logger.info('Fetching news for holdings', {
          count: topHoldings.length,
        })

        const news: NewsArticle[] = []

        return news.slice(0, limit)
      },
      { limit }
    )
  }
}
