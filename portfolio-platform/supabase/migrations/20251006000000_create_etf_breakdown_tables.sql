-- Migration: Create ETF breakdown tables for detailed portfolio analysis
-- This allows tracking of ETF holdings, geographic distribution, and sector allocation

-- ============================================================================
-- ETF Metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.etf_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  isin TEXT,
  name TEXT NOT NULL,
  provider TEXT, -- e.g., "iShares", "Vanguard", "SPDR"

  -- Basic metrics
  total_assets_usd DECIMAL(20, 2), -- AUM in USD
  ter_pct DECIMAL(5, 4), -- Total Expense Ratio

  -- Data freshness
  data_source TEXT DEFAULT 'justetf', -- Where data was scraped from
  last_scraped_at TIMESTAMPTZ,
  scrape_status TEXT DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'success', 'failed', 'stale')),
  scrape_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_etf_metadata_ticker ON public.etf_metadata(ticker);
CREATE INDEX idx_etf_metadata_isin ON public.etf_metadata(isin);
CREATE INDEX idx_etf_metadata_last_scraped ON public.etf_metadata(last_scraped_at);

COMMENT ON TABLE public.etf_metadata IS 'Metadata and scraping status for ETFs';
COMMENT ON COLUMN public.etf_metadata.scrape_status IS 'Status: pending (never scraped), success (data available), failed (error), stale (>30 days old)';

-- ============================================================================
-- ETF Holdings (Individual positions within ETFs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.etf_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etf_ticker TEXT NOT NULL REFERENCES public.etf_metadata(ticker) ON DELETE CASCADE,

  -- Holding details
  holding_ticker TEXT, -- May be null for bonds/other assets
  holding_name TEXT NOT NULL,
  holding_isin TEXT,

  -- Position size
  weight_pct DECIMAL(8, 4) NOT NULL, -- Percentage of ETF (e.g., 5.25 = 5.25%)
  shares BIGINT,
  market_value_usd DECIMAL(20, 2),

  -- Classification
  asset_type TEXT CHECK (asset_type IN ('stock', 'bond', 'cash', 'commodity', 'other')),
  country TEXT, -- Country of domicile/incorporation
  sector TEXT, -- GICS or similar
  industry TEXT,

  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_etf_holdings_etf_ticker ON public.etf_holdings(etf_ticker);
CREATE INDEX idx_etf_holdings_holding_ticker ON public.etf_holdings(holding_ticker);
CREATE INDEX idx_etf_holdings_weight ON public.etf_holdings(etf_ticker, weight_pct DESC);

COMMENT ON TABLE public.etf_holdings IS 'Individual holdings within each ETF with weights and classifications';

-- ============================================================================
-- ETF Country Breakdown (Geographic allocation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.etf_country_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etf_ticker TEXT NOT NULL REFERENCES public.etf_metadata(ticker) ON DELETE CASCADE,

  country TEXT NOT NULL, -- ISO country name or code
  weight_pct DECIMAL(8, 4) NOT NULL, -- Percentage allocation (e.g., 65.50)

  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(etf_ticker, country)
);

CREATE INDEX idx_etf_country_breakdown_ticker ON public.etf_country_breakdown(etf_ticker);

COMMENT ON TABLE public.etf_country_breakdown IS 'Geographic allocation of ETF holdings by country';

-- ============================================================================
-- ETF Sector Breakdown
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.etf_sector_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etf_ticker TEXT NOT NULL REFERENCES public.etf_metadata(ticker) ON DELETE CASCADE,

  sector TEXT NOT NULL, -- GICS sector or similar classification
  industry_group TEXT, -- More granular than sector
  weight_pct DECIMAL(8, 4) NOT NULL,

  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(etf_ticker, sector, industry_group)
);

CREATE INDEX idx_etf_sector_breakdown_ticker ON public.etf_sector_breakdown(etf_ticker);

COMMENT ON TABLE public.etf_sector_breakdown IS 'Sector and industry allocation of ETF holdings';

-- ============================================================================
-- ETF Asset Allocation (Stocks vs Bonds vs Cash)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.etf_asset_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etf_ticker TEXT NOT NULL REFERENCES public.etf_metadata(ticker) ON DELETE CASCADE,

  asset_class TEXT NOT NULL CHECK (asset_class IN ('stocks', 'bonds', 'cash', 'commodities', 'real_estate', 'other')),
  weight_pct DECIMAL(8, 4) NOT NULL,

  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(etf_ticker, asset_class)
);

CREATE INDEX idx_etf_asset_allocation_ticker ON public.etf_asset_allocation(etf_ticker);

COMMENT ON TABLE public.etf_asset_allocation IS 'Asset class breakdown (stocks, bonds, cash, etc.)';

-- ============================================================================
-- Custom Regions (User-defined geographic groupings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.custom_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., "Asia Pacific Ex-China"
  description TEXT,
  countries TEXT[] NOT NULL, -- Array of country names/codes

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_regions_name ON public.custom_regions(name);

COMMENT ON TABLE public.custom_regions IS 'User-defined geographic regions for custom portfolio grouping';

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE TRIGGER set_updated_at_etf_metadata
  BEFORE UPDATE ON public.etf_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_etf_holdings
  BEFORE UPDATE ON public.etf_holdings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_etf_country_breakdown
  BEFORE UPDATE ON public.etf_country_breakdown
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_etf_sector_breakdown
  BEFORE UPDATE ON public.etf_sector_breakdown
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_etf_asset_allocation
  BEFORE UPDATE ON public.etf_asset_allocation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_custom_regions
  BEFORE UPDATE ON public.custom_regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View: ETFs that need refreshing (stale data > 30 days)
CREATE OR REPLACE VIEW public.etf_stale_data AS
SELECT
  ticker,
  name,
  last_scraped_at,
  EXTRACT(DAYS FROM (NOW() - last_scraped_at)) as days_old,
  scrape_status
FROM public.etf_metadata
WHERE
  last_scraped_at IS NULL
  OR last_scraped_at < NOW() - INTERVAL '30 days'
  OR scrape_status IN ('failed', 'pending');

COMMENT ON VIEW public.etf_stale_data IS 'ETFs with data older than 30 days or never scraped';
