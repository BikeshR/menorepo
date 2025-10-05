'use client'

import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getCorrelationColor, getCorrelationStrength } from '@/lib/utils/correlation'
import { getPortfolioCorrelationMatrix } from '../actions'

export function CorrelationMatrix() {
  const [matrix, setMatrix] = useState<{ labels: string[]; matrix: number[][] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMatrix = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getPortfolioCorrelationMatrix(90)

      if (result.success && result.data) {
        setMatrix(result.data)
      } else {
        setError(result.error || 'Failed to load correlation matrix')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMatrix()
  }, [loadMatrix])

  if (isLoading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Holdings Correlation Matrix</h3>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Calculating correlations...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Holdings Correlation Matrix</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={loadMatrix}
            className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!matrix) {
    return null
  }

  const { labels, matrix: data } = matrix

  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Holdings Correlation Matrix</h3>
          <p className="text-sm text-muted-foreground">
            Correlation coefficients between your top holdings (90 days)
          </p>
        </div>
        <button
          type="button"
          onClick={loadMatrix}
          disabled={isLoading}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs font-medium"></th>
              {labels.map((label) => (
                <th key={label} className="p-2 text-xs font-medium text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, i) => (
              <tr key={rowLabel}>
                <td className="p-2 text-xs font-medium text-right pr-4">{rowLabel}</td>
                {labels.map((colLabel, j) => {
                  const value = data[i][j]
                  const color = getCorrelationColor(value)

                  return (
                    <td
                      key={colLabel}
                      className="p-2 text-center border"
                      style={{ backgroundColor: color }}
                      title={`${rowLabel} vs ${colLabel}: ${value.toFixed(2)} (${getCorrelationStrength(value)})`}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {value.toFixed(2)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h4 className="text-sm font-semibold mb-2">Understanding Correlations</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">
              <strong>+1.0:</strong> Perfect positive correlation (move together)
            </p>
            <p className="text-muted-foreground mb-1">
              <strong>0.0:</strong> No correlation (independent movements)
            </p>
            <p className="text-muted-foreground">
              <strong>-1.0:</strong> Perfect negative correlation (move opposite)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">
              <strong>Diversification:</strong> Lower correlations (closer to 0 or negative)
              indicate better diversification
            </p>
            <p className="text-muted-foreground">
              <strong>Risk:</strong> High positive correlations (0.7+) may indicate concentration
              risk
            </p>
          </div>
        </div>

        {/* Color legend */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Color scale:</span>
          <div className="flex items-center gap-1">
            <div className="w-8 h-4 rounded" style={{ backgroundColor: '#dc2626' }}></div>
            <span className="text-muted-foreground">-1</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-4 rounded" style={{ backgroundColor: '#94a3b8' }}></div>
            <span className="text-muted-foreground">0</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-4 rounded" style={{ backgroundColor: '#2563eb' }}></div>
            <span className="text-muted-foreground">+1</span>
          </div>
        </div>
      </div>
    </div>
  )
}
