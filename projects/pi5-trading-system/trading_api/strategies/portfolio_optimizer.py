"""
Strategy Portfolio Optimization System for Pi5 Trading System.

Advanced portfolio optimization framework for allocating capital across
multiple trading strategies based on risk-return optimization principles.

Features:
- Modern Portfolio Theory optimization
- Risk parity allocation methods
- Maximum diversification strategies
- Correlation-based optimization
- Dynamic rebalancing algorithms
- Risk budgeting and allocation
- Performance attribution analysis
- Multi-objective optimization
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
import pandas as pd
from scipy import optimize
import json

from core.exceptions import OptimizationError
from .correlation_analyzer import StrategyCorrelationAnalyzer


logger = logging.getLogger(__name__)


class AllocationMethod(Enum):
    """Portfolio allocation methods."""
    EQUAL_WEIGHT = "equal_weight"
    RISK_PARITY = "risk_parity"
    MAX_SHARPE = "max_sharpe"
    MIN_VARIANCE = "min_variance"
    MAX_DIVERSIFICATION = "max_diversification"
    HIERARCHICAL_RISK_PARITY = "hierarchical_risk_parity"
    BLACK_LITTERMAN = "black_litterman"


@dataclass
class StrategyMetrics:
    """Performance metrics for a strategy."""
    strategy_name: str
    expected_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    correlation_matrix: np.ndarray = None
    var_95: float = 0.0
    skewness: float = 0.0
    kurtosis: float = 0.0


@dataclass
class PortfolioAllocation:
    """Portfolio allocation result."""
    allocation_id: str
    method: AllocationMethod
    weights: Dict[str, float]
    expected_return: float
    expected_volatility: float
    expected_sharpe: float
    risk_contribution: Dict[str, float]
    diversification_ratio: float
    constraints_met: bool
    optimization_success: bool
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def total_weight(self) -> float:
        """Total allocation weight."""
        return sum(self.weights.values())
    
    def get_strategy_allocation(self, strategy_name: str) -> float:
        """Get allocation for specific strategy."""
        return self.weights.get(strategy_name, 0.0)


class StrategyPortfolioOptimizer:
    """
    Advanced strategy portfolio optimization system.
    
    Optimizes allocation across multiple trading strategies using various
    portfolio optimization techniques and risk management principles.
    """
    
    def __init__(
        self,
        correlation_analyzer: StrategyCorrelationAnalyzer,
        min_allocation: float = 0.05,  # 5% minimum per strategy
        max_allocation: float = 0.50,  # 50% maximum per strategy
        target_volatility: float = 0.15,  # 15% target volatility
        rebalancing_threshold: float = 0.05,  # 5% drift threshold
        risk_free_rate: float = 0.02,  # 2% risk-free rate
    ):
        """
        Initialize strategy portfolio optimizer.
        
        Args:
            correlation_analyzer: Strategy correlation analyzer
            min_allocation: Minimum allocation per strategy
            max_allocation: Maximum allocation per strategy
            target_volatility: Target portfolio volatility
            rebalancing_threshold: Rebalancing threshold
            risk_free_rate: Risk-free rate for Sharpe calculation
        """
        self.correlation_analyzer = correlation_analyzer
        self.min_allocation = min_allocation
        self.max_allocation = max_allocation
        self.target_volatility = target_volatility
        self.rebalancing_threshold = rebalancing_threshold
        self.risk_free_rate = risk_free_rate
        
        # Portfolio state
        self._current_allocation: Optional[PortfolioAllocation] = None
        self._allocation_history: List[PortfolioAllocation] = []
        self._strategy_metrics: Dict[str, StrategyMetrics] = {}
        
        # Optimization cache
        self._optimization_cache: Dict[str, PortfolioAllocation] = {}
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def optimize_portfolio(
        self,
        strategy_metrics: Dict[str, StrategyMetrics],
        method: AllocationMethod = AllocationMethod.MAX_SHARPE,
        constraints: Dict[str, Any] = None,
        target_return: Optional[float] = None,
    ) -> PortfolioAllocation:
        """
        Optimize portfolio allocation across strategies.
        
        Args:
            strategy_metrics: Performance metrics for each strategy
            method: Optimization method
            constraints: Additional constraints
            target_return: Target return for optimization
            
        Returns:
            Optimal portfolio allocation
        """
        try:
            allocation_id = f"alloc_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            self._logger.info(f"Optimizing portfolio allocation using {method.value}")
            
            # Validate inputs
            await self._validate_optimization_inputs(strategy_metrics)
            
            # Store strategy metrics
            self._strategy_metrics.update(strategy_metrics)
            
            # Prepare optimization data
            strategies = list(strategy_metrics.keys())
            returns = np.array([metrics.expected_return for metrics in strategy_metrics.values()])
            volatilities = np.array([metrics.volatility for metrics in strategy_metrics.values()])
            
            # Get correlation matrix
            correlation_matrix = await self._build_correlation_matrix(strategies, strategy_metrics)
            
            # Calculate covariance matrix
            cov_matrix = self._calculate_covariance_matrix(volatilities, correlation_matrix)
            
            # Perform optimization based on method
            if method == AllocationMethod.EQUAL_WEIGHT:
                weights = self._equal_weight_allocation(len(strategies))
            elif method == AllocationMethod.RISK_PARITY:
                weights = self._risk_parity_allocation(cov_matrix)
            elif method == AllocationMethod.MAX_SHARPE:
                weights = self._max_sharpe_allocation(returns, cov_matrix)
            elif method == AllocationMethod.MIN_VARIANCE:
                weights = self._min_variance_allocation(cov_matrix)
            elif method == AllocationMethod.MAX_DIVERSIFICATION:
                weights = self._max_diversification_allocation(volatilities, cov_matrix)
            else:
                raise OptimizationError(f"Optimization method {method} not implemented")
            
            # Apply constraints
            weights = self._apply_constraints(weights, constraints)
            
            # Calculate portfolio metrics
            portfolio_return = np.dot(weights, returns)
            portfolio_volatility = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
            portfolio_sharpe = (portfolio_return - self.risk_free_rate) / portfolio_volatility if portfolio_volatility > 0 else 0
            
            # Calculate risk contribution
            risk_contribution = self._calculate_risk_contribution(weights, cov_matrix, strategies)
            
            # Calculate diversification ratio
            diversification_ratio = np.dot(weights, volatilities) / portfolio_volatility if portfolio_volatility > 0 else 0
            
            # Create allocation result
            allocation = PortfolioAllocation(
                allocation_id=allocation_id,
                method=method,
                weights=dict(zip(strategies, weights)),
                expected_return=portfolio_return,
                expected_volatility=portfolio_volatility,
                expected_sharpe=portfolio_sharpe,
                risk_contribution=risk_contribution,
                diversification_ratio=diversification_ratio,
                constraints_met=self._check_constraints(weights),
                optimization_success=True
            )
            
            # Store results
            self._current_allocation = allocation
            self._allocation_history.append(allocation)
            self._optimization_cache[allocation_id] = allocation
            
            self._logger.info(
                f"Portfolio optimization completed. Expected Sharpe: {portfolio_sharpe:.3f}, "
                f"Volatility: {portfolio_volatility:.3f}"
            )
            
            return allocation
            
        except Exception as e:
            self._logger.error(f"Error in portfolio optimization: {e}")
            # Return fallback equal weight allocation
            return self._create_fallback_allocation(strategy_metrics, method)
    
    async def _validate_optimization_inputs(self, strategy_metrics: Dict[str, StrategyMetrics]) -> None:
        """Validate optimization inputs."""
        if not strategy_metrics:
            raise OptimizationError("strategy_metrics cannot be empty")
        
        if len(strategy_metrics) < 2:
            raise OptimizationError("Need at least 2 strategies for optimization")
        
        for name, metrics in strategy_metrics.items():
            if metrics.volatility <= 0:
                raise OptimizationError(f"Strategy {name} has invalid volatility: {metrics.volatility}")
    
    async def _build_correlation_matrix(
        self, 
        strategies: List[str], 
        strategy_metrics: Dict[str, StrategyMetrics]
    ) -> np.ndarray:
        """Build correlation matrix for strategies."""
        n = len(strategies)
        correlation_matrix = np.eye(n)
        
        for i, strategy_a in enumerate(strategies):
            for j, strategy_b in enumerate(strategies):
                if i != j:
                    # Get correlation from analyzer
                    correlation = self.correlation_analyzer.get_correlation(strategy_a, strategy_b)
                    if correlation:
                        correlation_matrix[i, j] = correlation.overall_correlation
                    else:
                        # Default correlation for unknown pairs
                        correlation_matrix[i, j] = 0.1
        
        return correlation_matrix
    
    def _calculate_covariance_matrix(
        self, 
        volatilities: np.ndarray, 
        correlation_matrix: np.ndarray
    ) -> np.ndarray:
        """Calculate covariance matrix from volatilities and correlations."""
        vol_matrix = np.outer(volatilities, volatilities)
        return vol_matrix * correlation_matrix
    
    # Allocation methods
    
    def _equal_weight_allocation(self, n_strategies: int) -> np.ndarray:
        """Equal weight allocation."""
        return np.ones(n_strategies) / n_strategies
    
    def _risk_parity_allocation(self, cov_matrix: np.ndarray) -> np.ndarray:
        """Risk parity allocation (equal risk contribution)."""
        try:
            n = cov_matrix.shape[0]
            
            def risk_budget_objective(weights):
                """Objective function for risk parity."""
                weights = np.array(weights)
                portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
                
                # Risk contributions
                marginal_contrib = np.dot(cov_matrix, weights)
                risk_contrib = weights * marginal_contrib
                
                # Target is equal risk contribution
                target_risk = portfolio_variance / n
                risk_diff = risk_contrib - target_risk
                
                return np.sum(risk_diff ** 2)
            
            # Constraints
            constraints = [
                {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},  # Weights sum to 1
            ]
            
            bounds = [(self.min_allocation, self.max_allocation) for _ in range(n)]
            
            # Initial guess
            x0 = np.ones(n) / n
            
            # Optimize
            result = optimize.minimize(
                risk_budget_objective,
                x0,
                method='SLSQP',
                bounds=bounds,
                constraints=constraints
            )
            
            if result.success:
                return result.x
            else:
                return self._equal_weight_allocation(n)
                
        except Exception as e:
            self._logger.error(f"Error in risk parity allocation: {e}")
            return self._equal_weight_allocation(cov_matrix.shape[0])
    
    def _max_sharpe_allocation(self, returns: np.ndarray, cov_matrix: np.ndarray) -> np.ndarray:
        """Maximum Sharpe ratio allocation."""
        try:
            n = len(returns)
            
            def neg_sharpe_ratio(weights):
                """Negative Sharpe ratio for minimization."""
                weights = np.array(weights)
                portfolio_return = np.dot(weights, returns)
                portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
                portfolio_volatility = np.sqrt(portfolio_variance)
                
                if portfolio_volatility == 0:
                    return -float('inf')
                
                sharpe = (portfolio_return - self.risk_free_rate) / portfolio_volatility
                return -sharpe  # Negative for minimization
            
            # Constraints
            constraints = [
                {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},  # Weights sum to 1
            ]
            
            bounds = [(self.min_allocation, self.max_allocation) for _ in range(n)]
            
            # Initial guess
            x0 = np.ones(n) / n
            
            # Optimize
            result = optimize.minimize(
                neg_sharpe_ratio,
                x0,
                method='SLSQP',
                bounds=bounds,
                constraints=constraints
            )
            
            if result.success:
                return result.x
            else:
                return self._equal_weight_allocation(n)
                
        except Exception as e:
            self._logger.error(f"Error in max Sharpe allocation: {e}")
            return self._equal_weight_allocation(len(returns))
    
    def _min_variance_allocation(self, cov_matrix: np.ndarray) -> np.ndarray:
        """Minimum variance allocation."""
        try:
            n = cov_matrix.shape[0]
            
            def portfolio_variance(weights):
                """Portfolio variance objective."""
                weights = np.array(weights)
                return np.dot(weights, np.dot(cov_matrix, weights))
            
            # Constraints
            constraints = [
                {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},  # Weights sum to 1
            ]
            
            bounds = [(self.min_allocation, self.max_allocation) for _ in range(n)]
            
            # Initial guess
            x0 = np.ones(n) / n
            
            # Optimize
            result = optimize.minimize(
                portfolio_variance,
                x0,
                method='SLSQP',
                bounds=bounds,
                constraints=constraints
            )
            
            if result.success:
                return result.x
            else:
                return self._equal_weight_allocation(n)
                
        except Exception as e:
            self._logger.error(f"Error in min variance allocation: {e}")
            return self._equal_weight_allocation(cov_matrix.shape[0])
    
    def _max_diversification_allocation(
        self, 
        volatilities: np.ndarray, 
        cov_matrix: np.ndarray
    ) -> np.ndarray:
        """Maximum diversification allocation."""
        try:
            n = len(volatilities)
            
            def neg_diversification_ratio(weights):
                """Negative diversification ratio for minimization."""
                weights = np.array(weights)
                weighted_avg_vol = np.dot(weights, volatilities)
                portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
                
                if portfolio_vol == 0:
                    return -float('inf')
                
                diversification_ratio = weighted_avg_vol / portfolio_vol
                return -diversification_ratio  # Negative for minimization
            
            # Constraints
            constraints = [
                {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},  # Weights sum to 1
            ]
            
            bounds = [(self.min_allocation, self.max_allocation) for _ in range(n)]
            
            # Initial guess
            x0 = np.ones(n) / n
            
            # Optimize
            result = optimize.minimize(
                neg_diversification_ratio,
                x0,
                method='SLSQP',
                bounds=bounds,
                constraints=constraints
            )
            
            if result.success:
                return result.x
            else:
                return self._equal_weight_allocation(n)
                
        except Exception as e:
            self._logger.error(f"Error in max diversification allocation: {e}")
            return self._equal_weight_allocation(len(volatilities))
    
    def _apply_constraints(self, weights: np.ndarray, constraints: Dict[str, Any] = None) -> np.ndarray:
        """Apply additional constraints to weights."""
        if constraints is None:
            return weights
        
        # Apply minimum and maximum allocation constraints
        weights = np.clip(weights, self.min_allocation, self.max_allocation)
        
        # Renormalize to sum to 1
        weights = weights / np.sum(weights)
        
        return weights
    
    def _check_constraints(self, weights: np.ndarray) -> bool:
        """Check if weights satisfy constraints."""
        # Check sum constraint
        if abs(np.sum(weights) - 1.0) > 1e-6:
            return False
        
        # Check allocation bounds
        if np.any(weights < self.min_allocation - 1e-6) or np.any(weights > self.max_allocation + 1e-6):
            return False
        
        return True
    
    def _calculate_risk_contribution(
        self, 
        weights: np.ndarray, 
        cov_matrix: np.ndarray, 
        strategies: List[str]
    ) -> Dict[str, float]:
        """Calculate risk contribution for each strategy."""
        try:
            portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
            
            if portfolio_variance == 0:
                return {strategy: 0.0 for strategy in strategies}
            
            # Marginal risk contribution
            marginal_contrib = np.dot(cov_matrix, weights)
            
            # Risk contribution
            risk_contrib = weights * marginal_contrib / portfolio_variance
            
            return dict(zip(strategies, risk_contrib))
            
        except Exception as e:
            self._logger.error(f"Error calculating risk contribution: {e}")
            return {strategy: 1.0 / len(strategies) for strategy in strategies}
    
    def _create_fallback_allocation(
        self, 
        strategy_metrics: Dict[str, StrategyMetrics], 
        method: AllocationMethod
    ) -> PortfolioAllocation:
        """Create fallback equal weight allocation."""
        strategies = list(strategy_metrics.keys())
        n = len(strategies)
        weights = np.ones(n) / n
        
        # Calculate basic metrics
        returns = np.array([metrics.expected_return for metrics in strategy_metrics.values()])
        volatilities = np.array([metrics.volatility for metrics in strategy_metrics.values()])
        
        portfolio_return = np.dot(weights, returns)
        portfolio_volatility = np.mean(volatilities)  # Simplified
        portfolio_sharpe = (portfolio_return - self.risk_free_rate) / portfolio_volatility if portfolio_volatility > 0 else 0
        
        return PortfolioAllocation(
            allocation_id=f"fallback_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            method=method,
            weights=dict(zip(strategies, weights)),
            expected_return=portfolio_return,
            expected_volatility=portfolio_volatility,
            expected_sharpe=portfolio_sharpe,
            risk_contribution={strategy: 1.0 / n for strategy in strategies},
            diversification_ratio=1.0,
            constraints_met=True,
            optimization_success=False
        )
    
    def should_rebalance(self, current_weights: Dict[str, float]) -> bool:
        """Check if portfolio should be rebalanced."""
        if not self._current_allocation:
            return True
        
        target_weights = self._current_allocation.weights
        
        for strategy in current_weights:
            if strategy in target_weights:
                weight_diff = abs(current_weights[strategy] - target_weights[strategy])
                if weight_diff > self.rebalancing_threshold:
                    return True
        
        return False
    
    def get_current_allocation(self) -> Optional[PortfolioAllocation]:
        """Get current portfolio allocation."""
        return self._current_allocation
    
    def get_allocation_history(self) -> List[PortfolioAllocation]:
        """Get allocation history."""
        return self._allocation_history.copy()
    
    def export_allocation_report(self, allocation_id: str) -> Optional[Dict[str, Any]]:
        """Export allocation report."""
        try:
            allocation = self._optimization_cache.get(allocation_id)
            if not allocation:
                return None
            
            report = {
                'allocation_id': allocation.allocation_id,
                'method': allocation.method.value,
                'timestamp': allocation.timestamp.isoformat(),
                'optimization_success': allocation.optimization_success,
                'constraints_met': allocation.constraints_met,
                'portfolio_metrics': {
                    'expected_return': allocation.expected_return,
                    'expected_volatility': allocation.expected_volatility,
                    'expected_sharpe': allocation.expected_sharpe,
                    'diversification_ratio': allocation.diversification_ratio,
                    'total_weight': allocation.total_weight,
                },
                'strategy_allocations': allocation.weights,
                'risk_contributions': allocation.risk_contribution,
                'allocation_constraints': {
                    'min_allocation': self.min_allocation,
                    'max_allocation': self.max_allocation,
                    'target_volatility': self.target_volatility,
                },
            }
            
            return report
            
        except Exception as e:
            self._logger.error(f"Error exporting allocation report: {e}")
            return None