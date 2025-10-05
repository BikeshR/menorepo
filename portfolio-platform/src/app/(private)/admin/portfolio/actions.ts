'use server'

import { revalidatePath } from 'next/cache'
import { isAuthenticated } from '@/lib/auth/session'
import { AlphaVantageError, createAlphaVantageClient } from '@/lib/integrations/alphavantage'
import {
  createKrakenClient,
  getKrakenPair,
  KrakenError,
  normalizeKrakenAsset,
} from '@/lib/integrations/kraken'
import {
  convertToBaseCurrency,
  countryToRegion,
  createTrading212Client,
  exchangeToCountry,
  normalizeCurrency,
  parseTrading212Ticker,
  Trading212Error,
} from '@/lib/integrations/trading212'
import { createServiceClient } from '@/lib/supabase/server'

export type SyncPortfolioResult = {
  success: boolean
  message?: string
  data?: {
    positionsSynced: number
    totalValue: number
    snapshotCreated: boolean
  }
  error?: string
}

export type HealthCheckResult = {
  success: boolean
  message: string
  details?: {
    cashBalance?: number
    baseUrl?: string
    authenticated?: boolean
  }
  error?: string
}

/**
 * Test Trading212 API connection
 * Makes a simple API call to verify credentials are working
 */
export async function testTrading212Connection(): Promise<HealthCheckResult> {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'You must be logged in to test the API connection',
      }
    }

    const trading212 = createTrading212Client()

    // Try to fetch cash balance as a simple healthcheck
    const cash = await trading212.getCash()

    return {
      success: true,
      message: 'Successfully connected to Trading212 API',
      details: {
        cashBalance: cash.total,
        authenticated: true,
      },
    }
  } catch (error) {
    if (error instanceof Trading212Error) {
      return {
        success: false,
        message: 'Trading212 API connection failed',
        error: error.message,
        details: {
          authenticated: false,
        },
      }
    }

    return {
      success: false,
      message: 'Failed to connect to Trading212 API',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sync portfolio from Trading212 API
 * Fetches current positions and stores them in the database
 */
export async function syncTradingPortfolio(): Promise<SyncPortfolioResult> {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'You must be logged in to sync your portfolio',
      }
    }

    const supabase = createServiceClient()

    // Get or create portfolio (single-user system - only one portfolio exists)
    let { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('*')
      .limit(1)
      .single()

    if (portfolioError || !portfolio) {
      // Create portfolio if it doesn't exist
      const { data: newPortfolio, error: createError } = await supabase
        .from('portfolios')
        .insert({
          name: 'Main Portfolio',
          description: 'Investment portfolio tracking stocks, ETFs, and crypto',
        })
        .select()
        .single()

      if (createError || !newPortfolio) {
        console.error('Failed to create portfolio:', createError)
        return {
          success: false,
          message: 'Failed to create portfolio',
        }
      }

      portfolio = newPortfolio
    }

    // Create sync log
    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        portfolio_id: portfolio.id,
        sync_type: 'manual',
        status: 'started',
        source: 'trading212',
      })
      .select()
      .single()

    if (syncLogError || !syncLog) {
      console.error('Failed to create sync log:', syncLogError)
    }

    try {
      // Initialize Trading212 client
      const trading212 = createTrading212Client()

      // Fetch portfolio positions
      const positions = await trading212.getPortfolio()

      // Fetch account cash balance
      const cash = await trading212.getCash()

      // Fetch instruments metadata for additional details
      const instruments = await trading212.getInstruments()
      const instrumentMap = new Map(instruments.map((i) => [i.ticker, i]))

      // Process each position
      let positionsSynced = 0
      let totalValue = 0

      for (const position of positions) {
        const instrument = instrumentMap.get(position.ticker)
        const { symbol, exchange } = parseTrading212Ticker(position.ticker)
        const country = exchangeToCountry(exchange)
        const region = countryToRegion(country)

        // Get currency info and normalize prices
        const currencyCode = instrument?.currencyCode || 'USD'
        const { baseCurrency } = normalizeCurrency(currencyCode)

        // Convert prices from Trading212 currency (e.g., GBX pence) to base currency (e.g., GBP)
        const normalizedAveragePrice = convertToBaseCurrency(position.averagePrice, currencyCode)
        const normalizedCurrentPrice = convertToBaseCurrency(position.currentPrice, currencyCode)
        const normalizedPpl = convertToBaseCurrency(position.ppl, currencyCode)

        const marketValue = position.quantity * normalizedCurrentPrice
        const gainLossPct =
          normalizedAveragePrice > 0
            ? ((normalizedCurrentPrice - normalizedAveragePrice) / normalizedAveragePrice) * 100
            : 0

        // Determine asset type
        let assetType: 'stock' | 'etf' = 'stock'
        if (instrument?.type === 'ETF') {
          assetType = 'etf'
        }

        // Upsert stock position
        const { error: stockError } = await supabase
          .from('stocks')
          .upsert(
            {
              portfolio_id: portfolio.id,
              ticker: position.ticker,
              name: instrument?.name || symbol,
              asset_type: assetType,
              isin: instrument?.isin,
              currency: baseCurrency, // Store normalized currency (GBP instead of GBX)
              quantity: position.quantity,
              average_cost: normalizedAveragePrice, // Store in base currency
              current_price: normalizedCurrentPrice, // Store in base currency
              gain_loss: normalizedPpl, // Store in base currency
              gain_loss_pct: gainLossPct,
              exchange,
              country,
              region,
              initial_fill_date: position.initialFillDate,
              last_synced_at: new Date().toISOString(),
            },
            {
              onConflict: 'portfolio_id,ticker',
            }
          )
          .select()
          .single()

        if (stockError) {
          console.error(`Failed to upsert stock ${position.ticker}:`, stockError)
          continue
        }

        positionsSynced++
        totalValue += marketValue
      }

      // Create portfolio snapshot
      const snapshotDate = new Date().toISOString().split('T')[0]

      // Calculate total cost basis with currency normalization
      const totalCostBasis = positions.reduce((sum, p) => {
        const instrument = instrumentMap.get(p.ticker)
        const currencyCode = instrument?.currencyCode || 'USD'
        const normalizedAvgPrice = convertToBaseCurrency(p.averagePrice, currencyCode)
        return sum + p.quantity * normalizedAvgPrice
      }, 0)

      const totalGainLoss = totalValue - totalCostBasis
      const totalReturnPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0

      const { error: snapshotError } = await supabase.from('portfolio_snapshots').upsert(
        {
          portfolio_id: portfolio.id,
          snapshot_date: snapshotDate,
          total_value: totalValue,
          total_cost_basis: totalCostBasis,
          total_gain_loss: totalGainLoss,
          total_return_pct: totalReturnPct,
          cash_balance: cash.free,
          snapshot_type: 'manual',
        },
        {
          onConflict: 'portfolio_id,snapshot_date,snapshot_type',
        }
      )

      if (snapshotError) {
        console.error('Failed to create snapshot:', snapshotError)
      }

      // Create stock history snapshots for each position
      for (const position of positions) {
        const { data: stock } = await supabase
          .from('stocks')
          .select('id, currency')
          .eq('portfolio_id', portfolio.id)
          .eq('ticker', position.ticker)
          .single()

        if (stock) {
          const instrument = instrumentMap.get(position.ticker)
          const currencyCode = instrument?.currencyCode || 'USD'

          // Convert prices to base currency
          const normalizedCurrentPrice = convertToBaseCurrency(position.currentPrice, currencyCode)
          const normalizedPpl = convertToBaseCurrency(position.ppl, currencyCode)
          const marketValue = position.quantity * normalizedCurrentPrice
          const gainLossPct =
            position.averagePrice > 0
              ? ((normalizedCurrentPrice -
                  convertToBaseCurrency(position.averagePrice, currencyCode)) /
                  convertToBaseCurrency(position.averagePrice, currencyCode)) *
                100
              : 0

          await supabase.from('stock_history').upsert(
            {
              stock_id: stock.id,
              snapshot_date: snapshotDate,
              quantity: position.quantity,
              price: normalizedCurrentPrice, // Store in base currency
              market_value: marketValue,
              gain_loss: normalizedPpl, // Store in base currency
              gain_loss_pct: gainLossPct,
            },
            {
              onConflict: 'stock_id,snapshot_date',
            }
          )
        }
      }

      // Update sync log as completed
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_synced: positionsSynced,
          })
          .eq('id', syncLog.id)
      }

      // Revalidate portfolio page
      revalidatePath('/admin/portfolio')

      return {
        success: true,
        message: `Successfully synced ${positionsSynced} positions`,
        data: {
          positionsSynced,
          totalValue,
          snapshotCreated: !snapshotError,
        },
      }
    } catch (error) {
      // Update sync log as failed
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', syncLog.id)
      }

      if (error instanceof Trading212Error) {
        return {
          success: false,
          message: 'Trading212 API error',
          error: error.message,
        }
      }

      throw error
    }
  } catch (error) {
    console.error('Unexpected error in syncTradingPortfolio:', error)
    return {
      success: false,
      message: 'An unexpected error occurred while syncing portfolio',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get historical portfolio snapshots for charting
 *
 * @param days Number of days of history to fetch (default: 30)
 * @returns Array of portfolio snapshots sorted by date (oldest first)
 */
export async function getPortfolioHistory(days = 30) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return null
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase.from('portfolios').select('*').limit(1).single()

    if (!portfolio) {
      return null
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get historical snapshots
    const { data: snapshots } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .lte('snapshot_date', endDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true })

    return snapshots || []
  } catch (error) {
    console.error('Error fetching portfolio history:', error)
    return null
  }
}

/**
 * Get portfolio summary data
 */
export async function getPortfolioSummary() {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return null
    }

    const supabase = createServiceClient()

    // Get portfolio (single-user system - only one portfolio exists)
    const { data: portfolio } = await supabase.from('portfolios').select('*').limit(1).single()

    if (!portfolio) {
      return null
    }

    // Get latest snapshot
    const { data: latestSnapshot } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    // Get all stock positions
    const { data: positions } = await supabase
      .from('stocks')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('market_value', { ascending: false })

    // Get all crypto positions
    const { data: cryptoPositions } = await supabase
      .from('crypto')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('market_value', { ascending: false })

    // Get latest sync logs
    const { data: latestStockSync } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .eq('source', 'trading212')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    const { data: latestCryptoSync } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .eq('source', 'kraken')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    return {
      portfolio,
      latestSnapshot,
      positions: positions || [],
      cryptoPositions: cryptoPositions || [],
      latestSync: latestStockSync,
      latestCryptoSync,
    }
  } catch (error) {
    console.error('Error fetching portfolio summary:', error)
    return null
  }
}

/**
 * Enrich stock positions with sector and industry data from Alpha Vantage
 *
 * WARNING: Alpha Vantage free tier has strict rate limits:
 * - 25 requests per day
 * - 5 requests per minute
 *
 * This function should be used sparingly - only for stocks missing sector data
 */
export async function enrichStockSectorData(limit = 5): Promise<{
  success: boolean
  message: string
  enriched: number
  errors: number
}> {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'You must be logged in to enrich sector data',
        enriched: 0,
        errors: 0,
      }
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase.from('portfolios').select('*').limit(1).single()

    if (!portfolio) {
      return {
        success: false,
        message: 'No portfolio found',
        enriched: 0,
        errors: 0,
      }
    }

    // Get stocks without sector data (limit to avoid hitting rate limits)
    const { data: stocksWithoutSector } = await supabase
      .from('stocks')
      .select('id, ticker, name')
      .eq('portfolio_id', portfolio.id)
      .is('sector', null)
      .limit(limit)

    if (!stocksWithoutSector || stocksWithoutSector.length === 0) {
      return {
        success: true,
        message: 'All stocks already have sector data',
        enriched: 0,
        errors: 0,
      }
    }

    const alphaVantage = createAlphaVantageClient()

    let enriched = 0
    let errors = 0

    // Process each stock with delay between requests (12 seconds = 5 requests/minute)
    for (const stock of stocksWithoutSector) {
      try {
        // Extract symbol from Trading212 ticker format (e.g., 'AAPL_US_EQ' -> 'AAPL')
        const { symbol } = parseTrading212Ticker(stock.ticker)

        // Fetch company overview from Alpha Vantage
        const overview = await alphaVantage.getCompanyOverview(symbol)

        // Update stock with sector and industry data
        await supabase
          .from('stocks')
          .update({
            sector: overview.Sector || null,
            industry: overview.Industry || null,
          })
          .eq('id', stock.id)

        enriched++

        // Add delay between requests (except for the last one)
        if (enriched < stocksWithoutSector.length) {
          await new Promise((resolve) => setTimeout(resolve, 12000))
        }
      } catch (error) {
        errors++
        if (error instanceof AlphaVantageError) {
          // If we hit rate limit, stop processing
          if (error.message.includes('rate limit')) {
            return {
              success: false,
              message: `Rate limit exceeded after enriching ${enriched} stocks. Try again later.`,
              enriched,
              errors,
            }
          }
        }
        console.error(`Failed to enrich sector data for ${stock.ticker}:`, error)
      }
    }

    revalidatePath('/admin/portfolio')

    return {
      success: true,
      message: `Successfully enriched ${enriched} stocks with sector data`,
      enriched,
      errors,
    }
  } catch (error) {
    console.error('Error enriching sector data:', error)
    return {
      success: false,
      message: 'Failed to enrich sector data',
      enriched: 0,
      errors: 0,
    }
  }
}

/**
 * Test Kraken API connection
 * Makes a simple API call to verify credentials are working
 */
export async function testKrakenConnection(): Promise<HealthCheckResult> {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'You must be logged in to test the API connection',
      }
    }

    const kraken = createKrakenClient()

    // Try to fetch balance as a simple healthcheck
    const balance = await kraken.getBalance()

    // Count number of assets
    const assetCount = Object.keys(balance).length

    return {
      success: true,
      message: 'Successfully connected to Kraken API',
      details: {
        authenticated: true,
        cashBalance: assetCount, // Using assetCount as a proxy
      },
    }
  } catch (error) {
    if (error instanceof KrakenError) {
      return {
        success: false,
        message: 'Kraken API connection failed',
        error: error.message,
        details: {
          authenticated: false,
        },
      }
    }

    return {
      success: false,
      message: 'Failed to connect to Kraken API',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sync crypto portfolio from Kraken API
 * Fetches current balances and stores them in the database
 */
export async function syncKrakenPortfolio(): Promise<SyncPortfolioResult> {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'You must be logged in to sync your portfolio',
      }
    }

    const supabase = createServiceClient()

    // Get or create portfolio
    let { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('*')
      .limit(1)
      .single()

    if (portfolioError || !portfolio) {
      const { data: newPortfolio, error: createError } = await supabase
        .from('portfolios')
        .insert({
          name: 'Main Portfolio',
          description: 'Investment portfolio tracking stocks, ETFs, and crypto',
        })
        .select()
        .single()

      if (createError || !newPortfolio) {
        console.error('Failed to create portfolio:', createError)
        return {
          success: false,
          message: 'Failed to create portfolio',
        }
      }

      portfolio = newPortfolio
    }

    // Create sync log
    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        portfolio_id: portfolio.id,
        sync_type: 'manual',
        status: 'started',
        source: 'kraken',
      })
      .select()
      .single()

    if (syncLogError || !syncLog) {
      console.error('Failed to create sync log:', syncLogError)
    }

    try {
      // Initialize Kraken client
      const kraken = createKrakenClient()

      // Fetch account balance
      const balances = await kraken.getBalance()

      // Filter out zero/near-zero balances and fiat currencies
      const significantBalances = Object.entries(balances).filter(([asset, balance]) => {
        const numBalance = parseFloat(balance)
        const normalizedAsset = normalizeKrakenAsset(asset)

        // Filter out zero balances
        if (numBalance < 0.00000001) return false

        // Filter out fiat currencies (USD, EUR, GBP, etc.)
        const fiatCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
        if (fiatCurrencies.includes(normalizedAsset)) return false

        return true
      })

      // Aggregate balances by normalized symbol (combine staking variants)
      // Example: ATOM.F + ATOM21.S + ATOM -> single ATOM position
      const aggregatedBalances = new Map<string, { quantity: number; assetCodes: string[] }>()

      for (const [assetCode, balanceStr] of significantBalances) {
        const quantity = parseFloat(balanceStr)
        const symbol = normalizeKrakenAsset(assetCode)

        const existing = aggregatedBalances.get(symbol)
        if (existing) {
          existing.quantity += quantity
          existing.assetCodes.push(assetCode)
        } else {
          aggregatedBalances.set(symbol, {
            quantity,
            assetCodes: [assetCode],
          })
        }
      }

      // Fetch trade history to calculate average cost
      let tradesHistory: Record<
        string,
        {
          pair: string
          type: 'buy' | 'sell'
          vol: string
          cost: string
        }
      > = {}
      try {
        const historyResponse = await kraken.getTradesHistory()
        tradesHistory = historyResponse.trades || {}
      } catch (error) {
        console.error('Failed to fetch trade history:', error)
        // Continue without cost basis if trades history fails
      }

      // Get ticker prices for all unique crypto assets
      const cryptoAssets = Array.from(aggregatedBalances.keys())
      const pairs = cryptoAssets.map(getKrakenPair)

      // Fetch ticker data one by one to avoid failures from unknown pairs
      const tickerData: Record<string, { c: [string, string] }> = {}
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i]
        const asset = cryptoAssets[i]
        try {
          const data = await kraken.getTicker([pair])
          Object.assign(tickerData, data)
        } catch (error) {
          console.error(`Failed to fetch ticker for ${asset} (${pair}):`, error)
          // Continue with other pairs even if one fails
        }
      }

      // Calculate average cost for each asset from trade history
      const calculateAverageCost = (assetSymbol: string): number => {
        const pair = getKrakenPair(assetSymbol)

        // Find all buy trades for this asset
        const buyTrades = Object.values(tradesHistory).filter((trade) => {
          return trade.pair === pair && trade.type === 'buy'
        })

        if (buyTrades.length === 0) return 0

        // Calculate weighted average price
        let totalCost = 0
        let totalVolume = 0

        for (const trade of buyTrades) {
          const vol = parseFloat(trade.vol)
          const cost = parseFloat(trade.cost)
          totalCost += cost
          totalVolume += vol
        }

        return totalVolume > 0 ? totalCost / totalVolume : 0
      }

      // Process each aggregated crypto position
      let positionsSynced = 0
      let totalValue = 0

      for (const [symbol, { quantity }] of aggregatedBalances) {
        const pair = getKrakenPair(symbol)

        // Get current price from ticker
        let currentPrice = 0
        if (tickerData[pair]) {
          currentPrice = parseFloat(tickerData[pair].c[0]) // Last trade price
        }

        // Calculate average cost from trade history
        const averageCost = calculateAverageCost(symbol)

        const marketValue = quantity * currentPrice
        const costBasis = quantity * averageCost
        const gainLoss = marketValue - costBasis
        const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

        // Upsert crypto position (using normalized symbol as asset_code)
        const { error: cryptoError } = await supabase
          .from('crypto')
          .upsert(
            {
              portfolio_id: portfolio.id,
              asset_code: symbol, // Use normalized symbol (e.g., 'ATOM' instead of 'ATOM.F')
              symbol,
              name: symbol, // TODO: Add crypto name mapping
              quantity,
              current_price: currentPrice,
              average_cost: averageCost,
              gain_loss: gainLoss,
              gain_loss_pct: gainLossPct,
              last_synced_at: new Date().toISOString(),
            },
            {
              onConflict: 'portfolio_id,asset_code',
            }
          )
          .select()
          .single()

        if (cryptoError) {
          console.error(`Failed to upsert crypto ${symbol}:`, cryptoError)
          continue
        }

        positionsSynced++
        totalValue += marketValue
      }

      // Clean up old staking variant entries (keep only normalized symbols)
      const normalizedSymbols = Array.from(aggregatedBalances.keys())
      const { data: allCrypto } = await supabase
        .from('crypto')
        .select('id, asset_code')
        .eq('portfolio_id', portfolio.id)

      if (allCrypto) {
        for (const crypto of allCrypto) {
          // If this asset_code is not in our normalized list, delete it
          // (it's an old staking variant entry like TIA.F, ATOM21.S)
          if (!normalizedSymbols.includes(crypto.asset_code)) {
            await supabase.from('crypto').delete().eq('id', crypto.id)
          }
        }
      }

      // Create crypto history snapshots
      const snapshotDate = new Date().toISOString().split('T')[0]

      for (const [symbol] of aggregatedBalances) {
        const { data: crypto } = await supabase
          .from('crypto')
          .select('id, quantity, current_price, average_cost, gain_loss, gain_loss_pct')
          .eq('portfolio_id', portfolio.id)
          .eq('asset_code', symbol)
          .single()

        if (crypto && crypto.current_price !== null) {
          const marketValue = crypto.quantity * crypto.current_price

          await supabase.from('crypto_history').upsert(
            {
              crypto_id: crypto.id,
              snapshot_date: snapshotDate,
              quantity: crypto.quantity,
              price: crypto.current_price,
              market_value: marketValue,
              gain_loss: crypto.gain_loss,
              gain_loss_pct: crypto.gain_loss_pct,
            },
            {
              onConflict: 'crypto_id,snapshot_date',
            }
          )
        }
      }

      // Update sync log as completed
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_synced: positionsSynced,
          })
          .eq('id', syncLog.id)
      }

      // Revalidate portfolio page
      revalidatePath('/admin/portfolio')

      return {
        success: true,
        message: `Successfully synced ${positionsSynced} crypto positions`,
        data: {
          positionsSynced,
          totalValue,
          snapshotCreated: true,
        },
      }
    } catch (error) {
      // Update sync log as failed
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', syncLog.id)
      }

      if (error instanceof KrakenError) {
        return {
          success: false,
          message: 'Kraken API error',
          error: error.message,
        }
      }

      throw error
    }
  } catch (error) {
    console.error('Unexpected error in syncKrakenPortfolio:', error)
    return {
      success: false,
      message: 'An unexpected error occurred while syncing crypto portfolio',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
