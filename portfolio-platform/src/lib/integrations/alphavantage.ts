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
 * Time Series Daily response from Alpha Vantage
 * Contains historical OHLCV data
 */
export interface TimeSeriesDaily {
  'Meta Data': {
    '1. Information': string
    '2. Symbol': string
    '3. Last Refreshed': string
    '4. Output Size': string
    '5. Time Zone': string
  }
  'Time Series (Daily)': Record<
    string, // Date in YYYY-MM-DD format
    {
      '1. open': string
      '2. high': string
      '3. low': string
      '4. close': string
      '5. adjusted close': string
      '6. volume': string
      '7. dividend amount': string
      '8. split coefficient': string
    }
  >
}

/**
 * News Sentiment response from Alpha Vantage
 * Contains news articles with sentiment analysis
 */
export interface NewsSentiment {
  items: string
  sentiment_score_definition: string
  relevance_score_definition: string
  feed: NewsArticle[]
}

export interface NewsArticle {
  title: string
  url: string
  time_published: string
  authors: string[]
  summary: string
  banner_image: string | null
  source: string
  category_within_source: string
  source_domain: string
  topics: Array<{
    topic: string
    relevance_score: string
  }>
  overall_sentiment_score: number
  overall_sentiment_label: string
  ticker_sentiment: Array<{
    ticker: string
    relevance_score: string
    ticker_sentiment_score: string
    ticker_sentiment_label: string
  }>
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
   * Fetch daily time series data (OHLCV) with adjusted close prices
   *
   * @param symbol Stock ticker symbol (e.g., 'SPY' for S&P 500)
   * @param outputSize 'compact' (100 days) or 'full' (20+ years)
   * @returns Time series data with daily OHLCV and adjusted close
   *
   * Rate limit: Part of 25 requests/day, 5 requests/minute limit
   */
  async getTimeSeriesDaily(
    symbol: string,
    outputSize: 'compact' | 'full' = 'compact'
  ): Promise<TimeSeriesDaily> {
    return this.request<TimeSeriesDaily>({
      function: 'TIME_SERIES_DAILY_ADJUSTED',
      symbol,
      outputsize: outputSize,
    })
  }

  /**
   * Fetch news sentiment data for a ticker or topic
   *
   * @param tickers Stock ticker symbols (e.g., 'AAPL' or 'AAPL,GOOGL')
   * @param topics Optional topics to filter (e.g., 'technology', 'earnings')
   * @param timeFrom Optional start time in YYYYMMDDTHHMM format
   * @param timeTo Optional end time in YYYYMMDDTHHMM format
   * @param limit Optional result limit (default 50, max 1000)
   * @returns News articles with sentiment analysis
   *
   * Rate limit: Part of 25 requests/day, 5 requests/minute limit
   */
  async getNewsSentiment(params: {
    tickers?: string
    topics?: string
    timeFrom?: string
    timeTo?: string
    limit?: number
    sort?: 'LATEST' | 'EARLIEST' | 'RELEVANCE'
  }): Promise<NewsSentiment> {
    const queryParams: Record<string, string> = {
      function: 'NEWS_SENTIMENT',
    }

    if (params.tickers) queryParams.tickers = params.tickers
    if (params.topics) queryParams.topics = params.topics
    if (params.timeFrom) queryParams.time_from = params.timeFrom
    if (params.timeTo) queryParams.time_to = params.timeTo
    if (params.limit) queryParams.limit = params.limit.toString()
    if (params.sort) queryParams.sort = params.sort

    return this.request<NewsSentiment>(queryParams)
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
