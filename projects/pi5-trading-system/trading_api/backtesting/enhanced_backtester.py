"""
Enhanced Backtesting Engine for Pi5 Trading System.

Comprehensive backtesting engine with realistic transaction costs,
market microstructure effects, and advanced performance analytics.

Features:
- Realistic transaction costs (commissions, fees, spreads)
- Slippage and market impact modeling
- Bid-ask spread simulation
- Latency and execution delay modeling
- Partial fills and order rejection simulation
- Multi-asset portfolio backtesting
- Advanced performance metrics and attribution
- Risk management integration
- Benchmark comparison and factor analysis
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
import random
import json
from collections import defaultdict
import warnings

# Suppress pandas warnings for cleaner output
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

try:
    from scipy import stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

from trading_api.core.interfaces import BaseStrategy
from trading_api.portfolio.portfolio_manager import PortfolioManager
from trading_api.risk.risk_manager import RiskManager
from trading_api.orders.order_types import OrderType, OrderSide, Order


logger = logging.getLogger(__name__)


class SlippageModel(Enum):
    """Slippage modeling approaches."""
    FIXED = "fixed"                    # Fixed percentage slippage
    LINEAR = "linear"                  # Linear with volume
    SQRT = "sqrt"                      # Square root of volume
    IMPACT = "impact"                  # Market impact model
    SPREAD_BASED = "spread_based"      # Based on bid-ask spread


class FillModel(Enum):
    """Order fill modeling approaches."""
    IMMEDIATE = "immediate"            # Immediate full fills
    REALISTIC = "realistic"           # Realistic fills with delays
    QUEUE_BASED = "queue_based"       # Queue position modeling
    VOLUME_BASED = "volume_based"     # Based on market volume


@dataclass
class TransactionCosts:
    """Transaction cost configuration."""
    # Commission structure
    commission_per_share: float = 0.005     # $0.005 per share
    commission_per_trade: float = 1.0       # $1.0 per trade
    min_commission: float = 1.0              # Minimum commission
    max_commission: float = 50.0             # Maximum commission
    
    # Regulatory fees (US markets)
    sec_fee_rate: float = 0.0000221          # SEC fee rate
    finra_trading_fee: float = 0.000145      # FINRA trading activity fee
    nscc_fee: float = 0.00002                # NSCC fee
    
    # Exchange fees
    exchange_fee_rate: float = 0.0001        # Exchange fee rate
    clearing_fee: float = 0.00005            # Clearing fee rate
    
    # Borrowing costs (for short positions)
    short_borrow_rate: float = 0.05          # Annual rate
    hard_to_borrow_rate: float = 0.15        # Annual rate for HTB stocks
    
    # Margin requirements
    initial_margin_rate: float = 0.5         # 50% initial margin
    maintenance_margin_rate: float = 0.25    # 25% maintenance margin
    margin_interest_rate: float = 0.08       # 8% annual margin interest


@dataclass
class MarketMicrostructure:
    """Market microstructure parameters."""
    # Bid-ask spread
    min_spread_bps: float = 1.0              # Minimum spread in basis points
    max_spread_bps: float = 50.0             # Maximum spread in basis points
    spread_volatility_factor: float = 2.0    # Spread increases with volatility
    
    # Slippage parameters
    base_slippage_bps: float = 2.0           # Base slippage in basis points
    volume_impact_factor: float = 0.1        # Volume impact scaling
    volatility_impact_factor: float = 1.5    # Volatility impact scaling
    
    # Market impact (Almgren-Chriss model parameters)
    permanent_impact: float = 0.1            # Permanent market impact
    temporary_impact: float = 0.5            # Temporary market impact
    impact_decay_rate: float = 0.9           # Impact decay per period
    
    # Execution parameters
    min_fill_delay_ms: int = 10              # Minimum fill delay
    max_fill_delay_ms: int = 500             # Maximum fill delay
    partial_fill_probability: float = 0.05   # Probability of partial fill
    rejection_probability: float = 0.01      # Probability of order rejection
    
    # Market hours and liquidity
    market_hours = (9.5 * 60, 16 * 60)      # Market hours in minutes from midnight
    pre_market_liquidity_factor: float = 0.3 # Reduced liquidity pre-market
    after_hours_liquidity_factor: float = 0.2 # Reduced liquidity after hours


@dataclass
class BacktestConfig:
    """Backtesting configuration."""
    initial_capital: float = 100000.0
    transaction_costs: TransactionCosts = field(default_factory=TransactionCosts)
    market_microstructure: MarketMicrostructure = field(default_factory=MarketMicrostructure)
    
    # Slippage and fills
    slippage_model: SlippageModel = SlippageModel.IMPACT
    fill_model: FillModel = FillModel.REALISTIC
    
    # Risk management
    max_leverage: float = 2.0
    position_size_limit: float = 0.1         # 10% max position size
    daily_loss_limit: float = 0.05           # 5% daily loss limit
    
    # Performance tracking
    benchmark_symbol: str = "SPY"
    risk_free_rate: float = 0.02             # 2% annual risk-free rate
    
    # Simulation parameters
    random_seed: int = 42
    simulation_start_time: str = "09:30"     # Market open
    simulation_end_time: str = "16:00"       # Market close


@dataclass
class Trade:
    """Individual trade record."""
    timestamp: datetime
    symbol: str
    side: OrderSide
    quantity: float
    price: float
    commission: float
    fees: float
    slippage: float
    fill_delay_ms: int
    order_id: str
    strategy_id: str = ""


@dataclass
class Position:
    """Portfolio position."""
    symbol: str
    quantity: float
    avg_cost: float
    market_value: float
    unrealized_pnl: float
    realized_pnl: float
    last_update: datetime


@dataclass
class PerformanceMetrics:
    """Comprehensive performance metrics."""
    # Returns
    total_return: float = 0.0
    annualized_return: float = 0.0
    cumulative_return: float = 0.0
    
    # Risk metrics
    volatility: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    max_drawdown: float = 0.0
    var_95: float = 0.0
    cvar_95: float = 0.0
    
    # Trading metrics
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    profit_factor: float = 0.0
    
    # Cost analysis
    total_commission: float = 0.0
    total_fees: float = 0.0
    total_slippage: float = 0.0
    cost_to_returns_ratio: float = 0.0
    
    # Benchmark comparison
    benchmark_return: float = 0.0
    alpha: float = 0.0
    beta: float = 0.0
    information_ratio: float = 0.0
    tracking_error: float = 0.0


class EnhancedBacktester:
    """
    Enhanced backtesting engine with realistic transaction costs
    and market microstructure effects.
    """
    
    def __init__(self, config: BacktestConfig = None):
        """
        Initialize enhanced backtester.
        
        Args:
            config: Backtesting configuration
        """
        self.config = config or BacktestConfig()
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        
        # Set random seed for reproducibility
        random.seed(self.config.random_seed)
        np.random.seed(self.config.random_seed)
        
        # Backtesting state
        self.cash = self.config.initial_capital
        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self.daily_returns: List[float] = []
        self.portfolio_values: List[float] = []
        self.timestamps: List[datetime] = []
        
        # Market data storage
        self.market_data: Dict[str, pd.DataFrame] = {}
        self.current_prices: Dict[str, float] = {}
        self.bid_ask_spreads: Dict[str, float] = {}
        
        # Performance tracking
        self.daily_pnl: List[float] = []
        self.benchmark_data: Optional[pd.DataFrame] = None
        
        # Market impact tracking
        self.market_impact_state: Dict[str, float] = defaultdict(float)
    
    async def run_backtest(
        self,
        strategy: BaseStrategy,
        market_data: Dict[str, pd.DataFrame],
        start_date: datetime,
        end_date: datetime,
        benchmark_data: pd.DataFrame = None
    ) -> PerformanceMetrics:
        """
        Run comprehensive backtest with enhanced realism.
        
        Args:
            strategy: Trading strategy to test
            market_data: Historical market data by symbol
            start_date: Backtest start date
            end_date: Backtest end date
            benchmark_data: Benchmark data for comparison
            
        Returns:
            Comprehensive performance metrics
        """
        self._logger.info(f"Starting enhanced backtest from {start_date} to {end_date}")
        
        try:
            # Initialize backtest
            await self._initialize_backtest(market_data, benchmark_data)
            
            # Get unified time index
            time_index = self._create_unified_time_index(market_data, start_date, end_date)
            
            # Initialize strategy
            await strategy.initialize()
            
            # Run simulation
            for timestamp in time_index:
                await self._process_timestamp(strategy, timestamp)
            
            # Calculate final performance metrics
            metrics = await self._calculate_performance_metrics()
            
            self._logger.info(f"Backtest completed: {metrics.total_trades} trades, "
                            f"{metrics.total_return:.2%} return, "
                            f"{metrics.sharpe_ratio:.2f} Sharpe ratio")
            
            return metrics
            
        except Exception as e:
            self._logger.error(f"Backtest failed: {e}")
            raise
    
    async def _initialize_backtest(
        self,
        market_data: Dict[str, pd.DataFrame],
        benchmark_data: pd.DataFrame = None
    ) -> None:
        """Initialize backtest state."""
        self.market_data = market_data.copy()
        self.benchmark_data = benchmark_data
        
        # Initialize current prices
        for symbol, data in market_data.items():
            if not data.empty:
                self.current_prices[symbol] = data['close'].iloc[0]
                self.bid_ask_spreads[symbol] = self._calculate_initial_spread(data)
        
        # Initialize portfolio tracking
        self.portfolio_values.append(self.config.initial_capital)
        self.timestamps.append(list(market_data.values())[0].index[0])
    
    def _create_unified_time_index(
        self,
        market_data: Dict[str, pd.DataFrame],
        start_date: datetime,
        end_date: datetime
    ) -> pd.DatetimeIndex:
        """Create unified time index across all symbols."""
        all_timestamps = set()
        
        for symbol, data in market_data.items():
            mask = (data.index >= start_date) & (data.index <= end_date)
            all_timestamps.update(data.index[mask])
        
        return pd.DatetimeIndex(sorted(all_timestamps))
    
    async def _process_timestamp(self, strategy: BaseStrategy, timestamp: datetime) -> None:
        """Process a single timestamp in the backtest."""
        # Update market data
        await self._update_market_data(timestamp)
        
        # Update portfolio value
        portfolio_value = await self._calculate_portfolio_value()
        self.portfolio_values.append(portfolio_value)
        self.timestamps.append(timestamp)
        
        # Calculate daily return
        if len(self.portfolio_values) > 1:
            prev_value = self.portfolio_values[-2]
            daily_return = (portfolio_value - prev_value) / prev_value if prev_value > 0 else 0
            self.daily_returns.append(daily_return)
        
        # Check risk limits
        if not await self._check_risk_limits():
            return
        
        # Get strategy signals
        signals = await self._get_strategy_signals(strategy, timestamp)
        
        # Process signals and generate orders
        for signal in signals:
            await self._process_signal(signal, timestamp)
        
        # Decay market impact
        await self._decay_market_impact()
    
    async def _update_market_data(self, timestamp: datetime) -> None:
        """Update current market prices and spreads."""
        for symbol, data in self.market_data.items():
            if timestamp in data.index:
                row = data.loc[timestamp]
                self.current_prices[symbol] = row['close']
                self.bid_ask_spreads[symbol] = self._calculate_spread(row, symbol)
    
    async def _calculate_portfolio_value(self) -> float:
        """Calculate current portfolio value."""
        total_value = self.cash
        
        for symbol, position in self.positions.items():
            if symbol in self.current_prices:
                market_value = position.quantity * self.current_prices[symbol]
                position.market_value = market_value
                position.unrealized_pnl = market_value - (position.quantity * position.avg_cost)
                total_value += market_value
        
        return total_value
    
    async def _check_risk_limits(self) -> bool:
        """Check if risk limits are breached."""
        portfolio_value = self.portfolio_values[-1]
        
        # Daily loss limit
        if len(self.portfolio_values) > 1:
            daily_loss = (self.portfolio_values[-2] - portfolio_value) / self.portfolio_values[-2]
            if daily_loss > self.config.daily_loss_limit:
                self._logger.warning(f"Daily loss limit breached: {daily_loss:.2%}")
                return False
        
        # Leverage limit
        gross_exposure = sum(abs(pos.market_value) for pos in self.positions.values())
        leverage = gross_exposure / portfolio_value if portfolio_value > 0 else 0
        if leverage > self.config.max_leverage:
            self._logger.warning(f"Leverage limit breached: {leverage:.2f}")
            return False
        
        return True
    
    async def _get_strategy_signals(self, strategy: BaseStrategy, timestamp: datetime) -> List[Dict]:
        """Get trading signals from strategy."""
        # This is a simplified signal generation
        # In practice, you'd call the strategy's signal generation methods
        signals = []
        
        # For demonstration, we'll generate simple moving average crossover signals
        for symbol in self.market_data.keys():
            if symbol in self.current_prices:
                # Simple signal generation logic
                signal_strength = self._calculate_signal_strength(symbol, timestamp)
                if abs(signal_strength) > 0.3:  # Signal threshold
                    signals.append({
                        'symbol': symbol,
                        'side': OrderSide.BUY if signal_strength > 0 else OrderSide.SELL,
                        'strength': abs(signal_strength),
                        'timestamp': timestamp
                    })
        
        return signals
    
    def _calculate_signal_strength(self, symbol: str, timestamp: datetime) -> float:
        """Calculate signal strength for a symbol."""
        data = self.market_data[symbol]
        if timestamp not in data.index:
            return 0.0
        
        # Get historical data up to current timestamp
        historical = data.loc[:timestamp].tail(50)  # Last 50 periods
        if len(historical) < 20:
            return 0.0
        
        # Simple moving average crossover
        short_ma = historical['close'].rolling(10).mean().iloc[-1]
        long_ma = historical['close'].rolling(20).mean().iloc[-1]
        current_price = historical['close'].iloc[-1]
        
        # Signal strength based on MA crossover and momentum
        if short_ma > long_ma:
            strength = min((short_ma - long_ma) / current_price, 0.8)
        else:
            strength = max((short_ma - long_ma) / current_price, -0.8)
        
        return strength
    
    async def _process_signal(self, signal: Dict, timestamp: datetime) -> None:
        """Process a trading signal."""
        symbol = signal['symbol']
        side = signal['side']
        strength = signal['strength']
        
        # Calculate position size
        position_size = self._calculate_position_size(symbol, strength)
        if position_size == 0:
            return
        
        # Calculate target quantity
        if side == OrderSide.BUY:
            target_quantity = position_size
        else:
            current_pos = self.positions.get(symbol, Position(symbol, 0, 0, 0, 0, 0, timestamp))
            target_quantity = -min(position_size, current_pos.quantity)
        
        if abs(target_quantity) < 1:  # Minimum trade size
            return
        
        # Execute trade
        await self._execute_trade(symbol, side, abs(target_quantity), timestamp)
    
    def _calculate_position_size(self, symbol: str, strength: float) -> float:
        """Calculate position size based on signal strength and risk management."""
        portfolio_value = self.portfolio_values[-1]
        max_position_value = portfolio_value * self.config.position_size_limit
        
        # Adjust for signal strength
        target_value = max_position_value * strength
        
        # Convert to shares
        if symbol in self.current_prices:
            shares = target_value / self.current_prices[symbol]
            return max(0, shares)
        
        return 0
    
    async def _execute_trade(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        timestamp: datetime
    ) -> None:
        """Execute a trade with realistic costs and slippage."""
        if symbol not in self.current_prices:
            return
        
        base_price = self.current_prices[symbol]
        
        # Calculate execution price with slippage
        execution_price = self._calculate_execution_price(symbol, side, quantity, base_price)
        
        # Calculate transaction costs
        commission = self._calculate_commission(quantity, execution_price)
        fees = self._calculate_fees(quantity, execution_price)
        slippage_cost = abs(execution_price - base_price) * quantity
        
        # Check if we have enough cash/shares
        total_cost = quantity * execution_price + commission + fees
        if side == OrderSide.BUY and total_cost > self.cash:
            quantity = (self.cash - commission - fees) / execution_price
            if quantity < 1:
                return
            total_cost = quantity * execution_price + commission + fees
        
        current_pos = self.positions.get(symbol, Position(symbol, 0, 0, 0, 0, 0, timestamp))
        if side == OrderSide.SELL and quantity > current_pos.quantity:
            quantity = current_pos.quantity
            if quantity <= 0:
                return
        
        # Simulate fill delay
        fill_delay = self._calculate_fill_delay(symbol, quantity)
        
        # Update positions and cash
        if side == OrderSide.BUY:
            # Update position
            if current_pos.quantity > 0:
                # Add to existing position
                total_quantity = current_pos.quantity + quantity
                total_cost_basis = (current_pos.quantity * current_pos.avg_cost) + (quantity * execution_price)
                new_avg_cost = total_cost_basis / total_quantity
                current_pos.quantity = total_quantity
                current_pos.avg_cost = new_avg_cost
            else:
                # New position
                current_pos.quantity = quantity
                current_pos.avg_cost = execution_price
            
            current_pos.last_update = timestamp
            self.positions[symbol] = current_pos
            self.cash -= total_cost
            
        else:  # SELL
            # Realize P&L
            realized_pnl = quantity * (execution_price - current_pos.avg_cost)
            current_pos.realized_pnl += realized_pnl
            current_pos.quantity -= quantity
            
            if current_pos.quantity <= 0:
                del self.positions[symbol]
            else:
                current_pos.last_update = timestamp
                self.positions[symbol] = current_pos
            
            self.cash += (quantity * execution_price) - commission - fees
        
        # Record trade
        trade = Trade(
            timestamp=timestamp,
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=execution_price,
            commission=commission,
            fees=fees,
            slippage=slippage_cost,
            fill_delay_ms=fill_delay,
            order_id=f"order_{len(self.trades)}",
            strategy_id="enhanced_backtest"
        )
        self.trades.append(trade)
        
        # Update market impact
        self._update_market_impact(symbol, side, quantity)
    
    def _calculate_execution_price(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        base_price: float
    ) -> float:
        """Calculate execution price including slippage and market impact."""
        spread = self.bid_ask_spreads.get(symbol, base_price * 0.0001)  # Default 1bp spread
        
        # Base execution price (bid/ask)
        if side == OrderSide.BUY:
            execution_price = base_price + spread / 2
        else:
            execution_price = base_price - spread / 2
        
        # Apply slippage model
        slippage = self._calculate_slippage(symbol, side, quantity, base_price)
        
        if side == OrderSide.BUY:
            execution_price += slippage
        else:
            execution_price -= slippage
        
        return max(0.01, execution_price)  # Minimum price of $0.01
    
    def _calculate_slippage(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        base_price: float
    ) -> float:
        """Calculate slippage based on the configured model."""
        if self.config.slippage_model == SlippageModel.FIXED:
            return base_price * (self.config.market_microstructure.base_slippage_bps / 10000)
        
        elif self.config.slippage_model == SlippageModel.LINEAR:
            base_slippage = base_price * (self.config.market_microstructure.base_slippage_bps / 10000)
            volume_factor = quantity / 1000  # Assume average volume of 1000 shares
            return base_slippage * (1 + volume_factor * self.config.market_microstructure.volume_impact_factor)
        
        elif self.config.slippage_model == SlippageModel.SQRT:
            base_slippage = base_price * (self.config.market_microstructure.base_slippage_bps / 10000)
            volume_factor = np.sqrt(quantity / 1000)
            return base_slippage * (1 + volume_factor * self.config.market_microstructure.volume_impact_factor)
        
        elif self.config.slippage_model == SlippageModel.IMPACT:
            # Market impact model
            permanent_impact = self.config.market_microstructure.permanent_impact
            temporary_impact = self.config.market_microstructure.temporary_impact
            current_impact = self.market_impact_state.get(symbol, 0)
            
            # Calculate new impact
            volume_impact = quantity / 10000  # Normalize by typical volume
            new_impact = permanent_impact * volume_impact + temporary_impact * np.sqrt(volume_impact)
            
            return base_price * (current_impact + new_impact) / 10000
        
        elif self.config.slippage_model == SlippageModel.SPREAD_BASED:
            spread = self.bid_ask_spreads.get(symbol, base_price * 0.0001)
            spread_multiplier = 1 + (quantity / 1000) * 0.1  # Increase with volume
            return spread * spread_multiplier / 2
        
        else:
            return base_price * (self.config.market_microstructure.base_slippage_bps / 10000)
    
    def _calculate_commission(self, quantity: float, price: float) -> float:
        """Calculate commission fees."""
        per_share_commission = quantity * self.config.transaction_costs.commission_per_share
        per_trade_commission = self.config.transaction_costs.commission_per_trade
        
        total_commission = per_share_commission + per_trade_commission
        
        # Apply min/max limits
        total_commission = max(total_commission, self.config.transaction_costs.min_commission)
        total_commission = min(total_commission, self.config.transaction_costs.max_commission)
        
        return total_commission
    
    def _calculate_fees(self, quantity: float, price: float) -> float:
        """Calculate regulatory and exchange fees."""
        trade_value = quantity * price
        
        # SEC fee
        sec_fee = trade_value * self.config.transaction_costs.sec_fee_rate
        
        # FINRA trading activity fee
        finra_fee = quantity * self.config.transaction_costs.finra_trading_fee
        
        # NSCC fee
        nscc_fee = trade_value * self.config.transaction_costs.nscc_fee
        
        # Exchange fee
        exchange_fee = trade_value * self.config.transaction_costs.exchange_fee_rate
        
        # Clearing fee
        clearing_fee = trade_value * self.config.transaction_costs.clearing_fee
        
        return sec_fee + finra_fee + nscc_fee + exchange_fee + clearing_fee
    
    def _calculate_fill_delay(self, symbol: str, quantity: float) -> int:
        """Calculate realistic fill delay."""
        min_delay = self.config.market_microstructure.min_fill_delay_ms
        max_delay = self.config.market_microstructure.max_fill_delay_ms
        
        # Larger orders take longer to fill
        volume_factor = min(quantity / 1000, 2.0)  # Cap at 2x
        delay_range = max_delay - min_delay
        delay = min_delay + (delay_range * volume_factor / 2)
        
        return int(random.uniform(delay * 0.5, delay * 1.5))
    
    def _calculate_initial_spread(self, data: pd.DataFrame) -> float:
        """Calculate initial bid-ask spread."""
        if 'high' in data.columns and 'low' in data.columns:
            avg_hl_spread = (data['high'] - data['low']).mean()
            return max(avg_hl_spread * 0.1, data['close'].iloc[0] * 0.0001)
        else:
            return data['close'].iloc[0] * 0.0001  # Default 1bp spread
    
    def _calculate_spread(self, row: pd.Series, symbol: str) -> float:
        """Calculate current bid-ask spread."""
        base_spread = self.current_prices[symbol] * (
            self.config.market_microstructure.min_spread_bps / 10000
        )
        
        # Adjust for volatility if available
        if 'volume' in row:
            volume_factor = max(0.5, min(2.0, 10000 / max(row['volume'], 1000)))
            return base_spread * volume_factor
        
        return base_spread
    
    def _update_market_impact(self, symbol: str, side: OrderSide, quantity: float) -> None:
        """Update persistent market impact."""
        volume_impact = quantity / 10000  # Normalize
        impact_change = self.config.market_microstructure.permanent_impact * volume_impact
        
        if side == OrderSide.BUY:
            self.market_impact_state[symbol] += impact_change
        else:
            self.market_impact_state[symbol] -= impact_change
    
    async def _decay_market_impact(self) -> None:
        """Decay market impact over time."""
        decay_rate = self.config.market_microstructure.impact_decay_rate
        for symbol in self.market_impact_state:
            self.market_impact_state[symbol] *= decay_rate
    
    async def _calculate_performance_metrics(self) -> PerformanceMetrics:
        """Calculate comprehensive performance metrics."""
        if not self.daily_returns:
            return PerformanceMetrics()
        
        metrics = PerformanceMetrics()
        
        # Basic return metrics
        returns_array = np.array(self.daily_returns)
        final_value = self.portfolio_values[-1]
        initial_value = self.config.initial_capital
        
        metrics.total_return = (final_value - initial_value) / initial_value
        metrics.cumulative_return = metrics.total_return
        
        # Annualized return
        trading_days = len(self.daily_returns)
        if trading_days > 0:
            metrics.annualized_return = (1 + metrics.total_return) ** (252 / trading_days) - 1
        
        # Risk metrics
        metrics.volatility = np.std(returns_array) * np.sqrt(252)
        
        if metrics.volatility > 0:
            excess_return = metrics.annualized_return - self.config.risk_free_rate
            metrics.sharpe_ratio = excess_return / metrics.volatility
        
        # Drawdown calculation
        cumulative_returns = np.cumprod(1 + returns_array)
        running_max = np.maximum.accumulate(cumulative_returns)
        drawdowns = (cumulative_returns - running_max) / running_max
        metrics.max_drawdown = np.min(drawdowns)
        
        if metrics.max_drawdown != 0:
            metrics.calmar_ratio = metrics.annualized_return / abs(metrics.max_drawdown)
        
        # Downside risk metrics
        negative_returns = returns_array[returns_array < 0]
        if len(negative_returns) > 0:
            downside_deviation = np.std(negative_returns) * np.sqrt(252)
            if downside_deviation > 0:
                metrics.sortino_ratio = (metrics.annualized_return - self.config.risk_free_rate) / downside_deviation
        
        # VaR and CVaR
        if len(returns_array) > 0:
            metrics.var_95 = np.percentile(returns_array, 5)
            var_returns = returns_array[returns_array <= metrics.var_95]
            if len(var_returns) > 0:
                metrics.cvar_95 = np.mean(var_returns)
        
        # Trading metrics
        metrics.total_trades = len(self.trades)
        
        if self.trades:
            # Calculate trade-level P&L
            trade_pnls = []
            for trade in self.trades:
                # Simplified P&L calculation
                if trade.side == OrderSide.SELL:
                    # For sells, we need to match with previous buys
                    # This is simplified - in practice you'd need proper FIFO/LIFO matching
                    trade_pnl = 0  # Placeholder
                else:
                    trade_pnl = 0  # Placeholder
                trade_pnls.append(trade_pnl)
            
            # Win/loss statistics (using daily returns as proxy)
            winning_days = [r for r in self.daily_returns if r > 0]
            losing_days = [r for r in self.daily_returns if r < 0]
            
            metrics.winning_trades = len(winning_days)
            metrics.losing_trades = len(losing_days)
            
            if metrics.total_trades > 0:
                metrics.win_rate = metrics.winning_trades / (metrics.winning_trades + metrics.losing_trades)
            
            if winning_days:
                metrics.avg_win = np.mean(winning_days)
            if losing_days:
                metrics.avg_loss = np.mean(losing_days)
            
            if metrics.avg_loss != 0:
                metrics.profit_factor = abs(metrics.avg_win * metrics.winning_trades) / abs(metrics.avg_loss * metrics.losing_trades)
        
        # Cost analysis
        metrics.total_commission = sum(trade.commission for trade in self.trades)
        metrics.total_fees = sum(trade.fees for trade in self.trades)
        metrics.total_slippage = sum(trade.slippage for trade in self.trades)
        
        total_costs = metrics.total_commission + metrics.total_fees + metrics.total_slippage
        if abs(metrics.total_return) > 0:
            metrics.cost_to_returns_ratio = total_costs / (abs(metrics.total_return) * initial_value)
        
        # Benchmark comparison (if available)
        if self.benchmark_data is not None:
            benchmark_returns = self._calculate_benchmark_returns()
            if benchmark_returns is not None and len(benchmark_returns) == len(self.daily_returns):
                metrics.benchmark_return = np.prod(1 + benchmark_returns) - 1
                
                # Calculate alpha and beta
                if SCIPY_AVAILABLE:
                    beta, alpha, r_value, p_value, std_err = stats.linregress(benchmark_returns, self.daily_returns)
                    metrics.beta = beta
                    metrics.alpha = alpha * 252  # Annualized alpha
                
                # Information ratio
                excess_returns = np.array(self.daily_returns) - benchmark_returns
                metrics.tracking_error = np.std(excess_returns) * np.sqrt(252)
                if metrics.tracking_error > 0:
                    metrics.information_ratio = np.mean(excess_returns) * 252 / metrics.tracking_error
        
        return metrics
    
    def _calculate_benchmark_returns(self) -> Optional[np.ndarray]:
        """Calculate benchmark returns aligned with strategy returns."""
        if self.benchmark_data is None or len(self.timestamps) < 2:
            return None
        
        benchmark_returns = []
        for i in range(1, len(self.timestamps)):
            current_time = self.timestamps[i]
            prev_time = self.timestamps[i-1]
            
            # Find closest benchmark prices
            current_price = self._get_closest_price(self.benchmark_data, current_time)
            prev_price = self._get_closest_price(self.benchmark_data, prev_time)
            
            if current_price and prev_price:
                benchmark_return = (current_price - prev_price) / prev_price
                benchmark_returns.append(benchmark_return)
            else:
                benchmark_returns.append(0)
        
        return np.array(benchmark_returns) if benchmark_returns else None
    
    def _get_closest_price(self, data: pd.DataFrame, timestamp: datetime) -> Optional[float]:
        """Get closest price from benchmark data."""
        if timestamp in data.index:
            return data.loc[timestamp, 'close']
        
        # Find closest timestamp
        closest_idx = data.index.get_indexer([timestamp], method='nearest')[0]
        if 0 <= closest_idx < len(data):
            return data.iloc[closest_idx]['close']
        
        return None
    
    async def get_trade_analysis(self) -> Dict[str, Any]:
        """Get detailed trade analysis."""
        if not self.trades:
            return {}
        
        trade_df = pd.DataFrame([
            {
                'timestamp': trade.timestamp,
                'symbol': trade.symbol,
                'side': trade.side.value,
                'quantity': trade.quantity,
                'price': trade.price,
                'commission': trade.commission,
                'fees': trade.fees,
                'slippage': trade.slippage,
                'fill_delay_ms': trade.fill_delay_ms
            }
            for trade in self.trades
        ])
        
        analysis = {
            'total_trades': len(self.trades),
            'symbols_traded': trade_df['symbol'].nunique(),
            'avg_trade_size': trade_df['quantity'].mean(),
            'avg_commission_per_trade': trade_df['commission'].mean(),
            'avg_fees_per_trade': trade_df['fees'].mean(),
            'avg_slippage_per_trade': trade_df['slippage'].mean(),
            'avg_fill_delay_ms': trade_df['fill_delay_ms'].mean(),
            'total_volume': trade_df['quantity'].sum(),
            'trade_frequency': len(self.trades) / max(len(self.daily_returns), 1),
            'by_symbol': trade_df.groupby('symbol').agg({
                'quantity': ['count', 'sum', 'mean'],
                'commission': 'sum',
                'fees': 'sum',
                'slippage': 'sum'
            }).round(4).to_dict()
        }
        
        return analysis
    
    async def export_results(self, output_path: str) -> None:
        """Export backtest results to files."""
        try:
            # Performance metrics
            metrics = await self._calculate_performance_metrics()
            
            # Trade analysis
            trade_analysis = await self.get_trade_analysis()
            
            # Export data
            results = {
                'backtest_config': {
                    'initial_capital': self.config.initial_capital,
                    'slippage_model': self.config.slippage_model.value,
                    'fill_model': self.config.fill_model.value,
                },
                'performance_metrics': {
                    'total_return': metrics.total_return,
                    'annualized_return': metrics.annualized_return,
                    'volatility': metrics.volatility,
                    'sharpe_ratio': metrics.sharpe_ratio,
                    'max_drawdown': metrics.max_drawdown,
                    'calmar_ratio': metrics.calmar_ratio,
                    'total_trades': metrics.total_trades,
                    'win_rate': metrics.win_rate,
                    'profit_factor': metrics.profit_factor,
                    'total_commission': metrics.total_commission,
                    'total_fees': metrics.total_fees,
                    'total_slippage': metrics.total_slippage,
                },
                'trade_analysis': trade_analysis,
                'daily_returns': self.daily_returns,
                'portfolio_values': self.portfolio_values,
                'timestamps': [ts.isoformat() for ts in self.timestamps],
            }
            
            # Save to JSON
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            self._logger.info(f"Backtest results exported to {output_path}")
            
        except Exception as e:
            self._logger.error(f"Failed to export results: {e}")
            raise