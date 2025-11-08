-- Drop tables in reverse order (respecting foreign key constraints)

DROP TABLE IF EXISTS signals;
DROP TABLE IF EXISTS backtest_results;
DROP TABLE IF EXISTS risk_limits;
DROP TABLE IF EXISTS portfolio_snapshots;
DROP TABLE IF EXISTS market_data;
DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS strategies;
DROP TABLE IF EXISTS users;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Note: TimescaleDB extension is not dropped to avoid affecting other databases
