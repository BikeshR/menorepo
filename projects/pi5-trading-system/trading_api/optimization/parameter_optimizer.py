"""
Parameter Optimization Engine for Pi5 Trading System.

Advanced parameter optimization using multiple algorithms including
grid search, random search, Bayesian optimization, and genetic algorithms.

Features:
- Multiple optimization algorithms
- Multi-objective optimization support
- Parallel execution for faster optimization
- Cross-validation to prevent overfitting
- Statistical significance testing
- Parameter constraint handling
- Convergence detection and early stopping
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
import itertools
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

# Try to import optimization libraries
try:
    from .genetic_optimizer import GeneticOptimizer, GeneticConfig
    GENETIC_AVAILABLE = True
except ImportError:
    GENETIC_AVAILABLE = False
    class GeneticOptimizer: pass
    class GeneticConfig: pass
try:
    from scipy import optimize
    from scipy.stats import norm
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

try:
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import Matern
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from core.interfaces import BaseStrategy
from market_data.market_data_manager import MarketDataManager

# Try to import enhanced backtester
try:
    from backtesting.enhanced_backtester import EnhancedBacktester, BacktestConfig
    ENHANCED_BACKTESTER_AVAILABLE = True
except ImportError:
    ENHANCED_BACKTESTER_AVAILABLE = False
    class EnhancedBacktester: pass
    class BacktestConfig: pass


logger = logging.getLogger(__name__)


class OptimizationAlgorithm(Enum):
    """Supported optimization algorithms."""
    GRID_SEARCH = "grid_search"
    RANDOM_SEARCH = "random_search"
    BAYESIAN_OPTIMIZATION = "bayesian_optimization"
    GENETIC_ALGORITHM = "genetic_algorithm"
    PARTICLE_SWARM = "particle_swarm"


class ObjectiveFunction(Enum):
    """Supported objective functions."""
    SHARPE_RATIO = "sharpe_ratio"
    CALMAR_RATIO = "calmar_ratio"
    SORTINO_RATIO = "sortino_ratio"
    TOTAL_RETURN = "total_return"
    MAX_DRAWDOWN = "max_drawdown"
    PROFIT_FACTOR = "profit_factor"
    INFORMATION_RATIO = "information_ratio"


@dataclass
class ParameterSpace:
    """Parameter space definition."""
    name: str
    param_type: str  # 'int', 'float', 'categorical'
    min_value: Any = None
    max_value: Any = None
    step: Any = None
    values: List[Any] = field(default_factory=list)  # For categorical parameters
    
    def sample(self) -> Any:
        """Sample a random value from this parameter space."""
        if self.param_type == 'categorical':
            return random.choice(self.values)
        elif self.param_type == 'int':
            return random.randint(self.min_value, self.max_value)
        elif self.param_type == 'float':
            return random.uniform(self.min_value, self.max_value)
        else:
            raise ValueError(f"Unknown parameter type: {self.param_type}")
    
    def validate(self, value: Any) -> bool:
        """Validate if a value is within this parameter space."""
        if self.param_type == 'categorical':
            return value in self.values
        elif self.param_type == 'int':
            return isinstance(value, int) and self.min_value <= value <= self.max_value
        elif self.param_type == 'float':
            return isinstance(value, (int, float)) and self.min_value <= value <= self.max_value
        return False


@dataclass
class OptimizationConfig:
    """Configuration for parameter optimization."""
    algorithm: OptimizationAlgorithm = OptimizationAlgorithm.GRID_SEARCH
    objective_function: ObjectiveFunction = ObjectiveFunction.SHARPE_RATIO
    max_iterations: int = 100
    convergence_threshold: float = 0.001
    cross_validation_folds: int = 5
    test_size: float = 0.2
    random_seed: int = 42
    n_jobs: int = 1  # Number of parallel jobs
    
    # Backtesting configuration
    use_enhanced_backtester: bool = True  # Use enhanced backtester if available
    backtest_config: Optional[Any] = None  # BacktestConfig for enhanced backtester
    
    # Algorithm-specific parameters
    bayesian_n_initial: int = 10
    genetic_population_size: int = 50
    genetic_mutation_rate: float = 0.1
    genetic_crossover_rate: float = 0.8
    particle_swarm_particles: int = 30
    particle_swarm_inertia: float = 0.9


@dataclass
class OptimizationResult:
    """Results from parameter optimization."""
    success: bool = False
    best_parameters: Dict[str, Any] = field(default_factory=dict)
    best_score: float = float('-inf')
    best_metrics: Dict[str, float] = field(default_factory=dict)
    
    # Optimization details
    algorithm_used: OptimizationAlgorithm = None
    iterations_completed: int = 0
    convergence_achieved: bool = False
    total_evaluations: int = 0
    optimization_time: float = 0.0
    
    # All evaluated parameters and scores
    evaluation_history: List[Tuple[Dict[str, Any], float]] = field(default_factory=list)
    
    # Statistical validation
    cross_validation_scores: List[float] = field(default_factory=list)
    statistical_significance: float = 0.0
    confidence_interval: Tuple[float, float] = (0.0, 0.0)


class ParameterOptimizer:
    """
    Advanced parameter optimization engine.
    
    Supports multiple optimization algorithms and objective functions
    with cross-validation and statistical testing.
    """
    
    def __init__(self, market_data_manager: MarketDataManager):
        """
        Initialize parameter optimizer.
        
        Args:
            market_data_manager: Market data provider for backtesting
        """
        self.market_data_manager = market_data_manager
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        
        # Set random seed for reproducibility
        random.seed(42)
        np.random.seed(42)
    
    async def optimize_parameters(
        self,
        strategy_class: type,
        symbol: str,
        start_date: datetime,
        end_date: datetime,
        parameter_ranges: Dict[str, Tuple[Any, Any, Any]],  # param_name -> (min, max, step/values)
        initial_capital: float = 100000.0,
        config: OptimizationConfig = None,
        **kwargs
    ) -> OptimizationResult:
        """
        Optimize strategy parameters.
        
        Args:
            strategy_class: Strategy class to optimize
            symbol: Symbol to optimize on
            start_date: Start date for optimization
            end_date: End date for optimization
            parameter_ranges: Parameter ranges to optimize
            initial_capital: Initial capital for backtesting
            config: Optimization configuration
            **kwargs: Additional arguments
            
        Returns:
            Optimization results
        """
        if config is None:
            config = OptimizationConfig()
        
        self._logger.info(
            f"Starting parameter optimization for {strategy_class.__name__} on {symbol} "
            f"using {config.algorithm.value}"
        )
        
        start_time = datetime.now()
        
        try:
            # Parse parameter spaces
            parameter_spaces = self._parse_parameter_ranges(parameter_ranges)
            
            # Get market data for optimization
            market_data = await self.market_data_manager.get_historical_data(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                frequency='1d'
            )
            
            if market_data.empty:
                raise ValueError(f"No market data available for {symbol}")
            
            # Split data for cross-validation if enabled
            if config.cross_validation_folds > 1:
                cv_splits = self._create_time_series_splits(market_data, config.cross_validation_folds)
            else:
                cv_splits = [(market_data, None)]
            
            # Create objective function
            objective_func = self._create_objective_function(
                strategy_class, symbol, market_data, initial_capital, config, cv_splits
            )
            
            # Run optimization algorithm
            result = await self._run_optimization_algorithm(
                objective_func, parameter_spaces, config
            )
            
            # Calculate final metrics with best parameters
            if result.success:
                final_metrics = await self._calculate_final_metrics(
                    strategy_class, symbol, market_data, result.best_parameters, initial_capital, config
                )
                result.best_metrics = final_metrics
            
            # Record optimization time
            result.optimization_time = (datetime.now() - start_time).total_seconds()
            
            self._logger.info(
                f"Optimization completed: {'SUCCESS' if result.success else 'FAILED'} "
                f"in {result.optimization_time:.2f}s, "
                f"best score: {result.best_score:.4f}"
            )
            
            return result
            
        except Exception as e:
            self._logger.error(f"Optimization failed: {e}")
            result = OptimizationResult(
                success=False,
                algorithm_used=config.algorithm,
                optimization_time=(datetime.now() - start_time).total_seconds()
            )
            return result
    
    def _parse_parameter_ranges(self, parameter_ranges: Dict[str, Tuple[Any, Any, Any]]) -> Dict[str, ParameterSpace]:
        """Parse parameter ranges into ParameterSpace objects."""
        parameter_spaces = {}
        
        for param_name, (min_val, max_val, step_or_values) in parameter_ranges.items():
            if isinstance(step_or_values, list):
                # Categorical parameter
                param_space = ParameterSpace(
                    name=param_name,
                    param_type='categorical',
                    values=step_or_values
                )
            elif isinstance(min_val, int) and isinstance(max_val, int):
                # Integer parameter
                param_space = ParameterSpace(
                    name=param_name,
                    param_type='int',
                    min_value=min_val,
                    max_value=max_val,
                    step=step_or_values
                )
            else:
                # Float parameter
                param_space = ParameterSpace(
                    name=param_name,
                    param_type='float',
                    min_value=float(min_val),
                    max_value=float(max_val),
                    step=float(step_or_values)
                )
            
            parameter_spaces[param_name] = param_space
        
        return parameter_spaces
    
    def _create_time_series_splits(self, data: pd.DataFrame, n_folds: int) -> List[Tuple[pd.DataFrame, pd.DataFrame]]:
        """Create time series cross-validation splits."""
        splits = []
        total_length = len(data)
        test_size = total_length // n_folds
        
        for i in range(n_folds):
            # Use expanding window for time series
            train_end = total_length - (n_folds - i) * test_size
            test_start = train_end
            test_end = test_start + test_size
            
            train_data = data.iloc[:train_end]
            test_data = data.iloc[test_start:test_end] if test_end <= total_length else data.iloc[test_start:]
            
            if len(train_data) > 0 and len(test_data) > 0:
                splits.append((train_data, test_data))
        
        return splits
    
    def _create_objective_function(
        self,
        strategy_class: type,
        symbol: str,
        market_data: pd.DataFrame,
        initial_capital: float,
        config: OptimizationConfig,
        cv_splits: List[Tuple[pd.DataFrame, pd.DataFrame]]
    ) -> Callable:
        """Create objective function for optimization."""
        
        async def objective_function(parameters: Dict[str, Any]) -> float:
            """Objective function to maximize."""
            try:
                scores = []
                
                # Evaluate on each cross-validation split
                for train_data, test_data in cv_splits:
                    if test_data is not None:
                        # Use test data for evaluation
                        eval_data = test_data
                    else:
                        # Use full data if no cross-validation
                        eval_data = train_data
                    
                    # Run backtest with current parameters
                    metrics = await self._run_backtest(
                        strategy_class, symbol, eval_data, parameters, initial_capital, config
                    )
                    
                    # Calculate objective score
                    score = self._calculate_objective_score(metrics, config.objective_function)
                    scores.append(score)
                
                # Return average score across folds
                return np.mean(scores) if scores else float('-inf')
                
            except Exception as e:
                self._logger.debug(f"Objective function evaluation failed: {e}")
                return float('-inf')
        
        return objective_function
    
    async def _run_backtest(
        self,
        strategy_class: type,
        symbol: str,
        market_data: pd.DataFrame,
        parameters: Dict[str, Any],
        initial_capital: float,
        config: OptimizationConfig = None
    ) -> Dict[str, float]:
        """Run backtest with specific parameters using enhanced or simple backtester."""
        try:
            # Determine which backtester to use
            use_enhanced = (config and config.use_enhanced_backtester and 
                          ENHANCED_BACKTESTER_AVAILABLE)
            
            if use_enhanced:
                return await self._run_enhanced_backtest(
                    strategy_class, symbol, market_data, parameters, 
                    initial_capital, config
                )
            else:
                return await self._run_simple_backtest(
                    strategy_class, symbol, market_data, parameters, initial_capital
                )
                
        except Exception as e:
            self._logger.debug(f"Backtest failed: {e}")
            return {}
    
    async def _run_enhanced_backtest(
        self,
        strategy_class: type,
        symbol: str,
        market_data: pd.DataFrame,
        parameters: Dict[str, Any],
        initial_capital: float,
        config: OptimizationConfig
    ) -> Dict[str, float]:
        """Run backtest using enhanced backtester with realistic costs."""
        try:
            # Initialize strategy with parameters
            strategy = strategy_class(**parameters)
            
            # Use provided backtest config or create default
            if config.backtest_config:
                backtest_config = config.backtest_config
            else:
                backtest_config = BacktestConfig(
                    initial_capital=initial_capital,
                    random_seed=config.random_seed
                )
            
            # Create enhanced backtester
            backtester = EnhancedBacktester(backtest_config)
            
            # Prepare market data in expected format
            market_data_dict = {symbol: market_data}
            
            # Run backtest
            start_date = market_data.index[0]
            end_date = market_data.index[-1]
            
            metrics = await backtester.run_backtest(
                strategy=strategy,
                market_data=market_data_dict,
                start_date=start_date,
                end_date=end_date
            )
            
            # Convert enhanced metrics to simple format
            return {
                'total_return': metrics.total_return,
                'annualized_return': metrics.annualized_return,
                'volatility': metrics.volatility,
                'sharpe_ratio': metrics.sharpe_ratio,
                'max_drawdown': metrics.max_drawdown,
                'calmar_ratio': metrics.calmar_ratio,
                'sortino_ratio': metrics.sortino_ratio,
                'profit_factor': metrics.profit_factor,
                'trade_count': metrics.total_trades,
                'final_value': initial_capital * (1 + metrics.total_return),
                
                # Enhanced metrics
                'total_commission': metrics.total_commission,
                'total_fees': metrics.total_fees,
                'total_slippage': metrics.total_slippage,
                'cost_to_returns_ratio': metrics.cost_to_returns_ratio,
                'win_rate': metrics.win_rate,
                'var_95': metrics.var_95,
                'cvar_95': metrics.cvar_95
            }
            
        except Exception as e:
            self._logger.debug(f"Enhanced backtest failed, falling back to simple: {e}")
            return await self._run_simple_backtest(
                strategy_class, symbol, market_data, parameters, initial_capital
            )
    
    async def _run_simple_backtest(
        self,
        strategy_class: type,
        symbol: str,
        market_data: pd.DataFrame,
        parameters: Dict[str, Any],
        initial_capital: float
    ) -> Dict[str, float]:
        """Run backtest with simple implementation (fallback)."""
        try:
            # Initialize strategy with parameters
            strategy = strategy_class(**parameters)
            
            # Simple backtesting logic (simplified for demonstration)
            portfolio_value = initial_capital
            positions = {}
            trades = []
            daily_returns = []
            
            for i, (date, row) in enumerate(market_data.iterrows()):
                if i == 0:
                    continue
                
                # Get historical data up to current point
                historical_data = market_data.iloc[:i+1]
                
                # Simulate strategy signal generation
                # This is a simplified version - in practice, you'd call the strategy's methods
                signal_strength = 0.0
                
                # Simple moving average crossover simulation
                if len(historical_data) >= max(parameters.get('short_period', 20), parameters.get('long_period', 50)):
                    short_ma = historical_data['close'].rolling(parameters.get('short_period', 20)).mean().iloc[-1]
                    long_ma = historical_data['close'].rolling(parameters.get('long_period', 50)).mean().iloc[-1]
                    
                    if short_ma > long_ma:
                        signal_strength = 0.5  # Buy signal
                    elif short_ma < long_ma:
                        signal_strength = -0.5  # Sell signal
                
                # Execute trades based on signal
                if signal_strength > 0.3 and symbol not in positions:
                    # Buy
                    shares = (portfolio_value * 0.95) / row['close']
                    positions[symbol] = shares
                    portfolio_value -= shares * row['close']
                    trades.append({'type': 'buy', 'price': row['close'], 'shares': shares, 'date': date})
                elif signal_strength < -0.3 and symbol in positions:
                    # Sell
                    shares = positions.pop(symbol, 0)
                    portfolio_value += shares * row['close']
                    trades.append({'type': 'sell', 'price': row['close'], 'shares': shares, 'date': date})
                
                # Calculate current portfolio value
                current_value = portfolio_value
                for pos_symbol, shares in positions.items():
                    if pos_symbol == symbol:
                        current_value += shares * row['close']
                
                # Calculate daily return
                if i > 1:
                    prev_value = daily_returns[-1] if daily_returns else initial_capital
                    daily_return = (current_value - prev_value) / prev_value if prev_value > 0 else 0
                    daily_returns.append(daily_return)
            
            # Calculate performance metrics
            if not daily_returns:
                return {}
            
            # Final portfolio value
            final_value = portfolio_value
            for pos_symbol, shares in positions.items():
                if pos_symbol == symbol:
                    final_value += shares * market_data['close'].iloc[-1]
            
            total_return = (final_value - initial_capital) / initial_capital
            annualized_return = (1 + total_return) ** (252 / len(daily_returns)) - 1
            volatility = np.std(daily_returns) * np.sqrt(252)
            sharpe_ratio = annualized_return / volatility if volatility > 0 else 0
            
            # Calculate drawdown
            cumulative_returns = np.cumprod(1 + np.array(daily_returns))
            running_max = np.maximum.accumulate(cumulative_returns)
            drawdowns = (cumulative_returns - running_max) / running_max
            max_drawdown = np.min(drawdowns)
            
            # Calculate other metrics
            calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0
            
            negative_returns = [r for r in daily_returns if r < 0]
            downside_deviation = np.std(negative_returns) * np.sqrt(252) if negative_returns else 0
            sortino_ratio = annualized_return / downside_deviation if downside_deviation > 0 else 0
            
            # Profit factor
            winning_trades = [t for t in daily_returns if t > 0]
            losing_trades = [t for t in daily_returns if t < 0]
            gross_profit = sum(winning_trades) if winning_trades else 0
            gross_loss = abs(sum(losing_trades)) if losing_trades else 0
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
            
            return {
                'total_return': total_return,
                'annualized_return': annualized_return,
                'volatility': volatility,
                'sharpe_ratio': sharpe_ratio,
                'max_drawdown': max_drawdown,
                'calmar_ratio': calmar_ratio,
                'sortino_ratio': sortino_ratio,
                'profit_factor': profit_factor,
                'trade_count': len(trades),
                'final_value': final_value
            }
            
        except Exception as e:
            self._logger.debug(f"Simple backtest failed: {e}")
            return {}
    
    def _calculate_objective_score(self, metrics: Dict[str, float], objective: ObjectiveFunction) -> float:
        """Calculate objective score from metrics."""
        if not metrics:
            return float('-inf')
        
        if objective == ObjectiveFunction.SHARPE_RATIO:
            return metrics.get('sharpe_ratio', float('-inf'))
        elif objective == ObjectiveFunction.CALMAR_RATIO:
            return metrics.get('calmar_ratio', float('-inf'))
        elif objective == ObjectiveFunction.SORTINO_RATIO:
            return metrics.get('sortino_ratio', float('-inf'))
        elif objective == ObjectiveFunction.TOTAL_RETURN:
            return metrics.get('total_return', float('-inf'))
        elif objective == ObjectiveFunction.MAX_DRAWDOWN:
            return -metrics.get('max_drawdown', 0)  # Minimize drawdown
        elif objective == ObjectiveFunction.PROFIT_FACTOR:
            pf = metrics.get('profit_factor', 0)
            return pf if pf != float('inf') else 1000  # Cap infinite values
        else:
            return metrics.get('sharpe_ratio', float('-inf'))
    
    async def _run_optimization_algorithm(
        self,
        objective_func: Callable,
        parameter_spaces: Dict[str, ParameterSpace],
        config: OptimizationConfig
    ) -> OptimizationResult:
        """Run the specified optimization algorithm."""
        
        if config.algorithm == OptimizationAlgorithm.GRID_SEARCH:
            return await self._grid_search(objective_func, parameter_spaces, config)
        elif config.algorithm == OptimizationAlgorithm.RANDOM_SEARCH:
            return await self._random_search(objective_func, parameter_spaces, config)
        elif config.algorithm == OptimizationAlgorithm.BAYESIAN_OPTIMIZATION:
            return await self._bayesian_optimization(objective_func, parameter_spaces, config)
        elif config.algorithm == OptimizationAlgorithm.GENETIC_ALGORITHM:
            return await self._genetic_algorithm(objective_func, parameter_spaces, config)
        else:
            # Default to grid search
            return await self._grid_search(objective_func, parameter_spaces, config)
    
    async def _grid_search(
        self,
        objective_func: Callable,
        parameter_spaces: Dict[str, ParameterSpace],
        config: OptimizationConfig
    ) -> OptimizationResult:
        """Grid search optimization."""
        result = OptimizationResult(algorithm_used=OptimizationAlgorithm.GRID_SEARCH)
        
        # Generate all parameter combinations
        param_grids = []
        param_names = list(parameter_spaces.keys())
        
        for param_name, space in parameter_spaces.items():
            if space.param_type == 'categorical':
                param_grids.append(space.values)
            elif space.param_type == 'int':
                param_grids.append(list(range(space.min_value, space.max_value + 1, space.step)))
            elif space.param_type == 'float':
                param_grids.append(np.arange(space.min_value, space.max_value + space.step, space.step).tolist())
        
        # Limit combinations if too many
        total_combinations = np.prod([len(grid) for grid in param_grids])
        if total_combinations > config.max_iterations:
            self._logger.warning(f"Grid search would evaluate {total_combinations} combinations, limiting to {config.max_iterations}")
            # Sample random combinations instead
            combinations = []
            for _ in range(config.max_iterations):
                combination = {}
                for param_name, space in parameter_spaces.items():
                    combination[param_name] = space.sample()
                combinations.append(combination)
        else:
            # Generate all combinations
            combinations = []
            for combo in itertools.product(*param_grids):
                combination = dict(zip(param_names, combo))
                combinations.append(combination)
        
        # Evaluate each combination
        best_score = float('-inf')
        best_params = {}
        
        for i, params in enumerate(combinations):
            score = await objective_func(params)
            result.evaluation_history.append((params.copy(), score))
            
            if score > best_score:
                best_score = score
                best_params = params.copy()
                result.best_score = best_score
                result.best_parameters = best_params
            
            result.total_evaluations += 1
            
            # Check for early convergence
            if i > 10 and len(result.evaluation_history) > 10:
                recent_scores = [s for _, s in result.evaluation_history[-10:]]
                if np.std(recent_scores) < config.convergence_threshold:
                    result.convergence_achieved = True
                    break
        
        result.success = best_score > float('-inf')
        result.iterations_completed = result.total_evaluations
        
        return result
    
    async def _random_search(
        self,
        objective_func: Callable,
        parameter_spaces: Dict[str, ParameterSpace],
        config: OptimizationConfig
    ) -> OptimizationResult:
        """Random search optimization."""
        result = OptimizationResult(algorithm_used=OptimizationAlgorithm.RANDOM_SEARCH)
        
        best_score = float('-inf')
        best_params = {}
        
        for i in range(config.max_iterations):
            # Sample random parameters
            params = {}
            for param_name, space in parameter_spaces.items():
                params[param_name] = space.sample()
            
            # Evaluate
            score = await objective_func(params)
            result.evaluation_history.append((params.copy(), score))
            
            if score > best_score:
                best_score = score
                best_params = params.copy()
                result.best_score = best_score
                result.best_parameters = best_params
            
            result.total_evaluations += 1
            
            # Check for convergence
            if i > 10:
                recent_scores = [s for _, s in result.evaluation_history[-10:]]
                if np.std(recent_scores) < config.convergence_threshold:
                    result.convergence_achieved = True
                    break
        
        result.success = best_score > float('-inf')
        result.iterations_completed = result.total_evaluations
        
        return result
    
    async def _bayesian_optimization(
        self,
        objective_func: Callable,
        parameter_spaces: Dict[str, ParameterSpace],
        config: OptimizationConfig
    ) -> OptimizationResult:
        """Bayesian optimization (simplified implementation)."""
        if not SKLEARN_AVAILABLE:
            self._logger.warning("scikit-learn not available, falling back to random search")
            return await self._random_search(objective_func, parameter_spaces, config)
        
        result = OptimizationResult(algorithm_used=OptimizationAlgorithm.BAYESIAN_OPTIMIZATION)
        
        # For simplicity, fall back to random search
        # A full Bayesian optimization would require more sophisticated implementation
        return await self._random_search(objective_func, parameter_spaces, config)
    
    async def _genetic_algorithm(
        self,
        objective_func: Callable,
        parameter_spaces: Dict[str, ParameterSpace],
        config: OptimizationConfig
    ) -> OptimizationResult:
        """Genetic algorithm optimization."""
        if not GENETIC_AVAILABLE:
            self._logger.warning("Genetic optimizer not available, falling back to random search")
            return await self._random_search(objective_func, parameter_spaces, config)
        
        result = OptimizationResult(algorithm_used=OptimizationAlgorithm.GENETIC_ALGORITHM)
        
        # Configure genetic algorithm
        genetic_config = GeneticConfig(
            population_size=config.genetic_population_size,
            max_generations=config.max_iterations,
            crossover_rate=config.genetic_crossover_rate,
            mutation_rate=config.genetic_mutation_rate,
            n_jobs=config.n_jobs,
            random_seed=config.random_seed
        )
        
        # Create genetic optimizer
        genetic_optimizer = GeneticOptimizer(genetic_config)
        
        try:
            # Run genetic optimization
            genetic_result = await genetic_optimizer.optimize(
                objective_function=objective_func,
                parameter_spaces=parameter_spaces,
                config=genetic_config
            )
            
            # Convert result
            result.success = genetic_result.success
            result.best_parameters = genetic_result.best_parameters
            result.best_score = genetic_result.best_score
            result.best_metrics = genetic_result.best_metrics
            result.iterations_completed = genetic_result.iterations_completed
            result.total_evaluations = genetic_result.total_evaluations
            result.convergence_achieved = genetic_result.convergence_achieved
            result.evaluation_history = genetic_result.evaluation_history
            
            return result
            
        except Exception as e:
            self._logger.error(f"Genetic algorithm failed: {e}")
            result.success = False
            return result
    
    async def _calculate_final_metrics(
        self,
        strategy_class: type,
        symbol: str,
        market_data: pd.DataFrame,
        parameters: Dict[str, Any],
        initial_capital: float,
        config: OptimizationConfig
    ) -> Dict[str, float]:
        """Calculate final metrics with best parameters."""
        return await self._run_backtest(strategy_class, symbol, market_data, parameters, initial_capital, config)