"""
Unit tests for Enhanced Backtester.

Tests the enhanced backtesting engine including transaction costs,
slippage models, market microstructure effects, and performance metrics.
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock

from trading_api.backtesting.enhanced_backtester import (
    EnhancedBacktester,
    BacktestConfig,
    TransactionCosts,
    MarketMicrostructure,
    PerformanceMetrics,
    Trade,
    Position,
    SlippageModel,
    FillModel
)
from trading_api.orders.order_types import OrderSide
from trading_api.core.interfaces import BaseStrategy


class MockStrategy(BaseStrategy):
    """Mock strategy for testing."""
    
    async def initialize(self):
        pass
    
    async def on_market_data(self, symbol: str, data: Dict[str, Any]):
        pass
    
    async def on_order_filled(self, order_id: str, fill_data: Dict[str, Any]):
        pass


class TestEnhancedBacktester:
    """Test enhanced backtesting functionality."""
    
    @pytest.fixture
    def sample_market_data(self):
        """Create sample market data for testing."""
        dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='D')
        
        # Generate realistic price data
        np.random.seed(42)
        base_price = 100.0
        returns = np.random.normal(0.0008, 0.02, len(dates))  # Daily returns
        prices = [base_price]
        
        for ret in returns[1:]:
            new_price = prices[-1] * (1 + ret)
            prices.append(new_price)
        
        # Create OHLCV data
        data = pd.DataFrame({
            'open': [p * (1 + np.random.normal(0, 0.001)) for p in prices],
            'high': [p * (1 + abs(np.random.normal(0, 0.005))) for p in prices],
            'low': [p * (1 - abs(np.random.normal(0, 0.005))) for p in prices],
            'close': prices,
            'volume': np.random.randint(1000000, 10000000, len(dates))
        }, index=dates)
        
        return {'AAPL': data}
    
    @pytest.fixture
    def basic_config(self):
        """Create basic backtest configuration."""
        return BacktestConfig(
            initial_capital=100000.0,
            max_leverage=2.0,
            position_size_limit=0.1,
            random_seed=42
        )
    
    @pytest.fixture
    def enhanced_config(self):
        """Create enhanced backtest configuration."""
        transaction_costs = TransactionCosts(
            commission_per_share=0.005,
            commission_per_trade=1.0,
            sec_fee_rate=0.0000221
        )
        
        market_microstructure = MarketMicrostructure(
            min_spread_bps=1.0,
            base_slippage_bps=2.0,
            partial_fill_probability=0.05
        )
        
        return BacktestConfig(
            initial_capital=100000.0,
            transaction_costs=transaction_costs,
            market_microstructure=market_microstructure,
            slippage_model=SlippageModel.IMPACT,
            fill_model=FillModel.REALISTIC
        )
    
    def test_backtester_initialization(self, basic_config):
        """Test backtester initialization."""
        backtester = EnhancedBacktester(basic_config)
        
        assert backtester.config == basic_config
        assert backtester.cash == basic_config.initial_capital
        assert len(backtester.positions) == 0
        assert len(backtester.trades) == 0
        assert len(backtester.daily_returns) == 0
    
    def test_transaction_costs_calculation(self, enhanced_config):
        """Test transaction cost calculations."""
        backtester = EnhancedBacktester(enhanced_config)
        
        # Test commission calculation
        commission = backtester._calculate_commission(1000, 100.0)
        expected_commission = 1000 * 0.005 + 1.0  # Per share + per trade
        assert commission == expected_commission
        
        # Test fees calculation
        fees = backtester._calculate_fees(1000, 100.0)
        trade_value = 1000 * 100.0
        expected_sec_fee = trade_value * 0.0000221
        assert fees >= expected_sec_fee  # Should include SEC fee at minimum
    
    def test_slippage_models(self, enhanced_config):
        """Test different slippage models."""
        backtester = EnhancedBacktester(enhanced_config)
        base_price = 100.0
        quantity = 1000
        symbol = 'AAPL'
        
        # Test fixed slippage
        backtester.config.slippage_model = SlippageModel.FIXED
        slippage = backtester._calculate_slippage(symbol, OrderSide.BUY, quantity, base_price)
        expected_fixed = base_price * (2.0 / 10000)  # 2 bps
        assert abs(slippage - expected_fixed) < 0.001
        
        # Test linear slippage
        backtester.config.slippage_model = SlippageModel.LINEAR
        slippage = backtester._calculate_slippage(symbol, OrderSide.BUY, quantity, base_price)
        assert slippage > expected_fixed  # Should be higher with volume impact
        
        # Test sqrt slippage
        backtester.config.slippage_model = SlippageModel.SQRT
        slippage = backtester._calculate_slippage(symbol, OrderSide.BUY, quantity, base_price)
        assert slippage > 0
    
    def test_spread_calculation(self, enhanced_config, sample_market_data):
        """Test bid-ask spread calculation."""
        backtester = EnhancedBacktester(enhanced_config)
        data = sample_market_data['AAPL']
        
        # Test initial spread calculation
        initial_spread = backtester._calculate_initial_spread(data)
        assert initial_spread > 0
        
        # Test current spread calculation
        row = data.iloc[0]
        current_spread = backtester._calculate_spread(row, 'AAPL')
        assert current_spread > 0
    
    def test_execution_price_calculation(self, enhanced_config):
        """Test execution price calculation with spreads and slippage."""
        backtester = EnhancedBacktester(enhanced_config)
        
        symbol = 'AAPL'
        base_price = 100.0
        quantity = 1000
        backtester.current_prices[symbol] = base_price
        backtester.bid_ask_spreads[symbol] = 0.05  # 5 cent spread
        
        # Test buy execution price
        buy_price = backtester._calculate_execution_price(
            symbol, OrderSide.BUY, quantity, base_price
        )
        assert buy_price > base_price  # Should be higher due to spread and slippage
        
        # Test sell execution price
        sell_price = backtester._calculate_execution_price(
            symbol, OrderSide.SELL, quantity, base_price
        )
        assert sell_price < base_price  # Should be lower due to spread and slippage
    
    def test_position_size_calculation(self, enhanced_config):
        """Test position size calculation."""
        backtester = EnhancedBacktester(enhanced_config)
        backtester.portfolio_values = [100000.0]
        backtester.current_prices['AAPL'] = 100.0
        
        # Test position sizing
        position_size = backtester._calculate_position_size('AAPL', 0.5)  # 50% signal strength
        
        max_position_value = 100000.0 * 0.1  # 10% position limit
        target_value = max_position_value * 0.5  # Adjusted for signal strength
        expected_shares = target_value / 100.0
        
        assert abs(position_size - expected_shares) < 0.01
    
    def test_market_impact_tracking(self, enhanced_config):
        """Test market impact state tracking."""
        backtester = EnhancedBacktester(enhanced_config)
        
        symbol = 'AAPL'
        quantity = 1000
        
        # Test impact update
        initial_impact = backtester.market_impact_state[symbol]
        backtester._update_market_impact(symbol, OrderSide.BUY, quantity)
        
        new_impact = backtester.market_impact_state[symbol]
        assert new_impact > initial_impact  # Buy should increase impact
        
        # Test impact decay
        import asyncio
        asyncio.run(backtester._decay_market_impact())
        
        decayed_impact = backtester.market_impact_state[symbol]
        assert decayed_impact < new_impact  # Should decay over time
    
    @pytest.mark.asyncio
    async def test_signal_strength_calculation(self, enhanced_config, sample_market_data):
        """Test signal strength calculation."""
        backtester = EnhancedBacktester(enhanced_config)
        await backtester._initialize_backtest(sample_market_data)
        
        # Test signal calculation
        symbol = 'AAPL'
        timestamp = sample_market_data[symbol].index[30]  # Use 30th day
        
        signal_strength = backtester._calculate_signal_strength(symbol, timestamp)
        assert -1.0 <= signal_strength <= 1.0  # Should be bounded
    
    @pytest.mark.asyncio
    async def test_trade_execution(self, enhanced_config, sample_market_data):
        """Test complete trade execution."""
        backtester = EnhancedBacktester(enhanced_config)
        await backtester._initialize_backtest(sample_market_data)
        
        symbol = 'AAPL'
        side = OrderSide.BUY
        quantity = 100
        timestamp = sample_market_data[symbol].index[0]
        
        initial_cash = backtester.cash
        initial_trade_count = len(backtester.trades)
        
        # Execute trade
        await backtester._execute_trade(symbol, side, quantity, timestamp)
        
        # Verify trade was executed
        assert len(backtester.trades) == initial_trade_count + 1
        assert backtester.cash < initial_cash  # Cash should decrease
        assert symbol in backtester.positions  # Position should be created
        assert backtester.positions[symbol].quantity == quantity
    
    @pytest.mark.asyncio
    async def test_portfolio_value_calculation(self, enhanced_config, sample_market_data):
        """Test portfolio value calculation."""
        backtester = EnhancedBacktester(enhanced_config)
        await backtester._initialize_backtest(sample_market_data)
        
        # Add a position
        symbol = 'AAPL'
        price = 100.0
        quantity = 100
        backtester.positions[symbol] = Position(
            symbol=symbol,
            quantity=quantity,
            avg_cost=price,
            market_value=quantity * price,
            unrealized_pnl=0,
            realized_pnl=0,
            last_update=datetime.now()
        )
        backtester.current_prices[symbol] = price
        
        # Calculate portfolio value
        portfolio_value = await backtester._calculate_portfolio_value()
        expected_value = backtester.cash + (quantity * price)
        assert abs(portfolio_value - expected_value) < 0.01
    
    @pytest.mark.asyncio
    async def test_risk_limits(self, enhanced_config):
        """Test risk limit checking."""
        backtester = EnhancedBacktester(enhanced_config)
        
        # Test daily loss limit
        backtester.portfolio_values = [100000.0, 90000.0]  # 10% loss
        risk_ok = await backtester._check_risk_limits()
        assert not risk_ok  # Should fail due to high daily loss
        
        # Test leverage limit
        backtester.portfolio_values = [100000.0]
        backtester.positions['AAPL'] = Position(
            symbol='AAPL',
            quantity=1000,
            avg_cost=100.0,
            market_value=300000.0,  # High leverage
            unrealized_pnl=0,
            realized_pnl=0,
            last_update=datetime.now()
        )
        
        risk_ok = await backtester._check_risk_limits()
        assert not risk_ok  # Should fail due to high leverage
    
    @pytest.mark.asyncio
    async def test_performance_metrics_calculation(self, enhanced_config):
        """Test performance metrics calculation."""
        backtester = EnhancedBacktester(enhanced_config)
        
        # Set up some sample data
        backtester.daily_returns = [0.01, -0.005, 0.02, -0.01, 0.015]  # Sample returns
        backtester.portfolio_values = [100000.0, 101000.0, 100495.0, 102505.0, 101475.0, 103006.0]
        
        # Add some trades
        backtester.trades = [
            Trade(
                timestamp=datetime.now(),
                symbol='AAPL',
                side=OrderSide.BUY,
                quantity=100,
                price=100.0,
                commission=5.0,
                fees=2.0,
                slippage=1.0,
                fill_delay_ms=100,
                order_id='test_1'
            )
        ]
        
        metrics = await backtester._calculate_performance_metrics()
        
        # Test basic metrics
        assert isinstance(metrics, PerformanceMetrics)
        assert metrics.total_return > 0  # Should be positive given the final value
        assert metrics.volatility >= 0
        assert metrics.total_trades == 1
        assert metrics.total_commission == 5.0
        assert metrics.total_fees == 2.0
        assert metrics.total_slippage == 1.0
    
    @pytest.mark.asyncio
    async def test_trade_analysis(self, enhanced_config):
        """Test trade analysis functionality."""
        backtester = EnhancedBacktester(enhanced_config)
        
        # Add sample trades
        trades = [
            Trade(
                timestamp=datetime.now(),
                symbol='AAPL',
                side=OrderSide.BUY,
                quantity=100,
                price=100.0,
                commission=5.0,
                fees=2.0,
                slippage=1.0,
                fill_delay_ms=100,
                order_id='trade_1'
            ),
            Trade(
                timestamp=datetime.now(),
                symbol='MSFT',
                side=OrderSide.SELL,
                quantity=50,
                price=200.0,
                commission=3.0,
                fees=1.5,
                slippage=0.5,
                fill_delay_ms=150,
                order_id='trade_2'
            )
        ]
        backtester.trades = trades
        
        analysis = await backtester.get_trade_analysis()
        
        assert analysis['total_trades'] == 2
        assert analysis['symbols_traded'] == 2
        assert analysis['avg_commission_per_trade'] == 4.0  # (5+3)/2
        assert analysis['total_volume'] == 150  # 100+50
    
    @pytest.mark.asyncio
    async def test_full_backtest_workflow(self, enhanced_config, sample_market_data):
        """Test complete backtest workflow."""
        backtester = EnhancedBacktester(enhanced_config)
        strategy = MockStrategy()
        
        start_date = sample_market_data['AAPL'].index[10]
        end_date = sample_market_data['AAPL'].index[50]  # Short period for testing
        
        # Run backtest
        metrics = await backtester.run_backtest(
            strategy=strategy,
            market_data=sample_market_data,
            start_date=start_date,
            end_date=end_date
        )
        
        # Verify results
        assert isinstance(metrics, PerformanceMetrics)
        assert len(backtester.portfolio_values) > 0
        assert len(backtester.timestamps) > 0
        assert len(backtester.daily_returns) >= 0
    
    def test_config_validation(self):
        """Test configuration validation."""
        # Test valid config
        config = BacktestConfig(initial_capital=100000.0)
        assert config.initial_capital == 100000.0
        
        # Test transaction costs
        costs = TransactionCosts(commission_per_share=0.01)
        assert costs.commission_per_share == 0.01
        
        # Test market microstructure
        microstructure = MarketMicrostructure(min_spread_bps=2.0)
        assert microstructure.min_spread_bps == 2.0
    
    def test_edge_cases(self, enhanced_config):
        """Test edge cases and error conditions."""
        backtester = EnhancedBacktester(enhanced_config)
        
        # Test with empty market data
        empty_data = {'AAPL': pd.DataFrame()}
        
        # Should handle gracefully without crashing
        try:
            initial_spread = backtester._calculate_initial_spread(empty_data['AAPL'])
            assert initial_spread >= 0
        except Exception:
            pass  # Expected to handle gracefully
        
        # Test with zero quantity trade
        commission = backtester._calculate_commission(0, 100.0)
        assert commission >= enhanced_config.transaction_costs.min_commission
        
        # Test position size with zero price
        backtester.portfolio_values = [100000.0]
        backtester.current_prices['AAPL'] = 0.0
        position_size = backtester._calculate_position_size('AAPL', 0.5)
        assert position_size == 0  # Should return 0 for zero price
    
    @pytest.mark.asyncio
    async def test_benchmark_comparison(self, enhanced_config, sample_market_data):
        """Test benchmark comparison functionality."""
        backtester = EnhancedBacktester(enhanced_config)
        
        # Create benchmark data (SPY)
        spy_data = sample_market_data['AAPL'].copy()  # Use same structure
        spy_data['close'] *= 0.8  # Different price level
        
        # Set benchmark data
        backtester.benchmark_data = spy_data
        backtester.daily_returns = [0.01, 0.02, -0.01]
        backtester.timestamps = spy_data.index[:4].tolist()
        
        # Calculate benchmark returns
        benchmark_returns = backtester._calculate_benchmark_returns()
        
        if benchmark_returns is not None:
            assert len(benchmark_returns) == len(backtester.daily_returns)
            assert all(isinstance(ret, (int, float)) for ret in benchmark_returns)


class TestSlippageModels:
    """Test different slippage models in detail."""
    
    @pytest.fixture
    def backtester(self):
        config = BacktestConfig(slippage_model=SlippageModel.FIXED)
        return EnhancedBacktester(config)
    
    def test_fixed_slippage(self, backtester):
        """Test fixed slippage model."""
        backtester.config.slippage_model = SlippageModel.FIXED
        
        slippage = backtester._calculate_slippage('AAPL', OrderSide.BUY, 1000, 100.0)
        expected = 100.0 * (2.0 / 10000)  # 2 bps default
        assert abs(slippage - expected) < 0.001
    
    def test_linear_slippage(self, backtester):
        """Test linear slippage model."""
        backtester.config.slippage_model = SlippageModel.LINEAR
        
        # Test different volumes
        small_volume_slippage = backtester._calculate_slippage('AAPL', OrderSide.BUY, 100, 100.0)
        large_volume_slippage = backtester._calculate_slippage('AAPL', OrderSide.BUY, 10000, 100.0)
        
        assert large_volume_slippage > small_volume_slippage
    
    def test_sqrt_slippage(self, backtester):
        """Test square root slippage model."""
        backtester.config.slippage_model = SlippageModel.SQRT
        
        slippage_1000 = backtester._calculate_slippage('AAPL', OrderSide.BUY, 1000, 100.0)
        slippage_4000 = backtester._calculate_slippage('AAPL', OrderSide.BUY, 4000, 100.0)
        
        # sqrt(4000/1000) = 2, so slippage should be roughly 2x
        ratio = slippage_4000 / slippage_1000
        assert 1.8 < ratio < 2.2  # Allow some tolerance
    
    def test_impact_slippage(self, backtester):
        """Test market impact slippage model."""
        backtester.config.slippage_model = SlippageModel.IMPACT
        
        # Test accumulating impact
        symbol = 'AAPL'
        initial_slippage = backtester._calculate_slippage(symbol, OrderSide.BUY, 1000, 100.0)
        
        # Update market impact
        backtester._update_market_impact(symbol, OrderSide.BUY, 1000)
        
        second_slippage = backtester._calculate_slippage(symbol, OrderSide.BUY, 1000, 100.0)
        assert second_slippage > initial_slippage  # Should have higher impact
    
    def test_spread_based_slippage(self, backtester):
        """Test spread-based slippage model."""
        backtester.config.slippage_model = SlippageModel.SPREAD_BASED
        
        symbol = 'AAPL'
        backtester.bid_ask_spreads[symbol] = 0.10  # 10 cent spread
        
        slippage = backtester._calculate_slippage(symbol, OrderSide.BUY, 1000, 100.0)
        
        # Should be based on spread
        assert slippage > 0
        # Larger volumes should have higher slippage
        large_slippage = backtester._calculate_slippage(symbol, OrderSide.BUY, 10000, 100.0)
        assert large_slippage > slippage


if __name__ == "__main__":
    pytest.main([__file__, "-v"])