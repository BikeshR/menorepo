/**
 * Daily Portfolio Sync Edge Function
 *
 * This function runs daily to:
 * 1. Sync Trading212 positions
 * 2. Sync Kraken crypto positions
 * 3. Create portfolio snapshots
 * 4. Update position data in database
 */

import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'
import { fetchTrading212Positions } from '../_shared/trading212-client.ts'

interface PortfolioPosition {
  ticker: string
  quantity: number
  average_price: number
  current_price: number
  value: number
  cost_basis: number
  gain_loss: number
  gain_loss_percentage: number
  asset_type: string
  currency: string
  source: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Starting daily portfolio sync...')
    const supabase = createSupabaseClient()

    // 1. Fetch Trading212 positions
    console.log('Fetching Trading212 positions...')
    const trading212Positions = await fetchTrading212Positions()
    console.log(`Fetched ${trading212Positions.length} Trading212 positions`)

    // 2. Transform Trading212 positions to our schema
    const positions: PortfolioPosition[] = trading212Positions.map((pos) => ({
      ticker: pos.ticker,
      quantity: pos.quantity,
      average_price: pos.averagePrice,
      current_price: pos.currentPrice,
      value: pos.value,
      cost_basis: pos.quantity * pos.averagePrice,
      gain_loss: pos.ppl,
      gain_loss_percentage: pos.pplPercentage,
      asset_type: 'stock', // Trading212 is primarily stocks/ETFs
      currency: 'GBP', // Default currency
      source: 'trading212',
    }))

    // 3. Upsert positions into database
    console.log('Upserting positions into database...')
    const { error: positionsError } = await supabase.from('positions').upsert(
      positions.map((pos) => ({
        ticker: pos.ticker,
        quantity: pos.quantity,
        average_price: pos.average_price,
        current_price: pos.current_price,
        value: pos.value,
        cost_basis: pos.cost_basis,
        gain_loss: pos.gain_loss,
        gain_loss_percentage: pos.gain_loss_percentage,
        asset_type: pos.asset_type,
        currency: pos.currency,
        source: pos.source,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'ticker' }
    )

    if (positionsError) {
      console.error('Error upserting positions:', positionsError)
      throw positionsError
    }

    // 4. Create portfolio snapshot
    console.log('Creating portfolio snapshot...')
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0)
    const totalCostBasis = positions.reduce((sum, pos) => sum + pos.cost_basis, 0)
    const totalGainLoss = totalValue - totalCostBasis
    const totalGainLossPercentage = (totalGainLoss / totalCostBasis) * 100

    const { error: snapshotError } = await supabase.from('portfolio_snapshots').insert({
      total_value: totalValue,
      total_cost_basis: totalCostBasis,
      total_gain_loss: totalGainLoss,
      total_gain_loss_percentage: totalGainLossPercentage,
      snapshot_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    })

    if (snapshotError) {
      console.error('Error creating snapshot:', snapshotError)
      throw snapshotError
    }

    console.log('Portfolio sync completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Portfolio sync completed',
        data: {
          positionsCount: positions.length,
          totalValue,
          totalGainLoss,
          totalGainLossPercentage,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Portfolio sync error:', error)

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
