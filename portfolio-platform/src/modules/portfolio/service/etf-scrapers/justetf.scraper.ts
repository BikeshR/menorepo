/**
 * justETF Scraper with Playwright
 *
 * Fallback scraper for ETFs that don't have official APIs
 * Uses Playwright to handle JavaScript-rendered pages
 */

// Removed playwright dependency
// import { chromium } from 'playwright'
import type { ETFBreakdownData } from '../../types'

export async function scrapeJustETF(ticker: string, isin: string): Promise<ETFBreakdownData> {
  throw new Error('playwright dependency removed - scraping disabled')
  /*
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  })

  // Remove automation flags
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    })
  })

  const page = await context.newPage()

  try {
    console.log(`[justETF] Fetching data for ${ticker} (${isin})...`)

    const url = `https://www.justetf.com/en/etf-profile.html?isin=${isin}`
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })

    // Accept cookies if dialog appears (non-blocking)
    try {
      const cookieButton = page.locator('button:has-text("Allow all cookies")')
      if ((await cookieButton.count()) > 0) {
        await cookieButton.click({ timeout: 1000 })
      }
    } catch (_e) {
      // Cookie dialog might not appear or click failed
    }

    // Wait for main heading to load
    await page.waitForSelector('h1', { timeout: 10000 })

    // Extract ETF name
    const name = (await page.locator('h1').first().textContent()) || ticker

    // Extract provider
    const provider = await page
      .locator('.val.infobox')
      .filter({ has: page.locator('.label:has-text("Fund provider")') })
      .textContent()
      .catch(() => null)

    // Extract TER
    const terText = await page
      .locator('.val.infobox')
      .filter({ has: page.locator('.label:has-text("Total expense ratio")') })
      .textContent()
      .catch(() => null)
    const ter_pct = terText ? parseFloat(terText.replace('%', '').replace(',', '.')) : null

    // Extract top holdings
    const holdings: any[] = []
    try {
      // Find all tables on the page
      const allTables = await page.locator('table').all()

      // Look for the holdings table - it should have exactly 2 columns with percentages
      let holdingsTable = null
      let maxValidRows = 0

      for (const table of allTables) {
        try {
          const rows = await table.locator('tbody tr').all()
          if (rows.length === 0) continue

          // Check first few rows to see if they match holdings pattern
          let validRowCount = 0
          for (let i = 0; i < Math.min(3, rows.length); i++) {
            const cells = await rows[i].locator('td').all()
            if (cells.length === 2) {
              const cell1Text = await cells[0].textContent()
              const cell2Text = await cells[1].textContent()

              // Check if second cell contains a percentage
              if (cell2Text?.includes('%') && cell1Text && cell1Text.length > 2) {
                validRowCount++
              }
            }
          }

          // If this table has more valid rows than previous candidates, use it
          if (validRowCount > maxValidRows) {
            maxValidRows = validRowCount
            holdingsTable = table
          }
        } catch (_e) {}
      }

      if (holdingsTable && maxValidRows >= 2) {
        const holdingsRows = await holdingsTable.locator('tbody tr').all()
        console.log(`[justETF] Found ${holdingsRows.length} holding rows`)

        for (const row of holdingsRows) {
          const cells = await row.locator('td').all()
          if (cells.length >= 2) {
            const holding_name = await cells[0].textContent()
            const weightText = await cells[1].textContent()
            const weight_pct = parseFloat(
              weightText?.replace('%', '').replace(',', '.').trim() || '0'
            )

            if (holding_name && weight_pct > 0) {
              holdings.push({
                id: '',
                etf_ticker: ticker,
                holding_ticker: null,
                holding_name: holding_name.trim(),
                holding_isin: null,
                weight_pct,
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
        }
      } else {
        console.log(`[justETF] Could not find holdings table (max valid rows: ${maxValidRows})`)
      }
    } catch (error) {
      console.log(`[justETF] Could not extract holdings:`, error)
    }

    // Extract country breakdown - look for table with country names
    const countryBreakdown: any[] = []
    try {
      const allTables = await page.locator('table').all()
      let countriesTable = null

      for (const table of allTables) {
        const tableText = await table.textContent()
        if (tableText?.includes('United States') && tableText.includes('%')) {
          countriesTable = table
          break
        }
      }

      if (countriesTable) {
        const countryRows = await countriesTable.locator('tbody tr').all()

        for (const row of countryRows) {
          const cells = await row.locator('td').all()
          if (cells.length >= 2) {
            const country = await cells[0].textContent()
            const weightText = await cells[1].textContent()
            const weight_pct = parseFloat(
              weightText?.replace('%', '').replace(',', '.').trim() || '0'
            )

            if (country && weight_pct > 0 && country.trim().toLowerCase() !== 'other') {
              countryBreakdown.push({
                id: '',
                etf_ticker: ticker,
                country: country.trim(),
                weight_pct,
                last_updated_at: new Date().toISOString(),
                created_at: '',
                updated_at: '',
              })
            }
          }
        }
      }
    } catch (error) {
      console.log(`[justETF] Could not extract country breakdown:`, error)
    }

    // Extract sector breakdown - look for table with sector names
    const sectorBreakdown: any[] = []
    try {
      const allTables = await page.locator('table').all()
      let sectorsTable = null

      for (const table of allTables) {
        const tableText = await table.textContent()
        if (
          tableText &&
          (tableText.includes('Technology') ||
            tableText.includes('Industrials') ||
            tableText.includes('Financials')) &&
          tableText.includes('%') &&
          !tableText.includes('United States')
        ) {
          sectorsTable = table
          break
        }
      }

      if (sectorsTable) {
        const sectorRows = await sectorsTable.locator('tbody tr').all()

        for (const row of sectorRows) {
          const cells = await row.locator('td').all()
          if (cells.length >= 2) {
            const sector = await cells[0].textContent()
            const weightText = await cells[1].textContent()
            const weight_pct = parseFloat(
              weightText?.replace('%', '').replace(',', '.').trim() || '0'
            )

            if (sector && weight_pct > 0 && sector.trim().toLowerCase() !== 'other') {
              sectorBreakdown.push({
                id: '',
                etf_ticker: ticker,
                sector: sector.trim(),
                industry_group: null,
                weight_pct,
                last_updated_at: new Date().toISOString(),
                created_at: '',
                updated_at: '',
              })
            }
          }
        }
      }
    } catch (error) {
      console.log(`[justETF] Could not extract sector breakdown:`, error)
    }

    // Extract asset allocation (if available - not all ETFs have this)
    const assetAllocation: any[] = []
    try {
      // Try to find asset allocation section - might not exist for all ETFs
      const assetSection = page
        .locator('text=Asset allocation')
        .locator('xpath=ancestor::*')
        .locator('table')
        .first()
      const assetRows = await assetSection.locator('tbody tr').all()

      for (const row of assetRows) {
        const cells = await row.locator('td').all()
        if (cells.length >= 2) {
          const assetClassText = await cells[0].textContent()
          const weightText = await cells[1].textContent()
          const weight_pct = parseFloat(
            weightText?.replace('%', '').replace(',', '.').trim() || '0'
          )

          if (assetClassText && weight_pct > 0) {
            // Map to our asset class enum
            let asset_class: 'stocks' | 'bonds' | 'cash' | 'commodities' | 'real_estate' | 'other' =
              'other'
            const lowerText = assetClassText.toLowerCase()

            if (lowerText.includes('stock') || lowerText.includes('equity')) asset_class = 'stocks'
            else if (lowerText.includes('bond') || lowerText.includes('fixed income'))
              asset_class = 'bonds'
            else if (lowerText.includes('cash')) asset_class = 'cash'
            else if (lowerText.includes('commodit')) asset_class = 'commodities'
            else if (lowerText.includes('real estate') || lowerText.includes('property'))
              asset_class = 'real_estate'

            assetAllocation.push({
              id: '',
              etf_ticker: ticker,
              asset_class,
              weight_pct,
              last_updated_at: new Date().toISOString(),
              created_at: '',
              updated_at: '',
            })
          }
        }
      }
    } catch (error) {
      console.log(`[justETF] Could not extract asset allocation (may not be available):`, error)
    }

    console.log(`[justETF] Successfully scraped ${ticker}:`, {
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
        name: name.trim(),
        provider: provider?.trim() || null,
        total_assets_usd: null,
        ter_pct,
        data_source: 'justetf_playwright',
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
    console.error(`[justETF] Failed to scrape ${ticker}:`, error)
    throw error
  } finally {
    await browser.close()
  }
  */
}
