"""
Database schema definitions for Pi5 Trading System.

Provides comprehensive database schema with TimescaleDB hypertables
for time-series data optimization and efficient querying.

Schema Components:
- Market data hypertables for OHLCV and real-time quotes
- Trading operations tables (orders, fills, positions)
- Strategy management and performance tracking
- Risk management and compliance monitoring  
- System events and audit logging
- Portfolio and performance analytics

All time-series tables are optimized with TimescaleDB hypertables
for efficient storage and querying of historical and real-time data.
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime

from core.exceptions import (
    DatabaseError,
    DatabaseMigrationError,
    ConfigurationError,
)
from database.connection_manager import DatabaseManager


logger = logging.getLogger(__name__)


class DatabaseSchema:
    """
    Database schema manager with TimescaleDB optimization.
    
    Manages database schema creation, migrations, and TimescaleDB
    hypertable setup for optimal time-series data performance.
    """
    
    SCHEMA_VERSION = "1.0.0"
    
    def __init__(self, db_manager: DatabaseManager):
        """
        Initialize schema manager.
        
        Args:
            db_manager: Database connection manager instance
        """
        self.db = db_manager
        self._schema_created = False
    
    async def initialize_schema(self, force_recreate: bool = False) -> None:
        """
        Initialize complete database schema.
        
        Args:
            force_recreate: Drop and recreate all tables if True
        """
        try:
            logger.info("Initializing database schema...")
            
            if force_recreate:
                await self._drop_all_tables()
            
            # Check if schema already exists
            if not force_recreate and await self._check_schema_exists():
                logger.info("Database schema already exists, skipping creation")
                self._schema_created = True
                return
            
            async with self.db.transaction():
                # Create extensions
                await self._create_extensions()
                
                # Create schema version table
                await self._create_schema_version_table()
                
                # Create core tables
                await self._create_core_tables()
                
                # Create time-series hypertables
                await self._create_hypertables()
                
                # Create indexes for performance
                await self._create_indexes()
                
                # Create stored procedures and triggers
                await self._create_procedures()
                
                # Record schema version
                await self._record_schema_version()
            
            self._schema_created = True
            logger.info(f"Database schema v{self.SCHEMA_VERSION} initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize database schema: {e}")
            raise DatabaseMigrationError(
                f"Failed to initialize database schema: {e}",
                context={'schema_version': self.SCHEMA_VERSION}
            ) from e
    
    async def _create_extensions(self) -> None:
        """Create required PostgreSQL extensions."""
        extensions = [
            "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;",
            "CREATE EXTENSION IF NOT EXISTS uuid-ossp;",
            "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;",
        ]
        
        for ext_sql in extensions:
            try:
                await self.db.execute(ext_sql)
            except Exception as e:
                # Some extensions may not be available, log but continue
                logger.warning(f"Could not create extension: {ext_sql} - {e}")
    
    async def _create_schema_version_table(self) -> None:
        """Create schema version tracking table."""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS schema_version (
                id SERIAL PRIMARY KEY,
                version VARCHAR(50) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                description TEXT
            )
        """)
    
    async def _create_core_tables(self) -> None:
        """Create core application tables."""
        
        # Strategies table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS strategies (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) NOT NULL UNIQUE,
                class_name VARCHAR(200) NOT NULL,
                description TEXT,
                parameters JSONB NOT NULL DEFAULT '{}',
                is_active BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT strategies_name_check CHECK (length(name) > 0)
            )
        """)
        
        # Orders table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                order_id VARCHAR(100) NOT NULL UNIQUE,
                broker_order_id VARCHAR(100),
                strategy_id UUID REFERENCES strategies(id),
                symbol VARCHAR(20) NOT NULL,
                side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
                order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
                quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
                price DECIMAL(20, 8),
                stop_price DECIMAL(20, 8),
                time_in_force VARCHAR(10) NOT NULL DEFAULT 'DAY',
                status VARCHAR(20) NOT NULL DEFAULT 'pending' 
                    CHECK (status IN ('pending', 'submitted', 'partially_filled', 'filled', 'cancelled', 'rejected')),
                filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
                average_fill_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
                commission DECIMAL(20, 8) NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT orders_quantity_check CHECK (quantity > 0),
                CONSTRAINT orders_filled_quantity_check CHECK (filled_quantity >= 0 AND filled_quantity <= quantity)
            )
        """)
        
        # Order fills table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS order_fills (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                order_id UUID NOT NULL REFERENCES orders(id),
                fill_id VARCHAR(100) NOT NULL,
                quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
                price DECIMAL(20, 8) NOT NULL CHECK (price > 0),
                commission DECIMAL(20, 8) NOT NULL DEFAULT 0,
                filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                UNIQUE(order_id, fill_id)
            )
        """)
        
        # Portfolio snapshots table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                snapshot_date DATE NOT NULL,
                total_value DECIMAL(20, 2) NOT NULL,
                cash DECIMAL(20, 2) NOT NULL,
                positions_value DECIMAL(20, 2) NOT NULL,
                unrealized_pnl DECIMAL(20, 2) NOT NULL DEFAULT 0,
                realized_pnl DECIMAL(20, 2) NOT NULL DEFAULT 0,
                total_return DECIMAL(10, 6) NOT NULL DEFAULT 0,
                max_drawdown DECIMAL(10, 6) NOT NULL DEFAULT 0,
                sharpe_ratio DECIMAL(10, 4),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                UNIQUE(snapshot_date)
            )
        """)
        
        # Positions table
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS positions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                symbol VARCHAR(20) NOT NULL,
                quantity DECIMAL(20, 8) NOT NULL,
                average_cost DECIMAL(20, 8) NOT NULL CHECK (average_cost >= 0),
                current_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
                market_value DECIMAL(20, 2) NOT NULL DEFAULT 0,
                unrealized_pnl DECIMAL(20, 2) NOT NULL DEFAULT 0,
                realized_pnl DECIMAL(20, 2) NOT NULL DEFAULT 0,
                first_acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                UNIQUE(symbol),
                CONSTRAINT positions_quantity_check CHECK (quantity != 0)
            )
        """)
        
        # Risk metrics table  
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS risk_metrics (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                metric_date DATE NOT NULL,
                var_95 DECIMAL(20, 2),
                var_99 DECIMAL(20, 2),
                expected_shortfall DECIMAL(20, 2),
                beta DECIMAL(10, 6),
                correlation_spy DECIMAL(10, 6),
                volatility DECIMAL(10, 6),
                max_position_exposure DECIMAL(10, 6),
                sector_concentration DECIMAL(10, 6),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                UNIQUE(metric_date)
            )
        """)
    
    async def _create_hypertables(self) -> None:
        """Create TimescaleDB hypertables for time-series data."""
        
        # Market data hypertable
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS market_data (
                time TIMESTAMPTZ NOT NULL,
                symbol VARCHAR(20) NOT NULL,
                open_price DECIMAL(20, 8) NOT NULL,
                high_price DECIMAL(20, 8) NOT NULL,
                low_price DECIMAL(20, 8) NOT NULL,
                close_price DECIMAL(20, 8) NOT NULL,
                volume BIGINT NOT NULL DEFAULT 0,
                vwap DECIMAL(20, 8),
                trade_count INTEGER DEFAULT 0,
                interval_type VARCHAR(10) NOT NULL DEFAULT '1min',
                source VARCHAR(50) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT market_data_ohlc_check CHECK (
                    high_price >= low_price 
                    AND high_price >= open_price 
                    AND high_price >= close_price
                    AND low_price <= open_price
                    AND low_price <= close_price
                )
            )
        """)
        
        # Create hypertable for market data
        await self.db.execute("""
            SELECT create_hypertable('market_data', 'time', 
                chunk_time_interval => INTERVAL '1 day',
                if_not_exists => true)
        """)
        
        # Real-time quotes hypertable
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS realtime_quotes (
                time TIMESTAMPTZ NOT NULL,
                symbol VARCHAR(20) NOT NULL,
                bid_price DECIMAL(20, 8),
                ask_price DECIMAL(20, 8),
                bid_size INTEGER,
                ask_size INTEGER,
                last_price DECIMAL(20, 8),
                last_size INTEGER,
                volume BIGINT DEFAULT 0,
                source VARCHAR(50) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        
        # Create hypertable for realtime quotes
        await self.db.execute("""
            SELECT create_hypertable('realtime_quotes', 'time',
                chunk_time_interval => INTERVAL '6 hours',
                if_not_exists => true)
        """)
        
        # System events hypertable
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS system_events (
                time TIMESTAMPTZ NOT NULL,
                event_id UUID NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                source_module VARCHAR(200) NOT NULL,
                correlation_id UUID,
                level VARCHAR(20) NOT NULL DEFAULT 'INFO',
                message TEXT NOT NULL,
                context JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        
        # Create hypertable for system events
        await self.db.execute("""
            SELECT create_hypertable('system_events', 'time',
                chunk_time_interval => INTERVAL '1 day',
                if_not_exists => true)
        """)
        
        # Strategy performance hypertable
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS strategy_performance (
                time TIMESTAMPTZ NOT NULL,
                strategy_id UUID NOT NULL REFERENCES strategies(id),
                total_return DECIMAL(10, 6),
                daily_return DECIMAL(10, 6),
                sharpe_ratio DECIMAL(10, 4),
                max_drawdown DECIMAL(10, 6),
                win_rate DECIMAL(5, 4),
                profit_factor DECIMAL(10, 4),
                total_trades INTEGER DEFAULT 0,
                winning_trades INTEGER DEFAULT 0,
                losing_trades INTEGER DEFAULT 0,
                avg_win DECIMAL(20, 2),
                avg_loss DECIMAL(20, 2),
                largest_win DECIMAL(20, 2),
                largest_loss DECIMAL(20, 2),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        
        # Create hypertable for strategy performance
        await self.db.execute("""
            SELECT create_hypertable('strategy_performance', 'time',
                chunk_time_interval => INTERVAL '7 days',
                if_not_exists => true)
        """)
    
    async def _create_indexes(self) -> None:
        """Create database indexes for query performance."""
        
        indexes = [
            # Market data indexes
            "CREATE INDEX IF NOT EXISTS idx_market_data_symbol_time ON market_data (symbol, time DESC)",
            "CREATE INDEX IF NOT EXISTS idx_market_data_time_symbol ON market_data (time DESC, symbol)",
            "CREATE INDEX IF NOT EXISTS idx_market_data_interval_type ON market_data (interval_type, time DESC)",
            
            # Realtime quotes indexes  
            "CREATE INDEX IF NOT EXISTS idx_realtime_quotes_symbol_time ON realtime_quotes (symbol, time DESC)",
            "CREATE INDEX IF NOT EXISTS idx_realtime_quotes_time ON realtime_quotes (time DESC)",
            
            # Orders indexes
            "CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders (symbol)",
            "CREATE INDEX IF NOT EXISTS idx_orders_strategy_id ON orders (strategy_id)",
            "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)",
            "CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_orders_broker_order_id ON orders (broker_order_id) WHERE broker_order_id IS NOT NULL",
            
            # Order fills indexes
            "CREATE INDEX IF NOT EXISTS idx_order_fills_order_id ON order_fills (order_id)",
            "CREATE INDEX IF NOT EXISTS idx_order_fills_filled_at ON order_fills (filled_at DESC)",
            
            # Positions indexes
            "CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions (symbol)",
            "CREATE INDEX IF NOT EXISTS idx_positions_last_updated ON positions (last_updated_at DESC)",
            
            # System events indexes
            "CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events (event_type, time DESC)",
            "CREATE INDEX IF NOT EXISTS idx_system_events_source_module ON system_events (source_module, time DESC)",
            "CREATE INDEX IF NOT EXISTS idx_system_events_level ON system_events (level, time DESC)",
            "CREATE INDEX IF NOT EXISTS idx_system_events_correlation_id ON system_events (correlation_id) WHERE correlation_id IS NOT NULL",
            
            # Strategy performance indexes
            "CREATE INDEX IF NOT EXISTS idx_strategy_performance_strategy_time ON strategy_performance (strategy_id, time DESC)",
            
            # Portfolio snapshots indexes
            "CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots (snapshot_date DESC)",
            
            # Risk metrics indexes
            "CREATE INDEX IF NOT EXISTS idx_risk_metrics_date ON risk_metrics (metric_date DESC)",
        ]
        
        for index_sql in indexes:
            try:
                await self.db.execute(index_sql)
            except Exception as e:
                logger.warning(f"Could not create index: {index_sql} - {e}")
    
    async def _create_procedures(self) -> None:
        """Create stored procedures and triggers."""
        
        # Update timestamp trigger function
        await self.db.execute("""
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        """)
        
        # Apply update triggers to relevant tables
        tables_with_updated_at = ['strategies', 'orders', 'positions']
        for table in tables_with_updated_at:
            await self.db.execute(f"""
                DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table};
                CREATE TRIGGER update_{table}_updated_at
                    BEFORE UPDATE ON {table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column()
            """)
    
    async def _record_schema_version(self) -> None:
        """Record current schema version."""
        await self.db.execute(
            """
            INSERT INTO schema_version (version, description)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            """,
            self.SCHEMA_VERSION,
            "Initial Pi5 Trading System schema with TimescaleDB optimization"
        )
    
    async def _check_schema_exists(self) -> bool:
        """Check if schema already exists."""
        try:
            result = await self.db.fetchval(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'strategies'"
            )
            return result > 0
        except Exception:
            return False
    
    async def _drop_all_tables(self) -> None:
        """Drop all tables (for testing/reset)."""
        logger.warning("Dropping all database tables...")
        
        tables = [
            'strategy_performance',
            'system_events', 
            'realtime_quotes',
            'market_data',
            'risk_metrics',
            'portfolio_snapshots',
            'positions',
            'order_fills',
            'orders',
            'strategies',
            'schema_version',
        ]
        
        for table in tables:
            try:
                await self.db.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
            except Exception as e:
                logger.warning(f"Could not drop table {table}: {e}")
    
    async def get_schema_info(self) -> Dict[str, any]:
        """Get database schema information."""
        try:
            # Get table counts
            table_info = {}
            tables = ['strategies', 'orders', 'order_fills', 'positions', 
                     'market_data', 'realtime_quotes', 'system_events',
                     'strategy_performance', 'portfolio_snapshots', 'risk_metrics']
            
            for table in tables:
                try:
                    count = await self.db.fetchval(f"SELECT COUNT(*) FROM {table}")
                    table_info[table] = count
                except Exception:
                    table_info[table] = 'ERROR'
            
            # Get current schema version
            version_info = await self.db.fetchrow(
                "SELECT version, applied_at FROM schema_version ORDER BY applied_at DESC LIMIT 1"
            )
            
            return {
                'schema_version': version_info['version'] if version_info else 'UNKNOWN',
                'schema_applied_at': version_info['applied_at'].isoformat() if version_info else None,
                'table_counts': table_info,
                'timescaledb_enabled': await self._check_timescaledb_enabled(),
            }
            
        except Exception as e:
            logger.error(f"Failed to get schema info: {e}")
            return {'error': str(e)}
    
    async def _check_timescaledb_enabled(self) -> bool:
        """Check if TimescaleDB extension is enabled."""
        try:
            result = await self.db.fetchval(
                "SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'"
            )
            return result == 1
        except Exception:
            return False