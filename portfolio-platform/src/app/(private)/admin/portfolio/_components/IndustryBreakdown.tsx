'use client'

import { useEffect, useState } from 'react'
import { getPortfolioIndustryBreakdown } from '../actions'
import { RefreshCw } from 'lucide-react'

type IndustryData = {
  industry: string
  sector: string
  allocation: number
  value: number
  holdings: number
  tickers: string[]
}

export function IndustryBreakdown() {
  const [industries, setIndustries] = useState<IndustryData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadIndustries = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getPortfolioIndustryBreakdown()

      if (result.success && result.data) {
        setIndustries(result.data)
      } else {
        setError(result.error || 'Failed to load industry breakdown')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadIndustries()
  }, [])

  if (isLoading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Industry Breakdown</h3>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading industry data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Industry Breakdown</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={loadIndustries}
            className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (industries.length === 0) {
    return null
  }

  // Get currency symbol from first ticker (assumes all same currency)
  const currencySymbol = '£' // Default, could be dynamic based on portfolio settings

  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Industry Classification</h3>
          <p className="text-sm text-muted-foreground">Portfolio allocation by industry</p>
        </div>
        <button
          type="button"
          onClick={loadIndustries}
          disabled={isLoading}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Industry Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-semibold">Industry</th>
              <th className="text-left py-3 px-4 text-sm font-semibold">Sector</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Holdings</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Value</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Allocation</th>
              <th className="text-left py-3 px-4 text-sm font-semibold">Tickers</th>
            </tr>
          </thead>
          <tbody>
            {industries.map((industry) => (
              <tr key={industry.industry} className="border-b hover:bg-muted/50">
                <td className="py-3 px-4 text-sm font-medium">{industry.industry}</td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{industry.sector}</td>
                <td className="py-3 px-4 text-sm text-right">{industry.holdings}</td>
                <td className="py-3 px-4 text-sm text-right font-medium">
                  {currencySymbol}
                  {industry.value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(industry.allocation, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold w-12 text-right">
                      {industry.allocation.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {industry.tickers.join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h4 className="text-sm font-semibold mb-2">Industry Concentration</h4>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Total Industries:</strong> {industries.length}
          </p>
          <p>
            <strong>Top Industry:</strong> {industries[0].industry} ({industries[0].allocation.toFixed(1)}%
            of portfolio)
          </p>
          <p>
            <strong>Diversification:</strong>{' '}
            {industries.length >= 5
              ? 'Well diversified across industries'
              : 'Consider diversifying across more industries'}
          </p>
        </div>
      </div>
    </div>
  )
}
