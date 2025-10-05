/**
 * Correlation Matrix Calculations
 *
 * Functions for calculating correlation coefficients between assets
 */

/**
 * Calculate Pearson correlation coefficient between two arrays
 *
 * @param x First data series
 * @param y Second data series
 * @returns Correlation coefficient (-1 to 1), or null if calculation fails
 */
export function calculateCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length === 0) {
    return null
  }

  const n = x.length

  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n
  const meanY = y.reduce((sum, val) => sum + val, 0) / n

  // Calculate standard deviations and covariance
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    sumXY += dx * dy
    sumX2 += dx * dx
    sumY2 += dy * dy
  }

  // Avoid division by zero
  if (sumX2 === 0 || sumY2 === 0) {
    return null
  }

  // Pearson correlation coefficient
  const correlation = sumXY / Math.sqrt(sumX2 * sumY2)

  return correlation
}

/**
 * Calculate correlation matrix for multiple data series
 *
 * @param data Object with series names as keys and data arrays as values
 * @returns Correlation matrix as 2D array with labels
 */
export function calculateCorrelationMatrix(data: Record<string, number[]>): {
  labels: string[]
  matrix: number[][]
} | null {
  const labels = Object.keys(data)
  const n = labels.length

  if (n === 0) {
    return null
  }

  // Initialize matrix with 1s on diagonal
  const matrix: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0))

  // Calculate correlations
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1 // Perfect correlation with itself
      } else {
        const corr = calculateCorrelation(data[labels[i]], data[labels[j]])
        matrix[i][j] = corr !== null ? corr : 0
      }
    }
  }

  return {
    labels,
    matrix,
  }
}

/**
 * Interpret correlation strength
 */
export function getCorrelationStrength(correlation: number): string {
  const abs = Math.abs(correlation)

  if (abs >= 0.9) return 'Very Strong'
  if (abs >= 0.7) return 'Strong'
  if (abs >= 0.5) return 'Moderate'
  if (abs >= 0.3) return 'Weak'
  return 'Very Weak'
}

/**
 * Get color for correlation value (for heatmap visualization)
 */
export function getCorrelationColor(correlation: number): string {
  // Returns a color from red (negative correlation) to blue (positive correlation)
  if (correlation >= 0.7) return '#2563eb' // Strong positive - blue
  if (correlation >= 0.3) return '#60a5fa' // Moderate positive - light blue
  if (correlation >= -0.3) return '#94a3b8' // Weak - gray
  if (correlation >= -0.7) return '#fb923c' // Moderate negative - light red
  return '#dc2626' // Strong negative - red
}
