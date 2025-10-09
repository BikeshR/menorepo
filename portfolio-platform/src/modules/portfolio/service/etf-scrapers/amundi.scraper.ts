/**
 * Amundi ETF Scraper
 *
 * Fetches data from Amundi factsheet pages
 */

// Removed cheerio dependency
// import * as cheerio from 'cheerio'
import type { ETFBreakdownData } from '../../types'

export async function scrapeAmundiETF(ticker: string, isin: string): Promise<ETFBreakdownData> {
  throw new Error('cheerio dependency removed - scraping disabled')
  /*
  try {
    console.log(`[Amundi] Fetching data for ${ticker} (${isin})...`)

    // Amundi ETF page
    const url = `https://www.amundietf.co.uk/professional/product/view/${isin}`

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

    const holdings: any[] = []
    const countryBreakdown: any[] = []
    const sectorBreakdown: any[] = []

    // Parse available data
    $('table').each((_, table) => {
      const tableText = $(table).text().toLowerCase()

      if (tableText.includes('holding')) {
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
      } else if (tableText.includes('country')) {
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

    console.log(`[Amundi] Scraped ${ticker}:`, {
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
        provider: 'Amundi',
        total_assets_usd: null,
        ter_pct: null,
        data_source: 'amundi_website',
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
    console.error(`[Amundi] Failed to scrape ${ticker}:`, error)
    throw error
  }
  */
}
