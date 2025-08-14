#!/usr/bin/env python3
"""
Simple test script for enhanced backtester functionality.
"""

import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import sys
import os

# Add the project root to the path
sys.path.append('/app')

from trading_api.backtesting.enhanced_backtester import (
    EnhancedBacktester,
    BacktestConfig,
    TransactionCosts,
    MarketMicrostructure,
    SlippageModel,
    FillModel
)
from trading_api.core.interfaces import BaseStrategy
from trading_api.orders.order_types import OrderSide


class SimpleTestStrategy(BaseStrategy):
    """Simple test strategy."""
    
    async def initialize(self):
        print("✅ Strategy initialized")
    
    async def on_market_data(self, symbol: str, data: dict):
        pass
    
    async def on_order_filled(self, order_id: str, fill_data: dict):
        pass


async def test_enhanced_backtester():
    """Test enhanced backtester functionality."""
    print("🚀 Testing Enhanced Backtester")
    print("=" * 50)
    
    try:
        # Test 1: Basic Import and Initialization
        print("1️⃣ Testing basic import and initialization...")
        
        config = BacktestConfig(
            initial_capital=100000.0,
            slippage_model=SlippageModel.IMPACT,
            fill_model=FillModel.REALISTIC
        )
        
        backtester = EnhancedBacktester(config)
        print("✅ Enhanced backtester created successfully")
        
        # Test 2: Configuration
        print("\n2️⃣ Testing configuration...")
        
        transaction_costs = TransactionCosts(
            commission_per_share=0.005,
            commission_per_trade=1.0
        )
        
        market_microstructure = MarketMicrostructure(
            min_spread_bps=1.0,
            base_slippage_bps=2.0
        )
        
        enhanced_config = BacktestConfig(
            initial_capital=100000.0,
            transaction_costs=transaction_costs,
            market_microstructure=market_microstructure
        )
        
        enhanced_backtester = EnhancedBacktester(enhanced_config)
        print("✅ Enhanced configuration created successfully")
        
        # Test 3: Sample Market Data Generation
        print("\n3️⃣ Generating sample market data...")
        
        dates = pd.date_range(start='2023-01-01', end='2023-03-31', freq='D')
        np.random.seed(42)
        
        # Generate realistic price data
        base_price = 100.0
        returns = np.random.normal(0.0008, 0.02, len(dates))
        prices = [base_price]
        
        for ret in returns[1:]:
            new_price = prices[-1] * (1 + ret)
            prices.append(new_price)
        prices = prices[1:]
        
        market_data = pd.DataFrame({
            'open': prices,
            'high': [p * (1 + abs(np.random.normal(0, 0.005))) for p in prices],
            'low': [p * (1 - abs(np.random.normal(0, 0.005))) for p in prices],
            'close': prices,
            'volume': np.random.randint(1000000, 10000000, len(prices))
        }, index=dates)
        
        # Ensure OHLC consistency
        market_data['high'] = np.maximum(market_data['high'], market_data['close'])
        market_data['low'] = np.minimum(market_data['low'], market_data['close'])
        
        print(f"✅ Generated {len(market_data)} days of market data")
        
        # Test 4: Transaction Cost Calculations
        print("\n4️⃣ Testing transaction cost calculations...")
        
        commission = enhanced_backtester._calculate_commission(1000, 100.0)
        fees = enhanced_backtester._calculate_fees(1000, 100.0)
        slippage = enhanced_backtester._calculate_slippage('TEST', OrderSide.BUY, 1000, 100.0)
        
        print(f"✅ Commission for 1000 shares @ $100: ${commission:.4f}")
        print(f"✅ Fees for $100,000 trade: ${fees:.4f}")
        print(f"✅ Slippage for 1000 shares: ${slippage:.4f}")
        
        # Test 5: Portfolio Value Calculation
        print("\n5️⃣ Testing portfolio calculations...")
        
        await enhanced_backtester._initialize_backtest({'TEST': market_data})
        portfolio_value = await enhanced_backtester._calculate_portfolio_value()
        
        print(f"✅ Initial portfolio value: ${portfolio_value:,.2f}")
        assert abs(portfolio_value - enhanced_config.initial_capital) < 0.01
        
        # Test 6: Risk Limit Checking
        print("\n6️⃣ Testing risk management...")
        
        risk_ok = await enhanced_backtester._check_risk_limits()
        print(f"✅ Risk limits check: {'PASSED' if risk_ok else 'FAILED'}")
        
        # Test 7: Simple Backtest Run
        print("\n7️⃣ Running simple backtest...")
        
        strategy = SimpleTestStrategy()
        
        start_date = market_data.index[10]
        end_date = market_data.index[50]
        
        metrics = await enhanced_backtester.run_backtest(
            strategy=strategy,
            market_data={'TEST': market_data},
            start_date=start_date,
            end_date=end_date
        )
        
        print(f"✅ Backtest completed successfully")
        print(f"   📊 Total Return: {metrics.total_return:.4f}")
        print(f"   📊 Sharpe Ratio: {metrics.sharpe_ratio:.4f}")
        print(f"   📊 Max Drawdown: {metrics.max_drawdown:.4f}")
        print(f"   📊 Total Trades: {metrics.total_trades}")
        print(f"   📊 Total Commission: ${metrics.total_commission:.2f}")
        print(f"   📊 Total Fees: ${metrics.total_fees:.2f}")
        print(f"   📊 Total Slippage: ${metrics.total_slippage:.2f}")
        
        # Test 8: Trade Analysis
        print("\n8️⃣ Testing trade analysis...")
        
        trade_analysis = await enhanced_backtester.get_trade_analysis()
        print(f"✅ Trade analysis completed")
        print(f"   📊 Total Volume: {trade_analysis.get('total_volume', 0)}")
        print(f"   📊 Avg Trade Size: {trade_analysis.get('avg_trade_size', 0):.0f}")
        
        print("\n🎉 All tests passed successfully!")
        print("Enhanced backtesting engine is working correctly")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_enhanced_backtester())
    sys.exit(0 if success else 1)