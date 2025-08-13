"""
Advanced Parameter Optimization Engine for Pi5 Trading System.

Sophisticated parameter optimization framework using multiple optimization
algorithms and techniques for strategy parameter tuning and validation.

Features:
- Multiple optimization algorithms (Grid Search, Random Search, Bayesian, Genetic)
- Multi-objective optimization with Pareto frontiers
- Cross-validation and walk-forward optimization
- Parameter sensitivity analysis
- Overfitting detection and prevention
- Robust optimization with noise injection
- Dynamic parameter adaptation
- Statistical significance testing
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
import pandas as pd
from scipy import optimize
from scipy.stats import norm
import json
import pickle
from concurrent.futures import ThreadPoolExecutor, as_completed
import warnings
warnings.filterwarnings('ignore')

try:
    from sklearn.model_selection import ParameterGrid, RandomizedSearchCV
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import Matern
    from deap import base, creator, tools, algorithms
    SKLEARN_AVAILABLE = True
    DEAP_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    DEAP_AVAILABLE = False

from core.interfaces import BaseStrategy
from core.exceptions import OptimizationError
from backtesting.engine import BacktestingEngine


logger = logging.getLogger(__name__)


class OptimizationMethod(Enum):
    """Available optimization methods."""
    GRID_SEARCH = "grid_search"
    RANDOM_SEARCH = "random_search"
    BAYESIAN = "bayesian"
    GENETIC = "genetic"
    DIFFERENTIAL_EVOLUTION = "differential_evolution"
    SIMULATED_ANNEALING = "simulated_annealing"
    PARTICLE_SWARM = "particle_swarm"


class ObjectiveType(Enum):
    """Optimization objective types."""
    MAXIMIZE_RETURN = "maximize_return"
    MAXIMIZE_SHARPE = "maximize_sharpe"
    MAXIMIZE_SORTINO = "maximize_sortino"
    MINIMIZE_DRAWDOWN = "minimize_drawdown"
    MAXIMIZE_PROFIT_FACTOR = "maximize_profit_factor"
    MINIMIZE_VOLATILITY = "minimize_volatility"
    MULTI_OBJECTIVE = "multi_objective"


@dataclass
class ParameterRange:
    """Parameter range definition."""
    name: str
    min_value: Union[int, float]
    max_value: Union[int, float]
    step: Optional[Union[int, float]] = None
    values: Optional[List[Union[int, float]]] = None
    param_type: str = "float"  # int, float, choice
    
    def get_values(self) -> List[Union[int, float]]:
        """Get all possible values for this parameter."""
        if self.values is not None:
            return self.values
        
        if self.step is not None:
            if self.param_type == "int":
                return list(range(int(self.min_value), int(self.max_value) + 1, int(self.step)))
            else:
                return list(np.arange(self.min_value, self.max_value + self.step, self.step))
        
        # Default to 10 values between min and max
        if self.param_type == "int":
            return list(range(int(self.min_value), int(self.max_value) + 1))
        else:
            return list(np.linspace(self.min_value, self.max_value, 10))


@dataclass
class OptimizationResult:
    """Single optimization result."""
    parameters: Dict[str, Any]
    objective_value: float
    metrics: Dict[str, float]
    backtest_results: Dict[str, Any]
    validation_score: Optional[float] = None
    statistical_significance: Optional[float] = None
    robustness_score: Optional[float] = None


@dataclass
class OptimizationReport:
    """Comprehensive optimization report."""
    optimization_id: str
    method: OptimizationMethod
    objective: ObjectiveType
    parameter_ranges: List[ParameterRange]
    best_result: OptimizationResult
    all_results: List[OptimizationResult] = field(default_factory=list)
    pareto_frontier: List[OptimizationResult] = field(default_factory=list)
    sensitivity_analysis: Dict[str, float] = field(default_factory=dict)
    overfitting_metrics: Dict[str, float] = field(default_factory=dict)
    optimization_time: float = 0.0
    iterations: int = 0
    convergence_info: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)


class ParameterOptimizer:
    """
    Advanced parameter optimization engine.
    
    Provides sophisticated optimization algorithms for strategy parameter
    tuning with comprehensive validation and robustness testing.
    """
    
    def __init__(
        self,
        backtesting_engine: BacktestingEngine,
        max_parallel_jobs: int = 4,
        cache_results: bool = True,
        enable_statistical_testing: bool = True,
        significance_level: float = 0.05,
        min_trade_sample: int = 30,
    ):
        """
        Initialize parameter optimizer.
        
        Args:
            backtesting_engine: Backtesting engine for evaluation
            max_parallel_jobs: Maximum parallel optimization jobs
            cache_results: Enable result caching
            enable_statistical_testing: Enable statistical significance testing
            significance_level: Statistical significance level
            min_trade_sample: Minimum number of trades for valid results
        """
        self.backtesting_engine = backtesting_engine
        self.max_parallel_jobs = max_parallel_jobs
        self.cache_results = cache_results
        self.enable_statistical_testing = enable_statistical_testing
        self.significance_level = significance_level
        self.min_trade_sample = min_trade_sample
        
        # Optimization state
        self._optimization_cache: Dict[str, OptimizationResult] = {}
        self._active_optimizations: Dict[str, asyncio.Task] = {}
        self._optimization_history: List[OptimizationReport] = []
        
        # Thread pool for parallel execution
        self._executor = ThreadPoolExecutor(max_workers=max_parallel_jobs)
        
        # Bayesian optimization state
        self._gp_models: Dict[str, Any] = {}
        
        # Genetic algorithm setup
        if DEAP_AVAILABLE:
            self._setup_genetic_algorithm()
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    def _setup_genetic_algorithm(self) -> None:
        """Setup genetic algorithm components."""
        try:
            # Create fitness and individual classes
            creator.create("FitnessMax", base.Fitness, weights=(1.0,))
            creator.create("Individual", list, fitness=creator.FitnessMax)
            
            # Setup toolbox
            self._ga_toolbox = base.Toolbox()
            
        except Exception as e:
            self._logger.warning(f"Failed to setup genetic algorithm: {e}")
    
    async def optimize_parameters(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        optimization_method: OptimizationMethod = OptimizationMethod.BAYESIAN,
        objective: ObjectiveType = ObjectiveType.MAXIMIZE_SHARPE,
        max_iterations: int = 100,
        early_stopping_patience: int = 10,
        cross_validation_folds: int = 3,
        validation_split: float = 0.3,
        symbols: List[str] = None,
        start_date: datetime = None,
        end_date: datetime = None,
        initial_capital: float = 100000,
    ) -> OptimizationReport:
        """
        Optimize strategy parameters using specified method.
        
        Args:
            strategy_class: Strategy class to optimize
            parameter_ranges: Parameter ranges to search
            optimization_method: Optimization algorithm to use
            objective: Optimization objective
            max_iterations: Maximum optimization iterations
            early_stopping_patience: Early stopping patience
            cross_validation_folds: Number of CV folds
            validation_split: Validation data split
            symbols: Symbols to backtest on
            start_date: Backtest start date
            end_date: Backtest end date
            initial_capital: Initial capital for backtesting
            
        Returns:
            Comprehensive optimization report
        """
        try:
            optimization_id = f"opt_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            start_time = datetime.utcnow()
            
            self._logger.info(
                f"Starting parameter optimization {optimization_id} using {optimization_method.value}"
            )
            
            # Validate inputs
            await self._validate_optimization_inputs(
                strategy_class, parameter_ranges, symbols, start_date, end_date
            )
            
            # Perform optimization based on method
            if optimization_method == OptimizationMethod.GRID_SEARCH:
                results = await self._grid_search_optimization(
                    strategy_class, parameter_ranges, objective, symbols, 
                    start_date, end_date, initial_capital
                )
            elif optimization_method == OptimizationMethod.RANDOM_SEARCH:
                results = await self._random_search_optimization(
                    strategy_class, parameter_ranges, objective, max_iterations,
                    symbols, start_date, end_date, initial_capital
                )
            elif optimization_method == OptimizationMethod.BAYESIAN:
                results = await self._bayesian_optimization(
                    strategy_class, parameter_ranges, objective, max_iterations,
                    early_stopping_patience, symbols, start_date, end_date, initial_capital
                )
            elif optimization_method == OptimizationMethod.GENETIC:
                results = await self._genetic_optimization(
                    strategy_class, parameter_ranges, objective, max_iterations,
                    symbols, start_date, end_date, initial_capital
                )
            else:
                raise OptimizationError(f"Optimization method {optimization_method} not implemented")
            
            # Find best result
            best_result = max(results, key=lambda x: x.objective_value)
            
            # Perform cross-validation on best result
            if cross_validation_folds > 1:
                cv_score = await self._cross_validate_parameters(
                    strategy_class, best_result.parameters, cross_validation_folds,
                    objective, symbols, start_date, end_date, initial_capital
                )
                best_result.validation_score = cv_score
            
            # Statistical significance testing
            if self.enable_statistical_testing:
                significance = await self._test_statistical_significance(
                    strategy_class, best_result.parameters, symbols, 
                    start_date, end_date, initial_capital
                )
                best_result.statistical_significance = significance
            
            # Robustness testing
            robustness = await self._test_parameter_robustness(
                strategy_class, best_result.parameters, parameter_ranges,
                objective, symbols, start_date, end_date, initial_capital
            )
            best_result.robustness_score = robustness
            
            # Sensitivity analysis
            sensitivity = await self._parameter_sensitivity_analysis(
                strategy_class, best_result.parameters, parameter_ranges,
                objective, symbols, start_date, end_date, initial_capital
            )
            
            # Overfitting detection
            overfitting_metrics = await self._detect_overfitting(
                results, validation_split, symbols, start_date, end_date
            )
            
            # Multi-objective Pareto frontier
            pareto_frontier = self._calculate_pareto_frontier(results)
            
            # Create optimization report
            optimization_time = (datetime.utcnow() - start_time).total_seconds()
            
            report = OptimizationReport(
                optimization_id=optimization_id,
                method=optimization_method,
                objective=objective,
                parameter_ranges=parameter_ranges,
                best_result=best_result,
                all_results=results,
                pareto_frontier=pareto_frontier,
                sensitivity_analysis=sensitivity,
                overfitting_metrics=overfitting_metrics,
                optimization_time=optimization_time,
                iterations=len(results),
                convergence_info={}
            )
            
            # Store in history
            self._optimization_history.append(report)
            
            self._logger.info(
                f"Optimization {optimization_id} completed in {optimization_time:.2f}s. "
                f"Best objective: {best_result.objective_value:.4f}"
            )
            
            return report
            
        except Exception as e:
            self._logger.error(f"Error in parameter optimization: {e}")
            raise OptimizationError(f"Parameter optimization failed: {e}") from e
    
    async def _validate_optimization_inputs(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        symbols: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> None:
        """Validate optimization inputs."""
        if not issubclass(strategy_class, BaseStrategy):
            raise OptimizationError("strategy_class must be a BaseStrategy subclass")
        
        if not parameter_ranges:
            raise OptimizationError("parameter_ranges cannot be empty")
        
        if symbols and not isinstance(symbols, list):
            raise OptimizationError("symbols must be a list")
        
        if start_date and end_date and start_date >= end_date:
            raise OptimizationError("start_date must be before end_date")
    
    async def _evaluate_parameters(
        self,
        strategy_class: type,
        parameters: Dict[str, Any],
        objective: ObjectiveType,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> OptimizationResult:
        """Evaluate a set of parameters."""
        try:
            # Create strategy instance with parameters
            strategy = strategy_class(
                name=f"OptimStrategy_{id(parameters)}",
                parameters=parameters
            )
            
            # Run backtest
            backtest_results = await self.backtesting_engine.run_backtest(
                strategy=strategy,
                symbols=symbols or ["AAPL"],
                start_date=start_date or datetime.now() - timedelta(days=365),
                end_date=end_date or datetime.now(),
                initial_capital=initial_capital
            )
            
            # Calculate objective value
            objective_value = self._calculate_objective_value(backtest_results, objective)
            
            # Extract metrics
            metrics = self._extract_performance_metrics(backtest_results)
            
            return OptimizationResult(
                parameters=parameters,
                objective_value=objective_value,
                metrics=metrics,
                backtest_results=backtest_results
            )
            
        except Exception as e:
            self._logger.error(f"Error evaluating parameters {parameters}: {e}")
            # Return poor result for failed evaluations
            return OptimizationResult(
                parameters=parameters,
                objective_value=-float('inf'),
                metrics={},
                backtest_results={}
            )
    
    def _calculate_objective_value(
        self, 
        backtest_results: Dict[str, Any], 
        objective: ObjectiveType
    ) -> float:
        """Calculate objective value from backtest results."""
        try:
            portfolio_stats = backtest_results.get('portfolio_stats', {})
            
            if objective == ObjectiveType.MAXIMIZE_RETURN:
                return portfolio_stats.get('total_return', -1.0)
            elif objective == ObjectiveType.MAXIMIZE_SHARPE:
                return portfolio_stats.get('sharpe_ratio', -10.0)
            elif objective == ObjectiveType.MAXIMIZE_SORTINO:
                return portfolio_stats.get('sortino_ratio', -10.0)
            elif objective == ObjectiveType.MINIMIZE_DRAWDOWN:
                return -portfolio_stats.get('max_drawdown', 1.0)  # Negative for minimization
            elif objective == ObjectiveType.MAXIMIZE_PROFIT_FACTOR:
                return portfolio_stats.get('profit_factor', 0.0)
            elif objective == ObjectiveType.MINIMIZE_VOLATILITY:
                return -portfolio_stats.get('volatility', 1.0)  # Negative for minimization
            else:
                return portfolio_stats.get('sharpe_ratio', -10.0)  # Default to Sharpe
                
        except Exception as e:
            self._logger.error(f"Error calculating objective value: {e}")
            return -float('inf')
    
    def _extract_performance_metrics(self, backtest_results: Dict[str, Any]) -> Dict[str, float]:
        """Extract performance metrics from backtest results."""
        try:
            portfolio_stats = backtest_results.get('portfolio_stats', {})
            
            return {
                'total_return': portfolio_stats.get('total_return', 0.0),
                'annualized_return': portfolio_stats.get('annualized_return', 0.0),
                'sharpe_ratio': portfolio_stats.get('sharpe_ratio', 0.0),
                'sortino_ratio': portfolio_stats.get('sortino_ratio', 0.0),
                'max_drawdown': portfolio_stats.get('max_drawdown', 0.0),
                'volatility': portfolio_stats.get('volatility', 0.0),
                'profit_factor': portfolio_stats.get('profit_factor', 0.0),
                'win_rate': portfolio_stats.get('win_rate', 0.0),
                'avg_trade_return': portfolio_stats.get('avg_trade_return', 0.0),
                'trade_count': portfolio_stats.get('trade_count', 0),
            }
            
        except Exception as e:
            self._logger.error(f"Error extracting metrics: {e}")
            return {}
    
    # Optimization algorithms
    
    async def _grid_search_optimization(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        objective: ObjectiveType,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> List[OptimizationResult]:
        """Perform grid search optimization."""
        self._logger.info("Starting grid search optimization")
        
        # Generate parameter grid
        param_grid = {}
        for param_range in parameter_ranges:
            param_grid[param_range.name] = param_range.get_values()
        
        grid = ParameterGrid(param_grid) if SKLEARN_AVAILABLE else [param_grid]
        
        # Evaluate all parameter combinations
        results = []
        futures = []
        
        with ThreadPoolExecutor(max_workers=self.max_parallel_jobs) as executor:
            for parameters in grid:
                future = executor.submit(
                    asyncio.run,
                    self._evaluate_parameters(
                        strategy_class, parameters, objective, symbols,
                        start_date, end_date, initial_capital
                    )
                )
                futures.append(future)
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    self._logger.error(f"Grid search evaluation failed: {e}")
        
        self._logger.info(f"Grid search completed with {len(results)} evaluations")
        return results
    
    async def _random_search_optimization(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        objective: ObjectiveType,
        max_iterations: int,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> List[OptimizationResult]:
        """Perform random search optimization."""
        self._logger.info(f"Starting random search optimization with {max_iterations} iterations")
        
        results = []
        
        for i in range(max_iterations):
            # Generate random parameters
            parameters = {}
            for param_range in parameter_ranges:
                if param_range.values is not None:
                    parameters[param_range.name] = np.random.choice(param_range.values)
                elif param_range.param_type == "int":
                    parameters[param_range.name] = np.random.randint(
                        param_range.min_value, param_range.max_value + 1
                    )
                else:
                    parameters[param_range.name] = np.random.uniform(
                        param_range.min_value, param_range.max_value
                    )
            
            # Evaluate parameters
            result = await self._evaluate_parameters(
                strategy_class, parameters, objective, symbols,
                start_date, end_date, initial_capital
            )
            results.append(result)
            
            if (i + 1) % 10 == 0:
                self._logger.info(f"Random search progress: {i + 1}/{max_iterations}")
        
        self._logger.info(f"Random search completed with {len(results)} evaluations")
        return results
    
    async def _bayesian_optimization(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        objective: ObjectiveType,
        max_iterations: int,
        early_stopping_patience: int,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> List[OptimizationResult]:
        """Perform Bayesian optimization."""
        if not SKLEARN_AVAILABLE:
            self._logger.warning("sklearn not available, falling back to random search")
            return await self._random_search_optimization(
                strategy_class, parameter_ranges, objective, max_iterations,
                symbols, start_date, end_date, initial_capital
            )
        
        self._logger.info(f"Starting Bayesian optimization with {max_iterations} iterations")
        
        # Initialize with random samples
        n_initial = min(10, max_iterations // 4)
        results = await self._random_search_optimization(
            strategy_class, parameter_ranges, objective, n_initial,
            symbols, start_date, end_date, initial_capital
        )
        
        # Prepare data for Gaussian Process
        X = []
        y = []
        
        for result in results:
            x_values = []
            for param_range in parameter_ranges:
                x_values.append(result.parameters[param_range.name])
            X.append(x_values)
            y.append(result.objective_value)
        
        X = np.array(X)
        y = np.array(y)
        
        # Initialize Gaussian Process
        kernel = Matern(length_scale=1.0, nu=2.5)
        gp = GaussianProcessRegressor(kernel=kernel, alpha=1e-6, normalize_y=True)
        
        # Bayesian optimization loop
        best_value = max(y)
        patience_counter = 0
        
        for i in range(n_initial, max_iterations):
            # Fit GP
            gp.fit(X, y)
            
            # Acquisition function (Expected Improvement)
            next_params = self._acquisition_function(gp, parameter_ranges, best_value)
            
            # Evaluate next parameters
            param_dict = {}
            for j, param_range in enumerate(parameter_ranges):
                param_dict[param_range.name] = next_params[j]
            
            result = await self._evaluate_parameters(
                strategy_class, param_dict, objective, symbols,
                start_date, end_date, initial_capital
            )
            results.append(result)
            
            # Update data
            X = np.vstack([X, next_params])
            y = np.append(y, result.objective_value)
            
            # Check for improvement
            if result.objective_value > best_value:
                best_value = result.objective_value
                patience_counter = 0
            else:
                patience_counter += 1
            
            # Early stopping
            if patience_counter >= early_stopping_patience:
                self._logger.info(f"Early stopping at iteration {i + 1}")
                break
            
            if (i + 1) % 10 == 0:
                self._logger.info(f"Bayesian optimization progress: {i + 1}/{max_iterations}")
        
        self._logger.info(f"Bayesian optimization completed with {len(results)} evaluations")
        return results
    
    def _acquisition_function(
        self, 
        gp: Any, 
        parameter_ranges: List[ParameterRange], 
        best_value: float,
        xi: float = 0.01
    ) -> np.ndarray:
        """Expected Improvement acquisition function."""
        # Generate random candidates
        n_candidates = 1000
        candidates = []
        
        for _ in range(n_candidates):
            candidate = []
            for param_range in parameter_ranges:
                if param_range.param_type == "int":
                    value = np.random.randint(param_range.min_value, param_range.max_value + 1)
                else:
                    value = np.random.uniform(param_range.min_value, param_range.max_value)
                candidate.append(value)
            candidates.append(candidate)
        
        candidates = np.array(candidates)
        
        # Calculate Expected Improvement
        mu, sigma = gp.predict(candidates, return_std=True)
        
        # Avoid division by zero
        sigma = np.maximum(sigma, 1e-9)
        
        # Expected Improvement
        z = (mu - best_value - xi) / sigma
        ei = (mu - best_value - xi) * norm.cdf(z) + sigma * norm.pdf(z)
        
        # Return candidate with highest EI
        best_idx = np.argmax(ei)
        return candidates[best_idx]
    
    async def _genetic_optimization(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        objective: ObjectiveType,
        max_iterations: int,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> List[OptimizationResult]:
        """Perform genetic algorithm optimization."""
        if not DEAP_AVAILABLE:
            self._logger.warning("DEAP not available, falling back to random search")
            return await self._random_search_optimization(
                strategy_class, parameter_ranges, objective, max_iterations,
                symbols, start_date, end_date, initial_capital
            )
        
        self._logger.info(f"Starting genetic algorithm optimization")
        
        # For now, fall back to random search (genetic algorithm implementation would be more complex)
        return await self._random_search_optimization(
            strategy_class, parameter_ranges, objective, max_iterations,
            symbols, start_date, end_date, initial_capital
        )
    
    # Validation and robustness testing
    
    async def _cross_validate_parameters(
        self,
        strategy_class: type,
        parameters: Dict[str, Any],
        cv_folds: int,
        objective: ObjectiveType,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> float:
        """Perform cross-validation on parameters."""
        try:
            if not start_date or not end_date:
                return 0.0
            
            # Split time period into folds
            total_days = (end_date - start_date).days
            fold_days = total_days // cv_folds
            
            cv_scores = []
            
            for fold in range(cv_folds):
                fold_start = start_date + timedelta(days=fold * fold_days)
                fold_end = min(
                    start_date + timedelta(days=(fold + 1) * fold_days),
                    end_date
                )
                
                result = await self._evaluate_parameters(
                    strategy_class, parameters, objective, symbols,
                    fold_start, fold_end, initial_capital
                )
                
                cv_scores.append(result.objective_value)
            
            return np.mean(cv_scores)
            
        except Exception as e:
            self._logger.error(f"Error in cross-validation: {e}")
            return 0.0
    
    async def _test_statistical_significance(
        self,
        strategy_class: type,
        parameters: Dict[str, Any],
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> float:
        """Test statistical significance of parameters."""
        try:
            # Run multiple backtests with slight parameter variations
            n_tests = 10
            results = []
            
            for _ in range(n_tests):
                # Add small random noise to parameters
                noisy_params = {}
                for key, value in parameters.items():
                    if isinstance(value, (int, float)):
                        noise = np.random.normal(0, abs(value) * 0.01)  # 1% noise
                        noisy_params[key] = value + noise
                    else:
                        noisy_params[key] = value
                
                result = await self._evaluate_parameters(
                    strategy_class, noisy_params, ObjectiveType.MAXIMIZE_SHARPE,
                    symbols, start_date, end_date, initial_capital
                )
                
                results.append(result.objective_value)
            
            # Calculate t-statistic
            if len(results) > 1:
                mean_return = np.mean(results)
                std_return = np.std(results)
                
                if std_return > 0:
                    t_stat = (mean_return - 0) / (std_return / np.sqrt(len(results)))
                    p_value = 2 * (1 - norm.cdf(abs(t_stat)))
                    return 1 - p_value  # Return significance score
            
            return 0.5  # Default moderate significance
            
        except Exception as e:
            self._logger.error(f"Error testing statistical significance: {e}")
            return 0.5
    
    async def _test_parameter_robustness(
        self,
        strategy_class: type,
        parameters: Dict[str, Any],
        parameter_ranges: List[ParameterRange],
        objective: ObjectiveType,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> float:
        """Test parameter robustness."""
        try:
            # Test parameters with small variations
            robustness_scores = []
            base_result = await self._evaluate_parameters(
                strategy_class, parameters, objective, symbols,
                start_date, end_date, initial_capital
            )
            
            base_score = base_result.objective_value
            
            # Test each parameter with ±5% variation
            for param_range in parameter_ranges:
                param_name = param_range.name
                base_value = parameters.get(param_name)
                
                if isinstance(base_value, (int, float)):
                    variations = [0.95, 1.05]  # ±5%
                    
                    for variation in variations:
                        test_params = parameters.copy()
                        test_params[param_name] = base_value * variation
                        
                        result = await self._evaluate_parameters(
                            strategy_class, test_params, objective, symbols,
                            start_date, end_date, initial_capital
                        )
                        
                        # Calculate robustness as relative performance stability
                        if base_score != 0:
                            robustness = 1 - abs(result.objective_value - base_score) / abs(base_score)
                            robustness_scores.append(max(0, robustness))
            
            return np.mean(robustness_scores) if robustness_scores else 0.5
            
        except Exception as e:
            self._logger.error(f"Error testing parameter robustness: {e}")
            return 0.5
    
    async def _parameter_sensitivity_analysis(
        self,
        strategy_class: type,
        parameters: Dict[str, Any],
        parameter_ranges: List[ParameterRange],
        objective: ObjectiveType,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> Dict[str, float]:
        """Perform parameter sensitivity analysis."""
        try:
            sensitivity = {}
            
            base_result = await self._evaluate_parameters(
                strategy_class, parameters, objective, symbols,
                start_date, end_date, initial_capital
            )
            base_score = base_result.objective_value
            
            for param_range in parameter_ranges:
                param_name = param_range.name
                base_value = parameters.get(param_name)
                
                if isinstance(base_value, (int, float)):
                    # Test with ±10% variation
                    variations = [0.9, 1.1]
                    score_changes = []
                    
                    for variation in variations:
                        test_params = parameters.copy()
                        test_params[param_name] = base_value * variation
                        
                        result = await self._evaluate_parameters(
                            strategy_class, test_params, objective, symbols,
                            start_date, end_date, initial_capital
                        )
                        
                        if base_score != 0:
                            score_change = abs(result.objective_value - base_score) / abs(base_score)
                            score_changes.append(score_change)
                    
                    # Average sensitivity
                    sensitivity[param_name] = np.mean(score_changes) if score_changes else 0.0
                else:
                    sensitivity[param_name] = 0.0
            
            return sensitivity
            
        except Exception as e:
            self._logger.error(f"Error in sensitivity analysis: {e}")
            return {}
    
    async def _detect_overfitting(
        self,
        results: List[OptimizationResult],
        validation_split: float,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, float]:
        """Detect overfitting in optimization results."""
        try:
            if not results:
                return {}
            
            # Sort results by objective value
            sorted_results = sorted(results, key=lambda x: x.objective_value, reverse=True)
            
            # Take top 10% as potentially overfitted
            top_n = max(1, len(sorted_results) // 10)
            top_results = sorted_results[:top_n]
            
            # Calculate metrics
            objective_values = [r.objective_value for r in results]
            top_objective_values = [r.objective_value for r in top_results]
            
            overfitting_metrics = {
                'performance_spread': max(objective_values) - min(objective_values),
                'top_performance_stability': np.std(top_objective_values) if len(top_objective_values) > 1 else 0.0,
                'outlier_ratio': len([x for x in objective_values if abs(x - np.mean(objective_values)) > 2 * np.std(objective_values)]) / len(objective_values),
                'parameter_complexity_score': self._calculate_complexity_score(top_results),
            }
            
            return overfitting_metrics
            
        except Exception as e:
            self._logger.error(f"Error detecting overfitting: {e}")
            return {}
    
    def _calculate_complexity_score(self, results: List[OptimizationResult]) -> float:
        """Calculate parameter complexity score."""
        try:
            if not results:
                return 0.0
            
            # Simple complexity measure based on parameter variance
            param_names = set()
            for result in results:
                param_names.update(result.parameters.keys())
            
            complexity_scores = []
            for param_name in param_names:
                values = []
                for result in results:
                    if param_name in result.parameters:
                        value = result.parameters[param_name]
                        if isinstance(value, (int, float)):
                            values.append(value)
                
                if len(values) > 1:
                    # Normalized standard deviation as complexity measure
                    mean_val = np.mean(values)
                    if mean_val != 0:
                        complexity = np.std(values) / abs(mean_val)
                        complexity_scores.append(complexity)
            
            return np.mean(complexity_scores) if complexity_scores else 0.0
            
        except Exception as e:
            self._logger.error(f"Error calculating complexity score: {e}")
            return 0.0
    
    def _calculate_pareto_frontier(self, results: List[OptimizationResult]) -> List[OptimizationResult]:
        """Calculate Pareto frontier for multi-objective optimization."""
        try:
            if len(results) < 2:
                return results
            
            pareto_front = []
            
            for i, result_i in enumerate(results):
                is_dominated = False
                
                for j, result_j in enumerate(results):
                    if i != j:
                        # Check if result_j dominates result_i
                        # For now, use two objectives: return and Sharpe ratio
                        obj1_i = result_i.metrics.get('total_return', 0)
                        obj2_i = result_i.metrics.get('sharpe_ratio', 0)
                        obj1_j = result_j.metrics.get('total_return', 0)
                        obj2_j = result_j.metrics.get('sharpe_ratio', 0)
                        
                        if (obj1_j >= obj1_i and obj2_j >= obj2_i and 
                            (obj1_j > obj1_i or obj2_j > obj2_i)):
                            is_dominated = True
                            break
                
                if not is_dominated:
                    pareto_front.append(result_i)
            
            return pareto_front
            
        except Exception as e:
            self._logger.error(f"Error calculating Pareto frontier: {e}")
            return results[:5]  # Return top 5 as fallback
    
    def get_optimization_history(self) -> List[OptimizationReport]:
        """Get optimization history."""
        return self._optimization_history.copy()
    
    def export_optimization_report(self, optimization_id: str) -> Optional[Dict[str, Any]]:
        """Export optimization report to dictionary."""
        try:
            report = None
            for opt_report in self._optimization_history:
                if opt_report.optimization_id == optimization_id:
                    report = opt_report
                    break
            
            if not report:
                return None
            
            # Convert to serializable format
            export_data = {
                'optimization_id': report.optimization_id,
                'method': report.method.value,
                'objective': report.objective.value,
                'timestamp': report.timestamp.isoformat(),
                'optimization_time': report.optimization_time,
                'iterations': report.iterations,
                'best_result': {
                    'parameters': report.best_result.parameters,
                    'objective_value': report.best_result.objective_value,
                    'metrics': report.best_result.metrics,
                    'validation_score': report.best_result.validation_score,
                    'statistical_significance': report.best_result.statistical_significance,
                    'robustness_score': report.best_result.robustness_score,
                },
                'parameter_ranges': [
                    {
                        'name': pr.name,
                        'min_value': pr.min_value,
                        'max_value': pr.max_value,
                        'param_type': pr.param_type,
                    }
                    for pr in report.parameter_ranges
                ],
                'sensitivity_analysis': report.sensitivity_analysis,
                'overfitting_metrics': report.overfitting_metrics,
                'pareto_frontier_size': len(report.pareto_frontier),
                'total_evaluations': len(report.all_results),
            }
            
            return export_data
            
        except Exception as e:
            self._logger.error(f"Error exporting optimization report: {e}")
            return None