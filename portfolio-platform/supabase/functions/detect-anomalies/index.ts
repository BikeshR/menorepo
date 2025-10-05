/**
 * Detect Anomalies Edge Function
 *
 * This function runs periodically to:
 * 1. Track price movements for all positions
 * 2. Detect unusual volatility
 * 3. Identify sharp price changes
 * 4. Monitor portfolio-wide volatility
 * 5. Generate alerts for anomalies
 */

import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'

interface VoatilityAlert {
  ticker: string | null
  alert_type: string
  severity: string
  threshold_value: number
  detected_value: number
  message: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Starting anomaly detection...')
    const supabase = createSupabaseClient()

    // 1. Fetch anomaly detection configuration
    const { data: config, error: configError } = await supabase
      .from('anomaly_detection_config')
      .select('*')

    if (configError) throw configError

    const configMap = new Map<string, number>()
    if (config) {
      for (const item of config) {
        configMap.set(item.config_key, item.config_value)
      }
    }

    const volatilityThreshold = configMap.get('volatility_threshold_percent') || 5.0
    const sharpDeclineThreshold = configMap.get('sharp_decline_percent') || 10.0
    const sharpIncreaseThreshold = configMap.get('sharp_increase_percent') || 15.0
    const portfolioVolatilityThreshold = configMap.get('portfolio_volatility_threshold') || 3.0
    const lookbackDays = configMap.get('lookback_days') || 30

    // 2. Fetch current positions
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('ticker, current_price, average_price, gain_loss_percentage, value')

    if (positionsError) throw positionsError
    if (!positions || positions.length === 0) {
      throw new Error('No positions found')
    }

    console.log(`Analyzing ${positions.length} positions for anomalies`)

    const alerts: VoatilityAlert[] = []

    // 3. Record current prices in price history
    for (const position of positions) {
      // Get previous price from history
      const { data: prevPrice } = await supabase
        .from('position_price_history')
        .select('price')
        .eq('ticker', position.ticker)
        .order('recorded_at', { ascending: false })
        .limit(1)

      let priceChangePercent = null
      if (prevPrice && prevPrice.length > 0) {
        priceChangePercent =
          ((position.current_price - prevPrice[0].price) / prevPrice[0].price) * 100
      }

      // Insert current price into history
      await supabase.from('position_price_history').insert({
        ticker: position.ticker,
        price: position.current_price,
        price_change_percent: priceChangePercent,
      })

      // 4. Check for anomalies
      if (priceChangePercent !== null) {
        // High volatility detection
        if (Math.abs(priceChangePercent) >= volatilityThreshold) {
          const severity = Math.abs(priceChangePercent) >= 10 ? 'high' : 'medium'

          alerts.push({
            ticker: position.ticker,
            alert_type: 'high_volatility',
            severity,
            threshold_value: volatilityThreshold,
            detected_value: Math.abs(priceChangePercent),
            message: `${position.ticker} experienced ${Math.abs(priceChangePercent).toFixed(2)}% price movement in one day`,
          })
        }

        // Sharp decline detection
        if (priceChangePercent <= -sharpDeclineThreshold) {
          const severity = priceChangePercent <= -20 ? 'critical' : 'high'

          alerts.push({
            ticker: position.ticker,
            alert_type: 'sharp_decline',
            severity,
            threshold_value: sharpDeclineThreshold,
            detected_value: Math.abs(priceChangePercent),
            message: `${position.ticker} dropped ${Math.abs(priceChangePercent).toFixed(2)}% - significant decline detected`,
          })
        }

        // Sharp increase detection
        if (priceChangePercent >= sharpIncreaseThreshold) {
          const severity = priceChangePercent >= 25 ? 'high' : 'medium'

          alerts.push({
            ticker: position.ticker,
            alert_type: 'sharp_increase',
            severity,
            threshold_value: sharpIncreaseThreshold,
            detected_value: priceChangePercent,
            message: `${position.ticker} surged ${priceChangePercent.toFixed(2)}% - unusual upward movement`,
          })
        }
      }
    }

    // 5. Portfolio-wide volatility check
    const { data: recentSnapshots, error: snapshotsError } = await supabase
      .from('portfolio_snapshots')
      .select('total_value, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(2)

    if (!snapshotsError && recentSnapshots && recentSnapshots.length === 2) {
      const portfolioChangePercent =
        ((recentSnapshots[0].total_value - recentSnapshots[1].total_value) /
          recentSnapshots[1].total_value) *
        100

      if (Math.abs(portfolioChangePercent) >= portfolioVolatilityThreshold) {
        const severity = Math.abs(portfolioChangePercent) >= 5 ? 'high' : 'medium'

        alerts.push({
          ticker: null,
          alert_type: 'portfolio_volatility',
          severity,
          threshold_value: portfolioVolatilityThreshold,
          detected_value: Math.abs(portfolioChangePercent),
          message: `Portfolio experienced ${Math.abs(portfolioChangePercent).toFixed(2)}% ${portfolioChangePercent > 0 ? 'gain' : 'loss'} - monitor positions closely`,
        })
      }
    }

    // 6. Calculate historical volatility (standard deviation of returns)
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays)

    for (const position of positions) {
      const { data: priceHistory, error: historyError } = await supabase
        .from('position_price_history')
        .select('price_change_percent')
        .eq('ticker', position.ticker)
        .gte('recorded_at', lookbackDate.toISOString())
        .order('recorded_at', { ascending: false })

      if (!historyError && priceHistory && priceHistory.length > 5) {
        const returns = priceHistory
          .map((h) => h.price_change_percent)
          .filter((r): r is number => r !== null)

        if (returns.length > 0) {
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length
          const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
          const stdDev = Math.sqrt(variance)

          // Annualized volatility
          const annualizedVolatility = stdDev * Math.sqrt(252) // 252 trading days

          if (annualizedVolatility > 40) {
            // High annualized volatility (>40%)
            alerts.push({
              ticker: position.ticker,
              alert_type: 'high_volatility',
              severity: annualizedVolatility > 60 ? 'high' : 'medium',
              threshold_value: 40,
              detected_value: annualizedVolatility,
              message: `${position.ticker} shows high historical volatility: ${annualizedVolatility.toFixed(2)}% annualized`,
            })
          }
        }
      }
    }

    // 7. Store alerts in database
    if (alerts.length > 0) {
      const { error: insertError } = await supabase.from('volatility_alerts').insert(alerts)

      if (insertError) {
        console.error('Error inserting alerts:', insertError)
        throw insertError
      }
    }

    console.log(`Anomaly detection completed. Detected ${alerts.length} anomalies`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Anomaly detection completed',
        positionsAnalyzed: positions.length,
        anomaliesDetected: alerts.length,
        alerts: alerts,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Anomaly detection error:', error)

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
