/**
 * Alpha Vantage API Client
 *
 * Handles fetching stock fundamentals data (sector, industry, company overview)
 * Documentation: https://www.alphavantage.co/documentation/
 *
 * Rate Limits (Free Tier):
 * - 25 requests per day
 * - 5 requests per minute
 *
 * Note: Very restrictive rate limits - use sparingly and cache aggressively
 */

// ============================================
// Types
// ============================================

export interface AlphaVantageConfig {
  apiKey: string
  baseUrl?: string
}

/**
 * Company Overview response from Alpha Vantage
 * Contains fundamental data including sector and industry
 */
export interface CompanyOverview {
  Symbol: string
  AssetType: string // 'Common Stock', 'ETF', etc.
  Name: string
  Description: string
  Exchange: string
  Currency: string
  Country: string
  Sector: string // GICS Sector
  Industry: string // GICS Industry
  MarketCapitalization: string
  PERatio: string | null
  DividendYield: string | null
  '52WeekHigh': string
  '52WeekLow': string
  [key: string]: string | null // Other fields we might not use
}

/**
 * Alpha Vantage API Error
 */
export class AlphaVantageError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'AlphaVantageError'
  }
}

// ============================================
// Client
// ============================================

export class AlphaVantageClient {
  private apiKey: string
  private baseUrl: string

  constructor(config: AlphaVantageConfig) {
    if (!config.apiKey) {
      throw new AlphaVantageError('Alpha Vantage API key is required')
    }
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://www.alphavantage.co/query'
  }

  /**
   * Make authenticated request to Alpha Vantage API
   */
  private async request<T>(params: Record<string, string>): Promise<T> {
    const urlParams = new URLSearchParams({
      ...params,
      apikey: this.apiKey,
    })

    const url = `${this.baseUrl}?${urlParams.toString()}`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text()
        throw new AlphaVantageError(
          `Alpha Vantage API error: ${errorText}`,
          response.status,
          errorText
        )
      }

      const data = (await response.json()) as T & { 'Error Message'?: string; Note?: string }

      // Check for API error messages
      if ('Error Message' in data) {
        throw new AlphaVantageError(`Alpha Vantage error: ${data['Error Message']}`)
      }

      // Check for rate limit message
      if ('Note' in data && typeof data.Note === 'string' && data.Note.includes('API rate limit')) {
        throw new AlphaVantageError(
          'Alpha Vantage rate limit exceeded. Free tier: 25 requests/day, 5 requests/minute.'
        )
      }

      return data
    } catch (error) {
      if (error instanceof AlphaVantageError) {
        throw error
      }
      throw new AlphaVantageError(
        `Failed to fetch from Alpha Vantage: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Fetch company overview data including sector and industry
   *
   * @param symbol Stock ticker symbol (without exchange suffix, e.g., 'AAPL' not 'AAPL_US_EQ')
   * @returns Company overview data with sector/industry information
   *
   * Rate limit: Part of 25 requests/day, 5 requests/minute limit
   */
  async getCompanyOverview(symbol: string): Promise<CompanyOverview> {
    return this.request<CompanyOverview>({
      function: 'OVERVIEW',
      symbol,
    })
  }

  /**
   * Batch fetch company overviews with rate limiting
   *
   * Automatically adds delays to respect API rate limits (5 requests/minute)
   *
   * @param symbols Array of stock symbols to fetch
   * @returns Array of company overviews (null for failed requests)
   */
  async batchGetCompanyOverviews(symbols: string[]): Promise<(CompanyOverview | null)[]> {
    const results: (CompanyOverview | null)[] = []
    const delayBetweenRequests = 12000 // 12 seconds = 5 requests per minute

    for (let i = 0; i < symbols.length; i++) {
      try {
        const overview = await this.getCompanyOverview(symbols[i])
        results.push(overview)
      } catch (error) {
        console.error(`Failed to fetch overview for ${symbols[i]}:`, error)
        results.push(null)
      }

      // Add delay between requests (except for the last one)
      if (i < symbols.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests))
      }
    }

    return results
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create Alpha Vantage client from environment variables
 */
export function createAlphaVantageClient(): AlphaVantageClient {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY

  if (!apiKey) {
    throw new Error(
      'ALPHA_VANTAGE_API_KEY environment variable is required. Get a free key at https://www.alphavantage.co/support/#api-key'
    )
  }

  return new AlphaVantageClient({ apiKey })
}
