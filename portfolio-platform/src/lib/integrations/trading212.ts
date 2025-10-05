/**
 * Trading212 API Client
 *
 * Handles authentication and API calls to Trading212's public API
 *
 * Official Documentation: https://docs.trading212.com/api/
 * Local OpenAPI Spec: docs/api-specs/trading212-openapi.yml
 *
 * Rate Limits:
 * - Portfolio: 1 request per 5 seconds
 * - Account Cash: 1 request per 2 seconds
 * - Instruments Metadata: 1 request per 50 seconds
 * - Most endpoints: See OpenAPI spec for details
 */

// ============================================
// Types
// ============================================

export interface Trading212Config {
  apiKey: string
  baseUrl: string
}

/**
 * Position response from Trading212 API
 */
export interface Trading212Position {
  ticker: string // Format: AAPL_US_EQ (symbol_exchange_assetType)
  quantity: number
  averagePrice: number // Cost basis per share
  currentPrice: number
  ppl: number // Profit/Loss in currency
  initialFillDate: string // ISO 8601 date
}

/**
 * Instrument metadata from Trading212
 */
export interface Trading212Instrument {
  ticker: string
  name: string
  isin: string // International Securities Identification Number
  currencyCode: string // e.g., 'USD', 'GBP'
  type: 'STOCK' | 'ETF' | 'FUND' // Asset type
  workingScheduleId: number
  minTrade: number
  maxOpenQuantity: number
  addedOn: string // ISO 8601 date
}

/**
 * Account cash response
 */
export interface Trading212Cash {
  free: number // Available cash
  total: number // Total cash including positions
  ppl: number // Profit/loss
  result: number // Net result
  invested: number // Total invested amount
  pieCash: number // Cash in pies (auto-invest)
  blocked: number // Blocked funds
}

/**
 * Historical order
 */
export interface Trading212Order {
  id: number
  dateCreated: string // ISO 8601
  dateExecuted: string | null
  dateModified: string | null
  ticker: string
  type: 'MARKET' | 'LIMIT' | 'STOP'
  limitPrice: number | null
  stopPrice: number | null
  quantity: number
  filledQuantity: number
  value: number
  status: 'NEW' | 'PROCESSING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED'
}

/**
 * Trading212 API Error
 */
export class Trading212Error extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'Trading212Error'
  }
}

// ============================================
// Client
// ============================================

export class Trading212Client {
  private apiKey: string
  private baseUrl: string

  constructor(config: Trading212Config) {
    if (!config.apiKey) {
      throw new Trading212Error('Trading212 API key is required')
    }
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Make authenticated request to Trading212 API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Basic ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      // Check for rate limiting
      if (response.status === 429) {
        throw new Trading212Error('Rate limit exceeded. Please try again later.', 429)
      }

      // Check for authentication errors
      if (response.status === 401) {
        const errorBody = await response.text()
        throw new Trading212Error(`Invalid API key. Response: ${errorBody}`, 401)
      }

      // Check for other errors
      if (!response.ok) {
        const errorText = await response.text()
        throw new Trading212Error(`Trading212 API error: ${errorText}`, response.status, errorText)
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof Trading212Error) {
        throw error
      }
      throw new Trading212Error(
        `Failed to fetch from Trading212: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Fetch all open positions
   * Rate limit: 1 request per 5 seconds
   */
  async getPortfolio(): Promise<Trading212Position[]> {
    return this.request<Trading212Position[]>('/equity/portfolio')
  }

  /**
   * Fetch specific position by ticker
   * @param ticker - Ticker symbol (e.g., 'AAPL_US_EQ')
   */
  async getPosition(ticker: string): Promise<Trading212Position | null> {
    try {
      return await this.request<Trading212Position>(`/equity/portfolio/${ticker}`)
    } catch (error) {
      // If position not found, return null instead of throwing
      if (error instanceof Trading212Error && error.statusCode === 404) {
        return null
      }
      throw error
    }
  }

  /**
   * Fetch account cash balance
   */
  async getCash(): Promise<Trading212Cash> {
    return this.request<Trading212Cash>('/equity/account/cash')
  }

  /**
   * Fetch all tradable instruments
   * Useful for getting instrument metadata (name, ISIN, type)
   */
  async getInstruments(): Promise<Trading212Instrument[]> {
    return this.request<Trading212Instrument[]>('/equity/metadata/instruments')
  }

  /**
   * Fetch list of exchanges
   */
  async getExchanges(): Promise<{ id: number; name: string }[]> {
    return this.request<{ id: number; name: string }[]>('/equity/metadata/exchanges')
  }

  /**
   * Fetch historical orders
   * @param limit - Max number of orders to fetch (default: 50)
   * @param cursor - Pagination cursor from previous response
   */
  async getOrders(
    limit = 50,
    cursor?: string
  ): Promise<{ items: Trading212Order[]; nextPagePath: string | null }> {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (cursor) params.append('cursor', cursor)

    return this.request<{
      items: Trading212Order[]
      nextPagePath: string | null
    }>(`/equity/history/orders?${params.toString()}`)
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create Trading212 client from environment variables
 *
 * IMPORTANT: You need to provide Base64-encoded credentials
 * Format: echo -n "API_KEY:API_SECRET" | base64
 *
 * Example:
 * TRADING212_API_KEY=your_base64_encoded_credentials
 * TRADING212_API_URL=https://demo.trading212.com/api/v0  (or https://live.trading212.com/api/v0)
 */
export function createTrading212Client(): Trading212Client {
  const apiKey = process.env.TRADING212_API_KEY
  const apiSecret = process.env.TRADING212_API_SECRET
  const baseUrl = process.env.TRADING212_API_URL || 'https://demo.trading212.com/api/v0'

  let base64Credentials: string

  if (apiKey && apiSecret) {
    // If both key and secret provided, encode them
    const credentials = `${apiKey}:${apiSecret}`
    base64Credentials = Buffer.from(credentials).toString('base64')
  } else if (apiKey && !apiSecret) {
    // If only apiKey provided, assume it's already base64-encoded
    base64Credentials = apiKey
  } else {
    throw new Error(
      'Trading212 API credentials required. Provide either:\n' +
        '1. TRADING212_API_KEY (base64 encoded "key:secret"), OR\n' +
        '2. TRADING212_API_KEY and TRADING212_API_SECRET separately'
    )
  }

  return new Trading212Client({ apiKey: base64Credentials, baseUrl })
}

// ============================================
// Utility Functions
// ============================================

/**
 * Parse Trading212 ticker format to extract symbol and exchange
 * Format: SYMBOL_EXCHANGE_TYPE (e.g., AAPL_US_EQ)
 */
export function parseTrading212Ticker(ticker: string): {
  symbol: string
  exchange: string
  assetType: string
} {
  const parts = ticker.split('_')
  if (parts.length < 3) {
    return {
      symbol: ticker,
      exchange: 'UNKNOWN',
      assetType: 'UNKNOWN',
    }
  }

  return {
    symbol: parts[0],
    exchange: parts[1],
    assetType: parts[2],
  }
}

/**
 * Map Trading212 exchange code to country
 */
export function exchangeToCountry(exchange: string): string {
  const exchangeMap: Record<string, string> = {
    US: 'United States',
    LSE: 'United Kingdom',
    FRA: 'Germany',
    PAR: 'France',
    AMS: 'Netherlands',
    SWX: 'Switzerland',
    MIL: 'Italy',
    MAD: 'Spain',
    // Add more as needed
  }

  return exchangeMap[exchange] || exchange
}

/**
 * Map country to region
 */
export function countryToRegion(country: string): string {
  const regionMap: Record<string, string> = {
    'United States': 'North America',
    Canada: 'North America',
    'United Kingdom': 'Europe',
    Germany: 'Europe',
    France: 'Europe',
    Netherlands: 'Europe',
    Switzerland: 'Europe',
    Italy: 'Europe',
    Spain: 'Europe',
    // Add more as needed
  }

  return regionMap[country] || 'Other'
}

/**
 * Normalize currency code and convert fractional currencies to base currency
 *
 * Trading212 uses special currency codes:
 * - GBX (Great British Pence) = 1/100 GBP
 * - ZAc (South African Cents) = 1/100 ZAR
 * - ILA (Israeli Agorot) = 1/100 ILS
 * - GBp (alternate pence notation) = 1/100 GBP
 *
 * @param currencyCode The currency code from Trading212 (e.g., 'GBX', 'USD')
 * @returns Object with normalized currency code and conversion multiplier
 */
export function normalizeCurrency(currencyCode: string): {
  baseCurrency: string
  multiplier: number
} {
  const fractionalCurrencies: Record<string, { base: string; divisor: number }> = {
    GBX: { base: 'GBP', divisor: 100 }, // UK Pence
    GBp: { base: 'GBP', divisor: 100 }, // UK Pence (alternate)
    ZAc: { base: 'ZAR', divisor: 100 }, // South African Cents
    ILA: { base: 'ILS', divisor: 100 }, // Israeli Agorot
    USX: { base: 'USD', divisor: 100 }, // US Cents (rare)
  }

  const fractional = fractionalCurrencies[currencyCode]
  if (fractional) {
    return {
      baseCurrency: fractional.base,
      multiplier: 1 / fractional.divisor,
    }
  }

  return {
    baseCurrency: currencyCode,
    multiplier: 1,
  }
}

/**
 * Convert a price from Trading212's currency to the base currency
 *
 * @param price The price from Trading212 API
 * @param currencyCode The currency code (e.g., 'GBX', 'USD')
 * @returns Price converted to base currency
 */
export function convertToBaseCurrency(price: number, currencyCode: string): number {
  const { multiplier } = normalizeCurrency(currencyCode)
  return price * multiplier
}
