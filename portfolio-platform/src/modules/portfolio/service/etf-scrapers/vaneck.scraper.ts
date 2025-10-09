/**
 * VanEck ETF Scraper
 *
 * Fetches ETF data from VanEck website
 * Most data available on factsheet pages
 */

// Removed cheerio dependency
// import * as cheerio from 'cheerio'
import type { ETFBreakdownData } from '../../types'

export async function scrapeVanEckETF(_ticker: string, _isin: string): Promise<ETFBreakdownData> {
  throw new Error('cheerio dependency removed - scraping disabled')
  /*
  try {
    console.log(`[VanEck] Fetching data for ${ticker} (${isin})...`)

    // VanEck fund page URL pattern
    const url = `https://www.vaneck.com/ucits/en/institutional/product-detail/${isin.toLowerCase()}/`

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Could not fetch VanEck page`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract holdings (if available on page)
    const holdings: any[] = []
    // VanEck typically shows top 10 holdings
    $('.holdings-table tr, table.top-holdings tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length >= 2) {
        const name = cells.eq(0).text().trim()
        const weightText = cells.eq(1).text().trim()
        const weight = Number.parseFloat(weightText.replace('%', '').replace(',', '.'))

        if (name && !Number.isNaN(weight)) {
          holdings.push({
            id: '',
            etf_ticker: ticker,
            holding_ticker: null,
            holding_name: name,
            holding_isin: null,
            weight_pct: weight,
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
      }
    })

    // Extract sector breakdown
    const sectorBreakdown: any[] = []
    $('.sector-allocation tr, .allocation--sector tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length >= 2) {
        const sector = cells.eq(0).text().trim()
        const weightText = cells.eq(1).text().trim()
        const weight = Number.parseFloat(weightText.replace('%', '').replace(',', '.'))

        if (sector && !Number.isNaN(weight)) {
          sectorBreakdown.push({
            id: '',
            etf_ticker: ticker,
            sector,
            industry_group: null,
            weight_pct: weight,
            last_updated_at: new Date().toISOString(),
            created_at: '',
            updated_at: '',
          })
        }
      }
    })

    // Extract country breakdown
    const countryBreakdown: any[] = []
    $('.country-allocation tr, .allocation--geography tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length >= 2) {
        const country = cells.eq(0).text().trim()
        const weightText = cells.eq(1).text().trim()
        const weight = Number.parseFloat(weightText.replace('%', '').replace(',', '.'))

        if (country && !Number.isNaN(weight)) {
          countryBreakdown.push({
            id: '',
            etf_ticker: ticker,
            country,
            weight_pct: weight,
            last_updated_at: new Date().toISOString(),
            created_at: '',
            updated_at: '',
          })
        }
      }
    })

    // Assume 100% stocks for VanEck equity ETFs
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

    console.log(`[VanEck] Successfully scraped ${ticker}:`, {
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
        provider: 'VanEck',
        total_assets_usd: null,
        ter_pct: null,
        data_source: 'vaneck_website',
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
    console.error(`[VanEck] Failed to scrape ${ticker}:`, error)
    throw error
  }
  */
}
