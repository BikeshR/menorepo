/**
 * Enrichment Service
 *
 * Handles enriching stock data with fundamentals from external APIs.
 */

import { BaseService } from '@/core/services/base.service'
import type { Result } from '@/core/types/result.types'
import type { AlphaVantageClient } from '@/lib/integrations/alphavantage'
import type { PortfolioRepository } from '../repository/portfolio.repository'
import type { StockRepository } from '../repository/stock.repository'
import type { EnrichmentSummary } from '../types'

export class EnrichmentService extends BaseService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly stockRepository: StockRepository,
    private readonly alphaVantageClient: AlphaVantageClient
  ) {
    super('EnrichmentService')
  }

  /**
   * Enrich stock fundamentals for stocks missing data
   */
  async enrichStockFundamentals(limit = 5): Promise<Result<EnrichmentSummary>> {
    return this.executeOperation(
      'enrichStockFundamentals',
      async () => {
        const portfolio = await this.portfolioRepository.getOrCreateMain()
        const stocksNeedingEnrichment = await this.stockRepository.getStocksNeedingEnrichment(
          portfolio.id,
          limit
        )

        this.logger.info('Found stocks needing enrichment', {
          count: stocksNeedingEnrichment.length,
        })

        let enriched = 0
        const errors: Array<{ ticker: string; error: string }> = []

        for (const stock of stocksNeedingEnrichment) {
          try {
            // Parse ticker to get symbol (remove exchange suffix)
            const symbol = stock.ticker.split('_')[0]

            // Fetch company overview from Alpha Vantage
            const overview = await this.alphaVantageClient.getCompanyOverview(symbol)

            // Update stock with fundamentals
            await this.stockRepository.updateFundamentals(portfolio.id, stock.ticker, {
              sector: overview.Sector || undefined,
              industry: overview.Industry || undefined,
              marketCap: overview.MarketCapitalization
                ? parseFloat(overview.MarketCapitalization)
                : undefined,
              peRatio: overview.PERatio ? parseFloat(overview.PERatio) : undefined,
              dividendYield: overview.DividendYield
                ? parseFloat(overview.DividendYield) * 100
                : undefined,
            })

            enriched++
            this.logger.info('Enriched stock', { ticker: stock.ticker })

            // Rate limiting - Alpha Vantage has 5 calls/minute on free tier
            await new Promise((resolve) => setTimeout(resolve, 12000)) // 12 seconds between calls
          } catch (error) {
            this.logger.error('Failed to enrich stock', {
              ticker: stock.ticker,
              error: error instanceof Error ? error.message : 'Unknown error',
            })

            errors.push({
              ticker: stock.ticker,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        return {
          tickersEnriched: enriched,
          tickersFailed: errors.length,
          errors,
        }
      },
      { limit }
    )
  }
}
