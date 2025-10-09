/**
 * Portfolio Breakdown Service
 *
 * Aggregates stock and ETF positions to provide comprehensive portfolio breakdowns
 * by country, region, sector, and asset type with ~100% coverage.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import type { Stock } from '../types'
import { getETFDataWithRefresh } from './etf-data.service'

// ============================================================================
// Types
// ============================================================================

export type PortfolioCountryBreakdown = {
  country: string
  value: number
  percentage: number
  holdings: number
  sources: Array<{
    ticker: string
    value: number
    type: 'stock' | 'etf'
  }>
}

export type PortfolioSectorBreakdown = {
  sector: string
  value: number
  percentage: number
  holdings: number
  sources: Array<{
    ticker: string
    value: number
    type: 'stock' | 'etf'
  }>
}

export type PortfolioRegionBreakdown = {
  region: string
  value: number
  percentage: number
  holdings: number
  countries: string[]
}

export type PortfolioAssetTypeBreakdown = {
  assetType: 'stocks' | 'bonds' | 'cash' | 'commodities' | 'real_estate' | 'other'
  value: number
  percentage: number
  holdings: number
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all stocks from portfolio
 */
async function getAllStocks(portfolioId: string): Promise<Stock[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('stocks')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('current_price', { ascending: false })

  if (error) {
    console.error('[Portfolio Breakdown] Error fetching stocks:', error)
    return []
  }

  return data || []
}

/**
 * Calculate market value for a position
 */
function calculateMarketValue(stock: Stock): number {
  return stock.quantity * (stock.current_price ?? 0)
}

/**
 * Get total portfolio value
 */
function getTotalValue(stocks: Stock[]): number {
  return stocks.reduce((sum, stock) => sum + calculateMarketValue(stock), 0)
}

// ============================================================================
// Country Breakdown
// ============================================================================

export async function getPortfolioCountryBreakdown(
  portfolioId: string
): Promise<PortfolioCountryBreakdown[]> {
  const stocks = await getAllStocks(portfolioId)
  const totalValue = getTotalValue(stocks)

  // Map to accumulate country allocations
  const countryMap = new Map<
    string,
    {
      value: number
      holdings: Set<string>
      sources: Array<{ ticker: string; value: number; type: 'stock' | 'etf' }>
    }
  >()

  // Process each stock position
  for (const stock of stocks) {
    const positionValue = calculateMarketValue(stock)

    if (stock.asset_type === 'stock') {
      // Direct stock allocation
      const country = stock.country || 'Unknown'

      const existing = countryMap.get(country) || { value: 0, holdings: new Set(), sources: [] }
      existing.value += positionValue
      existing.holdings.add(stock.ticker)
      existing.sources.push({ ticker: stock.ticker, value: positionValue, type: 'stock' })
      countryMap.set(country, existing)
    } else if (stock.asset_type === 'etf') {
      // ETF look-through
      if (!stock.isin) {
        console.warn(`[Portfolio Breakdown] ETF ${stock.ticker} missing ISIN, skipping breakdown`)
        continue
      }

      const etfData = await getETFDataWithRefresh(stock.ticker, stock.isin)

      if (etfData && etfData.countryBreakdown.length > 0) {
        // Distribute ETF value across countries based on weights
        for (const countryAlloc of etfData.countryBreakdown) {
          const allocatedValue = (positionValue * countryAlloc.weight_pct) / 100

          const existing = countryMap.get(countryAlloc.country) || {
            value: 0,
            holdings: new Set(),
            sources: [],
          }
          existing.value += allocatedValue
          existing.holdings.add(stock.ticker)
          existing.sources.push({
            ticker: `${stock.ticker} (${countryAlloc.weight_pct.toFixed(1)}%)`,
            value: allocatedValue,
            type: 'etf',
          })
          countryMap.set(countryAlloc.country, existing)
        }
      } else {
        // Fallback: Use ETF's domicile country
        const country = stock.country || 'Unknown'
        const existing = countryMap.get(country) || { value: 0, holdings: new Set(), sources: [] }
        existing.value += positionValue
        existing.holdings.add(stock.ticker)
        existing.sources.push({
          ticker: `${stock.ticker} (ETF - no breakdown)`,
          value: positionValue,
          type: 'etf',
        })
        countryMap.set(country, existing)
      }
    }
  }

  // Convert map to array and calculate percentages
  const breakdown: PortfolioCountryBreakdown[] = Array.from(countryMap.entries())
    .map(([country, data]) => ({
      country,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      holdings: data.holdings.size,
      sources: data.sources,
    }))
    .sort((a, b) => b.value - a.value)

  return breakdown
}

// ============================================================================
// Sector Breakdown
// ============================================================================

export async function getPortfolioSectorBreakdown(
  portfolioId: string
): Promise<PortfolioSectorBreakdown[]> {
  const stocks = await getAllStocks(portfolioId)
  const totalValue = getTotalValue(stocks)

  const sectorMap = new Map<
    string,
    {
      value: number
      holdings: Set<string>
      sources: Array<{ ticker: string; value: number; type: 'stock' | 'etf' }>
    }
  >()

  for (const stock of stocks) {
    const positionValue = calculateMarketValue(stock)

    if (stock.asset_type === 'stock') {
      // Direct stock allocation
      const sector = stock.sector || 'Unknown'

      const existing = sectorMap.get(sector) || { value: 0, holdings: new Set(), sources: [] }
      existing.value += positionValue
      existing.holdings.add(stock.ticker)
      existing.sources.push({ ticker: stock.ticker, value: positionValue, type: 'stock' })
      sectorMap.set(sector, existing)
    } else if (stock.asset_type === 'etf') {
      // ETF look-through
      if (!stock.isin) continue

      const etfData = await getETFDataWithRefresh(stock.ticker, stock.isin)

      if (etfData && etfData.sectorBreakdown.length > 0) {
        for (const sectorAlloc of etfData.sectorBreakdown) {
          const allocatedValue = (positionValue * sectorAlloc.weight_pct) / 100

          const existing = sectorMap.get(sectorAlloc.sector) || {
            value: 0,
            holdings: new Set(),
            sources: [],
          }
          existing.value += allocatedValue
          existing.holdings.add(stock.ticker)
          existing.sources.push({
            ticker: `${stock.ticker} (${sectorAlloc.weight_pct.toFixed(1)}%)`,
            value: allocatedValue,
            type: 'etf',
          })
          sectorMap.set(sectorAlloc.sector, existing)
        }
      } else {
        // Fallback to "ETF - Mixed"
        const sector = 'ETF - Mixed'
        const existing = sectorMap.get(sector) || { value: 0, holdings: new Set(), sources: [] }
        existing.value += positionValue
        existing.holdings.add(stock.ticker)
        existing.sources.push({
          ticker: `${stock.ticker} (no breakdown)`,
          value: positionValue,
          type: 'etf',
        })
        sectorMap.set(sector, existing)
      }
    }
  }

  const breakdown: PortfolioSectorBreakdown[] = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      holdings: data.holdings.size,
      sources: data.sources,
    }))
    .sort((a, b) => b.value - a.value)

  return breakdown
}

// ============================================================================
// Region Breakdown (Custom Regions)
// ============================================================================

export async function getPortfolioRegionBreakdown(
  portfolioId: string
): Promise<PortfolioRegionBreakdown[]> {
  const supabase = await createClient()

  // Get custom regions
  const { data: customRegions } = await supabase.from('custom_regions').select('*')

  // Get country breakdown
  const countryBreakdown = await getPortfolioCountryBreakdown(portfolioId)

  const regionMap = new Map<
    string,
    { value: number; holdings: Set<string>; countries: Set<string> }
  >()

  // If no custom regions, create default continental groupings
  const regions = customRegions || [
    { name: 'North America', countries: ['United States', 'Canada', 'Mexico'] },
    {
      name: 'Europe',
      countries: ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands'],
    },
    {
      name: 'Asia Pacific',
      countries: ['Japan', 'China', 'South Korea', 'Australia', 'Singapore', 'Hong Kong'],
    },
    {
      name: 'Emerging Markets',
      countries: ['Brazil', 'India', 'Russia', 'South Africa', 'Turkey'],
    },
  ]

  for (const countryData of countryBreakdown) {
    // Find which region this country belongs to
    let assigned = false

    for (const region of regions) {
      if (region.countries.includes(countryData.country)) {
        const existing = regionMap.get(region.name) || {
          value: 0,
          holdings: new Set(),
          countries: new Set(),
        }
        existing.value += countryData.value
        existing.countries.add(countryData.country)
        for (const source of countryData.sources) {
          existing.holdings.add(source.ticker)
        }
        regionMap.set(region.name, existing)
        assigned = true
        break
      }
    }

    // If not assigned to any region, put in "Other"
    if (!assigned) {
      const existing = regionMap.get('Other') || {
        value: 0,
        holdings: new Set(),
        countries: new Set(),
      }
      existing.value += countryData.value
      existing.countries.add(countryData.country)
      for (const source of countryData.sources) {
        existing.holdings.add(source.ticker)
      }
      regionMap.set('Other', existing)
    }
  }

  const totalValue = countryBreakdown.reduce((sum, c) => sum + c.value, 0)

  const breakdown: PortfolioRegionBreakdown[] = Array.from(regionMap.entries())
    .map(([region, data]) => ({
      region,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      holdings: data.holdings.size,
      countries: Array.from(data.countries),
    }))
    .sort((a, b) => b.value - a.value)

  return breakdown
}

// ============================================================================
// Asset Type Breakdown
// ============================================================================

export async function getPortfolioAssetTypeBreakdown(
  portfolioId: string
): Promise<PortfolioAssetTypeBreakdown[]> {
  const stocks = await getAllStocks(portfolioId)
  const totalValue = getTotalValue(stocks)

  const assetTypeMap = new Map<string, { value: number; holdings: Set<string> }>()

  for (const stock of stocks) {
    const positionValue = calculateMarketValue(stock)

    if (stock.asset_type === 'stock') {
      // Direct stock
      const existing = assetTypeMap.get('stocks') || { value: 0, holdings: new Set() }
      existing.value += positionValue
      existing.holdings.add(stock.ticker)
      assetTypeMap.set('stocks', existing)
    } else if (stock.asset_type === 'crypto') {
      const existing = assetTypeMap.get('other') || { value: 0, holdings: new Set() }
      existing.value += positionValue
      existing.holdings.add(stock.ticker)
      assetTypeMap.set('other', existing)
    } else if (stock.asset_type === 'etf') {
      // ETF look-through to asset allocation
      if (!stock.isin) {
        const existing = assetTypeMap.get('stocks') || { value: 0, holdings: new Set() }
        existing.value += positionValue
        existing.holdings.add(stock.ticker)
        assetTypeMap.set('stocks', existing)
        continue
      }

      const etfData = await getETFDataWithRefresh(stock.ticker, stock.isin)

      if (etfData && etfData.assetAllocation.length > 0) {
        for (const assetAlloc of etfData.assetAllocation) {
          const allocatedValue = (positionValue * assetAlloc.weight_pct) / 100

          const existing = assetTypeMap.get(assetAlloc.asset_class) || {
            value: 0,
            holdings: new Set(),
          }
          existing.value += allocatedValue
          existing.holdings.add(stock.ticker)
          assetTypeMap.set(assetAlloc.asset_class, existing)
        }
      } else {
        // Assume ETF is 100% stocks if no breakdown
        const existing = assetTypeMap.get('stocks') || { value: 0, holdings: new Set() }
        existing.value += positionValue
        existing.holdings.add(stock.ticker)
        assetTypeMap.set('stocks', existing)
      }
    }
  }

  const breakdown: PortfolioAssetTypeBreakdown[] = Array.from(assetTypeMap.entries())
    .map(([assetType, data]) => ({
      assetType: assetType as PortfolioAssetTypeBreakdown['assetType'],
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      holdings: data.holdings.size,
    }))
    .sort((a, b) => b.value - a.value)

  return breakdown
}

// ============================================================================
// Comprehensive Breakdown Summary
// ============================================================================

export async function getComprehensivePortfolioBreakdown(portfolioId: string) {
  const [countryBreakdown, sectorBreakdown, regionBreakdown, assetTypeBreakdown] =
    await Promise.all([
      getPortfolioCountryBreakdown(portfolioId),
      getPortfolioSectorBreakdown(portfolioId),
      getPortfolioRegionBreakdown(portfolioId),
      getPortfolioAssetTypeBreakdown(portfolioId),
    ])

  // Calculate coverage percentages
  const countryTotal = countryBreakdown.reduce((sum, c) => sum + c.percentage, 0)
  const sectorTotal = sectorBreakdown.reduce((sum, s) => sum + s.percentage, 0)
  const regionTotal = regionBreakdown.reduce((sum, r) => sum + r.percentage, 0)
  const assetTypeTotal = assetTypeBreakdown.reduce((sum, a) => sum + a.percentage, 0)

  return {
    country: {
      breakdown: countryBreakdown,
      coverage: countryTotal,
    },
    sector: {
      breakdown: sectorBreakdown,
      coverage: sectorTotal,
    },
    region: {
      breakdown: regionBreakdown,
      coverage: regionTotal,
    },
    assetType: {
      breakdown: assetTypeBreakdown,
      coverage: assetTypeTotal,
    },
  }
}
