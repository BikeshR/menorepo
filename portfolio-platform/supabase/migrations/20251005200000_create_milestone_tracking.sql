-- Create portfolio_milestones table for tracking achievement milestones
CREATE TABLE IF NOT EXISTS public.portfolio_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'portfolio_value',
    'total_return_percent',
    'total_return_amount',
    'portfolio_growth',
    'holding_count',
    'consecutive_positive_days',
    'best_performing_position',
    'diversification_score'
  )),
  target_value DECIMAL(15,2) NOT NULL,
  current_value DECIMAL(15,2),
  is_achieved BOOLEAN NOT NULL DEFAULT false,
  achieved_at TIMESTAMPTZ,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_milestones_type ON public.portfolio_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_milestones_achieved ON public.portfolio_milestones(is_achieved) WHERE is_achieved = false;
CREATE INDEX IF NOT EXISTS idx_milestones_active ON public.portfolio_milestones(is_active) WHERE is_active = true;

-- Create trigger to update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_portfolio_milestones_updated_at'
  ) THEN
    CREATE TRIGGER update_portfolio_milestones_updated_at
      BEFORE UPDATE ON public.portfolio_milestones
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.portfolio_milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_milestones'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.portfolio_milestones
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create milestone_logs table for tracking milestone achievements
CREATE TABLE IF NOT EXISTS public.milestone_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id UUID REFERENCES public.portfolio_milestones(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  target_value DECIMAL(15,2) NOT NULL,
  achieved_value DECIMAL(15,2) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on achieved_at
CREATE INDEX IF NOT EXISTS idx_milestone_logs_achieved_at ON public.milestone_logs(achieved_at DESC);

-- Enable Row Level Security
ALTER TABLE public.milestone_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for milestone_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'milestone_logs'
    AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public.milestone_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Insert some default milestones
INSERT INTO public.portfolio_milestones (milestone_type, target_value, title, description)
VALUES
  ('portfolio_value', 10000, 'First £10K', 'Reach £10,000 in portfolio value'),
  ('portfolio_value', 25000, 'Quarter Century', 'Reach £25,000 in portfolio value'),
  ('portfolio_value', 50000, 'Half Century', 'Reach £50,000 in portfolio value'),
  ('portfolio_value', 100000, '£100K Club', 'Reach £100,000 in portfolio value'),
  ('total_return_percent', 10, '10% Return', 'Achieve 10% total return'),
  ('total_return_percent', 25, '25% Return', 'Achieve 25% total return'),
  ('total_return_percent', 50, '50% Return', 'Achieve 50% total return'),
  ('total_return_percent', 100, 'Double Your Money', 'Achieve 100% total return'),
  ('holding_count', 10, 'Decentralized', 'Hold 10 different positions'),
  ('holding_count', 25, 'Diversified Portfolio', 'Hold 25 different positions'),
  ('consecutive_positive_days', 7, 'Lucky Week', '7 consecutive days of positive returns'),
  ('consecutive_positive_days', 30, 'Momentum Month', '30 consecutive days of positive returns')
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE public.portfolio_milestones IS 'Portfolio achievement milestones and tracking';
COMMENT ON TABLE public.milestone_logs IS 'Historical log of achieved milestones';
