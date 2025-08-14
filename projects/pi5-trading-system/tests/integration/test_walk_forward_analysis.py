"""
Integration tests for Walk-Forward Analysis system.

Tests the complete walk-forward analysis workflow including parameter optimization,
cross-validation, and statistical analysis.
"""

import asyncio
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from trading_api.optimization.walk_forward_analysis import (
    WalkForwardAnalyzer,
    WalkForwardConfig,
    WalkForwardMode,
    WalkForwardPeriod,
    WalkForwardResult
)
from trading_api.optimization.parameter_optimizer import (
    ParameterOptimizer,
    OptimizationAlgorithm,
    ObjectiveFunction,
    OptimizationConfig,
    OptimizationResult,
    ParameterSpace
)


class MockStrategy:
    """Mock strategy for testing."""
    
    def __init__(self, short_period=10, long_period=20, confidence_threshold=0.7):
        self.short_period = short_period
        self.long_period = long_period
        self.confidence_threshold = confidence_threshold


class MockMarketDataManager:
    """Mock market data manager for testing."""
    
    async def get_historical_data(self, symbol, start_date, end_date, frequency='1d'):
        """Generate synthetic market data for testing."""
        # Generate synthetic price data
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Remove weekends
        dates = dates[dates.dayofweek < 5]
        
        if len(dates) == 0:
            return pd.DataFrame()
        
        # Generate realistic price movements
        np.random.seed(42)  # For reproducible tests
        
        initial_price = 100.0
        returns = np.random.normal(0.0005, 0.02, len(dates))  # Daily returns
        prices = [initial_price]
        
        for ret in returns[1:]:
            prices.append(prices[-1] * (1 + ret))
        
        data = pd.DataFrame({
            'open': prices,
            'high': [p * (1 + abs(np.random.normal(0, 0.01))) for p in prices],
            'low': [p * (1 - abs(np.random.normal(0, 0.01))) for p in prices],
            'close': prices,
            'volume': np.random.randint(1000000, 10000000, len(dates))
        }, index=dates)
        
        return data


class MockPortfolioManager:
    """Mock portfolio manager for testing."""
    
    def __init__(self):
        self.positions = {}
        self.cash = 100000.0


class TestWalkForwardAnalysis:
    """Test walk-forward analysis functionality."""
    
    @pytest.fixture
    def mock_market_data_manager(self):
        """Create mock market data manager."""
        return MockMarketDataManager()
    
    @pytest.fixture
    def mock_portfolio_manager(self):
        """Create mock portfolio manager."""
        return MockPortfolioManager()
    
    @pytest.fixture
    def parameter_optimizer(self, mock_market_data_manager):
        """Create parameter optimizer."""
        return ParameterOptimizer(mock_market_data_manager)
    
    @pytest.fixture
    def walk_forward_analyzer(self, mock_market_data_manager, mock_portfolio_manager, parameter_optimizer):
        """Create walk-forward analyzer."""
        return WalkForwardAnalyzer(
            market_data_manager=mock_market_data_manager,
            parameter_optimizer=parameter_optimizer,
            portfolio_manager=mock_portfolio_manager
        )
    
    @pytest.mark.asyncio
    async def test_walk_forward_config_creation(self):
        """Test walk-forward configuration creation."""
        config = WalkForwardConfig(
            optimization_period_days=100,
            test_period_days=30,
            step_size_days=15,
            mode=WalkForwardMode.ROLLING_WINDOW
        )
        
        assert config.optimization_period_days == 100
        assert config.test_period_days == 30
        assert config.step_size_days == 15
        assert config.mode == WalkForwardMode.ROLLING_WINDOW
        assert config.min_trades_required == 10
        assert config.objective_function == "sharpe_ratio"
    
    @pytest.mark.asyncio
    async def test_period_generation(self, walk_forward_analyzer):
        """Test walk-forward period generation."""
        start_date = datetime(2022, 1, 1)
        end_date = datetime(2023, 1, 1)
        
        config = WalkForwardConfig(
            optimization_period_days=90,
            test_period_days=30,
            step_size_days=30
        )
        
        periods = await walk_forward_analyzer._generate_periods(start_date, end_date, config)
        
        assert len(periods) > 0
        
        # Check first period
        first_period = periods[0]
        assert first_period.period_id == 1
        assert first_period.optimization_start == start_date
        assert first_period.optimization_end == start_date + timedelta(days=90)
        assert first_period.test_start == first_period.optimization_end
        assert first_period.test_end == first_period.test_start + timedelta(days=30)
        
        # Check periods don't overlap improperly
        for i in range(len(periods) - 1):
            current = periods[i]
            next_period = periods[i + 1]
            
            # Next optimization should start after current test period
            assert next_period.optimization_start >= current.optimization_start + timedelta(days=config.step_size_days)
    
    @pytest.mark.asyncio
    async def test_parameter_space_sampling(self):
        """Test parameter space sampling."""
        # Integer parameter
        int_space = ParameterSpace(
            name="test_int",
            param_type="int",
            min_value=5,
            max_value=20,
            step=1
        )
        
        for _ in range(10):
            value = int_space.sample()
            assert isinstance(value, int)
            assert 5 <= value <= 20
            assert int_space.validate(value)
        
        # Float parameter
        float_space = ParameterSpace(
            name="test_float",
            param_type="float",
            min_value=0.1,
            max_value=0.9,
            step=0.1
        )
        
        for _ in range(10):
            value = float_space.sample()
            assert isinstance(value, (int, float))
            assert 0.1 <= value <= 0.9
            assert float_space.validate(value)
        
        # Categorical parameter
        cat_space = ParameterSpace(
            name="test_cat",
            param_type="categorical",
            values=["option1", "option2", "option3"]
        )
        
        for _ in range(10):
            value = cat_space.sample()
            assert value in ["option1", "option2", "option3"]
            assert cat_space.validate(value)
    
    @pytest.mark.asyncio
    async def test_parameter_optimization(self, parameter_optimizer):
        """Test parameter optimization functionality."""
        strategy_class = MockStrategy
        symbol = "TEST"
        start_date = datetime(2022, 1, 1)
        end_date = datetime(2022, 6, 1)
        
        parameter_ranges = {
            'short_period': (5, 15, 1),
            'long_period': (20, 40, 2),
            'confidence_threshold': (0.5, 0.9, 0.1)
        }
        
        config = OptimizationConfig(
            algorithm=OptimizationAlgorithm.RANDOM_SEARCH,
            max_iterations=20,  # Small for testing
            cross_validation_folds=2
        )
        
        result = await parameter_optimizer.optimize_parameters(
            strategy_class=strategy_class,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            parameter_ranges=parameter_ranges,
            config=config
        )
        
        assert isinstance(result, OptimizationResult)
        assert result.algorithm_used == OptimizationAlgorithm.RANDOM_SEARCH
        assert result.total_evaluations <= 20
        
        if result.success:
            assert result.best_parameters is not None
            assert 'short_period' in result.best_parameters
            assert 'long_period' in result.best_parameters
            assert 'confidence_threshold' in result.best_parameters
            
            # Validate parameter ranges
            assert 5 <= result.best_parameters['short_period'] <= 15
            assert 20 <= result.best_parameters['long_period'] <= 40
            assert 0.5 <= result.best_parameters['confidence_threshold'] <= 0.9
    
    @pytest.mark.asyncio
    async def test_walk_forward_analysis_workflow(self, walk_forward_analyzer):
        """Test complete walk-forward analysis workflow."""
        strategy_class = MockStrategy
        symbol = "AAPL"
        start_date = datetime(2022, 1, 1)
        end_date = datetime(2022, 12, 31)
        
        parameter_ranges = {
            'short_period': (5, 15, 2),
            'long_period': (20, 30, 5),
            'confidence_threshold': (0.6, 0.8, 0.1)
        }
        
        config = WalkForwardConfig(
            optimization_period_days=120,
            test_period_days=30,
            step_size_days=30,
            max_iterations=10,  # Small for testing
            min_trades_required=1  # Lower for testing
        )
        
        result = await walk_forward_analyzer.run_walk_forward_analysis(
            strategy_class=strategy_class,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            parameter_ranges=parameter_ranges,
            config=config,
            initial_capital=100000.0
        )
        
        assert isinstance(result, WalkForwardResult)
        assert result.strategy_name == "MockStrategy"
        assert result.symbol == symbol
        assert result.config == config
        assert result.analysis_start == start_date
        assert result.analysis_end == end_date
        assert result.total_periods > 0
        
        # Check aggregate metrics are calculated
        assert hasattr(result, 'total_return')
        assert hasattr(result, 'sharpe_ratio')
        assert hasattr(result, 'max_drawdown')
        
        # Check walk-forward specific metrics
        assert hasattr(result, 'optimization_efficiency')
        assert hasattr(result, 'parameter_stability')
        assert hasattr(result, 'performance_consistency')
        
        # Validate periods
        for period in result.periods:
            assert isinstance(period, WalkForwardPeriod)
            assert period.optimization_start < period.optimization_end
            assert period.test_start >= period.optimization_end
            assert period.test_end > period.test_start
            
            if period.is_valid:
                assert len(period.optimal_parameters) > 0
                assert len(period.test_performance) > 0
    
    @pytest.mark.asyncio
    async def test_backtest_calculation(self, parameter_optimizer):
        """Test backtest calculation functionality."""
        # Get some synthetic market data
        market_data_manager = MockMarketDataManager()
        data = await market_data_manager.get_historical_data(
            symbol="TEST",
            start_date=datetime(2022, 1, 1),
            end_date=datetime(2022, 6, 1),
            frequency='1d'
        )
        
        parameters = {
            'short_period': 10,
            'long_period': 20,
            'confidence_threshold': 0.7
        }
        
        metrics = await parameter_optimizer._run_backtest(
            strategy_class=MockStrategy,
            symbol="TEST",
            market_data=data,
            parameters=parameters,
            initial_capital=100000.0
        )
        
        # Check that metrics are calculated
        expected_metrics = [
            'total_return', 'annualized_return', 'volatility',
            'sharpe_ratio', 'max_drawdown', 'calmar_ratio',
            'sortino_ratio', 'profit_factor', 'trade_count'
        ]
        
        for metric in expected_metrics:
            assert metric in metrics
            assert isinstance(metrics[metric], (int, float))
            assert not np.isnan(metrics[metric]) or metric == 'profit_factor'  # Profit factor can be inf
    
    @pytest.mark.asyncio
    async def test_performance_metrics_calculation(self):
        """Test performance metrics calculation."""
        # Create test data
        daily_returns = [0.01, -0.005, 0.02, -0.01, 0.015, -0.008, 0.012]
        
        # Calculate metrics manually for verification
        total_return = np.prod(1 + np.array(daily_returns)) - 1
        annualized_return = (1 + total_return) ** (252 / len(daily_returns)) - 1
        volatility = np.std(daily_returns) * np.sqrt(252)
        sharpe_ratio = annualized_return / volatility if volatility > 0 else 0
        
        # Calculate drawdown
        cumulative_returns = np.cumprod(1 + np.array(daily_returns))
        running_max = np.maximum.accumulate(cumulative_returns)
        drawdowns = (cumulative_returns - running_max) / running_max
        max_drawdown = np.min(drawdowns)
        
        # Verify calculations are reasonable
        assert isinstance(total_return, float)
        assert isinstance(annualized_return, float)
        assert isinstance(volatility, float)
        assert isinstance(sharpe_ratio, float)
        assert isinstance(max_drawdown, float)
        
        assert volatility > 0  # Should have some volatility
        assert max_drawdown <= 0  # Drawdown should be negative or zero
    
    @pytest.mark.asyncio
    async def test_statistical_analysis(self, walk_forward_analyzer):
        """Test statistical analysis of results."""
        # Create a result with some periods for testing
        result = WalkForwardResult(
            strategy_name="TestStrategy",
            symbol="TEST",
            config=WalkForwardConfig()
        )
        
        # Add some test periods with performance data
        for i in range(10):
            period = WalkForwardPeriod(
                period_id=i + 1,
                optimization_start=datetime(2022, 1, 1),
                optimization_end=datetime(2022, 4, 1),
                test_start=datetime(2022, 4, 1),
                test_end=datetime(2022, 5, 1),
                is_valid=True
            )
            
            # Add some test performance (varying returns)
            period.test_performance = {
                'total_return': np.random.normal(0.02, 0.05),  # 2% average return with 5% std
                'sharpe_ratio': np.random.normal(0.8, 0.3),
                'max_drawdown': np.random.normal(-0.05, 0.02)
            }
            
            result.periods.append(period)
        
        # Perform statistical analysis
        await walk_forward_analyzer._perform_statistical_analysis(result)
        
        # Check that statistical metrics are calculated
        assert isinstance(result.statistical_significance, float)
        assert 0 <= result.statistical_significance <= 1
        assert isinstance(result.confidence_interval, tuple)
        assert len(result.confidence_interval) == 2
        assert result.confidence_interval[0] <= result.confidence_interval[1]
    
    @pytest.mark.asyncio
    async def test_parameter_stability_calculation(self, walk_forward_analyzer):
        """Test parameter stability calculation."""
        periods = []
        
        # Create periods with varying parameter stability
        base_params = {'short_period': 10, 'long_period': 20, 'threshold': 0.7}
        
        for i in range(5):
            period = WalkForwardPeriod(
                period_id=i + 1,
                optimization_start=datetime(2022, 1, 1),
                optimization_end=datetime(2022, 4, 1),
                test_start=datetime(2022, 4, 1),
                test_end=datetime(2022, 5, 1),
                is_valid=True
            )
            
            # Add some variation to parameters
            period.optimal_parameters = {
                'short_period': base_params['short_period'] + np.random.randint(-2, 3),
                'long_period': base_params['long_period'] + np.random.randint(-5, 6),
                'threshold': base_params['threshold'] + np.random.uniform(-0.1, 0.1)
            }
            
            periods.append(period)
        
        stability = await walk_forward_analyzer._calculate_parameter_stability(periods)
        
        assert isinstance(stability, float)
        assert 0 <= stability <= 1
    
    @pytest.mark.asyncio
    async def test_result_serialization(self, walk_forward_analyzer, tmp_path):
        """Test saving and loading of results."""
        # Create a simple result
        result = WalkForwardResult(
            strategy_name="TestStrategy",
            symbol="TEST",
            config=WalkForwardConfig(),
            total_return=0.15,
            sharpe_ratio=1.2,
            max_drawdown=-0.08,
            analysis_start=datetime(2022, 1, 1),
            analysis_end=datetime(2022, 12, 31)
        )
        
        # Add a test period
        period = WalkForwardPeriod(
            period_id=1,
            optimization_start=datetime(2022, 1, 1),
            optimization_end=datetime(2022, 4, 1),
            test_start=datetime(2022, 4, 1),
            test_end=datetime(2022, 5, 1),
            optimal_parameters={'param1': 10, 'param2': 0.5},
            test_performance={'return': 0.05, 'sharpe': 0.8},
            is_valid=True
        )
        result.periods.append(period)
        
        # Save result
        output_path = tmp_path / "test_result.json"
        await walk_forward_analyzer.save_results(result, str(output_path))
        
        # Verify file was created
        assert output_path.exists()
        
        # Load result
        loaded_result = await walk_forward_analyzer.load_results(str(output_path))
        
        # Verify loaded result matches original
        assert loaded_result.strategy_name == result.strategy_name
        assert loaded_result.symbol == result.symbol
        assert loaded_result.total_return == result.total_return
        assert loaded_result.sharpe_ratio == result.sharpe_ratio
        assert loaded_result.max_drawdown == result.max_drawdown
        assert len(loaded_result.periods) == len(result.periods)
        
        loaded_period = loaded_result.periods[0]
        assert loaded_period.period_id == period.period_id
        assert loaded_period.optimal_parameters == period.optimal_parameters
        assert loaded_period.test_performance == period.test_performance
        assert loaded_period.is_valid == period.is_valid


class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    @pytest.mark.asyncio
    async def test_empty_market_data(self):
        """Test handling of empty market data."""
        market_data_manager = MockMarketDataManager()
        parameter_optimizer = ParameterOptimizer(market_data_manager)
        
        # Mock empty data
        original_method = market_data_manager.get_historical_data
        market_data_manager.get_historical_data = AsyncMock(return_value=pd.DataFrame())
        
        try:
            result = await parameter_optimizer.optimize_parameters(
                strategy_class=MockStrategy,
                symbol="EMPTY",
                start_date=datetime(2022, 1, 1),
                end_date=datetime(2022, 2, 1),
                parameter_ranges={'param': (1, 10, 1)},
                config=OptimizationConfig(max_iterations=5)
            )
            
            assert not result.success
            
        finally:
            # Restore original method
            market_data_manager.get_historical_data = original_method
    
    @pytest.mark.asyncio
    async def test_invalid_parameter_ranges(self):
        """Test handling of invalid parameter ranges."""
        market_data_manager = MockMarketDataManager()
        parameter_optimizer = ParameterOptimizer(market_data_manager)
        
        # Test with invalid ranges
        invalid_ranges = {
            'param1': (10, 5, 1),  # min > max
            'param2': (1, 10, 0),  # zero step
        }
        
        result = await parameter_optimizer.optimize_parameters(
            strategy_class=MockStrategy,
            symbol="TEST",
            start_date=datetime(2022, 1, 1),
            end_date=datetime(2022, 2, 1),
            parameter_ranges=invalid_ranges,
            config=OptimizationConfig(max_iterations=5)
        )
        
        # Should handle gracefully
        assert isinstance(result, OptimizationResult)
    
    @pytest.mark.asyncio
    async def test_insufficient_data_periods(self, walk_forward_analyzer):
        """Test handling when insufficient data for periods."""
        config = WalkForwardConfig(
            optimization_period_days=300,  # Very long period
            test_period_days=100,
            step_size_days=50
        )
        
        start_date = datetime(2022, 1, 1)
        end_date = datetime(2022, 3, 1)  # Only 2 months of data
        
        periods = await walk_forward_analyzer._generate_periods(start_date, end_date, config)
        
        # Should return empty list or very few periods
        assert len(periods) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])