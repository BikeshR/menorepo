#!/usr/bin/env python3
"""
Test Market Data Integration and Strategy Execution

This script directly tests the market data manager and strategy execution
without going through the web API to verify core functionality.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta

# Add trading_api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'trading_api'))

from database.connection_manager import DatabaseManager
from database.repositories.market_data import MarketDataRepository
from core.market_data.manager import MarketDataManager
from core.market_data.providers.yahoo_finance import YahooFinanceProvider
from events.event_bus import EventBus
from strategies.moving_average_crossover import MovingAverageCrossoverStrategy

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    """Test market data integration and strategy execution."""
    logger.info("Starting market data and strategy test...")
    
    try:
        # Initialize database connection
        logger.info("Initializing database connection...")
        db_manager = DatabaseManager(
            database_url="postgresql://pi5trader:trading_secure_2025@timescaledb:5432/pi5_trading",
            max_connections=5,
            retry_attempts=3,
            retry_delay=2.0
        )
        await db_manager.initialize()
        logger.info("Database connection established")
        
        # Initialize event bus
        logger.info("Starting event bus...")
        event_bus = EventBus()
        await event_bus.start()
        logger.info("Event bus started")
        
        # Initialize market data components
        logger.info("Initializing market data components...")
        market_data_repo = MarketDataRepository(db_manager)
        yahoo_provider = YahooFinanceProvider(name="yahoo_finance", priority=10)
        
        # Create market data manager
        market_data_manager = MarketDataManager(
            market_data_repo=market_data_repo,
            event_bus=event_bus,
            providers=[yahoo_provider]
        )
        await market_data_manager.start()
        logger.info("Market data manager started")
        
        # Test market data provider status
        logger.info("Testing market data provider status...")
        provider_status = market_data_manager.get_provider_status()
        logger.info(f"Provider status: {provider_status}")
        
        # Test symbol info retrieval
        logger.info("Testing symbol info retrieval...")
        test_symbol = "AAPL"
        symbol_info = await market_data_manager.get_symbol_info(test_symbol)
        if symbol_info:
            logger.info(f"Symbol info for {test_symbol}: {symbol_info}")
        else:
            logger.warning(f"No symbol info found for {test_symbol}")
        
        # Test historical data retrieval
        logger.info("Testing historical data retrieval...")
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        df = await market_data_manager.get_historical_data(
            symbol=test_symbol,
            start_date=start_date,
            end_date=end_date,
            interval="1d"
        )
        
        if not df.empty:
            logger.info(f"Retrieved {len(df)} historical data points for {test_symbol}")
            logger.info(f"Date range: {df.index.min()} to {df.index.max()}")
            logger.info(f"Latest close price: {df['close'].iloc[-1]}")
        else:
            logger.warning(f"No historical data retrieved for {test_symbol}")
        
        # Test strategy initialization and execution
        logger.info("Testing strategy initialization...")
        strategy = MovingAverageCrossoverStrategy(
            name="Test_MA_Strategy",
            parameters={
                'short_period': 5,
                'long_period': 20,
                'confidence_threshold': 0.5
            },
            symbols=[test_symbol]
        )
        
        await strategy.initialize()
        logger.info("Strategy initialized successfully")
        
        # Simulate market data events using historical data
        if not df.empty:
            logger.info("Simulating market data events...")
            signal_count = 0
            
            for timestamp, row in df.tail(10).iterrows():
                # Create market data event
                from events.event_types import MarketDataEvent
                
                market_data_event = MarketDataEvent(
                    symbol=test_symbol,
                    timestamp=timestamp,
                    open_price=float(row['open']),
                    high_price=float(row['high']),
                    low_price=float(row['low']),
                    close_price=float(row['close']),
                    volume=int(row['volume']) if pd.notna(row['volume']) else 0
                )
                
                # Process market data with strategy
                signals = await strategy.on_market_data(market_data_event)
                
                if signals:
                    signal_count += len(signals)
                    for signal in signals:
                        logger.info(f"Generated signal: {signal.signal_type} for {signal.symbol} "
                                   f"at {signal.price} (confidence: {signal.confidence:.2f})")
                
                # Small delay to simulate real-time processing
                await asyncio.sleep(0.1)
            
            logger.info(f"Generated {signal_count} trading signals")
            
            # Get strategy performance metrics
            metrics = strategy.get_performance_metrics()
            logger.info(f"Strategy metrics: {metrics}")
        
        # Test statistics
        statistics = market_data_manager.get_statistics()
        logger.info(f"Market data statistics: {statistics}")
        
        logger.info("✅ Market data integration and strategy test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}", exc_info=True)
        return False
    
    finally:
        # Cleanup
        try:
            if 'market_data_manager' in locals():
                await market_data_manager.stop()
            if 'event_bus' in locals():
                await event_bus.stop()
            if 'db_manager' in locals():
                await db_manager.close()
            logger.info("Cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    return True


if __name__ == "__main__":
    import pandas as pd
    success = asyncio.run(main())
    sys.exit(0 if success else 1)