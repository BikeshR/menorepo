'use server'

import { isAuthenticated } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { getETFMetadata, refreshETFData } from '@/modules/portfolio/service/etf-data.service'

/**
 * Get comprehensive portfolio analytics data
 */
export async function getPortfolioAnalytics() {
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

    // Get all positions with full data
    const { data: positions } = await supabase
      .from('stocks')
      .select('*')
      .eq('portfolio_id', portfolio.id)

    if (!positions || positions.length === 0) {
      return {
        success: false,
        error: 'No positions found',
      }
    }

    // Calculate total portfolio value
    const totalValue = positions.reduce((sum, p) => sum + (p.market_value || 0), 0)

    // 1. Sector Breakdown
    const sectorMap = new Map<string, { value: number; count: number }>()
    for (const position of positions) {
      const sector = position.sector || 'Unknown'
      const existing = sectorMap.get(sector) || { value: 0, count: 0 }
      sectorMap.set(sector, {
        value: existing.value + (position.market_value || 0),
        count: existing.count + 1,
      })
    }

    const sectorBreakdown = Array.from(sectorMap.entries())
      .map(([sector, data]) => ({
        name: sector,
        value: data.value,
        percentage: (data.value / totalValue) * 100,
        holdings: data.count,
      }))
      .sort((a, b) => b.value - a.value)

    // 2. Industry Breakdown
    const industryMap = new Map<
      string,
      { value: number; count: number; sector: string; tickers: string[] }
    >()
    for (const position of positions) {
      const industry = position.industry || 'Unknown'
      const existing = industryMap.get(industry) || {
        value: 0,
        count: 0,
        sector: position.sector || 'Unknown',
        tickers: [],
      }
      industryMap.set(industry, {
        value: existing.value + (position.market_value || 0),
        count: existing.count + 1,
        sector: position.sector || 'Unknown',
        tickers: [...existing.tickers, position.ticker],
      })
    }

    const industryBreakdown = Array.from(industryMap.entries())
      .map(([industry, data]) => ({
        industry,
        sector: data.sector,
        value: data.value,
        allocation: (data.value / totalValue) * 100,
        holdings: data.count,
        tickers: data.tickers,
      }))
      .sort((a, b) => b.allocation - a.allocation)

    // 3. Geographic Breakdown
    const regionMap = new Map<string, { value: number; count: number; countries: Set<string> }>()
    for (const position of positions) {
      const region = position.region || 'Unknown'
      const country = position.country || 'Unknown'
      const existing = regionMap.get(region) || { value: 0, count: 0, countries: new Set() }
      existing.countries.add(country)
      regionMap.set(region, {
        value: existing.value + (position.market_value || 0),
        count: existing.count + 1,
        countries: existing.countries,
      })
    }

    const geographicBreakdown = Array.from(regionMap.entries())
      .map(([region, data]) => ({
        region,
        value: data.value,
        percentage: (data.value / totalValue) * 100,
        holdings: data.count,
        countries: Array.from(data.countries),
      }))
      .sort((a, b) => b.value - a.value)

    // 4. Asset Type Breakdown
    const assetTypeMap = new Map<string, { value: number; count: number }>()
    for (const position of positions) {
      const assetType = position.asset_type || 'stock'
      const existing = assetTypeMap.get(assetType) || { value: 0, count: 0 }
      assetTypeMap.set(assetType, {
        value: existing.value + (position.market_value || 0),
        count: existing.count + 1,
      })
    }

    const assetAllocation = Array.from(assetTypeMap.entries())
      .map(([assetType, data]) => ({
        name: assetType.toUpperCase(),
        value: data.value,
        percentage: (data.value / totalValue) * 100,
        holdings: data.count,
      }))
      .sort((a, b) => b.value - a.value)

    // 5. Top Holdings
    const topHoldings = positions
      .map((p) => ({
        ticker: p.ticker,
        name: p.name,
        value: p.market_value || 0,
        percentage: ((p.market_value || 0) / totalValue) * 100,
        sector: p.sector,
        gainLoss: p.gain_loss || 0,
        gainLossPct: p.gain_loss_pct || 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    // 6. Performance Summary
    const totalCostBasis = positions.reduce((sum, p) => sum + p.quantity * (p.average_cost || 0), 0)
    const totalGainLoss = totalValue - totalCostBasis
    const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0

    const winners = positions.filter((p) => (p.gain_loss || 0) > 0).length
    const losers = positions.filter((p) => (p.gain_loss || 0) < 0).length

    return {
      success: true,
      data: {
        totalValue,
        totalCostBasis,
        totalGainLoss,
        totalGainLossPct,
        positionsCount: positions.length,
        winnersCount: winners,
        losersCount: losers,
        sectorBreakdown,
        industryBreakdown,
        geographicBreakdown,
        assetAllocation,
        topHoldings,
      },
    }
  } catch (error) {
    console.error('Error fetching portfolio analytics:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analytics',
    }
  }
}

/**
 * Get tax tracking data (short-term vs long-term gains)
 */
export async function getTaxTrackingData() {
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

    // Get all positions with fill dates
    const { data: positions } = await supabase
      .from('stocks')
      .select('ticker, name, quantity, average_cost, market_value, gain_loss, initial_fill_date')
      .eq('portfolio_id', portfolio.id)

    if (!positions || positions.length === 0) {
      return {
        success: false,
        error: 'No positions found',
      }
    }

    const currentDate = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(currentDate.getFullYear() - 1)

    const taxData = positions.map((position) => {
      const fillDate = position.initial_fill_date ? new Date(position.initial_fill_date) : null
      const holdingPeriod = fillDate
        ? Math.floor((currentDate.getTime() - fillDate.getTime()) / (1000 * 60 * 60 * 24))
        : null
      const isLongTerm = holdingPeriod !== null && holdingPeriod >= 365

      return {
        ticker: position.ticker,
        name: position.name,
        gainLoss: position.gain_loss || 0,
        holdingPeriod,
        holdingCategory: isLongTerm ? 'Long-term' : 'Short-term',
        acquisitionDate: position.initial_fill_date,
        marketValue: position.market_value || 0,
      }
    })

    // Calculate summary
    const shortTermGains = taxData
      .filter((p) => p.holdingCategory === 'Short-term' && p.gainLoss > 0)
      .reduce((sum, p) => sum + p.gainLoss, 0)

    const shortTermLosses = Math.abs(
      taxData
        .filter((p) => p.holdingCategory === 'Short-term' && p.gainLoss < 0)
        .reduce((sum, p) => sum + p.gainLoss, 0)
    )

    const longTermGains = taxData
      .filter((p) => p.holdingCategory === 'Long-term' && p.gainLoss > 0)
      .reduce((sum, p) => sum + p.gainLoss, 0)

    const longTermLosses = Math.abs(
      taxData
        .filter((p) => p.holdingCategory === 'Long-term' && p.gainLoss < 0)
        .reduce((sum, p) => sum + p.gainLoss, 0)
    )

    // Tax loss harvesting opportunities (short-term losses can offset gains)
    const harvestingOpportunities = taxData
      .filter((p) => p.gainLoss < 0)
      .sort((a, b) => a.gainLoss - b.gainLoss)
      .slice(0, 5)

    return {
      success: true,
      data: {
        summary: {
          shortTermGains,
          shortTermLosses,
          longTermGains,
          longTermLosses,
          netShortTerm: shortTermGains - shortTermLosses,
          netLongTerm: longTermGains - longTermLosses,
        },
        positions: taxData.sort((a, b) => b.marketValue - a.marketValue),
        harvestingOpportunities,
      },
    }
  } catch (error) {
    console.error('Error fetching tax tracking data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tax data',
    }
  }
}

/**
 * Refresh a single ETF's breakdown data
 */
export async function refreshSingleETF(ticker: string, isin: string) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const result = await refreshETFData(ticker, isin)
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Refresh all ETFs in portfolio
 */
export async function refreshPortfolioETFs(portfolioId: string) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const supabase = createServiceClient()

    // Get all ETFs in portfolio
    const { data: stocks, error } = await supabase
      .from('stocks')
      .select('ticker, isin')
      .eq('portfolio_id', portfolioId)
      .eq('asset_type', 'etf')

    if (error) throw error

    if (!stocks || stocks.length === 0) {
      return { success: true, refreshed: 0, failed: 0, message: 'No ETFs in portfolio' }
    }

    let refreshed = 0
    let failed = 0

    for (const stock of stocks) {
      if (!stock.isin) {
        console.warn(`[Analytics Actions] ETF ${stock.ticker} has no ISIN, skipping`)
        failed++
        continue
      }

      const result = await refreshETFData(stock.ticker, stock.isin)
      if (result.success) {
        refreshed++
      } else {
        failed++
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return {
      success: true,
      refreshed,
      failed,
      message: `Refreshed ${refreshed} ETFs, ${failed} failed`,
    }
  } catch (error) {
    return {
      success: false,
      refreshed: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get list of ETFs in portfolio with their refresh status
 */
export async function getPortfolioETFStatus(portfolioId: string) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        error: 'Not authenticated',
        data: [],
      }
    }

    const supabase = createServiceClient()

    // Get all ETFs
    const { data: stocks, error } = await supabase
      .from('stocks')
      .select('ticker, name, isin, quantity, current_price, market_value')
      .eq('portfolio_id', portfolioId)
      .eq('asset_type', 'etf')

    if (error) throw error

    if (!stocks || stocks.length === 0) {
      return { success: true, data: [] }
    }

    // Get metadata for each ETF
    const etfStatuses = await Promise.all(
      stocks.map(async (stock) => {
        if (!stock.isin) {
          return {
            ticker: stock.ticker,
            name: stock.name,
            isin: null,
            marketValue: stock.market_value || stock.quantity * (stock.current_price ?? 0),
            lastScraped: null,
            status: 'missing_isin' as const,
            daysOld: null,
          }
        }

        const metadata = await getETFMetadata(stock.ticker)

        const daysOld = metadata?.last_scraped_at
          ? Math.floor(
              (Date.now() - new Date(metadata.last_scraped_at).getTime()) / (1000 * 60 * 60 * 24)
            )
          : null

        // Validate and normalize status
        const status = metadata?.scrape_status
        const validStatus: 'pending' | 'success' | 'failed' | 'stale' =
          status === 'success' || status === 'failed' || status === 'stale' ? status : 'pending'

        return {
          ticker: stock.ticker,
          name: stock.name,
          isin: stock.isin,
          marketValue: stock.market_value || stock.quantity * (stock.current_price ?? 0),
          lastScraped: metadata?.last_scraped_at || null,
          status: validStatus,
          daysOld,
        }
      })
    )

    return { success: true, data: etfStatuses }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    }
  }
}
