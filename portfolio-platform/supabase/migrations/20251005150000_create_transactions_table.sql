-- Transactions Table for Trade History
-- Stores executed buy/sell orders from Trading212 and Kraken for IRR calculation

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
-- Drop old transactions table if it exists (from initial schema)
DROP TABLE IF EXISTS public.transactions CASCADE;

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,

  -- Transaction identification
  external_id TEXT, -- Order ID from Trading212/Kraken
  ticker TEXT NOT NULL, -- Stock/crypto symbol
  asset_name TEXT, -- Human-readable name
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto')),

  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity NUMERIC(15,6) NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,4) NOT NULL CHECK (price >= 0), -- Price per unit
  total_value NUMERIC(15,2) NOT NULL, -- quantity * price

  -- Fees and costs
  fee NUMERIC(12,4) DEFAULT 0, -- Transaction fee
  currency TEXT NOT NULL, -- e.g., 'USD', 'GBP', 'EUR'

  -- Timing
  executed_at TIMESTAMPTZ NOT NULL, -- When the order was filled

  -- Data source
  source TEXT NOT NULL CHECK (source IN ('trading212', 'kraken', 'manual')),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate imports from APIs
  UNIQUE(source, external_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON public.transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON public.transactions(ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_executed_at ON public.transactions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_ticker ON public.transactions(portfolio_id, ticker, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions(source);

-- Comments
COMMENT ON TABLE public.transactions IS 'Historical buy/sell transactions for IRR and cash flow tracking';
COMMENT ON COLUMN public.transactions.external_id IS 'Order ID from external API (Trading212/Kraken)';
COMMENT ON COLUMN public.transactions.transaction_type IS 'Buy or sell transaction';
COMMENT ON COLUMN public.transactions.executed_at IS 'Timestamp when the trade was executed';
COMMENT ON COLUMN public.transactions.total_value IS 'Total transaction value (quantity × price)';
COMMENT ON COLUMN public.transactions.fee IS 'Transaction fee charged by broker';

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_transactions_updated_at'
  ) THEN
    CREATE TRIGGER update_transactions_updated_at
      BEFORE UPDATE ON public.transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Single-user system: Allow all authenticated users to access transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated users' AND tablename = 'transactions'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.transactions
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
