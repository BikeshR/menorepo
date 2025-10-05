/**
 * Value at Risk (VaR) Calculations
 *
 * VaR estimates the maximum potential loss over a specific time period
 * at a given confidence level (e.g., 95% or 99%)
 */

/**
 * Calculate historical Value at Risk using percentile method
 *
 * @param returns Array of daily returns
 * @param confidenceLevel Confidence level (e.g., 0.95 for 95%)
 * @returns VaR as a negative number (representing potential loss)
 */
export function calculateHistoricalVaR(returns: number[], confidenceLevel = 0.95): number | null {
  if (returns.length === 0) {
    return null
  }

  // Sort returns in ascending order
  const sortedReturns = [...returns].sort((a, b) => a - b)

  // Calculate the index for the confidence level
  // For 95% confidence, we want the 5th percentile (worst 5% of returns)
  const index = Math.floor((1 - confidenceLevel) * sortedReturns.length)

  return sortedReturns[index]
}

/**
 * Calculate parametric VaR (assumes normal distribution)
 *
 * @param returns Array of daily returns
 * @param confidenceLevel Confidence level (e.g., 0.95 for 95%)
 * @returns VaR as a negative number (representing potential loss)
 */
export function calculateParametricVaR(returns: number[], confidenceLevel = 0.95): number | null {
  if (returns.length === 0) {
    return null
  }

  // Calculate mean and standard deviation
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
  const stdDev = Math.sqrt(variance)

  // Z-score for confidence level
  // 95% confidence = 1.645, 99% confidence = 2.326
  const zScore = getZScore(confidenceLevel)

  // VaR = mean - (z-score × standard deviation)
  return mean - zScore * stdDev
}

/**
 * Calculate VaR for a portfolio value
 *
 * @param snapshots Portfolio value snapshots
 * @param currentValue Current portfolio value
 * @param confidenceLevel Confidence level (e.g., 0.95 for 95%)
 * @param method 'historical' or 'parametric'
 * @returns VaR in currency units
 */
export function calculatePortfolioVaR(
  snapshots: Array<{ date: Date; value: number }>,
  currentValue: number,
  confidenceLevel = 0.95,
  method: 'historical' | 'parametric' = 'historical'
): { var: number; varPercent: number } | null {
  if (snapshots.length < 2) {
    return null
  }

  // Calculate daily returns
  const returns: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prevValue = snapshots[i - 1].value
    const currentValue = snapshots[i].value
    if (prevValue > 0) {
      returns.push((currentValue - prevValue) / prevValue)
    }
  }

  if (returns.length === 0) {
    return null
  }

  // Calculate VaR based on method
  const varPercent =
    method === 'historical'
      ? calculateHistoricalVaR(returns, confidenceLevel)
      : calculateParametricVaR(returns, confidenceLevel)

  if (varPercent === null) {
    return null
  }

  // Convert to currency units
  const varAmount = varPercent * currentValue

  return {
    var: varAmount,
    varPercent: varPercent,
  }
}

/**
 * Get Z-score for a given confidence level
 */
function getZScore(confidenceLevel: number): number {
  // Common z-scores for confidence levels
  const zScores: { [key: number]: number } = {
    0.9: 1.282,
    0.95: 1.645,
    0.99: 2.326,
  }

  return zScores[confidenceLevel] || 1.645
}

/**
 * Calculate Conditional VaR (CVaR) / Expected Shortfall
 * Average loss beyond VaR threshold
 *
 * @param returns Array of daily returns
 * @param confidenceLevel Confidence level (e.g., 0.95 for 95%)
 * @returns CVaR as a negative number
 */
export function calculateCVaR(returns: number[], confidenceLevel = 0.95): number | null {
  if (returns.length === 0) {
    return null
  }

  const var95 = calculateHistoricalVaR(returns, confidenceLevel)
  if (var95 === null) {
    return null
  }

  // Find all returns worse than VaR
  const worseReturns = returns.filter((r) => r <= var95)

  if (worseReturns.length === 0) {
    return var95
  }

  // Calculate average of worst returns
  return worseReturns.reduce((sum, r) => sum + r, 0) / worseReturns.length
}
