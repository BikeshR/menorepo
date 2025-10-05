import { InitialSync } from './_components/InitialSync'
import { PerformanceChart } from './_components/PerformanceChart'
import { PortfolioOverview } from './_components/PortfolioOverview'
import { getPortfolioHistory, getPortfolioSummary } from './actions'

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
      />

      <PerformanceChart snapshots={historicalData || []} currencySymbol={currencySymbol} />
    </div>
  )
}
