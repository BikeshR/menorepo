/**
 * Kraken API Client
 *
 * Handles authentication and API calls to Kraken's REST API for crypto portfolio tracking
 *
 * Official Documentation: https://docs.kraken.com/api/
 * Base URL: https://api.kraken.com
 *
 * Rate Limits:
 * - Public endpoints: ~1 request/second
 * - Private endpoints: 15-20 requests/minute
 */

import crypto from 'node:crypto'

// ============================================
// Types
// ============================================

export interface KrakenConfig {
  apiKey: string
  apiSecret: string
  baseUrl?: string
}

/**
 * Kraken API response format
 */
export interface KrakenResponse<T> {
  error: string[]
  result: T
}

/**
 * Account balance response
 * Keys are asset codes (e.g., 'XXBT' for Bitcoin, 'ZUSD' for USD)
 * Values are balance amounts as strings
 */
export type KrakenBalance = Record<string, string>

/**
 * Asset pair ticker information
 */
export interface KrakenTicker {
  a: [string, string, string] // Ask [price, whole lot volume, lot volume]
  b: [string, string, string] // Bid [price, whole lot volume, lot volume]
  c: [string, string] // Last trade closed [price, lot volume]
  v: [string, string] // Volume [today, last 24 hours]
  p: [string, string] // Volume weighted average price [today, last 24 hours]
  t: [number, number] // Number of trades [today, last 24 hours]
  l: [string, string] // Low [today, last 24 hours]
  h: [string, string] // High [today, last 24 hours]
  o: string // Today's opening price
}

/**
 * Asset information
 */
export interface KrakenAssetInfo {
  aclass: string // Asset class (e.g., 'currency')
  altname: string // Alternate name (e.g., 'BTC')
  decimals: number
  display_decimals: number
}

/**
 * Trade information from Kraken
 */
export interface KrakenTrade {
  ordertxid: string // Order transaction ID
  postxid: string // Position transaction ID
  pair: string // Asset pair
  time: number // Unix timestamp
  type: 'buy' | 'sell'
  ordertype:
    | 'market'
    | 'limit'
    | 'stop-loss'
    | 'take-profit'
    | 'stop-loss-limit'
    | 'take-profit-limit'
  price: string // Average price order was executed at
  cost: string // Total cost of order (quote currency)
  fee: string // Total fee (quote currency)
  vol: string // Volume (base currency)
  margin: string // Initial margin (quote currency)
  misc: string // Comma-delimited list of miscellaneous info
}

/**
 * Trades history response
 */
export interface KrakenTradesHistory {
  trades: Record<string, KrakenTrade> // Trade ID -> Trade data
  count: number
}

/**
 * Kraken API Error
 */
export class KrakenError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: string[]
  ) {
    super(message)
    this.name = 'KrakenError'
  }
}

// ============================================
// Client
// ============================================

export class KrakenClient {
  private apiKey: string
  private apiSecret: string
  private baseUrl: string

  constructor(config: KrakenConfig) {
    if (!config.apiKey) {
      throw new KrakenError('Kraken API key is required')
    }
    if (!config.apiSecret) {
      throw new KrakenError('Kraken API secret is required')
    }
    this.apiKey = config.apiKey
    this.apiSecret = config.apiSecret
    this.baseUrl = config.baseUrl || 'https://api.kraken.com'
  }

  /**
   * Generate authentication signature for private endpoints
   * @param path - API endpoint path (e.g., '/0/private/Balance')
   * @param data - POST data including nonce
   * @returns Base64-encoded signature
   */
  private generateSignature(path: string, data: Record<string, string>): string {
    // Create query string from data
    const postData = new URLSearchParams(data).toString()

    // Create SHA256 hash of (nonce + POST data)
    const sha256Hash = crypto
      .createHash('sha256')
      .update(data.nonce + postData)
      .digest()

    // Create HMAC-SHA512 of (path + SHA256 hash) using secret
    const hmac = crypto
      .createHmac('sha512', Buffer.from(this.apiSecret, 'base64'))
      .update(path + sha256Hash.toString('binary'), 'binary')
      .digest('base64')

    return hmac
  }

  /**
   * Make authenticated request to Kraken private API
   */
  private async requestPrivate<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const path = `/0/private/${endpoint}`
    const url = `${this.baseUrl}${path}`

    // Generate nonce (millisecond timestamp)
    const nonce = Date.now().toString()

    // Prepare POST data
    const data = {
      nonce,
      ...params,
    }

    // Generate signature
    const signature = this.generateSignature(path, data)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'API-Key': this.apiKey,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(data).toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new KrakenError(`Kraken API HTTP error: ${errorText}`, response.status)
      }

      const json = (await response.json()) as KrakenResponse<T>

      // Check for API errors in response
      if (json.error && json.error.length > 0) {
        throw new KrakenError(`Kraken API error: ${json.error.join(', ')}`, undefined, json.error)
      }

      return json.result
    } catch (error) {
      if (error instanceof KrakenError) {
        throw error
      }
      throw new KrakenError(
        `Failed to fetch from Kraken: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Make request to Kraken public API
   */
  private async requestPublic<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const queryString = new URLSearchParams(params).toString()
    const url = `${this.baseUrl}/0/public/${endpoint}${queryString ? `?${queryString}` : ''}`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text()
        throw new KrakenError(`Kraken API HTTP error: ${errorText}`, response.status)
      }

      const json = (await response.json()) as KrakenResponse<T>

      // Check for API errors in response
      if (json.error && json.error.length > 0) {
        throw new KrakenError(`Kraken API error: ${json.error.join(', ')}`, undefined, json.error)
      }

      return json.result
    } catch (error) {
      if (error instanceof KrakenError) {
        throw error
      }
      throw new KrakenError(
        `Failed to fetch from Kraken: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Fetch account balance
   * Returns all crypto and fiat balances
   *
   * Rate limit: Part of 15-20 requests/minute for private endpoints
   */
  async getBalance(): Promise<KrakenBalance> {
    return this.requestPrivate<KrakenBalance>('Balance')
  }

  /**
   * Fetch ticker information for asset pairs
   * @param pairs - Asset pair names (e.g., 'XXBTZUSD', 'XETHZUSD')
   */
  async getTicker(pairs: string[]): Promise<Record<string, KrakenTicker>> {
    return this.requestPublic<Record<string, KrakenTicker>>('Ticker', {
      pair: pairs.join(','),
    })
  }

  /**
   * Fetch asset information
   * @param assets - Optional array of asset codes to filter (defaults to all)
   */
  async getAssetInfo(assets?: string[]): Promise<Record<string, KrakenAssetInfo>> {
    const params = assets ? { asset: assets.join(',') } : undefined
    return this.requestPublic<Record<string, KrakenAssetInfo>>('Assets', params)
  }

  /**
   * Fetch trade history
   * @param start - Starting timestamp (optional)
   * @param end - Ending timestamp (optional)
   * @param ofs - Result offset for pagination (optional)
   *
   * Rate limit: Part of 15-20 requests/minute for private endpoints
   */
  async getTradesHistory(params?: {
    start?: number
    end?: number
    ofs?: number
  }): Promise<KrakenTradesHistory> {
    const requestParams: Record<string, string> = {
      trades: 'true', // Include trade details
    }

    if (params?.start) requestParams.start = params.start.toString()
    if (params?.end) requestParams.end = params.end.toString()
    if (params?.ofs) requestParams.ofs = params.ofs.toString()

    return this.requestPrivate<KrakenTradesHistory>('TradesHistory', requestParams)
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create Kraken client from environment variables
 *
 * Required environment variables:
 * - KRAKEN_API_KEY: Your API key from Kraken
 * - KRAKEN_API_SECRET: Your API secret from Kraken
 */
export function createKrakenClient(): KrakenClient {
  const apiKey = process.env.KRAKEN_API_KEY
  const apiSecret = process.env.KRAKEN_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error(
      'Kraken API credentials required. Set KRAKEN_API_KEY and KRAKEN_API_SECRET environment variables.\n' +
        'Get API keys from: https://www.kraken.com/ > Settings > API'
    )
  }

  return new KrakenClient({ apiKey, apiSecret })
}

// ============================================
// Utility Functions
// ============================================

/**
 * Normalize Kraken asset codes to standard symbols
 * Kraken uses prefixed codes like XXBT, XETH, ZUSD
 * Also handles staking variants (.S, .F, .B suffixes)
 */
export function normalizeKrakenAsset(assetCode: string): string {
  // Remove staking/futures suffixes and version numbers
  // Examples: ATOM21.S -> ATOM, ETH.B -> ETH, SOL.F -> SOL
  const baseAsset = assetCode.replace(/\d+\.(S|F|B)$/, '').replace(/\.(S|F|B)$/, '')

  const assetMap: Record<string, string> = {
    XXBT: 'BTC',
    XBT: 'BTC',
    XETH: 'ETH',
    XXDG: 'DOGE',
    XLTC: 'LTC',
    XXLM: 'XLM',
    XXMR: 'XMR',
    XXRP: 'XRP',
    XZEC: 'ZEC',
    ZUSD: 'USD',
    ZEUR: 'EUR',
    ZGBP: 'GBP',
    ZJPY: 'JPY',
    ZCAD: 'CAD',
    ZAUD: 'AUD',
  }

  return assetMap[baseAsset] || baseAsset
}

/**
 * Get standard trading pair for an asset against USD
 * @param asset - Asset code (e.g., 'BTC', 'ETH')
 * @returns Kraken pair format (e.g., 'XXBTZUSD', 'XETHZUSD')
 */
export function getKrakenPair(asset: string): string {
  const pairMap: Record<string, string> = {
    // Major cryptocurrencies (X prefix)
    BTC: 'XXBTZUSD',
    ETH: 'XETHZUSD',
    DOGE: 'XXDGZUSD',
    LTC: 'XLTCZUSD',
    XLM: 'XXLMZUSD',
    XMR: 'XXMRZUSD',
    XRP: 'XXRPZUSD',
    ZEC: 'XZECZUSD',

    // Modern cryptocurrencies (no X prefix)
    ADA: 'ADAUSD',
    ALGO: 'ALGOUSD',
    ATOM: 'ATOMUSD',
    AVAX: 'AVAXUSD',
    BCH: 'BCHUSD',
    LINK: 'LINKUSD',
    DOT: 'DOTUSD',
    EOS: 'EOSUSD',
    FIL: 'FILUSD',
    FLOW: 'FLOWUSD',
    GRT: 'GRTUSD',
    ICP: 'ICPUSD',
    INJ: 'INJUSD',
    MANA: 'MANAUSD',
    MATIC: 'MATICUSD',
    NEAR: 'NEARUSD',
    OP: 'OPUSD',
    SEI: 'SEIUSD',
    SHIB: 'SHIBUSD',
    SOL: 'SOLUSD',
    TIA: 'TIAUSD',
    TRX: 'TRXUSD',
    UNI: 'UNIUSD',
    USDC: 'USDCUSD',
    USDT: 'USDTUSD',
    XTZ: 'XTZUSD',

    // Staking variants (append .S for staked versions)
    'ETH2.S': 'ETH2.SUSD',
    'DOT.S': 'DOT.SUSD',
    'ATOM.S': 'ATOM.SUSD',
    'MATIC.S': 'MATIC.SUSD',
    'SOL.S': 'SOL.SUSD',
  }

  return pairMap[asset] || `${asset}USD`
}
