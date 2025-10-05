/**
 * Update Benchmark Data Edge Function
 *
 * This function updates benchmark data for:
 * 1. S&P 500 (SPY ETF)
 * 2. MSCI World (URTH ETF)
 *
 * Uses AlphaVantage API for historical price data
 */

import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'

interface AlphaVantageTimeSeriesData {
  'Meta Data': {
    '1. Information': string
    '2. Symbol': string
    '3. Last Refreshed': string
    '4. Output Size': string
    '5. Time Zone': string
  }
  'Time Series (Daily)': {
    [date: string]: {
      '1. open': string
      '2. high': string
      '3. low': string
      '4. close': string
      '5. volume': string
    }
  }
}

async function fetchBenchmarkData(
  symbol: string
): Promise<{ date: string; close_price: number }[]> {
  const apiKey = Deno.env.get('ALPHAVANTAGE_API_KEY')
  if (!apiKey) {
    throw new Error('AlphaVantage API key not configured')
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`AlphaVantage API error: ${response.status}`)
  }

  const data: AlphaVantageTimeSeriesData = await response.json()

  if (!data['Time Series (Daily)']) {
    throw new Error('Invalid response from AlphaVantage API')
  }

  const timeSeries = data['Time Series (Daily)']
  const priceData = Object.entries(timeSeries).map(([date, values]) => ({
    date,
    close_price: parseFloat(values['4. close']),
  }))

  return priceData
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Starting benchmark data update...')
    const supabase = createSupabaseClient()

    const benchmarks = [
      { symbol: 'SPY', name: 'S&P 500' },
      { symbol: 'URTH', name: 'MSCI World' },
    ]

    const results = []

    for (const benchmark of benchmarks) {
      console.log(`Fetching ${benchmark.name} (${benchmark.symbol}) data...`)

      try {
        const priceData = await fetchBenchmarkData(benchmark.symbol)
        console.log(`Fetched ${priceData.length} data points for ${benchmark.symbol}`)

        // Get the latest date in our database
        const { data: latestData } = await supabase
          .from('benchmark_data')
          .select('date')
          .eq('symbol', benchmark.symbol)
          .order('date', { ascending: false })
          .limit(1)

        const latestDate = latestData && latestData.length > 0 ? latestData[0].date : null

        // Filter to only new data
        const newData = latestDate
          ? priceData.filter((d) => d.date > latestDate)
          : priceData.slice(0, 365) // Last year if no data exists

        if (newData.length === 0) {
          console.log(`No new data for ${benchmark.symbol}`)
          results.push({
            symbol: benchmark.symbol,
            name: benchmark.name,
            updatedRecords: 0,
            message: 'Already up to date',
          })
          continue
        }

        // Insert new data
        const { error: insertError } = await supabase.from('benchmark_data').upsert(
          newData.map((d) => ({
            symbol: benchmark.symbol,
            date: d.date,
            close_price: d.close_price,
          })),
          { onConflict: 'symbol,date' }
        )

        if (insertError) {
          console.error(`Error inserting ${benchmark.symbol} data:`, insertError)
          throw insertError
        }

        results.push({
          symbol: benchmark.symbol,
          name: benchmark.name,
          updatedRecords: newData.length,
          latestDate: newData[0].date,
        })

        // Rate limiting: Wait 12 seconds between API calls (AlphaVantage free tier limit: 5 calls/minute)
        if (benchmarks.indexOf(benchmark) < benchmarks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 12000))
        }
      } catch (error) {
        console.error(`Error updating ${benchmark.symbol}:`, error)
        results.push({
          symbol: benchmark.symbol,
          name: benchmark.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    console.log('Benchmark data update completed')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Benchmark data update completed',
        data: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Benchmark data update error:', error)

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
