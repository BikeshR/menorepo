#!/usr/bin/env python3
"""
Test Real-time Optimized Strategy Performance

Compares the performance of the real-time optimized Moving Average strategy
against the standard version to demonstrate the optimizations.
"""

import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Add trading_api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'trading_api'))

from events.event_bus import EventBus
from events.event_types import MarketDataEvent
from strategies.moving_average_crossover import MovingAverageCrossoverStrategy
from strategies.realtime_moving_average import RealTimeMovingAverageStrategy

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_realistic_market_data(symbol: str, days: int = 30, base_price: float = 100.0) -> pd.DataFrame:
    """Generate realistic high-frequency market data for performance testing."""
    logger.info(f"Generating {days} days of high-frequency market data for {symbol}")
    
    np.random.seed(42)  # Reproducible results
    
    # Generate intraday data (every minute for better real-time simulation)
    periods = days * 24 * 60  # Minutes in the period
    start_time = datetime.utcnow() - timedelta(days=days)
    timestamps = pd.date_range(start=start_time, periods=periods, freq='1T')
    
    # Generate realistic price movements
    returns = np.random.normal(0.00001, 0.001, periods)  # Very small returns for minute data
    
    # Add some trending patterns and volatility clustering
    for i in range(1, len(returns)):
        # Trend persistence
        if i > 1:
            returns[i] += returns[i-1] * 0.1
        
        # Volatility clustering
        if i > 20:
            recent_vol = np.std(returns[i-20:i])
            returns[i] *= (1 + recent_vol * 2)
    
    # Calculate prices
    prices = [base_price]
    for ret in returns[1:]:
        prices.append(prices[-1] * (1 + ret))
    
    # Generate OHLCV data
    data = []
    for i, (timestamp, price) in enumerate(zip(timestamps, prices)):
        # Small random variations for OHLC
        noise = np.random.normal(0, 0.001, 4)
        
        open_price = price * (1 + noise[0])
        high_price = max(open_price, price) * (1 + abs(noise[1]) * 0.5)
        low_price = min(open_price, price) * (1 - abs(noise[2]) * 0.5)
        close_price = price
        volume = max(int(np.random.normal(50000, 15000)), 1000)
        
        data.append({
            'timestamp': timestamp,
            'open': open_price,
            'high': high_price,
            'low': low_price,
            'close': close_price,
            'volume': volume
        })
    
    df = pd.DataFrame(data)
    df.set_index('timestamp', inplace=True)
    
    logger.info(f"Generated {len(df)} data points from {df.index.min()} to {df.index.max()}")
    logger.info(f"Price range: ${df['close'].min():.2f} to ${df['close'].max():.2f}")
    
    return df


async def benchmark_strategy(strategy, strategy_name: str, market_data: pd.DataFrame) -> dict:
    """Benchmark a strategy with market data."""
    logger.info(f"Benchmarking {strategy_name}...")
    
    # Performance tracking
    processing_times = []
    memory_usage = []
    signals = []
    
    # Process market data
    start_time = time.time()
    
    for i, (timestamp, row) in enumerate(market_data.iterrows()):
        event_start = time.time()
        
        market_data_event = MarketDataEvent(
            symbol="AAPL",
            timestamp=timestamp,
            open_price=float(row['open']),
            high_price=float(row['high']),
            low_price=float(row['low']),
            close_price=float(row['close']),
            volume=int(row['volume'])
        )
        
        try:
            strategy_signals = await strategy.on_market_data(market_data_event)
            signals.extend(strategy_signals)
            
            # Track processing time for each event
            processing_times.append((time.time() - event_start) * 1000)  # ms
            
            # Simulate memory tracking (simplified)
            if hasattr(strategy, 'get_performance_metrics'):
                metrics = strategy.get_performance_metrics()
                if 'signals_generated' in metrics:
                    memory_usage.append(metrics.get('signals_generated', 0))
        
        except Exception as e:
            if "insufficient history" not in str(e).lower():
                logger.warning(f"Error processing event {i}: {e}")
    
    total_time = time.time() - start_time
    
    # Calculate performance metrics
    if processing_times:
        avg_processing_time = np.mean(processing_times)
        max_processing_time = max(processing_times)
        p95_processing_time = np.percentile(processing_times, 95)
    else:
        avg_processing_time = max_processing_time = p95_processing_time = 0
    
    # Get strategy-specific metrics
    strategy_metrics = {}
    if hasattr(strategy, 'get_performance_metrics'):
        strategy_metrics = strategy.get_performance_metrics()
    
    # Get real-time specific metrics
    realtime_metrics = {}
    if hasattr(strategy, 'get_real_time_status'):
        realtime_metrics = strategy.get_real_time_status()
    
    return {
        'strategy_name': strategy_name,
        'total_processing_time': round(total_time, 3),
        'avg_processing_time_ms': round(avg_processing_time, 3),
        'max_processing_time_ms': round(max_processing_time, 3),
        'p95_processing_time_ms': round(p95_processing_time, 3),
        'total_signals': len(signals),
        'events_processed': len(processing_times),
        'throughput_events_per_sec': round(len(processing_times) / total_time if total_time > 0 else 0, 1),
        'strategy_metrics': strategy_metrics,
        'realtime_metrics': realtime_metrics,
        'signals': signals
    }


async def main():
    """Compare standard vs real-time optimized strategy performance."""
    logger.info("Starting real-time strategy performance comparison...")
    
    try:
        # Initialize event bus
        event_bus = EventBus()
        await event_bus.start()
        logger.info("Event bus started")
        
        # Generate high-frequency market data for testing
        test_symbol = "AAPL"
        market_data = generate_realistic_market_data(test_symbol, days=1, base_price=150.0)  # 1 day = 1440 data points
        
        # Test parameters
        test_parameters = {
            'short_period': 5,
            'long_period': 20,
            'confidence_threshold': 0.5,
            'min_volume': 1000
        }
        
        # Initialize standard strategy
        logger.info("Initializing standard Moving Average strategy...")
        standard_strategy = MovingAverageCrossoverStrategy(
            name="Standard_MA_Test",
            parameters=test_parameters,
            symbols=[test_symbol]
        )
        await standard_strategy.initialize()
        
        # Initialize real-time optimized strategy  
        logger.info("Initializing real-time optimized Moving Average strategy...")
        realtime_strategy = RealTimeMovingAverageStrategy(
            name="RealTime_MA_Test", 
            parameters={
                **test_parameters,
                'signal_cooldown_seconds': 60,  # 1 minute cooldown
                'price_change_threshold': 0.0001  # Very sensitive to price changes
            },
            symbols=[test_symbol]
        )
        await realtime_strategy.initialize()
        
        # Benchmark both strategies
        logger.info("Benchmarking standard strategy...")
        standard_results = await benchmark_strategy(standard_strategy, "Standard MA", market_data)
        
        logger.info("Benchmarking real-time optimized strategy...")
        realtime_results = await benchmark_strategy(realtime_strategy, "Real-time MA", market_data)
        
        # Compare results
        logger.info("\n" + "="*80)
        logger.info("PERFORMANCE COMPARISON RESULTS")
        logger.info("="*80)
        
        # Processing speed comparison
        speed_improvement = (
            (standard_results['avg_processing_time_ms'] - realtime_results['avg_processing_time_ms']) 
            / standard_results['avg_processing_time_ms'] * 100
            if standard_results['avg_processing_time_ms'] > 0 else 0
        )
        
        throughput_improvement = (
            (realtime_results['throughput_events_per_sec'] - standard_results['throughput_events_per_sec'])
            / standard_results['throughput_events_per_sec'] * 100
            if standard_results['throughput_events_per_sec'] > 0 else 0
        )
        
        logger.info(f"📊 Processing Speed:")
        logger.info(f"  Standard MA:      {standard_results['avg_processing_time_ms']:.3f} ms avg")
        logger.info(f"  Real-time MA:     {realtime_results['avg_processing_time_ms']:.3f} ms avg")
        logger.info(f"  Speed improvement: {speed_improvement:+.1f}%")
        
        logger.info(f"\n📈 Throughput:")
        logger.info(f"  Standard MA:      {standard_results['throughput_events_per_sec']:.1f} events/sec")
        logger.info(f"  Real-time MA:     {realtime_results['throughput_events_per_sec']:.1f} events/sec")
        logger.info(f"  Throughput improvement: {throughput_improvement:+.1f}%")
        
        logger.info(f"\n📡 Signal Generation:")
        logger.info(f"  Standard MA:      {standard_results['total_signals']} signals")
        logger.info(f"  Real-time MA:     {realtime_results['total_signals']} signals")
        
        # Real-time specific metrics
        if realtime_results['realtime_metrics']:
            rt_metrics = realtime_results['realtime_metrics']
            logger.info(f"\n⚡ Real-time Optimizations:")
            if 'cache_stats' in rt_metrics:
                cache_stats = rt_metrics['cache_stats']
                total_requests = cache_stats.get('hits', 0) + cache_stats.get('misses', 0)
                hit_rate = cache_stats.get('hits', 0) / total_requests * 100 if total_requests > 0 else 0
                logger.info(f"  Cache hit rate:   {hit_rate:.1f}% ({cache_stats})")
            
            if 'symbols_tracked' in rt_metrics:
                logger.info(f"  Symbols tracked:  {rt_metrics['symbols_tracked']}")
                logger.info(f"  MAs initialized:  {rt_metrics['mas_initialized']}")
        
        # Performance summary
        logger.info("\n" + "="*80)
        if speed_improvement > 0 or throughput_improvement > 0:
            logger.info("✅ REAL-TIME OPTIMIZATION SUCCESSFUL!")
            logger.info(f"   Average {speed_improvement:.1f}% faster processing")
            logger.info(f"   {throughput_improvement:.1f}% higher throughput")
        else:
            logger.info("⚠️  Performance similar - optimizations may need tuning for this dataset")
        
        logger.info("✅ Real-time strategy enhancement testing completed!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Real-time strategy test failed: {e}", exc_info=True)
        return False
    
    finally:
        # Cleanup
        try:
            if 'event_bus' in locals():
                await event_bus.stop()
            logger.info("Cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)