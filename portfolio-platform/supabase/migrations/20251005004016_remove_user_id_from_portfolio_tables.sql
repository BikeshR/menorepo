-- Remove user_id and RLS from portfolio tables to match single-user iron-session pattern
-- This aligns portfolio tables with the demo_private_data approach

-- 1. Disable RLS on all portfolio tables
ALTER TABLE public.portfolios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs DISABLE ROW LEVEL SECURITY;

-- 2. Drop all RLS policies
DROP POLICY IF EXISTS "Users can view own portfolios" ON public.portfolios;
DROP POLICY IF EXISTS "Users can insert own portfolios" ON public.portfolios;
DROP POLICY IF EXISTS "Users can update own portfolios" ON public.portfolios;
DROP POLICY IF EXISTS "Users can delete own portfolios" ON public.portfolios;

DROP POLICY IF EXISTS "Users can view own stocks" ON public.stocks;
DROP POLICY IF EXISTS "Users can insert own stocks" ON public.stocks;
DROP POLICY IF EXISTS "Users can update own stocks" ON public.stocks;
DROP POLICY IF EXISTS "Users can delete own stocks" ON public.stocks;

DROP POLICY IF EXISTS "Users can view own stock history" ON public.stock_history;
DROP POLICY IF EXISTS "Users can insert own stock history" ON public.stock_history;

DROP POLICY IF EXISTS "Users can view own snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Users can insert own snapshots" ON public.portfolio_snapshots;

DROP POLICY IF EXISTS "Users can view own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can insert own sync logs" ON public.sync_logs;

-- 3. Drop foreign key constraint on user_id
ALTER TABLE public.portfolios DROP CONSTRAINT IF EXISTS portfolios_user_id_fkey;

-- 4. Remove user_id column from portfolios table
ALTER TABLE public.portfolios DROP COLUMN IF EXISTS user_id;

-- 5. Update comments to reflect single-user system
COMMENT ON TABLE public.portfolios IS 'Portfolio containers (single-user system with iron-session auth)';
COMMENT ON TABLE public.stocks IS 'Stock and ETF positions (no RLS - iron-session handles auth)';
COMMENT ON TABLE public.portfolio_snapshots IS 'Daily portfolio snapshots (single-user system)';
COMMENT ON TABLE public.sync_logs IS 'API sync operation logs (single-user system)';
