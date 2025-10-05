/**
 * Portfolio Module Types
 *
 * Centralized type definitions for the entire portfolio module.
 */

// ============================================================================
// Database Entities
// ============================================================================

export type Portfolio = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type Stock = {
  id: string
  portfolio_id: string
  ticker: string
  name: string
  asset_type: 'stock' | 'etf' | 'crypto'
  isin: string | null
  currency: string
  quantity: number
  average_cost: number
  current_price: number
  gain_loss: number
  gain_loss_pct: number
  exchange: string | null
  country: string | null
  region: string | null
  initial_fill_date: string | null
  last_synced_at: string
  // Fundamentals (enriched data)
  sector: string | null
  industry: string | null
  market_cap: number | null
  pe_ratio: number | null
  dividend_yield: number | null
  created_at: string
  updated_at: string
}

export type PortfolioSnapshot = {
  id: string
  portfolio_id: string
  snapshot_date: string
  total_value: number
  cash_balance: number
  total_cost_basis: number
  total_gain_loss: number
  total_gain_loss_pct: number
  positions_count: number
  created_at: string
}

export type Transaction = {
  id: string
  portfolio_id: string
  ticker: string
  action: 'buy' | 'sell' | 'dividend'
  quantity: number
  price: number
  total_amount: number
  fee: number | null
  currency: string
  transaction_date: string
  source: 'trading212' | 'kraken' | 'manual'
  source_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SyncLog = {
  id: string
  portfolio_id: string
  sync_type: 'manual' | 'scheduled'
  source: 'trading212' | 'kraken' | 'alphavantage'
  status: 'started' | 'completed' | 'failed'
  items_synced: number | null
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export type BenchmarkPrice = {
  id: string
  symbol: string
  name: string
  price: number
  date: string
  created_at: string
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export type CreatePortfolioDto = {
  name: string
  description?: string
}

export type CreateStockDto = Omit<Stock, 'id' | 'created_at' | 'updated_at'>

export type UpdateStockDto = Partial<
  Pick<
    Stock,
    | 'name'
    | 'quantity'
    | 'average_cost'
    | 'current_price'
    | 'gain_loss'
    | 'gain_loss_pct'
    | 'sector'
    | 'industry'
    | 'market_cap'
    | 'pe_ratio'
    | 'dividend_yield'
    | 'last_synced_at'
  >
>

export type CreateSnapshotDto = Omit<PortfolioSnapshot, 'id' | 'created_at'>

export type CreateTransactionDto = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>

export type UpdateTransactionDto = Partial<
  Pick<Transaction, 'quantity' | 'price' | 'total_amount' | 'fee' | 'notes'>
>

// ============================================================================
// API Response Types (Trading212)
// ============================================================================

export type Trading212Position = {
  ticker: string
  quantity: number
  averagePrice: number
  currentPrice: number
  ppl: number
  initialFillDate: string
}

export type Trading212Cash = {
  total: number
  free: number
  ppl: number
  result: number
  invested: number
  pieCash: number
  blockedForStocks: number
}

export type Trading212Instrument = {
  ticker: string
  name: string
  type: string
  isin: string
  currencyCode: string
  workingScheduleId?: number
  addedOn?: string
  minTradeQuantity?: number
  maxOpenQuantity?: number
  shortname?: string
}

export type Trading212Transaction = {
  type: string
  dateTime: string
  ticker: string
  quantity: number
  price: number
  currency: string
  total: number
  reference: string
}

// ============================================================================
// API Response Types (Kraken)
// ============================================================================

export type KrakenBalance = Record<string, string>

export type KrakenPosition = {
  pair: string
  type: 'buy' | 'sell'
  ordertype: string
  cost: string
  fee: string
  vol: string
  margin: string
  misc: string
}

export type KrakenLedger = {
  refid: string
  time: number
  type: string
  subtype: string
  aclass: string
  asset: string
  amount: string
  fee: string
  balance: string
}

// ============================================================================
// API Response Types (Alpha Vantage)
// ============================================================================

export type AlphaVantageOverview = {
  Symbol: string
  Name: string
  Description: string
  Sector: string
  Industry: string
  MarketCapitalization: string
  PERatio: string
  DividendYield: string
  // ... more fields available
}

export type AlphaVantageQuote = {
  '01. symbol': string
  '02. open': string
  '03. high': string
  '04. low': string
  '05. price': string
  '06. volume': string
  '07. latest trading day': string
  '08. previous close': string
  '09. change': string
  '10. change percent': string
}

// ============================================================================
// Business Logic Types
// ============================================================================

export type SyncResult = {
  positionsSynced: number
  totalValue: number
  snapshotCreated: boolean
}

export type PortfolioSummary = {
  portfolio: Portfolio
  totalValue: number
  cashBalance: number
  totalCostBasis: number
  totalGainLoss: number
  totalGainLossPct: number
  positionsCount: number
  stocks: Stock[]
}

export type PositionDetails = {
  stock: Stock
  historicalPrices?: Array<{ date: string; price: number }>
  fundamentals?: {
    sector: string | null
    industry: string | null
    marketCap: number | null
    peRatio: number | null
    dividendYield: number | null
    description: string | null
  }
  news?: Array<{
    title: string
    url: string
    publishedAt: string
    source: string
  }>
}

export type PortfolioMetrics = {
  totalReturn: number
  totalReturnPct: number
  annualizedReturn: number
  irr: number
  sharpeRatio: number | null
  maxDrawdown: number | null
  volatility: number | null
  bestDay: { date: string; return: number } | null
  worstDay: { date: string; return: number } | null
}

export type CorrelationMatrix = {
  tickers: string[]
  matrix: number[][]
}

export type IndustryBreakdown = {
  breakdown: Array<{
    industry: string
    value: number
    percentage: number
    count: number
  }>
}

export type BenchmarkComparison = {
  portfolio: {
    returns: Array<{ date: string; value: number }>
    totalReturn: number
  }
  benchmarks: Array<{
    symbol: string
    name: string
    returns: Array<{ date: string; value: number }>
    totalReturn: number
  }>
}

export type NewsArticle = {
  title: string
  url: string
  publishedAt: string
  source: string
  description: string | null
  ticker: string
}

export type EnrichmentSummary = {
  tickersEnriched: number
  tickersFailed: number
  errors: Array<{ ticker: string; error: string }>
}

// ============================================================================
// Health Check Types
// ============================================================================

export type HealthCheckResult = {
  success: boolean
  message: string
  details?: {
    cashBalance?: number
    baseUrl?: string
    authenticated?: boolean
  }
  error?: string
}
