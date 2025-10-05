-- Create watchlist table for tracking potential investments
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto')),
  notes TEXT,
  target_price DECIMAL(12,4),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(ticker)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_ticker ON watchlist(ticker);
CREATE INDEX IF NOT EXISTS idx_watchlist_added_at ON watchlist(added_at DESC);

-- Enable Row Level Security
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
-- (Since we have single-user auth, this is safe)
CREATE POLICY "Allow all operations for authenticated users"
  ON watchlist
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE watchlist IS 'Watchlist for potential investments to track';
