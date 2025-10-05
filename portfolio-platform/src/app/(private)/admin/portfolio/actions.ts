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
import { calculateCorrelationMatrix } from '@/lib/utils/correlation'
import { calculateCVaR, calculateHistoricalVaR } from '@/lib/utils/var'

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

/**
 * Sync benchmark data from Alpha Vantage
 *
 * Fetches historical benchmark data (S&P 500 and MSCI World) and stores in database
 * for portfolio comparison and beta calculation
 *
 * @param symbol Benchmark symbol (default: 'SPY' for S&P 500, can also use 'URTH' for MSCI World)
 * @param benchmarkName Display name for the benchmark
 * @param daysToSync Number of days to sync (default: 100, max: 100 for compact API)
 * @returns Success status and number of records synced
 */
export async function syncBenchmarkData(
  symbol: 'SPY' | 'URTH' = 'SPY',
  benchmarkName?: string,
  daysToSync = 100
): Promise<{
  success: boolean
  message: string
  data?: {
    recordsSynced: number
    latestDate: string
  }
  error?: string
}> {
  try {
    // Create Alpha Vantage client
    const alphaVantage = createAlphaVantageClient()

    // Default benchmark names
    const defaultBenchmarkName = symbol === 'SPY' ? 'S&P 500' : 'MSCI World'
    const displayName = benchmarkName || defaultBenchmarkName

    // Fetch benchmark ETF time series data
    const timeSeriesData = await alphaVantage.getTimeSeriesDaily(symbol, 'compact')

    if (!timeSeriesData['Time Series (Daily)']) {
      return {
        success: false,
        message: 'No time series data returned from Alpha Vantage',
        error: 'Empty response',
      }
    }

    const timeSeries = timeSeriesData['Time Series (Daily)']
    const dates = Object.keys(timeSeries).slice(0, daysToSync).sort()

    if (dates.length === 0) {
      return {
        success: false,
        message: 'No data available to sync',
        error: 'Empty time series',
      }
    }

    // Prepare data for insertion with daily returns
    const benchmarkRecords = []
    let previousClose: number | null = null

    for (const date of dates) {
      const data = timeSeries[date]
      const adjustedClose = Number.parseFloat(data['5. adjusted close'])

      // Calculate daily return
      let dailyReturn: number | null = null
      if (previousClose !== null) {
        dailyReturn = ((adjustedClose - previousClose) / previousClose) * 100
      }

      benchmarkRecords.push({
        symbol,
        benchmark_name: displayName,
        date,
        open: Number.parseFloat(data['1. open']),
        high: Number.parseFloat(data['2. high']),
        low: Number.parseFloat(data['3. low']),
        close: Number.parseFloat(data['4. close']),
        adjusted_close: adjustedClose,
        volume: Number.parseInt(data['6. volume'], 10),
        daily_return: dailyReturn,
        source: 'alpha_vantage',
      })

      previousClose = adjustedClose
    }

    // Insert/upsert into database using service role (bypass RLS)
    const supabase = createServiceClient()
    const { error } = await supabase.from('benchmark_data').upsert(benchmarkRecords, {
      onConflict: 'symbol,date',
    })

    if (error) {
      console.error('Failed to insert benchmark data:', error)
      return {
        success: false,
        message: 'Database error while storing benchmark data',
        error: error.message,
      }
    }

    return {
      success: true,
      message: `Successfully synced ${benchmarkRecords.length} days of ${displayName} data`,
      data: {
        recordsSynced: benchmarkRecords.length,
        latestDate: dates[dates.length - 1],
      },
    }
  } catch (error) {
    console.error('Error syncing benchmark data:', error)
    return {
      success: false,
      message: 'Failed to sync benchmark data',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Calculate portfolio financial metrics (returns, volatility, beta)
 *
 * Analyzes portfolio performance against specified benchmark
 *
 * @param days Number of days to analyze (default: 30)
 * @param benchmarkSymbol Benchmark to compare against (default: 'SPY' for S&P 500, 'URTH' for MSCI World)
 * @returns Portfolio metrics including daily returns, volatility, and beta
 */
export async function calculatePortfolioMetrics(
  days = 30,
  benchmarkSymbol: 'SPY' | 'URTH' = 'SPY'
): Promise<{
  success: boolean
  data?: {
    portfolioReturns: number[]
    benchmarkReturns: number[]
    volatility: number // Annualized volatility (%)
    beta: number // Portfolio beta vs S&P 500
    averageReturn: number // Average daily return (%)
    totalReturn: number // Total return over period (%)
    sharpeRatio: number // Sharpe ratio (assuming 4% risk-free rate)
    var95: number // 95% Value at Risk (daily %)
    var99: number // 99% Value at Risk (daily %)
    cvar95: number // 95% Conditional VaR / Expected Shortfall (daily %)
  }
  error?: string
}> {
  try {
    const supabase = createServiceClient()

    // Get portfolio (assuming single portfolio for single user)
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return {
        success: false,
        error: 'No portfolio found',
      }
    }

    // Fetch portfolio snapshots for the specified period
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: snapshots } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date, total_value')
      .eq('portfolio_id', portfolio.id)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .lte('snapshot_date', endDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true })

    if (!snapshots || snapshots.length < 2) {
      return {
        success: false,
        error: 'Insufficient portfolio data. Need at least 2 snapshots.',
      }
    }

    // Fetch benchmark data for the same period
    const { data: benchmarkData } = await supabase
      .from('benchmark_data')
      .select('date, adjusted_close, daily_return')
      .eq('symbol', benchmarkSymbol)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (!benchmarkData || benchmarkData.length < 2) {
      return {
        success: false,
        error: 'Insufficient benchmark data. Run syncBenchmarkData first.',
      }
    }

    // Calculate portfolio daily returns
    const portfolioReturns: number[] = []
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].total_value
      const currValue = snapshots[i].total_value
      const dailyReturn = ((currValue - prevValue) / prevValue) * 100
      portfolioReturns.push(dailyReturn)
    }

    // Extract benchmark returns (already calculated in syncBenchmarkData)
    const benchmarkReturns = benchmarkData
      .filter((d) => d.daily_return !== null)
      .map((d) => d.daily_return as number)

    // Align arrays (take minimum length)
    const minLength = Math.min(portfolioReturns.length, benchmarkReturns.length)
    const alignedPortfolioReturns = portfolioReturns.slice(-minLength)
    const alignedBenchmarkReturns = benchmarkReturns.slice(-minLength)

    // Calculate average returns
    const avgPortfolioReturn =
      alignedPortfolioReturns.reduce((sum, r) => sum + r, 0) / alignedPortfolioReturns.length

    const avgBenchmarkReturn =
      alignedBenchmarkReturns.reduce((sum, r) => sum + r, 0) / alignedBenchmarkReturns.length

    // Calculate volatility (standard deviation of returns, annualized)
    const portfolioVariance =
      alignedPortfolioReturns.reduce((sum, r) => sum + (r - avgPortfolioReturn) ** 2, 0) /
      (alignedPortfolioReturns.length - 1)
    const portfolioStdDev = Math.sqrt(portfolioVariance)
    const annualizedVolatility = portfolioStdDev * Math.sqrt(252) // 252 trading days

    // Calculate beta (covariance / variance of market)
    const covariance =
      alignedPortfolioReturns.reduce(
        (sum, r, i) =>
          sum + (r - avgPortfolioReturn) * (alignedBenchmarkReturns[i] - avgBenchmarkReturn),
        0
      ) /
      (alignedPortfolioReturns.length - 1)

    const benchmarkVariance =
      alignedBenchmarkReturns.reduce((sum, r) => sum + (r - avgBenchmarkReturn) ** 2, 0) /
      (alignedBenchmarkReturns.length - 1)

    const beta = covariance / benchmarkVariance

    // Calculate total return over period
    const initialValue = snapshots[0].total_value
    const finalValue = snapshots[snapshots.length - 1].total_value
    const totalReturn = ((finalValue - initialValue) / initialValue) * 100

    // Calculate Sharpe ratio (assuming 4% annual risk-free rate)
    const riskFreeRate = 4 / 252 // Daily risk-free rate
    const excessReturn = avgPortfolioReturn - riskFreeRate
    const sharpeRatio = (excessReturn / portfolioStdDev) * Math.sqrt(252) // Annualized

    // Calculate Value at Risk (VaR) metrics
    // Convert returns from % to decimal for VaR calculation
    const returnsDecimal = alignedPortfolioReturns.map((r) => r / 100)

    const var95 = (calculateHistoricalVaR(returnsDecimal, 0.95) || 0) * 100 // Convert back to %
    const var99 = (calculateHistoricalVaR(returnsDecimal, 0.99) || 0) * 100
    const cvar95 = (calculateCVaR(returnsDecimal, 0.95) || 0) * 100

    return {
      success: true,
      data: {
        portfolioReturns: alignedPortfolioReturns,
        benchmarkReturns: alignedBenchmarkReturns,
        volatility: annualizedVolatility,
        beta,
        averageReturn: avgPortfolioReturn,
        totalReturn,
        sharpeRatio,
        var95,
        var99,
        cvar95,
      },
    }
  } catch (error) {
    console.error('Error calculating portfolio metrics:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get benchmark comparison data for chart
 *
 * Fetches portfolio snapshots and benchmark data for the same period
 *
 * @param days Number of days to fetch (default: 30)
 * @param benchmarkSymbol Benchmark to compare against (default: 'SPY')
 * @returns Combined data for benchmark comparison chart
 */
export async function getBenchmarkComparisonData(
  days = 30,
  benchmarkSymbol: 'SPY' | 'URTH' = 'SPY'
): Promise<{
  success: boolean
  data?: Array<{
    date: string
    portfolioValue: number
    benchmarkValue: number
  }>
  error?: string
}> {
  try {
    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return {
        success: false,
        error: 'No portfolio found',
      }
    }

    // Fetch portfolio snapshots
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: snapshots } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date, total_value')
      .eq('portfolio_id', portfolio.id)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .lte('snapshot_date', endDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true })

    if (!snapshots || snapshots.length === 0) {
      return {
        success: false,
        error: 'No portfolio snapshots found',
      }
    }

    // Fetch benchmark data
    const { data: benchmarkData } = await supabase
      .from('benchmark_data')
      .select('date, adjusted_close')
      .eq('symbol', benchmarkSymbol)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (!benchmarkData || benchmarkData.length === 0) {
      return {
        success: false,
        error: 'No benchmark data found',
      }
    }

    // Create a map of benchmark data by date
    const benchmarkMap = new Map(benchmarkData.map((d) => [d.date, d.adjusted_close]))

    // Combine data (only include dates where we have both portfolio and benchmark data)
    const combinedData = snapshots
      .filter((s) => benchmarkMap.has(s.snapshot_date))
      .map((s) => ({
        date: s.snapshot_date,
        portfolioValue: s.total_value,
        benchmarkValue: benchmarkMap.get(s.snapshot_date) ?? 0,
      }))

    return {
      success: true,
      data: combinedData,
    }
  } catch (error) {
    console.error('Error fetching benchmark comparison data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sync transaction history from Trading212
 *
 * Fetches executed orders from Trading212 and stores them in the transactions table
 * Supports pagination to fetch all historical transactions
 *
 * @param maxTransactions Maximum number of transactions to fetch (default: 200)
 * @returns Success status and number of transactions synced
 */
export async function syncTransactionHistory(maxTransactions = 200): Promise<{
  success: boolean
  message: string
  data?: {
    transactionsSynced: number
    oldestTransaction: string | null
  }
  error?: string
}> {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'Unauthorized - please log in',
        error: 'Not authenticated',
      }
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return {
        success: false,
        message: 'No portfolio found',
        error: 'Portfolio not found',
      }
    }

    // Create Trading212 client
    const trading212 = createTrading212Client()

    // Fetch orders with pagination
    const allOrders = []
    let cursor: string | undefined
    let hasMore = true

    while (hasMore && allOrders.length < maxTransactions) {
      const remaining = maxTransactions - allOrders.length
      const limit = Math.min(remaining, 50) // Trading212 limit per page

      const response = await trading212.getOrders(limit, cursor)

      // Filter for executed orders only
      const executedOrders = response.items.filter((order) => order.status === 'EXECUTED')
      allOrders.push(...executedOrders)

      if (response.nextPagePath && allOrders.length < maxTransactions) {
        // Extract cursor from nextPagePath
        const url = new URL(response.nextPagePath, 'https://dummy.com')
        cursor = url.searchParams.get('cursor') || undefined
      } else {
        hasMore = false
      }
    }

    if (allOrders.length === 0) {
      return {
        success: true,
        message: 'No transactions found',
        data: {
          transactionsSynced: 0,
          oldestTransaction: null,
        },
      }
    }

    // Get instrument metadata to determine asset types
    // Fetch all instruments once for efficiency
    const instrumentMap = new Map<string, { name: string; type: 'stock' | 'etf' }>()

    try {
      const instruments = await trading212.getInstruments()
      for (const instrument of instruments) {
        instrumentMap.set(instrument.ticker, {
          name: instrument.name,
          type: instrument.type === 'ETF' ? 'etf' : 'stock',
        })
      }
    } catch (error) {
      console.error('Failed to fetch instruments metadata:', error)
      // Continue without instrument metadata - we'll use defaults
    }

    // Convert orders to transactions
    const transactions = allOrders.map((order) => {
      const instrument = instrumentMap.get(order.ticker) || {
        name: order.ticker,
        type: 'stock' as const,
      }
      const totalValue =
        order.quantity *
        (order.filledQuantity > 0 ? order.value / order.filledQuantity : order.value)

      return {
        portfolio_id: portfolio.id,
        external_id: order.id.toString(),
        ticker: order.ticker,
        asset_name: instrument.name,
        asset_type: instrument.type,
        transaction_type: order.type === 'MARKET' || order.type === 'LIMIT' ? 'buy' : 'sell',
        quantity: order.filledQuantity,
        price: order.filledQuantity > 0 ? order.value / order.filledQuantity : 0,
        total_value: totalValue,
        fee: 0, // Trading212 doesn't provide fee information in orders API
        currency: 'GBP', // Default to GBP, would need instrument metadata for accurate currency
        executed_at: order.dateExecuted || order.dateCreated,
        source: 'trading212' as const,
      }
    })

    // Insert transactions (upsert to avoid duplicates)
    const { error, count } = await supabase.from('transactions').upsert(transactions, {
      onConflict: 'source,external_id',
      count: 'exact',
    })

    if (error) {
      console.error('Failed to insert transactions:', error)
      return {
        success: false,
        message: 'Database error while storing transactions',
        error: error.message,
      }
    }

    const oldestTransaction =
      transactions.length > 0
        ? transactions.reduce((oldest, t) =>
            new Date(t.executed_at) < new Date(oldest.executed_at) ? t : oldest
          ).executed_at
        : null

    return {
      success: true,
      message: `Successfully synced ${count || 0} transactions`,
      data: {
        transactionsSynced: count || 0,
        oldestTransaction,
      },
    }
  } catch (error) {
    console.error('Error syncing transaction history:', error)

    if (error instanceof Trading212Error) {
      return {
        success: false,
        message: 'Trading212 API error',
        error: error.message,
      }
    }

    return {
      success: false,
      message: 'Failed to sync transaction history',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get transaction history
 *
 * Fetches all transactions sorted by execution date
 *
 * @param limit Number of transactions to fetch (default: 100)
 * @returns List of transactions
 */
export async function getTransactionHistory(limit = 100) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return null
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return null
    }

    // Fetch transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('executed_at', { ascending: false })
      .limit(limit)

    return transactions
  } catch (error) {
    console.error('Error fetching transaction history:', error)
    return null
  }
}

/**
 * Manually add a transaction
 */
export async function addManualTransaction(params: {
  ticker: string
  asset_name: string
  asset_type: 'stock' | 'etf' | 'crypto'
  transaction_type: 'buy' | 'sell'
  quantity: number
  price: number
  fee?: number
  currency: string
  executed_at: string
}) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return { success: false, error: 'No portfolio found' }
    }

    // Calculate total value
    const totalValue = params.quantity * params.price

    // Insert transaction
    const { error } = await supabase.from('transactions').insert({
      portfolio_id: portfolio.id,
      ticker: params.ticker.toUpperCase(),
      asset_name: params.asset_name,
      asset_type: params.asset_type,
      transaction_type: params.transaction_type,
      quantity: params.quantity,
      price: params.price,
      total_value: totalValue,
      fee: params.fee || 0,
      currency: params.currency,
      executed_at: params.executed_at,
      source: 'manual',
      external_id: null,
    })

    if (error) {
      console.error('Error adding manual transaction:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/portfolio')
    return { success: true, message: 'Transaction added successfully' }
  } catch (error) {
    console.error('Error in addManualTransaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add transaction',
    }
  }
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  id: string,
  updates: {
    quantity?: number
    price?: number
    fee?: number
    executed_at?: string
  }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = createServiceClient()

    // Calculate new total value if quantity or price changed
    const updateData: Record<string, unknown> = { ...updates }
    if (updates.quantity !== undefined || updates.price !== undefined) {
      // Get current transaction to calculate total
      const { data: transaction } = await supabase
        .from('transactions')
        .select('quantity, price')
        .eq('id', id)
        .single()

      if (transaction) {
        const newQuantity = updates.quantity ?? transaction.quantity
        const newPrice = updates.price ?? transaction.price
        updateData.total_value = newQuantity * newPrice
      }
    }

    const { error } = await supabase.from('transactions').update(updateData).eq('id', id)

    if (error) {
      console.error('Error updating transaction:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/portfolio')
    return { success: true, message: 'Transaction updated successfully' }
  } catch (error) {
    console.error('Error in updateTransaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update transaction',
    }
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id: string) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = createServiceClient()

    const { error } = await supabase.from('transactions').delete().eq('id', id)

    if (error) {
      console.error('Error deleting transaction:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/portfolio')
    return { success: true, message: 'Transaction deleted successfully' }
  } catch (error) {
    console.error('Error in deleteTransaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete transaction',
    }
  }
}

/**
 * Sync Kraken crypto transaction history
 *
 * Fetches trade history from Kraken and stores in transactions table
 *
 * @param maxTransactions Maximum number of transactions to fetch (default: 100)
 * @returns Success status and number of transactions synced
 */
export async function syncKrakenTransactionHistory(maxTransactions = 100): Promise<{
  success: boolean
  message: string
  data?: {
    transactionsSynced: number
    oldestTransaction: string | null
  }
  error?: string
}> {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'Unauthorized - please log in',
        error: 'Not authenticated',
      }
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return {
        success: false,
        message: 'No portfolio found',
        error: 'Portfolio not found',
      }
    }

    // Create Kraken client
    const kraken = createKrakenClient()

    // Fetch trades history
    const tradesHistory = await kraken.getTradesHistory()

    if (!tradesHistory.trades || Object.keys(tradesHistory.trades).length === 0) {
      return {
        success: true,
        message: 'No trades found in Kraken account',
        data: {
          transactionsSynced: 0,
          oldestTransaction: null,
        },
      }
    }

    // Convert Kraken trades to transaction format
    const transactions = []

    for (const [tradeId, trade] of Object.entries(tradesHistory.trades)) {
      // Parse the trading pair to get base and quote currencies
      // Format: XXBTZUSD -> BTC/USD
      let baseCurrency = trade.pair.substring(0, 4) // e.g., XXBT
      let quoteCurrency = trade.pair.substring(4) // e.g., ZUSD

      // Normalize Kraken asset codes
      baseCurrency = normalizeKrakenAsset(baseCurrency)
      quoteCurrency = normalizeKrakenAsset(quoteCurrency)

      const executedAt = new Date(trade.time * 1000).toISOString()
      const quantity = Number.parseFloat(trade.vol)
      const price = Number.parseFloat(trade.price)
      const totalValue = Number.parseFloat(trade.cost)
      const fee = Number.parseFloat(trade.fee)

      transactions.push({
        portfolio_id: portfolio.id,
        external_id: tradeId,
        ticker: baseCurrency,
        asset_name: `${baseCurrency}/${quoteCurrency}`,
        asset_type: 'crypto',
        transaction_type: trade.type,
        quantity,
        price,
        total_value: totalValue,
        fee,
        currency: quoteCurrency,
        executed_at: executedAt,
        source: 'kraken',
      })

      // Limit to maxTransactions
      if (transactions.length >= maxTransactions) {
        break
      }
    }

    // Insert transactions into database (upsert to avoid duplicates)
    const { count, error } = await supabase.from('transactions').upsert(transactions, {
      onConflict: 'source,external_id',
      count: 'exact',
    })

    if (error) {
      console.error('Failed to insert Kraken transactions:', error)
      return {
        success: false,
        message: 'Database error while storing transactions',
        error: error.message,
      }
    }

    const oldestTransaction =
      transactions.length > 0
        ? transactions.reduce((oldest, t) =>
            new Date(t.executed_at) < new Date(oldest.executed_at) ? t : oldest
          ).executed_at
        : null

    return {
      success: true,
      message: `Successfully synced ${count || 0} Kraken transactions`,
      data: {
        transactionsSynced: count || 0,
        oldestTransaction,
      },
    }
  } catch (error) {
    console.error('Error syncing Kraken transaction history:', error)
    return {
      success: false,
      message: 'Failed to sync Kraken transactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get position details by ticker
 *
 * Fetches stock/crypto position details including fundamentals from Alpha Vantage
 *
 * @param ticker Position ticker symbol
 * @returns Position details with fundamentals
 */
export async function getPositionDetails(ticker: string) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return null
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return null
    }

    // Try to find in stocks table first
    const { data: stock } = await supabase
      .from('stocks')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .eq('ticker', ticker)
      .single()

    if (stock) {
      // Fetch fundamentals from Alpha Vantage
      let fundamentals = null
      try {
        const alphaVantage = createAlphaVantageClient()
        const cleanTicker = parseTrading212Ticker(ticker).symbol
        fundamentals = await alphaVantage.getCompanyOverview(cleanTicker)
      } catch (error) {
        console.error(`Failed to fetch fundamentals for ${ticker}:`, error)
      }

      // Fetch position history
      const { data: history } = await supabase
        .from('stock_history')
        .select('*')
        .eq('stock_id', stock.id)
        .order('snapshot_date', { ascending: true })
        .limit(90) // Last 90 days

      // Fetch transactions for this position
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('portfolio_id', portfolio.id)
        .eq('ticker', ticker)
        .order('executed_at', { ascending: false })

      return {
        type: 'stock' as const,
        position: stock,
        fundamentals,
        history: history || [],
        transactions: transactions || [],
      }
    }

    // Try crypto table
    const { data: crypto } = await supabase
      .from('crypto')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .eq('symbol', ticker)
      .single()

    if (crypto) {
      // Fetch crypto history
      const { data: history } = await supabase
        .from('crypto_history')
        .select('*')
        .eq('crypto_id', crypto.id)
        .order('snapshot_date', { ascending: true })
        .limit(90)

      return {
        type: 'crypto' as const,
        position: crypto,
        fundamentals: null, // No fundamentals for crypto
        history: history || [],
        transactions: [], // Crypto transactions not implemented yet
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching position details:', error)
    return null
  }
}

/**
 * Get portfolio news from holdings
 *
 * Fetches news articles for top holdings using Alpha Vantage News Sentiment API
 *
 * @param limit Maximum number of articles to return (default 10)
 * @returns News articles with sentiment analysis
 */
export async function getPortfolioNews(limit = 10) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return null
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return null
    }

    // Get top holdings by market value
    const { data: positions } = await supabase
      .from('stocks')
      .select('ticker, market_value')
      .eq('portfolio_id', portfolio.id)
      .order('market_value', { ascending: false })
      .limit(5)

    if (!positions || positions.length === 0) {
      return []
    }

    // Extract ticker symbols and clean them
    const tickers = positions
      .map((p) => parseTrading212Ticker(p.ticker).symbol)
      .filter(Boolean)
      .join(',')

    // Fetch news from Alpha Vantage
    const alphaVantage = createAlphaVantageClient()
    const newsData = await alphaVantage.getNewsSentiment({
      tickers,
      limit,
      sort: 'LATEST',
    })

    return newsData.feed || []
  } catch (error) {
    console.error('Error fetching portfolio news:', error)
    return []
  }
}

/**
 * Calculate correlation matrix for portfolio holdings
 *
 * Analyzes price correlations between different holdings in the portfolio
 * Helps identify diversification and concentration risk
 *
 * @param days Number of days to analyze (default: 90)
 * @returns Correlation matrix with labels
 */
export async function getPortfolioCorrelationMatrix(days = 90): Promise<{
  success: boolean
  data?: {
    labels: string[]
    matrix: number[][]
  }
  error?: string
}> {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return {
        success: false,
        error: 'No portfolio found',
      }
    }

    // Get current positions (top holdings by value)
    const { data: positions } = await supabase
      .from('stocks')
      .select('ticker, market_value, current_price')
      .eq('portfolio_id', portfolio.id)
      .order('market_value', { ascending: false })
      .limit(10) // Top 10 holdings

    if (!positions || positions.length < 2) {
      return {
        success: false,
        error: 'Need at least 2 holdings to calculate correlations',
      }
    }

    // Fetch historical prices for each ticker
    const alphaVantage = createAlphaVantageClient()
    const tickerReturns: Record<string, number[]> = {}

    for (const position of positions) {
      try {
        // Fetch time series data
        const timeSeriesData = await alphaVantage.getTimeSeriesDaily(position.ticker, 'compact')

        if (!timeSeriesData['Time Series (Daily)']) {
          continue
        }

        const timeSeries = timeSeriesData['Time Series (Daily)']
        const dates = Object.keys(timeSeries).slice(0, days).sort()

        // Calculate daily returns
        const returns: number[] = []
        for (let i = 1; i < dates.length; i++) {
          const prevClose = Number.parseFloat(timeSeries[dates[i - 1]]['4. close'])
          const currClose = Number.parseFloat(timeSeries[dates[i]]['4. close'])
          const dailyReturn = ((currClose - prevClose) / prevClose) * 100
          returns.push(dailyReturn)
        }

        if (returns.length > 0) {
          tickerReturns[position.ticker] = returns
        }

        // Rate limiting - small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error fetching data for ${position.ticker}:`, error)
        // Continue with other tickers
      }
    }

    // Need at least 2 tickers with valid data
    if (Object.keys(tickerReturns).length < 2) {
      return {
        success: false,
        error: 'Insufficient data to calculate correlations',
      }
    }

    // Calculate correlation matrix
    const result = calculateCorrelationMatrix(tickerReturns)

    if (!result) {
      return {
        success: false,
        error: 'Failed to calculate correlation matrix',
      }
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error calculating correlation matrix:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get industry-level portfolio breakdown and attribution
 *
 * Groups holdings by industry and calculates contribution to portfolio performance
 *
 * @returns Industry breakdown with allocation and attribution
 */
export async function getPortfolioIndustryBreakdown(): Promise<{
  success: boolean
  data?: Array<{
    industry: string
    sector: string
    allocation: number // Percentage of portfolio
    value: number // Total value in this industry
    holdings: number // Number of holdings
    tickers: string[] // List of tickers in this industry
  }>
  error?: string
}> {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const supabase = createServiceClient()

    // Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .order('created_at')
      .limit(1)
      .single()

    if (!portfolio) {
      return {
        success: false,
        error: 'No portfolio found',
      }
    }

    // Get all stock positions with sector/industry data
    const { data: positions } = await supabase
      .from('stocks')
      .select('ticker, market_value, sector, industry')
      .eq('portfolio_id', portfolio.id)

    if (!positions || positions.length === 0) {
      return {
        success: false,
        error: 'No positions found',
      }
    }

    // Calculate total portfolio value
    const totalValue = positions.reduce((sum, p) => sum + (p.market_value || 0), 0)

    // Group by industry
    const industryMap = new Map<
      string,
      {
        industry: string
        sector: string
        value: number
        tickers: string[]
      }
    >()

    for (const position of positions) {
      const industry = position.industry || 'Unknown'
      const sector = position.sector || 'Unknown'

      if (!industryMap.has(industry)) {
        industryMap.set(industry, {
          industry,
          sector,
          value: 0,
          tickers: [],
        })
      }

      const entry = industryMap.get(industry)
      if (entry) {
        entry.value += position.market_value || 0
        entry.tickers.push(position.ticker)
      }
    }

    // Convert to array and calculate allocations
    const industryBreakdown = Array.from(industryMap.values()).map((entry) => ({
      industry: entry.industry,
      sector: entry.sector,
      allocation: (entry.value / totalValue) * 100,
      value: entry.value,
      holdings: entry.tickers.length,
      tickers: entry.tickers,
    }))

    // Sort by allocation (descending)
    industryBreakdown.sort((a, b) => b.allocation - a.allocation)

    return {
      success: true,
      data: industryBreakdown,
    }
  } catch (error) {
    console.error('Error getting industry breakdown:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
