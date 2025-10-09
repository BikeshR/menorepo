/**
 * ETF Data Service
 *
 * Manages ETF breakdown data in the database.
 * Handles caching, refreshing, and retrieving ETF data.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  ETFAssetAllocation,
  ETFBreakdownData,
  ETFCountryBreakdown,
  ETFHolding,
  ETFMetadata,
  ETFSectorBreakdown,
} from '../types'
import { isDataStale } from './etf-scraper.service'
import { scrapeETF } from './etf-scrapers'

/**
 * Get ETF metadata from database
 */
export async function getETFMetadata(ticker: string): Promise<ETFMetadata | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('etf_metadata')
    .select('*')
    .eq('ticker', ticker)
    .single()

  if (error) {
    console.error(`[ETF Data] Error fetching metadata for ${ticker}:`, error)
    return null
  }

  return data
}

/**
 * Get full ETF breakdown data from database
 */
export async function getETFBreakdown(ticker: string): Promise<ETFBreakdownData | null> {
  const supabase = await createClient()

  // Get metadata
  const metadata = await getETFMetadata(ticker)
  if (!metadata) return null

  // Get holdings
  const { data: holdings } = await supabase
    .from('etf_holdings')
    .select('*')
    .eq('etf_ticker', ticker)
    .order('weight_pct', { ascending: false })

  // Get country breakdown
  const { data: countryBreakdown } = await supabase
    .from('etf_country_breakdown')
    .select('*')
    .eq('etf_ticker', ticker)
    .order('weight_pct', { ascending: false })

  // Get sector breakdown
  const { data: sectorBreakdown } = await supabase
    .from('etf_sector_breakdown')
    .select('*')
    .eq('etf_ticker', ticker)
    .order('weight_pct', { ascending: false })

  // Get asset allocation
  const { data: assetAllocation } = await supabase
    .from('etf_asset_allocation')
    .select('*')
    .eq('etf_ticker', ticker)
    .order('weight_pct', { ascending: false })

  return {
    metadata,
    holdings: (holdings || []) as ETFHolding[],
    countryBreakdown: (countryBreakdown || []) as ETFCountryBreakdown[],
    sectorBreakdown: (sectorBreakdown || []) as ETFSectorBreakdown[],
    assetAllocation: (assetAllocation || []) as ETFAssetAllocation[],
  }
}

/**
 * Store ETF breakdown data in database
 */
async function storeETFBreakdown(data: ETFBreakdownData): Promise<void> {
  const supabase = await createClient()
  const { ticker } = data.metadata

  // Upsert metadata
  const { error: metadataError } = await supabase.from('etf_metadata').upsert(
    {
      ticker: data.metadata.ticker,
      isin: data.metadata.isin,
      name: data.metadata.name,
      provider: data.metadata.provider,
      total_assets_usd: data.metadata.total_assets_usd,
      ter_pct: data.metadata.ter_pct,
      data_source: data.metadata.data_source,
      last_scraped_at: data.metadata.last_scraped_at,
      scrape_status: data.metadata.scrape_status,
      scrape_error: data.metadata.scrape_error,
    },
    { onConflict: 'ticker' }
  )

  if (metadataError) {
    throw new Error(`Failed to store metadata: ${metadataError.message}`)
  }

  // Delete old breakdown data (we'll replace it)
  await supabase.from('etf_holdings').delete().eq('etf_ticker', ticker)
  await supabase.from('etf_country_breakdown').delete().eq('etf_ticker', ticker)
  await supabase.from('etf_sector_breakdown').delete().eq('etf_ticker', ticker)
  await supabase.from('etf_asset_allocation').delete().eq('etf_ticker', ticker)

  // Insert new holdings
  if (data.holdings.length > 0) {
    const { error: holdingsError } = await supabase.from('etf_holdings').insert(
      data.holdings.map((h) => ({
        etf_ticker: h.etf_ticker,
        holding_ticker: h.holding_ticker,
        holding_name: h.holding_name,
        holding_isin: h.holding_isin,
        weight_pct: h.weight_pct,
        shares: h.shares,
        market_value_usd: h.market_value_usd,
        asset_type: h.asset_type,
        country: h.country,
        sector: h.sector,
        industry: h.industry,
        last_updated_at: h.last_updated_at,
      }))
    )

    if (holdingsError) {
      console.error('[ETF Data] Error storing holdings:', holdingsError)
    }
  }

  // Insert country breakdown
  if (data.countryBreakdown.length > 0) {
    const { error: countryError } = await supabase.from('etf_country_breakdown').insert(
      data.countryBreakdown.map((c) => ({
        etf_ticker: c.etf_ticker,
        country: c.country,
        weight_pct: c.weight_pct,
        last_updated_at: c.last_updated_at,
      }))
    )

    if (countryError) {
      console.error('[ETF Data] Error storing country breakdown:', countryError)
    }
  }

  // Insert sector breakdown
  if (data.sectorBreakdown.length > 0) {
    const { error: sectorError } = await supabase.from('etf_sector_breakdown').insert(
      data.sectorBreakdown.map((s) => ({
        etf_ticker: s.etf_ticker,
        sector: s.sector,
        industry_group: s.industry_group,
        weight_pct: s.weight_pct,
        last_updated_at: s.last_updated_at,
      }))
    )

    if (sectorError) {
      console.error('[ETF Data] Error storing sector breakdown:', sectorError)
    }
  }

  // Insert asset allocation
  if (data.assetAllocation.length > 0) {
    const { error: assetError } = await supabase.from('etf_asset_allocation').insert(
      data.assetAllocation.map((a) => ({
        etf_ticker: a.etf_ticker,
        asset_class: a.asset_class,
        weight_pct: a.weight_pct,
        last_updated_at: a.last_updated_at,
      }))
    )

    if (assetError) {
      console.error('[ETF Data] Error storing asset allocation:', assetError)
    }
  }

  console.log(`[ETF Data] Successfully stored data for ${ticker}`)
}

/**
 * Refresh ETF data from provider scrapers (scrape and store)
 */
export async function refreshETFData(
  ticker: string,
  isin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[ETF Data] Refreshing data for ${ticker}...`)

    // Scrape data using provider-specific scrapers
    const data = await scrapeETF(ticker, isin)

    // Store in database
    await storeETFBreakdown(data)

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[ETF Data] Failed to refresh ${ticker}:`, errorMessage)

    // Update metadata with error status
    const supabase = await createClient()
    await supabase.from('etf_metadata').upsert(
      {
        ticker,
        isin,
        name: ticker,
        scrape_status: 'failed',
        scrape_error: errorMessage,
        last_scraped_at: new Date().toISOString(),
      },
      { onConflict: 'ticker' }
    )

    return { success: false, error: errorMessage }
  }
}

/**
 * Get ETF data with automatic refresh if stale
 */
export async function getETFDataWithRefresh(
  ticker: string,
  isin: string,
  forceRefresh = false
): Promise<ETFBreakdownData | null> {
  // Check if we have data
  const existingData = await getETFBreakdown(ticker)

  // If force refresh or data is stale, refresh it
  if (forceRefresh || !existingData || isDataStale(existingData.metadata.last_scraped_at)) {
    console.log(
      `[ETF Data] Data for ${ticker} is ${!existingData ? 'missing' : 'stale'}, refreshing...`
    )
    const result = await refreshETFData(ticker, isin)

    if (!result.success) {
      console.error(`[ETF Data] Refresh failed, returning existing data if available`)
      return existingData
    }

    // Fetch fresh data
    return await getETFBreakdown(ticker)
  }

  return existingData
}

/**
 * Get list of all ETFs that need refreshing
 */
export async function getStaleETFs(): Promise<
  Pick<ETFMetadata, 'ticker' | 'name' | 'isin' | 'last_scraped_at' | 'scrape_status'>[]
> {
  const supabase = await createClient()

  // Get ETFs where data is older than 30 days or has never been scraped
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('etf_metadata')
    .select('ticker, name, isin, last_scraped_at, scrape_status')
    .or(`last_scraped_at.is.null,last_scraped_at.lt.${thirtyDaysAgo.toISOString()}`)

  if (error) {
    console.error('[ETF Data] Error fetching stale ETFs:', error)
    return []
  }

  return data || []
}

/**
 * Refresh all stale ETFs
 */
export async function refreshAllStaleETFs(): Promise<{ refreshed: number; failed: number }> {
  const staleETFs = await getStaleETFs()

  let refreshed = 0
  let failed = 0

  for (const etf of staleETFs) {
    if (!etf.isin) {
      console.warn(`[ETF Data] Skipping ${etf.ticker} - no ISIN`)
      failed++
      continue
    }

    const result = await refreshETFData(etf.ticker, etf.isin)
    if (result.success) {
      refreshed++
    } else {
      failed++
    }

    // Respectful delay between ETFs
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  console.log(`[ETF Data] Batch refresh complete: ${refreshed} refreshed, ${failed} failed`)

  return { refreshed, failed }
}
