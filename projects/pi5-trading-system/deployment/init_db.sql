-- Pi5 Trading System - Database Initialization Script
-- This script sets up the initial database schema for TimescaleDB

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ================================
-- Core Trading Tables
-- ================================

-- Market data table (time-series data)
CREATE TABLE IF NOT EXISTS market_data (
    id BIGSERIAL,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open_price DECIMAL(15,6) NOT NULL,
    high_price DECIMAL(15,6) NOT NULL,
    low_price DECIMAL(15,6) NOT NULL,
    close_price DECIMAL(15,6) NOT NULL,
    volume BIGINT NOT NULL,
    adjusted_close DECIMAL(15,6),
    interval_type VARCHAR(10) NOT NULL DEFAULT '1min',
    source VARCHAR(50) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp, symbol, interval_type)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('market_data', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Technical indicators table
CREATE TABLE IF NOT EXISTS technical_indicators (
    id BIGSERIAL,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    indicator_name VARCHAR(50) NOT NULL,
    indicator_value DECIMAL(15,6) NOT NULL,
    period INTEGER,
    parameters JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp, symbol, indicator_name)
);

-- Convert to hypertable
SELECT create_hypertable('technical_indicators', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Strategies table
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    class_name VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    symbols TEXT[] NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy signals table
CREATE TABLE IF NOT EXISTS strategy_signals (
    id BIGSERIAL,
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    signal_type VARCHAR(20) NOT NULL, -- 'BUY', 'SELL', 'HOLD'
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    price DECIMAL(15,6) NOT NULL,
    volume INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp, strategy_id, symbol)
);

-- Convert to hypertable
SELECT create_hypertable('strategy_signals', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    order_type VARCHAR(20) NOT NULL, -- 'MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'
    side VARCHAR(10) NOT NULL, -- 'BUY', 'SELL'
    quantity DECIMAL(15,6) NOT NULL,
    price DECIMAL(15,6),
    stop_price DECIMAL(15,6),
    time_in_force VARCHAR(10) DEFAULT 'DAY', -- 'DAY', 'GTC', 'IOC', 'FOK'
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'SUBMITTED', 'FILLED', 'CANCELLED', 'REJECTED'
    broker_order_id VARCHAR(100),
    filled_quantity DECIMAL(15,6) DEFAULT 0,
    average_fill_price DECIMAL(15,6),
    commission DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    filled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

-- Order executions table (for partial fills)
CREATE TABLE IF NOT EXISTS order_executions (
    id BIGSERIAL,
    order_id UUID NOT NULL REFERENCES orders(id),
    timestamp TIMESTAMPTZ NOT NULL,
    quantity DECIMAL(15,6) NOT NULL,
    price DECIMAL(15,6) NOT NULL,
    commission DECIMAL(10,4) DEFAULT 0,
    execution_id VARCHAR(100),
    broker_execution_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp, order_id, execution_id)
);

-- Convert to hypertable
SELECT create_hypertable('order_executions', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL UNIQUE,
    quantity DECIMAL(15,6) NOT NULL DEFAULT 0,
    average_cost DECIMAL(15,6) NOT NULL DEFAULT 0,
    unrealized_pnl DECIMAL(15,6) DEFAULT 0,
    realized_pnl DECIMAL(15,6) DEFAULT 0,
    market_value DECIMAL(15,6) DEFAULT 0,
    last_price DECIMAL(15,6),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio snapshots table (for performance tracking)
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    total_value DECIMAL(15,6) NOT NULL,
    cash DECIMAL(15,6) NOT NULL,
    positions_value DECIMAL(15,6) NOT NULL,
    unrealized_pnl DECIMAL(15,6) NOT NULL,
    realized_pnl DECIMAL(15,6) NOT NULL,
    daily_pnl DECIMAL(15,6),
    total_return DECIMAL(10,6),
    positions JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('portfolio_snapshots', 'timestamp',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Risk metrics table
CREATE TABLE IF NOT EXISTS risk_metrics (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    portfolio_value DECIMAL(15,6) NOT NULL,
    var_95 DECIMAL(15,6), -- Value at Risk 95%
    var_99 DECIMAL(15,6), -- Value at Risk 99%
    expected_shortfall DECIMAL(15,6),
    max_drawdown DECIMAL(10,6),
    current_drawdown DECIMAL(10,6),
    volatility DECIMAL(10,6),
    sharpe_ratio DECIMAL(10,6),
    sortino_ratio DECIMAL(10,6),
    beta DECIMAL(10,6),
    alpha DECIMAL(10,6),
    correlation_spy DECIMAL(10,6),
    exposure DECIMAL(10,6),
    leverage DECIMAL(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('risk_metrics', 'timestamp',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Events log table
CREATE TABLE IF NOT EXISTS events_log (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    source VARCHAR(100) NOT NULL,
    level VARCHAR(20) DEFAULT 'INFO', -- 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp, id)
);

-- Convert to hypertable
SELECT create_hypertable('events_log', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    component VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'HEALTHY', 'WARNING', 'ERROR', 'CRITICAL'
    metrics JSONB DEFAULT '{}',
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (timestamp, component)
);

-- Convert to hypertable
SELECT create_hypertable('system_health', 'timestamp',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- ================================
-- Indexes for Performance
-- ================================

-- Market data indexes
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_source ON market_data (source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_interval ON market_data (interval_type, timestamp DESC);

-- Technical indicators indexes
CREATE INDEX IF NOT EXISTS idx_technical_indicators_symbol ON technical_indicators (symbol, indicator_name, timestamp DESC);

-- Strategy signals indexes
CREATE INDEX IF NOT EXISTS idx_strategy_signals_symbol ON strategy_signals (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_signals_type ON strategy_signals (signal_type, timestamp DESC);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_strategy ON orders (strategy_id, created_at DESC);

-- Portfolio snapshots indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots (timestamp DESC);

-- Events log indexes
CREATE INDEX IF NOT EXISTS idx_events_log_type ON events_log (event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_log_source ON events_log (source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_log_level ON events_log (level, timestamp DESC);

-- ================================
-- Data Retention Policies
-- ================================

-- Keep market data for 2 years
SELECT add_retention_policy('market_data', INTERVAL '2 years', if_not_exists => TRUE);

-- Keep technical indicators for 1 year
SELECT add_retention_policy('technical_indicators', INTERVAL '1 year', if_not_exists => TRUE);

-- Keep strategy signals for 1 year
SELECT add_retention_policy('strategy_signals', INTERVAL '1 year', if_not_exists => TRUE);

-- Keep order executions for 2 years
SELECT add_retention_policy('order_executions', INTERVAL '2 years', if_not_exists => TRUE);

-- Keep portfolio snapshots for 2 years
SELECT add_retention_policy('portfolio_snapshots', INTERVAL '2 years', if_not_exists => TRUE);

-- Keep risk metrics for 1 year
SELECT add_retention_policy('risk_metrics', INTERVAL '1 year', if_not_exists => TRUE);

-- Keep events log for 6 months
SELECT add_retention_policy('events_log', INTERVAL '6 months', if_not_exists => TRUE);

-- Keep system health for 3 months
SELECT add_retention_policy('system_health', INTERVAL '3 months', if_not_exists => TRUE);

-- ================================
-- Continuous Aggregates (for performance)
-- ================================

-- Daily market data aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS market_data_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS bucket,
    symbol,
    FIRST(open_price, timestamp) AS open_price,
    MAX(high_price) AS high_price,
    MIN(low_price) AS low_price,
    LAST(close_price, timestamp) AS close_price,
    SUM(volume) AS volume,
    COUNT(*) AS data_points
FROM market_data
WHERE interval_type = '1min'
GROUP BY bucket, symbol;

-- Add refresh policy for daily aggregates
SELECT add_continuous_aggregate_policy('market_data_daily',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Hourly portfolio performance
CREATE MATERIALIZED VIEW IF NOT EXISTS portfolio_performance_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    AVG(total_value) AS avg_total_value,
    MAX(total_value) AS max_total_value,
    MIN(total_value) AS min_total_value,
    LAST(total_value, timestamp) AS final_total_value,
    AVG(total_return) AS avg_total_return,
    COUNT(*) AS snapshots_count
FROM portfolio_snapshots
GROUP BY bucket;

-- Add refresh policy for hourly performance
SELECT add_continuous_aggregate_policy('portfolio_performance_hourly',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE
);

-- ================================
-- Functions and Triggers
-- ================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate portfolio metrics
CREATE OR REPLACE FUNCTION calculate_portfolio_return(
    current_value DECIMAL(15,6),
    initial_value DECIMAL(15,6)
)
RETURNS DECIMAL(10,6) AS $$
BEGIN
    IF initial_value = 0 THEN
        RETURN 0;
    END IF;
    RETURN (current_value - initial_value) / initial_value;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- Initial Data Setup
-- ================================

-- Insert default strategy configurations
INSERT INTO strategies (name, class_name, parameters, symbols, enabled) VALUES
('MovingAverageCrossover_Conservative', 'MovingAverageCrossoverStrategy', 
 '{"short_period": 20, "long_period": 50, "ma_type": "sma", "confidence_threshold": 0.75}', 
 '{"AAPL", "MSFT"}', true),
('MovingAverageCrossover_Aggressive', 'MovingAverageCrossoverStrategy', 
 '{"short_period": 10, "long_period": 30, "ma_type": "ema", "confidence_threshold": 0.6}', 
 '{"GOOGL", "TSLA"}', true)
ON CONFLICT (name) DO NOTHING;

-- ================================
-- Database Statistics and Optimization
-- ================================

-- Update table statistics
ANALYZE market_data;
ANALYZE technical_indicators;
ANALYZE strategy_signals;
ANALYZE orders;
ANALYZE order_executions;
ANALYZE positions;
ANALYZE portfolio_snapshots;
ANALYZE risk_metrics;
ANALYZE events_log;
ANALYZE system_health;

-- Log successful initialization
INSERT INTO events_log (timestamp, event_type, event_data, source, level)
VALUES (NOW(), 'DATABASE_INIT', '{"status": "completed", "version": "1.0"}', 'init_script', 'INFO');

-- Create database user permissions (if needed)
-- GRANT USAGE ON SCHEMA public TO pi5trader;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pi5trader;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pi5trader;

COMMIT;