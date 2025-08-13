#!/usr/bin/env python3
"""
Strategy Backtesting Implementation and Testing

Demonstrates comprehensive backtesting of trading strategies using historical data
with realistic execution simulation, performance analysis, and risk assessment.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional

# Add trading_api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'trading_api'))

from events.event_bus import EventBus
from events.event_types import MarketDataEvent, OrderFilledEvent
from strategies.moving_average_crossover import MovingAverageCrossoverStrategy
from strategies.realtime_moving_average import RealTimeMovingAverageStrategy

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SimpleBacktestEngine:
    """
    Simplified backtesting engine for demonstration purposes.
    
    Simulates trading with historical data, tracks portfolio performance,
    and calculates comprehensive performance metrics.
    """
    
    def __init__(
        self,
        initial_capital: float = 100000.0,
        commission_rate: float = 0.001,  # 0.1%
        slippage_bps: float = 2.0        # 2 basis points
    ):
        self.initial_capital = initial_capital
        self.commission_rate = commission_rate  
        self.slippage_bps = slippage_bps / 10000  # Convert to decimal
        
        # Portfolio state
        self.cash = initial_capital
        self.positions = {}  # symbol -> quantity
        self.portfolio_values = []  # Historical portfolio values
        self.trades = []  # List of executed trades
        
        # Performance tracking
        self.daily_returns = []
        self.timestamps = []
        
        logger.info(f"Backtesting engine initialized: ${initial_capital:,.0f} capital")
    
    async def run_backtest(
        self, 
        strategy,
        historical_data: pd.DataFrame,
        symbol: str
    ) -> Dict[str, Any]:
        """
        Run backtest with a strategy and historical data.
        
        Args:
            strategy: Trading strategy instance
            historical_data: Historical OHLCV data
            symbol: Trading symbol
            
        Returns:
            Backtest results dictionary
        """
        logger.info(f"Starting backtest: {strategy.name} on {symbol}")
        logger.info(f"Data period: {historical_data.index.min()} to {historical_data.index.max()}")
        logger.info(f"Total data points: {len(historical_data)}")
        
        # Initialize strategy
        await strategy.initialize()
        
        # Track initial portfolio value
        initial_portfolio_value = self.cash
        self.portfolio_values.append(initial_portfolio_value)
        self.timestamps.append(historical_data.index[0])
        
        # Simulate trading day by day
        for timestamp, row in historical_data.iterrows():
            # Create market data event
            market_event = MarketDataEvent(
                symbol=symbol,
                timestamp=timestamp,
                open_price=float(row['open']),
                high_price=float(row['high']),
                low_price=float(row['low']),
                close_price=float(row['close']),
                volume=int(row['volume'])
            )
            
            # Process market data with strategy
            try:
                signals = await strategy.on_market_data(market_event)
                
                # Execute signals
                for signal in signals:
                    await self._execute_signal(signal, market_event)
                
            except Exception as e:
                if "insufficient history" not in str(e).lower():
                    logger.warning(f"Strategy error at {timestamp}: {e}")
            
            # Update portfolio value
            portfolio_value = self._calculate_portfolio_value(row['close'])
            self.portfolio_values.append(portfolio_value)
            self.timestamps.append(timestamp)
            
            # Calculate daily return
            if len(self.portfolio_values) > 1:
                daily_return = (portfolio_value - self.portfolio_values[-2]) / self.portfolio_values[-2]
                self.daily_returns.append(daily_return)
        
        # Calculate final results
        results = self._calculate_results(symbol)
        
        logger.info(f"Backtest completed: {len(self.trades)} trades executed")
        
        return results
    
    async def _execute_signal(self, signal, market_event: MarketDataEvent):
        """Execute a trading signal."""
        symbol = signal.symbol
        price = signal.price
        
        # Apply slippage (simplified)
        if signal.signal_type == signal.signal_type.BUY:
            execution_price = price * (1 + self.slippage_bps)
        else:
            execution_price = price * (1 - self.slippage_bps)
        
        # Calculate position size (simplified equal dollar amount)
        if signal.signal_type == signal.signal_type.BUY:
            # Buy signal - use 10% of cash for position
            cash_to_use = self.cash * 0.1
            quantity = int(cash_to_use / execution_price)
            
            if quantity > 0:
                # Calculate commission
                commission = cash_to_use * self.commission_rate
                total_cost = quantity * execution_price + commission
                
                if total_cost <= self.cash:
                    # Execute buy
                    self.cash -= total_cost
                    self.positions[symbol] = self.positions.get(symbol, 0) + quantity
                    
                    # Record trade
                    self.trades.append({
                        'timestamp': market_event.timestamp,
                        'symbol': symbol,
                        'action': 'BUY',
                        'quantity': quantity,
                        'price': execution_price,
                        'commission': commission,
                        'total_cost': total_cost,
                        'signal_confidence': signal.confidence
                    })
                    
                    logger.info(f"BUY: {quantity} {symbol} @ ${execution_price:.2f} "
                               f"(confidence: {signal.confidence:.2f})")
        
        elif signal.signal_type == signal.signal_type.SELL:
            # Sell signal - sell all holdings of this symbol
            quantity = self.positions.get(symbol, 0)
            
            if quantity > 0:
                # Execute sell
                gross_proceeds = quantity * execution_price
                commission = gross_proceeds * self.commission_rate
                net_proceeds = gross_proceeds - commission
                
                self.cash += net_proceeds
                self.positions[symbol] = 0
                
                # Record trade
                self.trades.append({
                    'timestamp': market_event.timestamp,
                    'symbol': symbol,
                    'action': 'SELL',
                    'quantity': quantity,
                    'price': execution_price,
                    'commission': commission,
                    'net_proceeds': net_proceeds,
                    'signal_confidence': signal.confidence
                })
                
                logger.info(f"SELL: {quantity} {symbol} @ ${execution_price:.2f} "
                           f"(confidence: {signal.confidence:.2f})")
    
    def _calculate_portfolio_value(self, current_price: float) -> float:
        """Calculate current portfolio value."""
        # Cash + (positions * current_price)
        holdings_value = sum(qty * current_price for qty in self.positions.values())
        return self.cash + holdings_value
    
    def _calculate_results(self, symbol: str) -> Dict[str, Any]:
        """Calculate comprehensive backtest results."""
        if len(self.portfolio_values) < 2:
            return {'error': 'Insufficient data for analysis'}
        
        # Basic performance metrics
        final_value = self.portfolio_values[-1]
        total_return = (final_value - self.initial_capital) / self.initial_capital
        
        # Calculate annualized return
        days = (self.timestamps[-1] - self.timestamps[0]).days
        years = days / 365.25
        annualized_return = (final_value / self.initial_capital) ** (1/years) - 1 if years > 0 else 0
        
        # Calculate volatility (annualized)
        if self.daily_returns:
            daily_volatility = np.std(self.daily_returns)
            annualized_volatility = daily_volatility * np.sqrt(252)
        else:
            annualized_volatility = 0
        
        # Calculate Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        sharpe_ratio = (annualized_return - risk_free_rate) / annualized_volatility if annualized_volatility > 0 else 0
        
        # Calculate maximum drawdown
        peak = np.maximum.accumulate(self.portfolio_values)
        drawdowns = (np.array(self.portfolio_values) - peak) / peak
        max_drawdown = np.min(drawdowns) if len(drawdowns) > 0 else 0
        
        # Win rate analysis
        profitable_trades = 0
        total_pnl = 0
        
        # Match buy/sell pairs to calculate PnL
        buy_trades = [t for t in self.trades if t['action'] == 'BUY']
        sell_trades = [t for t in self.trades if t['action'] == 'SELL']
        
        for sell_trade in sell_trades:
            # Find most recent buy for this symbol
            symbol_buys = [t for t in buy_trades 
                          if t['symbol'] == sell_trade['symbol'] 
                          and t['timestamp'] < sell_trade['timestamp']]
            
            if symbol_buys:
                buy_trade = max(symbol_buys, key=lambda x: x['timestamp'])
                
                # Calculate PnL for this trade pair
                buy_cost = buy_trade['quantity'] * buy_trade['price'] + buy_trade['commission']
                sell_proceeds = sell_trade['net_proceeds']
                trade_pnl = sell_proceeds - buy_cost
                
                total_pnl += trade_pnl
                if trade_pnl > 0:
                    profitable_trades += 1
        
        completed_trades = len(sell_trades)
        win_rate = profitable_trades / completed_trades if completed_trades > 0 else 0
        
        return {
            'initial_capital': self.initial_capital,
            'final_value': final_value,
            'total_return': total_return,
            'total_return_pct': total_return * 100,
            'annualized_return': annualized_return,
            'annualized_return_pct': annualized_return * 100,
            'annualized_volatility': annualized_volatility,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': abs(max_drawdown),
            'max_drawdown_pct': abs(max_drawdown) * 100,
            'total_trades': len(self.trades),
            'buy_trades': len([t for t in self.trades if t['action'] == 'BUY']),
            'sell_trades': len([t for t in self.trades if t['action'] == 'SELL']),
            'completed_trades': completed_trades,
            'win_rate': win_rate,
            'win_rate_pct': win_rate * 100,
            'total_pnl': total_pnl,
            'trading_period_days': days,
            'final_cash': self.cash,
            'final_positions': dict(self.positions)
        }


def generate_historical_data(symbol: str, days: int = 252, base_price: float = 100.0) -> pd.DataFrame:
    """Generate realistic historical data for backtesting."""
    logger.info(f"Generating {days} days of historical data for {symbol}")
    
    np.random.seed(42)  # Reproducible results
    
    dates = pd.date_range(end=datetime.utcnow(), periods=days, freq='1D')
    
    # Generate realistic price movements with trends
    returns = np.random.normal(0.001, 0.015, days)  # Slight positive drift, 1.5% volatility
    
    # Add trend cycles (bull/bear markets)
    trend_cycle_length = 60  # days
    for i in range(days):
        cycle_position = (i % trend_cycle_length) / trend_cycle_length
        trend_factor = np.sin(cycle_position * 2 * np.pi) * 0.002  # ±0.2% trend effect
        returns[i] += trend_factor
    
    # Calculate prices
    prices = [base_price]
    for ret in returns[1:]:
        prices.append(prices[-1] * (1 + ret))
    
    # Generate OHLCV data
    data = []
    for i, (date, price) in enumerate(zip(dates, prices)):
        # Realistic OHLC from close price
        daily_range = abs(np.random.normal(0, 0.01))  # Daily range ~1%
        
        open_price = price * (1 + np.random.normal(0, 0.005))
        high_price = max(open_price, price) * (1 + daily_range * 0.5)
        low_price = min(open_price, price) * (1 - daily_range * 0.5)
        close_price = price
        volume = max(int(np.random.normal(1000000, 200000)), 100000)
        
        data.append({
            'timestamp': date,
            'open': open_price,
            'high': high_price,
            'low': low_price,
            'close': close_price,
            'volume': volume
        })
    
    df = pd.DataFrame(data)
    df.set_index('timestamp', inplace=True)
    
    logger.info(f"Historical data: ${df['close'].min():.2f} - ${df['close'].max():.2f}")
    
    return df


async def main():
    """Run comprehensive strategy backtesting demonstration."""
    logger.info("Starting strategy backtesting implementation...")
    
    try:
        # Initialize event bus
        event_bus = EventBus()
        await event_bus.start()
        logger.info("Event bus started")
        
        # Generate historical data for backtesting
        test_symbol = "AAPL"
        historical_data = generate_historical_data(test_symbol, days=252, base_price=150.0)  # 1 year
        
        # Test multiple strategies
        strategies_to_test = [
            {
                'name': 'Standard MA Crossover',
                'strategy': MovingAverageCrossoverStrategy(
                    name="Backtest_MA_Standard",
                    parameters={
                        'short_period': 10,
                        'long_period': 30,
                        'confidence_threshold': 0.6,
                        'min_volume': 1000
                    },
                    symbols=[test_symbol]
                )
            },
            {
                'name': 'Real-time MA (Optimized)',  
                'strategy': RealTimeMovingAverageStrategy(
                    name="Backtest_MA_Realtime",
                    parameters={
                        'short_period': 10,
                        'long_period': 30,
                        'confidence_threshold': 0.6,
                        'signal_cooldown_seconds': 3600,  # 1 hour cooldown for daily data
                        'price_change_threshold': 0.005   # 0.5% price change threshold
                    },
                    symbols=[test_symbol]
                )
            }
        ]
        
        logger.info("\n" + "="*80)
        logger.info("STRATEGY BACKTESTING RESULTS")
        logger.info("="*80)
        
        backtest_results = []
        
        # Run backtests for each strategy
        for strategy_config in strategies_to_test:
            logger.info(f"\n📈 Testing: {strategy_config['name']}")
            logger.info("-" * 50)
            
            # Initialize backtesting engine
            backtest_engine = SimpleBacktestEngine(
                initial_capital=100000.0,
                commission_rate=0.001,
                slippage_bps=2.0
            )
            
            # Run backtest
            results = await backtest_engine.run_backtest(
                strategy_config['strategy'],
                historical_data,
                test_symbol
            )
            
            # Store results
            results['strategy_name'] = strategy_config['name']
            backtest_results.append(results)
            
            # Display results
            if 'error' not in results:
                logger.info(f"💰 Total Return: {results['total_return_pct']:+.2f}%")
                logger.info(f"📊 Annualized Return: {results['annualized_return_pct']:+.2f}%")
                logger.info(f"📉 Max Drawdown: {results['max_drawdown_pct']:.2f}%")
                logger.info(f"⚡ Sharpe Ratio: {results['sharpe_ratio']:.2f}")
                logger.info(f"🎯 Win Rate: {results['win_rate_pct']:.1f}%")
                logger.info(f"📈 Total Trades: {results['total_trades']} "
                           f"({results['completed_trades']} completed)")
                logger.info(f"💵 Final Value: ${results['final_value']:,.0f}")
            else:
                logger.error(f"Backtest failed: {results['error']}")
        
        # Compare strategies
        logger.info("\n" + "="*80)
        logger.info("STRATEGY COMPARISON")
        logger.info("="*80)
        
        valid_results = [r for r in backtest_results if 'error' not in r]
        
        if len(valid_results) > 1:
            best_strategy = max(valid_results, key=lambda x: x['sharpe_ratio'])
            
            logger.info(f"🏆 Best Strategy (by Sharpe Ratio): {best_strategy['strategy_name']}")
            logger.info(f"   Sharpe Ratio: {best_strategy['sharpe_ratio']:.2f}")
            logger.info(f"   Total Return: {best_strategy['total_return_pct']:+.2f}%")
            
            # Performance comparison table
            logger.info("\n📊 Performance Summary:")
            logger.info(f"{'Strategy':<25} {'Return':<12} {'Sharpe':<8} {'Drawdown':<10} {'Trades':<8}")
            logger.info("-" * 65)
            
            for result in valid_results:
                logger.info(f"{result['strategy_name']:<25} "
                           f"{result['total_return_pct']:+7.2f}%    "
                           f"{result['sharpe_ratio']:6.2f}  "
                           f"{result['max_drawdown_pct']:6.2f}%   "
                           f"{result['completed_trades']:6d}")
        
        logger.info("\n✅ Strategy backtesting implementation completed!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Backtesting failed: {e}", exc_info=True)
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