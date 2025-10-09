/**
 * WisdomTree ETF Scraper
 *
 * Fetches ETF data from WisdomTree factsheet pages
 */

// Removed cheerio dependency
// import * as cheerio from 'cheerio'
import type { ETFBreakdownData } from '../../types'

export async function scrapeWisdomTreeETF(ticker: string, isin: string): Promise<ETFBreakdownData> {
  throw new Error('cheerio dependency removed - scraping disabled')
  /*
  try {
    console.log(`[WisdomTree] Fetching data for ${ticker} (${isin})...`)

    // WisdomTree fund page
    const url = `https://www.wisdomtree.eu/en-gb/etfs/broad-commodities/${isin.toLowerCase()}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Parse holdings, country, sector breakdowns
    // WisdomTree structure varies, so we'll extract what we can

    const holdings: any[] = []
    const countryBreakdown: any[] = []
    const sectorBreakdown: any[] = []

    // Try to parse tables (generic approach)
    $('table').each((_, table) => {
      const tableText = $(table).text().toLowerCase()

      if (tableText.includes('holding') || tableText.includes('top')) {
        // Holdings table
        $(table)
          .find('tbody tr')
          .each((_, row) => {
            const cells = $(row).find('td')
            if (cells.length >= 2) {
              holdings.push({
                id: '',
                etf_ticker: ticker,
                holding_ticker: null,
                holding_name: cells.eq(0).text().trim(),
                holding_isin: null,
                weight_pct: Number.parseFloat(cells.eq(1).text().replace('%', '').trim()) || 0,
                shares: null,
                market_value_usd: null,
                asset_type: 'stock',
                country: null,
                sector: null,
                industry: null,
                last_updated_at: new Date().toISOString(),
                created_at: '',
                updated_at: '',
              })
            }
          })
      } else if (tableText.includes('country') || tableText.includes('geography')) {
        // Country breakdown
        $(table)
          .find('tbody tr')
          .each((_, row) => {
            const cells = $(row).find('td')
            if (cells.length >= 2) {
              countryBreakdown.push({
                id: '',
                etf_ticker: ticker,
                country: cells.eq(0).text().trim(),
                weight_pct: Number.parseFloat(cells.eq(1).text().replace('%', '').trim()) || 0,
                last_updated_at: new Date().toISOString(),
                created_at: '',
                updated_at: '',
              })
            }
          })
      } else if (tableText.includes('sector')) {
        // Sector breakdown
        $(table)
          .find('tbody tr')
          .each((_, row) => {
            const cells = $(row).find('td')
            if (cells.length >= 2) {
              sectorBreakdown.push({
                id: '',
                etf_ticker: ticker,
                sector: cells.eq(0).text().trim(),
                industry_group: null,
                weight_pct: Number.parseFloat(cells.eq(1).text().replace('%', '').trim()) || 0,
                last_updated_at: new Date().toISOString(),
                created_at: '',
                updated_at: '',
              })
            }
          })
      }
    })

    const assetAllocation = [
      {
        id: '',
        etf_ticker: ticker,
        asset_class: 'stocks' as const,
        weight_pct: 100,
        last_updated_at: new Date().toISOString(),
        created_at: '',
        updated_at: '',
      },
    ]

    console.log(`[WisdomTree] Scraped ${ticker}:`, {
      holdings: holdings.length,
      countries: countryBreakdown.length,
      sectors: sectorBreakdown.length,
    })

    return {
      metadata: {
        id: '',
        ticker,
        isin,
        name: ticker,
        provider: 'WisdomTree',
        total_assets_usd: null,
        ter_pct: null,
        data_source: 'wisdomtree_website',
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
    console.error(`[WisdomTree] Failed to scrape ${ticker}:`, error)
    throw error
  }
  */
}
