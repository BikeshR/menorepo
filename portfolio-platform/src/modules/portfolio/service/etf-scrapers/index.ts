/**
 * ETF Scraper Provider Router
 *
 * Routes to the appropriate scraper based on provider/ticker
 */

import type { ETFBreakdownData } from '../../types'
import { scrapeAmundiETF } from './amundi.scraper'
import { scrapeFranklinETF } from './franklin.scraper'
import { scrapeISharesETF } from './ishares.scraper'
import { scrapeJustETF } from './justetf.scraper'
import { scrapeVanEckETF } from './vaneck.scraper'
import { scrapeWisdomTreeETF } from './wisdomtree.scraper'
import { scrapeXtrackersETF } from './xtrackers.scraper'

export type ETFProvider = 'Xtrackers' | 'iShares' | 'VanEck' | 'WisdomTree' | 'Franklin' | 'Amundi'

/**
 * Determine provider from ticker pattern
 */
export function detectProvider(ticker: string): ETFProvider {
  const t = ticker.toUpperCase()

  // Xtrackers patterns: XWISl_EQ, XSMWl_EQ, XDWFl_EQ
  if (t.startsWith('X') && t.includes('W')) {
    return 'Xtrackers'
  }

  // iShares patterns: ISP6l_EQ, DFNDl_EQ, INRGl_EQ, WLDSl_EQ
  if (t.startsWith('ISP') || t.startsWith('DFND') || t.startsWith('INRG') || t.startsWith('WLDS')) {
    return 'iShares'
  }

  // VanEck patterns: SMGBl_EQ, DAGBl_EQ, REGBl_EQ, JEDGl_EQ
  if (t.includes('SMG') || t.includes('DAG') || t.includes('REGB') || t.includes('JEDG')) {
    return 'VanEck'
  }

  // WisdomTree patterns: CYSEl_EQ, DXJGl_EQ, QWTMl_EQ, DFEl_EQ
  if (
    t.includes('CYSE') ||
    t.includes('DXJG') ||
    t.includes('QWTM') ||
    (t.startsWith('DFE') && !t.includes('DFND'))
  ) {
    return 'WisdomTree'
  }

  // Franklin patterns: FRCHl_EQ, FRINl_EQ
  if (t.startsWith('FR')) {
    return 'Franklin'
  }

  // Amundi patterns: LUXGl_EQ
  if (t.includes('LUXG')) {
    return 'Amundi'
  }

  // Default fallback - try to guess from name patterns
  console.warn(`[ETF Scraper] Could not detect provider for ${ticker}, defaulting to Xtrackers`)
  return 'Xtrackers'
}

/**
 * Main scraper function - routes to correct provider
 */
export async function scrapeETF(
  ticker: string,
  isin: string,
  provider?: ETFProvider
): Promise<ETFBreakdownData> {
  const detectedProvider = provider || detectProvider(ticker)

  console.log(`[ETF Scraper] Using ${detectedProvider} scraper for ${ticker}`)

  try {
    switch (detectedProvider) {
      case 'Xtrackers':
        return await scrapeXtrackersETF(ticker, isin)

      case 'iShares':
        try {
          return await scrapeISharesETF(ticker, isin)
        } catch (iSharesError) {
          console.warn(
            `[ETF Scraper] iShares scraper failed for ${ticker}, falling back to justETF:`,
            iSharesError
          )
          return await scrapeJustETF(ticker, isin)
        }

      case 'VanEck':
      case 'WisdomTree':
      case 'Franklin':
      case 'Amundi':
        // These providers don't have reliable APIs, fall back to justETF
        console.log(
          `[ETF Scraper] ${detectedProvider} provider using justETF fallback with Playwright`
        )
        return await scrapeJustETF(ticker, isin)

      default:
        throw new Error(`Unknown provider: ${detectedProvider}`)
    }
  } catch (error) {
    console.error(`[ETF Scraper] Failed to scrape ${ticker} using ${detectedProvider}:`, error)
    throw error
  }
}

export {
  scrapeXtrackersETF,
  scrapeISharesETF,
  scrapeVanEckETF,
  scrapeWisdomTreeETF,
  scrapeFranklinETF,
  scrapeAmundiETF,
  scrapeJustETF,
}
