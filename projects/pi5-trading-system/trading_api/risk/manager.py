"""
Risk manager implementation for Pi5 Trading System.

Provides comprehensive risk management including signal validation, position sizing,
portfolio risk monitoring, and limit enforcement. Implements various position sizing
algorithms and risk metrics calculation.

Features:
- Signal validation against risk limits
- Dynamic position sizing with multiple algorithms
- Portfolio risk monitoring and metrics
- Real-time risk limit enforcement
- Correlation analysis and sector concentration limits
- Value at Risk (VaR) and Expected Shortfall calculations
- Drawdown monitoring and protection
- Emergency risk controls and circuit breakers
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict, deque

from core.interfaces import RiskManager, RiskLimits, Portfolio, Signal
from core.exceptions import (
    RiskLimitViolationError,
    InsufficientFundsError,
    PositionSizeError,
    CorrelationRiskError,
    DrawdownLimitError,
)
from database.connection_manager import DatabaseManager
from events.event_bus import EventBus
from events.event_types import RiskViolationEvent, RiskMetricsEvent


logger = logging.getLogger(__name__)


class RiskManagerImplementation(RiskManager):
    """
    Comprehensive risk manager with multiple validation layers.
    
    Implements sophisticated risk management including position sizing,
    correlation analysis, drawdown protection, and portfolio-level risk metrics.
    """
    
    def __init__(
        self,
        risk_limits: RiskLimits,
        db_manager: DatabaseManager,
        event_bus: EventBus,
        position_sizing_method: str = "fixed_fractional",
        var_confidence_level: float = 0.95,
        lookback_days: int = 252,
        correlation_lookback_days: int = 60,
    ):
        """
        Initialize risk manager.
        
        Args:
            risk_limits: Risk limits configuration
            db_manager: Database manager for data access
            event_bus: Event bus for risk violation events
            position_sizing_method: Position sizing algorithm
            var_confidence_level: VaR confidence level (0.95 or 0.99)
            lookback_days: Days of historical data for risk calculations
            correlation_lookback_days: Days for correlation analysis
        """
        self.risk_limits = risk_limits
        self.db = db_manager
        self.event_bus = event_bus
        self.position_sizing_method = position_sizing_method
        self.var_confidence_level = var_confidence_level
        self.lookback_days = lookback_days
        self.correlation_lookback_days = correlation_lookback_days
        
        # Risk monitoring state
        self._portfolio_returns: deque = deque(maxlen=lookback_days)
        self._daily_pnl_history: deque = deque(maxlen=lookback_days)
        self._position_correlations: Dict[str, Dict[str, float]] = {}
        self._sector_exposures: Dict[str, float] = defaultdict(float)
        self._peak_portfolio_value: float = 0.0
        self._current_drawdown: float = 0.0
        self._max_drawdown: float = 0.0
        
        # Risk metrics cache
        self._cached_metrics: Dict[str, Any] = {}
        self._last_metrics_update: Optional[datetime] = None
        self._metrics_cache_ttl = timedelta(minutes=15)
        
        # Emergency controls
        self._emergency_stop_triggered: bool = False
        self._risk_violations: List[Dict[str, Any]] = []
        
        # Position sizing algorithms
        self._position_sizers = {
            'fixed_fractional': self._fixed_fractional_sizing,
            'volatility_adjusted': self._volatility_adjusted_sizing,
            'kelly_criterion': self._kelly_criterion_sizing,
            'risk_parity': self._risk_parity_sizing,
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def validate_signal(
        self,
        signal: Signal,
        current_portfolio: Portfolio
    ) -> Tuple[bool, Optional[Exception]]:
        """
        Validate if signal passes all risk checks.
        
        Args:
            signal: Trading signal to validate
            current_portfolio: Current portfolio state
            
        Returns:
            Tuple of (is_valid, violation_exception)
        """
        try:
            self._logger.debug(f"Validating signal: {signal.signal_type} {signal.symbol}")
            
            # 1. Check emergency stop
            if self._emergency_stop_triggered:
                violation = RiskLimitViolationError(
                    "emergency_stop", 1.0, 0.0,
                    reason="Emergency stop is active"
                )
                await self._record_risk_violation(violation, signal.symbol, signal.strategy_name)
                return False, violation
            
            # 2. Check maximum drawdown
            drawdown_check = await self._check_drawdown_limit(current_portfolio)
            if drawdown_check:
                await self._record_risk_violation(drawdown_check, signal.symbol, signal.strategy_name)
                return False, drawdown_check
            
            # 3. Calculate proposed position size
            position_size = await self.calculate_position_size(
                signal, current_portfolio.total_value, signal.price
            )
            
            if position_size == 0:
                self._logger.debug(f"Position size calculated as 0 for {signal.symbol}")
                return False, None
            
            # 4. Check position size limits
            position_value = position_size * signal.price
            position_pct = position_value / current_portfolio.total_value
            
            if position_pct > self.risk_limits.max_position_size:
                violation = RiskLimitViolationError(
                    "position_size", position_pct, self.risk_limits.max_position_size,
                    symbol=signal.symbol
                )
                await self._record_risk_violation(violation, signal.symbol, signal.strategy_name)
                return False, violation
            
            # 5. Check portfolio exposure
            current_exposure = self._calculate_portfolio_exposure(current_portfolio)
            new_exposure = current_exposure + position_pct
            
            if new_exposure > self.risk_limits.max_portfolio_exposure:
                violation = RiskLimitViolationError(
                    "portfolio_exposure", new_exposure, self.risk_limits.max_portfolio_exposure,
                    symbol=signal.symbol
                )
                await self._record_risk_violation(violation, signal.symbol, signal.strategy_name)
                return False, violation
            
            # 6. Check correlation limits
            correlation_check = await self._check_correlation_limit(
                signal.symbol, position_size, current_portfolio
            )
            if correlation_check:
                await self._record_risk_violation(correlation_check, signal.symbol, signal.strategy_name)
                return False, correlation_check
            
            # 7. Check sector concentration
            sector_check = await self._check_sector_concentration(
                signal.symbol, position_value, current_portfolio
            )
            if sector_check:
                await self._record_risk_violation(sector_check, signal.symbol, signal.strategy_name)
                return False, sector_check
            
            # 8. Check sufficient funds
            if signal.signal_type.value in ['buy']:
                required_cash = position_value * 1.01  # Include buffer for commissions
                if current_portfolio.cash < required_cash:
                    violation = InsufficientFundsError(
                        f"Insufficient funds: need {required_cash}, have {current_portfolio.cash}",
                        context={'required': required_cash, 'available': current_portfolio.cash}
                    )
                    await self._record_risk_violation(violation, signal.symbol, signal.strategy_name)
                    return False, violation
            
            self._logger.debug(f"Signal validation passed for {signal.symbol}")
            return True, None
            
        except Exception as e:
            self._logger.error(f"Error validating signal for {signal.symbol}: {e}")
            return False, e
    
    async def calculate_position_size(
        self,
        signal: Signal,
        portfolio_value: float,
        current_price: float
    ) -> float:
        """
        Calculate appropriate position size for signal.
        
        Args:
            signal: Trading signal
            portfolio_value: Current portfolio value
            current_price: Current asset price
            
        Returns:
            Position size in shares/units
        """
        try:
            # Get the position sizing function
            sizer_func = self._position_sizers.get(self.position_sizing_method)
            if not sizer_func:
                self._logger.error(f"Unknown position sizing method: {self.position_sizing_method}")
                return 0.0
            
            # Calculate position size using selected algorithm
            position_size = await sizer_func(signal, portfolio_value, current_price)
            
            # Apply maximum position size limit
            max_position_value = portfolio_value * self.risk_limits.max_position_size
            max_shares = max_position_value / current_price
            
            position_size = min(position_size, max_shares)
            
            # Ensure minimum position size (avoid tiny positions)
            min_position_value = 100.0  # $100 minimum
            min_shares = min_position_value / current_price
            
            if position_size < min_shares:
                position_size = 0.0
            
            self._logger.debug(
                f"Position size calculated for {signal.symbol}: {position_size:.2f} shares "
                f"(${position_size * current_price:.2f})"
            )
            
            return position_size
            
        except Exception as e:
            self._logger.error(f"Error calculating position size for {signal.symbol}: {e}")
            return 0.0
    
    async def check_portfolio_risk(self, portfolio: Portfolio) -> List[Exception]:
        """
        Check current portfolio against all risk limits.
        
        Args:
            portfolio: Current portfolio state
            
        Returns:
            List of risk violations
        """
        violations = []
        
        try:
            # Update portfolio tracking
            await self._update_portfolio_tracking(portfolio)
            
            # Check drawdown
            drawdown_violation = await self._check_drawdown_limit(portfolio)
            if drawdown_violation:
                violations.append(drawdown_violation)
            
            # Check daily loss limit
            if len(self._daily_pnl_history) > 0:
                today_pnl = self._daily_pnl_history[-1]
                daily_loss_pct = abs(today_pnl) / portfolio.total_value
                
                if today_pnl < 0 and daily_loss_pct > self.risk_limits.max_daily_loss:
                    violation = RiskLimitViolationError(
                        "daily_loss", daily_loss_pct, self.risk_limits.max_daily_loss
                    )
                    violations.append(violation)
            
            # Check portfolio concentration
            for symbol, position in portfolio.positions.items():
                position_pct = abs(position.market_value) / portfolio.total_value
                if position_pct > self.risk_limits.max_position_size:
                    violation = RiskLimitViolationError(
                        "position_concentration", position_pct, self.risk_limits.max_position_size,
                        symbol=symbol
                    )
                    violations.append(violation)
            
            # Check correlation risk
            correlation_violations = await self._check_portfolio_correlations(portfolio)
            violations.extend(correlation_violations)
            
            # Record violations
            for violation in violations:
                await self._record_risk_violation(violation)
            
            return violations
            
        except Exception as e:
            self._logger.error(f"Error checking portfolio risk: {e}")
            return [e]
    
    async def calculate_risk_metrics(self, portfolio: Portfolio) -> Dict[str, float]:
        """Calculate comprehensive risk metrics for portfolio."""
        try:
            # Check cache
            if (self._last_metrics_update and 
                datetime.utcnow() - self._last_metrics_update < self._metrics_cache_ttl):
                return self._cached_metrics.copy()
            
            metrics = {}
            
            # Portfolio return statistics
            if len(self._portfolio_returns) >= 30:
                returns_array = np.array(self._portfolio_returns)
                
                # Basic statistics
                metrics['daily_volatility'] = np.std(returns_array)
                metrics['annualized_volatility'] = metrics['daily_volatility'] * np.sqrt(252)
                metrics['mean_daily_return'] = np.mean(returns_array)
                metrics['annualized_return'] = metrics['mean_daily_return'] * 252
                
                # Sharpe ratio
                if metrics['daily_volatility'] > 0:
                    metrics['sharpe_ratio'] = (metrics['annualized_return'] / 
                                             metrics['annualized_volatility'])
                else:
                    metrics['sharpe_ratio'] = 0.0
                
                # Value at Risk
                var_percentile = (1 - self.var_confidence_level) * 100
                metrics['var_95'] = np.percentile(returns_array, var_percentile)
                metrics['var_99'] = np.percentile(returns_array, 1.0)
                
                # Expected Shortfall (Conditional VaR)
                var_95_threshold = metrics['var_95']
                tail_losses = returns_array[returns_array <= var_95_threshold]
                metrics['expected_shortfall'] = np.mean(tail_losses) if len(tail_losses) > 0 else 0
                
                # Skewness and Kurtosis
                metrics['skewness'] = self._calculate_skewness(returns_array)
                metrics['kurtosis'] = self._calculate_kurtosis(returns_array)
                
                # Maximum drawdown
                metrics['max_drawdown'] = self._max_drawdown
                metrics['current_drawdown'] = self._current_drawdown
                
                # Calmar ratio (annualized return / max drawdown)
                if self._max_drawdown > 0:
                    metrics['calmar_ratio'] = abs(metrics['annualized_return'] / self._max_drawdown)
                else:
                    metrics['calmar_ratio'] = float('inf')
            
            # Portfolio concentration metrics
            total_value = portfolio.total_value
            if total_value > 0:
                position_weights = []
                for position in portfolio.positions.values():
                    weight = abs(position.market_value) / total_value
                    position_weights.append(weight)
                
                if position_weights:
                    metrics['concentration_hhi'] = sum(w**2 for w in position_weights)
                    metrics['max_position_weight'] = max(position_weights)
                    metrics['effective_positions'] = 1.0 / metrics['concentration_hhi']
                else:
                    metrics['concentration_hhi'] = 0.0
                    metrics['max_position_weight'] = 0.0
                    metrics['effective_positions'] = 0.0
            
            # Beta calculation (if we have market data)
            metrics['beta'] = await self._calculate_portfolio_beta(portfolio)
            
            # Cache results
            self._cached_metrics = metrics.copy()
            self._last_metrics_update = datetime.utcnow()
            
            # Publish risk metrics event
            await self._publish_risk_metrics_event(metrics)
            
            return metrics
            
        except Exception as e:
            self._logger.error(f"Error calculating risk metrics: {e}")
            return {}
    
    # Position sizing algorithms
    
    async def _fixed_fractional_sizing(
        self,
        signal: Signal,
        portfolio_value: float,
        current_price: float
    ) -> float:
        """Fixed fractional position sizing."""
        target_position_value = portfolio_value * self.risk_limits.max_position_size
        return target_position_value / current_price
    
    async def _volatility_adjusted_sizing(
        self,
        signal: Signal,
        portfolio_value: float,
        current_price: float
    ) -> float:
        """Volatility-adjusted position sizing."""
        try:
            # Get historical volatility
            volatility = await self._get_symbol_volatility(signal.symbol)
            if volatility is None or volatility == 0:
                # Fall back to fixed fractional if no volatility data
                return await self._fixed_fractional_sizing(signal, portfolio_value, current_price)
            
            # Target volatility of 2% per position
            target_vol = 0.02
            vol_adjustment = min(target_vol / volatility, 1.0)  # Cap at 100%
            
            base_position_value = portfolio_value * self.risk_limits.max_position_size
            adjusted_position_value = base_position_value * vol_adjustment
            
            return adjusted_position_value / current_price
            
        except Exception as e:
            self._logger.warning(f"Volatility adjustment failed for {signal.symbol}: {e}")
            return await self._fixed_fractional_sizing(signal, portfolio_value, current_price)
    
    async def _kelly_criterion_sizing(
        self,
        signal: Signal,
        portfolio_value: float,
        current_price: float
    ) -> float:
        """Kelly Criterion position sizing."""
        try:
            # Simplified Kelly: f = (bp - q) / b
            # Where b = odds, p = win probability, q = loss probability
            # For trading: f = (expected_return * win_rate - loss_rate) / expected_return
            
            win_rate = signal.confidence
            expected_return = 0.1  # Assume 10% expected return - should be strategy-specific
            loss_rate = 1 - win_rate
            
            if expected_return <= 0:
                return 0.0
            
            kelly_fraction = (expected_return * win_rate - loss_rate) / expected_return
            kelly_fraction = max(0, min(kelly_fraction, 0.25))  # Cap at 25%
            
            position_value = portfolio_value * kelly_fraction
            return position_value / current_price
            
        except Exception as e:
            self._logger.warning(f"Kelly criterion sizing failed for {signal.symbol}: {e}")
            return await self._fixed_fractional_sizing(signal, portfolio_value, current_price)
    
    async def _risk_parity_sizing(
        self,
        signal: Signal,
        portfolio_value: float,
        current_price: float
    ) -> float:
        """Risk parity position sizing."""
        try:
            # Equal risk contribution from each position
            volatility = await self._get_symbol_volatility(signal.symbol)
            if volatility is None or volatility == 0:
                return await self._fixed_fractional_sizing(signal, portfolio_value, current_price)
            
            # Target 2% volatility per position
            target_vol = 0.02
            position_value = (portfolio_value * target_vol) / volatility
            position_value = min(position_value, portfolio_value * self.risk_limits.max_position_size)
            
            return position_value / current_price
            
        except Exception as e:
            self._logger.warning(f"Risk parity sizing failed for {signal.symbol}: {e}")
            return await self._fixed_fractional_sizing(signal, portfolio_value, current_price)
    
    # Risk checking methods
    
    async def _check_drawdown_limit(self, portfolio: Portfolio) -> Optional[DrawdownLimitError]:
        """Check if drawdown exceeds limits."""
        if self._current_drawdown > self.risk_limits.max_drawdown:
            return DrawdownLimitError(
                f"Portfolio drawdown {self._current_drawdown:.2%} exceeds limit {self.risk_limits.max_drawdown:.2%}",
                context={'current_drawdown': self._current_drawdown, 'limit': self.risk_limits.max_drawdown}
            )
        return None
    
    async def _check_correlation_limit(
        self,
        symbol: str,
        position_size: float,
        portfolio: Portfolio
    ) -> Optional[CorrelationRiskError]:
        """Check if new position would violate correlation limits."""
        try:
            # Get correlations for this symbol
            symbol_correlations = self._position_correlations.get(symbol, {})
            
            # Check correlation with existing positions
            for existing_symbol, existing_position in portfolio.positions.items():
                if existing_symbol == symbol:
                    continue
                
                correlation = symbol_correlations.get(existing_symbol, 0.0)
                if abs(correlation) > self.risk_limits.max_correlation:
                    # Calculate combined position value
                    new_position_value = position_size * await self._get_current_price(symbol)
                    existing_value = abs(existing_position.market_value)
                    combined_weight = (new_position_value + existing_value) / portfolio.total_value
                    
                    # Only trigger if combined position is significant
                    if combined_weight > 0.05:  # 5% threshold
                        return CorrelationRiskError(
                            f"High correlation {correlation:.2f} between {symbol} and {existing_symbol}",
                            context={
                                'symbol1': symbol,
                                'symbol2': existing_symbol,
                                'correlation': correlation,
                                'combined_weight': combined_weight
                            }
                        )
            
            return None
            
        except Exception as e:
            self._logger.warning(f"Correlation check failed for {symbol}: {e}")
            return None
    
    async def _check_sector_concentration(
        self,
        symbol: str,
        position_value: float,
        portfolio: Portfolio
    ) -> Optional[RiskLimitViolationError]:
        """Check sector concentration limits."""
        try:
            # Get sector for symbol (simplified - would normally use reference data)
            sector = await self._get_symbol_sector(symbol)
            if not sector:
                return None
            
            # Calculate current sector exposure
            current_sector_exposure = 0.0
            for existing_symbol, position in portfolio.positions.items():
                existing_sector = await self._get_symbol_sector(existing_symbol)
                if existing_sector == sector:
                    current_sector_exposure += abs(position.market_value)
            
            # Add new position
            new_sector_exposure = (current_sector_exposure + position_value) / portfolio.total_value
            
            if new_sector_exposure > self.risk_limits.max_sector_exposure:
                return RiskLimitViolationError(
                    "sector_concentration", new_sector_exposure, self.risk_limits.max_sector_exposure,
                    symbol=symbol, context={'sector': sector}
                )
            
            return None
            
        except Exception as e:
            self._logger.warning(f"Sector concentration check failed for {symbol}: {e}")
            return None
    
    # Helper methods
    
    async def _update_portfolio_tracking(self, portfolio: Portfolio) -> None:
        """Update portfolio tracking metrics."""
        current_value = portfolio.total_value
        
        # Update peak value and drawdown
        if current_value > self._peak_portfolio_value:
            self._peak_portfolio_value = current_value
            self._current_drawdown = 0.0
        else:
            self._current_drawdown = (self._peak_portfolio_value - current_value) / self._peak_portfolio_value
            self._max_drawdown = max(self._max_drawdown, self._current_drawdown)
        
        # Calculate daily return
        if len(self._daily_pnl_history) > 0:
            previous_value = current_value - self._daily_pnl_history[-1]
            if previous_value > 0:
                daily_return = (current_value - previous_value) / previous_value
                self._portfolio_returns.append(daily_return)
    
    def _calculate_portfolio_exposure(self, portfolio: Portfolio) -> float:
        """Calculate total portfolio exposure."""
        total_exposure = sum(
            abs(position.market_value) for position in portfolio.positions.values()
        )
        return total_exposure / portfolio.total_value if portfolio.total_value > 0 else 0.0
    
    async def _get_symbol_volatility(self, symbol: str) -> Optional[float]:
        """Get historical volatility for symbol."""
        try:
            # This would typically query market data repository
            # For now, return a default value
            return 0.20  # 20% annualized volatility
        except Exception:
            return None
    
    async def _get_current_price(self, symbol: str) -> float:
        """Get current price for symbol."""
        # This would query market data
        return 100.0  # Default price
    
    async def _get_symbol_sector(self, symbol: str) -> Optional[str]:
        """Get sector for symbol."""
        # This would query reference data
        # Return generic sector for now
        return "Technology"
    
    async def _calculate_portfolio_beta(self, portfolio: Portfolio) -> float:
        """Calculate portfolio beta vs market."""
        # Simplified beta calculation - would need market data
        return 1.0
    
    def _calculate_skewness(self, data: np.ndarray) -> float:
        """Calculate skewness of returns."""
        if len(data) < 3:
            return 0.0
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return 0.0
        return np.mean(((data - mean) / std) ** 3)
    
    def _calculate_kurtosis(self, data: np.ndarray) -> float:
        """Calculate kurtosis of returns."""
        if len(data) < 4:
            return 0.0
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return 0.0
        return np.mean(((data - mean) / std) ** 4) - 3  # Excess kurtosis
    
    async def _check_portfolio_correlations(self, portfolio: Portfolio) -> List[CorrelationRiskError]:
        """Check all portfolio position correlations."""
        violations = []
        # Implementation would check all position pairs for correlation
        return violations
    
    async def _record_risk_violation(
        self,
        violation: Exception,
        symbol: str = None,
        strategy_name: str = None
    ) -> None:
        """Record risk violation and publish event."""
        violation_record = {
            'timestamp': datetime.utcnow(),
            'violation_type': type(violation).__name__,
            'message': str(violation),
            'symbol': symbol,
            'strategy_name': strategy_name,
        }
        
        self._risk_violations.append(violation_record)
        
        # Publish risk violation event
        if isinstance(violation, RiskLimitViolationError):
            event = RiskViolationEvent(
                violation_type=violation.violation_type,
                current_value=violation.current_value,
                limit_value=violation.limit_value,
                severity='critical' if violation.current_value > violation.limit_value * 1.5 else 'warning',
                symbol=symbol,
                strategy_name=strategy_name
            )
            await self.event_bus.publish(event)
    
    async def _publish_risk_metrics_event(self, metrics: Dict[str, float]) -> None:
        """Publish risk metrics event."""
        event = RiskMetricsEvent(
            timestamp=datetime.utcnow(),
            var_95=metrics.get('var_95'),
            var_99=metrics.get('var_99'),
            expected_shortfall=metrics.get('expected_shortfall'),
            beta=metrics.get('beta'),
            volatility=metrics.get('annualized_volatility'),
            max_drawdown=metrics.get('max_drawdown')
        )
        await self.event_bus.publish(event)
    
    def get_risk_status(self) -> Dict[str, Any]:
        """Get current risk status summary."""
        return {
            'emergency_stop_active': self._emergency_stop_triggered,
            'current_drawdown': self._current_drawdown,
            'max_drawdown': self._max_drawdown,
            'peak_portfolio_value': self._peak_portfolio_value,
            'recent_violations': len(self._risk_violations[-10:]),  # Last 10 violations
            'risk_limits': {
                'max_position_size': self.risk_limits.max_position_size,
                'max_portfolio_exposure': self.risk_limits.max_portfolio_exposure,
                'max_daily_loss': self.risk_limits.max_daily_loss,
                'max_drawdown': self.risk_limits.max_drawdown,
                'max_correlation': self.risk_limits.max_correlation,
                'max_sector_exposure': self.risk_limits.max_sector_exposure,
            },
            'position_sizing_method': self.position_sizing_method,
        }
    
    def trigger_emergency_stop(self, reason: str = "Manual trigger") -> None:
        """Trigger emergency stop to halt all trading."""
        self._emergency_stop_triggered = True
        self._logger.critical(f"Emergency stop triggered: {reason}")
    
    def reset_emergency_stop(self) -> None:
        """Reset emergency stop to resume trading."""
        self._emergency_stop_triggered = False
        self._logger.info("Emergency stop reset - trading resumed")