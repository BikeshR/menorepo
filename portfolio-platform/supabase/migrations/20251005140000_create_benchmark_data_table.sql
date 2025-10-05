-- Benchmark Data Table for Market Index Historical Data
-- Stores historical S&P 500 (SPY) data for portfolio comparison and beta calculation

-- ============================================
-- BENCHMARK DATA TABLE
-- ============================================
CREATE TABLE public.benchmark_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Benchmark identifier
  symbol TEXT NOT NULL DEFAULT 'SPY', -- SPY = S&P 500 ETF
  benchmark_name TEXT NOT NULL DEFAULT 'S&P 500',

  -- Historical data
  date DATE NOT NULL,
  open NUMERIC(12,4) NOT NULL,
  high NUMERIC(12,4) NOT NULL,
  low NUMERIC(12,4) NOT NULL,
  close NUMERIC(12,4) NOT NULL,
  adjusted_close NUMERIC(12,4) NOT NULL, -- Adjusted for splits/dividends
  volume BIGINT NOT NULL,

  -- Calculated metrics (for performance)
  daily_return NUMERIC(10,6), -- Percentage change from previous day

  -- Metadata
  source TEXT NOT NULL DEFAULT 'alpha_vantage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(symbol, date)
);

-- Indexes for performance
CREATE INDEX idx_benchmark_data_symbol ON public.benchmark_data(symbol);
CREATE INDEX idx_benchmark_data_date ON public.benchmark_data(date DESC);
CREATE INDEX idx_benchmark_data_symbol_date ON public.benchmark_data(symbol, date DESC);

-- Comments
COMMENT ON TABLE public.benchmark_data IS 'Historical market index data for benchmark comparison (e.g., S&P 500)';
COMMENT ON COLUMN public.benchmark_data.symbol IS 'Index symbol (SPY for S&P 500)';
COMMENT ON COLUMN public.benchmark_data.date IS 'Trading day date';
COMMENT ON COLUMN public.benchmark_data.adjusted_close IS 'Close price adjusted for splits and dividends';
COMMENT ON COLUMN public.benchmark_data.daily_return IS 'Daily percentage return ((today - yesterday) / yesterday)';

-- Trigger for updated_at
CREATE TRIGGER update_benchmark_data_updated_at
  BEFORE UPDATE ON public.benchmark_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS but allow all authenticated users to read
ALTER TABLE public.benchmark_data ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read benchmark data (it's public market data)
CREATE POLICY "Authenticated users can view benchmark data"
  ON public.benchmark_data FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can insert/update benchmark data (via server actions)
-- No user-facing insert policy needed
