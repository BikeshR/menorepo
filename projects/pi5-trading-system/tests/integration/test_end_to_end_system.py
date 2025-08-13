"""
End-to-End Integration Tests for Pi5 Trading System.

Tests complete trading workflows from market data ingestion through
strategy execution, signal aggregation, risk management, and backtesting.
These tests validate the entire system working together as a cohesive unit.
"""

import pytest
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Any
import tempfile
import os

from core.market_data import (
    MarketDataManager,
    YahooFinanceProvider,
    AlphaVantageProvider,
    TechnicalIndicators,
    DataQualityValidator
)
from strategies.rsi_mean_reversion import RSIMeanReversionStrategy
from strategies.momentum_trend_following import MomentumTrendFollowingStrategy
from strategies.enhanced_base import EnhancedBaseStrategy
from strategies.manager import (
    EnhancedStrategyManager,
    StrategyAllocation,
    SignalAggregationMethod,
    ConflictResolutionMode
)
from backtesting.engine import BacktestingEngine, BacktestConfig, ExecutionModel
from events.event_bus import EventBus
from events.event_types import MarketDataEvent
from core.interfaces import Signal, TradingSignal


@pytest.fixture
def realistic_market_data():
    """Generate realistic market data for comprehensive testing."""
    np.random.seed(12345)
    
    # Generate 3 months of minute data
    start_date = datetime(2024, 1, 1, 9, 30)  # Market open
    end_date = datetime(2024, 3, 31, 16, 0)   # Market close
    
    # Create trading hours only (9:30-16:00 EST, Mon-Fri)
    dates = []
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:  # Monday = 0, Friday = 4
            if 9.5 <= current.hour + current.minute/60 <= 16:
                dates.append(current)
        current += timedelta(minutes=1)
    
    n_points = len(dates)
    
    # Create multiple stocks with different characteristics
    stocks = {
        'AAPL': {'base_price': 150, 'volatility': 0.02, 'trend': 0.15},    # Tech growth
        'MSFT': {'base_price': 300, 'volatility': 0.018, 'trend': 0.12},  # Stable tech
        'SPY': {'base_price': 400, 'volatility': 0.012, 'trend': 0.08},   # Market index
        'TSLA': {'base_price': 200, 'volatility': 0.035, 'trend': 0.25},  # High volatility
        'JNJ': {'base_price': 160, 'volatility': 0.008, 'trend': 0.05}    # Defensive
    }
    
    market_data = {}
    
    for symbol, params in stocks.items():
        # Generate realistic price movements
        base_price = params['base_price']
        volatility = params['volatility']
        annual_trend = params['trend']
        
        # Create trending returns with mean reversion and volatility clustering
        trend_component = np.linspace(0, annual_trend, n_points)
        
        # Add volatility clustering (GARCH-like)
        vol_series = np.ones(n_points) * volatility
        random_shocks = np.random.normal(0, 1, n_points)
        
        for i in range(1, n_points):
            # Volatility clustering
            vol_series[i] = 0.05 * volatility + 0.9 * vol_series[i-1] + 0.05 * (random_shocks[i-1]**2)
        
        # Generate returns
        returns = trend_component / 252 + vol_series * random_shocks
        
        # Add intraday patterns
        for i, dt in enumerate(dates):
            hour = dt.hour + dt.minute / 60
            # Higher volatility at open/close
            if hour < 10.5 or hour > 15.5:
                returns[i] *= 1.5
            # Lower volatility at lunch
            elif 12 <= hour <= 13:
                returns[i] *= 0.7
        
        # Convert to prices
        log_prices = np.log(base_price) + np.cumsum(returns)
        prices = np.exp(log_prices)
        
        # Generate OHLCV
        opens = prices.copy()
        closes = prices.copy()
        
        # Add realistic intra-period movements
        high_mult = np.random.uniform(1.0, 1.008, n_points)  # 0-0.8% above
        low_mult = np.random.uniform(0.992, 1.0, n_points)   # 0-0.8% below
        
        highs = np.maximum(opens, closes) * high_mult
        lows = np.minimum(opens, closes) * low_mult
        
        # Generate volume with patterns
        base_volume = {'AAPL': 50000, 'MSFT': 30000, 'SPY': 100000, 'TSLA': 80000, 'JNJ': 20000}[symbol]
        volume = np.random.lognormal(np.log(base_volume), 0.5, n_points)
        
        # Higher volume on big moves
        price_changes = np.abs(np.diff(np.concatenate([[prices[0]], prices])))
        volume_multiplier = 1 + 2 * (price_changes / np.std(price_changes))
        volume = volume * np.clip(volume_multiplier, 0.5, 3.0)
        
        # Create DataFrame
        stock_data = pd.DataFrame({
            'timestamp': dates,
            'symbol': symbol,
            'open': opens,
            'high': highs,
            'low': lows,
            'close': closes,
            'volume': volume.astype(int)
        })
        
        market_data[symbol] = stock_data
    
    return market_data


@pytest.fixture
async def integrated_market_data_manager(realistic_market_data):
    """Create MarketDataManager with realistic data."""
    
    # Create mock providers
    yahoo_provider = AsyncMock(spec=YahooFinanceProvider)
    yahoo_provider.name = "yahoo_finance"
    yahoo_provider.priority = 1
    
    alpha_provider = AsyncMock(spec=AlphaVantageProvider) 
    alpha_provider.name = "alpha_vantage"
    alpha_provider.priority = 2
    
    # Configure providers to return realistic data
    def get_data_for_symbol(symbol, start_date, end_date, **kwargs):
        if symbol in realistic_market_data:
            data = realistic_market_data[symbol].copy()
            mask = (data['timestamp'] >= start_date) & (data['timestamp'] <= end_date)
            filtered_data = data[mask].copy()
            
            if not filtered_data.empty:
                filtered_data = filtered_data.set_index('timestamp')
                del filtered_data['symbol']
                return filtered_data
        
        return pd.DataFrame()
    
    yahoo_provider.get_historical_data.side_effect = get_data_for_symbol
    alpha_provider.get_historical_data.side_effect = get_data_for_symbol
    
    # Set up health checks
    yahoo_provider.is_healthy.return_value = True
    alpha_provider.is_healthy.return_value = True
    
    yahoo_provider.get_rate_limit_status.return_value = {
        'requests_per_minute': 100, 'requests_made': 5, 'reset_time': datetime.utcnow() + timedelta(minutes=1)
    }
    alpha_provider.get_rate_limit_status.return_value = {
        'requests_per_minute': 75, 'requests_made': 2, 'reset_time': datetime.utcnow() + timedelta(minutes=1)
    }
    
    # Create manager
    manager = MarketDataManager(
        cache_ttl_minutes=15,
        max_cache_size=1000,
        enable_circuit_breaker=True
    )
    
    # Add providers
    manager.add_provider(yahoo_provider)
    manager.add_provider(alpha_provider)
    
    await manager.initialize()
    
    return manager


@pytest.fixture
async def integrated_strategy_manager(integrated_market_data_manager):
    """Create fully integrated strategy manager."""
    
    event_bus = EventBus()
    
    manager = EnhancedStrategyManager(
        event_bus=event_bus,
        db_manager=None,  # Not needed for integration tests
        total_capital=500000.0,
        max_portfolio_risk=0.20,
        signal_aggregation_method=SignalAggregationMethod.WEIGHTED_AVERAGE,
        conflict_resolution_mode=ConflictResolutionMode.HIGHEST_CONFIDENCE,
        enable_dynamic_allocation=True,
        rebalance_frequency=30  # 30 minutes
    )
    
    await manager.start()
    return manager


class TestCompleteMarketDataPipeline:
    """Test complete market data pipeline with all components."""
    
    @pytest.mark.asyncio
    async def test_full_data_pipeline_with_indicators(self, integrated_market_data_manager):
        """Test complete data pipeline from providers through indicators."""
        
        manager = integrated_market_data_manager
        
        # Request data for multiple symbols
        symbols = ['AAPL', 'MSFT', 'SPY']
        start_date = datetime(2024, 1, 15)
        end_date = datetime(2024, 1, 31)
        
        all_data = {}
        
        for symbol in symbols:
            # Get historical data
            data = await manager.get_historical_data(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                interval='1min'
            )
            
            assert not data.empty, f"No data returned for {symbol}"
            assert len(data) > 1000, f"Insufficient data for {symbol}: {len(data)} rows"
            
            # Verify data quality
            validator = DataQualityValidator()
            validation_result = validator.validate_ohlcv_data(data, symbol)
            
            assert validation_result.is_valid, f"Data quality issues for {symbol}: {len(validation_result.issues)} issues"
            
            # Calculate technical indicators
            indicators = TechnicalIndicators()
            indicators_config = {
                'sma': {'periods': [20, 50]},
                'ema': {'periods': [12, 26]},
                'rsi': {'period': 14},
                'macd': {'fast_period': 12, 'slow_period': 26, 'signal_period': 9},
                'bollinger_bands': {'period': 20, 'std_dev': 2.0},
                'atr': {'period': 14}
            }
            
            enhanced_data = indicators.calculate_multiple_indicators(
                ohlcv_data=data,
                indicators=indicators_config
            )
            
            # Verify indicators were calculated
            expected_columns = ['sma_20', 'sma_50', 'ema_12', 'ema_26', 'rsi', 'macd', 'signal', 'histogram', 'bb_upper', 'bb_middle', 'bb_lower', 'atr']
            
            for col in expected_columns:
                assert col in enhanced_data.columns, f"Missing indicator {col} for {symbol}"
                # Should have valid values (not all NaN)
                assert not enhanced_data[col].isna().all(), f"All NaN values for {col} in {symbol}"
            
            all_data[symbol] = enhanced_data
        
        # Verify cross-symbol consistency
        for symbol, data in all_data.items():
            assert len(data) > 0
            # RSI should be bounded 0-100
            rsi_values = data['rsi'].dropna()
            assert (rsi_values >= 0).all() and (rsi_values <= 100).all()
            
            # SMA_50 should be smoother than SMA_20
            sma_20_vol = data['sma_20'].diff().std()
            sma_50_vol = data['sma_50'].diff().std()
            assert sma_50_vol < sma_20_vol, f"SMA_50 not smoother than SMA_20 for {symbol}"
    
    @pytest.mark.asyncio
    async def test_provider_failover_in_integrated_system(self, realistic_market_data):
        """Test provider failover in integrated system."""
        
        # Create manager with one failing provider
        yahoo_provider = AsyncMock(spec=YahooFinanceProvider)
        yahoo_provider.name = "yahoo_finance"
        yahoo_provider.priority = 1
        yahoo_provider.is_healthy.return_value = False  # Failing
        yahoo_provider.get_historical_data.side_effect = Exception("Provider failed")
        
        alpha_provider = AsyncMock(spec=AlphaVantageProvider)
        alpha_provider.name = "alpha_vantage"
        alpha_provider.priority = 2
        alpha_provider.is_healthy.return_value = True
        alpha_provider.get_historical_data.return_value = realistic_market_data['AAPL'].set_index('timestamp').drop('symbol', axis=1)
        alpha_provider.get_rate_limit_status.return_value = {
            'requests_per_minute': 75, 'requests_made': 1, 'reset_time': datetime.utcnow() + timedelta(minutes=1)
        }
        
        manager = MarketDataManager()
        manager.add_provider(yahoo_provider)
        manager.add_provider(alpha_provider)
        await manager.initialize()
        
        # Request should succeed via failover
        data = await manager.get_historical_data(
            symbol='AAPL',
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            interval='1min'
        )
        
        assert not data.empty
        # Primary provider should not have been used
        yahoo_provider.get_historical_data.assert_not_called()
        # Secondary provider should have been used
        alpha_provider.get_historical_data.assert_called_once()


class TestIntegratedStrategyExecution:
    """Test integrated strategy execution with real market data."""
    
    @pytest.mark.asyncio
    async def test_rsi_strategy_with_real_data(self, integrated_market_data_manager):
        """Test RSI strategy execution with realistic market data."""
        
        # Create RSI strategy
        strategy = RSIMeanReversionStrategy(
            market_data_manager=integrated_market_data_manager,
            parameters={
                'rsi_period': 14,
                'oversold_threshold': 30,
                'overbought_threshold': 70,
                'stop_loss_pct': 2.5,
                'take_profit_pct': 5.0,
                'max_position_size': 0.1,
                'risk_per_trade': 0.02,
                'min_rsi_duration': 2
            },
            watched_symbols=['AAPL', 'MSFT']
        )
        
        await strategy.initialize()
        
        # Process realistic market data
        signals_generated = []
        market_events = []
        
        # Create market events from realistic data for 1 week
        start_time = datetime(2024, 1, 15, 10, 0)
        end_time = datetime(2024, 1, 19, 15, 0)
        
        current_time = start_time
        while current_time <= end_time:
            if current_time.weekday() < 5 and 9.5 <= current_time.hour + current_time.minute/60 <= 16:
                for symbol in ['AAPL', 'MSFT']:
                    # Create realistic market event
                    market_event = MarketDataEvent(
                        symbol=symbol,
                        timestamp=current_time,
                        open_price=150.0 + np.random.normal(0, 2),
                        high_price=152.0 + np.random.normal(0, 2),
                        low_price=148.0 + np.random.normal(0, 2),
                        close_price=151.0 + np.random.normal(0, 2),
                        volume=50000 + np.random.randint(-10000, 10000),
                        bid_price=150.8,
                        ask_price=151.2
                    )
                    
                    try:
                        signals = await strategy.on_market_data(market_event)
                        signals_generated.extend(signals)
                        market_events.append(market_event)
                        
                        # Simulate some time passing
                        if len(market_events) > 100:  # Limit for testing
                            break
                            
                    except Exception as e:
                        # Should handle errors gracefully
                        pass
                        
            current_time += timedelta(minutes=5)
            if len(market_events) > 100:
                break
        
        # Verify strategy behavior
        assert len(market_events) > 50, "Should have processed sufficient market events"
        
        # Strategy should generate some signals with realistic data
        # (though may be zero if conditions not met)
        for signal in signals_generated:
            assert signal.symbol in ['AAPL', 'MSFT']
            assert signal.signal_type in [TradingSignal.BUY, TradingSignal.SELL]
            assert 0 <= signal.confidence <= 1
            assert signal.price > 0
            assert signal.strategy_name == strategy.name
        
        # Get strategy statistics
        stats = strategy.get_strategy_statistics()
        assert 'strategy_type' in stats
        assert stats['strategy_type'] == 'RSI Mean Reversion'
        assert 'watched_symbols' in stats
        assert len(stats['watched_symbols']) == 2
    
    @pytest.mark.asyncio
    async def test_momentum_strategy_with_trending_data(self, integrated_market_data_manager):
        """Test momentum strategy with trending market data."""
        
        strategy = MomentumTrendFollowingStrategy(
            market_data_manager=integrated_market_data_manager,
            parameters={
                'fast_ema_period': 8,
                'slow_ema_period': 21,
                'trend_ema_period': 50,
                'adx_threshold': 25,
                'initial_stop_atr': 2.0,
                'max_position_size': 0.15,
                'use_pyramid': True,
                'max_pyramid_levels': 2
            },
            watched_symbols=['TSLA', 'SPY']  # Use volatile and stable assets
        )
        
        await strategy.initialize()
        
        # Simulate trending market conditions
        base_price = 200.0
        trend_multiplier = 1.0
        
        for i in range(200):  # Simulate 200 time periods
            trend_multiplier += 0.001  # Gradual uptrend
            current_price = base_price * trend_multiplier
            
            for symbol in ['TSLA', 'SPY']:
                price_mult = 2.0 if symbol == 'SPY' else 1.0
                
                market_event = MarketDataEvent(
                    symbol=symbol,
                    timestamp=datetime(2024, 1, 15) + timedelta(minutes=i),
                    open_price=current_price * price_mult,
                    high_price=current_price * price_mult * 1.005,
                    low_price=current_price * price_mult * 0.995,
                    close_price=current_price * price_mult * 1.002,
                    volume=75000,
                    bid_price=current_price * price_mult * 1.001,
                    ask_price=current_price * price_mult * 1.003
                )
                
                try:
                    signals = await strategy.on_market_data(market_event)
                    # Process any signals generated
                    for signal in signals:
                        assert signal.symbol == symbol
                        assert isinstance(signal.metadata, dict)
                        
                except Exception:
                    # Handle any strategy errors gracefully
                    pass
        
        # Verify momentum strategy state
        stats = strategy.get_strategy_statistics()
        assert stats['strategy_type'] == 'Momentum/Trend Following'
        assert 'trend_directions' in stats
        assert 'trend_strengths' in stats


class TestMultiStrategyCoordination:
    """Test complete multi-strategy coordination workflows."""
    
    @pytest.mark.asyncio
    async def test_complete_multi_strategy_workflow(self, integrated_market_data_manager, integrated_strategy_manager):
        """Test complete multi-strategy coordination workflow."""
        
        # Create diverse strategy portfolio
        rsi_conservative = RSIMeanReversionStrategy(
            name="RSI_Conservative",
            market_data_manager=integrated_market_data_manager,
            parameters={'oversold_threshold': 20, 'overbought_threshold': 80},
            watched_symbols=['AAPL', 'MSFT', 'JNJ']
        )
        
        rsi_aggressive = RSIMeanReversionStrategy(
            name="RSI_Aggressive", 
            market_data_manager=integrated_market_data_manager,
            parameters={'oversold_threshold': 35, 'overbought_threshold': 65},
            watched_symbols=['AAPL', 'TSLA']
        )
        
        momentum_strategy = MomentumTrendFollowingStrategy(
            name="Momentum_Primary",
            market_data_manager=integrated_market_data_manager,
            parameters={'fast_ema_period': 12, 'slow_ema_period': 26},
            watched_symbols=['SPY', 'TSLA', 'MSFT']
        )
        
        # Create strategic allocations
        allocations = [
            StrategyAllocation("", 0.5, 250000, 0.02, 1),  # RSI Conservative - 50%
            StrategyAllocation("", 0.3, 150000, 0.025, 2), # RSI Aggressive - 30%  
            StrategyAllocation("", 0.2, 100000, 0.03, 3)   # Momentum - 20%
        ]
        
        strategies = [rsi_conservative, rsi_aggressive, momentum_strategy]
        
        # Register strategies
        strategy_ids = []
        for strategy, allocation in zip(strategies, allocations):
            strategy_id = integrated_strategy_manager.register_strategy(
                strategy=strategy,
                allocation=allocation
            )
            strategy_ids.append(strategy_id)
        
        # Start all strategies
        for strategy_id in strategy_ids:
            await integrated_strategy_manager.start_strategy(strategy_id)
        
        # Create strategy groups
        integrated_strategy_manager.create_strategy_group(
            group_name="mean_reversion_group",
            strategy_ids=strategy_ids[:2],  # Both RSI strategies
            group_weight=0.8
        )
        
        # Simulate market data processing
        symbols = ['AAPL', 'MSFT', 'SPY', 'TSLA', 'JNJ']
        processed_events = 0
        
        for i in range(50):  # Process 50 market events
            timestamp = datetime(2024, 1, 15, 10) + timedelta(minutes=i)
            
            for symbol in symbols:
                # Create realistic market event
                base_price = {'AAPL': 150, 'MSFT': 300, 'SPY': 400, 'TSLA': 200, 'JNJ': 160}[symbol]
                noise = np.random.normal(0, base_price * 0.01)
                
                market_event = MarketDataEvent(
                    symbol=symbol,
                    timestamp=timestamp,
                    open_price=base_price + noise,
                    high_price=base_price + noise + abs(np.random.normal(0, base_price * 0.005)),
                    low_price=base_price + noise - abs(np.random.normal(0, base_price * 0.005)),
                    close_price=base_price + noise + np.random.normal(0, base_price * 0.003),
                    volume=50000 + np.random.randint(-20000, 20000)
                )
                
                # Process through strategy manager
                await integrated_strategy_manager._handle_market_data_event(market_event)
                processed_events += 1
        
        # Verify system processed events
        assert processed_events > 0
        
        # Check strategy manager status
        status = integrated_strategy_manager.get_enhanced_portfolio_status()
        
        assert status['total_strategies'] == 3
        assert status['running_strategies'] == 3
        assert 'strategy_allocations' in status
        assert 'portfolio_risk_metrics' in status
        assert 'strategy_groups' in status
        
        # Verify strategy groups
        assert 'mean_reversion_group' in status['strategy_groups']
        assert len(status['strategy_groups']['mean_reversion_group']) == 2
        
        # Test portfolio rebalancing
        await integrated_strategy_manager.rebalance_portfolio()
        assert integrated_strategy_manager._last_rebalance is not None
        
        # Test risk calculation
        risk_metrics = integrated_strategy_manager.calculate_portfolio_risk()
        assert risk_metrics.total_exposure >= 0
        assert isinstance(risk_metrics.symbol_exposures, dict)
        assert isinstance(risk_metrics.strategy_exposures, dict)
    
    @pytest.mark.asyncio
    async def test_signal_aggregation_under_load(self, integrated_strategy_manager, integrated_market_data_manager):
        """Test signal aggregation with multiple simultaneous signals."""
        
        # Register multiple strategies
        strategies = []
        for i in range(4):
            strategy = RSIMeanReversionStrategy(
                name=f"RSI_Strategy_{i}",
                market_data_manager=integrated_market_data_manager,
                parameters={'oversold_threshold': 25 + i*5, 'overbought_threshold': 75 - i*5},
                watched_symbols=['AAPL']
            )
            
            allocation = StrategyAllocation(f"strat_{i}", 0.25, 125000, 0.02, i+1)
            strategy_id = integrated_strategy_manager.register_strategy(strategy, allocation=allocation)
            await integrated_strategy_manager.start_strategy(strategy_id)
            strategies.append((strategy, strategy_id))
        
        # Create conflicting signals
        signals = [
            Signal('AAPL', TradingSignal.BUY, 0.8, 150.0, datetime.utcnow(), 'RSI_Strategy_0', {'position_size': 0.1}),
            Signal('AAPL', TradingSignal.BUY, 0.6, 150.2, datetime.utcnow(), 'RSI_Strategy_1', {'position_size': 0.08}),
            Signal('AAPL', TradingSignal.SELL, 0.7, 149.8, datetime.utcnow(), 'RSI_Strategy_2', {'position_size': 0.12}),
            Signal('AAPL', TradingSignal.BUY, 0.9, 150.1, datetime.utcnow(), 'RSI_Strategy_3', {'position_size': 0.15})
        ]
        
        # Add to pending signals
        integrated_strategy_manager._pending_signals['AAPL'] = signals
        
        # Test different aggregation methods
        for method in [SignalAggregationMethod.WEIGHTED_AVERAGE, SignalAggregationMethod.HIGHEST_CONFIDENCE, SignalAggregationMethod.CONSENSUS]:
            integrated_strategy_manager.signal_aggregation_method = method
            
            aggregated = await integrated_strategy_manager.aggregate_signals('AAPL')
            
            if aggregated:
                assert aggregated.symbol == 'AAPL'
                assert aggregated.aggregation_method == method
                assert len(aggregated.contributing_strategies) > 0
                assert 0 <= aggregated.confidence <= 1
                assert aggregated.position_size >= 0


class TestCompleteBacktestingWorkflow:
    """Test complete backtesting workflows with integrated system."""
    
    @pytest.mark.asyncio
    async def test_end_to_end_single_strategy_backtest(self, realistic_market_data):
        """Test complete single strategy backtest with realistic data."""
        
        # Create integrated market data manager
        manager = AsyncMock(spec=MarketDataManager)
        
        def get_backtest_data(symbol, start_date, end_date, **kwargs):
            if symbol in realistic_market_data:
                data = realistic_market_data[symbol].copy()
                mask = (data['timestamp'] >= start_date) & (data['timestamp'] <= end_date)
                result = data[mask].copy()
                result.set_index('timestamp', inplace=True)
                del result['symbol']
                return result
            return pd.DataFrame()
        
        manager.get_historical_data.side_effect = get_backtest_data
        
        # Create backtesting engine
        backtesting_engine = BacktestingEngine(
            market_data_manager=manager,
            enable_parallel_execution=True
        )
        
        # Create optimized strategy
        strategy = RSIMeanReversionStrategy(
            market_data_manager=manager,
            parameters={
                'rsi_period': 14,
                'oversold_threshold': 25,
                'overbought_threshold': 75,
                'stop_loss_pct': 3.0,
                'take_profit_pct': 6.0,
                'max_position_size': 0.2,
                'risk_per_trade': 0.02,
                'max_daily_trades': 3
            },
            watched_symbols=['AAPL']
        )
        
        # Configure backtest
        config = BacktestConfig(
            start_date=datetime(2024, 1, 15),
            end_date=datetime(2024, 2, 15),
            initial_capital=100000.0,
            commission_rate=0.001,
            slippage_bps=2.0,
            execution_model=ExecutionModel.REALISTIC,
            max_positions=5
        )
        
        # Run comprehensive backtest
        results = await backtesting_engine.run_single_strategy_backtest(
            strategy=strategy,
            symbols=['AAPL'],
            config=config
        )
        
        # Verify comprehensive results
        assert isinstance(results, type(backtesting_engine).__module__.split('.')[-1] == 'BacktestResults')
        assert results.start_date == config.start_date
        assert results.end_date == config.end_date
        
        # Verify performance metrics
        assert isinstance(results.total_return, float)
        assert isinstance(results.sharpe_ratio, float)
        assert isinstance(results.max_drawdown, float)
        assert 0 <= results.win_rate <= 1
        
        # Verify trade analysis
        if results.trades:
            # Check trade data integrity
            for trade in results.trades:
                assert trade.entry_time <= trade.exit_time
                assert trade.quantity > 0
                assert trade.commission >= 0
                assert trade.symbol == 'AAPL'
                assert trade.strategy_name == strategy.name
        
        # Generate comprehensive report
        report = backtesting_engine.generate_report(results)
        assert "Backtesting Report" in report
        assert "Performance Metrics" in report
        assert f"Total Return: {results.total_return:.2%}" in report
    
    @pytest.mark.asyncio
    async def test_parameter_optimization_workflow(self, realistic_market_data):
        """Test complete parameter optimization workflow."""
        
        # Set up market data manager
        manager = AsyncMock(spec=MarketDataManager)
        manager.get_historical_data.side_effect = lambda symbol, **kwargs: (
            realistic_market_data[symbol].set_index('timestamp').drop('symbol', axis=1)
            if symbol in realistic_market_data else pd.DataFrame()
        )
        
        backtesting_engine = BacktestingEngine(market_data_manager=manager)
        
        # Define optimization parameters
        parameter_ranges = {
            'rsi_period': [10, 14, 20],
            'oversold_threshold': [20, 25, 30],
            'overbought_threshold': [70, 75, 80]
        }
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 15),
            end_date=datetime(2024, 1, 31),
            initial_capital=50000.0
        )
        
        # Run optimization
        optimization_results = await backtesting_engine.optimize_strategy_parameters(
            strategy_class=RSIMeanReversionStrategy,
            symbols=['AAPL'],
            config=config,
            parameter_ranges=parameter_ranges,
            optimization_metric='sharpe_ratio',
            max_iterations=10
        )
        
        # Verify optimization results
        assert 'best_parameters' in optimization_results
        assert 'best_score' in optimization_results
        assert 'all_results' in optimization_results
        
        if optimization_results['best_parameters']:
            best_params = optimization_results['best_parameters']
            assert best_params['rsi_period'] in parameter_ranges['rsi_period']
            assert best_params['oversold_threshold'] in parameter_ranges['oversold_threshold']
            assert best_params['overbought_threshold'] in parameter_ranges['overbought_threshold']
            
            # Verify parameter relationships
            assert best_params['oversold_threshold'] < best_params['overbought_threshold']


class TestSystemReliability:
    """Test system reliability and error handling."""
    
    @pytest.mark.asyncio
    async def test_system_under_stress(self, integrated_market_data_manager, integrated_strategy_manager):
        """Test system behavior under stress conditions."""
        
        # Register multiple strategies
        strategies = []
        for i in range(5):  # 5 strategies
            if i % 2 == 0:
                strategy = RSIMeanReversionStrategy(
                    name=f"RSI_{i}",
                    market_data_manager=integrated_market_data_manager,
                    watched_symbols=['AAPL', 'MSFT']
                )
            else:
                strategy = MomentumTrendFollowingStrategy(
                    name=f"Momentum_{i}",
                    market_data_manager=integrated_market_data_manager,
                    watched_symbols=['SPY', 'TSLA']
                )
            
            allocation = StrategyAllocation(f"strat_{i}", 0.2, 100000, 0.02, i)
            strategy_id = integrated_strategy_manager.register_strategy(strategy, allocation=allocation)
            await integrated_strategy_manager.start_strategy(strategy_id)
            strategies.append(strategy_id)
        
        # Stress test with rapid market events
        symbols = ['AAPL', 'MSFT', 'SPY', 'TSLA']
        events_processed = 0
        errors_caught = 0
        
        for minute in range(100):  # 100 minutes of data
            timestamp = datetime(2024, 1, 15, 10) + timedelta(minutes=minute)
            
            # Multiple events per minute
            for second in range(0, 60, 10):  # Every 10 seconds
                event_time = timestamp + timedelta(seconds=second)
                
                for symbol in symbols:
                    base_price = {'AAPL': 150, 'MSFT': 300, 'SPY': 400, 'TSLA': 200}[symbol]
                    
                    # Add some volatility
                    volatility = 0.02 + 0.01 * np.sin(minute / 10)  # Variable volatility
                    price_change = np.random.normal(0, base_price * volatility)
                    
                    market_event = MarketDataEvent(
                        symbol=symbol,
                        timestamp=event_time,
                        open_price=base_price + price_change,
                        high_price=base_price + price_change + abs(np.random.normal(0, base_price * 0.005)),
                        low_price=base_price + price_change - abs(np.random.normal(0, base_price * 0.005)),
                        close_price=base_price + price_change + np.random.normal(0, base_price * 0.002),
                        volume=50000 + np.random.randint(-25000, 25000)
                    )
                    
                    try:
                        await integrated_strategy_manager._handle_market_data_event(market_event)
                        events_processed += 1
                    except Exception as e:
                        errors_caught += 1
                        # System should handle errors gracefully
                        assert "strategy" in str(e).lower() or "error" in str(e).lower()
        
        # Verify system handled stress
        assert events_processed > 1000, f"Only processed {events_processed} events"
        assert errors_caught < events_processed * 0.1, f"Too many errors: {errors_caught}/{events_processed}"
        
        # Verify strategies are still running
        status = integrated_strategy_manager.get_enhanced_portfolio_status()
        assert status['running_strategies'] == 5
        assert status['total_strategies'] == 5
    
    @pytest.mark.asyncio
    async def test_graceful_degradation(self, integrated_strategy_manager, integrated_market_data_manager):
        """Test graceful degradation when components fail."""
        
        # Register mixed strategies (some will fail)
        working_strategy = RSIMeanReversionStrategy(
            name="Working_Strategy",
            market_data_manager=integrated_market_data_manager,
            watched_symbols=['AAPL']
        )
        
        # Create a strategy that will fail
        failing_strategy = MagicMock()
        failing_strategy.name = "Failing_Strategy"
        failing_strategy.initialize = AsyncMock()
        failing_strategy.on_market_data = AsyncMock(side_effect=Exception("Strategy failure"))
        
        # Register both
        working_id = integrated_strategy_manager.register_strategy(working_strategy)
        failing_id = integrated_strategy_manager.register_strategy(failing_strategy)
        
        await integrated_strategy_manager.start_strategy(working_id)
        await integrated_strategy_manager.start_strategy(failing_id)
        
        # Process market events
        market_event = MarketDataEvent(
            symbol='AAPL',
            timestamp=datetime.utcnow(),
            open_price=150.0,
            high_price=152.0,
            low_price=148.0,
            close_price=151.0,
            volume=50000
        )
        
        # Should handle partial failures gracefully
        await integrated_strategy_manager._handle_market_data_event(market_event)
        
        # Verify system state
        status = integrated_strategy_manager.get_enhanced_portfolio_status()
        assert status['total_strategies'] == 2
        assert status['running_strategies'] == 2  # Both still considered running
        
        # Verify errors were recorded
        assert len(integrated_strategy_manager._strategy_errors[failing_id]) > 0
        
        # Working strategy should still function
        working_metrics = integrated_strategy_manager._strategy_metrics[working_id]
        assert working_metrics['last_active'] is not None


class TestSystemIntegrationValidation:
    """Validate complete system integration."""
    
    @pytest.mark.asyncio
    async def test_complete_trading_simulation(self, realistic_market_data):
        """Test complete trading simulation from data to execution."""
        
        # This test simulates a complete trading day
        # from market open to close with all components working together
        
        # Set up integrated components
        manager = AsyncMock(spec=MarketDataManager)
        manager.get_historical_data.side_effect = lambda symbol, **kwargs: (
            realistic_market_data[symbol].set_index('timestamp').drop('symbol', axis=1)
            if symbol in realistic_market_data else pd.DataFrame()
        )
        
        event_bus = EventBus()
        strategy_manager = EnhancedStrategyManager(
            event_bus=event_bus,
            db_manager=None,
            total_capital=1000000.0,  # $1M portfolio
            max_portfolio_risk=0.15
        )
        await strategy_manager.start()
        
        # Create institutional-grade strategy portfolio
        strategies_config = [
            {
                'class': RSIMeanReversionStrategy,
                'name': 'RSI_LargeVal',
                'params': {'oversold_threshold': 25, 'overbought_threshold': 75},
                'symbols': ['AAPL', 'MSFT', 'JNJ'],
                'allocation': StrategyAllocation("", 0.4, 400000, 0.015, 1)
            },
            {
                'class': RSIMeanReversionStrategy,
                'name': 'RSI_SmallCap',
                'params': {'oversold_threshold': 20, 'overbought_threshold': 80},
                'symbols': ['TSLA'],
                'allocation': StrategyAllocation("", 0.2, 200000, 0.025, 2)
            },
            {
                'class': MomentumTrendFollowingStrategy,
                'name': 'Momentum_Index',
                'params': {'fast_ema_period': 12, 'slow_ema_period': 26},
                'symbols': ['SPY'],
                'allocation': StrategyAllocation("", 0.25, 250000, 0.02, 3)
            },
            {
                'class': MomentumTrendFollowingStrategy,
                'name': 'Momentum_Growth',
                'params': {'fast_ema_period': 8, 'slow_ema_period': 21},
                'symbols': ['AAPL', 'TSLA'],
                'allocation': StrategyAllocation("", 0.15, 150000, 0.03, 4)
            }
        ]
        
        # Register all strategies
        strategy_ids = []
        for config in strategies_config:
            strategy = config['class'](
                name=config['name'],
                market_data_manager=manager,
                parameters=config['params'],
                watched_symbols=config['symbols']
            )
            
            strategy_id = strategy_manager.register_strategy(
                strategy=strategy,
                allocation=config['allocation']
            )
            await strategy_manager.start_strategy(strategy_id)
            strategy_ids.append(strategy_id)
        
        # Create strategy groups
        strategy_manager.create_strategy_group(
            "mean_reversion", strategy_ids[:2], 0.6
        )
        strategy_manager.create_strategy_group(
            "momentum", strategy_ids[2:], 0.4
        )
        
        # Simulate full trading day
        trading_start = datetime(2024, 1, 15, 9, 30)
        trading_end = datetime(2024, 1, 15, 16, 0)
        
        current_time = trading_start
        events_processed = 0
        total_signals = 0
        
        while current_time <= trading_end:
            # Process all symbols
            for symbol in ['AAPL', 'MSFT', 'SPY', 'TSLA', 'JNJ']:
                base_price = {'AAPL': 150, 'MSFT': 300, 'SPY': 400, 'TSLA': 200, 'JNJ': 160}[symbol]
                
                # Add realistic intraday patterns
                hour = current_time.hour + current_time.minute / 60
                volatility_mult = 1.5 if hour < 10.5 or hour > 15.5 else 1.0  # Higher vol at open/close
                
                price_change = np.random.normal(0, base_price * 0.01 * volatility_mult)
                
                market_event = MarketDataEvent(
                    symbol=symbol,
                    timestamp=current_time,
                    open_price=base_price + price_change,
                    high_price=base_price + price_change + abs(np.random.normal(0, base_price * 0.003)),
                    low_price=base_price + price_change - abs(np.random.normal(0, base_price * 0.003)),
                    close_price=base_price + price_change + np.random.normal(0, base_price * 0.001),
                    volume=int(50000 * (2.0 if hour < 10 or hour > 15 else 1.0))  # Higher volume at open/close
                )
                
                # Process through integrated system
                await strategy_manager._handle_market_data_event(market_event)
                events_processed += 1
                
                # Count signals generated
                for strategy_id in strategy_ids:
                    metrics = strategy_manager._strategy_metrics[strategy_id]
                    total_signals += metrics.get('signals_generated', 0)
            
            current_time += timedelta(minutes=5)  # 5-minute intervals
        
        # Verify complete system performance
        assert events_processed > 500, f"Insufficient events processed: {events_processed}"
        
        # Check final system status
        final_status = strategy_manager.get_enhanced_portfolio_status()
        
        assert final_status['running_strategies'] == 4
        assert final_status['total_strategies'] == 4
        assert 'portfolio_risk_metrics' in final_status
        assert 'strategy_allocations' in final_status
        assert 'strategy_groups' in final_status
        
        # Verify strategy groups
        assert len(final_status['strategy_groups']) == 2
        assert 'mean_reversion' in final_status['strategy_groups']
        assert 'momentum' in final_status['strategy_groups']
        
        # Test portfolio rebalancing
        await strategy_manager.rebalance_portfolio()
        
        # Calculate final risk metrics
        risk_metrics = strategy_manager.calculate_portfolio_risk()
        assert risk_metrics.total_exposure >= 0
        assert risk_metrics.concentration_risk >= 0
        
        # Verify all components worked together successfully
        logger.info(f"✅ Complete system integration test passed!")
        logger.info(f"   📊 Events processed: {events_processed}")
        logger.info(f"   📈 Strategies running: {final_status['running_strategies']}")
        logger.info(f"   💰 Portfolio exposure: {risk_metrics.total_exposure:,.2f}")
        logger.info(f"   ⚖️ Risk metrics calculated successfully")
        logger.info(f"   🔄 Rebalancing completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])