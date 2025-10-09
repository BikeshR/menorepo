/**
 * Franklin Templeton ETF Scraper
 *
 * Fetches data from Franklin Templeton monthly holdings pages
 */

import * as cheerio from 'cheerio'
import type { ETFBreakdownData } from '../../types'

export async function scrapeFranklinETF(ticker: string, isin: string): Promise<ETFBreakdownData> {
  try {
    console.log(`[Franklin] Fetching data for ${ticker} (${isin})...`)

    // Franklin factsheet URL
    const url = `https://www.franklintempleton.co.uk/investor/investments-and-solutions/investment-options/etfs/overview/${isin.toLowerCase()}/factsheet`

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

    // Parse holdings, country, sector data
    $('table').each((_, table) => {
      const headingText = $(table).prev('h2, h3, h4').text().toLowerCase()

      if (headingText.includes('holding') || headingText.includes('top')) {
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
      } else if (headingText.includes('country') || headingText.includes('geograph')) {
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
      } else if (headingText.includes('sector')) {
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

    console.log(`[Franklin] Scraped ${ticker}:`, {
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
        provider: 'Franklin Templeton',
        total_assets_usd: null,
        ter_pct: null,
        data_source: 'franklin_website',
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
    console.error(`[Franklin] Failed to scrape ${ticker}:`, error)
    throw error
  }
}
