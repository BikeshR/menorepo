import type { CompanyOverview } from '@/lib/integrations/alphavantage'

interface FundamentalMetricsProps {
  fundamentals: CompanyOverview
}

export function FundamentalMetrics({ fundamentals }: FundamentalMetricsProps) {
  const formatLargeNumber = (value: string | null) => {
    if (!value) return 'N/A'
    const num = Number.parseFloat(value)
    if (Number.isNaN(num)) return 'N/A'

    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    return `$${num.toLocaleString()}`
  }

  const formatPercent = (value: string | null) => {
    if (!value) return 'N/A'
    const num = Number.parseFloat(value)
    if (Number.isNaN(num)) return 'N/A'
    return `${(num * 100).toFixed(2)}%`
  }

  const formatRatio = (value: string | null) => {
    if (!value) return 'N/A'
    const num = Number.parseFloat(value)
    if (Number.isNaN(num)) return 'N/A'
    return num.toFixed(2)
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Fundamental Metrics</h3>

      {/* Company Info */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Exchange</p>
            <p className="text-base font-medium">{fundamentals.Exchange || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Currency</p>
            <p className="text-base font-medium">{fundamentals.Currency || 'N/A'}</p>
          </div>
          {fundamentals.Sector && (
            <div>
              <p className="text-sm text-muted-foreground">Sector</p>
              <p className="text-base font-medium">{fundamentals.Sector}</p>
            </div>
          )}
          {fundamentals.Industry && (
            <div>
              <p className="text-sm text-muted-foreground">Industry</p>
              <p className="text-base font-medium">{fundamentals.Industry}</p>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">Market Cap</p>
          <p className="text-lg font-bold">{formatLargeNumber(fundamentals.MarketCapitalization)}</p>
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">P/E Ratio</p>
          <p className="text-lg font-bold">{formatRatio(fundamentals.PERatio)}</p>
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">P/B Ratio</p>
          <p className="text-lg font-bold">{formatRatio(fundamentals.PriceToBookRatio as string | null)}</p>
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">Dividend Yield</p>
          <p className="text-lg font-bold">{formatPercent(fundamentals.DividendYield)}</p>
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">52 Week Range</p>
          <p className="text-sm font-semibold">
            {fundamentals['52WeekLow']} - {fundamentals['52WeekHigh']}
          </p>
        </div>
      </div>

      {/* Description */}
      {fundamentals.Description && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-2">About</p>
          <p className="text-sm leading-relaxed">{fundamentals.Description}</p>
        </div>
      )}
    </div>
  )
}
