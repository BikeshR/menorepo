-- Create portfolio_metrics table for storing calculated portfolio metrics
CREATE TABLE IF NOT EXISTS public.portfolio_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sharpe_ratio DECIMAL(10,4),
  sortino_ratio DECIMAL(10,4),
  max_drawdown DECIMAL(10,4),
  var_95 DECIMAL(10,6),
  var_99 DECIMAL(10,6),
  cvar_95 DECIMAL(10,6),
  beta DECIMAL(10,4),
  alpha DECIMAL(10,6),
  annualized_return DECIMAL(10,6),
  annualized_volatility DECIMAL(10,6),
  irr DECIMAL(10,6),
  twr DECIMAL(10,6),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on calculated_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_calculated_at ON public.portfolio_metrics(calculated_at DESC);

-- Create portfolio_insights table for storing AI-generated insights
CREATE TABLE IF NOT EXISTS public.portfolio_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insights_text TEXT NOT NULL,
  total_value DECIMAL(15,2),
  positions_count INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on generated_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_portfolio_insights_generated_at ON public.portfolio_insights(generated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.portfolio_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_insights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for portfolio_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_metrics'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.portfolio_metrics
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create RLS policies for portfolio_insights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_insights'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.portfolio_insights
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add comment explaining the tables
COMMENT ON TABLE public.portfolio_metrics IS 'Stores calculated portfolio performance metrics including Sharpe ratio, VaR, beta, alpha, etc.';
COMMENT ON TABLE public.portfolio_insights IS 'Stores AI-generated portfolio insights and recommendations from GPT-4';
