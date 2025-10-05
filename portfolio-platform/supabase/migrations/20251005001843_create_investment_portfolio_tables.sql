-- Investment Portfolio Platform - Phase 1A Tables
-- Creates core tables for portfolio tracking and stock positions

-- ============================================
-- PORTFOLIOS TABLE
-- ============================================
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Portfolio',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_portfolios_user_id ON public.portfolios(user_id);

-- Comments
COMMENT ON TABLE public.portfolios IS 'Portfolio containers for organizing investment holdings';
COMMENT ON COLUMN public.portfolios.user_id IS 'Owner of the portfolio';
COMMENT ON COLUMN public.portfolios.name IS 'Display name for the portfolio';

-- Trigger for updated_at
CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STOCKS TABLE (Trading212 stocks/ETFs)
-- ============================================
CREATE TABLE public.stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,

  -- Core position data
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf')),
  isin TEXT, -- International Securities Identification Number
  currency TEXT, -- e.g., 'USD', 'GBP', 'EUR'

  -- Position details
  quantity NUMERIC(15,6) NOT NULL CHECK (quantity >= 0),
  average_cost NUMERIC(12,4) CHECK (average_cost >= 0), -- cost basis per share
  current_price NUMERIC(12,4) CHECK (current_price >= 0),
  market_value NUMERIC(15,2) GENERATED ALWAYS AS (quantity * current_price) STORED,

  -- Profit/Loss (calculated from Trading212 or computed)
  gain_loss NUMERIC(15,2),
  gain_loss_pct NUMERIC(8,4),

  -- Classification data (from Trading212 or Alpha Vantage)
  exchange TEXT, -- 'NYSE', 'NASDAQ', 'LSE', etc.
  country TEXT, -- derived from exchange
  region TEXT, -- 'North America', 'Europe', 'Asia-Pacific'
  sector TEXT, -- GICS sector
  industry TEXT, -- GICS industry (Phase 2)

  -- Custom user fields (Phase 2)
  custom_tags TEXT[],
  custom_group TEXT,

  -- Metadata
  initial_fill_date TIMESTAMPTZ, -- when position was first opened
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(portfolio_id, ticker)
);

-- Indexes for performance
CREATE INDEX idx_stocks_portfolio_id ON public.stocks(portfolio_id);
CREATE INDEX idx_stocks_ticker ON public.stocks(ticker);
CREATE INDEX idx_stocks_sector ON public.stocks(sector);
CREATE INDEX idx_stocks_country ON public.stocks(country);
CREATE INDEX idx_stocks_asset_type ON public.stocks(asset_type);
CREATE INDEX idx_stocks_last_synced ON public.stocks(last_synced_at DESC);

-- Comments
COMMENT ON TABLE public.stocks IS 'Stock and ETF positions from Trading212';
COMMENT ON COLUMN public.stocks.ticker IS 'Stock ticker symbol (e.g., AAPL_US_EQ from Trading212)';
COMMENT ON COLUMN public.stocks.isin IS 'International Securities Identification Number';
COMMENT ON COLUMN public.stocks.quantity IS 'Number of shares held';
COMMENT ON COLUMN public.stocks.average_cost IS 'Average cost per share (cost basis)';
COMMENT ON COLUMN public.stocks.market_value IS 'Current market value (quantity × current_price)';
COMMENT ON COLUMN public.stocks.gain_loss IS 'Unrealized profit/loss in currency';
COMMENT ON COLUMN public.stocks.gain_loss_pct IS 'Unrealized profit/loss as percentage';

-- Trigger for updated_at
CREATE TRIGGER update_stocks_updated_at
  BEFORE UPDATE ON public.stocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STOCK HISTORY TABLE
-- ============================================
CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,

  -- Historical snapshot data
  quantity NUMERIC(15,6) NOT NULL,
  price NUMERIC(12,4) NOT NULL,
  market_value NUMERIC(15,2) NOT NULL,
  gain_loss NUMERIC(15,2),
  gain_loss_pct NUMERIC(8,4),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(stock_id, snapshot_date)
);

-- Indexes for performance
CREATE INDEX idx_stock_history_stock_id ON public.stock_history(stock_id);
CREATE INDEX idx_stock_history_snapshot_date ON public.stock_history(snapshot_date DESC);
CREATE INDEX idx_stock_history_stock_date ON public.stock_history(stock_id, snapshot_date DESC);

-- Comments
COMMENT ON TABLE public.stock_history IS 'Daily historical snapshots of stock positions for trend analysis';
COMMENT ON COLUMN public.stock_history.stock_id IS 'Reference to the stock position';
COMMENT ON COLUMN public.stock_history.snapshot_date IS 'Date of the snapshot';
COMMENT ON COLUMN public.stock_history.market_value IS 'Market value at snapshot time';

-- ============================================
-- PORTFOLIO SNAPSHOTS TABLE
-- ============================================
CREATE TABLE public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,

  -- Portfolio-level metrics
  total_value NUMERIC(15,2) NOT NULL,
  total_cost_basis NUMERIC(15,2),
  total_gain_loss NUMERIC(15,2),
  total_return_pct NUMERIC(8,4),

  -- Cash balance (if available)
  cash_balance NUMERIC(15,2),

  -- Snapshot metadata
  snapshot_type TEXT NOT NULL DEFAULT 'daily' CHECK (snapshot_type IN ('daily', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(portfolio_id, snapshot_date, snapshot_type)
);

-- Indexes for performance
CREATE INDEX idx_portfolio_snapshots_portfolio_id ON public.portfolio_snapshots(portfolio_id);
CREATE INDEX idx_portfolio_snapshots_date ON public.portfolio_snapshots(snapshot_date DESC);
CREATE INDEX idx_portfolio_snapshots_portfolio_date ON public.portfolio_snapshots(portfolio_id, snapshot_date DESC);

-- Comments
COMMENT ON TABLE public.portfolio_snapshots IS 'Daily snapshots of overall portfolio value and performance';
COMMENT ON COLUMN public.portfolio_snapshots.total_value IS 'Total portfolio value including all positions';
COMMENT ON COLUMN public.portfolio_snapshots.total_cost_basis IS 'Total cost basis (invested amount)';
COMMENT ON COLUMN public.portfolio_snapshots.snapshot_type IS 'Type of snapshot: daily (automated) or manual (user-triggered)';

-- ============================================
-- SYNC LOGS TABLE (Error tracking)
-- ============================================
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,

  -- Sync metadata
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'partial')),
  source TEXT NOT NULL CHECK (source IN ('trading212', 'kraken', 'alpha_vantage')),

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Results
  error_message TEXT,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sync_logs_portfolio_id ON public.sync_logs(portfolio_id);
CREATE INDEX idx_sync_logs_started_at ON public.sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON public.sync_logs(status);

-- Comments
COMMENT ON TABLE public.sync_logs IS 'Tracks API sync operations and errors for debugging';
COMMENT ON COLUMN public.sync_logs.sync_type IS 'Whether sync was triggered manually or by schedule';
COMMENT ON COLUMN public.sync_logs.status IS 'Current status of the sync operation';
COMMENT ON COLUMN public.sync_logs.source IS 'Which API was being synced';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Portfolios policies
CREATE POLICY "Users can view own portfolios"
  ON public.portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios"
  ON public.portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios"
  ON public.portfolios FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolios"
  ON public.portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- Stocks policies (via portfolio ownership)
CREATE POLICY "Users can view own stocks"
  ON public.stocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = stocks.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own stocks"
  ON public.stocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = stocks.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own stocks"
  ON public.stocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = stocks.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own stocks"
  ON public.stocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = stocks.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Stock history policies (via stock ownership)
CREATE POLICY "Users can view own stock history"
  ON public.stock_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stocks
      JOIN public.portfolios ON portfolios.id = stocks.portfolio_id
      WHERE stocks.id = stock_history.stock_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own stock history"
  ON public.stock_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stocks
      JOIN public.portfolios ON portfolios.id = stocks.portfolio_id
      WHERE stocks.id = stock_history.stock_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Portfolio snapshots policies
CREATE POLICY "Users can view own snapshots"
  ON public.portfolio_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = portfolio_snapshots.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own snapshots"
  ON public.portfolio_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = portfolio_snapshots.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Sync logs policies
CREATE POLICY "Users can view own sync logs"
  ON public.sync_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = sync_logs.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own sync logs"
  ON public.sync_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = sync_logs.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );
