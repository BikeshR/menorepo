/**
 * Calculate Time-Weighted Return (TWR)
 *
 * TWR measures the compound rate of growth independent of cash flows.
 * It's the geometric mean return, useful for comparing portfolio performance
 * to benchmarks since it eliminates the impact of deposits/withdrawals.
 *
 * Unlike IRR, TWR doesn't weight returns by the amount of capital invested.
 */

/**
 * Calculate TWR using portfolio snapshots
 *
 * @param snapshots Array of portfolio values with dates
 * @returns TWR as decimal (e.g., 0.15 = 15%), or null if calculation fails
 */
export function calculateTWR(snapshots: Array<{ date: Date; value: number }>): number | null {
  if (snapshots.length < 2) {
    return null
  }

  // Sort snapshots by date
  const sorted = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime())

  const firstValue = sorted[0].value
  const lastValue = sorted[sorted.length - 1].value

  if (firstValue <= 0 || lastValue <= 0) {
    return null
  }

  // Calculate time period in years
  const firstDate = sorted[0].date.getTime()
  const lastDate = sorted[sorted.length - 1].date.getTime()
  const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24)
  const years = daysDiff / 365.25

  if (years <= 0) {
    return null
  }

  // TWR = (Ending Value / Beginning Value)^(1/years) - 1
  const twr = (lastValue / firstValue) ** (1 / years) - 1

  return twr
}

/**
 * Calculate TWR with cash flow adjustments
 *
 * More accurate TWR that adjusts for cash flows (deposits/withdrawals)
 * by breaking the period into sub-periods
 *
 * @param snapshots Portfolio values with dates
 * @param cashFlows Deposits (positive) and withdrawals (negative)
 * @returns TWR as decimal, or null if calculation fails
 */
export function calculateTWRWithCashFlows(
  snapshots: Array<{ date: Date; value: number }>,
  cashFlows: Array<{ date: Date; amount: number }>
): number | null {
  if (snapshots.length < 2) {
    return null
  }

  // Sort both arrays by date
  const sortedSnapshots = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime())
  const sortedCashFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime())

  // Create sub-periods at each cash flow event
  const subPeriods: Array<{ startValue: number; endValue: number; cashFlow: number }> = []

  let currentSnapshotIndex = 0

  for (let i = 0; i < sortedCashFlows.length; i++) {
    const cashFlowDate = sortedCashFlows[i].date.getTime()

    // Find snapshots around this cash flow
    const startValue = sortedSnapshots[currentSnapshotIndex].value
    let endValue = startValue

    // Find the snapshot after the cash flow
    while (
      currentSnapshotIndex < sortedSnapshots.length - 1 &&
      sortedSnapshots[currentSnapshotIndex + 1].date.getTime() <= cashFlowDate
    ) {
      currentSnapshotIndex++
      endValue = sortedSnapshots[currentSnapshotIndex].value
    }

    if (startValue > 0 && endValue > 0) {
      subPeriods.push({
        startValue,
        endValue,
        cashFlow: sortedCashFlows[i].amount,
      })
    }
  }

  // Add final sub-period from last cash flow to end
  if (currentSnapshotIndex < sortedSnapshots.length - 1) {
    subPeriods.push({
      startValue: sortedSnapshots[currentSnapshotIndex].value,
      endValue: sortedSnapshots[sortedSnapshots.length - 1].value,
      cashFlow: 0,
    })
  }

  // Calculate return for each sub-period
  // Return = (End Value - Begin Value - Cash Flow) / (Begin Value + Cash Flow at start)
  const subPeriodReturns = subPeriods.map((period) => {
    // Adjust for cash flow at the start of period
    const adjustedStartValue = period.startValue + period.cashFlow
    if (adjustedStartValue <= 0) {
      return 0
    }
    return (period.endValue - adjustedStartValue) / adjustedStartValue
  })

  if (subPeriodReturns.length === 0) {
    return null
  }

  // Calculate geometric mean: TWR = [(1 + r1) × (1 + r2) × ... × (1 + rn)] - 1
  const compoundReturn = subPeriodReturns.reduce((product, r) => product * (1 + r), 1)

  return compoundReturn - 1
}

/**
 * Calculate simple TWR without annualization
 * Useful for short time periods or comparing to benchmarks over the same period
 *
 * @param startValue Beginning portfolio value
 * @param endValue Ending portfolio value
 * @returns Simple return as decimal
 */
export function calculateSimpleTWR(startValue: number, endValue: number): number | null {
  if (startValue <= 0) {
    return null
  }

  return (endValue - startValue) / startValue
}

/**
 * Annualize a return rate
 *
 * @param returnRate Return as decimal
 * @param years Time period in years
 * @returns Annualized return
 */
export function annualizeReturn(returnRate: number, years: number): number {
  if (years <= 0) {
    return returnRate
  }

  return (1 + returnRate) ** (1 / years) - 1
}
