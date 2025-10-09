-- Migration: Fix weight_pct precision to handle larger values
-- The original DECIMAL(8,4) maxes out at 9999.9999
-- Increase to DECIMAL(10,4) to allow values up to 999,999.9999

-- Update etf_holdings table
ALTER TABLE public.etf_holdings
ALTER COLUMN weight_pct TYPE DECIMAL(10, 4);

-- Update etf_country_breakdown table
ALTER TABLE public.etf_country_breakdown
ALTER COLUMN weight_pct TYPE DECIMAL(10, 4);

-- Update etf_sector_breakdown table
ALTER TABLE public.etf_sector_breakdown
ALTER COLUMN weight_pct TYPE DECIMAL(10, 4);

-- Update etf_asset_allocation table
ALTER TABLE public.etf_asset_allocation
ALTER COLUMN weight_pct TYPE DECIMAL(10, 4);

COMMENT ON COLUMN public.etf_holdings.weight_pct IS 'Percentage of ETF (e.g., 5.25 = 5.25%), supports up to 999,999.9999';
COMMENT ON COLUMN public.etf_country_breakdown.weight_pct IS 'Percentage allocation (e.g., 65.50), supports up to 999,999.9999';
COMMENT ON COLUMN public.etf_sector_breakdown.weight_pct IS 'Percentage weight, supports up to 999,999.9999';
COMMENT ON COLUMN public.etf_asset_allocation.weight_pct IS 'Percentage weight, supports up to 999,999.9999';
