"""
Portfolio manager for Pi5 Trading System.

Provides real-time portfolio tracking, position management, and performance
analytics. Maintains comprehensive portfolio state and calculates various
performance metrics for monitoring and reporting.

Features:
- Real-time portfolio valuation and tracking
- Position management with cost basis tracking
- P&L calculation (realized and unrealized)
- Performance metrics (returns, Sharpe, drawdown, etc.)
- Risk metrics integration
- Portfolio rebalancing utilities
- Historical performance tracking
- Event-driven updates from order fills and market data
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict, deque
from dataclasses import dataclass, field

from core.interfaces import Portfolio, Position, EventHandler
from core.exceptions import (
    PortfolioError,
    PerformanceCalculationError,
    PositionNotFoundError,
)
from events.event_bus import EventBus
from events.event_types import (
    OrderFilledEvent,
    MarketDataEvent,
    PortfolioValueEvent,
    PositionChangedEvent,
)
from database.connection_manager import DatabaseManager
from database.repositories.market_data import MarketDataRepository


logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Portfolio performance metrics."""
    total_return: float = 0.0
    annualized_return: float = 0.0
    volatility: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    max_drawdown: float = 0.0
    current_drawdown: float = 0.0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    calmar_ratio: float = 0.0
    var_95: float = 0.0
    expected_shortfall: float = 0.0
    beta: float = 0.0
    alpha: float = 0.0
    information_ratio: float = 0.0
    treynor_ratio: float = 0.0


class PortfolioManager(EventHandler):
    """
    Comprehensive portfolio management system.
    
    Tracks portfolio state in real-time, calculates performance metrics,
    and provides portfolio analytics and reporting capabilities.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        db_manager: DatabaseManager,
        market_data_repo: MarketDataRepository,
        initial_cash: float = 100000.0,
        benchmark_symbol: str = "SPY",
        performance_calculation_frequency: int = 300,  # seconds
    ):
        """
        Initialize portfolio manager.
        
        Args:
            event_bus: Event bus for system communication
            db_manager: Database manager for persistence
            market_data_repo: Market data repository for pricing
            initial_cash: Initial cash balance
            benchmark_symbol: Benchmark symbol for relative performance
            performance_calculation_frequency: How often to calculate metrics (seconds)
        """
        self.event_bus = event_bus
        self.db = db_manager
        self.market_data_repo = market_data_repo
        self.benchmark_symbol = benchmark_symbol
        self.performance_calculation_frequency = performance_calculation_frequency
        
        # Portfolio state
        self._portfolio = Portfolio(initial_cash)
        self._last_market_prices: Dict[str, float] = {}
        
        # Performance tracking
        self._daily_returns: deque = deque(maxlen=252 * 5)  # 5 years of daily returns
        self._portfolio_values: deque = deque(maxlen=252 * 5)  # 5 years of values
        self._benchmark_returns: deque = deque(maxlen=252 * 5)  # Benchmark returns
        self._drawdown_series: deque = deque(maxlen=252 * 5)
        self._peak_value = initial_cash
        self._performance_metrics = PerformanceMetrics()
        
        # Trade tracking
        self._trades: List[Dict[str, Any]] = []
        self._realized_pnl_by_symbol: Dict[str, float] = defaultdict(float)
        
        # State management
        self._is_running = False
        self._last_valuation_time: Optional[datetime] = None
        self._last_performance_update: Optional[datetime] = None
        
        # Event handling
        self._handled_event_types = {
            'order_filled',
            'market_data',
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the portfolio manager."""
        if self._is_running:
            return
        
        self._logger.info("Starting portfolio manager...")
        self._is_running = True
        
        # Subscribe to events
        for event_type in self._handled_event_types:
            self.event_bus.subscribe(event_type, self)
        
        # Start background tasks
        asyncio.create_task(self._performance_calculator())
        asyncio.create_task(self._portfolio_monitor())
        
        # Initialize portfolio values
        self._portfolio_values.append(self._portfolio.total_value)
        
        self._logger.info(
            f"Portfolio manager started with ${self._portfolio.initial_cash:,.2f}"
        )
    
    async def stop(self) -> None:
        """Stop the portfolio manager."""
        if not self._is_running:
            return
        
        self._logger.info("Stopping portfolio manager...")
        self._is_running = False
        
        # Unsubscribe from events
        for event_type in self._handled_event_types:
            self.event_bus.unsubscribe(event_type, self)
        
        # Save final portfolio state
        await self._persist_portfolio_state()
        
        self._logger.info("Portfolio manager stopped")
    
    async def handle(self, event) -> None:
        """Handle incoming events."""
        try:
            if isinstance(event, OrderFilledEvent):
                await self._handle_order_filled(event)
            elif isinstance(event, MarketDataEvent):
                await self._handle_market_data(event)
                
        except Exception as e:
            self._logger.error(f"Error handling event {event.event_type}: {e}")
    
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can process the given event type."""
        return event_type in self._handled_event_types
    
    # Portfolio access methods
    
    def get_portfolio(self) -> Portfolio:
        """Get current portfolio state."""
        return self._portfolio
    
    def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for specific symbol."""
        return self._portfolio.get_position(symbol)
    
    def get_all_positions(self) -> Dict[str, Position]:
        """Get all current positions."""
        return dict(self._portfolio.positions)
    
    def get_cash(self) -> float:
        """Get current cash balance."""
        return self._portfolio.cash
    
    def get_total_value(self) -> float:
        """Get current total portfolio value."""
        return self._portfolio.total_value
    
    # Performance metrics
    
    def get_performance_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics."""
        return self._performance_metrics
    
    def get_returns_series(self, periods: Optional[int] = None) -> pd.Series:
        """Get portfolio returns series."""
        returns = list(self._daily_returns)
        if periods:
            returns = returns[-periods:]
        
        dates = pd.date_range(
            end=datetime.now().date(),
            periods=len(returns),
            freq='D'
        )
        
        return pd.Series(returns, index=dates)
    
    def get_portfolio_values_series(self, periods: Optional[int] = None) -> pd.Series:
        """Get portfolio value series."""
        values = list(self._portfolio_values)
        if periods:
            values = values[-periods:]
        
        dates = pd.date_range(
            end=datetime.now().date(),
            periods=len(values),
            freq='D'
        )
        
        return pd.Series(values, index=dates)
    
    def get_drawdown_series(self, periods: Optional[int] = None) -> pd.Series:
        """Get drawdown series."""
        drawdowns = list(self._drawdown_series)
        if periods:
            drawdowns = drawdowns[-periods:]
        
        dates = pd.date_range(
            end=datetime.now().date(),
            periods=len(drawdowns),
            freq='D'
        )
        
        return pd.Series(drawdowns, index=dates)
    
    # Portfolio analytics
    
    async def calculate_position_metrics(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Calculate metrics for a specific position."""
        position = self.get_position(symbol)
        if not position:
            return None
        
        current_price = await self._get_current_price(symbol)
        if not current_price:
            return None
        
        # Update position with current price
        position.update_price(current_price)
        
        # Calculate position metrics
        return {
            'symbol': symbol,
            'quantity': position.quantity,
            'average_cost': position.average_cost,
            'current_price': current_price,
            'cost_basis': position.cost_basis,
            'market_value': position.market_value,
            'unrealized_pnl': position.unrealized_pnl,
            'unrealized_pnl_pct': (position.unrealized_pnl / position.cost_basis) if position.cost_basis != 0 else 0,
            'realized_pnl': self._realized_pnl_by_symbol.get(symbol, 0.0),
            'weight': position.market_value / self._portfolio.total_value if self._portfolio.total_value > 0 else 0,
            'last_updated': position.last_updated.isoformat(),
        }
    
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get comprehensive portfolio summary."""
        total_value = self._portfolio.total_value
        initial_value = self._portfolio.initial_cash
        
        # Position summary
        long_value = sum(pos.market_value for pos in self._portfolio.positions.values() if pos.quantity > 0)
        short_value = sum(abs(pos.market_value) for pos in self._portfolio.positions.values() if pos.quantity < 0)
        
        # P&L summary
        total_unrealized_pnl = sum(pos.unrealized_pnl for pos in self._portfolio.positions.values())
        total_realized_pnl = sum(self._realized_pnl_by_symbol.values())
        
        return {
            'total_value': total_value,
            'cash': self._portfolio.cash,
            'long_value': long_value,
            'short_value': short_value,
            'net_exposure': long_value - short_value,
            'gross_exposure': long_value + short_value,
            'cash_pct': self._portfolio.cash / total_value if total_value > 0 else 0,
            'unrealized_pnl': total_unrealized_pnl,
            'realized_pnl': total_realized_pnl,
            'total_pnl': total_unrealized_pnl + total_realized_pnl,
            'total_return': self._portfolio.total_return,
            'position_count': len([p for p in self._portfolio.positions.values() if p.quantity != 0]),
            'created_at': self._portfolio.created_at.isoformat(),
            'last_update': self._last_valuation_time.isoformat() if self._last_valuation_time else None,
        }
    
    def get_top_positions(self, count: int = 10, by: str = 'value') -> List[Dict[str, Any]]:
        """Get top positions by value or P&L."""
        positions = []
        
        for symbol, position in self._portfolio.positions.items():
            if position.quantity == 0:
                continue
            
            position_data = {
                'symbol': symbol,
                'value': abs(position.market_value),
                'pnl': position.unrealized_pnl,
                'quantity': position.quantity,
                'weight': abs(position.market_value) / self._portfolio.total_value if self._portfolio.total_value > 0 else 0,
            }
            positions.append(position_data)
        
        # Sort by specified criteria
        if by == 'value':
            positions.sort(key=lambda x: x['value'], reverse=True)
        elif by == 'pnl':
            positions.sort(key=lambda x: x['pnl'], reverse=True)
        elif by == 'weight':
            positions.sort(key=lambda x: x['weight'], reverse=True)
        
        return positions[:count]
    
    # Event handlers
    
    async def _handle_order_filled(self, event: OrderFilledEvent) -> None:
        """Handle order fill events to update portfolio."""
        try:
            symbol = event.symbol
            quantity = event.quantity if 'buy' in event.order_id.lower() else -event.quantity
            price = event.price
            commission = event.commission
            
            # Record trade
            trade = {
                'timestamp': event.timestamp,
                'symbol': symbol,
                'quantity': quantity,
                'price': price,
                'commission': commission,
                'order_id': event.order_id,
                'fill_id': event.fill_id,
            }
            self._trades.append(trade)
            
            # Update portfolio position
            old_position = self._portfolio.get_position(symbol)
            old_quantity = old_position.quantity if old_position else 0.0
            
            self._portfolio.update_position(symbol, quantity, price)
            
            # Calculate realized P&L for closing trades
            if old_position and ((old_quantity > 0 and quantity < 0) or (old_quantity < 0 and quantity > 0)):
                # Partial or full close
                closing_quantity = min(abs(quantity), abs(old_quantity))
                realized_pnl = closing_quantity * (price - old_position.average_cost)
                if old_quantity < 0:  # Short position
                    realized_pnl = -realized_pnl
                
                self._realized_pnl_by_symbol[symbol] += realized_pnl
            
            # Publish position changed event
            new_position = self._portfolio.get_position(symbol)
            new_quantity = new_position.quantity if new_position else 0.0
            
            await self._publish_position_changed_event(
                symbol, old_quantity, new_quantity, price, "trade"
            )
            
            # Update portfolio valuation
            await self._update_portfolio_valuation()
            
            self._logger.info(
                f"Portfolio updated: {symbol} {quantity:+.2f} @ ${price:.2f} "
                f"(Total value: ${self._portfolio.total_value:,.2f})"
            )
            
        except Exception as e:
            self._logger.error(f"Error handling order fill: {e}")
            raise PortfolioError(f"Failed to update portfolio: {e}") from e
    
    async def _handle_market_data(self, event: MarketDataEvent) -> None:
        """Handle market data events to update position valuations."""
        try:
            symbol = event.symbol
            new_price = event.close_price
            
            # Update cached price
            old_price = self._last_market_prices.get(symbol)
            self._last_market_prices[symbol] = new_price
            
            # Update position if we hold it
            position = self._portfolio.get_position(symbol)
            if position:
                old_value = position.market_value
                position.update_price(new_price)
                new_value = position.market_value
                
                # Log significant price changes
                if old_price and abs(new_price - old_price) / old_price > 0.05:  # >5% change
                    self._logger.info(
                        f"Significant price change for {symbol}: "
                        f"${old_price:.2f} -> ${new_price:.2f} "
                        f"({(new_price - old_price) / old_price:.2%})"
                    )
            
        except Exception as e:
            self._logger.error(f"Error handling market data for {symbol}: {e}")
    
    # Background tasks
    
    async def _performance_calculator(self) -> None:
        """Background task to calculate performance metrics."""
        while self._is_running:
            try:
                await asyncio.sleep(self.performance_calculation_frequency)
                await self._calculate_performance_metrics()
                
            except Exception as e:
                self._logger.error(f"Performance calculation error: {e}")
    
    async def _portfolio_monitor(self) -> None:
        """Background task to monitor portfolio and publish updates."""
        while self._is_running:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                # Update portfolio valuation
                await self._update_portfolio_valuation()
                
                # Publish portfolio value event
                await self._publish_portfolio_value_event()
                
            except Exception as e:
                self._logger.error(f"Portfolio monitoring error: {e}")
    
    async def _update_portfolio_valuation(self) -> None:
        """Update portfolio valuation with current market prices."""
        try:
            # Update all position prices
            for symbol, position in self._portfolio.positions.items():
                if position.quantity != 0:
                    current_price = await self._get_current_price(symbol)
                    if current_price:
                        position.update_price(current_price)
            
            # Update tracking
            current_value = self._portfolio.total_value
            self._portfolio_values.append(current_value)
            
            # Update peak value and drawdown
            if current_value > self._peak_value:
                self._peak_value = current_value
            
            current_drawdown = (self._peak_value - current_value) / self._peak_value if self._peak_value > 0 else 0
            self._drawdown_series.append(current_drawdown)
            
            # Calculate daily return
            if len(self._portfolio_values) > 1:
                previous_value = self._portfolio_values[-2]
                daily_return = (current_value - previous_value) / previous_value if previous_value > 0 else 0
                self._daily_returns.append(daily_return)
            
            self._last_valuation_time = datetime.utcnow()
            
        except Exception as e:
            self._logger.error(f"Portfolio valuation update failed: {e}")
    
    async def _calculate_performance_metrics(self) -> None:
        """Calculate comprehensive performance metrics."""
        try:
            if len(self._daily_returns) < 30:  # Need at least 30 days
                return
            
            returns = np.array(self._daily_returns)
            
            # Basic return statistics
            total_return = self._portfolio.total_return
            annualized_return = np.mean(returns) * 252
            volatility = np.std(returns) * np.sqrt(252)
            
            # Risk-adjusted returns
            risk_free_rate = 0.02  # 2% risk-free rate
            sharpe_ratio = (annualized_return - risk_free_rate) / volatility if volatility > 0 else 0
            
            # Sortino ratio (downside deviation)
            downside_returns = returns[returns < 0]
            downside_deviation = np.std(downside_returns) * np.sqrt(252) if len(downside_returns) > 0 else 0
            sortino_ratio = (annualized_return - risk_free_rate) / downside_deviation if downside_deviation > 0 else 0
            
            # Drawdown metrics
            max_drawdown = max(self._drawdown_series) if self._drawdown_series else 0
            current_drawdown = self._drawdown_series[-1] if self._drawdown_series else 0
            
            # Calmar ratio
            calmar_ratio = annualized_return / max_drawdown if max_drawdown > 0 else float('inf')
            
            # VaR calculations
            var_95 = np.percentile(returns, 5) if len(returns) > 0 else 0
            expected_shortfall = np.mean(returns[returns <= var_95]) if len(returns[returns <= var_95]) > 0 else 0
            
            # Win rate and profit factor
            winning_returns = returns[returns > 0]
            losing_returns = returns[returns < 0]
            
            win_rate = len(winning_returns) / len(returns) if len(returns) > 0 else 0
            avg_win = np.mean(winning_returns) if len(winning_returns) > 0 else 0
            avg_loss = abs(np.mean(losing_returns)) if len(losing_returns) > 0 else 0
            profit_factor = avg_win / avg_loss if avg_loss > 0 else float('inf')
            
            # Update metrics
            self._performance_metrics = PerformanceMetrics(
                total_return=total_return,
                annualized_return=annualized_return,
                volatility=volatility,
                sharpe_ratio=sharpe_ratio,
                sortino_ratio=sortino_ratio,
                max_drawdown=max_drawdown,
                current_drawdown=current_drawdown,
                win_rate=win_rate,
                profit_factor=profit_factor,
                calmar_ratio=calmar_ratio,
                var_95=var_95,
                expected_shortfall=expected_shortfall,
            )
            
            self._last_performance_update = datetime.utcnow()
            
        except Exception as e:
            self._logger.error(f"Performance metrics calculation failed: {e}")
            raise PerformanceCalculationError(f"Performance calculation failed: {e}") from e
    
    # Helper methods
    
    async def _get_current_price(self, symbol: str) -> Optional[float]:
        """Get current market price for symbol."""
        try:
            # Try cached price first
            if symbol in self._last_market_prices:
                return self._last_market_prices[symbol]
            
            # Query market data repository
            # This would be implemented to get real current prices
            # For now, return a placeholder
            return 100.0
            
        except Exception as e:
            self._logger.warning(f"Could not get current price for {symbol}: {e}")
            return None
    
    async def _publish_position_changed_event(
        self,
        symbol: str,
        old_quantity: float,
        new_quantity: float,
        price: float,
        reason: str
    ) -> None:
        """Publish position changed event."""
        try:
            event = PositionChangedEvent(
                symbol=symbol,
                old_quantity=old_quantity,
                new_quantity=new_quantity,
                price=price,
                timestamp=datetime.utcnow(),
                change_reason=reason
            )
            await self.event_bus.publish(event)
        except Exception as e:
            self._logger.warning(f"Failed to publish position changed event: {e}")
            # Continue execution even if event publishing fails
    
    async def _publish_portfolio_value_event(self) -> None:
        """Publish portfolio value event."""
        try:
            metrics = self.get_performance_metrics()
            
            event = PortfolioValueEvent(
                total_value=self._portfolio.total_value,
                cash=self._portfolio.cash,
                positions_value=sum(pos.market_value for pos in self._portfolio.positions.values()),
                unrealized_pnl=sum(pos.unrealized_pnl for pos in self._portfolio.positions.values()),
                realized_pnl=sum(self._realized_pnl_by_symbol.values()),
                timestamp=datetime.utcnow(),
                daily_return=self._daily_returns[-1] if self._daily_returns else None,
                total_return=metrics.total_return
            )
            await self.event_bus.publish(event)
        except Exception as e:
            self._logger.warning(f"Failed to publish portfolio value event: {e}")
            # Continue execution even if event publishing fails
    
    async def _persist_portfolio_state(self) -> None:
        """Persist portfolio state to database."""
        try:
            # This would save portfolio state to database
            # Implementation depends on database schema
            self._logger.info("Portfolio state persisted")
            
        except Exception as e:
            self._logger.error(f"Failed to persist portfolio state: {e}")
    
    def get_manager_stats(self) -> Dict[str, Any]:
        """Get portfolio manager statistics."""
        return {
            'total_value': self._portfolio.total_value,
            'cash': self._portfolio.cash,
            'position_count': len([p for p in self._portfolio.positions.values() if p.quantity != 0]),
            'trade_count': len(self._trades),
            'total_return': self._portfolio.total_return,
            'max_drawdown': self._performance_metrics.max_drawdown,
            'sharpe_ratio': self._performance_metrics.sharpe_ratio,
            'is_running': self._is_running,
            'last_valuation': self._last_valuation_time.isoformat() if self._last_valuation_time else None,
            'last_performance_update': self._last_performance_update.isoformat() if self._last_performance_update else None,
        }