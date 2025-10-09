import { GeographicBreakdownChart } from '../analytics/_components/GeographicBreakdownChart'
import { GeographicWorldMap } from '../analytics/_components/GeographicWorldMap'
import { SectorBreakdownChart } from '../analytics/_components/SectorBreakdownChart'
import { getPortfolioAnalytics } from '../analytics/actions'
import { AllocationCharts } from './_components/AllocationCharts'
import { BenchmarkComparison } from './_components/BenchmarkComparison'
import { InitialSync } from './_components/InitialSync'
import { PerformanceChart } from './_components/PerformanceChart'
import { PortfolioNews } from './_components/PortfolioNews'
import { PortfolioOverview } from './_components/PortfolioOverview'
import { TopPerformers } from './_components/TopPerformers'
import {
  calculatePortfolioMetrics,
  getBenchmarkComparisonData,
  getPortfolioHistory,
  getPortfolioNews,
  getPortfolioSummary,
  getTransactionHistory,
} from './actions'

export const metadata = {
  title: 'Investment Portfolio',
  description: 'Track and analyze your investment portfolio',
}

// This page requires authentication and uses cookies
export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const portfolioData = await getPortfolioSummary()

  if (!portfolioData) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Investment Portfolio</h1>
          <p className="text-muted-foreground mt-2">
            Track your stocks, ETFs, and crypto investments from Trading212 and Kraken
          </p>
        </div>

        <InitialSync />
      </div>
    )
  }

  // Fetch historical data for performance chart
  const historicalData = await getPortfolioHistory(30)

  // Fetch benchmark comparison data
  const metricsResult = await calculatePortfolioMetrics(30)
  const comparisonDataResult = await getBenchmarkComparisonData(30)

  // Fetch transaction history
  const transactions = await getTransactionHistory(100)

  // Fetch portfolio news
  const newsArticles = await getPortfolioNews(10)

  // Fetch analytics data for sector/geographic breakdowns
  const analyticsResult = await getPortfolioAnalytics()
  const analytics = analyticsResult.success ? analyticsResult.data : null

  // Detect currency from positions
  const currencies = portfolioData.positions.map((p) => p.currency).filter(Boolean)
  const primaryCurrency = currencies.length > 0 ? currencies[0] : 'GBP'
  const currencySymbol = primaryCurrency === 'GBP' ? '£' : primaryCurrency === 'EUR' ? '€' : '$'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Investment Portfolio</h1>
        <p className="text-muted-foreground mt-2">
          Track your stocks, ETFs, and crypto investments
        </p>
      </div>

      <PortfolioOverview
        portfolio={portfolioData.portfolio}
        latestSnapshot={portfolioData.latestSnapshot}
        positions={portfolioData.positions}
        cryptoPositions={portfolioData.cryptoPositions}
        latestSync={portfolioData.latestSync}
        latestCryptoSync={portfolioData.latestCryptoSync}
        transactions={transactions || []}
        historicalSnapshots={historicalData || []}
      />

      <PerformanceChart snapshots={historicalData || []} currencySymbol={currencySymbol} />

      {/* Benchmark Comparison */}
      {metricsResult.success &&
        metricsResult.data &&
        comparisonDataResult.success &&
        comparisonDataResult.data && (
          <BenchmarkComparison
            metrics={metricsResult.data}
            portfolioData={comparisonDataResult.data}
            currencySymbol={currencySymbol}
          />
        )}

      {/* Allocation Charts */}
      {(portfolioData.positions.length > 0 || portfolioData.cryptoPositions.length > 0) && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Portfolio Allocation</h2>
          <AllocationCharts
            positions={portfolioData.positions}
            cryptoPositions={portfolioData.cryptoPositions}
          />
        </div>
      )}

      {/* Sector & Geographic Breakdown */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectorBreakdownChart data={analytics.sectorBreakdown} />
          <GeographicBreakdownChart data={analytics.geographicBreakdown} />
        </div>
      )}

      {/* Geographic World Map */}
      {analytics && <GeographicWorldMap data={analytics.geographicBreakdown} />}

      {/* Top Performers */}
      {(portfolioData.positions.length > 0 || portfolioData.cryptoPositions.length > 0) && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Performance Leaders</h2>
          <TopPerformers
            positions={portfolioData.positions}
            cryptoPositions={portfolioData.cryptoPositions}
          />
        </div>
      )}

      {/* Portfolio News */}
      {newsArticles && newsArticles.length > 0 && <PortfolioNews articles={newsArticles} />}
    </div>
  )
}
