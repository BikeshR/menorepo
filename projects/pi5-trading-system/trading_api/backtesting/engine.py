"""
Backtesting Engine for Pi5 Trading System.

Provides comprehensive backtesting capabilities for strategy validation and optimization.
Supports single and multi-strategy backtesting with realistic execution simulation,
performance analysis, and risk assessment.

Features:
- Historical market data replay
- Realistic execution simulation with slippage and commissions
- Portfolio-level backtesting with multiple strategies
- Comprehensive performance metrics and analysis
- Risk assessment and drawdown analysis
- Strategy optimization and parameter sweeping
- Benchmark comparison and relative performance
- Monte Carlo simulation for robust testing
"""

import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import asyncio
from concurrent.futures import ThreadPoolExecutor

from core.interfaces import BaseStrategy, Signal, TradingSignal
from core.market_data import MarketDataManager, TechnicalIndicators
from strategies.enhanced_base import EnhancedBaseStrategy
from strategies.manager import EnhancedStrategyManager, StrategyAllocation
from events.event_types import MarketDataEvent, OrderFilledEvent


logger = logging.getLogger(__name__)


class BacktestMode(Enum):
    """Backtesting execution modes."""
    SINGLE_STRATEGY = "single_strategy"
    MULTI_STRATEGY = "multi_strategy"
    PORTFOLIO_OPTIMIZATION = "portfolio_optimization"
    MONTE_CARLO = "monte_carlo"


class ExecutionModel(Enum):
    """Trade execution models for backtesting."""
    PERFECT = "perfect"  # Immediate execution at signal price
    REALISTIC = "realistic"  # With slippage and delays
    CONSERVATIVE = "conservative"  # Pessimistic execution assumptions


@dataclass
class BacktestConfig:
    """Configuration for backtesting runs."""
    start_date: datetime
    end_date: datetime
    initial_capital: float = 100000.0
    commission_rate: float = 0.001  # 0.1% commission
    slippage_bps: float = 2.0  # 2 basis points slippage
    execution_model: ExecutionModel = ExecutionModel.REALISTIC
    benchmark_symbol: Optional[str] = "SPY"
    enable_compound_returns: bool = True
    max_positions: int = 10
    position_sizing_method: str = "equal_weight"  # equal_weight, volatility_adjusted, risk_parity
    rebalance_frequency: str = "monthly"  # daily, weekly, monthly, quarterly


@dataclass
class Trade:
    """Represents a completed trade."""
    symbol: str
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    quantity: float
    strategy_name: str
    commission: float
    slippage: float
    pnl: float
    pnl_pct: float
    holding_period: timedelta
    trade_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BacktestResults:
    """Comprehensive backtesting results."""
    # Performance metrics
    total_return: float
    annualized_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    max_drawdown_duration: timedelta
    
    # Risk metrics
    var_95: float  # Value at Risk 95%
    cvar_95: float  # Conditional VaR 95%
    beta: float
    alpha: float
    information_ratio: float
    
    # Trade statistics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    average_win: float
    average_loss: float
    largest_win: float
    largest_loss: float
    profit_factor: float
    
    # Time-based analysis
    daily_returns: pd.Series
    cumulative_returns: pd.Series
    equity_curve: pd.Series
    drawdown_series: pd.Series
    monthly_returns: pd.DataFrame
    
    # Portfolio analysis
    portfolio_metrics: Dict[str, Any]
    strategy_attribution: Dict[str, float]
    correlation_matrix: pd.DataFrame
    
    # Trade details
    trades: List[Trade]
    positions_over_time: pd.DataFrame
    
    # Benchmarking
    benchmark_returns: Optional[pd.Series] = None
    relative_performance: Optional[pd.Series] = None
    
    # Configuration
    config: BacktestConfig
    start_date: datetime
    end_date: datetime


class BacktestingEngine:
    """
    Comprehensive backtesting engine for strategy validation.
    
    Supports single and multi-strategy backtesting with realistic execution
    simulation and comprehensive performance analysis.
    """
    
    def __init__(
        self,
        market_data_manager: MarketDataManager,
        enable_parallel_execution: bool = True,
        max_workers: int = 4
    ):
        """
        Initialize backtesting engine.
        
        Args:
            market_data_manager: MarketDataManager for historical data
            enable_parallel_execution: Enable parallel strategy execution
            max_workers: Maximum parallel workers
        """
        self.market_data_manager = market_data_manager
        self.enable_parallel_execution = enable_parallel_execution
        self.max_workers = max_workers
        
        # Execution state
        self._current_time: Optional[datetime] = None
        self._current_capital: float = 0.0
        self._positions: Dict[str, float] = {}  # symbol -> quantity
        self._cash: float = 0.0
        self._portfolio_value: float = 0.0
        self._trades: List[Trade] = []
        self._daily_values: List[Tuple[datetime, float]] = []
        
        # Performance tracking
        self._equity_curve: pd.Series = pd.Series(dtype=float)
        self._returns: pd.Series = pd.Series(dtype=float)
        self._drawdowns: pd.Series = pd.Series(dtype=float)
        
        # Multi-strategy support
        self._strategy_manager: Optional[EnhancedStrategyManager] = None
        self._strategy_results: Dict[str, BacktestResults] = {}
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def run_single_strategy_backtest(
        self,
        strategy: BaseStrategy,
        symbols: List[str],
        config: BacktestConfig,
        strategy_params: Optional[Dict[str, Any]] = None
    ) -> BacktestResults:
        """
        Run backtest for a single strategy.
        
        Args:
            strategy: Strategy to backtest
            symbols: List of symbols to trade
            config: Backtest configuration
            strategy_params: Optional strategy parameters override
            
        Returns:
            Comprehensive backtest results
        """
        self._logger.info(
            f"Starting single strategy backtest: {strategy.name} "
            f"from {config.start_date} to {config.end_date}"
        )
        
        # Initialize backtest state
        self._initialize_backtest(config)
        
        # Override strategy parameters if provided
        if strategy_params:
            for param, value in strategy_params.items():
                if hasattr(strategy, 'parameters'):
                    strategy.parameters[param] = value
        
        # Initialize strategy
        await strategy.initialize()
        
        # Get historical data for all symbols
        market_data = await self._load_historical_data(symbols, config)
        
        if market_data.empty:
            raise ValueError("No historical data available for backtesting")
        
        # Run simulation
        await self._simulate_trading(strategy, market_data, config)
        
        # Calculate results
        results = await self._calculate_results(config, strategy.name)
        
        self._logger.info(
            f"Backtest completed: Total return: {results.total_return:.2%}, "
            f"Sharpe: {results.sharpe_ratio:.2f}, Max DD: {results.max_drawdown:.2%}"
        )
        
        return results
    
    async def run_multi_strategy_backtest(
        self,
        strategies: List[Tuple[BaseStrategy, StrategyAllocation]],
        symbols: List[str],
        config: BacktestConfig
    ) -> BacktestResults:
        """
        Run backtest with multiple strategies.
        
        Args:
            strategies: List of (strategy, allocation) tuples
            symbols: List of symbols to trade
            config: Backtest configuration
            
        Returns:
            Comprehensive portfolio backtest results
        """
        self._logger.info(
            f"Starting multi-strategy backtest with {len(strategies)} strategies"
        )
        
        # Initialize backtest state
        self._initialize_backtest(config)
        
        # Create strategy manager for coordination
        from events.event_bus import EventBus
        from database.connection_manager import DatabaseManager
        
        # Mock event bus and database for backtesting
        event_bus = EventBus()
        db_manager = None  # Not needed for backtesting
        
        self._strategy_manager = EnhancedStrategyManager(
            event_bus=event_bus,
            db_manager=db_manager,
            total_capital=config.initial_capital,
            max_portfolio_risk=0.15,  # 15% portfolio risk limit
            enable_dynamic_allocation=True
        )
        
        # Register strategies
        strategy_ids = []
        for strategy, allocation in strategies:
            await strategy.initialize()
            strategy_id = self._strategy_manager.register_strategy(
                strategy=strategy,
                allocation=allocation,
                auto_start=False
            )
            strategy_ids.append(strategy_id)
        
        # Get historical data
        market_data = await self._load_historical_data(symbols, config)
        
        if market_data.empty:
            raise ValueError("No historical data available for backtesting")
        
        # Run coordinated simulation
        await self._simulate_multi_strategy_trading(market_data, config)
        
        # Calculate portfolio results
        results = await self._calculate_results(config, "Portfolio")
        
        # Calculate individual strategy attribution
        results.strategy_attribution = await self._calculate_strategy_attribution()
        
        self._logger.info(
            f"Multi-strategy backtest completed: Total return: {results.total_return:.2%}, "
            f"Sharpe: {results.sharpe_ratio:.2f}"
        )
        
        return results
    
    async def optimize_strategy_parameters(
        self,
        strategy_class: type,
        symbols: List[str],
        config: BacktestConfig,
        parameter_ranges: Dict[str, List[Any]],
        optimization_metric: str = "sharpe_ratio",
        max_iterations: int = 100
    ) -> Dict[str, Any]:
        """
        Optimize strategy parameters using grid search.
        
        Args:
            strategy_class: Strategy class to optimize
            symbols: Symbols to trade
            config: Backtest configuration
            parameter_ranges: Dict of parameter names to value ranges
            optimization_metric: Metric to optimize
            max_iterations: Maximum optimization iterations
            
        Returns:
            Best parameters and optimization results
        """
        self._logger.info(f"Starting parameter optimization for {strategy_class.__name__}")
        
        import itertools
        
        # Generate parameter combinations
        param_names = list(parameter_ranges.keys())
        param_values = list(parameter_ranges.values())
        combinations = list(itertools.product(*param_values))
        
        # Limit combinations if too many
        if len(combinations) > max_iterations:
            combinations = combinations[:max_iterations]
            self._logger.warning(
                f"Limiting optimization to {max_iterations} combinations out of {len(combinations)}"
            )
        
        best_score = float('-inf')
        best_params = None
        all_results = []
        
        # Test each combination
        for i, param_combo in enumerate(combinations):
            try:
                # Create parameter dict
                params = dict(zip(param_names, param_combo))
                
                # Create strategy instance
                strategy = strategy_class(**params)
                
                # Run backtest
                results = await self.run_single_strategy_backtest(
                    strategy=strategy,
                    symbols=symbols,
                    config=config,
                    strategy_params=params
                )
                
                # Get optimization score
                score = getattr(results, optimization_metric)
                
                all_results.append({
                    'parameters': params,
                    'score': score,
                    'results': results
                })
                
                # Update best if better
                if score > best_score:
                    best_score = score
                    best_params = params
                
                self._logger.debug(
                    f"Optimization {i+1}/{len(combinations)}: "
                    f"{optimization_metric}={score:.4f}, params={params}"
                )
                
            except Exception as e:
                self._logger.error(f"Error in optimization iteration {i+1}: {e}")
                continue
        
        optimization_results = {
            'best_parameters': best_params,
            'best_score': best_score,
            'all_results': all_results,
            'optimization_metric': optimization_metric,
            'total_iterations': len(combinations)
        }
        
        self._logger.info(
            f"Optimization completed. Best {optimization_metric}: {best_score:.4f} "
            f"with parameters: {best_params}"
        )
        
        return optimization_results
    
    async def monte_carlo_analysis(
        self,
        strategy: BaseStrategy,
        symbols: List[str],
        config: BacktestConfig,
        num_simulations: int = 1000,
        confidence_levels: List[float] = [0.05, 0.95]
    ) -> Dict[str, Any]:
        """
        Perform Monte Carlo analysis of strategy performance.
        
        Args:
            strategy: Strategy to analyze
            symbols: Symbols to trade
            config: Backtest configuration
            num_simulations: Number of Monte Carlo simulations
            confidence_levels: Confidence levels for analysis
            
        Returns:
            Monte Carlo analysis results
        """
        self._logger.info(f"Starting Monte Carlo analysis with {num_simulations} simulations")
        
        simulation_results = []
        
        for i in range(num_simulations):
            try:
                # Add randomness to market data (bootstrap or parameter variation)
                modified_config = self._create_random_config_variation(config)
                
                # Run backtest
                results = await self.run_single_strategy_backtest(
                    strategy=strategy,
                    symbols=symbols,
                    config=modified_config
                )
                
                simulation_results.append({
                    'total_return': results.total_return,
                    'sharpe_ratio': results.sharpe_ratio,
                    'max_drawdown': results.max_drawdown,
                    'win_rate': results.win_rate,
                    'profit_factor': results.profit_factor
                })
                
                if (i + 1) % 100 == 0:
                    self._logger.info(f"Completed {i + 1}/{num_simulations} simulations")
                
            except Exception as e:
                self._logger.error(f"Error in simulation {i+1}: {e}")
                continue
        
        # Analyze results
        mc_analysis = self._analyze_monte_carlo_results(simulation_results, confidence_levels)
        
        self._logger.info(f"Monte Carlo analysis completed with {len(simulation_results)} valid simulations")
        
        return mc_analysis
    
    def _initialize_backtest(self, config: BacktestConfig) -> None:
        """Initialize backtest state."""
        self._current_capital = config.initial_capital
        self._cash = config.initial_capital
        self._portfolio_value = config.initial_capital
        self._positions.clear()
        self._trades.clear()
        self._daily_values.clear()
        
        # Reset series
        self._equity_curve = pd.Series(dtype=float)
        self._returns = pd.Series(dtype=float)
        self._drawdowns = pd.Series(dtype=float)
    
    async def _load_historical_data(
        self,
        symbols: List[str],
        config: BacktestConfig
    ) -> pd.DataFrame:
        """Load historical market data for backtesting."""
        all_data = []
        
        for symbol in symbols:
            try:
                data = await self.market_data_manager.get_historical_data(
                    symbol=symbol,
                    start_date=config.start_date,
                    end_date=config.end_date,
                    interval='1min'
                )
                
                if not data.empty:
                    data['symbol'] = symbol
                    all_data.append(data)
                
            except Exception as e:
                self._logger.error(f"Error loading data for {symbol}: {e}")
                continue
        
        if all_data:
            combined_data = pd.concat(all_data, ignore_index=True)
            combined_data = combined_data.sort_values('timestamp')
            return combined_data
        
        return pd.DataFrame()
    
    async def _simulate_trading(
        self,
        strategy: BaseStrategy,
        market_data: pd.DataFrame,
        config: BacktestConfig
    ) -> None:
        """Simulate trading with a single strategy."""
        
        # Group data by timestamp for synchronous processing
        for timestamp, group in market_data.groupby('timestamp'):
            self._current_time = timestamp
            
            # Process market data for each symbol
            for _, row in group.iterrows():
                market_event = MarketDataEvent(
                    symbol=row['symbol'],
                    timestamp=timestamp,
                    open_price=row['open'],
                    high_price=row['high'],
                    low_price=row['low'],
                    close_price=row['close'],
                    volume=row['volume']
                )
                
                # Get signals from strategy
                try:
                    signals = await strategy.on_market_data(market_event)
                    
                    # Execute signals
                    for signal in signals:
                        await self._execute_signal(signal, row, config)
                        
                except Exception as e:
                    self._logger.error(f"Error processing market data for {row['symbol']}: {e}")
                    continue
            
            # Update portfolio value
            self._update_portfolio_value(group, timestamp)
    
    async def _simulate_multi_strategy_trading(
        self,
        market_data: pd.DataFrame,
        config: BacktestConfig
    ) -> None:
        """Simulate trading with multiple coordinated strategies."""
        
        for timestamp, group in market_data.groupby('timestamp'):
            self._current_time = timestamp
            
            # Collect signals from all strategies
            all_signals = []
            
            for _, row in group.iterrows():
                market_event = MarketDataEvent(
                    symbol=row['symbol'],
                    timestamp=timestamp,
                    open_price=row['open'],
                    high_price=row['high'],
                    low_price=row['low'],
                    close_price=row['close'],
                    volume=row['volume']
                )
                
                # Process through strategy manager
                try:
                    # Simulate strategy manager processing
                    for strategy_id in self._strategy_manager._running_strategies:
                        strategy = self._strategy_manager._strategies[strategy_id]
                        
                        signals = await strategy.on_market_data(market_event)
                        all_signals.extend(signals)
                
                except Exception as e:
                    self._logger.error(f"Error in multi-strategy processing: {e}")
                    continue
            
            # Aggregate signals using strategy manager
            symbol_signals = {}
            for signal in all_signals:
                if signal.symbol not in symbol_signals:
                    symbol_signals[signal.symbol] = []
                symbol_signals[signal.symbol].append(signal)
            
            # Process aggregated signals
            for symbol, signals in symbol_signals.items():
                try:
                    # Simulate signal aggregation
                    if len(signals) == 1:
                        final_signal = signals[0]
                    else:
                        # Use highest confidence for simplicity
                        final_signal = max(signals, key=lambda s: s.confidence)
                    
                    # Find corresponding market data
                    symbol_row = group[group['symbol'] == symbol].iloc[0]
                    await self._execute_signal(final_signal, symbol_row, config)
                    
                except Exception as e:
                    self._logger.error(f"Error aggregating signals for {symbol}: {e}")
                    continue
            
            # Update portfolio value
            self._update_portfolio_value(group, timestamp)
    
    async def _execute_signal(
        self,
        signal: Signal,
        market_row: pd.Series,
        config: BacktestConfig
    ) -> None:
        """Execute a trading signal with realistic execution simulation."""
        
        symbol = signal.symbol
        current_price = market_row['close']
        
        # Calculate execution price with slippage
        execution_price = self._apply_slippage(
            signal.signal_type, current_price, config.slippage_bps
        )
        
        # Calculate position size
        position_size = signal.metadata.get('position_size', 0.1)
        
        # Determine trade quantity
        if signal.signal_type == TradingSignal.BUY:
            # Calculate maximum shares we can buy
            available_cash = self._cash * position_size
            commission = available_cash * config.commission_rate
            net_cash = available_cash - commission
            quantity = int(net_cash / execution_price)
            
            if quantity > 0:
                trade_value = quantity * execution_price
                total_cost = trade_value + commission
                
                if total_cost <= self._cash:
                    # Execute buy
                    self._positions[symbol] = self._positions.get(symbol, 0) + quantity
                    self._cash -= total_cost
                    
                    # Record trade
                    trade = Trade(
                        symbol=symbol,
                        entry_time=self._current_time,
                        exit_time=self._current_time,
                        entry_price=execution_price,
                        exit_price=execution_price,
                        quantity=quantity,
                        strategy_name=signal.strategy_name,
                        commission=commission,
                        slippage=abs(execution_price - current_price) * quantity,
                        pnl=0.0,  # Will be calculated on exit
                        pnl_pct=0.0,
                        holding_period=timedelta(),
                        trade_id=f"{symbol}_{self._current_time.isoformat()}_{len(self._trades)}",
                        metadata=signal.metadata
                    )
                    self._trades.append(trade)
        
        elif signal.signal_type == TradingSignal.SELL:
            # Sell existing position
            current_position = self._positions.get(symbol, 0)
            
            if current_position > 0:
                # Determine quantity to sell
                sell_quantity = min(current_position, int(current_position * position_size))
                
                if sell_quantity > 0:
                    trade_value = sell_quantity * execution_price
                    commission = trade_value * config.commission_rate
                    net_proceeds = trade_value - commission
                    
                    # Execute sell
                    self._positions[symbol] -= sell_quantity
                    if self._positions[symbol] == 0:
                        del self._positions[symbol]
                    
                    self._cash += net_proceeds
                    
                    # Find matching buy trade and calculate P&L
                    # (Simplified: use FIFO matching)
                    entry_trade = self._find_entry_trade(symbol)
                    if entry_trade:
                        pnl = (execution_price - entry_trade.entry_price) * sell_quantity - commission
                        pnl_pct = ((execution_price / entry_trade.entry_price) - 1) * 100
                        holding_period = self._current_time - entry_trade.entry_time
                        
                        # Update the entry trade with exit information
                        entry_trade.exit_time = self._current_time
                        entry_trade.exit_price = execution_price
                        entry_trade.pnl = pnl
                        entry_trade.pnl_pct = pnl_pct
                        entry_trade.holding_period = holding_period
    
    def _apply_slippage(
        self,
        signal_type: TradingSignal,
        price: float,
        slippage_bps: float
    ) -> float:
        """Apply slippage to execution price."""
        slippage_factor = slippage_bps / 10000  # Convert basis points to decimal
        
        if signal_type == TradingSignal.BUY:
            # Buy at higher price (unfavorable slippage)
            return price * (1 + slippage_factor)
        else:
            # Sell at lower price (unfavorable slippage)
            return price * (1 - slippage_factor)
    
    def _find_entry_trade(self, symbol: str) -> Optional[Trade]:
        """Find the most recent entry trade for a symbol (FIFO)."""
        for trade in reversed(self._trades):
            if (trade.symbol == symbol and 
                trade.pnl == 0.0 and  # Not yet closed
                trade.quantity > 0):
                return trade
        return None
    
    def _update_portfolio_value(
        self,
        market_group: pd.DataFrame,
        timestamp: datetime
    ) -> None:
        """Update portfolio value based on current market prices."""
        
        position_value = 0.0
        
        for symbol, quantity in self._positions.items():
            # Find current price for this symbol
            symbol_data = market_group[market_group['symbol'] == symbol]
            if not symbol_data.empty:
                current_price = symbol_data.iloc[0]['close']
                position_value += quantity * current_price
        
        self._portfolio_value = self._cash + position_value
        self._daily_values.append((timestamp, self._portfolio_value))
    
    async def _calculate_results(
        self,
        config: BacktestConfig,
        strategy_name: str
    ) -> BacktestResults:
        """Calculate comprehensive backtest results."""
        
        # Convert daily values to series
        if self._daily_values:
            dates, values = zip(*self._daily_values)
            equity_curve = pd.Series(values, index=dates)
        else:
            equity_curve = pd.Series(dtype=float)
        
        # Calculate returns
        returns = equity_curve.pct_change().dropna()
        
        # Calculate performance metrics
        total_return = (self._portfolio_value / config.initial_capital) - 1
        
        if len(returns) > 0:
            annualized_return = (1 + returns.mean()) ** 252 - 1
            volatility = returns.std() * np.sqrt(252)
            sharpe_ratio = annualized_return / volatility if volatility > 0 else 0
        else:
            annualized_return = volatility = sharpe_ratio = 0
        
        # Calculate drawdown
        peak = equity_curve.expanding().max()
        drawdown = (equity_curve - peak) / peak
        max_drawdown = abs(drawdown.min())
        
        # Calculate trade statistics
        completed_trades = [t for t in self._trades if t.pnl != 0]
        
        if completed_trades:
            winning_trades = len([t for t in completed_trades if t.pnl > 0])
            losing_trades = len([t for t in completed_trades if t.pnl < 0])
            win_rate = winning_trades / len(completed_trades)
            
            wins = [t.pnl for t in completed_trades if t.pnl > 0]
            losses = [t.pnl for t in completed_trades if t.pnl < 0]
            
            average_win = np.mean(wins) if wins else 0
            average_loss = np.mean(losses) if losses else 0
            largest_win = max(wins) if wins else 0
            largest_loss = min(losses) if losses else 0
            
            gross_profit = sum(wins)
            gross_loss = abs(sum(losses))
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        else:
            winning_trades = losing_trades = 0
            win_rate = average_win = average_loss = 0
            largest_win = largest_loss = profit_factor = 0
        
        # Create results object
        results = BacktestResults(
            total_return=total_return,
            annualized_return=annualized_return,
            volatility=volatility,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_drawdown,
            max_drawdown_duration=timedelta(),  # TODO: Calculate properly
            
            var_95=0.0,  # TODO: Calculate VaR
            cvar_95=0.0,  # TODO: Calculate CVaR
            beta=0.0,  # TODO: Calculate vs benchmark
            alpha=0.0,  # TODO: Calculate vs benchmark
            information_ratio=0.0,  # TODO: Calculate
            
            total_trades=len(completed_trades),
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            average_win=average_win,
            average_loss=average_loss,
            largest_win=largest_win,
            largest_loss=largest_loss,
            profit_factor=profit_factor,
            
            daily_returns=returns,
            cumulative_returns=(1 + returns).cumprod() - 1,
            equity_curve=equity_curve,
            drawdown_series=drawdown,
            monthly_returns=pd.DataFrame(),  # TODO: Calculate
            
            portfolio_metrics={},
            strategy_attribution={strategy_name: 1.0},
            correlation_matrix=pd.DataFrame(),
            
            trades=completed_trades,
            positions_over_time=pd.DataFrame(),  # TODO: Track positions
            
            config=config,
            start_date=config.start_date,
            end_date=config.end_date
        )
        
        return results
    
    async def _calculate_strategy_attribution(self) -> Dict[str, float]:
        """Calculate individual strategy performance attribution."""
        # Simplified attribution - would need more sophisticated tracking
        attribution = {}
        
        if self._strategy_manager:
            for strategy_id, strategy in self._strategy_manager._strategies.items():
                # Calculate contribution based on trades
                strategy_trades = [t for t in self._trades if t.strategy_name == strategy.name]
                if strategy_trades:
                    total_pnl = sum(t.pnl for t in strategy_trades)
                    attribution[strategy.name] = total_pnl / self._portfolio_value if self._portfolio_value > 0 else 0
                else:
                    attribution[strategy.name] = 0.0
        
        return attribution
    
    def _create_random_config_variation(self, config: BacktestConfig) -> BacktestConfig:
        """Create random variation of config for Monte Carlo analysis."""
        # Create copy with slight variations
        import copy
        new_config = copy.deepcopy(config)
        
        # Add randomness to slippage and commission
        new_config.slippage_bps *= np.random.uniform(0.8, 1.2)
        new_config.commission_rate *= np.random.uniform(0.9, 1.1)
        
        return new_config
    
    def _analyze_monte_carlo_results(
        self,
        results: List[Dict[str, Any]],
        confidence_levels: List[float]
    ) -> Dict[str, Any]:
        """Analyze Monte Carlo simulation results."""
        
        if not results:
            return {}
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame(results)
        
        analysis = {
            'num_simulations': len(results),
            'statistics': {},
            'confidence_intervals': {},
            'percentiles': {}
        }
        
        # Calculate statistics for each metric
        for metric in df.columns:
            values = df[metric].dropna()
            
            analysis['statistics'][metric] = {
                'mean': values.mean(),
                'std': values.std(),
                'min': values.min(),
                'max': values.max(),
                'median': values.median()
            }
            
            # Calculate confidence intervals
            analysis['confidence_intervals'][metric] = {}
            for conf_level in confidence_levels:
                lower = values.quantile((1 - conf_level) / 2)
                upper = values.quantile((1 + conf_level) / 2)
                analysis['confidence_intervals'][metric][f'{conf_level:.0%}'] = (lower, upper)
            
            # Calculate percentiles
            percentiles = [5, 10, 25, 50, 75, 90, 95]
            analysis['percentiles'][metric] = {
                f'p{p}': values.quantile(p/100) for p in percentiles
            }
        
        return analysis
    
    def generate_report(self, results: BacktestResults, output_path: Optional[str] = None) -> str:
        """Generate comprehensive backtest report."""
        
        report = f"""
# Backtesting Report

## Strategy Performance Summary
- **Strategy**: {list(results.strategy_attribution.keys())[0] if results.strategy_attribution else 'Unknown'}
- **Period**: {results.start_date.strftime('%Y-%m-%d')} to {results.end_date.strftime('%Y-%m-%d')}
- **Initial Capital**: ${results.config.initial_capital:,.2f}
- **Final Portfolio Value**: ${results.equity_curve.iloc[-1]:,.2f if not results.equity_curve.empty else 0}

## Performance Metrics
- **Total Return**: {results.total_return:.2%}
- **Annualized Return**: {results.annualized_return:.2%}
- **Volatility**: {results.volatility:.2%}
- **Sharpe Ratio**: {results.sharpe_ratio:.2f}
- **Maximum Drawdown**: {results.max_drawdown:.2%}

## Trade Statistics
- **Total Trades**: {results.total_trades}
- **Winning Trades**: {results.winning_trades}
- **Losing Trades**: {results.losing_trades}
- **Win Rate**: {results.win_rate:.2%}
- **Average Win**: ${results.average_win:.2f}
- **Average Loss**: ${results.average_loss:.2f}
- **Profit Factor**: {results.profit_factor:.2f}

## Risk Metrics
- **Maximum Drawdown**: {results.max_drawdown:.2%}
- **Volatility**: {results.volatility:.2%}

## Configuration
- **Commission Rate**: {results.config.commission_rate:.3%}
- **Slippage**: {results.config.slippage_bps:.1f} bps
- **Execution Model**: {results.config.execution_model.value}
"""
        
        if output_path:
            with open(output_path, 'w') as f:
                f.write(report)
            self._logger.info(f"Report saved to {output_path}")
        
        return report