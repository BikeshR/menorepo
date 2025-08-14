"""
Walk-Forward Analysis Framework for Pi5 Trading System.

Advanced strategy optimization and validation using walk-forward analysis.
This technique provides robust strategy validation by using rolling windows
of optimization and out-of-sample testing to prevent overfitting.

Features:
- Rolling window parameter optimization
- Out-of-sample validation
- Performance degradation detection
- Strategy robustness measurement
- Parameter stability analysis
- Multi-objective optimization support
- Detailed performance reporting
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
import itertools
import json
from pathlib import Path

from core.interfaces import BaseStrategy
from strategies.base_strategy import StrategyResult
from market_data.market_data_manager import MarketDataManager
from optimization.parameter_optimizer import ParameterOptimizer, OptimizationResult
from portfolio.portfolio_manager import PortfolioManager


logger = logging.getLogger(__name__)


class WalkForwardMode(Enum):
    """Walk-forward analysis modes."""
    FIXED_WINDOW = "fixed_window"          # Fixed optimization/test windows
    EXPANDING_WINDOW = "expanding_window"  # Expanding optimization window
    ROLLING_WINDOW = "rolling_window"      # Rolling optimization window


@dataclass
class WalkForwardConfig:
    """Walk-forward analysis configuration."""
    optimization_period_days: int = 252    # 1 year optimization period
    test_period_days: int = 63             # 3 months test period
    step_size_days: int = 21               # 3 weeks step size
    mode: WalkForwardMode = WalkForwardMode.ROLLING_WINDOW
    min_trades_required: int = 10          # Minimum trades for valid test
    reoptimize_threshold: float = 0.1      # 10% performance degradation threshold
    
    # Optimization settings
    max_iterations: int = 100
    convergence_threshold: float = 0.001
    objective_function: str = "sharpe_ratio"  # sharpe_ratio, calmar_ratio, sortino_ratio
    
    # Validation settings
    significance_threshold: float = 0.05   # Statistical significance threshold
    stability_threshold: float = 0.3      # Parameter stability threshold


@dataclass
class WalkForwardPeriod:
    """Single walk-forward analysis period."""
    period_id: int
    optimization_start: datetime
    optimization_end: datetime
    test_start: datetime
    test_end: datetime
    optimal_parameters: Dict[str, Any] = field(default_factory=dict)
    optimization_performance: Dict[str, float] = field(default_factory=dict)
    test_performance: Dict[str, float] = field(default_factory=dict)
    trade_count: int = 0
    is_valid: bool = False


@dataclass
class WalkForwardResult:
    """Complete walk-forward analysis results."""
    strategy_name: str
    symbol: str
    config: WalkForwardConfig
    periods: List[WalkForwardPeriod] = field(default_factory=list)
    
    # Aggregate performance metrics
    total_return: float = 0.0
    annualized_return: float = 0.0
    volatility: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    calmar_ratio: float = 0.0
    sortino_ratio: float = 0.0
    
    # Walk-forward specific metrics
    optimization_efficiency: float = 0.0    # In-sample vs out-of-sample performance
    parameter_stability: float = 0.0        # How stable are optimal parameters
    degradation_periods: int = 0            # Number of degraded performance periods
    reoptimization_frequency: float = 0.0   # How often reoptimization was needed
    
    # Statistical analysis
    performance_consistency: float = 0.0    # Consistency across periods
    statistical_significance: float = 0.0   # P-value of performance
    confidence_interval: Tuple[float, float] = (0.0, 0.0)
    
    analysis_start: datetime = None
    analysis_end: datetime = None
    total_periods: int = 0
    valid_periods: int = 0


class WalkForwardAnalyzer:
    """
    Advanced walk-forward analysis engine.
    
    Performs rolling parameter optimization and out-of-sample validation
    to develop robust, non-overfitted trading strategies.
    """
    
    def __init__(
        self,
        market_data_manager: MarketDataManager,
        parameter_optimizer: ParameterOptimizer,
        portfolio_manager: PortfolioManager,
    ):
        """
        Initialize walk-forward analyzer.
        
        Args:
            market_data_manager: Market data provider
            parameter_optimizer: Parameter optimization engine
            portfolio_manager: Portfolio management for performance calculation
        """
        self.market_data_manager = market_data_manager
        self.parameter_optimizer = parameter_optimizer
        self.portfolio_manager = portfolio_manager
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def run_walk_forward_analysis(
        self,
        strategy_class: type,
        symbol: str,
        start_date: datetime,
        end_date: datetime,
        parameter_ranges: Dict[str, Tuple[Any, Any, Any]],  # param_name -> (min, max, step)
        config: WalkForwardConfig,
        initial_capital: float = 100000.0
    ) -> WalkForwardResult:
        """
        Run complete walk-forward analysis.
        
        Args:
            strategy_class: Strategy class to analyze
            symbol: Symbol to analyze
            start_date: Analysis start date
            end_date: Analysis end date
            parameter_ranges: Parameter ranges for optimization
            config: Walk-forward configuration
            initial_capital: Initial capital for backtesting
            
        Returns:
            Complete walk-forward analysis results
        """
        self._logger.info(f"Starting walk-forward analysis for {strategy_class.__name__} on {symbol}")
        
        # Create result object
        result = WalkForwardResult(
            strategy_name=strategy_class.__name__,
            symbol=symbol,
            config=config,
            analysis_start=start_date,
            analysis_end=end_date
        )
        
        try:
            # Generate analysis periods
            periods = await self._generate_periods(start_date, end_date, config)
            result.total_periods = len(periods)
            
            self._logger.info(f"Generated {len(periods)} walk-forward periods")
            
            # Process each period
            for period in periods:
                await self._process_period(
                    period, strategy_class, symbol, parameter_ranges, 
                    config, initial_capital
                )
                
                if period.is_valid:
                    result.periods.append(period)
                    result.valid_periods += 1
                
                self._logger.info(
                    f"Completed period {period.period_id}: "
                    f"{'VALID' if period.is_valid else 'INVALID'} "
                    f"(trades: {period.trade_count})"
                )
            
            # Calculate aggregate metrics
            await self._calculate_aggregate_metrics(result)
            
            # Calculate walk-forward specific metrics
            await self._calculate_walk_forward_metrics(result)
            
            # Perform statistical analysis
            await self._perform_statistical_analysis(result)
            
            self._logger.info(
                f"Walk-forward analysis completed: {result.valid_periods}/{result.total_periods} "
                f"valid periods, Sharpe: {result.sharpe_ratio:.3f}, "
                f"Stability: {result.parameter_stability:.3f}"
            )
            
            return result
            
        except Exception as e:
            self._logger.error(f"Walk-forward analysis failed: {e}")
            raise
    
    async def _generate_periods(
        self,
        start_date: datetime,
        end_date: datetime,
        config: WalkForwardConfig
    ) -> List[WalkForwardPeriod]:
        """Generate walk-forward analysis periods."""
        periods = []
        period_id = 1
        
        current_date = start_date
        
        while current_date + timedelta(days=config.optimization_period_days + config.test_period_days) <= end_date:
            # Optimization period
            opt_start = current_date
            opt_end = current_date + timedelta(days=config.optimization_period_days)
            
            # Test period
            test_start = opt_end
            test_end = opt_end + timedelta(days=config.test_period_days)
            
            period = WalkForwardPeriod(
                period_id=period_id,
                optimization_start=opt_start,
                optimization_end=opt_end,
                test_start=test_start,
                test_end=test_end
            )
            
            periods.append(period)
            period_id += 1
            
            # Move to next period
            current_date += timedelta(days=config.step_size_days)
        
        return periods
    
    async def _process_period(
        self,
        period: WalkForwardPeriod,
        strategy_class: type,
        symbol: str,
        parameter_ranges: Dict[str, Tuple[Any, Any, Any]],
        config: WalkForwardConfig,
        initial_capital: float
    ) -> None:
        """Process a single walk-forward period."""
        try:
            # Step 1: Optimize parameters on optimization period
            self._logger.debug(f"Optimizing parameters for period {period.period_id}")
            
            optimization_result = await self.parameter_optimizer.optimize_parameters(
                strategy_class=strategy_class,
                symbol=symbol,
                start_date=period.optimization_start,
                end_date=period.optimization_end,
                parameter_ranges=parameter_ranges,
                initial_capital=initial_capital,
                objective_function=config.objective_function,
                max_iterations=config.max_iterations
            )
            
            if not optimization_result.success:
                self._logger.warning(f"Optimization failed for period {period.period_id}")
                return
            
            period.optimal_parameters = optimization_result.best_parameters
            period.optimization_performance = optimization_result.best_metrics
            
            # Step 2: Test optimal parameters on out-of-sample period
            self._logger.debug(f"Testing parameters for period {period.period_id}")
            
            test_result = await self._run_backtest(
                strategy_class=strategy_class,
                symbol=symbol,
                start_date=period.test_start,
                end_date=period.test_end,
                parameters=period.optimal_parameters,
                initial_capital=initial_capital
            )
            
            period.test_performance = test_result['metrics']
            period.trade_count = test_result['trade_count']
            
            # Validate period
            period.is_valid = (
                period.trade_count >= config.min_trades_required and
                not np.isnan(period.test_performance.get('total_return', np.nan))
            )
            
        except Exception as e:
            self._logger.error(f"Error processing period {period.period_id}: {e}")
            period.is_valid = False
    
    async def _run_backtest(
        self,
        strategy_class: type,
        symbol: str,
        start_date: datetime,
        end_date: datetime,
        parameters: Dict[str, Any],
        initial_capital: float
    ) -> Dict[str, Any]:
        """Run backtest with specific parameters."""
        try:
            # Get market data
            market_data = await self.market_data_manager.get_historical_data(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                frequency='1d'
            )
            
            if market_data.empty:
                return {'metrics': {}, 'trade_count': 0}
            
            # Initialize strategy with parameters
            strategy = strategy_class(**parameters)
            
            # Initialize portfolio tracking
            portfolio_value = initial_capital
            positions = {}
            trades = []
            daily_returns = []
            
            # Run strategy on each day
            for i, (date, row) in enumerate(market_data.iterrows()):
                if i == 0:
                    continue  # Skip first day (no previous data for signals)
                
                # Prepare market data for strategy
                historical_data = market_data.iloc[:i+1]
                
                # Get strategy signal
                if hasattr(strategy, 'generate_signal'):
                    signal = await strategy.generate_signal(symbol, historical_data)
                else:
                    # For simpler strategies, use on_market_data
                    signal = None
                    # This would need to be adapted based on strategy interface
                
                # Process signal and update portfolio
                if signal:
                    # Simplified trade execution
                    if signal.action == 'buy' and symbol not in positions:
                        shares = portfolio_value * signal.confidence * 0.95 / row['close']
                        positions[symbol] = shares
                        cost = shares * row['close']
                        portfolio_value -= cost
                        trades.append({
                            'date': date,
                            'action': 'buy',
                            'shares': shares,
                            'price': row['close'],
                            'value': cost
                        })
                    elif signal.action == 'sell' and symbol in positions:
                        shares = positions.pop(symbol, 0)
                        value = shares * row['close']
                        portfolio_value += value
                        trades.append({
                            'date': date,
                            'action': 'sell',
                            'shares': shares,
                            'price': row['close'],
                            'value': value
                        })
                
                # Calculate daily portfolio value
                current_value = portfolio_value
                for pos_symbol, shares in positions.items():
                    if pos_symbol == symbol:
                        current_value += shares * row['close']
                
                # Calculate daily return
                if i > 1:
                    prev_value = daily_returns[-1] if daily_returns else initial_capital
                    daily_return = (current_value - prev_value) / prev_value
                    daily_returns.append(daily_return)
            
            # Calculate performance metrics
            if not daily_returns:
                return {'metrics': {}, 'trade_count': 0}
            
            total_return = (current_value - initial_capital) / initial_capital
            annualized_return = (1 + total_return) ** (252 / len(daily_returns)) - 1
            volatility = np.std(daily_returns) * np.sqrt(252)
            sharpe_ratio = annualized_return / volatility if volatility > 0 else 0
            
            # Calculate drawdown
            cumulative_returns = np.cumprod(1 + np.array(daily_returns))
            running_max = np.maximum.accumulate(cumulative_returns)
            drawdowns = (cumulative_returns - running_max) / running_max
            max_drawdown = np.min(drawdowns)
            
            # Calmar ratio
            calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0
            
            # Sortino ratio
            negative_returns = [r for r in daily_returns if r < 0]
            downside_deviation = np.std(negative_returns) * np.sqrt(252) if negative_returns else 0
            sortino_ratio = annualized_return / downside_deviation if downside_deviation > 0 else 0
            
            metrics = {
                'total_return': total_return,
                'annualized_return': annualized_return,
                'volatility': volatility,
                'sharpe_ratio': sharpe_ratio,
                'max_drawdown': max_drawdown,
                'calmar_ratio': calmar_ratio,
                'sortino_ratio': sortino_ratio,
                'final_value': current_value
            }
            
            return {
                'metrics': metrics,
                'trade_count': len(trades),
                'trades': trades,
                'daily_returns': daily_returns
            }
            
        except Exception as e:
            self._logger.error(f"Backtest failed: {e}")
            return {'metrics': {}, 'trade_count': 0}
    
    async def _calculate_aggregate_metrics(self, result: WalkForwardResult) -> None:
        """Calculate aggregate performance metrics across all periods."""
        if not result.periods:
            return
        
        # Collect all test performance metrics
        returns = [p.test_performance.get('total_return', 0) for p in result.periods if p.is_valid]
        sharpe_ratios = [p.test_performance.get('sharpe_ratio', 0) for p in result.periods if p.is_valid]
        drawdowns = [p.test_performance.get('max_drawdown', 0) for p in result.periods if p.is_valid]
        
        if not returns:
            return
        
        # Calculate aggregate metrics
        result.total_return = np.prod(1 + np.array(returns)) - 1
        result.annualized_return = (1 + result.total_return) ** (252 / (len(returns) * result.config.test_period_days)) - 1
        result.volatility = np.std(returns) * np.sqrt(252 / result.config.test_period_days)
        result.sharpe_ratio = np.mean(sharpe_ratios)
        result.max_drawdown = np.min(drawdowns)
        result.calmar_ratio = result.annualized_return / abs(result.max_drawdown) if result.max_drawdown != 0 else 0
        
        # Calculate Sortino ratio
        negative_returns = [r for r in returns if r < 0]
        downside_deviation = np.std(negative_returns) if negative_returns else 0
        result.sortino_ratio = result.annualized_return / downside_deviation if downside_deviation > 0 else 0
    
    async def _calculate_walk_forward_metrics(self, result: WalkForwardResult) -> None:
        """Calculate walk-forward specific metrics."""
        if not result.periods:
            return
        
        valid_periods = [p for p in result.periods if p.is_valid]
        
        if not valid_periods:
            return
        
        # Optimization efficiency (in-sample vs out-of-sample performance)
        in_sample_returns = [p.optimization_performance.get('total_return', 0) for p in valid_periods]
        out_sample_returns = [p.test_performance.get('total_return', 0) for p in valid_periods]
        
        if in_sample_returns and out_sample_returns:
            result.optimization_efficiency = np.mean(out_sample_returns) / np.mean(in_sample_returns) if np.mean(in_sample_returns) != 0 else 0
        
        # Parameter stability
        result.parameter_stability = await self._calculate_parameter_stability(valid_periods)
        
        # Performance degradation analysis
        degradation_threshold = result.config.reoptimize_threshold
        degraded_periods = 0
        
        for i, period in enumerate(valid_periods[1:], 1):
            prev_return = valid_periods[i-1].test_performance.get('total_return', 0)
            curr_return = period.test_performance.get('total_return', 0)
            
            if prev_return > 0 and (prev_return - curr_return) / prev_return > degradation_threshold:
                degraded_periods += 1
        
        result.degradation_periods = degraded_periods
        result.reoptimization_frequency = degraded_periods / len(valid_periods) if valid_periods else 0
        
        # Performance consistency
        returns = [p.test_performance.get('total_return', 0) for p in valid_periods]
        if returns:
            result.performance_consistency = 1 - (np.std(returns) / np.mean(returns)) if np.mean(returns) != 0 else 0
    
    async def _calculate_parameter_stability(self, periods: List[WalkForwardPeriod]) -> float:
        """Calculate parameter stability across periods."""
        if len(periods) < 2:
            return 1.0
        
        # Get all parameter names
        param_names = set()
        for period in periods:
            param_names.update(period.optimal_parameters.keys())
        
        stabilities = []
        
        for param_name in param_names:
            values = []
            for period in periods:
                if param_name in period.optimal_parameters:
                    value = period.optimal_parameters[param_name]
                    if isinstance(value, (int, float)):
                        values.append(value)
            
            if len(values) > 1:
                # Calculate coefficient of variation (lower = more stable)
                cv = np.std(values) / np.mean(values) if np.mean(values) != 0 else float('inf')
                stability = max(0, 1 - cv)  # Convert to stability score (0-1)
                stabilities.append(stability)
        
        return np.mean(stabilities) if stabilities else 0.0
    
    async def _perform_statistical_analysis(self, result: WalkForwardResult) -> None:
        """Perform statistical analysis of results."""
        if not result.periods:
            return
        
        returns = [p.test_performance.get('total_return', 0) for p in result.periods if p.is_valid]
        
        if len(returns) < 2:
            return
        
        # T-test against zero return (null hypothesis: strategy has no edge)
        from scipy import stats
        
        t_stat, p_value = stats.ttest_1samp(returns, 0)
        result.statistical_significance = p_value
        
        # Confidence interval for mean return
        confidence_level = 0.95
        mean_return = np.mean(returns)
        std_error = np.std(returns) / np.sqrt(len(returns))
        margin_error = stats.t.ppf((1 + confidence_level) / 2, len(returns) - 1) * std_error
        
        result.confidence_interval = (
            mean_return - margin_error,
            mean_return + margin_error
        )
    
    async def save_results(self, result: WalkForwardResult, output_path: str) -> None:
        """Save walk-forward analysis results to file."""
        try:
            # Convert result to dictionary for JSON serialization
            result_dict = {
                'strategy_name': result.strategy_name,
                'symbol': result.symbol,
                'config': {
                    'optimization_period_days': result.config.optimization_period_days,
                    'test_period_days': result.config.test_period_days,
                    'step_size_days': result.config.step_size_days,
                    'mode': result.config.mode.value,
                    'objective_function': result.config.objective_function,
                },
                'aggregate_metrics': {
                    'total_return': result.total_return,
                    'annualized_return': result.annualized_return,
                    'volatility': result.volatility,
                    'sharpe_ratio': result.sharpe_ratio,
                    'max_drawdown': result.max_drawdown,
                    'calmar_ratio': result.calmar_ratio,
                    'sortino_ratio': result.sortino_ratio,
                },
                'walk_forward_metrics': {
                    'optimization_efficiency': result.optimization_efficiency,
                    'parameter_stability': result.parameter_stability,
                    'degradation_periods': result.degradation_periods,
                    'reoptimization_frequency': result.reoptimization_frequency,
                    'performance_consistency': result.performance_consistency,
                },
                'statistical_analysis': {
                    'statistical_significance': result.statistical_significance,
                    'confidence_interval': result.confidence_interval,
                },
                'summary': {
                    'total_periods': result.total_periods,
                    'valid_periods': result.valid_periods,
                    'analysis_start': result.analysis_start.isoformat() if result.analysis_start else None,
                    'analysis_end': result.analysis_end.isoformat() if result.analysis_end else None,
                },
                'periods': []
            }
            
            # Add period details
            for period in result.periods:
                period_dict = {
                    'period_id': period.period_id,
                    'optimization_start': period.optimization_start.isoformat(),
                    'optimization_end': period.optimization_end.isoformat(),
                    'test_start': period.test_start.isoformat(),
                    'test_end': period.test_end.isoformat(),
                    'optimal_parameters': period.optimal_parameters,
                    'optimization_performance': period.optimization_performance,
                    'test_performance': period.test_performance,
                    'trade_count': period.trade_count,
                    'is_valid': period.is_valid,
                }
                result_dict['periods'].append(period_dict)
            
            # Save to file
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                json.dump(result_dict, f, indent=2, default=str)
            
            self._logger.info(f"Walk-forward analysis results saved to {output_path}")
            
        except Exception as e:
            self._logger.error(f"Failed to save results: {e}")
            raise
    
    async def load_results(self, input_path: str) -> WalkForwardResult:
        """Load walk-forward analysis results from file."""
        try:
            with open(input_path, 'r') as f:
                data = json.load(f)
            
            # Reconstruct result object
            config = WalkForwardConfig(
                optimization_period_days=data['config']['optimization_period_days'],
                test_period_days=data['config']['test_period_days'],
                step_size_days=data['config']['step_size_days'],
                mode=WalkForwardMode(data['config']['mode']),
                objective_function=data['config']['objective_function'],
            )
            
            result = WalkForwardResult(
                strategy_name=data['strategy_name'],
                symbol=data['symbol'],
                config=config,
                total_return=data['aggregate_metrics']['total_return'],
                annualized_return=data['aggregate_metrics']['annualized_return'],
                volatility=data['aggregate_metrics']['volatility'],
                sharpe_ratio=data['aggregate_metrics']['sharpe_ratio'],
                max_drawdown=data['aggregate_metrics']['max_drawdown'],
                calmar_ratio=data['aggregate_metrics']['calmar_ratio'],
                sortino_ratio=data['aggregate_metrics']['sortino_ratio'],
                optimization_efficiency=data['walk_forward_metrics']['optimization_efficiency'],
                parameter_stability=data['walk_forward_metrics']['parameter_stability'],
                degradation_periods=data['walk_forward_metrics']['degradation_periods'],
                reoptimization_frequency=data['walk_forward_metrics']['reoptimization_frequency'],
                performance_consistency=data['walk_forward_metrics']['performance_consistency'],
                statistical_significance=data['statistical_analysis']['statistical_significance'],
                confidence_interval=tuple(data['statistical_analysis']['confidence_interval']),
                total_periods=data['summary']['total_periods'],
                valid_periods=data['summary']['valid_periods'],
                analysis_start=datetime.fromisoformat(data['summary']['analysis_start']) if data['summary']['analysis_start'] else None,
                analysis_end=datetime.fromisoformat(data['summary']['analysis_end']) if data['summary']['analysis_end'] else None,
            )
            
            # Reconstruct periods
            for period_data in data['periods']:
                period = WalkForwardPeriod(
                    period_id=period_data['period_id'],
                    optimization_start=datetime.fromisoformat(period_data['optimization_start']),
                    optimization_end=datetime.fromisoformat(period_data['optimization_end']),
                    test_start=datetime.fromisoformat(period_data['test_start']),
                    test_end=datetime.fromisoformat(period_data['test_end']),
                    optimal_parameters=period_data['optimal_parameters'],
                    optimization_performance=period_data['optimization_performance'],
                    test_performance=period_data['test_performance'],
                    trade_count=period_data['trade_count'],
                    is_valid=period_data['is_valid'],
                )
                result.periods.append(period)
            
            self._logger.info(f"Walk-forward analysis results loaded from {input_path}")
            return result
            
        except Exception as e:
            self._logger.error(f"Failed to load results: {e}")
            raise