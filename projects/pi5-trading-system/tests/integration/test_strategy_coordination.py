"""
Integration tests for Strategy Coordination System.

Tests multi-strategy coordination, signal aggregation, conflict resolution,
and portfolio-level risk management in realistic trading scenarios.
"""

import pytest
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Any

from strategies.enhanced_base import EnhancedBaseStrategy
from strategies.rsi_mean_reversion import RSIMeanReversionStrategy
from strategies.momentum_trend_following import MomentumTrendFollowingStrategy
from strategies.manager import (
    EnhancedStrategyManager,
    StrategyAllocation,
    SignalAggregationMethod,
    ConflictResolutionMode,
    AggregatedSignal
)
from core.interfaces import Signal, TradingSignal
from core.market_data import MarketDataManager
from events.event_bus import EventBus
from events.event_types import MarketDataEvent, OrderFilledEvent


@pytest.fixture
def mock_market_data_manager():
    """Create mock MarketDataManager for testing."""
    manager = AsyncMock(spec=MarketDataManager)
    
    # Mock historical data
    dates = pd.date_range('2024-01-01', periods=100, freq='1min')
    mock_data = pd.DataFrame({
        'open': np.random.uniform(100, 105, 100),
        'high': np.random.uniform(105, 110, 100),
        'low': np.random.uniform(95, 100, 100),
        'close': np.random.uniform(100, 105, 100),
        'volume': np.random.randint(1000, 5000, 100),
        'sma_20': np.random.uniform(100, 105, 100),
        'sma_50': np.random.uniform(100, 105, 100),
        'ema_12': np.random.uniform(100, 105, 100),
        'ema_26': np.random.uniform(100, 105, 100),
        'rsi': np.random.uniform(30, 70, 100),
        'macd': np.random.uniform(-1, 1, 100),
        'signal': np.random.uniform(-1, 1, 100),
        'histogram': np.random.uniform(-0.5, 0.5, 100),
        'atr': np.random.uniform(1, 3, 100)
    }, index=dates)
    
    manager.get_historical_data.return_value = mock_data
    
    return manager


@pytest.fixture
def event_bus():
    """Create EventBus for testing."""
    return EventBus()


@pytest.fixture
async def strategy_manager(event_bus, mock_market_data_manager):
    """Create EnhancedStrategyManager for testing."""
    manager = EnhancedStrategyManager(
        event_bus=event_bus,
        db_manager=None,
        total_capital=100000.0,
        max_portfolio_risk=0.15,
        signal_aggregation_method=SignalAggregationMethod.WEIGHTED_AVERAGE,
        conflict_resolution_mode=ConflictResolutionMode.HIGHEST_CONFIDENCE,
        enable_dynamic_allocation=True,
        rebalance_frequency=60
    )
    
    await manager.start()
    return manager


@pytest.fixture
def sample_market_data_event():
    """Create sample MarketDataEvent for testing."""
    return MarketDataEvent(
        symbol="AAPL",
        timestamp=datetime.utcnow(),
        open_price=150.0,
        high_price=152.0,
        low_price=149.0,
        close_price=151.0,
        volume=10000,
        bid_price=150.9,
        ask_price=151.1,
        source="test"
    )


class TestStrategyInitialization:
    """Test strategy initialization with market data integration."""
    
    @pytest.mark.asyncio
    async def test_rsi_strategy_initialization(self, mock_market_data_manager):
        """Test RSI strategy initialization with market data manager."""
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL", "MSFT"]
        )
        
        await strategy.initialize()
        
        assert strategy._initialized
        assert strategy.market_data_manager is not None
        assert strategy.technical_indicators is not None
        assert strategy.data_validator is not None
        assert len(strategy.watched_symbols) == 2
    
    @pytest.mark.asyncio
    async def test_momentum_strategy_initialization(self, mock_market_data_manager):
        """Test Momentum strategy initialization with market data manager."""
        strategy = MomentumTrendFollowingStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL", "GOOGL"]
        )
        
        await strategy.initialize()
        
        assert strategy._initialized
        assert strategy.market_data_manager is not None
        assert len(strategy.watched_symbols) == 2
        assert strategy._trend_direction == {}
        assert strategy._trend_strength == {}
    
    @pytest.mark.asyncio
    async def test_strategy_parameter_validation(self, mock_market_data_manager):
        """Test strategy parameter validation during initialization."""
        # Test invalid RSI parameters
        with pytest.raises(ValueError, match="RSI period must be between"):
            strategy = RSIMeanReversionStrategy(
                market_data_manager=mock_market_data_manager,
                parameters={'rsi_period': 100}  # Invalid period
            )
            await strategy.initialize()
        
        # Test invalid momentum parameters
        with pytest.raises(ValueError, match="Fast EMA period must be less than"):
            strategy = MomentumTrendFollowingStrategy(
                market_data_manager=mock_market_data_manager,
                parameters={'fast_ema_period': 50, 'slow_ema_period': 20}  # Invalid order
            )
            await strategy.initialize()


class TestSignalGeneration:
    """Test signal generation from individual strategies."""
    
    @pytest.mark.asyncio
    async def test_rsi_oversold_signal_generation(self, mock_market_data_manager, sample_market_data_event):
        """Test RSI strategy generates buy signal when oversold."""
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            parameters={'oversold_threshold': 35.0}
        )
        await strategy.initialize()
        
        # Mock RSI to be oversold
        with patch.object(strategy, 'get_rsi', return_value=25.0):
            with patch.object(strategy, 'get_atr', return_value=2.0):
                with patch.object(strategy, '_can_trade_today', return_value=True):
                    with patch.object(strategy, '_update_rsi_zone'):
                        with patch.object(strategy, 'get_latest_market_data') as mock_get_data:
                            # Mock market data with sufficient history
                            mock_data = pd.DataFrame({
                                'close': [150.0] * 50,
                                'volume': [1000] * 50
                            }, index=pd.date_range('2024-01-01', periods=50, freq='1min'))
                            mock_get_data.return_value = mock_data
                            
                            signals = await strategy.on_market_data(sample_market_data_event)
        
        # Should generate buy signal for oversold condition
        assert len(signals) > 0
        buy_signals = [s for s in signals if s.signal_type == TradingSignal.BUY]
        assert len(buy_signals) > 0
        assert buy_signals[0].symbol == "AAPL"
        assert buy_signals[0].confidence > 0.5
    
    @pytest.mark.asyncio
    async def test_momentum_trend_signal_generation(self, mock_market_data_manager, sample_market_data_event):
        """Test Momentum strategy generates signals in trending market."""
        strategy = MomentumTrendFollowingStrategy(
            market_data_manager=mock_market_data_manager
        )
        await strategy.initialize()
        
        # Mock trending conditions
        with patch.object(strategy, 'get_ema', side_effect=[155.0, 150.0, 145.0]):  # fast > slow > trend
            with patch.object(strategy, 'get_macd', return_value=(1.5, 1.0, 0.5)):  # Bullish MACD
                with patch.object(strategy, 'get_atr', return_value=2.0):
                    with patch.object(strategy, 'get_latest_market_data') as mock_get_data:
                        # Mock trending market data
                        prices = np.linspace(140, 160, 100)  # Strong uptrend
                        mock_data = pd.DataFrame({
                            'close': prices,
                            'high': prices * 1.01,
                            'low': prices * 0.99,
                            'volume': [2000] * 100,
                            'adx': [35.0] * 100  # Strong trend
                        }, index=pd.date_range('2024-01-01', periods=100, freq='1min'))
                        mock_get_data.return_value = mock_data
                        
                        signals = await strategy.on_market_data(sample_market_data_event)
        
        # Should generate buy signal for uptrend
        assert len(signals) > 0
        buy_signals = [s for s in signals if s.signal_type == TradingSignal.BUY]
        assert len(buy_signals) > 0
        assert buy_signals[0].symbol == "AAPL"


class TestMultiStrategyCoordination:
    """Test coordination between multiple strategies."""
    
    @pytest.mark.asyncio
    async def test_strategy_registration_and_allocation(self, strategy_manager, mock_market_data_manager):
        """Test registering multiple strategies with allocations."""
        # Create strategies
        rsi_strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        momentum_strategy = MomentumTrendFollowingStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        # Create allocations
        rsi_allocation = StrategyAllocation(
            strategy_id="",
            weight=0.6,
            max_allocation=60000.0,
            risk_limit=0.02,
            priority=1
        )
        
        momentum_allocation = StrategyAllocation(
            strategy_id="",
            weight=0.4,
            max_allocation=40000.0,
            risk_limit=0.025,
            priority=2
        )
        
        # Register strategies
        rsi_id = strategy_manager.register_strategy(
            strategy=rsi_strategy,
            allocation=rsi_allocation
        )
        
        momentum_id = strategy_manager.register_strategy(
            strategy=momentum_strategy,
            allocation=momentum_allocation
        )
        
        # Verify registration
        assert rsi_id in strategy_manager._strategies
        assert momentum_id in strategy_manager._strategies
        assert strategy_manager._strategy_allocations[rsi_id].weight == 0.6
        assert strategy_manager._strategy_allocations[momentum_id].weight == 0.4
        
        # Start strategies
        await strategy_manager.start_strategy(rsi_id)
        await strategy_manager.start_strategy(momentum_id)
        
        assert rsi_id in strategy_manager._running_strategies
        assert momentum_id in strategy_manager._running_strategies
    
    @pytest.mark.asyncio
    async def test_strategy_group_creation(self, strategy_manager, mock_market_data_manager):
        """Test creating strategy groups for coordinated management."""
        # Register multiple strategies
        strategies = []
        strategy_ids = []
        
        for i in range(3):
            strategy = RSIMeanReversionStrategy(
                name=f"RSI_Strategy_{i}",
                market_data_manager=mock_market_data_manager
            )
            
            allocation = StrategyAllocation(
                strategy_id="",
                weight=0.33,
                max_allocation=33000.0,
                risk_limit=0.02,
                priority=i
            )
            
            strategy_id = strategy_manager.register_strategy(
                strategy=strategy,
                allocation=allocation
            )
            
            strategies.append(strategy)
            strategy_ids.append(strategy_id)
        
        # Create strategy group
        strategy_manager.create_strategy_group(
            group_name="mean_reversion_group",
            strategy_ids=strategy_ids,
            group_weight=1.0
        )
        
        # Verify group creation
        assert "mean_reversion_group" in strategy_manager._strategy_groups
        assert len(strategy_manager._strategy_groups["mean_reversion_group"]) == 3
        
        # Verify weights were adjusted
        for strategy_id in strategy_ids:
            allocation = strategy_manager._strategy_allocations[strategy_id]
            assert abs(allocation.weight - (1.0 / 3)) < 0.01  # Approximately equal weights


class TestSignalAggregation:
    """Test signal aggregation methods and conflict resolution."""
    
    @pytest.fixture
    def sample_signals(self):
        """Create sample signals for testing aggregation."""
        return [
            Signal(
                symbol="AAPL",
                signal_type=TradingSignal.BUY,
                confidence=0.8,
                price=150.0,
                timestamp=datetime.utcnow(),
                strategy_name="RSI_Strategy",
                metadata={'position_size': 0.1}
            ),
            Signal(
                symbol="AAPL",
                signal_type=TradingSignal.BUY,
                confidence=0.6,
                price=150.5,
                timestamp=datetime.utcnow(),
                strategy_name="Momentum_Strategy",
                metadata={'position_size': 0.15}
            ),
            Signal(
                symbol="AAPL",
                signal_type=TradingSignal.SELL,
                confidence=0.7,
                price=149.5,
                timestamp=datetime.utcnow(),
                strategy_name="Contrarian_Strategy",
                metadata={'position_size': 0.08}
            )
        ]
    
    @pytest.mark.asyncio
    async def test_weighted_average_aggregation(self, strategy_manager, sample_signals):
        """Test weighted average signal aggregation."""
        # Set up strategies with different weights
        strategy_manager._strategy_allocations = {
            "rsi_id": StrategyAllocation("rsi_id", 0.5, 50000, 0.02, 1),
            "momentum_id": StrategyAllocation("momentum_id", 0.3, 30000, 0.02, 2),
            "contrarian_id": StrategyAllocation("contrarian_id", 0.2, 20000, 0.02, 3)
        }
        
        # Mock strategy lookup
        strategy_manager._strategies = {
            "rsi_id": MagicMock(name="RSI_Strategy"),
            "momentum_id": MagicMock(name="Momentum_Strategy"),
            "contrarian_id": MagicMock(name="Contrarian_Strategy")
        }
        
        # Set aggregation method
        strategy_manager.signal_aggregation_method = SignalAggregationMethod.WEIGHTED_AVERAGE
        strategy_manager.conflict_resolution_mode = ConflictResolutionMode.NET_POSITION
        
        # Add signals to pending
        strategy_manager._pending_signals["AAPL"] = sample_signals
        
        # Aggregate signals
        aggregated = await strategy_manager.aggregate_signals("AAPL")
        
        assert aggregated is not None
        assert aggregated.symbol == "AAPL"
        assert aggregated.aggregation_method == SignalAggregationMethod.WEIGHTED_AVERAGE
        assert len(aggregated.contributing_strategies) > 0
    
    @pytest.mark.asyncio
    async def test_highest_confidence_aggregation(self, strategy_manager, sample_signals):
        """Test highest confidence signal aggregation."""
        strategy_manager.signal_aggregation_method = SignalAggregationMethod.HIGHEST_CONFIDENCE
        strategy_manager._pending_signals["AAPL"] = sample_signals
        
        # Mock strategy allocations
        for signal in sample_signals:
            strategy_manager._strategy_allocations[f"{signal.strategy_name}_id"] = StrategyAllocation(
                f"{signal.strategy_name}_id", 0.33, 33000, 0.02, 1, True
            )
            strategy_manager._strategies[f"{signal.strategy_name}_id"] = MagicMock(name=signal.strategy_name)
        
        aggregated = await strategy_manager.aggregate_signals("AAPL")
        
        assert aggregated is not None
        assert aggregated.confidence == 0.8  # Highest confidence from RSI_Strategy
        assert "RSI_Strategy" in aggregated.contributing_strategies
    
    @pytest.mark.asyncio
    async def test_consensus_aggregation(self, strategy_manager):
        """Test consensus signal aggregation requiring majority agreement."""
        # Create signals with majority buy
        consensus_signals = [
            Signal("AAPL", TradingSignal.BUY, 0.7, 150.0, datetime.utcnow(), "Strategy1", {}),
            Signal("AAPL", TradingSignal.BUY, 0.6, 150.2, datetime.utcnow(), "Strategy2", {}),
            Signal("AAPL", TradingSignal.BUY, 0.8, 150.1, datetime.utcnow(), "Strategy3", {}),
            Signal("AAPL", TradingSignal.SELL, 0.5, 149.8, datetime.utcnow(), "Strategy4", {})
        ]
        
        strategy_manager.signal_aggregation_method = SignalAggregationMethod.CONSENSUS
        strategy_manager._pending_signals["AAPL"] = consensus_signals
        
        # Mock strategy setup
        for i, signal in enumerate(consensus_signals):
            strategy_id = f"strategy_{i}_id"
            strategy_manager._strategy_allocations[strategy_id] = StrategyAllocation(
                strategy_id, 0.25, 25000, 0.02, i, True
            )
            strategy_manager._strategies[strategy_id] = MagicMock(name=signal.strategy_name)
        
        aggregated = await strategy_manager.aggregate_signals("AAPL")
        
        assert aggregated is not None
        assert aggregated.signal_type == TradingSignal.BUY  # Majority was buy
    
    @pytest.mark.asyncio
    async def test_conflict_resolution_cancel_all(self, strategy_manager, sample_signals):
        """Test conflict resolution that cancels all conflicting signals."""
        strategy_manager.conflict_resolution_mode = ConflictResolutionMode.CANCEL_ALL
        strategy_manager.signal_aggregation_method = SignalAggregationMethod.WEIGHTED_AVERAGE
        
        # Mock strategy setup
        for signal in sample_signals:
            strategy_id = f"{signal.strategy_name}_id"
            strategy_manager._strategy_allocations[strategy_id] = StrategyAllocation(
                strategy_id, 0.33, 33000, 0.02, 1, True
            )
            strategy_manager._strategies[strategy_id] = MagicMock(name=signal.strategy_name)
        
        # Resolve conflicts (should cancel due to opposing signals)
        resolved = strategy_manager._resolve_signal_conflicts(sample_signals)
        
        assert len(resolved) == 0  # All signals cancelled due to conflict
    
    @pytest.mark.asyncio
    async def test_conflict_resolution_highest_confidence(self, strategy_manager, sample_signals):
        """Test conflict resolution using highest confidence signal."""
        strategy_manager.conflict_resolution_mode = ConflictResolutionMode.HIGHEST_CONFIDENCE
        
        resolved = strategy_manager._resolve_signal_conflicts(sample_signals)
        
        assert len(resolved) == 1
        assert resolved[0].confidence == 0.8  # Highest confidence signal
        assert resolved[0].strategy_name == "RSI_Strategy"


class TestRiskManagement:
    """Test portfolio-level risk management and position limits."""
    
    @pytest.mark.asyncio
    async def test_position_size_calculation_with_limits(self, strategy_manager):
        """Test position size calculation respects risk limits."""
        # Set up strategy allocation
        strategy_id = "test_strategy"
        allocation = StrategyAllocation(
            strategy_id=strategy_id,
            weight=0.5,
            max_allocation=50000.0,
            risk_limit=0.02,  # 2% risk limit
            priority=1
        )
        strategy_manager._strategy_allocations[strategy_id] = allocation
        
        # Create test signal
        signal = Signal(
            symbol="AAPL",
            signal_type=TradingSignal.BUY,
            confidence=0.8,
            price=150.0,
            timestamp=datetime.utcnow(),
            strategy_name="TestStrategy",
            metadata={'position_size': 0.5}  # Request 50% of allocation
        )
        
        # Calculate position size
        position_size = strategy_manager._calculate_position_size(strategy_id, signal)
        
        # Verify position size respects risk limits
        max_risk_position = (allocation.risk_limit * strategy_manager.total_capital) / signal.price
        max_allocation_position = (allocation.max_allocation * 0.5) / signal.price  # 50% of allocation
        
        expected_position = min(max_risk_position, max_allocation_position)
        assert abs(position_size - expected_position) < 0.01
    
    @pytest.mark.asyncio
    async def test_portfolio_risk_limits(self, strategy_manager):
        """Test portfolio-level risk limits are enforced."""
        # Set current portfolio exposure near limit
        strategy_manager._portfolio_positions = {
            "AAPL": 500,  # $75,000 at $150/share
            "MSFT": 200,  # $60,000 at $300/share
        }
        # Total exposure: $135,000 (13.5% of $100k portfolio)
        
        # Try to add position that would exceed 15% limit
        strategy_id = "test_strategy"
        allocation = StrategyAllocation(
            strategy_id=strategy_id,
            weight=0.5,
            max_allocation=50000.0,
            risk_limit=0.05,  # 5% risk limit
            priority=1
        )
        strategy_manager._strategy_allocations[strategy_id] = allocation
        
        large_signal = Signal(
            symbol="GOOGL",
            signal_type=TradingSignal.BUY,
            confidence=0.8,
            price=2500.0,  # Expensive stock
            timestamp=datetime.utcnow(),
            strategy_name="TestStrategy",
            metadata={'position_size': 1.0}  # Request full allocation
        )
        
        position_size = strategy_manager._calculate_position_size(strategy_id, large_signal)
        
        # Position should be limited to stay within portfolio risk limit
        new_exposure = position_size * large_signal.price
        total_exposure = 135000 + new_exposure  # Current + new
        portfolio_exposure_pct = total_exposure / strategy_manager.total_capital
        
        assert portfolio_exposure_pct <= strategy_manager.max_portfolio_risk
    
    @pytest.mark.asyncio
    async def test_portfolio_risk_metrics_calculation(self, strategy_manager):
        """Test portfolio risk metrics calculation."""
        # Set up portfolio positions
        strategy_manager._portfolio_positions = {
            "AAPL": 300,
            "MSFT": 150,
            "GOOGL": 20
        }
        
        # Set up strategy allocations
        strategy_manager._strategy_allocations = {
            "strategy1": StrategyAllocation("strategy1", 0.4, 40000, 0.02, 1, True),
            "strategy2": StrategyAllocation("strategy2", 0.3, 30000, 0.025, 2, True),
            "strategy3": StrategyAllocation("strategy3", 0.3, 30000, 0.02, 3, True)
        }
        
        # Calculate risk metrics
        risk_metrics = strategy_manager.calculate_portfolio_risk()
        
        assert risk_metrics is not None
        assert risk_metrics.total_exposure > 0
        assert len(risk_metrics.symbol_exposures) == 3
        assert len(risk_metrics.strategy_exposures) == 3
        assert 0 <= risk_metrics.concentration_risk <= 1
        assert risk_metrics.var_estimate > 0


class TestPerformanceAttribution:
    """Test performance attribution and dynamic allocation."""
    
    @pytest.mark.asyncio
    async def test_portfolio_rebalancing(self, strategy_manager):
        """Test portfolio rebalancing based on strategy performance."""
        # Set up strategies with different performance
        strategy_manager._strategies = {
            "high_performer": MagicMock(),
            "medium_performer": MagicMock(),
            "low_performer": MagicMock()
        }
        
        # Mock performance metrics
        high_perf_metrics = {
            'total_pnl': 5000,
            'win_rate': 0.7,
            'sharpe_ratio': 1.5
        }
        medium_perf_metrics = {
            'total_pnl': 2000,
            'win_rate': 0.6,
            'sharpe_ratio': 0.8
        }
        low_perf_metrics = {
            'total_pnl': -1000,
            'win_rate': 0.4,
            'sharpe_ratio': -0.2
        }
        
        strategy_manager._strategies["high_performer"].get_performance_metrics.return_value = high_perf_metrics
        strategy_manager._strategies["medium_performer"].get_performance_metrics.return_value = medium_perf_metrics
        strategy_manager._strategies["low_performer"].get_performance_metrics.return_value = low_perf_metrics
        
        # Set up allocations
        for strategy_id in strategy_manager._strategies.keys():
            strategy_manager._strategy_allocations[strategy_id] = StrategyAllocation(
                strategy_id, 0.33, 33000, 0.02, 1, True, 1.0
            )
            strategy_manager._running_strategies.add(strategy_id)
        
        # Perform rebalancing
        await strategy_manager.rebalance_portfolio()
        
        # Verify performance weights were adjusted
        high_perf_weight = strategy_manager._strategy_allocations["high_performer"].performance_weight
        low_perf_weight = strategy_manager._strategy_allocations["low_performer"].performance_weight
        
        assert high_perf_weight > low_perf_weight
        assert strategy_manager._last_rebalance is not None
    
    @pytest.mark.asyncio
    async def test_strategy_attribution_calculation(self, strategy_manager):
        """Test strategy performance attribution calculation."""
        # Set up mock trades
        strategy_manager._trades = [
            MagicMock(strategy_name="Strategy1", pnl=1000),
            MagicMock(strategy_name="Strategy1", pnl=500),
            MagicMock(strategy_name="Strategy2", pnl=-200),
            MagicMock(strategy_name="Strategy3", pnl=800)
        ]
        
        strategy_manager._portfolio_value = 102100  # Initial 100k + 2.1k profit
        
        # Set up strategies
        strategy_manager._strategies = {
            "strategy1_id": MagicMock(name="Strategy1"),
            "strategy2_id": MagicMock(name="Strategy2"),
            "strategy3_id": MagicMock(name="Strategy3")
        }
        
        attribution = await strategy_manager._calculate_strategy_attribution()
        
        # Verify attribution reflects actual performance
        assert "Strategy1" in attribution
        assert "Strategy2" in attribution
        assert "Strategy3" in attribution
        
        # Strategy1 should have highest attribution (1500 profit)
        assert attribution["Strategy1"] > attribution["Strategy2"]
        assert attribution["Strategy1"] > attribution["Strategy3"]


class TestEndToEndStrategyWorkflow:
    """Test complete end-to-end strategy coordination workflows."""
    
    @pytest.mark.asyncio
    async def test_complete_multi_strategy_workflow(self, strategy_manager, mock_market_data_manager):
        """Test complete workflow from strategy registration to signal execution."""
        
        # Register multiple strategies
        rsi_strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        momentum_strategy = MomentumTrendFollowingStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        # Create allocations
        rsi_allocation = StrategyAllocation(
            strategy_id="",
            weight=0.7,
            max_allocation=70000.0,
            risk_limit=0.02,
            priority=1
        )
        
        momentum_allocation = StrategyAllocation(
            strategy_id="",
            weight=0.3,
            max_allocation=30000.0,
            risk_limit=0.025,
            priority=2
        )
        
        # Register and start strategies
        rsi_id = strategy_manager.register_strategy(rsi_strategy, allocation=rsi_allocation)
        momentum_id = strategy_manager.register_strategy(momentum_strategy, allocation=momentum_allocation)
        
        await strategy_manager.start_strategy(rsi_id)
        await strategy_manager.start_strategy(momentum_id)
        
        # Create market data event
        market_event = MarketDataEvent(
            symbol="AAPL",
            timestamp=datetime.utcnow(),
            open_price=150.0,
            high_price=152.0,
            low_price=149.0,
            close_price=151.0,
            volume=10000
        )
        
        # Process market data through strategy manager
        await strategy_manager._handle_market_data_event(market_event)
        
        # Verify strategies were called
        assert strategy_manager._strategy_metrics[rsi_id]['last_active'] is not None
        assert strategy_manager._strategy_metrics[momentum_id]['last_active'] is not None
    
    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(self, strategy_manager, mock_market_data_manager):
        """Test error handling and strategy isolation."""
        
        # Create a strategy that will fail
        failing_strategy = MagicMock()
        failing_strategy.name = "FailingStrategy"
        failing_strategy.on_market_data.side_effect = Exception("Strategy failed")
        
        # Create a healthy strategy
        healthy_strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager
        )
        
        # Register strategies
        failing_id = strategy_manager.register_strategy(failing_strategy)
        healthy_id = strategy_manager.register_strategy(healthy_strategy)
        
        await strategy_manager.start_strategy(failing_id)
        await strategy_manager.start_strategy(healthy_id)
        
        # Process market data
        market_event = MarketDataEvent(
            symbol="AAPL",
            timestamp=datetime.utcnow(),
            open_price=150.0,
            high_price=152.0,
            low_price=149.0,
            close_price=151.0,
            volume=10000
        )
        
        # Should handle failure gracefully
        await strategy_manager._handle_market_data_event(market_event)
        
        # Verify error was recorded but system continues
        assert len(strategy_manager._strategy_errors[failing_id]) > 0
        assert healthy_id in strategy_manager._running_strategies  # Healthy strategy still running
    
    @pytest.mark.asyncio
    async def test_enhanced_portfolio_status(self, strategy_manager):
        """Test comprehensive portfolio status reporting."""
        
        # Set up portfolio state
        strategy_manager._portfolio_positions = {"AAPL": 100, "MSFT": 50}
        strategy_manager._strategy_allocations = {
            "strategy1": StrategyAllocation("strategy1", 0.6, 60000, 0.02, 1, True, 1.2),
            "strategy2": StrategyAllocation("strategy2", 0.4, 40000, 0.025, 2, True, 0.8)
        }
        strategy_manager._performance_attribution = {"Strategy1": 0.6, "Strategy2": 0.4}
        strategy_manager._strategy_groups = {"momentum_group": ["strategy1", "strategy2"]}
        
        # Mock strategies
        strategy_manager._strategies = {
            "strategy1": MagicMock(name="Strategy1"),
            "strategy2": MagicMock(name="Strategy2")
        }
        
        status = strategy_manager.get_enhanced_portfolio_status()
        
        # Verify comprehensive status information
        assert "portfolio_risk_metrics" in status
        assert "strategy_allocations" in status
        assert "performance_attribution" in status
        assert "signal_aggregation_method" in status
        assert "conflict_resolution_mode" in status
        assert "strategy_groups" in status
        
        # Verify strategy allocation details
        assert "Strategy1" in status["strategy_allocations"]
        assert "Strategy2" in status["strategy_allocations"]
        assert status["strategy_allocations"]["Strategy1"]["weight"] == 0.6
        assert status["strategy_allocations"]["Strategy1"]["performance_weight"] == 1.2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])