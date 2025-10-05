-- Create volatility_alerts table for tracking unusual market movements
CREATE TABLE IF NOT EXISTS public.volatility_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'high_volatility',
    'unusual_volume',
    'sharp_decline',
    'sharp_increase',
    'correlation_break',
    'portfolio_volatility'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  threshold_value DECIMAL(12,4) NOT NULL,
  detected_value DECIMAL(12,4) NOT NULL,
  message TEXT NOT NULL,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_volatility_alerts_ticker ON public.volatility_alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_volatility_alerts_type ON public.volatility_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_volatility_alerts_severity ON public.volatility_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_volatility_alerts_detected ON public.volatility_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_alerts_acknowledged ON public.volatility_alerts(is_acknowledged) WHERE is_acknowledged = false;

-- Enable Row Level Security
ALTER TABLE public.volatility_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'volatility_alerts'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.volatility_alerts
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create anomaly_detection_config table for configurable thresholds
CREATE TABLE IF NOT EXISTS public.anomaly_detection_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value DECIMAL(12,4) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO public.anomaly_detection_config (config_key, config_value, description)
VALUES
  ('volatility_threshold_percent', 5.0, 'Daily price movement threshold (%) to trigger high volatility alert'),
  ('sharp_decline_percent', 10.0, 'Price decline threshold (%) to trigger sharp decline alert'),
  ('sharp_increase_percent', 15.0, 'Price increase threshold (%) to trigger sharp increase alert'),
  ('portfolio_volatility_threshold', 3.0, 'Portfolio-wide volatility threshold (%)'),
  ('correlation_break_threshold', 0.5, 'Change in correlation coefficient to trigger alert'),
  ('lookback_days', 30, 'Number of days to look back for anomaly detection')
ON CONFLICT (config_key) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.anomaly_detection_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'anomaly_detection_config'
    AND policyname = 'Allow read for authenticated users'
  ) THEN
    CREATE POLICY "Allow read for authenticated users"
      ON public.anomaly_detection_config
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'anomaly_detection_config'
    AND policyname = 'Allow update for authenticated users'
  ) THEN
    CREATE POLICY "Allow update for authenticated users"
      ON public.anomaly_detection_config
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create position_price_history table for tracking price changes
CREATE TABLE IF NOT EXISTS public.position_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  volume BIGINT,
  price_change_percent DECIMAL(10,4),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_position_price_history_ticker ON public.position_price_history(ticker);
CREATE INDEX IF NOT EXISTS idx_position_price_history_recorded_at ON public.position_price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_position_price_history_ticker_date ON public.position_price_history(ticker, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE public.position_price_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for price history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'position_price_history'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.position_price_history
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.volatility_alerts IS 'Alerts for unusual volatility and market anomalies';
COMMENT ON TABLE public.anomaly_detection_config IS 'Configuration for anomaly detection thresholds';
COMMENT ON TABLE public.position_price_history IS 'Historical price tracking for anomaly detection';
