-- Create price_alerts table for storing user-defined price alerts
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_above', 'price_below', 'change_percent')),
  target_value DECIMAL(12,4) NOT NULL,
  current_value DECIMAL(12,4),
  is_triggered BOOLEAN NOT NULL DEFAULT false,
  triggered_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_price_alerts_ticker ON public.price_alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON public.price_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_alerts_triggered ON public.price_alerts(is_triggered) WHERE is_triggered = false;

-- Create trigger to update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_price_alerts_updated_at'
  ) THEN
    CREATE TRIGGER update_price_alerts_updated_at
      BEFORE UPDATE ON public.price_alerts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'price_alerts'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.price_alerts
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create alert_logs table for tracking alert history
CREATE TABLE IF NOT EXISTS public.alert_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES public.price_alerts(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  target_value DECIMAL(12,4) NOT NULL,
  triggered_value DECIMAL(12,4) NOT NULL,
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on triggered_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_alert_logs_triggered_at ON public.alert_logs(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_logs_ticker ON public.alert_logs(ticker);

-- Enable Row Level Security
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for alert_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alert_logs'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.alert_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.price_alerts IS 'User-defined price alerts for portfolio positions';
COMMENT ON TABLE public.alert_logs IS 'Historical log of triggered alerts';
COMMENT ON COLUMN public.price_alerts.alert_type IS 'Type of alert: price_above, price_below, or change_percent';
COMMENT ON COLUMN public.price_alerts.target_value IS 'Target price or percentage change that triggers the alert';
