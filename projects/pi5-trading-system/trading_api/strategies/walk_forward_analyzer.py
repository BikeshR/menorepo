"""
Walk-Forward Analysis Engine for Pi5 Trading System.

Advanced walk-forward analysis framework for robust strategy testing and
parameter optimization with temporal validation and performance decay analysis.

Features:
- Anchored and rolling walk-forward analysis
- Multi-period optimization and testing
- Parameter stability tracking over time
- Performance decay detection
- Adaptive parameter reoptimization
- Out-of-sample testing validation
- Robustness metrics calculation
- Strategy efficiency analysis
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
import pandas as pd
import json
from collections import defaultdict

from core.interfaces import BaseStrategy
from core.exceptions import AnalysisError
from backtesting.engine import BacktestingEngine
from .parameter_optimizer import ParameterOptimizer, ParameterRange, OptimizationMethod, ObjectiveType


logger = logging.getLogger(__name__)


class WalkForwardType(Enum):
    """Walk-forward analysis types."""
    ROLLING = "rolling"      # Rolling window optimization
    ANCHORED = "anchored"    # Expanding window from start
    SLIDING = "sliding"      # Sliding window with overlap


@dataclass
class WalkForwardPeriod:
    """Single walk-forward analysis period."""
    period_id: str
    optimization_start: datetime
    optimization_end: datetime
    testing_start: datetime
    testing_end: datetime
    optimal_parameters: Dict[str, Any]
    optimization_score: float
    testing_score: float
    metrics: Dict[str, float]
    trade_count: int
    parameter_stability: float = 0.0
    
    @property
    def optimization_days(self) -> int:
        """Number of optimization days."""
        return (self.optimization_end - self.optimization_start).days
    
    @property
    def testing_days(self) -> int:
        """Number of testing days."""
        return (self.testing_end - self.testing_start).days
    
    @property
    def efficiency_ratio(self) -> float:
        """Ratio of testing to optimization performance."""
        if self.optimization_score == 0:
            return 0.0
        return self.testing_score / self.optimization_score


@dataclass
class WalkForwardAnalysis:
    """Complete walk-forward analysis results."""
    analysis_id: str
    strategy_name: str
    wf_type: WalkForwardType
    periods: List[WalkForwardPeriod]
    overall_metrics: Dict[str, float]
    parameter_evolution: Dict[str, List[float]]
    stability_metrics: Dict[str, float]
    performance_decay: Dict[str, float]
    robustness_score: float
    efficiency_score: float
    recommendation: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def total_periods(self) -> int:
        """Total number of walk-forward periods."""
        return len(self.periods)
    
    @property
    def avg_efficiency_ratio(self) -> float:
        """Average efficiency ratio across periods."""
        ratios = [p.efficiency_ratio for p in self.periods if p.efficiency_ratio != 0]
        return np.mean(ratios) if ratios else 0.0
    
    @property
    def parameter_stability_score(self) -> float:
        """Overall parameter stability score."""
        if not self.stability_metrics:
            return 0.0
        return np.mean(list(self.stability_metrics.values()))


class WalkForwardAnalyzer:
    """
    Advanced walk-forward analysis engine.
    
    Performs comprehensive walk-forward analysis to validate strategy
    robustness and parameter stability over time.
    """
    
    def __init__(
        self,
        backtesting_engine: BacktestingEngine,
        parameter_optimizer: ParameterOptimizer,
        min_optimization_periods: int = 252,  # ~1 year
        min_testing_periods: int = 63,        # ~3 months
        max_parallel_jobs: int = 2,
        enable_parameter_tracking: bool = True,
        stability_threshold: float = 0.7,
    ):
        """
        Initialize walk-forward analyzer.
        
        Args:
            backtesting_engine: Backtesting engine for evaluation
            parameter_optimizer: Parameter optimizer for reoptimization
            min_optimization_periods: Minimum periods for optimization
            min_testing_periods: Minimum periods for testing
            max_parallel_jobs: Maximum parallel analysis jobs
            enable_parameter_tracking: Track parameter evolution
            stability_threshold: Threshold for parameter stability
        """
        self.backtesting_engine = backtesting_engine
        self.parameter_optimizer = parameter_optimizer
        self.min_optimization_periods = min_optimization_periods
        self.min_testing_periods = min_testing_periods
        self.max_parallel_jobs = max_parallel_jobs
        self.enable_parameter_tracking = enable_parameter_tracking
        self.stability_threshold = stability_threshold
        
        # Analysis state
        self._analysis_cache: Dict[str, WalkForwardAnalysis] = {}
        self._active_analyses: Dict[str, asyncio.Task] = {}
        self._analysis_history: List[WalkForwardAnalysis] = []
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def run_walk_forward_analysis(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        wf_type: WalkForwardType = WalkForwardType.ROLLING,
        optimization_window_days: int = 252,
        testing_window_days: int = 63,
        step_days: int = 63,
        optimization_method: OptimizationMethod = OptimizationMethod.BAYESIAN,
        objective: ObjectiveType = ObjectiveType.MAXIMIZE_SHARPE,
        initial_capital: float = 100000,
        reoptimization_frequency: int = 1,  # Reoptimize every N periods
    ) -> WalkForwardAnalysis:
        """
        Run comprehensive walk-forward analysis.
        
        Args:
            strategy_class: Strategy class to analyze
            parameter_ranges: Parameter ranges for optimization
            symbols: Symbols to analyze
            start_date: Analysis start date
            end_date: Analysis end date
            wf_type: Walk-forward analysis type
            optimization_window_days: Optimization window size
            testing_window_days: Testing window size
            step_days: Step size between periods
            optimization_method: Optimization method to use
            objective: Optimization objective
            initial_capital: Initial capital for backtesting
            reoptimization_frequency: How often to reoptimize
            
        Returns:
            Complete walk-forward analysis results
        """
        try:
            analysis_id = f"wf_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            self._logger.info(
                f"Starting walk-forward analysis {analysis_id} for {strategy_class.__name__}"
            )
            
            # Validate inputs
            await self._validate_analysis_inputs(
                strategy_class, parameter_ranges, symbols, start_date, end_date,
                optimization_window_days, testing_window_days
            )
            
            # Generate walk-forward periods
            periods_config = self._generate_walk_forward_periods(
                start_date, end_date, wf_type, optimization_window_days,
                testing_window_days, step_days
            )
            
            self._logger.info(f"Generated {len(periods_config)} walk-forward periods")
            
            # Run analysis for each period
            analysis_periods = []
            last_optimal_params = None
            
            for i, (opt_start, opt_end, test_start, test_end) in enumerate(periods_config):
                period_id = f"{analysis_id}_period_{i+1}"
                
                # Determine if we need to reoptimize
                should_reoptimize = (
                    last_optimal_params is None or
                    i % reoptimization_frequency == 0
                )
                
                if should_reoptimize:
                    # Run optimization
                    self._logger.info(f"Optimizing parameters for period {i+1}")
                    optimal_params = await self._optimize_period_parameters(
                        strategy_class, parameter_ranges, symbols, opt_start, opt_end,
                        optimization_method, objective, initial_capital
                    )
                    last_optimal_params = optimal_params
                else:
                    # Use previous parameters
                    optimal_params = last_optimal_params.copy()
                    self._logger.info(f"Reusing parameters for period {i+1}")
                
                # Test with optimal parameters
                testing_results = await self._test_period_parameters(
                    strategy_class, optimal_params, symbols, test_start, test_end, initial_capital
                )
                
                # Calculate optimization score (for comparison)
                optimization_results = await self._test_period_parameters(
                    strategy_class, optimal_params, symbols, opt_start, opt_end, initial_capital
                )
                
                # Calculate parameter stability
                stability = 0.0
                if analysis_periods and self.enable_parameter_tracking:
                    prev_params = analysis_periods[-1].optimal_parameters
                    stability = self._calculate_parameter_stability(optimal_params, prev_params)
                
                # Create period result
                period = WalkForwardPeriod(
                    period_id=period_id,
                    optimization_start=opt_start,
                    optimization_end=opt_end,
                    testing_start=test_start,
                    testing_end=test_end,
                    optimal_parameters=optimal_params,
                    optimization_score=optimization_results.get('sharpe_ratio', 0.0),
                    testing_score=testing_results.get('sharpe_ratio', 0.0),
                    metrics=testing_results,
                    trade_count=testing_results.get('trade_count', 0),
                    parameter_stability=stability
                )
                
                analysis_periods.append(period)
                
                self._logger.info(
                    f"Period {i+1} completed - Testing Sharpe: {period.testing_score:.3f}, "
                    f"Efficiency: {period.efficiency_ratio:.3f}"
                )
            
            # Calculate comprehensive analysis metrics
            overall_metrics = self._calculate_overall_metrics(analysis_periods)
            parameter_evolution = self._track_parameter_evolution(analysis_periods)
            stability_metrics = self._calculate_stability_metrics(analysis_periods)
            performance_decay = self._analyze_performance_decay(analysis_periods)
            robustness_score = self._calculate_robustness_score(analysis_periods)
            efficiency_score = self._calculate_efficiency_score(analysis_periods)
            recommendation = self._generate_recommendation(
                analysis_periods, robustness_score, efficiency_score
            )
            
            # Create complete analysis
            analysis = WalkForwardAnalysis(
                analysis_id=analysis_id,
                strategy_name=strategy_class.__name__,
                wf_type=wf_type,
                periods=analysis_periods,
                overall_metrics=overall_metrics,
                parameter_evolution=parameter_evolution,
                stability_metrics=stability_metrics,
                performance_decay=performance_decay,
                robustness_score=robustness_score,
                efficiency_score=efficiency_score,
                recommendation=recommendation
            )
            
            # Store results
            self._analysis_cache[analysis_id] = analysis
            self._analysis_history.append(analysis)
            
            self._logger.info(
                f"Walk-forward analysis {analysis_id} completed. "
                f"Robustness: {robustness_score:.3f}, Efficiency: {efficiency_score:.3f}"
            )
            
            return analysis
            
        except Exception as e:
            self._logger.error(f"Error in walk-forward analysis: {e}")
            raise AnalysisError(f"Walk-forward analysis failed: {e}") from e
    
    async def _validate_analysis_inputs(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        optimization_window_days: int,
        testing_window_days: int
    ) -> None:
        """Validate walk-forward analysis inputs."""
        if not issubclass(strategy_class, BaseStrategy):
            raise AnalysisError("strategy_class must be a BaseStrategy subclass")
        
        if not parameter_ranges:
            raise AnalysisError("parameter_ranges cannot be empty")
        
        if not symbols:
            raise AnalysisError("symbols cannot be empty")
        
        if start_date >= end_date:
            raise AnalysisError("start_date must be before end_date")
        
        total_days = (end_date - start_date).days
        min_required_days = optimization_window_days + testing_window_days
        
        if total_days < min_required_days:
            raise AnalysisError(
                f"Date range too short. Need at least {min_required_days} days, "
                f"got {total_days} days"
            )
    
    def _generate_walk_forward_periods(
        self,
        start_date: datetime,
        end_date: datetime,
        wf_type: WalkForwardType,
        optimization_window_days: int,
        testing_window_days: int,
        step_days: int
    ) -> List[Tuple[datetime, datetime, datetime, datetime]]:
        """Generate walk-forward period configurations."""
        periods = []
        current_date = start_date
        
        while True:
            # Calculate optimization period
            if wf_type == WalkForwardType.ANCHORED:
                opt_start = start_date
                opt_end = current_date + timedelta(days=optimization_window_days)
            else:  # ROLLING or SLIDING
                opt_start = current_date
                opt_end = current_date + timedelta(days=optimization_window_days)
            
            # Calculate testing period
            test_start = opt_end
            test_end = test_start + timedelta(days=testing_window_days)
            
            # Check if we have enough data
            if test_end > end_date:
                break
            
            periods.append((opt_start, opt_end, test_start, test_end))
            
            # Move to next period
            current_date += timedelta(days=step_days)
            
            # For anchored, we expand the optimization window
            if wf_type == WalkForwardType.ANCHORED:
                optimization_window_days += step_days
        
        return periods
    
    async def _optimize_period_parameters(
        self,
        strategy_class: type,
        parameter_ranges: List[ParameterRange],
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        optimization_method: OptimizationMethod,
        objective: ObjectiveType,
        initial_capital: float
    ) -> Dict[str, Any]:
        """Optimize parameters for a specific period."""
        try:
            # Run parameter optimization
            optimization_report = await self.parameter_optimizer.optimize_parameters(
                strategy_class=strategy_class,
                parameter_ranges=parameter_ranges,
                optimization_method=optimization_method,
                objective=objective,
                max_iterations=50,  # Reduced for walk-forward efficiency
                symbols=symbols,
                start_date=start_date,
                end_date=end_date,
                initial_capital=initial_capital
            )
            
            return optimization_report.best_result.parameters
            
        except Exception as e:
            self._logger.error(f"Error optimizing period parameters: {e}")
            # Return default parameters
            return {param_range.name: param_range.min_value for param_range in parameter_ranges}
    
    async def _test_period_parameters(
        self,
        strategy_class: type,
        parameters: Dict[str, Any],
        symbols: List[str],
        start_date: datetime,
        end_date: datetime,
        initial_capital: float
    ) -> Dict[str, float]:
        """Test parameters on a specific period."""
        try:
            # Create strategy with parameters
            strategy = strategy_class(
                name=f"WFTest_{id(parameters)}",
                parameters=parameters
            )
            
            # Run backtest
            backtest_results = await self.backtesting_engine.run_backtest(
                strategy=strategy,
                symbols=symbols,
                start_date=start_date,
                end_date=end_date,
                initial_capital=initial_capital
            )
            
            # Extract metrics
            portfolio_stats = backtest_results.get('portfolio_stats', {})
            
            return {
                'total_return': portfolio_stats.get('total_return', 0.0),
                'annualized_return': portfolio_stats.get('annualized_return', 0.0),
                'sharpe_ratio': portfolio_stats.get('sharpe_ratio', 0.0),
                'sortino_ratio': portfolio_stats.get('sortino_ratio', 0.0),
                'max_drawdown': portfolio_stats.get('max_drawdown', 0.0),
                'volatility': portfolio_stats.get('volatility', 0.0),
                'win_rate': portfolio_stats.get('win_rate', 0.0),
                'profit_factor': portfolio_stats.get('profit_factor', 0.0),
                'trade_count': portfolio_stats.get('trade_count', 0),
                'avg_trade_return': portfolio_stats.get('avg_trade_return', 0.0),
            }
            
        except Exception as e:
            self._logger.error(f"Error testing period parameters: {e}")
            return {
                'total_return': 0.0,
                'sharpe_ratio': 0.0,
                'max_drawdown': 0.0,
                'trade_count': 0,
            }
    
    def _calculate_parameter_stability(
        self,
        current_params: Dict[str, Any],
        previous_params: Dict[str, Any]
    ) -> float:
        """Calculate parameter stability between periods."""
        try:
            if not current_params or not previous_params:
                return 0.0
            
            stability_scores = []
            
            for param_name in current_params:
                if param_name in previous_params:
                    current_val = current_params[param_name]
                    previous_val = previous_params[param_name]
                    
                    if isinstance(current_val, (int, float)) and isinstance(previous_val, (int, float)):
                        if previous_val != 0:
                            # Calculate relative change
                            relative_change = abs(current_val - previous_val) / abs(previous_val)
                            # Convert to stability score (0-1, where 1 is perfectly stable)
                            stability = max(0.0, 1.0 - relative_change)
                            stability_scores.append(stability)
                        else:
                            stability_scores.append(1.0 if current_val == 0 else 0.0)
                    else:
                        # For non-numeric parameters
                        stability_scores.append(1.0 if current_val == previous_val else 0.0)
            
            return np.mean(stability_scores) if stability_scores else 0.0
            
        except Exception as e:
            self._logger.error(f"Error calculating parameter stability: {e}")
            return 0.0
    
    def _calculate_overall_metrics(self, periods: List[WalkForwardPeriod]) -> Dict[str, float]:
        """Calculate overall walk-forward metrics."""
        if not periods:
            return {}
        
        # Aggregate metrics across all periods
        total_return = np.prod([1 + p.metrics.get('total_return', 0) for p in periods]) - 1
        avg_sharpe = np.mean([p.testing_score for p in periods])
        max_drawdown = max([p.metrics.get('max_drawdown', 0) for p in periods])
        avg_efficiency = np.mean([p.efficiency_ratio for p in periods if p.efficiency_ratio != 0])
        win_rate = np.mean([p.metrics.get('win_rate', 0) for p in periods])
        total_trades = sum([p.trade_count for p in periods])
        
        # Consistency metrics
        sharpe_std = np.std([p.testing_score for p in periods])
        efficiency_std = np.std([p.efficiency_ratio for p in periods if p.efficiency_ratio != 0])
        
        return {
            'total_return': total_return,
            'avg_sharpe_ratio': avg_sharpe,
            'sharpe_consistency': 1.0 - (sharpe_std / abs(avg_sharpe)) if avg_sharpe != 0 else 0.0,
            'max_drawdown': max_drawdown,
            'avg_efficiency_ratio': avg_efficiency,
            'efficiency_consistency': 1.0 - (efficiency_std / avg_efficiency) if avg_efficiency != 0 else 0.0,
            'win_rate': win_rate,
            'total_trades': total_trades,
            'avg_trades_per_period': total_trades / len(periods) if periods else 0,
        }
    
    def _track_parameter_evolution(self, periods: List[WalkForwardPeriod]) -> Dict[str, List[float]]:
        """Track parameter evolution over time."""
        if not periods or not self.enable_parameter_tracking:
            return {}
        
        evolution = defaultdict(list)
        
        for period in periods:
            for param_name, param_value in period.optimal_parameters.items():
                if isinstance(param_value, (int, float)):
                    evolution[param_name].append(param_value)
                else:
                    # For non-numeric parameters, could track as categorical
                    pass
        
        return dict(evolution)
    
    def _calculate_stability_metrics(self, periods: List[WalkForwardPeriod]) -> Dict[str, float]:
        """Calculate parameter stability metrics."""
        if len(periods) < 2:
            return {}
        
        stability_metrics = {}
        
        # Overall parameter stability
        stabilities = [p.parameter_stability for p in periods[1:]]  # Skip first period
        stability_metrics['avg_parameter_stability'] = np.mean(stabilities) if stabilities else 0.0
        stability_metrics['parameter_stability_trend'] = self._calculate_trend(stabilities)
        
        # Performance stability
        testing_scores = [p.testing_score for p in periods]
        stability_metrics['performance_stability'] = 1.0 - (np.std(testing_scores) / abs(np.mean(testing_scores))) if np.mean(testing_scores) != 0 else 0.0
        
        # Efficiency stability
        efficiency_ratios = [p.efficiency_ratio for p in periods if p.efficiency_ratio != 0]
        if efficiency_ratios:
            stability_metrics['efficiency_stability'] = 1.0 - (np.std(efficiency_ratios) / np.mean(efficiency_ratios))
        else:
            stability_metrics['efficiency_stability'] = 0.0
        
        return stability_metrics
    
    def _analyze_performance_decay(self, periods: List[WalkForwardPeriod]) -> Dict[str, float]:
        """Analyze performance decay over time."""
        if len(periods) < 3:
            return {}
        
        # Calculate trends
        testing_scores = [p.testing_score for p in periods]
        efficiency_ratios = [p.efficiency_ratio for p in periods if p.efficiency_ratio != 0]
        
        decay_metrics = {
            'performance_trend': self._calculate_trend(testing_scores),
            'efficiency_trend': self._calculate_trend(efficiency_ratios) if efficiency_ratios else 0.0,
            'early_vs_late_performance': self._compare_early_late_performance(testing_scores),
            'decay_severity': self._calculate_decay_severity(testing_scores),
        }
        
        return decay_metrics
    
    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate trend coefficient (-1 to 1)."""
        if len(values) < 2:
            return 0.0
        
        x = np.arange(len(values))
        correlation = np.corrcoef(x, values)[0, 1]
        return correlation if not np.isnan(correlation) else 0.0
    
    def _compare_early_late_performance(self, values: List[float]) -> float:
        """Compare early vs late performance."""
        if len(values) < 4:
            return 0.0
        
        split_point = len(values) // 2
        early_avg = np.mean(values[:split_point])
        late_avg = np.mean(values[split_point:])
        
        if early_avg == 0:
            return 0.0
        
        return (late_avg - early_avg) / abs(early_avg)
    
    def _calculate_decay_severity(self, values: List[float]) -> float:
        """Calculate performance decay severity."""
        if len(values) < 3:
            return 0.0
        
        # Find peak performance and subsequent decay
        peak_value = max(values)
        peak_index = values.index(peak_value)
        
        if peak_index == len(values) - 1:
            return 0.0  # Peak is at the end
        
        # Calculate average performance after peak
        post_peak_values = values[peak_index + 1:]
        avg_post_peak = np.mean(post_peak_values)
        
        if peak_value == 0:
            return 0.0
        
        decay = (peak_value - avg_post_peak) / abs(peak_value)
        return max(0.0, decay)  # Only positive decay
    
    def _calculate_robustness_score(self, periods: List[WalkForwardPeriod]) -> float:
        """Calculate overall robustness score."""
        if not periods:
            return 0.0
        
        scores = []
        
        # Performance consistency (0-1)
        testing_scores = [p.testing_score for p in periods]
        positive_periods = len([s for s in testing_scores if s > 0])
        consistency_score = positive_periods / len(periods)
        scores.append(consistency_score)
        
        # Parameter stability (0-1)
        if len(periods) > 1:
            stabilities = [p.parameter_stability for p in periods[1:]]
            stability_score = np.mean(stabilities) if stabilities else 0.0
            scores.append(stability_score)
        
        # Efficiency consistency (0-1)
        efficiency_ratios = [p.efficiency_ratio for p in periods if p.efficiency_ratio != 0]
        if efficiency_ratios:
            avg_efficiency = np.mean(efficiency_ratios)
            efficiency_score = min(1.0, avg_efficiency) if avg_efficiency > 0 else 0.0
            scores.append(efficiency_score)
        
        # Trade frequency consistency
        trade_counts = [p.trade_count for p in periods]
        non_zero_trades = len([tc for tc in trade_counts if tc > 0])
        trade_consistency = non_zero_trades / len(periods)
        scores.append(trade_consistency)
        
        return np.mean(scores)
    
    def _calculate_efficiency_score(self, periods: List[WalkForwardPeriod]) -> float:
        """Calculate overall efficiency score."""
        if not periods:
            return 0.0
        
        efficiency_ratios = [p.efficiency_ratio for p in periods if p.efficiency_ratio != 0]
        
        if not efficiency_ratios:
            return 0.0
        
        # Calculate metrics
        avg_efficiency = np.mean(efficiency_ratios)
        min_efficiency = min(efficiency_ratios)
        efficiency_consistency = 1.0 - (np.std(efficiency_ratios) / avg_efficiency) if avg_efficiency != 0 else 0.0
        
        # Combined score
        efficiency_score = (
            min(1.0, avg_efficiency) * 0.5 +         # Average efficiency (capped at 1.0)
            min(1.0, max(0.0, min_efficiency)) * 0.3 +  # Minimum efficiency
            efficiency_consistency * 0.2              # Consistency
        )
        
        return efficiency_score
    
    def _generate_recommendation(
        self,
        periods: List[WalkForwardPeriod],
        robustness_score: float,
        efficiency_score: float
    ) -> str:
        """Generate strategy recommendation based on walk-forward results."""
        try:
            recommendations = []
            
            # Overall assessment
            if robustness_score >= 0.8 and efficiency_score >= 0.8:
                recommendations.append("EXCELLENT: Strategy shows strong robustness and efficiency.")
            elif robustness_score >= 0.6 and efficiency_score >= 0.6:
                recommendations.append("GOOD: Strategy demonstrates reasonable robustness and efficiency.")
            elif robustness_score >= 0.4 or efficiency_score >= 0.4:
                recommendations.append("MODERATE: Strategy shows mixed results. Consider parameter refinement.")
            else:
                recommendations.append("POOR: Strategy lacks robustness and efficiency. Significant revision needed.")
            
            # Specific issues and recommendations
            if efficiency_score < 0.5:
                recommendations.append("WARNING: Low efficiency ratio indicates potential overfitting.")
            
            if robustness_score < 0.5:
                recommendations.append("WARNING: Low robustness suggests parameter instability.")
            
            # Parameter stability
            if len(periods) > 1:
                avg_stability = np.mean([p.parameter_stability for p in periods[1:]])
                if avg_stability < self.stability_threshold:
                    recommendations.append("CONCERN: Parameter instability detected. Consider wider parameter ranges.")
            
            # Trade frequency
            avg_trades = np.mean([p.trade_count for p in periods])
            if avg_trades < 5:
                recommendations.append("INFO: Low trade frequency may limit statistical significance.")
            
            # Performance trend
            testing_scores = [p.testing_score for p in periods]
            trend = self._calculate_trend(testing_scores)
            if trend < -0.3:
                recommendations.append("WARNING: Declining performance trend detected.")
            elif trend > 0.3:
                recommendations.append("POSITIVE: Improving performance trend observed.")
            
            return " ".join(recommendations)
            
        except Exception as e:
            self._logger.error(f"Error generating recommendation: {e}")
            return "Unable to generate recommendation due to analysis error."
    
    def get_analysis_results(self, analysis_id: str) -> Optional[WalkForwardAnalysis]:
        """Get walk-forward analysis results by ID."""
        return self._analysis_cache.get(analysis_id)
    
    def get_analysis_history(self) -> List[WalkForwardAnalysis]:
        """Get all analysis history."""
        return self._analysis_history.copy()
    
    def export_analysis_report(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Export walk-forward analysis report."""
        try:
            analysis = self._analysis_cache.get(analysis_id)
            if not analysis:
                return None
            
            # Convert to serializable format
            report = {
                'analysis_id': analysis.analysis_id,
                'strategy_name': analysis.strategy_name,
                'wf_type': analysis.wf_type.value,
                'timestamp': analysis.timestamp.isoformat(),
                'total_periods': analysis.total_periods,
                'overall_metrics': analysis.overall_metrics,
                'stability_metrics': analysis.stability_metrics,
                'performance_decay': analysis.performance_decay,
                'robustness_score': analysis.robustness_score,
                'efficiency_score': analysis.efficiency_score,
                'avg_efficiency_ratio': analysis.avg_efficiency_ratio,
                'parameter_stability_score': analysis.parameter_stability_score,
                'recommendation': analysis.recommendation,
                'periods': [
                    {
                        'period_id': p.period_id,
                        'optimization_days': p.optimization_days,
                        'testing_days': p.testing_days,
                        'optimization_score': p.optimization_score,
                        'testing_score': p.testing_score,
                        'efficiency_ratio': p.efficiency_ratio,
                        'parameter_stability': p.parameter_stability,
                        'trade_count': p.trade_count,
                        'optimal_parameters': p.optimal_parameters,
                        'key_metrics': {
                            'total_return': p.metrics.get('total_return', 0),
                            'sharpe_ratio': p.metrics.get('sharpe_ratio', 0),
                            'max_drawdown': p.metrics.get('max_drawdown', 0),
                            'win_rate': p.metrics.get('win_rate', 0),
                        }
                    }
                    for p in analysis.periods
                ],
                'parameter_evolution': analysis.parameter_evolution,
            }
            
            return report
            
        except Exception as e:
            self._logger.error(f"Error exporting analysis report: {e}")
            return None
    
    def compare_analyses(self, analysis_ids: List[str]) -> Dict[str, Any]:
        """Compare multiple walk-forward analyses."""
        try:
            analyses = []
            for analysis_id in analysis_ids:
                analysis = self._analysis_cache.get(analysis_id)
                if analysis:
                    analyses.append(analysis)
            
            if len(analyses) < 2:
                return {'error': 'Need at least 2 analyses for comparison'}
            
            comparison = {
                'analyses_count': len(analyses),
                'comparison_metrics': {},
                'rankings': {},
                'summary': {}
            }
            
            # Compare key metrics
            metrics_to_compare = [
                'robustness_score', 'efficiency_score', 'avg_efficiency_ratio',
                'parameter_stability_score'
            ]
            
            for metric in metrics_to_compare:
                values = []
                for analysis in analyses:
                    if hasattr(analysis, metric):
                        values.append(getattr(analysis, metric))
                    else:
                        values.append(analysis.overall_metrics.get(metric, 0))
                
                comparison['comparison_metrics'][metric] = {
                    'values': values,
                    'best_index': int(np.argmax(values)) if values else 0,
                    'worst_index': int(np.argmin(values)) if values else 0,
                    'spread': max(values) - min(values) if values else 0,
                }
            
            # Overall ranking
            scores = []
            for analysis in analyses:
                score = (
                    analysis.robustness_score * 0.4 +
                    analysis.efficiency_score * 0.3 +
                    analysis.parameter_stability_score * 0.3
                )
                scores.append(score)
            
            rankings = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
            comparison['rankings'] = {
                'overall': [{'analysis_id': analyses[i].analysis_id, 'score': score} 
                           for i, score in rankings]
            }
            
            return comparison
            
        except Exception as e:
            self._logger.error(f"Error comparing analyses: {e}")
            return {'error': f'Comparison failed: {e}'}