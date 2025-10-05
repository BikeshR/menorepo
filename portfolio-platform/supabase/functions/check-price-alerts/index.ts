/**
 * Check Price Alerts Edge Function
 *
 * This function runs periodically to:
 * 1. Fetch active price alerts
 * 2. Check current prices against alert conditions
 * 3. Trigger alerts when conditions are met
 * 4. Log triggered alerts
 */

import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'

interface PriceAlert {
  id: string
  ticker: string
  alert_type: 'price_above' | 'price_below' | 'change_percent'
  target_value: number
  current_value: number | null
  is_triggered: boolean
  is_active: boolean
  notes: string | null
}

interface Position {
  ticker: string
  current_price: number
  average_price: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Starting price alerts check...')
    const supabase = createSupabaseClient()

    // 1. Fetch active alerts that haven't been triggered
    const { data: alerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('is_active', true)
      .eq('is_triggered', false)

    if (alertsError) throw alertsError

    if (!alerts || alerts.length === 0) {
      console.log('No active alerts to check')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active alerts to check',
          triggeredCount: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`Checking ${alerts.length} active alerts`)

    // 2. Fetch current positions to get current prices
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('ticker, current_price, average_price')

    if (positionsError) throw positionsError

    // Create a map of ticker -> position for quick lookup
    const positionsMap = new Map<string, Position>()
    if (positions) {
      for (const pos of positions) {
        positionsMap.set(pos.ticker, pos)
      }
    }

    // 3. Check each alert
    const triggeredAlerts: any[] = []

    for (const alert of alerts) {
      const position = positionsMap.get(alert.ticker)

      if (!position) {
        console.log(`Position not found for ticker: ${alert.ticker}`)
        continue
      }

      let isTriggered = false
      let message = ''

      switch (alert.alert_type) {
        case 'price_above':
          if (position.current_price > alert.target_value) {
            isTriggered = true
            message = `${alert.ticker} price (£${position.current_price.toFixed(2)}) rose above target £${alert.target_value.toFixed(2)}`
          }
          break

        case 'price_below':
          if (position.current_price < alert.target_value) {
            isTriggered = true
            message = `${alert.ticker} price (£${position.current_price.toFixed(2)}) fell below target £${alert.target_value.toFixed(2)}`
          }
          break

        case 'change_percent': {
          const percentChange =
            ((position.current_price - position.average_price) / position.average_price) * 100
          if (Math.abs(percentChange) >= alert.target_value) {
            isTriggered = true
            message = `${alert.ticker} changed ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}% (target: ${alert.target_value}%)`
          }
          break
        }
      }

      if (isTriggered) {
        console.log(`Alert triggered: ${message}`)

        // Update the alert as triggered
        const { error: updateError } = await supabase
          .from('price_alerts')
          .update({
            is_triggered: true,
            triggered_at: new Date().toISOString(),
            current_value: position.current_price,
            notification_sent: true, // Mark as sent (actual notification would go here)
          })
          .eq('id', alert.id)

        if (updateError) {
          console.error(`Error updating alert ${alert.id}:`, updateError)
          continue
        }

        // Log the triggered alert
        const { error: logError } = await supabase.from('alert_logs').insert({
          alert_id: alert.id,
          ticker: alert.ticker,
          alert_type: alert.alert_type,
          target_value: alert.target_value,
          triggered_value: position.current_price,
          message: message,
        })

        if (logError) {
          console.error(`Error logging alert ${alert.id}:`, logError)
        }

        triggeredAlerts.push({
          ticker: alert.ticker,
          alert_type: alert.alert_type,
          message: message,
        })

        // TODO: Send actual notification (email, push notification, etc.)
        // For now, just logging
      }
    }

    console.log(`Price alerts check completed. Triggered: ${triggeredAlerts.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Price alerts check completed',
        checkedCount: alerts.length,
        triggeredCount: triggeredAlerts.length,
        triggeredAlerts: triggeredAlerts,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Price alerts check error:', error)

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
