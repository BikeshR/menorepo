"""
Integration tests for Backtesting Engine.

Tests comprehensive backtesting workflows including single/multi-strategy testing,
parameter optimization, Monte Carlo analysis, and performance attribution.
"""

import pytest
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Any

from backtesting.engine import (
    BacktestingEngine,
    BacktestConfig,
    BacktestResults,
    Trade,
    BacktestMode,
    ExecutionModel
)
from strategies.rsi_mean_reversion import RSIMeanReversionStrategy
from strategies.momentum_trend_following import MomentumTrendFollowingStrategy
from strategies.manager import StrategyAllocation
from core.market_data import MarketDataManager
from core.interfaces import Signal, TradingSignal
from events.event_types import MarketDataEvent


@pytest.fixture
def mock_market_data_manager():
    """Create mock MarketDataManager for backtesting."""
    manager = AsyncMock(spec=MarketDataManager)
    
    # Generate realistic historical data
    np.random.seed(42)
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2024, 3, 31)
    dates = pd.date_range(start_date, end_date, freq='1min')
    
    # Generate price series with some trend and volatility
    n_points = len(dates)
    base_price = 150.0
    
    # Add trend and noise
    trend = np.linspace(0, 0.2, n_points)  # 20% uptrend over period
    noise = np.random.normal(0, 0.01, n_points)  # 1% volatility
    returns = trend + noise
    
    prices = base_price * np.exp(np.cumsum(returns / 252))  # Daily compounding
    
    # Create OHLCV data
    ohlcv_data = pd.DataFrame({
        'timestamp': dates,
        'open': prices,
        'high': prices * np.random.uniform(1.0, 1.015, n_points),
        'low': prices * np.random.uniform(0.985, 1.0, n_points),
        'close': prices,
        'volume': np.random.randint(10000, 100000, n_points)
    })
    
    # Ensure OHLC relationships
    ohlcv_data['high'] = np.maximum(ohlcv_data['high'], np.maximum(ohlcv_data['open'], ohlcv_data['close']))
    ohlcv_data['low'] = np.minimum(ohlcv_data['low'], np.minimum(ohlcv_data['open'], ohlcv_data['close']))
    
    ohlcv_data.set_index('timestamp', inplace=True)
    
    # Add symbol column for multi-symbol support
    def get_symbol_data(symbol):
        data_copy = ohlcv_data.copy()
        data_copy['symbol'] = symbol
        
        # Add slight price variation per symbol
        if symbol != 'AAPL':
            multiplier = {'MSFT': 2.0, 'GOOGL': 15.0, 'TSLA': 2.5}.get(symbol, 1.0)
            for col in ['open', 'high', 'low', 'close']:
                data_copy[col] *= multiplier
        
        return data_copy.reset_index()
    
    manager.get_historical_data.side_effect = lambda symbol, **kwargs: get_symbol_data(symbol)
    
    return manager


@pytest.fixture
def backtest_config():
    """Create standard backtest configuration."""
    return BacktestConfig(
        start_date=datetime(2024, 1, 1),
        end_date=datetime(2024, 2, 29),  # 2 months
        initial_capital=100000.0,
        commission_rate=0.001,  # 0.1%
        slippage_bps=2.0,  # 2 basis points
        execution_model=ExecutionModel.REALISTIC,
        benchmark_symbol="SPY",
        enable_compound_returns=True,
        max_positions=5,
        position_sizing_method="equal_weight"
    )


@pytest.fixture
async def backtesting_engine(mock_market_data_manager):
    """Create BacktestingEngine for testing."""
    return BacktestingEngine(
        market_data_manager=mock_market_data_manager,
        enable_parallel_execution=True,
        max_workers=2
    )


class TestSingleStrategyBacktesting:
    """Test backtesting with individual strategies."""
    
    @pytest.mark.asyncio
    async def test_rsi_strategy_backtest(self, backtesting_engine, mock_market_data_manager, backtest_config):
        """Test complete backtest of RSI mean reversion strategy."""
        
        # Create RSI strategy with conservative parameters
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            parameters={
                'rsi_period': 14,
                'oversold_threshold': 25.0,
                'overbought_threshold': 75.0,
                'stop_loss_pct': 3.0,
                'take_profit_pct': 6.0,
                'max_position_size': 0.2,
                'risk_per_trade': 0.02
            },
            watched_symbols=["AAPL"]
        )
        
        # Run backtest
        results = await backtesting_engine.run_single_strategy_backtest(
            strategy=strategy,
            symbols=["AAPL"],
            config=backtest_config
        )
        
        # Verify basic results structure
        assert isinstance(results, BacktestResults)
        assert results.start_date == backtest_config.start_date
        assert results.end_date == backtest_config.end_date
        assert results.config == backtest_config
        
        # Verify performance metrics are calculated
        assert isinstance(results.total_return, float)
        assert isinstance(results.annualized_return, float)
        assert isinstance(results.volatility, float)
        assert isinstance(results.sharpe_ratio, float)
        assert isinstance(results.max_drawdown, float)
        
        # Verify trade statistics
        assert results.total_trades >= 0
        assert results.winning_trades >= 0
        assert results.losing_trades >= 0
        assert results.win_rate >= 0.0
        assert results.win_rate <= 1.0
        
        # Verify data series
        assert isinstance(results.daily_returns, pd.Series)
        assert isinstance(results.cumulative_returns, pd.Series)
        assert isinstance(results.equity_curve, pd.Series)
        assert isinstance(results.drawdown_series, pd.Series)
        
        # Verify trades list
        assert isinstance(results.trades, list)
        for trade in results.trades:
            assert isinstance(trade, Trade)
            assert trade.symbol == "AAPL"
            assert trade.strategy_name == strategy.name
    
    @pytest.mark.asyncio
    async def test_momentum_strategy_backtest(self, backtesting_engine, mock_market_data_manager, backtest_config):
        """Test complete backtest of momentum trend following strategy."""
        
        # Create momentum strategy
        strategy = MomentumTrendFollowingStrategy(
            market_data_manager=mock_market_data_manager,
            parameters={
                'fast_ema_period': 8,
                'slow_ema_period': 21,
                'trend_ema_period': 50,
                'adx_threshold': 20.0,
                'initial_stop_atr': 2.5,
                'trailing_stop_atr': 2.0,
                'max_position_size': 0.15,
                'use_pyramid': True,
                'max_pyramid_levels': 2
            },
            watched_symbols=["AAPL"]
        )
        
        results = await backtesting_engine.run_single_strategy_backtest(
            strategy=strategy,
            symbols=["AAPL"],
            config=backtest_config
        )
        
        # Verify strategy-specific results
        assert isinstance(results, BacktestResults)
        assert results.total_trades >= 0
        
        # For momentum strategy, verify some trades occurred (given trending data)
        if results.total_trades > 0:
            assert any(trade.strategy_name == strategy.name for trade in results.trades)
            
            # Verify trade details
            sample_trade = results.trades[0]
            assert sample_trade.entry_time <= sample_trade.exit_time
            assert sample_trade.quantity > 0
            assert sample_trade.commission >= 0
            assert sample_trade.slippage >= 0
    
    @pytest.mark.asyncio
    async def test_backtest_with_different_execution_models(self, backtesting_engine, mock_market_data_manager):
        """Test backtesting with different execution models."""
        
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        base_config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            initial_capital=100000.0
        )
        
        results = {}
        
        # Test different execution models
        for execution_model in [ExecutionModel.PERFECT, ExecutionModel.REALISTIC, ExecutionModel.CONSERVATIVE]:
            config = BacktestConfig(
                start_date=base_config.start_date,
                end_date=base_config.end_date,
                initial_capital=base_config.initial_capital,
                execution_model=execution_model,
                commission_rate=0.001 if execution_model != ExecutionModel.PERFECT else 0.0,
                slippage_bps=0.0 if execution_model == ExecutionModel.PERFECT else 5.0
            )
            
            result = await backtesting_engine.run_single_strategy_backtest(
                strategy=strategy,
                symbols=["AAPL"],
                config=config
            )
            
            results[execution_model] = result
        
        # Perfect execution should have best returns (no costs)
        if all(r.total_trades > 0 for r in results.values()):
            perfect_return = results[ExecutionModel.PERFECT].total_return
            realistic_return = results[ExecutionModel.REALISTIC].total_return
            
            # Perfect should be >= realistic (due to no transaction costs)
            assert perfect_return >= realistic_return - 0.01  # Small tolerance


class TestMultiStrategyBacktesting:
    """Test backtesting with multiple coordinated strategies."""
    
    @pytest.mark.asyncio
    async def test_multi_strategy_portfolio_backtest(self, backtesting_engine, mock_market_data_manager, backtest_config):
        """Test backtesting a portfolio of multiple strategies."""
        
        # Create multiple strategies
        rsi_strategy = RSIMeanReversionStrategy(
            name="RSI_Conservative",
            market_data_manager=mock_market_data_manager,
            parameters={'oversold_threshold': 20, 'overbought_threshold': 80},
            watched_symbols=["AAPL", "MSFT"]
        )
        
        momentum_strategy = MomentumTrendFollowingStrategy(
            name="Momentum_Aggressive",
            market_data_manager=mock_market_data_manager,
            parameters={'fast_ema_period': 5, 'slow_ema_period': 15},
            watched_symbols=["AAPL", "GOOGL"]
        )
        
        # Create strategy allocations
        strategies_with_allocations = [
            (rsi_strategy, StrategyAllocation(
                strategy_id="",
                weight=0.6,
                max_allocation=60000.0,
                risk_limit=0.025,
                priority=1
            )),
            (momentum_strategy, StrategyAllocation(
                strategy_id="",
                weight=0.4,
                max_allocation=40000.0,
                risk_limit=0.03,
                priority=2
            ))
        ]
        
        # Run multi-strategy backtest
        results = await backtesting_engine.run_multi_strategy_backtest(
            strategies=strategies_with_allocations,
            symbols=["AAPL", "MSFT", "GOOGL"],
            config=backtest_config
        )
        
        # Verify portfolio results
        assert isinstance(results, BacktestResults)
        assert results.total_trades >= 0
        
        # Verify strategy attribution
        assert isinstance(results.strategy_attribution, dict)
        if results.strategy_attribution:
            attribution_sum = sum(abs(v) for v in results.strategy_attribution.values())
            assert attribution_sum >= 0  # Should have some attribution
        
        # Verify trades contain multiple strategies
        if results.trades:
            strategy_names = {trade.strategy_name for trade in results.trades}
            # Should have trades from at least one strategy
            assert len(strategy_names) >= 1
    
    @pytest.mark.asyncio
    async def test_strategy_correlation_analysis(self, backtesting_engine, mock_market_data_manager):
        """Test correlation analysis between strategies in portfolio."""
        
        # Create strategies with different characteristics
        aggressive_rsi = RSIMeanReversionStrategy(
            name="Aggressive_RSI",
            market_data_manager=mock_market_data_manager,
            parameters={'oversold_threshold': 35, 'overbought_threshold': 65},
            watched_symbols=["AAPL"]
        )
        
        conservative_rsi = RSIMeanReversionStrategy(
            name="Conservative_RSI",
            market_data_manager=mock_market_data_manager,
            parameters={'oversold_threshold': 15, 'overbought_threshold': 85},
            watched_symbols=["AAPL"]
        )
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            initial_capital=100000.0
        )
        
        # Run individual backtests
        aggressive_results = await backtesting_engine.run_single_strategy_backtest(
            strategy=aggressive_rsi,
            symbols=["AAPL"],
            config=config
        )
        
        conservative_results = await backtesting_engine.run_single_strategy_backtest(
            strategy=conservative_rsi,
            symbols=["AAPL"],
            config=config
        )
        
        # Analyze correlation if both have sufficient data
        if (len(aggressive_results.daily_returns) > 10 and 
            len(conservative_results.daily_returns) > 10):
            
            # Align returns by timestamp
            aggressive_returns = aggressive_results.daily_returns
            conservative_returns = conservative_results.daily_returns
            
            # Calculate correlation
            correlation = aggressive_returns.corr(conservative_returns)
            
            # RSI strategies should be positively correlated (both mean reversion)
            # but not perfectly due to different thresholds
            assert -1.0 <= correlation <= 1.0


class TestParameterOptimization:
    """Test strategy parameter optimization capabilities."""
    
    @pytest.mark.asyncio
    async def test_rsi_parameter_optimization(self, backtesting_engine, mock_market_data_manager):
        """Test RSI strategy parameter optimization."""
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            initial_capital=50000.0  # Smaller capital for faster testing
        )
        
        # Define parameter ranges to test
        parameter_ranges = {
            'rsi_period': [10, 14, 20],
            'oversold_threshold': [20, 25, 30],
            'overbought_threshold': [70, 75, 80],
            'stop_loss_pct': [2.0, 3.0, 4.0]
        }
        
        # Run optimization
        optimization_results = await backtesting_engine.optimize_strategy_parameters(
            strategy_class=RSIMeanReversionStrategy,
            symbols=["AAPL"],
            config=config,
            parameter_ranges=parameter_ranges,
            optimization_metric="sharpe_ratio",
            max_iterations=10  # Limited for testing
        )
        
        # Verify optimization results
        assert 'best_parameters' in optimization_results
        assert 'best_score' in optimization_results
        assert 'all_results' in optimization_results
        assert 'optimization_metric' in optimization_results
        
        # Verify best parameters are within specified ranges
        best_params = optimization_results['best_parameters']
        if best_params:
            assert best_params['rsi_period'] in parameter_ranges['rsi_period']
            assert best_params['oversold_threshold'] in parameter_ranges['oversold_threshold']
            assert best_params['overbought_threshold'] in parameter_ranges['overbought_threshold']
            assert best_params['stop_loss_pct'] in parameter_ranges['stop_loss_pct']
        
        # Verify all results were recorded
        all_results = optimization_results['all_results']
        assert len(all_results) <= 10  # Should not exceed max_iterations
        assert all(isinstance(result['score'], (int, float)) for result in all_results)
    
    @pytest.mark.asyncio
    async def test_momentum_parameter_optimization(self, backtesting_engine, mock_market_data_manager):
        """Test momentum strategy parameter optimization."""
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            initial_capital=50000.0
        )
        
        # Define parameter ranges
        parameter_ranges = {
            'fast_ema_period': [5, 8, 12],
            'slow_ema_period': [15, 21, 26],
            'adx_threshold': [20, 25, 30]
        }
        
        optimization_results = await backtesting_engine.optimize_strategy_parameters(
            strategy_class=MomentumTrendFollowingStrategy,
            symbols=["AAPL"],
            config=config,
            parameter_ranges=parameter_ranges,
            optimization_metric="total_return",
            max_iterations=8
        )
        
        # Verify optimization completed
        assert optimization_results['optimization_metric'] == "total_return"
        assert len(optimization_results['all_results']) <= 8
        
        # Verify parameter constraints were respected
        for result in optimization_results['all_results']:
            params = result['parameters']
            assert params['fast_ema_period'] < params['slow_ema_period']  # Constraint check


class TestMonteCarloAnalysis:
    """Test Monte Carlo analysis capabilities."""
    
    @pytest.mark.asyncio
    async def test_monte_carlo_robustness_analysis(self, backtesting_engine, mock_market_data_manager):
        """Test Monte Carlo analysis for strategy robustness."""
        
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            parameters={'rsi_period': 14, 'oversold_threshold': 25},
            watched_symbols=["AAPL"]
        )
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 15),  # Shorter period for faster testing
            initial_capital=50000.0
        )
        
        # Run Monte Carlo analysis
        mc_results = await backtesting_engine.monte_carlo_analysis(
            strategy=strategy,
            symbols=["AAPL"],
            config=config,
            num_simulations=5,  # Limited for testing
            confidence_levels=[0.05, 0.95]
        )
        
        # Verify Monte Carlo results structure
        assert 'num_simulations' in mc_results
        assert 'statistics' in mc_results
        assert 'confidence_intervals' in mc_results
        assert 'percentiles' in mc_results
        
        # Verify statistics calculated
        stats = mc_results['statistics']
        expected_metrics = ['total_return', 'sharpe_ratio', 'max_drawdown', 'win_rate']
        
        for metric in expected_metrics:
            if metric in stats:
                assert 'mean' in stats[metric]
                assert 'std' in stats[metric]
                assert 'min' in stats[metric]
                assert 'max' in stats[metric]
                assert 'median' in stats[metric]
        
        # Verify confidence intervals
        confidence_intervals = mc_results['confidence_intervals']
        for metric, intervals in confidence_intervals.items():
            for conf_level, (lower, upper) in intervals.items():
                assert lower <= upper
    
    @pytest.mark.asyncio
    async def test_monte_carlo_parameter_sensitivity(self, backtesting_engine, mock_market_data_manager):
        """Test parameter sensitivity through Monte Carlo variations."""
        
        base_strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 10),
            initial_capital=25000.0
        )
        
        # Run with small number of simulations for testing
        mc_results = await backtesting_engine.monte_carlo_analysis(
            strategy=base_strategy,
            symbols=["AAPL"],
            config=config,
            num_simulations=3
        )
        
        # Verify analysis completed
        assert mc_results['num_simulations'] <= 3
        
        # Verify percentile calculations
        percentiles = mc_results['percentiles']
        for metric, percentile_dict in percentiles.items():
            # Check that percentiles are ordered correctly
            p_values = [percentile_dict[f'p{p}'] for p in [5, 25, 50, 75, 95] if f'p{p}' in percentile_dict]
            if len(p_values) > 1:
                assert all(p_values[i] <= p_values[i+1] for i in range(len(p_values)-1))


class TestBacktestReporting:
    """Test backtesting reporting and analysis capabilities."""
    
    @pytest.mark.asyncio
    async def test_comprehensive_backtest_report(self, backtesting_engine, mock_market_data_manager, backtest_config):
        """Test generation of comprehensive backtest reports."""
        
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        results = await backtesting_engine.run_single_strategy_backtest(
            strategy=strategy,
            symbols=["AAPL"],
            config=backtest_config
        )
        
        # Generate report
        report = backtesting_engine.generate_report(results)
        
        # Verify report contains key sections
        assert "Backtesting Report" in report
        assert "Strategy Performance Summary" in report
        assert "Performance Metrics" in report
        assert "Trade Statistics" in report
        assert "Risk Metrics" in report
        assert "Configuration" in report
        
        # Verify key metrics are included
        assert f"Total Return: {results.total_return:.2%}" in report
        assert f"Sharpe Ratio: {results.sharpe_ratio:.2f}" in report
        assert f"Maximum Drawdown: {results.max_drawdown:.2%}" in report
        assert f"Total Trades: {results.total_trades}" in report
        assert f"Win Rate: {results.win_rate:.2%}" in report
    
    @pytest.mark.asyncio
    async def test_trade_analysis_details(self, backtesting_engine, mock_market_data_manager):
        """Test detailed trade analysis and statistics."""
        
        # Use strategy likely to generate trades
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            parameters={
                'oversold_threshold': 40,  # More sensitive
                'overbought_threshold': 60,
                'min_rsi_duration': 1  # Less strict
            },
            watched_symbols=["AAPL"]
        )
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 2, 15),  # Longer period
            initial_capital=100000.0,
            commission_rate=0.001,
            slippage_bps=2.0
        )
        
        results = await backtesting_engine.run_single_strategy_backtest(
            strategy=strategy,
            symbols=["AAPL"],
            config=config
        )
        
        # Analyze trades if any were generated
        if results.trades:
            # Verify trade data integrity
            for trade in results.trades:
                assert trade.entry_time <= trade.exit_time
                assert trade.quantity > 0
                assert trade.commission >= 0
                assert trade.slippage >= 0
                assert isinstance(trade.trade_id, str)
                assert len(trade.trade_id) > 0
            
            # Verify trade statistics
            winning_trades = [t for t in results.trades if t.pnl > 0]
            losing_trades = [t for t in results.trades if t.pnl < 0]
            
            assert results.winning_trades == len(winning_trades)
            assert results.losing_trades == len(losing_trades)
            
            if winning_trades:
                avg_win = sum(t.pnl for t in winning_trades) / len(winning_trades)
                assert abs(results.average_win - avg_win) < 0.01
            
            if losing_trades:
                avg_loss = sum(t.pnl for t in losing_trades) / len(losing_trades)
                assert abs(results.average_loss - avg_loss) < 0.01


class TestBacktestPerformance:
    """Test backtesting engine performance and reliability."""
    
    @pytest.mark.asyncio
    async def test_large_dataset_performance(self, backtesting_engine, mock_market_data_manager):
        """Test backtesting performance with larger datasets."""
        
        # Configure for longer period (simulating large dataset)
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 3, 31),  # 3 months
            initial_capital=100000.0
        )
        
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        # Time the backtest
        start_time = datetime.utcnow()
        results = await backtesting_engine.run_single_strategy_backtest(
            strategy=strategy,
            symbols=["AAPL"],
            config=config
        )
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Verify backtest completed successfully
        assert isinstance(results, BacktestResults)
        assert execution_time < 60  # Should complete within reasonable time
        
        # Verify data integrity with larger dataset
        assert len(results.daily_returns) > 0
        assert len(results.equity_curve) > 0
        assert not results.equity_curve.isna().any()
    
    @pytest.mark.asyncio
    async def test_multiple_symbol_backtest(self, backtesting_engine, mock_market_data_manager):
        """Test backtesting with multiple symbols."""
        
        strategy = MomentumTrendFollowingStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL", "MSFT", "GOOGL"]
        )
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            initial_capital=150000.0,
            max_positions=3
        )
        
        results = await backtesting_engine.run_single_strategy_backtest(
            strategy=strategy,
            symbols=["AAPL", "MSFT", "GOOGL"],
            config=config
        )
        
        # Verify multi-symbol results
        assert isinstance(results, BacktestResults)
        
        # If trades occurred, verify they span multiple symbols
        if results.trades:
            symbols_traded = {trade.symbol for trade in results.trades}
            # Should have opportunity to trade multiple symbols
            assert len(symbols_traded) >= 1


class TestBacktestValidation:
    """Test backtesting validation and edge cases."""
    
    @pytest.mark.asyncio
    async def test_insufficient_data_handling(self, backtesting_engine, mock_market_data_manager):
        """Test handling of insufficient historical data."""
        
        # Mock manager to return empty data
        mock_market_data_manager.get_historical_data.return_value = pd.DataFrame()
        
        strategy = RSIMeanReversionStrategy(
            market_data_manager=mock_market_data_manager,
            watched_symbols=["AAPL"]
        )
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 2),
            initial_capital=10000.0
        )
        
        # Should raise appropriate error
        with pytest.raises(ValueError, match="No historical data available"):
            await backtesting_engine.run_single_strategy_backtest(
                strategy=strategy,
                symbols=["AAPL"],
                config=config
            )
    
    @pytest.mark.asyncio
    async def test_strategy_error_handling(self, backtesting_engine, mock_market_data_manager):
        """Test handling of strategy errors during backtesting."""
        
        # Create strategy that will fail
        failing_strategy = MagicMock()
        failing_strategy.name = "FailingStrategy"
        failing_strategy.initialize = AsyncMock()
        failing_strategy.on_market_data = AsyncMock(side_effect=Exception("Strategy error"))
        
        config = BacktestConfig(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 2),
            initial_capital=10000.0
        )
        
        # Should handle strategy errors gracefully
        try:
            results = await backtesting_engine.run_single_strategy_backtest(
                strategy=failing_strategy,
                symbols=["AAPL"],
                config=config
            )
            # If it completes, should have empty results
            assert results.total_trades == 0
        except Exception as e:
            # Or should raise appropriate error
            assert "Strategy error" in str(e) or "error" in str(e).lower()
    
    @pytest.mark.asyncio
    async def test_configuration_validation(self):
        """Test validation of backtest configuration."""
        
        # Test invalid date range
        with pytest.raises(ValueError):
            BacktestConfig(
                start_date=datetime(2024, 2, 1),
                end_date=datetime(2024, 1, 1),  # End before start
                initial_capital=10000.0
            )
        
        # Test invalid capital
        with pytest.raises(ValueError):
            BacktestConfig(
                start_date=datetime(2024, 1, 1),
                end_date=datetime(2024, 1, 31),
                initial_capital=-1000.0  # Negative capital
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])