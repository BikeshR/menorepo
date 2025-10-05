/**
 * Calculate Internal Rate of Return (IRR) from cash flows
 *
 * Uses Newton-Raphson method to solve for the discount rate that makes NPV = 0
 *
 * @param cashFlows Array of cash flows with dates
 * @returns IRR as decimal (e.g., 0.15 = 15%), or null if calculation fails
 */
export function calculateIRR(
  cashFlows: Array<{ date: Date; amount: number }>,
  maxIterations = 100,
  tolerance = 1e-6,
): number | null {
  if (cashFlows.length < 2) {
    return null
  }

  // Sort cash flows by date
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime())

  // Calculate time periods in years from first cash flow
  const firstDate = sorted[0].date.getTime()
  const periods = sorted.map((cf) => {
    const daysDiff = (cf.date.getTime() - firstDate) / (1000 * 60 * 60 * 24)
    return daysDiff / 365.25 // Account for leap years
  })

  // NPV function: NPV(r) = Σ(CF_t / (1 + r)^t)
  const npv = (rate: number): number => {
    return sorted.reduce((sum, cf, i) => {
      return sum + cf.amount / (1 + rate) ** periods[i]
    }, 0)
  }

  // Derivative of NPV: NPV'(r) = Σ(-t * CF_t / (1 + r)^(t+1))
  const npvDerivative = (rate: number): number => {
    return sorted.reduce((sum, cf, i) => {
      return sum + (-periods[i] * cf.amount) / (1 + rate) ** (periods[i] + 1)
    }, 0)
  }

  // Newton-Raphson method
  let rate = 0.1 // Initial guess: 10%

  for (let i = 0; i < maxIterations; i++) {
    const npvValue = npv(rate)
    const npvDeriv = npvDerivative(rate)

    // Check if derivative is too small (avoid division by zero)
    if (Math.abs(npvDeriv) < tolerance) {
      return null
    }

    const newRate = rate - npvValue / npvDeriv

    // Check for convergence
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate
    }

    rate = newRate

    // Sanity check: IRR should be between -100% and 1000%
    if (rate < -1 || rate > 10) {
      return null
    }
  }

  // Failed to converge
  return null
}

/**
 * Calculate IRR for a position from transaction history
 *
 * @param transactions Array of buy/sell transactions
 * @param currentValue Current market value of the position
 * @returns IRR as decimal, or null if calculation fails
 */
export function calculatePositionIRR(
  transactions: Array<{
    transaction_type: string
    total_value: number
    executed_at: string
  }>,
  currentValue: number,
): number | null {
  if (transactions.length === 0) {
    return null
  }

  // Convert transactions to cash flows
  const cashFlows = transactions.map((tx) => ({
    date: new Date(tx.executed_at),
    // Buys are negative cash flows (money out), sells are positive (money in)
    amount: tx.transaction_type === 'buy' ? -tx.total_value : tx.total_value,
  }))

  // Add current value as final positive cash flow (as if selling today)
  cashFlows.push({
    date: new Date(),
    amount: currentValue,
  })

  return calculateIRR(cashFlows)
}

/**
 * Calculate portfolio-wide IRR from all transactions
 *
 * @param transactions All portfolio transactions
 * @param currentPortfolioValue Current total portfolio value
 * @returns IRR as decimal, or null if calculation fails
 */
export function calculatePortfolioIRR(
  transactions: Array<{
    transaction_type: string
    total_value: number
    executed_at: string
  }>,
  currentPortfolioValue: number,
): number | null {
  if (transactions.length === 0) {
    return null
  }

  // Convert all transactions to cash flows
  const cashFlows = transactions.map((tx) => ({
    date: new Date(tx.executed_at),
    amount: tx.transaction_type === 'buy' ? -tx.total_value : tx.total_value,
  }))

  // Add current portfolio value as final cash flow
  cashFlows.push({
    date: new Date(),
    amount: currentPortfolioValue,
  })

  return calculateIRR(cashFlows)
}
