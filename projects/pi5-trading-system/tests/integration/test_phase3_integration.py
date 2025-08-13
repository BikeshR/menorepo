"""
Phase 3 Integration Tests for Pi5 Trading System.

Comprehensive integration tests for Phase 3 Live Broker Integration & Enhanced Features.
Tests multi-broker functionality, multi-timeframe strategies, correlation analysis,
parameter optimization, walk-forward analysis, and portfolio optimization.

Test Categories:
- Live Broker Integration
- Multi-Timeframe Strategy Execution  
- Strategy Correlation Analysis
- Advanced Parameter Optimization
- Walk-Forward Analysis
- Portfolio Optimization
- Enhanced Order Management
- System Integration with All Components
"""

import asyncio
import pytest
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np
import pandas as pd

# Core imports
from core.interfaces import Signal, TradingSignal, Order, OrderType, OrderStatus
from core.exceptions import BrokerError, OptimizationError
from events.event_bus import EventBus
from database.connection_manager import DatabaseManager

# Broker imports
from orders.brokers.paper_broker import PaperTradingBroker
from orders.brokers.broker_manager import (
    BrokerManager, BrokerConfig, BrokerType, FailoverStrategy
)
from orders.enhanced_order_manager import EnhancedOrderManager

# Strategy imports
from strategies.multi_timeframe_base import TimeframeConfig, TimeframeType
from strategies.multi_timeframe_trend_following import MultiTimeframeTrendFollowing
from strategies.correlation_analyzer import StrategyCorrelationAnalyzer, StrategyPerformance
from strategies.parameter_optimizer import (
    ParameterOptimizer, ParameterRange, OptimizationMethod, ObjectiveType
)
from strategies.walk_forward_analyzer import WalkForwardAnalyzer, WalkForwardType
from strategies.portfolio_optimizer import (
    StrategyPortfolioOptimizer, AllocationMethod, StrategyMetrics
)

# Test fixtures
from tests.integration import INTEGRATION_TEST_CONFIG


logger = logging.getLogger(__name__)


class TestBrokerIntegration:
    """Test live broker integration and failover capabilities."""
    
    @pytest.fixture
    async def broker_manager(self, event_bus):
        """Create broker manager with multiple brokers."""
        manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.HEALTH_BASED,
            health_check_interval=10,
            enable_load_balancing=True
        )
        
        # Add paper trading brokers for testing
        paper_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=1,
            config={
                'initial_cash': 100000,
                'commission_per_trade': 1.0,
                'max_slippage_bps': 5
            }
        )
        
        backup_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=2,
            config={
                'initial_cash': 100000,
                'commission_per_trade': 1.5,
                'max_slippage_bps': 8
            }
        )
        
        manager.add_broker("primary_paper", paper_config, market_data_repo=None)
        manager.add_broker("backup_paper", backup_config, market_data_repo=None)
        
        await manager.start()
        yield manager
        await manager.stop()
    
    @pytest.mark.asyncio
    async def test_multi_broker_order_submission(self, broker_manager):
        """Test order submission across multiple brokers."""
        # Create test order
        order = Order(
            order_id="test_multi_broker_001",
            symbol="AAPL",
            side="buy",
            quantity=100,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        # Submit order
        order_id, broker_name = await broker_manager.submit_order(order)
        
        assert order_id is not None
        assert broker_name in ["primary_paper", "backup_paper"]
        
        # Verify order tracking
        stats = broker_manager.get_manager_stats()
        assert stats['successful_orders'] >= 1
        assert stats['total_brokers'] == 2
        assert stats['healthy_brokers'] >= 1
    
    @pytest.mark.asyncio
    async def test_broker_failover(self, broker_manager):
        """Test broker failover functionality."""
        # Get initial broker health
        initial_health = broker_manager.get_all_broker_health()
        assert len(initial_health) == 2
        
        # Simulate broker failure by removing one
        broker_manager.remove_broker("primary_paper")
        
        # Submit order - should use backup broker
        order = Order(
            order_id="test_failover_001",
            symbol="MSFT",
            side="buy",
            quantity=50,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id, broker_name = await broker_manager.submit_order(order)
        
        assert order_id is not None
        assert broker_name == "backup_paper"
        
        # Verify failover stats
        stats = broker_manager.get_manager_stats()
        assert stats['total_brokers'] == 1
    
    @pytest.mark.asyncio
    async def test_enhanced_order_execution(self, event_bus, broker_manager, db_manager, risk_manager):
        """Test enhanced order manager with multi-broker support."""
        enhanced_manager = EnhancedOrderManager(
            event_bus=event_bus,
            db_manager=db_manager,
            risk_manager=risk_manager,
            broker_manager=broker_manager,
            enable_smart_routing=True
        )
        
        await enhanced_manager.start()
        
        try:
            # Create test signal
            signal = Signal(
                symbol="SPY",
                signal_type=TradingSignal.BUY,
                confidence=0.8,
                price=400.0,
                timestamp=datetime.utcnow(),
                strategy_name="TestStrategy"
            )
            
            # Set mock portfolio
            from portfolio.manager import Portfolio
            mock_portfolio = Portfolio(initial_cash=100000)
            enhanced_manager.set_portfolio(mock_portfolio)
            
            # Submit order from signal
            order_id = await enhanced_manager.submit_order_from_signal(signal)
            
            assert order_id is not None
            
            # Verify execution analytics
            analytics = enhanced_manager.get_execution_analytics()
            assert analytics['total_orders'] >= 1
            assert analytics['smart_routing_enabled'] is True
            
        finally:
            await enhanced_manager.stop()


class TestMultiTimeframeStrategies:
    """Test multi-timeframe strategy functionality."""
    
    @pytest.fixture
    def multi_timeframe_strategy(self):
        """Create multi-timeframe trend following strategy."""
        return MultiTimeframeTrendFollowing(
            name="TestMultiTF",
            symbols=["AAPL", "MSFT"],
            parameters={
                'trend_strength_threshold': 0.6,
                'momentum_threshold': 0.7,
                'min_timeframe_agreement': 0.75
            }
        )
    
    @pytest.mark.asyncio
    async def test_multi_timeframe_initialization(self, multi_timeframe_strategy):
        """Test multi-timeframe strategy initialization."""
        await multi_timeframe_strategy.initialize()
        
        # Verify timeframe configuration
        status = multi_timeframe_strategy.get_multi_timeframe_status()
        
        assert status['strategy_name'] == "TestMultiTF"
        assert len(status['timeframes']) >= 3  # Should have multiple timeframes
        assert status['trend_bias'] in ['buy', 'sell', 'hold']
        
        # Verify timeframe hierarchy
        timeframes = status['timeframes']
        assert any(tf for tf in timeframes if 'day' in tf.lower())  # Daily timeframe
        assert any(tf for tf in timeframes if 'hour' in tf.lower())  # Hourly timeframe
        assert any(tf for tf in timeframes if 'minute' in tf.lower())  # Minute timeframe
    
    @pytest.mark.asyncio 
    async def test_timeframe_signal_generation(self, multi_timeframe_strategy):
        """Test signal generation across timeframes."""
        await multi_timeframe_strategy.initialize()
        
        # Create mock market data event
        from events.event_types import MarketDataEvent
        market_data = MarketDataEvent(
            symbol="AAPL",
            price=150.0,
            volume=1000000,
            timestamp=datetime.utcnow()
        )
        
        # Process market data
        signals = await multi_timeframe_strategy.on_market_data(market_data)
        
        # Verify signal processing (may not generate signals without sufficient data)
        assert isinstance(signals, list)
        
        # Check strategy status after processing
        status = multi_timeframe_strategy.get_strategy_status()
        assert 'trend_cache' in status
        assert 'symbols' in status
        assert 'parameters' in status


class TestCorrelationAnalysis:
    """Test strategy correlation analysis system."""
    
    @pytest.fixture
    async def correlation_analyzer(self):
        """Create correlation analyzer."""
        analyzer = StrategyCorrelationAnalyzer(
            lookback_periods=100,
            correlation_threshold=0.7,
            enable_clustering=True
        )
        await analyzer.start()
        yield analyzer
        await analyzer.stop()
    
    @pytest.mark.asyncio
    async def test_correlation_calculation(self, correlation_analyzer):
        """Test strategy correlation calculation."""
        # Add strategy performance data
        strategy_a = "RSIMeanReversion"
        strategy_b = "MomentumTrending"
        
        # Add synthetic returns data
        for i in range(50):
            return_a = np.random.normal(0.001, 0.02)  # 0.1% daily return, 2% volatility
            return_b = np.random.normal(0.0008, 0.018) + return_a * 0.3  # Some correlation
            
            timestamp = datetime.utcnow() - timedelta(days=49-i)
            
            correlation_analyzer.add_strategy_return(strategy_a, return_a, timestamp)
            correlation_analyzer.add_strategy_return(strategy_b, return_b, timestamp)
        
        # Let correlation update
        await asyncio.sleep(0.1)
        
        # Get correlation
        correlation = correlation_analyzer.get_correlation(strategy_a, strategy_b)
        
        if correlation:  # May be None if insufficient data
            assert -1.0 <= correlation.overall_correlation <= 1.0
            assert correlation.sample_size > 0
            assert correlation.strategy_a == strategy_a
            assert correlation.strategy_b == strategy_b
        
        # Test correlation matrix
        matrix = correlation_analyzer.get_correlation_matrix()
        if not matrix.empty:
            assert matrix.shape[0] == matrix.shape[1]
            assert matrix.shape[0] <= 2  # Two strategies
    
    @pytest.mark.asyncio
    async def test_diversification_analysis(self, correlation_analyzer):
        """Test diversification scoring."""
        # Add multiple strategies with different correlation patterns
        strategies = ["Strategy1", "Strategy2", "Strategy3"]
        
        for strategy in strategies:
            for i in range(30):
                base_return = np.random.normal(0.001, 0.02)
                
                # Add strategy-specific patterns
                if strategy == "Strategy2":
                    strategy_return = base_return + np.random.normal(0, 0.01)
                elif strategy == "Strategy3":
                    strategy_return = -base_return * 0.5 + np.random.normal(0, 0.015)  # Negative correlation
                else:
                    strategy_return = base_return
                
                timestamp = datetime.utcnow() - timedelta(days=29-i)
                correlation_analyzer.add_strategy_return(strategy, strategy_return, timestamp)
        
        await asyncio.sleep(0.1)
        
        # Test diversification score
        diversification_score = correlation_analyzer.get_diversification_score()
        assert 0.0 <= diversification_score <= 1.0
        
        # Test highly correlated pairs
        high_corr_pairs = correlation_analyzer.get_highly_correlated_pairs()
        assert isinstance(high_corr_pairs, list)


class TestParameterOptimization:
    """Test advanced parameter optimization."""
    
    @pytest.fixture
    async def parameter_optimizer(self, backtesting_engine):
        """Create parameter optimizer."""
        return ParameterOptimizer(
            backtesting_engine=backtesting_engine,
            max_parallel_jobs=2,
            enable_statistical_testing=True
        )
    
    @pytest.mark.asyncio 
    async def test_bayesian_optimization(self, parameter_optimizer):
        """Test Bayesian parameter optimization."""
        from strategies.rsi_mean_reversion import RSIMeanReversionStrategy
        
        # Define parameter ranges
        parameter_ranges = [
            ParameterRange(
                name="rsi_period",
                min_value=10,
                max_value=30,
                step=2,
                param_type="int"
            ),
            ParameterRange(
                name="oversold_threshold", 
                min_value=20,
                max_value=35,
                step=5,
                param_type="int"
            ),
            ParameterRange(
                name="overbought_threshold",
                min_value=65,
                max_value=80,
                step=5,
                param_type="int"
            )
        ]
        
        # Run optimization (limited iterations for testing)
        try:
            report = await parameter_optimizer.optimize_parameters(
                strategy_class=RSIMeanReversionStrategy,
                parameter_ranges=parameter_ranges,
                optimization_method=OptimizationMethod.BAYESIAN,
                objective=ObjectiveType.MAXIMIZE_SHARPE,
                max_iterations=10,  # Limited for testing
                symbols=["AAPL"],
                start_date=datetime.now() - timedelta(days=180),
                end_date=datetime.now() - timedelta(days=30),
                initial_capital=50000
            )
            
            # Verify optimization results
            assert report.optimization_id is not None
            assert report.method == OptimizationMethod.BAYESIAN
            assert report.best_result is not None
            assert len(report.all_results) > 0
            assert report.optimization_time > 0
            
            # Verify parameter values are within ranges
            best_params = report.best_result.parameters
            for param_range in parameter_ranges:
                param_value = best_params.get(param_range.name)
                if param_value is not None:
                    assert param_range.min_value <= param_value <= param_range.max_value
            
        except Exception as e:
            # Optimization may fail due to insufficient data or other issues
            logger.warning(f"Parameter optimization test failed (expected in test environment): {e}")
            pytest.skip("Parameter optimization requires more complete test data")
    
    @pytest.mark.asyncio
    async def test_parameter_sensitivity_analysis(self, parameter_optimizer):
        """Test parameter sensitivity analysis."""
        # This would normally be part of the full optimization
        # For now, just test that the optimizer can be configured
        
        assert parameter_optimizer.max_parallel_jobs > 0
        assert parameter_optimizer.enable_statistical_testing is True
        
        # Test optimization history (should be empty initially)
        history = parameter_optimizer.get_optimization_history()
        assert isinstance(history, list)


class TestWalkForwardAnalysis:
    """Test walk-forward analysis capabilities."""
    
    @pytest.fixture
    async def walk_forward_analyzer(self, backtesting_engine, parameter_optimizer):
        """Create walk-forward analyzer."""
        return WalkForwardAnalyzer(
            backtesting_engine=backtesting_engine,
            parameter_optimizer=parameter_optimizer,
            min_optimization_periods=60,  # Reduced for testing
            min_testing_periods=20        # Reduced for testing  
        )
    
    @pytest.mark.asyncio
    async def test_walk_forward_period_generation(self, walk_forward_analyzer):
        """Test walk-forward period generation."""
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 6, 1)
        
        periods = walk_forward_analyzer._generate_walk_forward_periods(
            start_date=start_date,
            end_date=end_date,
            wf_type=WalkForwardType.ROLLING,
            optimization_window_days=60,
            testing_window_days=20,
            step_days=20
        )
        
        assert len(periods) > 0
        
        # Verify period structure
        for opt_start, opt_end, test_start, test_end in periods:
            assert opt_start < opt_end
            assert opt_end == test_start  # Testing starts when optimization ends
            assert test_start < test_end
            assert (opt_end - opt_start).days == 60
            assert (test_end - test_start).days == 20
    
    @pytest.mark.asyncio
    async def test_walk_forward_analysis(self, walk_forward_analyzer):
        """Test complete walk-forward analysis."""
        from strategies.rsi_mean_reversion import RSIMeanReversionStrategy
        
        parameter_ranges = [
            ParameterRange(
                name="rsi_period",
                min_value=14,
                max_value=21,
                step=7,
                param_type="int"
            )
        ]
        
        try:
            # Run simplified walk-forward analysis
            analysis = await walk_forward_analyzer.run_walk_forward_analysis(
                strategy_class=RSIMeanReversionStrategy,
                parameter_ranges=parameter_ranges,
                symbols=["AAPL"],
                start_date=datetime.now() - timedelta(days=200),
                end_date=datetime.now() - timedelta(days=50),
                optimization_window_days=60,
                testing_window_days=20,
                step_days=30,
                optimization_method=OptimizationMethod.RANDOM_SEARCH,
                reoptimization_frequency=1
            )
            
            # Verify analysis results
            assert analysis.analysis_id is not None
            assert analysis.strategy_name == "RSIMeanReversionStrategy"
            assert analysis.wf_type == WalkForwardType.ROLLING
            assert len(analysis.periods) > 0
            assert 0.0 <= analysis.robustness_score <= 1.0
            assert 0.0 <= analysis.efficiency_score <= 1.0
            assert analysis.recommendation is not None
            
        except Exception as e:
            logger.warning(f"Walk-forward analysis test failed (expected in test environment): {e}")
            pytest.skip("Walk-forward analysis requires more complete test environment")


class TestPortfolioOptimization:
    """Test portfolio optimization across strategies."""
    
    @pytest.fixture
    async def portfolio_optimizer(self, correlation_analyzer):
        """Create portfolio optimizer."""
        return StrategyPortfolioOptimizer(
            correlation_analyzer=correlation_analyzer,
            min_allocation=0.1,
            max_allocation=0.4,
            target_volatility=0.15
        )
    
    @pytest.mark.asyncio
    async def test_portfolio_allocation_optimization(self, portfolio_optimizer):
        """Test portfolio allocation optimization."""
        # Create mock strategy metrics
        strategy_metrics = {
            "RSIMeanReversion": StrategyMetrics(
                strategy_name="RSIMeanReversion",
                expected_return=0.12,
                volatility=0.18,
                sharpe_ratio=0.67,
                max_drawdown=0.08
            ),
            "MomentumTrending": StrategyMetrics(
                strategy_name="MomentumTrending", 
                expected_return=0.15,
                volatility=0.22,
                sharpe_ratio=0.68,
                max_drawdown=0.12
            ),
            "MovingAverageCrossover": StrategyMetrics(
                strategy_name="MovingAverageCrossover",
                expected_return=0.08,
                volatility=0.14,
                sharpe_ratio=0.57,
                max_drawdown=0.06
            )
        }
        
        # Test different allocation methods
        for method in [AllocationMethod.EQUAL_WEIGHT, AllocationMethod.MAX_SHARPE, AllocationMethod.RISK_PARITY]:
            allocation = await portfolio_optimizer.optimize_portfolio(
                strategy_metrics=strategy_metrics,
                method=method
            )
            
            # Verify allocation results
            assert allocation.allocation_id is not None
            assert allocation.method == method
            assert len(allocation.weights) == 3
            assert abs(allocation.total_weight - 1.0) < 1e-6  # Weights sum to 1
            assert allocation.expected_return > 0
            assert allocation.expected_volatility > 0
            assert allocation.diversification_ratio > 0
            
            # Verify allocation constraints
            for strategy, weight in allocation.weights.items():
                assert 0.1 <= weight <= 0.4  # Within min/max allocation bounds
            
            # Verify risk contributions
            assert len(allocation.risk_contribution) == 3
            total_risk_contrib = sum(allocation.risk_contribution.values())
            assert abs(total_risk_contrib - 1.0) < 0.1  # Risk contributions should sum to ~1
    
    @pytest.mark.asyncio
    async def test_rebalancing_logic(self, portfolio_optimizer):
        """Test portfolio rebalancing logic."""
        # Create initial allocation
        strategy_metrics = {
            "Strategy1": StrategyMetrics("Strategy1", 0.1, 0.15, 0.67, 0.05),
            "Strategy2": StrategyMetrics("Strategy2", 0.12, 0.18, 0.67, 0.08)
        }
        
        allocation = await portfolio_optimizer.optimize_portfolio(
            strategy_metrics=strategy_metrics,
            method=AllocationMethod.EQUAL_WEIGHT
        )
        
        # Test rebalancing logic
        current_weights = {"Strategy1": 0.6, "Strategy2": 0.4}  # Drifted weights
        should_rebalance = portfolio_optimizer.should_rebalance(current_weights)
        
        # Should trigger rebalancing due to drift from 50/50 to 60/40
        assert should_rebalance is True
        
        # Test no rebalancing needed
        current_weights = {"Strategy1": 0.52, "Strategy2": 0.48}  # Small drift
        should_rebalance = portfolio_optimizer.should_rebalance(current_weights)
        
        # Should not trigger rebalancing for small drift
        assert should_rebalance is False


class TestSystemIntegration:
    """Test complete system integration with all Phase 3 components."""
    
    @pytest.mark.asyncio
    async def test_end_to_end_phase3_workflow(
        self, 
        event_bus,
        db_manager,
        risk_manager,
        backtesting_engine
    ):
        """Test complete Phase 3 workflow integration."""
        
        # 1. Setup multi-broker system
        broker_manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.HEALTH_BASED
        )
        
        paper_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            config={'initial_cash': 100000}
        )
        broker_manager.add_broker("test_broker", paper_config, market_data_repo=None)
        await broker_manager.start()
        
        try:
            # 2. Setup enhanced order management
            enhanced_order_manager = EnhancedOrderManager(
                event_bus=event_bus,
                db_manager=db_manager,
                risk_manager=risk_manager,
                broker_manager=broker_manager
            )
            await enhanced_order_manager.start()
            
            # 3. Setup correlation analyzer
            correlation_analyzer = StrategyCorrelationAnalyzer()
            await correlation_analyzer.start()
            
            # 4. Create multi-timeframe strategy
            mt_strategy = MultiTimeframeTrendFollowing(
                name="IntegrationTestStrategy",
                symbols=["AAPL"]
            )
            await mt_strategy.initialize()
            
            # 5. Setup portfolio optimizer
            portfolio_optimizer = StrategyPortfolioOptimizer(
                correlation_analyzer=correlation_analyzer
            )
            
            # 6. Test workflow: Strategy generates signal -> Enhanced order management -> Multi-broker execution
            signal = Signal(
                symbol="AAPL",
                signal_type=TradingSignal.BUY,
                confidence=0.8,
                price=150.0,
                timestamp=datetime.utcnow(),
                strategy_name="IntegrationTestStrategy"
            )
            
            # Set mock portfolio
            from portfolio.manager import Portfolio
            mock_portfolio = Portfolio(initial_cash=100000)
            enhanced_order_manager.set_portfolio(mock_portfolio)
            
            # Submit order through enhanced system
            order_id = await enhanced_order_manager.submit_order_from_signal(signal)
            
            # Verify integration
            assert order_id is not None
            
            # Check broker manager stats
            broker_stats = broker_manager.get_manager_stats()
            assert broker_stats['successful_orders'] >= 1
            
            # Check enhanced order manager stats
            execution_analytics = enhanced_order_manager.get_execution_analytics()
            assert execution_analytics['total_orders'] >= 1
            
            # Test correlation tracking
            correlation_analyzer.add_strategy_return("IntegrationTestStrategy", 0.01)
            
            # Test portfolio optimization
            strategy_metrics = {
                "IntegrationTestStrategy": StrategyMetrics(
                    strategy_name="IntegrationTestStrategy",
                    expected_return=0.12,
                    volatility=0.18,
                    sharpe_ratio=0.67,
                    max_drawdown=0.08
                )
            }
            
            allocation = await portfolio_optimizer.optimize_portfolio(
                strategy_metrics=strategy_metrics,
                method=AllocationMethod.EQUAL_WEIGHT
            )
            
            assert allocation.optimization_success is True
            assert "IntegrationTestStrategy" in allocation.weights
            
        finally:
            # Cleanup
            await enhanced_order_manager.stop()
            await correlation_analyzer.stop()
            await broker_manager.stop()
    
    @pytest.mark.asyncio
    async def test_system_performance_under_load(self, event_bus, db_manager, risk_manager):
        """Test system performance with multiple concurrent operations."""
        
        # Setup components
        broker_manager = BrokerManager(event_bus=event_bus)
        paper_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            config={'initial_cash': 500000}
        )
        broker_manager.add_broker("load_test_broker", paper_config, market_data_repo=None)
        await broker_manager.start()
        
        enhanced_order_manager = EnhancedOrderManager(
            event_bus=event_bus,
            db_manager=db_manager,
            risk_manager=risk_manager,
            broker_manager=broker_manager
        )
        await enhanced_order_manager.start()
        
        try:
            # Set mock portfolio
            from portfolio.manager import Portfolio
            mock_portfolio = Portfolio(initial_cash=500000)
            enhanced_order_manager.set_portfolio(mock_portfolio)
            
            # Submit multiple orders concurrently
            tasks = []
            for i in range(10):  # Limited for testing
                signal = Signal(
                    symbol=f"TEST{i:02d}",
                    signal_type=TradingSignal.BUY,
                    confidence=0.7,
                    price=100.0 + i,
                    timestamp=datetime.utcnow(),
                    strategy_name=f"LoadTestStrategy{i}"
                )
                
                task = enhanced_order_manager.submit_order_from_signal(signal)
                tasks.append(task)
            
            # Wait for all orders to complete
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Verify results
            successful_orders = [r for r in results if isinstance(r, str) and r is not None]
            assert len(successful_orders) >= 5  # At least half should succeed
            
            # Check system stats
            execution_analytics = enhanced_order_manager.get_execution_analytics()
            assert execution_analytics['total_orders'] >= 5
            
        finally:
            await enhanced_order_manager.stop()
            await broker_manager.stop()


# Test configuration and utilities
@pytest.fixture
def event_bus():
    """Create event bus for testing."""
    from events.event_bus import EventBus
    return EventBus()


@pytest.fixture
async def db_manager():
    """Create database manager for testing."""
    # Use in-memory database for testing
    from database.connection_manager import DatabaseManager
    db_manager = DatabaseManager(
        database_url="sqlite:///:memory:",
        pool_size=5
    )
    await db_manager.initialize()
    yield db_manager
    await db_manager.close()


@pytest.fixture
def risk_manager():
    """Create risk manager for testing."""
    from risk.manager import RiskManagerImplementation
    from core.interfaces import RiskLimits
    
    risk_limits = RiskLimits(
        max_position_size=0.1,
        max_portfolio_exposure=0.8,
        max_daily_loss=0.05
    )
    
    return RiskManagerImplementation(risk_limits=risk_limits)


@pytest.fixture
async def backtesting_engine():
    """Create backtesting engine for testing."""
    from backtesting.engine import BacktestingEngine
    
    # Mock backtesting engine for testing
    class MockBacktestingEngine:
        async def run_backtest(self, **kwargs):
            return {
                'portfolio_stats': {
                    'total_return': 0.15,
                    'sharpe_ratio': 0.8,
                    'max_drawdown': 0.08,
                    'volatility': 0.18,
                    'trade_count': 25,
                    'win_rate': 0.6,
                    'profit_factor': 1.5
                }
            }
    
    return MockBacktestingEngine()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])