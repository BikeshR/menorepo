/**
 * iShares ETF Scraper
 *
 * Fetches ETF data from iShares CSV downloads
 * Pattern: https://www.ishares.com/uk/individual/en/products/{PRODUCT_ID}/...
 */

import type { ETFBreakdownData } from '../../types'

// Known product IDs for common ETFs (can be expanded)
const PRODUCT_ID_MAP: Record<string, string> = {
  IE00B2QWCY14: '251920', // iShares S&P SmallCap 600 (ISP6)
  IE000U9ODG19: '334464', // iShares Global Aerospace & Defence (DFND)
  IE00B1XNHC34: '251911', // iShares Global Clean Energy (INRG)
  IE00BF4RFH31: '296576', // iShares MSCI World Small Cap (WLDS)
}

// Known numeric IDs for CSV endpoints
const NUMERIC_ID_MAP: Record<string, string> = {
  '251920': '1506575576011', // ISP6
  '334464': '1708019717314', // DFND (estimate)
  '251911': '1506575576011', // INRG (estimate)
  '296576': '1523010935117', // WLDS (estimate)
}

export async function scrapeISharesETF(ticker: string, isin: string): Promise<ETFBreakdownData> {
  try {
    console.log(`[iShares] Fetching data for ${ticker} (${isin})...`)

    // Try to get product ID
    const productId = PRODUCT_ID_MAP[isin]
    if (!productId) {
      // Try to search for the fund
      const searchProductId = await searchISharesFund(isin)
      if (!searchProductId) {
        throw new Error(`Could not find product ID for ISIN ${isin}. Please add to PRODUCT_ID_MAP.`)
      }
      PRODUCT_ID_MAP[isin] = searchProductId
    }

    // Download holdings CSV
    const numericId = NUMERIC_ID_MAP[productId] || Date.now().toString()
    const csvUrl = `https://www.ishares.com/uk/individual/en/products/${productId}/ishares-${ticker.toLowerCase()}-ucits-etf/${numericId}.ajax?fileType=csv&fileName=${ticker}_holdings&dataType=fund`

    const response = await fetch(csvUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const csvText = await response.text()
    const rows = csvText.split('\n').map((row) => row.split(','))

    // Find where holdings data starts (after header rows)
    let dataStartIndex = rows.findIndex(
      (row) => row[0]?.includes('Ticker') || row[0]?.includes('Name')
    )
    if (dataStartIndex === -1) dataStartIndex = 10 // Default to row 10

    const headers = rows[dataStartIndex]
    const dataRows = rows.slice(dataStartIndex + 1)

    // Parse holdings
    const holdings = dataRows
      .filter((row) => row.length > 3 && row[0] && row[0].trim())
      .map((row) => {
        const holding: any = {}
        headers.forEach((header, index) => {
          holding[header.trim()] = row[index]?.trim()
        })

        return {
          id: '',
          etf_ticker: ticker,
          holding_ticker: holding.Ticker || null,
          holding_name: holding.Name || holding.Holdings || '',
          holding_isin: holding.ISIN || null,
          weight_pct: Number.parseFloat(holding['Weight (%)'] || holding['% Net Assets'] || '0'),
          shares: holding.Shares ? Number.parseInt(holding.Shares, 10) : null,
          market_value_usd: holding['Market Value']
            ? Number.parseFloat(holding['Market Value'])
            : null,
          asset_type: determineAssetType(holding['Asset Class']),
          country: holding.Location || holding.Country || null,
          sector: holding.Sector || null,
          industry: null,
          last_updated_at: new Date().toISOString(),
          created_at: '',
          updated_at: '',
        }
      })
      .filter((h) => h.weight_pct > 0)

    // Aggregate breakdowns
    const countryMap = new Map<string, number>()
    const sectorMap = new Map<string, number>()
    const assetMap = new Map<string, number>()

    for (const holding of holdings) {
      if (holding.country) {
        countryMap.set(holding.country, (countryMap.get(holding.country) || 0) + holding.weight_pct)
      }
      if (holding.sector) {
        sectorMap.set(holding.sector, (sectorMap.get(holding.sector) || 0) + holding.weight_pct)
      }
      if (holding.asset_type) {
        assetMap.set(
          holding.asset_type,
          (assetMap.get(holding.asset_type) || 0) + holding.weight_pct
        )
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

    console.log(`[iShares] Successfully scraped ${ticker}:`, {
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
        name: ticker,
        provider: 'iShares',
        total_assets_usd: null,
        ter_pct: null,
        data_source: 'ishares_csv',
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
    console.error(`[iShares] Failed to scrape ${ticker}:`, error)
    throw error
  }
}

async function searchISharesFund(isin: string): Promise<string | null> {
  try {
    // Try to search for the fund by ISIN
    const _searchUrl = `https://www.ishares.com/uk/individual/en/products/etf-investments?switchLocale=y&siteEntryPassthrough=true#/?productView=etf&pageNumber=1&sortColumn=totalNetAssets&sortDirection=desc&dataView=keyFacts&query=${isin}`

    // This would require HTML parsing - for now, return null
    // User should manually add product IDs to the map
    console.warn(
      `[iShares] Product ID not found for ${isin}. Please add to PRODUCT_ID_MAP manually.`
    )
    return null
  } catch (_error) {
    return null
  }
}

function determineAssetType(
  type?: string
): 'stock' | 'bond' | 'cash' | 'commodity' | 'other' | null {
  if (!type) return null

  const lowerType = type.toLowerCase()
  if (lowerType.includes('equity') || lowerType.includes('stock')) return 'stock'
  if (lowerType.includes('bond') || lowerType.includes('fixed income')) return 'bond'
  if (lowerType.includes('cash')) return 'cash'
  if (lowerType.includes('commodity') || lowerType.includes('gold')) return 'commodity'

  return 'other'
}
