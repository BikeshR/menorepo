-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- =============================================================================
-- STRATEGIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- rsi_mean_reversion, bollinger_breakout, etc.
    description TEXT,
    parameters JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT false,
    initial_capital NUMERIC(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategies_type ON strategies(type);
CREATE INDEX idx_strategies_enabled ON strategies(enabled);

-- =============================================================================
-- POSITIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    side VARCHAR(10) NOT NULL, -- LONG, SHORT
    quantity INTEGER NOT NULL,
    entry_price NUMERIC(12,4) NOT NULL,
    current_price NUMERIC(12,4),
    stop_loss NUMERIC(12,4),
    take_profit NUMERIC(12,4),
    unrealized_pnl NUMERIC(15,2),
    realized_pnl NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, CLOSED, PENDING
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_strategy ON positions(strategy_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_opened_at ON positions(opened_at);

-- =============================================================================
-- TRADES TABLE (Time-series data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL,
    position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    side VARCHAR(10) NOT NULL, -- BUY, SELL
    order_type VARCHAR(20) NOT NULL, -- MARKET, LIMIT, STOP, STOP_LIMIT
    quantity INTEGER NOT NULL,
    filled_quantity INTEGER DEFAULT 0,
    price NUMERIC(12,4) NOT NULL,
    filled_avg_price NUMERIC(12,4),
    commission NUMERIC(10,2) DEFAULT 0,
    slippage NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, FILLED, PARTIAL, CANCELLED, REJECTED
    order_id VARCHAR(100), -- Alpaca order ID
    executed_at TIMESTAMPTZ NOT NULL,
    filled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('trades', 'executed_at', if_not_exists => TRUE);

CREATE INDEX idx_trades_position ON trades(position_id, executed_at DESC);
CREATE INDEX idx_trades_strategy ON trades(strategy_id, executed_at DESC);
CREATE INDEX idx_trades_symbol ON trades(symbol, executed_at DESC);
CREATE INDEX idx_trades_status ON trades(status);

-- =============================================================================
-- MARKET DATA TABLE (Time-series data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS market_data (
    symbol VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open NUMERIC(12,4) NOT NULL,
    high NUMERIC(12,4) NOT NULL,
    low NUMERIC(12,4) NOT NULL,
    close NUMERIC(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    vwap NUMERIC(12,4),
    trade_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('market_data', 'timestamp', if_not_exists => TRUE);

-- Add unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);

-- Compression policy (compress data older than 7 days)
SELECT add_compression_policy('market_data', INTERVAL '7 days', if_not_exists => TRUE);

-- =============================================================================
-- PORTFOLIO SNAPSHOTS TABLE (Time-series data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    total_value NUMERIC(15,2) NOT NULL,
    cash NUMERIC(15,2) NOT NULL,
    positions_value NUMERIC(15,2) NOT NULL,
    daily_pnl NUMERIC(15,2),
    total_pnl NUMERIC(15,2),
    drawdown_pct NUMERIC(8,4),
    num_positions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('portfolio_snapshots', 'timestamp', if_not_exists => TRUE);

CREATE INDEX idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp DESC);

-- =============================================================================
-- RISK LIMITS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS risk_limits (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    max_position_size INTEGER,
    max_portfolio_risk_pct NUMERIC(5,2), -- e.g., 15.00 = 15%
    max_daily_loss NUMERIC(15,2),
    max_drawdown_pct NUMERIC(5,2),
    max_concurrent_positions INTEGER DEFAULT 5,
    max_correlation NUMERIC(4,2), -- e.g., 0.70 = 70%
    min_cash_reserve NUMERIC(15,2),
    max_leverage NUMERIC(4,2) DEFAULT 1.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_limits_strategy ON risk_limits(strategy_id);

-- =============================================================================
-- BACKTEST RESULTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS backtest_results (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital NUMERIC(15,2) NOT NULL,
    final_capital NUMERIC(15,2) NOT NULL,
    total_return_pct NUMERIC(10,4),
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate NUMERIC(5,2),
    profit_factor NUMERIC(10,4),
    sharpe_ratio NUMERIC(10,4),
    sortino_ratio NUMERIC(10,4),
    max_drawdown_pct NUMERIC(8,4),
    avg_trade_pnl NUMERIC(12,2),
    largest_win NUMERIC(12,2),
    largest_loss NUMERIC(12,2),
    parameters JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_strategy ON backtest_results(strategy_id);
CREATE INDEX idx_backtest_sharpe ON backtest_results(sharpe_ratio DESC);
CREATE INDEX idx_backtest_created ON backtest_results(created_at DESC);

-- =============================================================================
-- SIGNALS TABLE (Time-series data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS signals (
    id BIGSERIAL,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    signal_type VARCHAR(20) NOT NULL, -- BUY, SELL, HOLD
    strength NUMERIC(4,2), -- Signal strength 0.00 to 1.00
    price NUMERIC(12,4) NOT NULL,
    indicators JSONB, -- Store indicator values
    reason TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('signals', 'timestamp', if_not_exists => TRUE);

CREATE INDEX idx_signals_strategy ON signals(strategy_id, timestamp DESC);
CREATE INDEX idx_signals_symbol ON signals(symbol, timestamp DESC);
CREATE INDEX idx_signals_type ON signals(signal_type);

-- =============================================================================
-- TRIGGER FUNCTIONS
-- =============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_limits_updated_at BEFORE UPDATE ON risk_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
INSERT INTO users (username, email, password_hash) VALUES
    ('admin', 'admin@pi5trading.local', '$2a$10$rXQvK8wKVYQdKQp8gqJH0.zGXKKdYFVJ0qXJxHhKJqYmHXdDQFLzO')
ON CONFLICT (username) DO NOTHING;

-- Create default risk limits
INSERT INTO risk_limits (strategy_id, max_portfolio_risk_pct, max_daily_loss, max_drawdown_pct, max_concurrent_positions, max_correlation, min_cash_reserve, max_leverage)
VALUES (NULL, 15.00, 3000.00, 20.00, 5, 0.70, 10000.00, 1.50);
