import { BarChart3 } from 'lucide-react'
import { calculatePortfolioMetrics, getPortfolioCorrelationMatrix } from '../portfolio/actions'
import { AssetAllocationChart } from './_components/AssetAllocationChart'
import { GeographicBreakdownChart } from './_components/GeographicBreakdownChart'
import { IndustryBreakdownTable } from './_components/IndustryBreakdownTable'
import { RiskMetricsCard } from './_components/RiskMetricsCard'
import { SectorBreakdownChart } from './_components/SectorBreakdownChart'
import { TaxTrackingCard } from './_components/TaxTrackingCard'
import { TopHoldingsTable } from './_components/TopHoldingsTable'
import { getPortfolioAnalytics, getTaxTrackingData } from './actions'

export const metadata = {
  title: 'Portfolio Analytics',
  description: 'Advanced portfolio analysis and insights',
}

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  // Fetch all analytics data
  const [analyticsResult, taxDataResult, metricsResult, correlationResult] = await Promise.all([
    getPortfolioAnalytics(),
    getTaxTrackingData(),
    calculatePortfolioMetrics(),
    getPortfolioCorrelationMatrix(90),
  ])

  const analytics = analyticsResult.success ? analyticsResult.data : null
  const taxData = taxDataResult.success ? taxDataResult.data : null
  const metrics = metricsResult.success ? metricsResult.data : null
  const correlation = correlationResult.success ? correlationResult.data : null

  if (!analytics) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Analytics</h1>
          <p className="text-muted-foreground mt-2">Advanced portfolio analysis and insights</p>
        </div>

        <div className="flex flex-col items-center justify-center py-12 border rounded-md">
          <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-sm text-muted-foreground">
            {analyticsResult.error || 'Unable to load analytics data'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Portfolio Analytics</h1>
        <p className="text-muted-foreground mt-2">Comprehensive analysis and risk metrics</p>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-md border bg-card">
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-2xl font-bold">
            £
            {analytics.totalValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="p-4 rounded-md border bg-card">
          <div className="text-sm text-muted-foreground mb-1">Total Gain/Loss</div>
          <div
            className={`text-2xl font-bold ${analytics.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            £
            {analytics.totalGainLoss.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {analytics.totalGainLossPct.toFixed(2)}%
          </div>
        </div>
        <div className="p-4 rounded-md border bg-card">
          <div className="text-sm text-muted-foreground mb-1">Holdings</div>
          <div className="text-2xl font-bold">{analytics.positionsCount}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {analytics.winnersCount}W / {analytics.losersCount}L
          </div>
        </div>
        <div className="p-4 rounded-md border bg-card">
          <div className="text-sm text-muted-foreground mb-1">Total Return</div>
          <div className="text-2xl font-bold">
            {metrics?.totalReturn ? `${metrics.totalReturn.toFixed(2)}%` : 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Over last 30 days</div>
        </div>
      </div>

      {/* Diversification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectorBreakdownChart data={analytics.sectorBreakdown} />
        <GeographicBreakdownChart data={analytics.geographicBreakdown} />
      </div>

      {/* Asset Allocation & Top Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AssetAllocationChart data={analytics.assetAllocation} />
        </div>
        <div className="lg:col-span-2">
          <TopHoldingsTable data={analytics.topHoldings} />
        </div>
      </div>

      {/* Industry Breakdown */}
      <IndustryBreakdownTable data={analytics.industryBreakdown} />

      {/* Risk Metrics */}
      <RiskMetricsCard
        metrics={
          metrics
            ? {
                sharpeRatio: metrics.sharpeRatio,
                maxDrawdown: null, // TODO: Calculate from historical data
                volatility: metrics.volatility / 100, // Convert from % to decimal
                var95: metrics.var95 / 100, // Convert from % to decimal
                cvar95: metrics.cvar95 / 100, // Convert from % to decimal
              }
            : null
        }
      />

      {/* Correlation Matrix */}
      {correlation && (
        <div className="p-4 rounded-md border bg-card">
          <h3 className="text-lg font-semibold mb-2">Correlation Matrix</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Asset correlations over the last 90 days ({correlation.labels.length} holdings)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left"></th>
                  {correlation.labels.map((ticker: string) => (
                    <th key={ticker} className="p-1 text-center font-mono">
                      {ticker}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation.matrix.map((row, i) => (
                  <tr key={correlation.labels[i]}>
                    <td className="p-1 font-mono font-medium">{correlation.labels[i]}</td>
                    {row.map((value, j) => (
                      <td
                        key={`${correlation.labels[i]}-${correlation.labels[j]}`}
                        className="p-1 text-center"
                        style={{
                          backgroundColor: getCorrelationColor(value),
                          color: Math.abs(value) > 0.5 ? 'white' : 'inherit',
                        }}
                      >
                        {value.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Correlation ranges from -1 (perfect negative) to +1 (perfect positive). Values near 0
            indicate low correlation.
          </p>
        </div>
      )}

      {/* Tax Tracking */}
      <TaxTrackingCard data={taxData || null} />
    </div>
  )
}

function getCorrelationColor(correlation: number): string {
  if (correlation >= 0.7) return '#2563eb' // Strong positive - blue
  if (correlation >= 0.3) return '#60a5fa' // Moderate positive - light blue
  if (correlation >= -0.3) return '#e2e8f0' // Weak - light gray
  if (correlation >= -0.7) return '#fb923c' // Moderate negative - light red
  return '#dc2626' // Strong negative - red
}
