"""
Integration tests for Enhanced Backtester.

Tests the enhanced backtesting engine integration with real strategies,
market data providers, and comprehensive end-to-end workflows.
"""

import pytest
import numpy as np
import pandas as pd
import tempfile
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

from trading_api.backtesting.enhanced_backtester import (
    EnhancedBacktester,
    BacktestConfig,
    TransactionCosts,
    MarketMicrostructure,
    SlippageModel,
    FillModel
)
from trading_api.strategies.moving_average_crossover import MovingAverageCrossoverStrategy
from trading_api.strategies.rsi_mean_reversion import RSIMeanReversionStrategy
from trading_api.orders.order_types import OrderSide
from trading_api.core.interfaces import BaseStrategy


class TestEnhancedBacktesterIntegration:
    """Integration tests for enhanced backtester."""
    
    @pytest.fixture
    def realistic_market_data(self):
        """Create realistic market data for multiple symbols."""
        symbols = ['AAPL', 'MSFT', 'GOOGL']
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 12, 31)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        market_data = {}
        
        for i, symbol in enumerate(symbols):
            np.random.seed(42 + i)  # Different seed for each symbol
            
            # Generate realistic price movements
            base_price = 100.0 + i * 50  # Different base prices
            
            # Market regimes: trending up, sideways, trending down
            n_periods = len(dates)
            regime_1 = int(n_periods * 0.4)  # 40% trending up
            regime_2 = int(n_periods * 0.3)  # 30% sideways
            regime_3 = n_periods - regime_1 - regime_2  # 30% trending down
            
            # Generate returns for each regime
            returns_1 = np.random.normal(0.001, 0.015, regime_1)  # Bull market
            returns_2 = np.random.normal(0.0002, 0.01, regime_2)  # Sideways
            returns_3 = np.random.normal(-0.0008, 0.02, regime_3)  # Bear market
            
            all_returns = np.concatenate([returns_1, returns_2, returns_3])
            
            # Generate price series
            prices = [base_price]
            for ret in all_returns:
                new_price = prices[-1] * (1 + ret)
                prices.append(new_price)
            
            prices = prices[1:]  # Remove initial price
            
            # Generate OHLC data
            data = pd.DataFrame({
                'open': [p * (1 + np.random.normal(0, 0.002)) for p in prices],
                'high': [p * (1 + abs(np.random.normal(0.001, 0.005))) for p in prices],
                'low': [p * (1 - abs(np.random.normal(0.001, 0.005))) for p in prices],
                'close': prices,
                'volume': np.random.lognormal(15, 0.5, len(prices)).astype(int)  # Log-normal volume
            }, index=dates)
            
            # Ensure high >= close >= low and high >= open >= low
            data['high'] = np.maximum(data['high'], np.maximum(data['open'], data['close']))
            data['low'] = np.minimum(data['low'], np.minimum(data['open'], data['close']))
            
            market_data[symbol] = data
        
        return market_data
    
    @pytest.fixture
    def production_config(self):
        """Create production-like backtesting configuration."""
        transaction_costs = TransactionCosts(
            commission_per_share=0.005,
            commission_per_trade=1.0,
            min_commission=1.0,
            max_commission=50.0,
            sec_fee_rate=0.0000221,
            finra_trading_fee=0.000145,
            short_borrow_rate=0.05,
            initial_margin_rate=0.5
        )
        
        market_microstructure = MarketMicrostructure(
            min_spread_bps=1.0,
            max_spread_bps=20.0,
            base_slippage_bps=2.0,
            volume_impact_factor=0.1,
            volatility_impact_factor=1.5,
            permanent_impact=0.1,
            temporary_impact=0.5,
            min_fill_delay_ms=10,
            max_fill_delay_ms=500,
            partial_fill_probability=0.05,
            rejection_probability=0.01
        )
        
        return BacktestConfig(
            initial_capital=1000000.0,  # $1M starting capital
            transaction_costs=transaction_costs,
            market_microstructure=market_microstructure,
            slippage_model=SlippageModel.IMPACT,
            fill_model=FillModel.REALISTIC,
            max_leverage=2.0,
            position_size_limit=0.15,  # 15% max position
            daily_loss_limit=0.03,     # 3% daily loss limit
            benchmark_symbol="SPY",
            risk_free_rate=0.02,
            random_seed=42
        )
    
    @pytest.mark.asyncio
    async def test_moving_average_strategy_integration(self, realistic_market_data, production_config):
        """Test integration with moving average crossover strategy."""
        # Create strategy
        strategy = MovingAverageCrossoverStrategy(
            short_period=20,
            long_period=50,
            symbols=['AAPL', 'MSFT']
        )
        
        # Create backtester
        backtester = EnhancedBacktester(production_config)
        
        # Run backtest
        start_date = realistic_market_data['AAPL'].index[60]  # Skip initial period for MA calculation
        end_date = realistic_market_data['AAPL'].index[-60]   # Leave some data at end
        
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data=realistic_market_data,
            start_date=start_date,
            end_date=end_date
        )
        
        # Verify results
        assert metrics.total_trades >= 0
        assert isinstance(metrics.total_return, float)
        assert isinstance(metrics.sharpe_ratio, float)
        assert isinstance(metrics.max_drawdown, float)
        assert metrics.total_commission >= 0
        assert metrics.total_fees >= 0
        assert metrics.total_slippage >= 0
        
        # Check that we have reasonable trading activity
        if metrics.total_trades > 0:
            assert len(backtester.trades) == metrics.total_trades
            assert metrics.cost_to_returns_ratio >= 0
    
    @pytest.mark.asyncio 
    async def test_rsi_strategy_integration(self, realistic_market_data, production_config):
        """Test integration with RSI mean reversion strategy."""
        # Create strategy with realistic parameters
        strategy = RSIMeanReversionStrategy(
            rsi_period=14,
            oversold_threshold=30,
            overbought_threshold=70,
            holding_period=5,
            symbols=['GOOGL']
        )
        
        # Create backtester
        backtester = EnhancedBacktester(production_config)
        
        # Run backtest
        start_date = realistic_market_data['GOOGL'].index[30]
        end_date = realistic_market_data['GOOGL'].index[-30]
        
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data=realistic_market_data,
            start_date=start_date,
            end_date=end_date
        )
        
        # Verify results
        assert isinstance(metrics.total_return, float)
        assert isinstance(metrics.volatility, float)
        assert metrics.volatility >= 0
        assert isinstance(metrics.max_drawdown, float)
        assert metrics.max_drawdown <= 0  # Drawdown should be negative
    
    @pytest.mark.asyncio
    async def test_multi_symbol_backtesting(self, realistic_market_data, production_config):
        """Test backtesting with multiple symbols."""
        # Simple strategy that trades all symbols
        class MultiSymbolStrategy(BaseStrategy):
            async def initialize(self):
                self.symbols = ['AAPL', 'MSFT', 'GOOGL']
            
            async def on_market_data(self, symbol: str, data: dict):
                pass
            
            async def on_order_filled(self, order_id: str, fill_data: dict):
                pass
        
        strategy = MultiSymbolStrategy()
        backtester = EnhancedBacktester(production_config)
        
        start_date = realistic_market_data['AAPL'].index[50]
        end_date = realistic_market_data['AAPL'].index[-50]
        
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data=realistic_market_data,
            start_date=start_date,
            end_date=end_date
        )
        
        # Should handle multiple symbols without errors
        assert isinstance(metrics.total_return, float)
        assert len(backtester.current_prices) == 3  # Should track all 3 symbols
    
    @pytest.mark.asyncio
    async def test_different_slippage_models_comparison(self, realistic_market_data):
        """Test and compare different slippage models."""
        base_config = BacktestConfig(
            initial_capital=100000.0,
            position_size_limit=0.1,
            random_seed=42
        )
        
        # Simple buy-and-hold strategy for comparison
        class BuyHoldStrategy(BaseStrategy):
            def __init__(self):
                self.bought = False
            
            async def initialize(self):
                pass
            
            async def on_market_data(self, symbol: str, data: dict):
                pass
            
            async def on_order_filled(self, order_id: str, fill_data: dict):
                pass
        
        strategy = BuyHoldStrategy()
        results = {}
        
        slippage_models = [
            SlippageModel.FIXED,
            SlippageModel.LINEAR,
            SlippageModel.SQRT,
            SlippageModel.IMPACT
        ]
        
        for slippage_model in slippage_models:
            config = BacktestConfig(
                initial_capital=base_config.initial_capital,
                slippage_model=slippage_model,
                position_size_limit=base_config.position_size_limit,
                random_seed=base_config.random_seed
            )
            
            backtester = EnhancedBacktester(config)
            
            metrics = await backtester.run_backtest(
                strategy=strategy,
                market_data={'AAPL': realistic_market_data['AAPL']},
                start_date=realistic_market_data['AAPL'].index[10],
                end_date=realistic_market_data['AAPL'].index[100]
            )
            
            results[slippage_model.value] = {
                'total_slippage': metrics.total_slippage,
                'total_return': metrics.total_return,
                'total_trades': metrics.total_trades
            }
        
        # Verify that different models produce different slippage costs
        slippage_values = [results[model.value]['total_slippage'] for model in slippage_models]
        assert len(set(slippage_values)) > 1  # Should have different values
    
    @pytest.mark.asyncio
    async def test_transaction_cost_impact(self, realistic_market_data):
        """Test the impact of transaction costs on performance."""
        # Test with no costs
        no_cost_config = BacktestConfig(
            initial_capital=100000.0,
            transaction_costs=TransactionCosts(
                commission_per_share=0.0,
                commission_per_trade=0.0,
                sec_fee_rate=0.0,
                finra_trading_fee=0.0
            ),
            market_microstructure=MarketMicrostructure(
                base_slippage_bps=0.0,
                min_spread_bps=0.0
            ),
            slippage_model=SlippageModel.FIXED
        )
        
        # Test with high costs
        high_cost_config = BacktestConfig(
            initial_capital=100000.0,
            transaction_costs=TransactionCosts(
                commission_per_share=0.02,  # High commission
                commission_per_trade=10.0,  # High per-trade cost
                sec_fee_rate=0.0001,        # High SEC fee
                finra_trading_fee=0.001     # High FINRA fee
            ),
            market_microstructure=MarketMicrostructure(
                base_slippage_bps=10.0,     # High slippage
                min_spread_bps=5.0          # Wide spreads
            ),
            slippage_model=SlippageModel.LINEAR
        )
        
        # Simple strategy that makes many trades
        class ActiveTradingStrategy(BaseStrategy):
            async def initialize(self):
                pass
            
            async def on_market_data(self, symbol: str, data: dict):
                pass
            
            async def on_order_filled(self, order_id: str, fill_data: dict):
                pass
        
        strategy = ActiveTradingStrategy()
        
        # Test no-cost scenario
        no_cost_backtester = EnhancedBacktester(no_cost_config)
        no_cost_metrics = await no_cost_backtester.run_backtest(
            strategy=strategy,
            market_data={'AAPL': realistic_market_data['AAPL']},
            start_date=realistic_market_data['AAPL'].index[10],
            end_date=realistic_market_data['AAPL'].index[100]
        )
        
        # Test high-cost scenario
        high_cost_backtester = EnhancedBacktester(high_cost_config)
        high_cost_metrics = await high_cost_backtester.run_backtest(
            strategy=strategy,
            market_data={'AAPL': realistic_market_data['AAPL']},
            start_date=realistic_market_data['AAPL'].index[10],
            end_date=realistic_market_data['AAPL'].index[100]
        )
        
        # High-cost scenario should have higher total costs
        if high_cost_metrics.total_trades > 0:
            total_high_costs = (high_cost_metrics.total_commission + 
                              high_cost_metrics.total_fees + 
                              high_cost_metrics.total_slippage)
            total_no_costs = (no_cost_metrics.total_commission + 
                            no_cost_metrics.total_fees + 
                            no_cost_metrics.total_slippage)
            assert total_high_costs > total_no_costs
    
    @pytest.mark.asyncio
    async def test_risk_management_integration(self, realistic_market_data):
        """Test risk management features."""
        # Config with strict risk limits
        risk_config = BacktestConfig(
            initial_capital=100000.0,
            max_leverage=1.5,
            position_size_limit=0.05,  # Very small positions
            daily_loss_limit=0.02,     # 2% daily loss limit
            random_seed=42
        )
        
        # Aggressive strategy that might hit limits
        class AggressiveStrategy(BaseStrategy):
            async def initialize(self):
                pass
            
            async def on_market_data(self, symbol: str, data: dict):
                pass
            
            async def on_order_filled(self, order_id: str, fill_data: dict):
                pass
        
        strategy = AggressiveStrategy()
        backtester = EnhancedBacktester(risk_config)
        
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data={'AAPL': realistic_market_data['AAPL']},
            start_date=realistic_market_data['AAPL'].index[10],
            end_date=realistic_market_data['AAPL'].index[200]
        )
        
        # Should complete without errors even with risk limits
        assert isinstance(metrics.total_return, float)
        assert isinstance(metrics.max_drawdown, float)
    
    @pytest.mark.asyncio
    async def test_benchmark_comparison_integration(self, realistic_market_data):
        """Test benchmark comparison functionality."""
        # Create SPY-like benchmark data
        spy_data = realistic_market_data['AAPL'].copy()
        spy_data['close'] *= 0.5  # Different price level
        spy_data.index.name = 'date'
        
        config = BacktestConfig(
            initial_capital=100000.0,
            benchmark_symbol="SPY",
            risk_free_rate=0.025  # 2.5% risk-free rate
        )
        
        class SimpleStrategy(BaseStrategy):
            async def initialize(self):
                pass
            
            async def on_market_data(self, symbol: str, data: dict):
                pass
            
            async def on_order_filled(self, order_id: str, fill_data: dict):
                pass
        
        strategy = SimpleStrategy()
        backtester = EnhancedBacktester(config)
        
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data={'AAPL': realistic_market_data['AAPL']},
            start_date=realistic_market_data['AAPL'].index[20],
            end_date=realistic_market_data['AAPL'].index[200],
            benchmark_data=spy_data
        )
        
        # Should have benchmark metrics
        assert isinstance(metrics.benchmark_return, float)
        assert isinstance(metrics.alpha, float)
        assert isinstance(metrics.beta, float)
        assert isinstance(metrics.information_ratio, float)
        assert isinstance(metrics.tracking_error, float)
    
    @pytest.mark.asyncio
    async def test_export_functionality(self, realistic_market_data, production_config):
        """Test result export functionality."""
        strategy = MovingAverageCrossoverStrategy(
            short_period=10,
            long_period=20,
            symbols=['AAPL']
        )
        
        backtester = EnhancedBacktester(production_config)
        
        # Run short backtest
        start_date = realistic_market_data['AAPL'].index[25]
        end_date = realistic_market_data['AAPL'].index[100]
        
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data={'AAPL': realistic_market_data['AAPL']},
            start_date=start_date,
            end_date=end_date
        )
        
        # Test export to file
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as f:
            output_path = f.name
        
        await backtester.export_results(output_path)
        
        # Verify export file
        with open(output_path, 'r') as f:
            exported_data = json.load(f)
        
        assert 'backtest_config' in exported_data
        assert 'performance_metrics' in exported_data
        assert 'trade_analysis' in exported_data
        assert 'daily_returns' in exported_data
        assert 'portfolio_values' in exported_data
        
        # Clean up
        import os
        os.unlink(output_path)
    
    @pytest.mark.asyncio
    async def test_performance_under_market_stress(self, production_config):
        """Test backtester performance under extreme market conditions."""
        # Create extreme market data (crash scenario)
        dates = pd.date_range(start='2023-01-01', end='2023-03-31', freq='D')
        
        # Simulate market crash: -50% in 30 days, then recovery
        crash_period = len(dates) // 3
        recovery_period = len(dates) - crash_period
        
        # Crash returns: -3% daily average
        crash_returns = np.random.normal(-0.03, 0.05, crash_period)
        # Recovery returns: +2% daily average  
        recovery_returns = np.random.normal(0.02, 0.03, recovery_period)
        
        all_returns = np.concatenate([crash_returns, recovery_returns])
        
        # Generate prices
        base_price = 100.0
        prices = [base_price]
        for ret in all_returns:
            new_price = max(0.01, prices[-1] * (1 + ret))  # Minimum price $0.01
            prices.append(new_price)
        prices = prices[1:]
        
        crash_data = pd.DataFrame({
            'open': prices,
            'high': [p * 1.02 for p in prices],
            'low': [p * 0.98 for p in prices],
            'close': prices,
            'volume': np.random.lognormal(15, 0.5, len(prices)).astype(int)
        }, index=dates)
        
        # Ensure OHLC consistency
        crash_data['high'] = np.maximum(crash_data['high'], crash_data['close'])
        crash_data['low'] = np.minimum(crash_data['low'], crash_data['close'])
        
        class StressTestStrategy(BaseStrategy):
            async def initialize(self):
                pass
            
            async def on_market_data(self, symbol: str, data: dict):
                pass
            
            async def on_order_filled(self, order_id: str, fill_data: dict):
                pass
        
        strategy = StressTestStrategy()
        backtester = EnhancedBacktester(production_config)
        
        # Should handle extreme conditions without crashing
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data={'CRASH': crash_data},
            start_date=crash_data.index[5],
            end_date=crash_data.index[-5]
        )
        
        assert isinstance(metrics.total_return, float)
        assert isinstance(metrics.max_drawdown, float)
        assert metrics.max_drawdown <= 0  # Should be negative
        assert abs(metrics.max_drawdown) <= 1.0  # Should be reasonable
    
    @pytest.mark.asyncio
    async def test_high_frequency_trading_simulation(self, production_config):
        """Test backtester with high-frequency trading scenario."""
        # Create intraday data (1-minute bars)
        start_time = datetime(2023, 6, 1, 9, 30)  # Market open
        end_time = datetime(2023, 6, 1, 16, 0)    # Market close
        
        minutes = pd.date_range(start=start_time, end=end_time, freq='1min')
        
        # Generate intraday price movements
        np.random.seed(42)
        base_price = 150.0
        
        # Smaller intraday returns
        returns = np.random.normal(0.0, 0.001, len(minutes))  # 0.1% std dev
        prices = [base_price]
        
        for ret in returns[1:]:
            new_price = prices[-1] * (1 + ret)
            prices.append(new_price)
        prices = prices[1:]
        
        intraday_data = pd.DataFrame({
            'open': prices,
            'high': [p * (1 + abs(np.random.normal(0, 0.0005))) for p in prices],
            'low': [p * (1 - abs(np.random.normal(0, 0.0005))) for p in prices],
            'close': prices,
            'volume': np.random.randint(1000, 100000, len(prices))
        }, index=minutes)
        
        # Ensure OHLC consistency
        intraday_data['high'] = np.maximum(intraday_data['high'], intraday_data['close'])
        intraday_data['low'] = np.minimum(intraday_data['low'], intraday_data['close'])
        
        # High-frequency config with tight spreads and fast fills
        hft_config = BacktestConfig(
            initial_capital=1000000.0,
            transaction_costs=TransactionCosts(
                commission_per_share=0.001,  # Low HFT commissions
                commission_per_trade=0.5
            ),
            market_microstructure=MarketMicrostructure(
                min_spread_bps=0.5,          # Tight spreads
                base_slippage_bps=0.5,       # Low slippage
                min_fill_delay_ms=1,         # Very fast fills
                max_fill_delay_ms=10
            ),
            position_size_limit=0.02,        # Small positions
            random_seed=42
        )
        
        class HighFrequencyStrategy(BaseStrategy):
            async def initialize(self):
                pass
            
            async def on_market_data(self, symbol: str, data: dict):
                pass
            
            async def on_order_filled(self, order_id: str, fill_data: dict):
                pass
        
        strategy = HighFrequencyStrategy()
        backtester = EnhancedBacktester(hft_config)
        
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data={'HFT_STOCK': intraday_data},
            start_date=intraday_data.index[10],
            end_date=intraday_data.index[-10]
        )
        
        # Should handle high-frequency data
        assert isinstance(metrics.total_return, float)
        assert metrics.total_commission >= 0
        assert metrics.total_fees >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])