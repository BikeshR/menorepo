"""
Strategy Correlation Analysis System for Pi5 Trading System.

Advanced correlation analysis framework for understanding relationships between
trading strategies, managing strategy portfolio risk, and optimizing allocation.

Features:
- Strategy performance correlation analysis
- Signal correlation and timing analysis
- Drawdown correlation monitoring
- Dynamic correlation tracking over time
- Portfolio diversification optimization
- Risk contribution analysis per strategy
- Strategy clustering and grouping
- Correlation-based position sizing
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict, deque
import numpy as np
import pandas as pd
from scipy import stats
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import squareform
import json

from core.interfaces import Signal, TradingSignal
from core.exceptions import AnalysisError


logger = logging.getLogger(__name__)


@dataclass
class StrategyPerformance:
    """Performance data for a strategy."""
    strategy_name: str
    returns: List[float] = field(default_factory=list)
    signals: List[Tuple[datetime, Signal]] = field(default_factory=list)
    trades: List[Dict[str, Any]] = field(default_factory=list)
    drawdowns: List[float] = field(default_factory=list)
    timestamps: List[datetime] = field(default_factory=list)
    
    def add_return(self, return_value: float, timestamp: datetime) -> None:
        """Add a return observation."""
        self.returns.append(return_value)
        self.timestamps.append(timestamp)
        
        # Calculate running drawdown
        if len(self.returns) > 1:
            cumulative_returns = np.cumprod(1 + np.array(self.returns))
            running_max = np.maximum.accumulate(cumulative_returns)
            drawdown = (cumulative_returns - running_max) / running_max
            self.drawdowns.append(drawdown[-1])
        else:
            self.drawdowns.append(0.0)
    
    def add_signal(self, signal: Signal, timestamp: datetime) -> None:
        """Add a signal observation."""
        self.signals.append((timestamp, signal))
    
    def get_recent_returns(self, periods: int) -> List[float]:
        """Get recent returns."""
        return self.returns[-periods:] if len(self.returns) >= periods else self.returns
    
    def get_recent_drawdowns(self, periods: int) -> List[float]:
        """Get recent drawdowns."""
        return self.drawdowns[-periods:] if len(self.drawdowns) >= periods else self.drawdowns


@dataclass
class CorrelationMetrics:
    """Correlation metrics between strategies."""
    strategy_a: str
    strategy_b: str
    returns_correlation: float
    signal_correlation: float
    drawdown_correlation: float
    timing_correlation: float
    overall_correlation: float
    correlation_stability: float
    sample_size: int
    last_updated: datetime
    
    @property
    def is_highly_correlated(self) -> bool:
        """Check if strategies are highly correlated."""
        return abs(self.overall_correlation) > 0.7
    
    @property
    def diversification_benefit(self) -> float:
        """Calculate diversification benefit (0-1, higher is better)."""
        return max(0.0, 1.0 - abs(self.overall_correlation))


@dataclass
class StrategyCluster:
    """Cluster of correlated strategies."""
    cluster_id: int
    strategies: List[str]
    avg_correlation: float
    cluster_performance: Dict[str, float]
    risk_contribution: float
    recommended_allocation: Dict[str, float]
    
    def add_strategy(self, strategy_name: str) -> None:
        """Add strategy to cluster."""
        if strategy_name not in self.strategies:
            self.strategies.append(strategy_name)
    
    def remove_strategy(self, strategy_name: str) -> None:
        """Remove strategy from cluster."""
        if strategy_name in self.strategies:
            self.strategies.remove(strategy_name)


class StrategyCorrelationAnalyzer:
    """
    Advanced strategy correlation analysis system.
    
    Analyzes correlations between trading strategies to optimize portfolio
    allocation and manage concentration risk.
    """
    
    def __init__(
        self,
        lookback_periods: int = 252,  # ~1 year of daily data
        min_correlation_periods: int = 30,
        correlation_threshold: float = 0.7,
        update_frequency_minutes: int = 60,
        enable_clustering: bool = True,
        cluster_threshold: float = 0.6,
    ):
        """
        Initialize strategy correlation analyzer.
        
        Args:
            lookback_periods: Number of periods for correlation calculation
            min_correlation_periods: Minimum periods needed for valid correlation
            correlation_threshold: Threshold for high correlation warning
            update_frequency_minutes: How often to update correlations
            enable_clustering: Enable strategy clustering
            cluster_threshold: Correlation threshold for clustering
        """
        self.lookback_periods = lookback_periods
        self.min_correlation_periods = min_correlation_periods
        self.correlation_threshold = correlation_threshold
        self.update_frequency_minutes = update_frequency_minutes
        self.enable_clustering = enable_clustering
        self.cluster_threshold = cluster_threshold
        
        # Strategy performance tracking
        self._strategy_performance: Dict[str, StrategyPerformance] = {}
        self._correlation_matrix: Dict[Tuple[str, str], CorrelationMetrics] = {}
        self._correlation_history: Dict[Tuple[str, str], List[Tuple[datetime, float]]] = defaultdict(list)
        
        # Clustering and portfolio optimization
        self._strategy_clusters: Dict[int, StrategyCluster] = {}
        self._cluster_assignments: Dict[str, int] = {}
        self._optimal_weights: Dict[str, float] = {}
        
        # Analysis state
        self._last_update = None
        self._is_running = False
        self._update_task: Optional[asyncio.Task] = None
        
        # Rolling windows for efficient calculation
        self._rolling_windows: Dict[str, deque] = {}
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the correlation analyzer."""
        if self._is_running:
            return
        
        self._logger.info("Starting strategy correlation analyzer...")
        self._is_running = True
        
        # Start background update task
        self._update_task = asyncio.create_task(self._periodic_update())
        
        self._logger.info("Strategy correlation analyzer started")
    
    async def stop(self) -> None:
        """Stop the correlation analyzer."""
        if not self._is_running:
            return
        
        self._logger.info("Stopping strategy correlation analyzer...")
        self._is_running = False
        
        # Stop background task
        if self._update_task and not self._update_task.done():
            self._update_task.cancel()
        
        self._logger.info("Strategy correlation analyzer stopped")
    
    def add_strategy_return(
        self, 
        strategy_name: str, 
        return_value: float, 
        timestamp: datetime = None
    ) -> None:
        """Add a return observation for a strategy."""
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        # Initialize strategy if not exists
        if strategy_name not in self._strategy_performance:
            self._strategy_performance[strategy_name] = StrategyPerformance(strategy_name)
            self._rolling_windows[strategy_name] = deque(maxlen=self.lookback_periods)
        
        # Add return
        self._strategy_performance[strategy_name].add_return(return_value, timestamp)
        self._rolling_windows[strategy_name].append((timestamp, return_value))
        
        # Trigger correlation update if needed
        if self._should_update():
            asyncio.create_task(self._update_correlations())
    
    def add_strategy_signal(
        self, 
        strategy_name: str, 
        signal: Signal, 
        timestamp: datetime = None
    ) -> None:
        """Add a signal observation for a strategy."""
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        # Initialize strategy if not exists
        if strategy_name not in self._strategy_performance:
            self._strategy_performance[strategy_name] = StrategyPerformance(strategy_name)
        
        # Add signal
        self._strategy_performance[strategy_name].add_signal(signal, timestamp)
    
    def add_strategy_trade(
        self, 
        strategy_name: str, 
        trade_data: Dict[str, Any], 
        timestamp: datetime = None
    ) -> None:
        """Add a trade observation for a strategy."""
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        # Initialize strategy if not exists
        if strategy_name not in self._strategy_performance:
            self._strategy_performance[strategy_name] = StrategyPerformance(strategy_name)
        
        # Add trade
        trade_data['timestamp'] = timestamp
        self._strategy_performance[strategy_name].trades.append(trade_data)
    
    def get_correlation(self, strategy_a: str, strategy_b: str) -> Optional[CorrelationMetrics]:
        """Get correlation metrics between two strategies."""
        key = tuple(sorted([strategy_a, strategy_b]))
        return self._correlation_matrix.get(key)
    
    def get_correlation_matrix(self) -> pd.DataFrame:
        """Get full correlation matrix as DataFrame."""
        strategies = list(self._strategy_performance.keys())
        if len(strategies) < 2:
            return pd.DataFrame()
        
        matrix = np.ones((len(strategies), len(strategies)))
        
        for i, strategy_a in enumerate(strategies):
            for j, strategy_b in enumerate(strategies):
                if i != j:
                    correlation = self.get_correlation(strategy_a, strategy_b)
                    if correlation:
                        matrix[i][j] = correlation.overall_correlation
        
        return pd.DataFrame(matrix, index=strategies, columns=strategies)
    
    def get_highly_correlated_pairs(self) -> List[Tuple[str, str, float]]:
        """Get pairs of strategies with high correlation."""
        high_corr_pairs = []
        
        for (strategy_a, strategy_b), metrics in self._correlation_matrix.items():
            if metrics.is_highly_correlated:
                high_corr_pairs.append((strategy_a, strategy_b, metrics.overall_correlation))
        
        # Sort by correlation strength
        high_corr_pairs.sort(key=lambda x: abs(x[2]), reverse=True)
        return high_corr_pairs
    
    def get_diversification_score(self) -> float:
        """Calculate overall portfolio diversification score."""
        if len(self._strategy_performance) < 2:
            return 1.0
        
        correlations = [
            abs(metrics.overall_correlation) 
            for metrics in self._correlation_matrix.values()
        ]
        
        if not correlations:
            return 1.0
        
        avg_correlation = np.mean(correlations)
        return max(0.0, 1.0 - avg_correlation)
    
    def get_strategy_clusters(self) -> Dict[int, StrategyCluster]:
        """Get strategy clusters."""
        return self._strategy_clusters.copy()
    
    def get_optimal_allocation(self) -> Dict[str, float]:
        """Get optimal strategy allocation weights."""
        return self._optimal_weights.copy()
    
    def get_risk_contribution(self, strategy_name: str) -> float:
        """Get risk contribution of a strategy to portfolio."""
        if strategy_name not in self._strategy_performance:
            return 0.0
        
        # Calculate based on correlations with other strategies
        total_correlation = 0.0
        correlation_count = 0
        
        for (strat_a, strat_b), metrics in self._correlation_matrix.items():
            if strategy_name in [strat_a, strat_b]:
                total_correlation += abs(metrics.overall_correlation)
                correlation_count += 1
        
        if correlation_count == 0:
            return 0.0
        
        avg_correlation = total_correlation / correlation_count
        return avg_correlation
    
    def get_analyzer_status(self) -> Dict[str, Any]:
        """Get comprehensive analyzer status."""
        return {
            'is_running': self._is_running,
            'total_strategies': len(self._strategy_performance),
            'correlation_pairs': len(self._correlation_matrix),
            'highly_correlated_pairs': len(self.get_highly_correlated_pairs()),
            'diversification_score': self.get_diversification_score(),
            'clusters': len(self._strategy_clusters),
            'last_update': self._last_update.isoformat() if self._last_update else None,
            'configuration': {
                'lookback_periods': self.lookback_periods,
                'correlation_threshold': self.correlation_threshold,
                'clustering_enabled': self.enable_clustering,
                'update_frequency_minutes': self.update_frequency_minutes,
            }
        }
    
    # Private methods
    
    async def _periodic_update(self) -> None:
        """Periodic correlation update task."""
        while self._is_running:
            try:
                await asyncio.sleep(self.update_frequency_minutes * 60)
                await self._update_correlations()
                
                if self.enable_clustering:
                    await self._update_clusters()
                
                await self._optimize_allocation()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Error in periodic update: {e}")
    
    def _should_update(self) -> bool:
        """Check if correlations should be updated."""
        if self._last_update is None:
            return True
        
        time_diff = datetime.utcnow() - self._last_update
        return time_diff.total_seconds() > (self.update_frequency_minutes * 60)
    
    async def _update_correlations(self) -> None:
        """Update all pairwise correlations."""
        try:
            strategies = list(self._strategy_performance.keys())
            
            if len(strategies) < 2:
                return
            
            # Calculate correlations for all pairs
            for i, strategy_a in enumerate(strategies):
                for j, strategy_b in enumerate(strategies[i+1:], i+1):
                    correlation = await self._calculate_correlation(strategy_a, strategy_b)
                    if correlation:
                        key = tuple(sorted([strategy_a, strategy_b]))
                        self._correlation_matrix[key] = correlation
                        
                        # Update correlation history
                        self._correlation_history[key].append(
                            (datetime.utcnow(), correlation.overall_correlation)
                        )
                        
                        # Keep history limited
                        if len(self._correlation_history[key]) > 1000:
                            self._correlation_history[key] = self._correlation_history[key][-500:]
            
            self._last_update = datetime.utcnow()
            self._logger.info(f"Updated {len(self._correlation_matrix)} correlation pairs")
            
        except Exception as e:
            self._logger.error(f"Error updating correlations: {e}")
    
    async def _calculate_correlation(
        self, 
        strategy_a: str, 
        strategy_b: str
    ) -> Optional[CorrelationMetrics]:
        """Calculate correlation metrics between two strategies."""
        try:
            perf_a = self._strategy_performance[strategy_a]
            perf_b = self._strategy_performance[strategy_b]
            
            # Need minimum data points
            min_periods = min(
                len(perf_a.returns), 
                len(perf_b.returns),
                self.min_correlation_periods
            )
            
            if min_periods < self.min_correlation_periods:
                return None
            
            # Align data by timestamp (simplified - assumes same frequency)
            returns_a = perf_a.get_recent_returns(min_periods)
            returns_b = perf_b.get_recent_returns(min_periods)
            
            # Calculate returns correlation
            returns_corr = np.corrcoef(returns_a, returns_b)[0, 1] if len(returns_a) > 1 else 0.0
            
            # Calculate drawdown correlation
            drawdowns_a = perf_a.get_recent_drawdowns(min_periods)
            drawdowns_b = perf_b.get_recent_drawdowns(min_periods)
            drawdown_corr = np.corrcoef(drawdowns_a, drawdowns_b)[0, 1] if len(drawdowns_a) > 1 else 0.0
            
            # Calculate signal correlation
            signal_corr = await self._calculate_signal_correlation(perf_a, perf_b)
            
            # Calculate timing correlation
            timing_corr = await self._calculate_timing_correlation(perf_a, perf_b)
            
            # Calculate overall correlation (weighted average)
            overall_corr = (
                returns_corr * 0.4 +
                drawdown_corr * 0.25 +
                signal_corr * 0.2 +
                timing_corr * 0.15
            )
            
            # Calculate correlation stability
            stability = await self._calculate_correlation_stability(strategy_a, strategy_b)
            
            return CorrelationMetrics(
                strategy_a=strategy_a,
                strategy_b=strategy_b,
                returns_correlation=returns_corr,
                signal_correlation=signal_corr,
                drawdown_correlation=drawdown_corr,
                timing_correlation=timing_corr,
                overall_correlation=overall_corr,
                correlation_stability=stability,
                sample_size=min_periods,
                last_updated=datetime.utcnow()
            )
            
        except Exception as e:
            self._logger.error(f"Error calculating correlation for {strategy_a}-{strategy_b}: {e}")
            return None
    
    async def _calculate_signal_correlation(
        self, 
        perf_a: StrategyPerformance, 
        perf_b: StrategyPerformance
    ) -> float:
        """Calculate signal correlation between strategies."""
        try:
            if not perf_a.signals or not perf_b.signals:
                return 0.0
            
            # Create signal vectors for overlapping time periods
            # This is simplified - in practice would need more sophisticated alignment
            signals_a = [1 if s[1].signal_type == TradingSignal.BUY else -1 if s[1].signal_type == TradingSignal.SELL else 0 
                        for s in perf_a.signals[-50:]]  # Last 50 signals
            signals_b = [1 if s[1].signal_type == TradingSignal.BUY else -1 if s[1].signal_type == TradingSignal.SELL else 0 
                        for s in perf_b.signals[-50:]]
            
            min_length = min(len(signals_a), len(signals_b))
            if min_length < 5:
                return 0.0
            
            signals_a = signals_a[-min_length:]
            signals_b = signals_b[-min_length:]
            
            return np.corrcoef(signals_a, signals_b)[0, 1] if min_length > 1 else 0.0
            
        except Exception as e:
            self._logger.error(f"Error calculating signal correlation: {e}")
            return 0.0
    
    async def _calculate_timing_correlation(
        self, 
        perf_a: StrategyPerformance, 
        perf_b: StrategyPerformance
    ) -> float:
        """Calculate timing correlation between strategies."""
        try:
            # Analyze if strategies tend to be active at the same times
            if not perf_a.signals or not perf_b.signals:
                return 0.0
            
            # Create activity indicators (simplified)
            times_a = [s[0] for s in perf_a.signals[-100:]]
            times_b = [s[0] for s in perf_b.signals[-100:]]
            
            if not times_a or not times_b:
                return 0.0
            
            # Check overlap in activity periods (rough approximation)
            overlap_count = 0
            total_periods = 0
            
            for time_a in times_a:
                total_periods += 1
                # Check if strategy B was also active within 1 hour
                for time_b in times_b:
                    if abs((time_a - time_b).total_seconds()) <= 3600:  # 1 hour window
                        overlap_count += 1
                        break
            
            return overlap_count / total_periods if total_periods > 0 else 0.0
            
        except Exception as e:
            self._logger.error(f"Error calculating timing correlation: {e}")
            return 0.0
    
    async def _calculate_correlation_stability(self, strategy_a: str, strategy_b: str) -> float:
        """Calculate how stable the correlation has been over time."""
        try:
            key = tuple(sorted([strategy_a, strategy_b]))
            history = self._correlation_history.get(key, [])
            
            if len(history) < 5:
                return 0.5  # Default medium stability
            
            # Calculate standard deviation of recent correlations
            recent_correlations = [corr for _, corr in history[-20:]]  # Last 20 observations
            stability = 1.0 - np.std(recent_correlations)  # Lower std = higher stability
            
            return max(0.0, min(1.0, stability))
            
        except Exception as e:
            self._logger.error(f"Error calculating correlation stability: {e}")
            return 0.5
    
    async def _update_clusters(self) -> None:
        """Update strategy clusters based on correlations."""
        try:
            strategies = list(self._strategy_performance.keys())
            
            if len(strategies) < 2:
                return
            
            # Create correlation distance matrix
            correlation_matrix = self.get_correlation_matrix()
            if correlation_matrix.empty:
                return
            
            # Convert correlation to distance (1 - |correlation|)
            distance_matrix = 1 - np.abs(correlation_matrix.values)
            
            # Perform hierarchical clustering
            condensed_distances = squareform(distance_matrix)
            linkage_matrix = linkage(condensed_distances, method='average')
            
            # Form clusters
            cluster_labels = fcluster(linkage_matrix, 1 - self.cluster_threshold, criterion='distance')
            
            # Update cluster assignments
            self._cluster_assignments = dict(zip(strategies, cluster_labels))
            
            # Create cluster objects
            self._strategy_clusters = {}
            for cluster_id in set(cluster_labels):
                cluster_strategies = [s for s, c in self._cluster_assignments.items() if c == cluster_id]
                
                # Calculate average correlation within cluster
                avg_corr = self._calculate_cluster_avg_correlation(cluster_strategies)
                
                self._strategy_clusters[cluster_id] = StrategyCluster(
                    cluster_id=cluster_id,
                    strategies=cluster_strategies,
                    avg_correlation=avg_corr,
                    cluster_performance={},  # Would calculate cluster performance metrics
                    risk_contribution=0.0,   # Would calculate risk contribution
                    recommended_allocation={}  # Would calculate recommended allocation
                )
            
            self._logger.info(f"Updated {len(self._strategy_clusters)} strategy clusters")
            
        except Exception as e:
            self._logger.error(f"Error updating clusters: {e}")
    
    def _calculate_cluster_avg_correlation(self, strategies: List[str]) -> float:
        """Calculate average correlation within a cluster."""
        if len(strategies) < 2:
            return 0.0
        
        correlations = []
        for i, strategy_a in enumerate(strategies):
            for strategy_b in strategies[i+1:]:
                correlation = self.get_correlation(strategy_a, strategy_b)
                if correlation:
                    correlations.append(abs(correlation.overall_correlation))
        
        return np.mean(correlations) if correlations else 0.0
    
    async def _optimize_allocation(self) -> None:
        """Optimize allocation weights based on correlations."""
        try:
            strategies = list(self._strategy_performance.keys())
            
            if len(strategies) < 2:
                # Single strategy gets 100%
                if strategies:
                    self._optimal_weights = {strategies[0]: 1.0}
                return
            
            # Simple equal-weight with correlation penalty
            base_weight = 1.0 / len(strategies)
            weights = {}
            
            for strategy in strategies:
                # Calculate correlation penalty
                risk_contrib = self.get_risk_contribution(strategy)
                correlation_penalty = risk_contrib * 0.5  # Reduce weight for high correlation
                
                adjusted_weight = base_weight * (1.0 - correlation_penalty)
                weights[strategy] = max(0.05, adjusted_weight)  # Minimum 5% allocation
            
            # Normalize weights to sum to 1
            total_weight = sum(weights.values())
            self._optimal_weights = {s: w / total_weight for s, w in weights.items()}
            
            self._logger.info(f"Updated optimal allocation for {len(strategies)} strategies")
            
        except Exception as e:
            self._logger.error(f"Error optimizing allocation: {e}")
    
    def export_correlation_report(self) -> Dict[str, Any]:
        """Export comprehensive correlation report."""
        report = {
            'generated_at': datetime.utcnow().isoformat(),
            'summary': {
                'total_strategies': len(self._strategy_performance),
                'correlation_pairs': len(self._correlation_matrix),
                'diversification_score': self.get_diversification_score(),
                'highly_correlated_pairs': len(self.get_highly_correlated_pairs()),
            },
            'correlations': {},
            'clusters': {},
            'optimal_allocation': self._optimal_weights,
            'risk_analysis': {},
        }
        
        # Add correlation details
        for (strategy_a, strategy_b), metrics in self._correlation_matrix.items():
            pair_key = f"{strategy_a}-{strategy_b}"
            report['correlations'][pair_key] = {
                'returns_correlation': metrics.returns_correlation,
                'signal_correlation': metrics.signal_correlation,
                'drawdown_correlation': metrics.drawdown_correlation,
                'overall_correlation': metrics.overall_correlation,
                'is_highly_correlated': metrics.is_highly_correlated,
                'diversification_benefit': metrics.diversification_benefit,
                'sample_size': metrics.sample_size,
            }
        
        # Add cluster information
        for cluster_id, cluster in self._strategy_clusters.items():
            report['clusters'][f"cluster_{cluster_id}"] = {
                'strategies': cluster.strategies,
                'avg_correlation': cluster.avg_correlation,
                'strategy_count': len(cluster.strategies),
            }
        
        # Add risk analysis
        for strategy in self._strategy_performance:
            report['risk_analysis'][strategy] = {
                'risk_contribution': self.get_risk_contribution(strategy),
                'cluster_id': self._cluster_assignments.get(strategy),
                'optimal_weight': self._optimal_weights.get(strategy, 0.0),
            }
        
        return report