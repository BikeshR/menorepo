-- Investment Portfolio Platform - Phase 1B: Crypto Integration
-- Creates tables for tracking cryptocurrency holdings from Kraken

-- ============================================
-- CRYPTO TABLE (Kraken cryptocurrencies)
-- ============================================
CREATE TABLE public.crypto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,

  -- Core position data
  asset_code TEXT NOT NULL, -- Kraken asset code (e.g., 'XXBT', 'XETH')
  symbol TEXT NOT NULL, -- Normalized symbol (e.g., 'BTC', 'ETH')
  name TEXT, -- Full name (e.g., 'Bitcoin', 'Ethereum')

  -- Position details
  quantity NUMERIC(18,10) NOT NULL CHECK (quantity >= 0), -- Crypto can have many decimals
  average_cost NUMERIC(12,4) CHECK (average_cost >= 0), -- USD cost basis per unit
  current_price NUMERIC(12,4) CHECK (current_price >= 0), -- Current USD price
  market_value NUMERIC(15,2) GENERATED ALWAYS AS (quantity * current_price) STORED,

  -- Profit/Loss
  gain_loss NUMERIC(15,2),
  gain_loss_pct NUMERIC(8,4),

  -- Metadata
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(portfolio_id, asset_code)
);

-- Indexes for performance
CREATE INDEX idx_crypto_portfolio_id ON public.crypto(portfolio_id);
CREATE INDEX idx_crypto_symbol ON public.crypto(symbol);
CREATE INDEX idx_crypto_last_synced ON public.crypto(last_synced_at DESC);

-- Comments
COMMENT ON TABLE public.crypto IS 'Cryptocurrency positions from Kraken';
COMMENT ON COLUMN public.crypto.asset_code IS 'Kraken asset code (e.g., XXBT for Bitcoin)';
COMMENT ON COLUMN public.crypto.symbol IS 'Normalized symbol (e.g., BTC)';
COMMENT ON COLUMN public.crypto.quantity IS 'Amount of crypto held';
COMMENT ON COLUMN public.crypto.average_cost IS 'Average cost per unit in USD';
COMMENT ON COLUMN public.crypto.market_value IS 'Current market value (quantity × current_price)';

-- Trigger for updated_at
CREATE TRIGGER update_crypto_updated_at
  BEFORE UPDATE ON public.crypto
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CRYPTO HISTORY TABLE
-- ============================================
CREATE TABLE public.crypto_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crypto_id UUID NOT NULL REFERENCES public.crypto(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,

  -- Historical snapshot data
  quantity NUMERIC(18,10) NOT NULL,
  price NUMERIC(12,4) NOT NULL,
  market_value NUMERIC(15,2) NOT NULL,
  gain_loss NUMERIC(15,2),
  gain_loss_pct NUMERIC(8,4),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(crypto_id, snapshot_date)
);

-- Indexes for performance
CREATE INDEX idx_crypto_history_crypto_id ON public.crypto_history(crypto_id);
CREATE INDEX idx_crypto_history_snapshot_date ON public.crypto_history(snapshot_date DESC);
CREATE INDEX idx_crypto_history_crypto_date ON public.crypto_history(crypto_id, snapshot_date DESC);

-- Comments
COMMENT ON TABLE public.crypto_history IS 'Daily historical snapshots of crypto positions for trend analysis';
COMMENT ON COLUMN public.crypto_history.crypto_id IS 'Reference to the crypto position';
COMMENT ON COLUMN public.crypto_history.snapshot_date IS 'Date of the snapshot';

-- ============================================
-- NO ROW LEVEL SECURITY
-- ============================================
-- This is a single-user system using iron-session authentication
-- RLS is disabled to match the pattern used for stocks and portfolio_snapshots
