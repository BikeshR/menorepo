"""
Monte Carlo Simulation for Pi5 Trading System.

Advanced Monte Carlo simulation engine for strategy robustness testing.
Performs statistical analysis of strategy performance under various
market conditions and parameter uncertainties.

Features:
- Market regime simulation
- Parameter sensitivity analysis
- Risk metric estimation (VaR, CVaR, Expected Shortfall)
- Bootstrap resampling of historical data
- Stress testing under extreme conditions
- Confidence interval estimation
- Scenario generation and analysis
- Correlation-aware simulations
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
from concurrent.futures import ThreadPoolExecutor
import warnings

# Suppress pandas warnings for cleaner output
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

try:
    from scipy import stats
    from scipy.stats import norm, t as t_dist
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    
    # Mock scipy.stats for fallback
    class stats:
        @staticmethod
        def norm(): pass
        @staticmethod
        def t(): pass
    
    norm = stats.norm
    t_dist = stats.t


logger = logging.getLogger(__name__)


class SimulationType(Enum):
    """Monte Carlo simulation types."""
    BOOTSTRAP = "bootstrap"                    # Bootstrap historical returns
    PARAMETRIC = "parametric"                  # Parametric distribution simulation
    REGIME_SWITCHING = "regime_switching"      # Market regime switching
    EXTREME_STRESS = "extreme_stress"          # Extreme scenario stress testing
    PARAMETER_UNCERTAINTY = "parameter_uncertainty"  # Parameter robustness testing


class DistributionType(Enum):
    """Probability distributions for simulation."""
    NORMAL = "normal"
    T_DISTRIBUTION = "t_distribution"
    SKEWED_T = "skewed_t"
    GARCH = "garch"
    HISTORICAL = "historical"


@dataclass
class MarketRegime:
    """Market regime characteristics."""
    name: str
    probability: float
    mean_return: float
    volatility: float
    correlation_adjustment: float = 1.0
    duration_days: int = 30
    transition_probabilities: Dict[str, float] = field(default_factory=dict)


@dataclass
class MonteCarloConfig:
    """Configuration for Monte Carlo simulation."""
    n_simulations: int = 1000
    simulation_length_days: int = 252  # 1 year
    confidence_levels: List[float] = field(default_factory=lambda: [0.95, 0.99])
    
    # Simulation type and parameters
    simulation_type: SimulationType = SimulationType.BOOTSTRAP
    distribution_type: DistributionType = DistributionType.NORMAL
    
    # Bootstrap parameters
    block_size: int = 22  # ~1 month blocks for dependent data
    
    # Parametric simulation parameters
    mean_return: float = 0.0008  # Daily return
    volatility: float = 0.02     # Daily volatility
    degrees_of_freedom: float = 5.0  # For t-distribution
    
    # Market regime parameters
    regimes: List[MarketRegime] = field(default_factory=list)
    regime_switching_enabled: bool = False
    
    # Parameter uncertainty
    parameter_uncertainty_pct: float = 0.1  # 10% parameter uncertainty
    
    # Stress testing
    stress_scenarios: List[Dict[str, Any]] = field(default_factory=list)
    
    # Performance settings
    parallel_execution: bool = True
    n_jobs: int = 4
    random_seed: int = 42


@dataclass
class SimulationResult:
    """Single simulation path result."""
    path_id: int
    returns: List[float] = field(default_factory=list)
    cumulative_returns: List[float] = field(default_factory=list)
    final_return: float = 0.0
    max_drawdown: float = 0.0
    volatility: float = 0.0
    sharpe_ratio: float = 0.0
    var_95: float = 0.0
    var_99: float = 0.0
    expected_shortfall_95: float = 0.0
    trade_count: int = 0
    strategy_metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class MonteCarloAnalysisResult:
    """Complete Monte Carlo analysis results."""
    config: MonteCarloConfig
    simulation_results: List[SimulationResult] = field(default_factory=list)
    
    # Aggregate statistics
    mean_return: float = 0.0
    median_return: float = 0.0
    std_return: float = 0.0
    min_return: float = 0.0
    max_return: float = 0.0
    
    # Risk metrics
    var_95: float = 0.0
    var_99: float = 0.0
    cvar_95: float = 0.0  # Conditional VaR (Expected Shortfall)
    cvar_99: float = 0.0
    maximum_drawdown: float = 0.0
    probability_of_loss: float = 0.0
    
    # Confidence intervals
    confidence_intervals: Dict[float, Tuple[float, float]] = field(default_factory=dict)
    
    # Performance metrics distributions
    sharpe_distribution: List[float] = field(default_factory=list)
    calmar_distribution: List[float] = field(default_factory=list)
    sortino_distribution: List[float] = field(default_factory=list)
    
    # Statistical tests
    normality_test_p_value: float = 0.0
    jarque_bera_p_value: float = 0.0
    
    # Simulation metadata
    total_simulations: int = 0
    successful_simulations: int = 0
    simulation_time: float = 0.0
    convergence_achieved: bool = False


class MonteCarloSimulator:
    """
    Advanced Monte Carlo simulation engine.
    
    Provides comprehensive statistical analysis of trading strategy performance
    through simulation of various market conditions and scenarios.
    """
    
    def __init__(self, config: MonteCarloConfig = None):
        """
        Initialize Monte Carlo simulator.
        
        Args:
            config: Simulation configuration
        """
        self.config = config or MonteCarloConfig()
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        
        # Set random seeds for reproducibility
        random.seed(self.config.random_seed)
        np.random.seed(self.config.random_seed)
        
        # Market data for bootstrap simulations
        self.historical_returns: Optional[np.ndarray] = None
        self.market_regimes: List[MarketRegime] = self.config.regimes
        
        # Simulation state
        self.current_regime: Optional[MarketRegime] = None
        self.regime_duration_remaining: int = 0
    
    async def run_monte_carlo_analysis(
        self,
        strategy_backtest_function: Callable,
        market_data: pd.DataFrame,
        strategy_parameters: Dict[str, Any],
        config: MonteCarloConfig = None
    ) -> MonteCarloAnalysisResult:
        """
        Run complete Monte Carlo analysis.
        
        Args:
            strategy_backtest_function: Function to run strategy backtest
            market_data: Historical market data for bootstrap
            strategy_parameters: Strategy parameters
            config: Simulation configuration
            
        Returns:
            Complete Monte Carlo analysis results
        """
        if config:
            self.config = config
        
        self._logger.info(f"Starting Monte Carlo analysis with {self.config.n_simulations} simulations")
        
        start_time = datetime.now()
        
        try:
            # Prepare historical data
            await self._prepare_historical_data(market_data)
            
            # Initialize market regimes if needed
            if self.config.regime_switching_enabled and not self.market_regimes:
                self.market_regimes = self._create_default_regimes()
            
            # Run simulations
            simulation_results = await self._run_simulations(
                strategy_backtest_function,
                market_data,
                strategy_parameters
            )
            
            # Analyze results
            analysis_result = await self._analyze_results(simulation_results)
            
            # Set metadata
            analysis_result.config = self.config
            analysis_result.total_simulations = self.config.n_simulations
            analysis_result.successful_simulations = len(simulation_results)
            analysis_result.simulation_time = (datetime.now() - start_time).total_seconds()
            
            # Check convergence
            analysis_result.convergence_achieved = await self._check_convergence(simulation_results)
            
            self._logger.info(
                f"Monte Carlo analysis completed: {analysis_result.successful_simulations}/"
                f"{analysis_result.total_simulations} successful simulations in "
                f"{analysis_result.simulation_time:.2f}s"
            )
            
            return analysis_result
            
        except Exception as e:
            self._logger.error(f"Monte Carlo analysis failed: {e}")
            raise
    
    async def _prepare_historical_data(self, market_data: pd.DataFrame) -> None:
        """Prepare historical data for simulation."""
        if 'close' not in market_data.columns:
            raise ValueError("Market data must contain 'close' column")
        
        # Calculate returns
        returns = market_data['close'].pct_change().dropna()
        self.historical_returns = returns.values
        
        self._logger.debug(f"Prepared {len(self.historical_returns)} historical returns")
    
    def _create_default_regimes(self) -> List[MarketRegime]:
        """Create default market regimes."""
        if not SCIPY_AVAILABLE:
            self._logger.warning("Scipy not available, using simplified regimes")
        
        # Calculate historical statistics
        if self.historical_returns is not None:
            hist_mean = np.mean(self.historical_returns)
            hist_vol = np.std(self.historical_returns)
        else:
            hist_mean = 0.0008  # Default daily return
            hist_vol = 0.02     # Default daily volatility
        
        regimes = [
            MarketRegime(
                name="bull_market",
                probability=0.4,
                mean_return=hist_mean * 1.5,
                volatility=hist_vol * 0.8,
                duration_days=60
            ),
            MarketRegime(
                name="normal_market", 
                probability=0.4,
                mean_return=hist_mean,
                volatility=hist_vol,
                duration_days=45
            ),
            MarketRegime(
                name="bear_market",
                probability=0.2,
                mean_return=hist_mean * -0.5,
                volatility=hist_vol * 1.5,
                duration_days=30
            )
        ]
        
        # Set transition probabilities
        for regime in regimes:
            regime.transition_probabilities = {
                "bull_market": 0.6 if regime.name == "bull_market" else 0.2,
                "normal_market": 0.3 if regime.name != "normal_market" else 0.7,
                "bear_market": 0.1 if regime.name != "bear_market" else 0.1
            }
        
        return regimes
    
    async def _run_simulations(
        self,
        strategy_backtest_function: Callable,
        market_data: pd.DataFrame,
        strategy_parameters: Dict[str, Any]
    ) -> List[SimulationResult]:
        """Run Monte Carlo simulations."""
        simulation_results = []
        
        if self.config.parallel_execution and self.config.n_jobs > 1:
            # Parallel execution
            simulation_results = await self._run_simulations_parallel(
                strategy_backtest_function, market_data, strategy_parameters
            )
        else:
            # Sequential execution
            for i in range(self.config.n_simulations):
                try:
                    result = await self._run_single_simulation(
                        i, strategy_backtest_function, market_data, strategy_parameters
                    )
                    if result:
                        simulation_results.append(result)
                    
                    # Progress logging
                    if (i + 1) % 100 == 0:
                        self._logger.debug(f"Completed {i + 1}/{self.config.n_simulations} simulations")
                        
                except Exception as e:
                    self._logger.warning(f"Simulation {i} failed: {e}")
        
        return simulation_results
    
    async def _run_simulations_parallel(
        self,
        strategy_backtest_function: Callable,
        market_data: pd.DataFrame,
        strategy_parameters: Dict[str, Any]
    ) -> List[SimulationResult]:
        """Run simulations in parallel."""
        # For simplicity, we'll use sequential execution for now
        # Full parallel implementation would require more sophisticated async handling
        return await self._run_simulations_sequential(
            strategy_backtest_function, market_data, strategy_parameters
        )
    
    async def _run_simulations_sequential(
        self,
        strategy_backtest_function: Callable,
        market_data: pd.DataFrame,
        strategy_parameters: Dict[str, Any]
    ) -> List[SimulationResult]:
        """Run simulations sequentially."""
        simulation_results = []
        
        for i in range(self.config.n_simulations):
            try:
                result = await self._run_single_simulation(
                    i, strategy_backtest_function, market_data, strategy_parameters
                )
                if result:
                    simulation_results.append(result)
                
            except Exception as e:
                self._logger.warning(f"Simulation {i} failed: {e}")
        
        return simulation_results
    
    async def _run_single_simulation(
        self,
        path_id: int,
        strategy_backtest_function: Callable,
        market_data: pd.DataFrame,
        strategy_parameters: Dict[str, Any]
    ) -> Optional[SimulationResult]:
        """Run a single Monte Carlo simulation."""
        try:
            # Generate simulated market data
            simulated_data = await self._generate_simulated_data(market_data)
            
            # Add parameter uncertainty if enabled
            sim_parameters = self._add_parameter_uncertainty(strategy_parameters)
            
            # Run strategy backtest on simulated data
            backtest_result = await strategy_backtest_function(
                simulated_data, sim_parameters
            )
            
            # Extract performance metrics
            if not backtest_result or 'returns' not in backtest_result:
                return None
            
            returns = backtest_result['returns']
            if not returns:
                return None
            
            # Calculate performance metrics
            result = SimulationResult(path_id=path_id)
            result.returns = returns
            result.cumulative_returns = np.cumprod(1 + np.array(returns)).tolist()
            result.final_return = result.cumulative_returns[-1] - 1 if result.cumulative_returns else 0
            
            # Risk metrics
            result.volatility = np.std(returns) * np.sqrt(252) if returns else 0
            result.sharpe_ratio = (np.mean(returns) * 252) / result.volatility if result.volatility > 0 else 0
            
            # Drawdown calculation
            cumulative = np.array(result.cumulative_returns)
            running_max = np.maximum.accumulate(cumulative)
            drawdowns = (cumulative - running_max) / running_max
            result.max_drawdown = np.min(drawdowns) if len(drawdowns) > 0 else 0
            
            # VaR calculations
            if len(returns) > 0:
                returns_array = np.array(returns)
                result.var_95 = np.percentile(returns_array, 5)
                result.var_99 = np.percentile(returns_array, 1)
                
                # Expected Shortfall (CVaR)
                var_95_threshold = result.var_95
                tail_returns = returns_array[returns_array <= var_95_threshold]
                result.expected_shortfall_95 = np.mean(tail_returns) if len(tail_returns) > 0 else 0
            
            # Trade count
            result.trade_count = backtest_result.get('trade_count', 0)
            
            # Additional strategy metrics
            result.strategy_metrics = backtest_result.get('metrics', {})
            
            return result
            
        except Exception as e:
            self._logger.debug(f"Single simulation {path_id} failed: {e}")
            return None
    
    async def _generate_simulated_data(self, original_data: pd.DataFrame) -> pd.DataFrame:
        """Generate simulated market data based on configuration."""
        if self.config.simulation_type == SimulationType.BOOTSTRAP:
            return await self._bootstrap_simulation(original_data)
        elif self.config.simulation_type == SimulationType.PARAMETRIC:
            return await self._parametric_simulation(original_data)
        elif self.config.simulation_type == SimulationType.REGIME_SWITCHING:
            return await self._regime_switching_simulation(original_data)
        elif self.config.simulation_type == SimulationType.EXTREME_STRESS:
            return await self._stress_test_simulation(original_data)
        else:
            return await self._bootstrap_simulation(original_data)
    
    async def _bootstrap_simulation(self, original_data: pd.DataFrame) -> pd.DataFrame:
        """Generate data using bootstrap resampling."""
        if self.historical_returns is None:
            raise ValueError("Historical returns not prepared")
        
        # Block bootstrap for time series dependence
        n_returns = self.config.simulation_length_days
        block_size = self.config.block_size
        n_blocks = int(np.ceil(n_returns / block_size))
        
        simulated_returns = []
        
        for _ in range(n_blocks):
            # Random start point for block
            max_start = len(self.historical_returns) - block_size
            if max_start <= 0:
                # Fallback to simple bootstrap
                block = np.random.choice(self.historical_returns, size=block_size, replace=True)
            else:
                start_idx = np.random.randint(0, max_start)
                block = self.historical_returns[start_idx:start_idx + block_size]
            
            simulated_returns.extend(block)
        
        # Trim to exact length
        simulated_returns = simulated_returns[:n_returns]
        
        # Generate simulated price data
        simulated_data = self._returns_to_price_data(original_data, simulated_returns)
        
        return simulated_data
    
    async def _parametric_simulation(self, original_data: pd.DataFrame) -> pd.DataFrame:
        """Generate data using parametric distribution."""
        n_returns = self.config.simulation_length_days
        
        if self.config.distribution_type == DistributionType.NORMAL:
            simulated_returns = np.random.normal(
                self.config.mean_return,
                self.config.volatility,
                n_returns
            )
        elif self.config.distribution_type == DistributionType.T_DISTRIBUTION and SCIPY_AVAILABLE:
            simulated_returns = t_dist.rvs(
                df=self.config.degrees_of_freedom,
                loc=self.config.mean_return,
                scale=self.config.volatility,
                size=n_returns
            )
        else:
            # Fallback to normal distribution
            simulated_returns = np.random.normal(
                self.config.mean_return,
                self.config.volatility,
                n_returns
            )
        
        simulated_data = self._returns_to_price_data(original_data, simulated_returns)
        
        return simulated_data
    
    async def _regime_switching_simulation(self, original_data: pd.DataFrame) -> pd.DataFrame:
        """Generate data with market regime switching."""
        if not self.market_regimes:
            self._logger.warning("No market regimes defined, falling back to bootstrap")
            return await self._bootstrap_simulation(original_data)
        
        n_returns = self.config.simulation_length_days
        simulated_returns = []
        
        # Initialize regime
        self.current_regime = np.random.choice(self.market_regimes, p=[r.probability for r in self.market_regimes])
        self.regime_duration_remaining = self.current_regime.duration_days
        
        for _ in range(n_returns):
            # Check for regime switch
            if self.regime_duration_remaining <= 0:
                self.current_regime = self._switch_regime()
                self.regime_duration_remaining = self.current_regime.duration_days
            
            # Generate return for current regime
            return_value = np.random.normal(
                self.current_regime.mean_return,
                self.current_regime.volatility
            )
            
            simulated_returns.append(return_value)
            self.regime_duration_remaining -= 1
        
        simulated_data = self._returns_to_price_data(original_data, simulated_returns)
        
        return simulated_data
    
    async def _stress_test_simulation(self, original_data: pd.DataFrame) -> pd.DataFrame:
        """Generate data for stress testing scenarios."""
        n_returns = self.config.simulation_length_days
        
        # Create extreme scenario
        base_vol = self.config.volatility
        stress_vol = base_vol * 2.0  # Double volatility
        stress_mean = self.config.mean_return * -2.0  # Negative returns
        
        # Mix of normal and stress periods
        normal_period = int(n_returns * 0.7)  # 70% normal
        stress_period = n_returns - normal_period  # 30% stress
        
        normal_returns = np.random.normal(self.config.mean_return, base_vol, normal_period)
        stress_returns = np.random.normal(stress_mean, stress_vol, stress_period)
        
        # Randomly interleave normal and stress periods
        all_returns = np.concatenate([normal_returns, stress_returns])
        np.random.shuffle(all_returns)
        
        simulated_data = self._returns_to_price_data(original_data, all_returns)
        
        return simulated_data
    
    def _switch_regime(self) -> MarketRegime:
        """Switch to new market regime based on transition probabilities."""
        if not self.current_regime or not self.current_regime.transition_probabilities:
            # Random selection if no transition probabilities
            return np.random.choice(self.market_regimes)
        
        # Use transition probabilities
        regime_names = list(self.current_regime.transition_probabilities.keys())
        probabilities = list(self.current_regime.transition_probabilities.values())
        
        # Normalize probabilities
        prob_sum = sum(probabilities)
        if prob_sum > 0:
            probabilities = [p / prob_sum for p in probabilities]
        else:
            probabilities = [1.0 / len(probabilities)] * len(probabilities)
        
        selected_name = np.random.choice(regime_names, p=probabilities)
        
        # Find regime by name
        for regime in self.market_regimes:
            if regime.name == selected_name:
                return regime
        
        # Fallback
        return np.random.choice(self.market_regimes)
    
    def _returns_to_price_data(self, original_data: pd.DataFrame, returns: List[float]) -> pd.DataFrame:
        """Convert returns to price data format."""
        # Start with initial price
        initial_price = original_data['close'].iloc[0] if len(original_data) > 0 else 100.0
        
        # Generate price series
        prices = [initial_price]
        for ret in returns:
            new_price = prices[-1] * (1 + ret)
            prices.append(new_price)
        
        # Create DataFrame with OHLC data
        dates = pd.date_range(
            start=original_data.index[0] if len(original_data) > 0 else datetime.now(),
            periods=len(prices),
            freq='D'
        )
        
        # Simple OHLC approximation
        simulated_data = pd.DataFrame({
            'open': prices[:-1],  # Previous close as open
            'high': [p * (1 + abs(np.random.normal(0, 0.005))) for p in prices[:-1]],  # Small random high
            'low': [p * (1 - abs(np.random.normal(0, 0.005))) for p in prices[:-1]],   # Small random low
            'close': prices[1:],  # Current price as close
            'volume': np.random.randint(1000000, 10000000, len(prices) - 1)
        }, index=dates[:-1])
        
        return simulated_data
    
    def _add_parameter_uncertainty(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Add uncertainty to strategy parameters."""
        if self.config.parameter_uncertainty_pct <= 0:
            return parameters.copy()
        
        uncertain_params = parameters.copy()
        uncertainty = self.config.parameter_uncertainty_pct
        
        for param_name, value in parameters.items():
            if isinstance(value, (int, float)):
                # Add random noise
                noise = np.random.normal(0, uncertainty * abs(value))
                uncertain_params[param_name] = value + noise
                
                # Ensure positive values stay positive
                if value > 0:
                    uncertain_params[param_name] = max(0.01, uncertain_params[param_name])
        
        return uncertain_params
    
    async def _analyze_results(self, simulation_results: List[SimulationResult]) -> MonteCarloAnalysisResult:
        """Analyze simulation results and calculate statistics."""
        if not simulation_results:
            return MonteCarloAnalysisResult(config=self.config)
        
        analysis = MonteCarloAnalysisResult(config=self.config)
        
        # Extract final returns
        final_returns = [result.final_return for result in simulation_results]
        
        # Basic statistics
        analysis.mean_return = np.mean(final_returns)
        analysis.median_return = np.median(final_returns)
        analysis.std_return = np.std(final_returns)
        analysis.min_return = np.min(final_returns)
        analysis.max_return = np.max(final_returns)
        
        # Risk metrics
        analysis.var_95 = np.percentile(final_returns, 5)
        analysis.var_99 = np.percentile(final_returns, 1)
        
        # Conditional VaR (Expected Shortfall)
        var_95_returns = [r for r in final_returns if r <= analysis.var_95]
        var_99_returns = [r for r in final_returns if r <= analysis.var_99]
        
        analysis.cvar_95 = np.mean(var_95_returns) if var_95_returns else analysis.var_95
        analysis.cvar_99 = np.mean(var_99_returns) if var_99_returns else analysis.var_99
        
        # Maximum drawdown
        drawdowns = [result.max_drawdown for result in simulation_results]
        analysis.maximum_drawdown = np.min(drawdowns)
        
        # Probability of loss
        loss_count = sum(1 for r in final_returns if r < 0)
        analysis.probability_of_loss = loss_count / len(final_returns)
        
        # Confidence intervals
        for confidence_level in self.config.confidence_levels:
            alpha = 1 - confidence_level
            lower_percentile = (alpha / 2) * 100
            upper_percentile = (1 - alpha / 2) * 100
            
            lower_bound = np.percentile(final_returns, lower_percentile)
            upper_bound = np.percentile(final_returns, upper_percentile)
            
            analysis.confidence_intervals[confidence_level] = (lower_bound, upper_bound)
        
        # Performance metric distributions
        analysis.sharpe_distribution = [result.sharpe_ratio for result in simulation_results]
        
        # Calmar ratios
        calmar_ratios = []
        for result in simulation_results:
            if result.max_drawdown != 0:
                calmar = (result.final_return * 252) / abs(result.max_drawdown)
                calmar_ratios.append(calmar)
        analysis.calmar_distribution = calmar_ratios
        
        # Statistical tests (if scipy available)
        if SCIPY_AVAILABLE and len(final_returns) > 8:
            try:
                # Shapiro-Wilk test for normality
                _, analysis.normality_test_p_value = stats.shapiro(final_returns)
                
                # Jarque-Bera test
                _, analysis.jarque_bera_p_value = stats.jarque_bera(final_returns)
            except Exception as e:
                self._logger.debug(f"Statistical tests failed: {e}")
        
        return analysis
    
    async def _check_convergence(self, simulation_results: List[SimulationResult]) -> bool:
        """Check if Monte Carlo simulation has converged."""
        if len(simulation_results) < 100:
            return False
        
        # Check convergence of mean return
        final_returns = [result.final_return for result in simulation_results]
        
        # Calculate running means
        running_means = []
        for i in range(50, len(final_returns), 50):  # Check every 50 simulations
            running_mean = np.mean(final_returns[:i])
            running_means.append(running_mean)
        
        if len(running_means) < 3:
            return False
        
        # Check if last few means are stable
        recent_means = running_means[-3:]
        stability = np.std(recent_means) / np.abs(np.mean(recent_means)) if np.mean(recent_means) != 0 else float('inf')
        
        return stability < 0.01  # 1% relative stability
    
    async def save_results(self, results: MonteCarloAnalysisResult, output_path: str) -> None:
        """Save Monte Carlo results to file."""
        try:
            # Convert results to dictionary
            results_dict = {
                'config': {
                    'n_simulations': results.config.n_simulations,
                    'simulation_length_days': results.config.simulation_length_days,
                    'simulation_type': results.config.simulation_type.value,
                    'confidence_levels': results.config.confidence_levels,
                },
                'aggregate_statistics': {
                    'mean_return': results.mean_return,
                    'median_return': results.median_return,
                    'std_return': results.std_return,
                    'min_return': results.min_return,
                    'max_return': results.max_return,
                },
                'risk_metrics': {
                    'var_95': results.var_95,
                    'var_99': results.var_99,
                    'cvar_95': results.cvar_95,
                    'cvar_99': results.cvar_99,
                    'maximum_drawdown': results.maximum_drawdown,
                    'probability_of_loss': results.probability_of_loss,
                },
                'confidence_intervals': {
                    str(k): v for k, v in results.confidence_intervals.items()
                },
                'performance_distributions': {
                    'sharpe_ratios': results.sharpe_distribution,
                    'calmar_ratios': results.calmar_distribution,
                },
                'statistical_tests': {
                    'normality_test_p_value': results.normality_test_p_value,
                    'jarque_bera_p_value': results.jarque_bera_p_value,
                },
                'metadata': {
                    'total_simulations': results.total_simulations,
                    'successful_simulations': results.successful_simulations,
                    'simulation_time': results.simulation_time,
                    'convergence_achieved': results.convergence_achieved,
                }
            }
            
            # Save to file
            with open(output_path, 'w') as f:
                json.dump(results_dict, f, indent=2, default=str)
            
            self._logger.info(f"Monte Carlo results saved to {output_path}")
            
        except Exception as e:
            self._logger.error(f"Failed to save results: {e}")
            raise
    
    def get_risk_summary(self, results: MonteCarloAnalysisResult) -> Dict[str, Any]:
        """Get comprehensive risk summary."""
        return {
            'expected_return': results.mean_return,
            'return_volatility': results.std_return,
            'downside_risk': {
                'probability_of_loss': results.probability_of_loss,
                'var_95': results.var_95,
                'var_99': results.var_99,
                'expected_shortfall_95': results.cvar_95,
                'expected_shortfall_99': results.cvar_99,
                'maximum_drawdown': results.maximum_drawdown,
            },
            'confidence_intervals': results.confidence_intervals,
            'risk_adjusted_metrics': {
                'mean_sharpe': np.mean(results.sharpe_distribution) if results.sharpe_distribution else 0,
                'sharpe_volatility': np.std(results.sharpe_distribution) if results.sharpe_distribution else 0,
                'mean_calmar': np.mean(results.calmar_distribution) if results.calmar_distribution else 0,
            },
            'distribution_characteristics': {
                'is_normal': results.normality_test_p_value > 0.05 if results.normality_test_p_value else None,
                'skewness': 'negative' if results.mean_return < results.median_return else 'positive',
                'tail_risk': 'high' if abs(results.cvar_99) > 2 * results.std_return else 'moderate',
            }
        }