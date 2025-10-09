/**
 * Xtrackers (DWS) ETF Scraper
 *
 * Fetches ETF data from Xtrackers API which returns XLSX files
 * API: https://etf.dws.com/api/pdp/en-gb/export/etf/{ISIN}/Securities
 */

// Removed xlsx dependency
// import * as XLSX from 'xlsx'
import type { ETFBreakdownData } from '../../types'

const _BASE_URL = 'https://etf.dws.com/api/pdp/en-gb/export/etf'

export async function scrapeXtrackersETF(
  _ticker: string,
  _isin: string
): Promise<ETFBreakdownData> {
  throw new Error('xlsx dependency removed - scraping disabled')
  /*
  try {
    console.log(`[Xtrackers] Fetching data for ${ticker} (${isin})...`)

    // Download XLSX file
    const url = `${BASE_URL}/${isin}/Securities`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Parse the holdings sheet - XLSX structure has headers on row 8 (index 8)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // First get all rows as arrays to find headers
    const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // Find the row with headers (contains 'Symbol', 'Name', 'Weight %', etc.)
    const headerRowIndex = allRows.findIndex((row) =>
      row?.some((cell) => cell === 'Symbol' || cell === 'Name' || cell === 'Weight %')
    )

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in XLSX file')
    }

    // Extract headers and data rows
    const headers = allRows[headerRowIndex].filter((h) => h) // Remove empty cells
    const dataRows = allRows.slice(headerRowIndex + 1)

    // Convert to objects using headers
    const data: any[] = dataRows
      .filter((row) => row && row.length > 0 && row.some((cell) => cell)) // Filter out empty rows
      .map((row) => {
        const obj: any = {}
        headers.forEach((header, i) => {
          // Adjust index by 1 because first column is empty in the XLSX
          obj[header] = row[i + 1]
        })
        return obj
      })

    console.log(`[Xtrackers] Found ${data.length} holdings with columns:`, headers)

    // Extract holdings - actual column names: Symbol, ISIN, CUSIP, SEDOL, Name, Weight %, $ Market Value, $ Notional Value, Quantity, Country, Sector, Asset Class
    const holdings = data
      .filter((row) => {
        // Must have at least a name and weight
        return row.Name && row['Weight %'] !== undefined && row['Weight %'] !== null
      })
      .map((row) => {
        const weight =
          typeof row['Weight %'] === 'number'
            ? row['Weight %']
            : Number.parseFloat(String(row['Weight %']).replace('%', '').replace(',', '.')) || 0

        return {
          id: '',
          etf_ticker: ticker,
          holding_ticker: row.Symbol || null,
          holding_name: row.Name || '',
          holding_isin: row.ISIN || null,
          weight_pct: weight,
          shares: row.Quantity ? Number.parseInt(String(row.Quantity), 10) : null,
          market_value_usd: row['$ Market Value']
            ? Number.parseFloat(String(row['$ Market Value']))
            : null,
          asset_type: determineAssetType(row['Asset Class']),
          country: row.Country || null,
          sector: row.Sector || null,
          industry: null,
          last_updated_at: new Date().toISOString(),
          created_at: '',
          updated_at: '',
        }
      })

    // Aggregate country breakdown
    const countryMap = new Map<string, number>()
    for (const holding of holdings) {
      if (holding.country) {
        const existing = countryMap.get(holding.country) || 0
        countryMap.set(holding.country, existing + holding.weight_pct)
      }
    }

    const countryBreakdown = Array.from(countryMap.entries()).map(([country, weight]) => ({
      id: '',
      etf_ticker: ticker,
      country,
      weight_pct: weight,
      last_updated_at: new Date().toISOString(),
      created_at: '',
      updated_at: '',
    }))

    // Aggregate sector breakdown
    const sectorMap = new Map<string, number>()
    for (const holding of holdings) {
      if (holding.sector) {
        const existing = sectorMap.get(holding.sector) || 0
        sectorMap.set(holding.sector, existing + holding.weight_pct)
      }
    }

    const sectorBreakdown = Array.from(sectorMap.entries()).map(([sector, weight]) => ({
      id: '',
      etf_ticker: ticker,
      sector,
      industry_group: null,
      weight_pct: weight,
      last_updated_at: new Date().toISOString(),
      created_at: '',
      updated_at: '',
    }))

    // Aggregate asset allocation
    const assetMap = new Map<string, number>()
    for (const holding of holdings) {
      if (holding.asset_type) {
        const existing = assetMap.get(holding.asset_type) || 0
        assetMap.set(holding.asset_type, existing + holding.weight_pct)
      }
    }

    const assetAllocation = Array.from(assetMap.entries()).map(([asset_type, weight]) => {
      // Map singular forms to plural forms for database
      let asset_class: 'stocks' | 'bonds' | 'cash' | 'commodities' | 'real_estate' | 'other' =
        'other'
      if (asset_type === 'stock') asset_class = 'stocks'
      else if (asset_type === 'bond') asset_class = 'bonds'
      else if (asset_type === 'cash') asset_class = 'cash'
      else if (asset_type === 'commodity') asset_class = 'commodities'
      else asset_class = 'other'

      return {
        id: '',
        etf_ticker: ticker,
        asset_class,
        weight_pct: weight,
        last_updated_at: new Date().toISOString(),
        created_at: '',
        updated_at: '',
      }
    })

    console.log(`[Xtrackers] Successfully scraped ${ticker}:`, {
      holdings: holdings.length,
      countries: countryBreakdown.length,
      sectors: sectorBreakdown.length,
      assetClasses: assetAllocation.length,
    })

    return {
      metadata: {
        id: '',
        ticker,
        isin,
        name: ticker, // Will be enriched later
        provider: 'Xtrackers',
        total_assets_usd: null,
        ter_pct: null,
        data_source: 'xtrackers_api',
        last_scraped_at: new Date().toISOString(),
        scrape_status: 'success',
        scrape_error: null,
        created_at: '',
        updated_at: '',
      },
      holdings,
      countryBreakdown,
      sectorBreakdown,
      assetAllocation,
    }
  } catch (error) {
    console.error(`[Xtrackers] Failed to scrape ${ticker}:`, error)
    throw error
  }
  */
}

function _determineAssetType(
  type?: string
): 'stock' | 'bond' | 'cash' | 'commodity' | 'other' | null {
  if (!type) return null

  const lowerType = type.toLowerCase()
  if (lowerType.includes('equity') || lowerType.includes('stock')) return 'stock'
  if (lowerType.includes('bond') || lowerType.includes('fixed income')) return 'bond'
  if (lowerType.includes('cash')) return 'cash'
  if (lowerType.includes('commodity') || lowerType.includes('gold') || lowerType.includes('metal'))
    return 'commodity'

  return 'other'
}
