/**
 * Calculate Metrics Edge Function
 *
 * This function calculates advanced portfolio metrics:
 * 1. Sharpe Ratio
 * 2. Sortino Ratio
 * 3. Maximum Drawdown
 * 4. Value at Risk (VaR)
 * 5. Beta vs benchmark
 * 6. Alpha
 * 7. IRR and TWR
 */

import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'

interface PortfolioSnapshot {
  snapshot_date: string
  total_value: number
  total_cost_basis: number
  total_gain_loss: number
  total_gain_loss_percentage: number
}

interface BenchmarkData {
  date: string
  close_price: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Starting metrics calculation...')
    const supabase = createSupabaseClient()

    // 1. Fetch portfolio snapshots (last 365 days)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data: snapshots, error: snapshotsError } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .gte('snapshot_date', oneYearAgo.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true })

    if (snapshotsError) throw snapshotsError
    if (!snapshots || snapshots.length < 2) {
      throw new Error('Insufficient snapshot data for metrics calculation')
    }

    // 2. Calculate daily returns
    const portfolioReturns: number[] = []
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].total_value
      const currValue = snapshots[i].total_value
      const dailyReturn = (currValue - prevValue) / prevValue
      portfolioReturns.push(dailyReturn)
    }

    // 3. Fetch benchmark data (S&P 500)
    const { data: benchmarkData, error: benchmarkError } = await supabase
      .from('benchmark_data')
      .select('*')
      .eq('symbol', 'SPY')
      .gte('date', oneYearAgo.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (benchmarkError) throw benchmarkError

    // Calculate benchmark returns
    const benchmarkReturns: number[] = []
    if (benchmarkData && benchmarkData.length > 1) {
      for (let i = 1; i < benchmarkData.length; i++) {
        const prevPrice = benchmarkData[i - 1].close_price
        const currPrice = benchmarkData[i].close_price
        const dailyReturn = (currPrice - prevPrice) / prevPrice
        benchmarkReturns.push(dailyReturn)
      }
    }

    // 4. Calculate metrics
    const avgReturn = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length
    const stdDev = Math.sqrt(
      portfolioReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / portfolioReturns.length
    )

    // Annualized metrics
    const annualizedReturn = (1 + avgReturn) ** 252 - 1 // 252 trading days
    const annualizedVolatility = stdDev * Math.sqrt(252)

    // Sharpe Ratio (assuming 4% risk-free rate)
    const riskFreeRate = 0.04
    const sharpeRatio = (annualizedReturn - riskFreeRate) / annualizedVolatility

    // Sortino Ratio (downside deviation)
    const downsideReturns = portfolioReturns.filter((r) => r < 0)
    const downsideDeviation =
      Math.sqrt(downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / downsideReturns.length) *
      Math.sqrt(252)
    const sortinoRatio = (annualizedReturn - riskFreeRate) / downsideDeviation

    // Maximum Drawdown
    let maxDrawdown = 0
    let peak = snapshots[0].total_value
    for (const snapshot of snapshots) {
      if (snapshot.total_value > peak) {
        peak = snapshot.total_value
      }
      const drawdown = (peak - snapshot.total_value) / peak
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    // Value at Risk (95% and 99%)
    const sortedReturns = [...portfolioReturns].sort((a, b) => a - b)
    const var95 = sortedReturns[Math.floor(0.05 * sortedReturns.length)]
    const var99 = sortedReturns[Math.floor(0.01 * sortedReturns.length)]

    // CVaR (Conditional VaR / Expected Shortfall)
    const var95Returns = sortedReturns.slice(0, Math.floor(0.05 * sortedReturns.length))
    const cvar95 = var95Returns.reduce((a, b) => a + b, 0) / var95Returns.length

    // Beta and Alpha (if benchmark data available)
    let beta = null
    let alpha = null
    if (benchmarkReturns.length > 0) {
      const minLength = Math.min(portfolioReturns.length, benchmarkReturns.length)
      const alignedPortfolioReturns = portfolioReturns.slice(0, minLength)
      const alignedBenchmarkReturns = benchmarkReturns.slice(0, minLength)

      const avgBenchmarkReturn =
        alignedBenchmarkReturns.reduce((a, b) => a + b, 0) / alignedBenchmarkReturns.length

      const covariance =
        alignedPortfolioReturns.reduce((sum, r, i) => {
          return sum + (r - avgReturn) * (alignedBenchmarkReturns[i] - avgBenchmarkReturn)
        }, 0) / minLength

      const benchmarkVariance =
        alignedBenchmarkReturns.reduce((sum, r) => {
          return sum + (r - avgBenchmarkReturn) ** 2
        }, 0) / minLength

      beta = covariance / benchmarkVariance
      alpha =
        annualizedReturn -
        (riskFreeRate + beta * ((1 + avgBenchmarkReturn) ** 252 - 1 - riskFreeRate))
    }

    // IRR calculation (using XIRR approximation)
    const firstSnapshot = snapshots[0]
    const lastSnapshot = snapshots[snapshots.length - 1]
    const daysDiff =
      (new Date(lastSnapshot.snapshot_date).getTime() -
        new Date(firstSnapshot.snapshot_date).getTime()) /
      (1000 * 60 * 60 * 24)
    const years = daysDiff / 365.25
    const irr = (lastSnapshot.total_value / firstSnapshot.total_value) ** (1 / years) - 1

    // TWR (Time-Weighted Return)
    const twr = (lastSnapshot.total_value / firstSnapshot.total_value) ** (1 / years) - 1

    // 5. Store metrics in database
    const metrics = {
      sharpe_ratio: sharpeRatio,
      sortino_ratio: sortinoRatio,
      max_drawdown: maxDrawdown,
      var_95: var95,
      var_99: var99,
      cvar_95: cvar95,
      beta: beta,
      alpha: alpha,
      annualized_return: annualizedReturn,
      annualized_volatility: annualizedVolatility,
      irr: irr,
      twr: twr,
      calculated_at: new Date().toISOString(),
    }

    const { error: metricsError } = await supabase
      .from('portfolio_metrics')
      .upsert(metrics, { onConflict: 'calculated_at' })

    if (metricsError) {
      console.error('Error storing metrics:', metricsError)
      throw metricsError
    }

    console.log('Metrics calculation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Metrics calculated successfully',
        data: metrics,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Metrics calculation error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
