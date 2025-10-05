# Investment Portfolio Platform - Implementation Roadmap

## Project Overview

**Goal**: Build a comprehensive investment portfolio analysis platform integrating with Trading212 (stocks/ETFs) and Kraken (crypto) APIs to provide portfolio breakdown, performance tracking, and risk analysis.

**Technical Stack**:
- Frontend: Next.js 15 with React Server Components
- Backend: Next.js API routes (MVP), Appwrite serverless (Phase 2+)
- Database: Supabase PostgreSQL
- Data Sources: Trading212 API, Kraken API, Alpha Vantage API
- Visualization: Recharts/D3.js (TBD)

---

## Architecture Decisions

### Data Refresh Strategy
- **Daily Auto-Sync**: Scheduled job (Vercel Cron or Supabase Edge Function) runs at market close to capture daily snapshots
- **Manual Refresh**: User-triggered refresh button (disabled during ongoing sync)
- **Rate Limiting**: Queue system to handle API rate limits across providers
- **Stale Data Handling**: Show "Last Updated" timestamp, warn if > 24 hours old

### Computation Strategy (MVP)
- **Server-Side Rendering**: Next.js server components for data fetching
- **API Routes**: Next.js API routes for complex calculations (no serverless in MVP)
- **Database Storage**: Pre-computed metrics stored in DB for performance
- **Future Migration**: Move to Appwrite serverless functions when persisting computed metrics

### Data Storage
- **Separate Tables**: Individual tables for stocks, ETFs, crypto (different schemas)
- **Daily Snapshots**: Historical data stored daily at market close
- **Backfill Strategy**: Historical data backfilled up to 5 years (based on API availability)
- **Corporate Actions**: Use Trading212 data as source of truth, wipe affected stocks if data breaks

### Data Classification
- **Primary Source**: Trading212 API for GICS sector, exchange location
- **Fallback**: Alpha Vantage for missing sector/industry data
- **Custom Fields**: User-defined grouping/tags for personal categorization (Phase 2)
- **Geographic**: Use exchange location (primary), revenue breakdown (future if available)

---

## Feature Prioritization

### Phase 1A: MVP Foundation (Week 1-2)
**Core Functionality - Get Something Working**

#### Must-Have Features:
1. **Trading212 Integration**
   - API authentication
   - Fetch current portfolio positions (stocks/ETFs only)
   - Basic position data: ticker, quantity, current price, market value

2. **Portfolio Overview Dashboard**
   - Total portfolio value
   - Asset list with current holdings
   - Simple allocation breakdown (% by holding)

3. **Data Persistence**
   - Store portfolio snapshot in database
   - Manual refresh button (on-demand sync)
   - Last updated timestamp display

4. **Basic Visualization**
   - Treemap for allocation by holding
   - Simple table view of positions

#### Deliverables:
- ✅ Trading212 API integration working
- ✅ Portfolio data stored in Supabase
- ✅ Basic dashboard showing current holdings
- ✅ Manual refresh functionality
- ✅ Treemap visualization

#### Success Criteria:
- Can view current portfolio value
- Can see breakdown of holdings
- Data refreshes on button click
- Historical snapshot stored for future comparison

---

### Phase 1B: Core Analysis (Week 3-4)
**Add Basic Analytics**

#### Must-Have Features:
1. **Historical Tracking**
   - Daily snapshots (manual trigger for MVP)
   - Portfolio value over time (line chart)
   - Simple P&L calculation (current value - cost basis)

2. **Geographic & Sector Breakdown**
   - Country allocation (from exchange location)
   - Sector allocation (from Trading212/Alpha Vantage)
   - Pie charts and bar charts

3. **Performance Metrics (Basic)**
   - Total return % (simple calculation)
   - Daily/Weekly/Monthly/All-time P&L
   - Gain/Loss per holding

4. **Kraken Integration (Crypto)**
   - Fetch crypto positions
   - Separate crypto view/breakdown
   - Combined portfolio value (stocks + crypto)

#### Deliverables:
- ✅ Historical data tracking (daily snapshots)
- ✅ Geographic and sector breakdowns
- ✅ Simple performance metrics
- ✅ Kraken API integration
- ✅ Combined portfolio view

#### Success Criteria:
- Can view portfolio performance over time
- Can see allocation by country and sector
- Crypto positions integrated
- Basic P&L tracking working

---

### Phase 2A: Advanced Analytics (Week 5-6)
**Deep Analysis & Risk Metrics**

#### Must-Have Features:
1. **Performance Metrics (Advanced)**
   - Time-Weighted Return (TWR)
   - Internal Rate of Return (IRR) - requires cash flow tracking
   - Benchmark comparison (S&P 500, MSCI World)
   - Beta calculation vs. S&P 500 and MSCI World

2. **Risk Metrics**
   - Portfolio volatility (standard deviation)
   - Sharpe ratio
   - Value at Risk (VaR) - 95% confidence
   - Correlation matrix (holdings vs. holdings)

3. **Industry-Level Classification**
   - Sub-industry breakdown (from GICS)
   - Industry performance comparison
   - Waterfall chart for attribution

4. **Dashboard Enhancement**
   - Tabbed sections (Overview, Analysis, Performance, Risk)
   - Hero chart: Overall gain/loss line with TWR/IRR
   - Mobile-responsive design (mobile-first)

#### Deliverables:
- ✅ TWR/IRR calculations
- ✅ Benchmark integration (S&P 500, MSCI World)
- ✅ Risk metrics (volatility, Sharpe, beta, VaR)
- ✅ Industry-level analysis
- ✅ Advanced visualizations (waterfall, heatmap)

#### Success Criteria:
- Can compare portfolio performance to benchmarks
- Risk metrics accurately calculated
- Industry attribution working
- Dashboard fully responsive on mobile

---

### Phase 2B: Market Data & Research (Week 7-8)
**External Data Integration**

#### Must-Have Features:
1. **Alpha Vantage Integration**
   - Real-time (15-min delayed) price data
   - Fundamental data (P/E, P/B, dividend yield)
   - Company overview data

2. **News & Research**
   - News aggregation for holdings
   - Analyst ratings (if available from Alpha Vantage)
   - Price targets (if available)

3. **Watchlist**
   - Add tickers to watchlist
   - View watchlist performance
   - Compare watchlist vs. portfolio

4. **Transaction History**
   - Import transactions from Trading212/Kraken
   - Manual transaction entry (backup)
   - Cash flow tracking for accurate IRR

#### Deliverables:
- ✅ Alpha Vantage API integration
- ✅ Fundamental data display
- ✅ News aggregation
- ✅ Watchlist functionality
- ✅ Transaction history tracking

#### Success Criteria:
- Market data supplements Trading212/Kraken data
- News shows for each holding
- Watchlist tracks potential investments
- Transaction history enables accurate IRR

---

### Phase 3: Automation & Intelligence (Week 9-12)
**Advanced Features & AI**

#### Features:
1. **Daily Auto-Sync**
   - Vercel Cron job (or Supabase Edge Function)
   - Scheduled daily refresh at market close
   - Error handling and retry logic

2. **Appwrite Serverless Migration**
   - Move complex calculations to serverless functions
   - Portfolio optimization algorithms
   - Batch processing for historical backfill

3. **AI-Powered Insights** (Future)
   - Daily portfolio summary (GPT-4)
   - Anomaly detection (unusual holdings performance)
   - Rebalancing suggestions

4. **Alerts & Notifications** (Future)
   - Price alerts
   - Portfolio milestone alerts (e.g., crossed $X value)
   - Unusual volatility alerts

#### Deliverables:
- ✅ Automated daily sync
- ✅ Serverless functions for calculations
- ✅ AI insights (if budget allows)
- ✅ Alert system

#### Success Criteria:
- Portfolio updates automatically daily
- Serverless functions handle heavy computation
- AI provides actionable insights

---

## Database Schema

### Core Tables

#### `portfolios`
Main portfolio container (single portfolio for MVP, extensible for multiple)

```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL DEFAULT 'Main Portfolio',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `portfolio_snapshots`
Daily portfolio snapshots for historical tracking

```sql
CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_value DECIMAL(15,2) NOT NULL,
  total_cost_basis DECIMAL(15,2),
  total_gain_loss DECIMAL(15,2),
  total_return_pct DECIMAL(8,4),
  snapshot_type TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, snapshot_date, snapshot_type)
);

CREATE INDEX idx_snapshots_portfolio_date ON portfolio_snapshots(portfolio_id, snapshot_date DESC);
```

#### `stocks` (Trading212 stocks/ETFs)
Stock and ETF positions

```sql
CREATE TABLE stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'stock', 'etf'
  quantity DECIMAL(15,6) NOT NULL,
  average_cost DECIMAL(12,4), -- cost basis per share
  current_price DECIMAL(12,4),
  market_value DECIMAL(15,2),
  gain_loss DECIMAL(15,2),
  gain_loss_pct DECIMAL(8,4),

  -- Classification data
  exchange TEXT, -- 'NYSE', 'NASDAQ', 'LSE', etc.
  country TEXT, -- derived from exchange
  region TEXT, -- 'North America', 'Europe', 'Asia'
  sector TEXT, -- GICS sector
  industry TEXT, -- GICS industry (Phase 2)

  -- Custom fields (Phase 2)
  custom_tags TEXT[], -- user-defined tags
  custom_group TEXT, -- user-defined grouping

  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(portfolio_id, ticker)
);

CREATE INDEX idx_stocks_portfolio ON stocks(portfolio_id);
CREATE INDEX idx_stocks_sector ON stocks(sector);
CREATE INDEX idx_stocks_country ON stocks(country);
```

#### `stock_history`
Historical data for individual stocks

```sql
CREATE TABLE stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  quantity DECIMAL(15,6) NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  market_value DECIMAL(15,2) NOT NULL,
  gain_loss DECIMAL(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(stock_id, snapshot_date)
);

CREATE INDEX idx_stock_history_stock_date ON stock_history(stock_id, snapshot_date DESC);
```

#### `crypto` (Kraken crypto)
Cryptocurrency positions

```sql
CREATE TABLE crypto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL, -- 'BTC', 'ETH', etc.
  name TEXT NOT NULL, -- 'Bitcoin', 'Ethereum'
  quantity DECIMAL(18,8) NOT NULL,
  average_cost DECIMAL(12,4),
  current_price DECIMAL(12,4),
  market_value DECIMAL(15,2),
  gain_loss DECIMAL(15,2),
  gain_loss_pct DECIMAL(8,4),

  -- Custom fields (Phase 2)
  custom_tags TEXT[],
  custom_group TEXT,

  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(portfolio_id, symbol)
);

CREATE INDEX idx_crypto_portfolio ON crypto(portfolio_id);
```

#### `crypto_history`
Historical data for crypto

```sql
CREATE TABLE crypto_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crypto_id UUID NOT NULL REFERENCES crypto(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  quantity DECIMAL(18,8) NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  market_value DECIMAL(15,2) NOT NULL,
  gain_loss DECIMAL(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(crypto_id, snapshot_date)
);

CREATE INDEX idx_crypto_history_crypto_date ON crypto_history(crypto_id, snapshot_date DESC);
```

#### `transactions` (Phase 2B)
Cash flow tracking for IRR calculation

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL, -- 'buy', 'sell', 'deposit', 'withdrawal', 'dividend'
  asset_type TEXT NOT NULL, -- 'stock', 'crypto', 'cash'
  ticker TEXT, -- for stocks/crypto
  quantity DECIMAL(18,8),
  price DECIMAL(12,4),
  amount DECIMAL(15,2) NOT NULL, -- total transaction value
  fees DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  source TEXT, -- 'trading212', 'kraken', 'manual'
  external_id TEXT, -- ID from external API
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_portfolio_date ON transactions(portfolio_id, transaction_date DESC);
CREATE INDEX idx_transactions_ticker ON transactions(ticker);
```

#### `watchlist` (Phase 2B)
Watchlist for potential investments

```sql
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'stock', 'etf', 'crypto'
  notes TEXT,
  target_price DECIMAL(12,4),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, ticker)
);

CREATE INDEX idx_watchlist_user ON watchlist(user_id);
```

#### `market_data` (Phase 2B)
Cached market data from Alpha Vantage

```sql
CREATE TABLE market_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT NOT NULL,
  data_type TEXT NOT NULL, -- 'quote', 'fundamental', 'news'
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  UNIQUE(ticker, data_type)
);

CREATE INDEX idx_market_data_ticker ON market_data(ticker);
CREATE INDEX idx_market_data_expires ON market_data(expires_at);
```

#### `sync_logs` (Error Tracking)
Track API sync status and errors

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'manual', 'scheduled'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed', 'partial'
  source TEXT NOT NULL, -- 'trading212', 'kraken', 'alpha_vantage'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0
);

CREATE INDEX idx_sync_logs_portfolio ON sync_logs(portfolio_id, started_at DESC);
```

---

## API Integration Strategy

### Trading212 API

**Endpoints Needed**:
- `GET /api/v0/equity/portfolio` - Get current positions
- `GET /api/v0/equity/account/cash` - Get cash balance
- `GET /api/v0/equity/orders` - Get order history (for transactions - Phase 2)
- `GET /api/v0/equity/history` - Get historical data (if available)

**Rate Limits**: TBD (check docs during implementation)

**Authentication**: API Key (stored in env variables)

**Data Mapping**:
```typescript
Trading212Position {
  ticker: string          → stocks.ticker
  quantity: number        → stocks.quantity
  averagePrice: number    → stocks.average_cost
  currentPrice: number    → stocks.current_price
  ppl: number            → stocks.gain_loss (profit/loss)
  pplPercent: number     → stocks.gain_loss_pct
}
```

**Sector/Industry Data**:
- Check if Trading212 provides GICS classification
- Fallback to Alpha Vantage if missing

### Kraken API

**Endpoints Needed**:
- `POST /0/private/Balance` - Get crypto balances
- `POST /0/private/TradeBalance` - Get total portfolio value
- `POST /0/private/Ledgers` - Get transaction history (Phase 2)
- `GET /0/public/Ticker` - Get current prices

**Rate Limits**: TBD (check docs during implementation)

**Authentication**: API Key + Secret (stored in env variables)

**Data Mapping**:
```typescript
KrakenBalance {
  asset: string          → crypto.symbol
  balance: number        → crypto.quantity
  // Price from separate Ticker call
}
```

### Alpha Vantage API

**Endpoints Needed**:
- `TIME_SERIES_DAILY` - Historical price data (backfill)
- `GLOBAL_QUOTE` - Real-time quotes (15-min delayed)
- `OVERVIEW` - Company fundamentals (P/E, sector, industry)
- `NEWS_SENTIMENT` - News articles (Phase 2B)

**Rate Limits**:
- Free tier: 500 requests/day, 5 requests/minute
- Premium data: 25 requests/day

**Strategy**:
- Cache aggressively (use `market_data` table)
- Batch requests for multiple tickers
- Prioritize critical data (price > news)

**Data Mapping**:
```typescript
AlphaVantageOverview {
  Symbol: string           → stocks.ticker
  Sector: string           → stocks.sector
  Industry: string         → stocks.industry
  Exchange: string         → stocks.exchange
  PERatio: number          → market_data (fundamental)
  DividendYield: number    → market_data (fundamental)
}
```

### Benchmark Data (S&P 500, MSCI World)

**Source**: Alpha Vantage
- S&P 500: `^GSPC` or `SPY` ETF
- MSCI World: `URTH` ETF (iShares MSCI World)

**Strategy**:
- Fetch daily closing prices
- Store in `market_data` table with `data_type: 'benchmark'`
- Calculate portfolio beta vs. benchmark

---

## API Routes Structure

### Portfolio Data Routes

```
POST   /api/portfolio/sync              # Manual refresh trigger
GET    /api/portfolio                   # Get current portfolio summary
GET    /api/portfolio/history           # Get historical snapshots
GET    /api/portfolio/breakdown         # Get allocation breakdown
```

### Trading212 Routes

```
POST   /api/integrations/trading212/sync     # Fetch & sync Trading212 data
GET    /api/integrations/trading212/status   # Check connection status
POST   /api/integrations/trading212/backfill # Backfill historical data
```

### Kraken Routes

```
POST   /api/integrations/kraken/sync     # Fetch & sync Kraken data
GET    /api/integrations/kraken/status   # Check connection status
POST   /api/integrations/kraken/backfill # Backfill historical data
```

### Analytics Routes (Phase 2A)

```
GET    /api/analytics/performance        # TWR, IRR, benchmarks
GET    /api/analytics/risk               # Volatility, Sharpe, beta, VaR
GET    /api/analytics/attribution        # Sector/country/holding attribution
GET    /api/analytics/correlation        # Correlation matrix
```

### Market Data Routes (Phase 2B)

```
GET    /api/market-data/:ticker          # Get cached market data
POST   /api/market-data/refresh          # Refresh market data for ticker
GET    /api/market-data/news/:ticker     # Get news for ticker
```

### Watchlist Routes (Phase 2B)

```
GET    /api/watchlist                    # Get user's watchlist
POST   /api/watchlist                    # Add to watchlist
DELETE /api/watchlist/:id                # Remove from watchlist
```

---

## Visualization Components

### Phase 1A (MVP)
1. **Treemap** - Allocation by holding
   - Library: Recharts or Nivo
   - Data: Current positions with market value
   - Interaction: Click to see holding details

2. **Table** - Position list
   - Sortable columns (ticker, value, gain/loss, %)
   - Mobile-responsive (horizontal scroll or cards)

### Phase 1B (Core Analysis)
3. **Line Chart** - Portfolio value over time
   - Library: Recharts
   - Data: `portfolio_snapshots.total_value` by date
   - Y-axis: Portfolio value, X-axis: Date

4. **Pie Chart** - Sector/Country allocation
   - Data: Grouped by sector or country
   - Show percentage labels

5. **Bar Chart** - Comparative analysis
   - Compare sectors, countries, or holdings
   - Horizontal bars for mobile-friendliness

### Phase 2A (Advanced Analytics)
6. **Waterfall Chart** - Performance attribution
   - Library: Recharts (custom waterfall)
   - Show contribution by sector/holding to total return

7. **Heatmap** - Correlation matrix
   - Library: Nivo or custom D3.js
   - Show correlation between holdings

8. **Dual-Axis Line Chart** - Portfolio vs. Benchmark
   - Left Y-axis: Portfolio value
   - Right Y-axis: Benchmark index value
   - Overlay TWR/IRR lines

### Phase 2B (Market Data)
9. **Candlestick Chart** - Individual holding price history (optional)
   - Library: Lightweight Charts (TradingView)
   - Phase 3 feature

---

## Mobile-First Design Considerations

### Layout Strategy
- **Mobile (< 768px)**:
  - Single column layout
  - Stacked cards for metrics
  - Horizontal scroll for tables (or card view)
  - Bottom navigation tabs (Overview, Analysis, Performance, etc.)

- **Tablet (768px - 1024px)**:
  - Two-column grid
  - Side navigation (collapsible)
  - Charts resize to 50% width

- **Desktop (> 1024px)**:
  - Three-column grid (sidebar, main, details)
  - Fixed sidebar navigation
  - Full-width hero chart

### Touch Interactions (Phase 2+)
- Swipe between tabs
- Pinch-to-zoom on charts (Phase 3)
- Pull-to-refresh (nice-to-have)

### Performance Optimization
- Lazy load charts (render on scroll)
- Virtualize long lists (React Virtualized)
- Server-side render initial data
- Client-side hydration for interactivity

---

## Error Handling Strategy

### API Errors

**Trading212/Kraken API Failures**:
1. Log error to `sync_logs` table
2. Show user-friendly error message: "Unable to sync portfolio. Showing last known data."
3. Display last successful sync timestamp
4. Retry logic: 3 attempts with exponential backoff
5. Partial success: Sync what's available, log failed tickers

**Alpha Vantage Rate Limit**:
1. Queue requests (FIFO)
2. Respect rate limit (5 req/min)
3. Cache aggressively (24-hour TTL for fundamentals)
4. Degrade gracefully: Show "Data unavailable" for missing info

### Data Integrity

**Corporate Actions (Splits, Mergers)**:
- Detect anomalies: > 50% price change or quantity change from Trading212
- Log warning in `sync_logs`
- Option 1: Auto-adjust historical data (risky)
- Option 2: Wipe historical data for affected ticker (user's preference)
- Notify user: "Corporate action detected for [TICKER]. Historical data reset."

**Stale Data**:
- If `last_synced_at` > 24 hours: Show warning banner
- If `last_synced_at` > 7 days: Disable analytics (unreliable calculations)
- Force refresh button always available

### User Notifications

**Sync Status**:
- ✅ Success: "Portfolio synced successfully (12:34 PM)"
- ⚠️ Partial: "Portfolio partially synced. 3 holdings failed."
- ❌ Failed: "Sync failed. Check API credentials."
- 🔄 In Progress: Disable refresh button, show spinner

---

## Performance Considerations

### Database Optimization
- **Indexes**: Created on frequently queried columns (portfolio_id, date, ticker)
- **Partitioning** (Phase 3): Partition `stock_history` and `crypto_history` by date (yearly partitions)
- **Archival** (Phase 3): Archive data older than 10 years to cold storage

### Query Optimization
- Use `SELECT DISTINCT ON` for latest snapshots
- Aggregate calculations in SQL (SUM, AVG) vs. client-side
- Materialized views for complex analytics (Phase 2+)

### Caching Strategy
- **Server-Side**: Next.js `revalidate` for portfolio data (5-minute cache)
- **Client-Side**: React Query with 5-minute stale time
- **API Cache**: `market_data` table with TTL (1 day for fundamentals, 15 min for quotes)

### Bundle Size
- Code split by route (automatic with Next.js App Router)
- Lazy load chart libraries (dynamic import)
- Tree-shake unused utilities

---

## Testing Strategy

### Unit Tests (Vitest)
- Validation schemas (Zod)
- Calculation functions (TWR, IRR, Sharpe, beta)
- Data transformation utilities
- Target: 80% coverage for critical paths

### Integration Tests (Phase 2)
- API routes (portfolio sync, analytics)
- Database operations (CRUD)
- External API mocking (MSW - Mock Service Worker)

### E2E Tests (Phase 3)
- Playwright for critical user flows
- Portfolio sync → View dashboard → Refresh → View analytics
- Run on CI/CD (GitHub Actions)

---

## Security & Privacy

### API Key Management
- Store in environment variables (Vercel)
- Never expose in client-side code
- Rotate keys periodically (manual for MVP)

### Data Privacy
- Single-user authentication (already implemented)
- No public portfolio sharing (MVP)
- HTTPS only (enforced by Vercel)

### Rate Limiting (Phase 2)
- Prevent abuse of manual refresh
- Max 10 refreshes per hour per user
- Implement in Next.js middleware

---

## Development Workflow

### Phase 1A Sprint Plan (Week 1-2)

**Week 1: Trading212 Integration**
- [ ] Set up Trading212 API credentials
- [ ] Create `/api/integrations/trading212/sync` route
- [ ] Implement data fetching from Trading212
- [ ] Create database migration for `portfolios`, `stocks`, `portfolio_snapshots`
- [ ] Store portfolio data in Supabase
- [ ] Unit tests for data transformation

**Week 2: Dashboard & Visualization**
- [ ] Create `/dashboard/portfolio` page
- [ ] Build portfolio overview component (total value, positions)
- [ ] Implement treemap visualization
- [ ] Add manual refresh button
- [ ] Show last updated timestamp
- [ ] Mobile-responsive layout

**Deliverable**: Working Trading212 integration with basic dashboard

---

### Phase 1B Sprint Plan (Week 3-4)

**Week 3: Historical Data & Kraken**
- [ ] Implement daily snapshot storage
- [ ] Create line chart for portfolio value over time
- [ ] Add Kraken API integration
- [ ] Create `crypto` and `crypto_history` tables
- [ ] Combine stocks + crypto in portfolio view

**Week 4: Breakdowns & Analytics**
- [ ] Implement sector/country breakdown logic
- [ ] Create pie charts for allocation
- [ ] Add simple P&L calculation
- [ ] Build tabbed dashboard (Overview, Analysis tabs)
- [ ] Alpha Vantage integration (sector data fallback)

**Deliverable**: Historical tracking + Kraken integration + basic analytics

---

### Phase 2A Sprint Plan (Week 5-6)

**Week 5: Advanced Metrics**
- [ ] Implement TWR calculation
- [ ] Implement IRR calculation (requires cash flow tracking)
- [ ] Add benchmark data fetching (S&P 500, MSCI World)
- [ ] Calculate beta vs. benchmarks
- [ ] Portfolio volatility (standard deviation)

**Week 6: Risk Analytics**
- [ ] Sharpe ratio calculation
- [ ] Value at Risk (VaR) implementation
- [ ] Correlation matrix calculation
- [ ] Waterfall chart for attribution
- [ ] Heatmap visualization

**Deliverable**: Complete analytics dashboard with risk metrics

---

### Phase 2B Sprint Plan (Week 7-8)

**Week 7: Market Data**
- [ ] Alpha Vantage full integration (quotes, fundamentals)
- [ ] Create `market_data` caching table
- [ ] Fundamental data display (P/E, dividend yield)
- [ ] News aggregation for holdings

**Week 8: Watchlist & Transactions**
- [ ] Build watchlist feature
- [ ] Transaction history import from Trading212/Kraken
- [ ] Manual transaction entry form
- [ ] Cash flow tracking for IRR

**Deliverable**: Market research capabilities + transaction tracking

---

### Phase 3 Sprint Plan (Week 9-12)

**Week 9-10: Automation**
- [ ] Vercel Cron job for daily sync (or Supabase Edge Function)
- [ ] Error handling and retry logic
- [ ] Email notifications for sync failures (optional)
- [ ] Appwrite serverless function setup

**Week 11: Serverless Migration**
- [ ] Move TWR/IRR calculations to Appwrite
- [ ] Move risk metric calculations to serverless
- [ ] Batch processing for historical backfill

**Week 12: AI & Future Features**
- [ ] OpenAI API integration (if budget allows)
- [ ] Daily portfolio summary generation
- [ ] Anomaly detection
- [ ] Alert system (price alerts, milestones)

**Deliverable**: Fully automated platform with AI insights

---

## Environment Variables

### Required for MVP (Phase 1A)

```env
# Trading212 API
TRADING212_API_KEY=your_api_key_here
TRADING212_API_URL=https://live.trading212.com  # or demo URL

# Kraken API (Phase 1B)
KRAKEN_API_KEY=your_api_key_here
KRAKEN_API_SECRET=your_api_secret_here
KRAKEN_API_URL=https://api.kraken.com

# Alpha Vantage (Phase 1B)
ALPHA_VANTAGE_API_KEY=your_api_key_here

# Supabase (already set up)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Session (already set up)
SESSION_SECRET=your_secret_key_here

# Appwrite (Phase 3)
APPWRITE_ENDPOINT=your_appwrite_endpoint
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
```

---

## Risk Mitigation

### Technical Risks

**Risk**: API rate limits causing sync failures
- **Mitigation**: Queue system, aggressive caching, backoff strategy

**Risk**: Alpha Vantage free tier insufficient
- **Mitigation**: Prioritize critical data, consider paid tier ($50/mo for 1200 req/min)

**Risk**: Historical data backfill unavailable
- **Mitigation**: Start tracking from now, manual CSV import as fallback

**Risk**: Corporate actions breaking historical data
- **Mitigation**: Wipe data for affected ticker (user's preference), log for review

### Data Quality Risks

**Risk**: Exchange location insufficient for geographic breakdown
- **Mitigation**: Use revenue breakdown if available, manual mapping for edge cases

**Risk**: GICS sector data missing for some tickers
- **Mitigation**: Alpha Vantage fallback, allow manual sector assignment

**Risk**: IRR calculation inaccurate without transaction history
- **Mitigation**: Phase 2B addresses this, use simple return for MVP

---

## Success Metrics

### Phase 1A (MVP)
- ✅ Portfolio data syncs successfully from Trading212
- ✅ Dashboard displays current holdings
- ✅ Manual refresh works without errors
- ✅ Treemap visualization renders correctly
- ✅ Mobile-responsive design passes manual testing

### Phase 1B (Core Analysis)
- ✅ Daily snapshots stored correctly
- ✅ Line chart shows portfolio value over time
- ✅ Kraken integration fetches crypto data
- ✅ Sector/country breakdowns are accurate
- ✅ P&L calculation matches Trading212

### Phase 2A (Advanced Analytics)
- ✅ TWR/IRR calculations within 0.1% of manual calculation
- ✅ Beta vs. S&P 500 accurate (verify against Bloomberg)
- ✅ Sharpe ratio calculated correctly
- ✅ Correlation matrix visually clear

### Phase 2B (Market Data)
- ✅ News shows for all holdings
- ✅ Fundamental data displays (P/E, dividend yield)
- ✅ Watchlist tracks 10+ tickers
- ✅ Transaction history imports successfully

### Phase 3 (Automation)
- ✅ Daily sync runs at scheduled time (99% uptime)
- ✅ Error rate < 5% for API calls
- ✅ AI insights generated daily (if implemented)

---

## Next Steps - Immediate Actions

### Before Starting Development:

1. **API Access Verification**
   - [ ] Confirm Trading212 API key works (test in Postman)
   - [ ] Confirm Kraken API key works
   - [ ] Sign up for Alpha Vantage API key
   - [ ] Document actual rate limits from API docs

2. **Database Setup**
   - [ ] Create Supabase migration for Phase 1A tables
   - [ ] Test connection from Next.js

3. **Development Environment**
   - [ ] Add environment variables to `.env.local`
   - [ ] Add to Vercel project settings (for deployment)

4. **Tooling Decisions**
   - [ ] Choose chart library: Recharts vs. Nivo (recommend Recharts for simplicity)
   - [ ] Set up API route structure

---

## Questions to Resolve Before Starting

1. **Trading212 API**:
   - Does the API provide historical data, or only current positions?
   - Is sector/industry data included in the response?

2. **Kraken API**:
   - Can we get historical balances, or only current?
   - What's the actual rate limit?

3. **Alpha Vantage**:
   - Confirm 500 req/day is sufficient for daily sync + on-demand
   - Test fundamental data availability for UK/EU stocks

4. **Backfill Strategy**:
   - If APIs don't provide historical data, how to backfill 5 years?
   - Accept starting from today, or find alternative data source (CSV import)?

---

## Conclusion

This roadmap provides a **phased approach** to building a comprehensive investment portfolio platform, starting with a minimal MVP (Phase 1A) that delivers immediate value, then progressively adding advanced analytics and automation.

**Key Principles**:
- ✅ Start simple: Current portfolio value + allocation breakdown
- ✅ Iterate quickly: 2-week sprints with deployable increments
- ✅ User-driven: Prioritize features based on actual usage
- ✅ Data-first: Historical tracking from day 1 for future analysis
- ✅ Mobile-first: Responsive design throughout

**Estimated Timeline**:
- **Phase 1A (MVP)**: 2 weeks → Usable portfolio tracker
- **Phase 1B (Core)**: 2 weeks → Historical data + analytics
- **Phase 2A (Advanced)**: 2 weeks → Risk metrics + benchmarking
- **Phase 2B (Market Data)**: 2 weeks → Research + transactions
- **Phase 3 (Automation)**: 4 weeks → AI + automation

**Total**: 12 weeks to full-featured platform

Ready to start with **Phase 1A - Week 1: Trading212 Integration**? 🚀
