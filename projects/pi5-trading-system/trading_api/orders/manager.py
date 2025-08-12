"""
Order manager for Pi5 Trading System.

Central order management system that coordinates between strategy signals,
risk management, and broker execution. Handles the complete order lifecycle
from signal generation to execution and tracking.

Features:
- Signal-to-order conversion with risk validation
- Order lifecycle management and tracking
- Multiple broker support with failover
- Position and cash management integration
- Order execution monitoring and alerts
- Performance metrics and execution analytics
- Emergency controls and circuit breakers
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from collections import defaultdict
from enum import Enum

from core.interfaces import (
    BrokerInterface, EventHandler, Order, OrderStatus, OrderType, Signal, TradingSignal
)
from core.exceptions import (
    OrderError,
    OrderValidationError,
    OrderExecutionError,
    BrokerError,
)
from risk.manager import RiskManagerImplementation
from events.event_bus import EventBus
from events.event_types import (
    SignalGeneratedEvent,
    OrderCreatedEvent,
    OrderFilledEvent,
    OrderStatusEvent,
)
from database.connection_manager import DatabaseManager


logger = logging.getLogger(__name__)


class OrderManager(EventHandler):
    """
    Central order management system.
    
    Coordinates between strategy signals, risk management, and broker execution
    to provide comprehensive order lifecycle management.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        db_manager: DatabaseManager,
        risk_manager: RiskManagerImplementation,
        primary_broker: BrokerInterface,
        backup_brokers: List[BrokerInterface] = None,
        max_orders_per_minute: int = 60,
        order_timeout_minutes: int = 60,
    ):
        """
        Initialize order manager.
        
        Args:
            event_bus: Event bus for system communication
            db_manager: Database manager for persistence
            risk_manager: Risk manager for order validation
            primary_broker: Primary broker for order execution
            backup_brokers: List of backup brokers for failover
            max_orders_per_minute: Rate limit for order submission
            order_timeout_minutes: Timeout for unfilled orders
        """
        self.event_bus = event_bus
        self.db = db_manager
        self.risk_manager = risk_manager
        self.primary_broker = primary_broker
        self.backup_brokers = backup_brokers or []
        self.max_orders_per_minute = max_orders_per_minute
        self.order_timeout_minutes = order_timeout_minutes
        
        # Order tracking
        self._orders: Dict[str, Order] = {}  # order_id -> Order
        self._broker_order_mapping: Dict[str, str] = {}  # broker_order_id -> order_id
        self._pending_signals: List[Signal] = []
        
        # Execution state
        self._is_running = False
        self._order_submission_times: List[datetime] = []
        self._current_broker = primary_broker
        self._broker_health: Dict[BrokerInterface, bool] = {primary_broker: True}
        
        # Portfolio tracking (simplified)
        self._current_portfolio = None  # Will be injected or loaded
        
        # Emergency controls
        self._emergency_stop = False
        self._max_daily_orders = 1000
        self._daily_order_count = 0
        self._last_reset_date = datetime.now().date()
        
        # Statistics
        self._stats = {
            'signals_received': 0,
            'orders_created': 0,
            'orders_filled': 0,
            'orders_cancelled': 0,
            'orders_rejected': 0,
            'risk_violations': 0,
            'broker_failures': 0,
            'total_volume': 0.0,
            'total_commissions': 0.0,
        }
        
        # Event handling
        self._handled_event_types = {
            'signal_generated',
            'order_filled',
            'order_status',
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the order manager."""
        if self._is_running:
            return
        
        self._logger.info("Starting order manager...")
        self._is_running = True
        
        # Subscribe to events
        for event_type in self._handled_event_types:
            self.event_bus.subscribe(event_type, self)
        
        # Start background tasks
        asyncio.create_task(self._order_timeout_monitor())
        asyncio.create_task(self._rate_limit_monitor())
        asyncio.create_task(self._broker_health_monitor())
        
        # Initialize broker health
        for broker in [self.primary_broker] + self.backup_brokers:
            self._broker_health[broker] = True
        
        self._logger.info("Order manager started")
    
    async def stop(self) -> None:
        """Stop the order manager."""
        if not self._is_running:
            return
        
        self._logger.info("Stopping order manager...")
        self._is_running = False
        
        # Cancel all pending orders
        pending_orders = [
            order for order in self._orders.values()
            if order.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]
        ]
        
        for order in pending_orders:
            try:
                await self._cancel_order_with_broker(order)
            except Exception as e:
                self._logger.error(f"Error cancelling order {order.order_id}: {e}")
        
        # Unsubscribe from events
        for event_type in self._handled_event_types:
            self.event_bus.unsubscribe(event_type, self)
        
        self._logger.info("Order manager stopped")
    
    async def handle(self, event) -> None:
        """Handle incoming events."""
        try:
            if isinstance(event, SignalGeneratedEvent):
                await self._handle_signal_event(event)
            elif isinstance(event, OrderFilledEvent):
                await self._handle_order_filled_event(event)
            elif isinstance(event, OrderStatusEvent):
                await self._handle_order_status_event(event)
                
        except Exception as e:
            self._logger.error(f"Error handling event {event.event_type}: {e}")
    
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can process the given event type."""
        return event_type in self._handled_event_types
    
    async def submit_order_from_signal(
        self,
        signal: Signal,
        order_type: OrderType = OrderType.MARKET,
        time_in_force: str = "DAY"
    ) -> Optional[str]:
        """
        Create and submit order from trading signal.
        
        Args:
            signal: Trading signal
            order_type: Order type (market, limit, etc.)
            time_in_force: Time in force for order
            
        Returns:
            Order ID if successful, None otherwise
        """
        try:
            # Check emergency stop
            if self._emergency_stop:
                self._logger.warning("Emergency stop active - rejecting order")
                return None
            
            # Check daily order limit
            await self._check_daily_limits()
            
            # Check rate limits
            if not await self._check_rate_limits():
                self._logger.warning("Rate limit exceeded - deferring order")
                self._pending_signals.append(signal)
                return None
            
            # Validate signal with risk manager
            if not self._current_portfolio:
                self._logger.error("No portfolio available for risk validation")
                return None
            
            is_valid, risk_violation = await self.risk_manager.validate_signal(
                signal, self._current_portfolio
            )
            
            if not is_valid:
                self._logger.warning(
                    f"Signal rejected by risk manager: {risk_violation}"
                )
                self._stats['risk_violations'] += 1
                return None
            
            # Calculate position size
            position_size = await self.risk_manager.calculate_position_size(
                signal, self._current_portfolio.total_value, signal.price
            )
            
            if position_size == 0:
                self._logger.info(f"Position size calculated as 0 for {signal.symbol}")
                return None
            
            # Create order
            order = await self._create_order_from_signal(
                signal, position_size, order_type, time_in_force
            )
            
            # Submit to broker
            order_id = await self._submit_order_to_broker(order)
            
            if order_id:
                self._stats['orders_created'] += 1
                self._daily_order_count += 1
                
                # Publish order created event
                await self._publish_order_created_event(order)
                
                self._logger.info(
                    f"Order created from signal: {order.side} {order.quantity} "
                    f"{order.symbol} @ {order.price or 'MARKET'} (ID: {order_id})"
                )
            
            return order_id
            
        except Exception as e:
            self._logger.error(f"Error creating order from signal: {e}")
            return None
    
    async def cancel_order(self, order_id: str) -> bool:
        """
        Cancel order by order ID.
        
        Args:
            order_id: Order identifier
            
        Returns:
            True if cancellation was successful
        """
        try:
            if order_id not in self._orders:
                self._logger.error(f"Order not found: {order_id}")
                return False
            
            order = self._orders[order_id]
            
            if order.status not in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]:
                self._logger.warning(
                    f"Cannot cancel order {order_id} in status {order.status}"
                )
                return False
            
            success = await self._cancel_order_with_broker(order)
            
            if success:
                self._stats['orders_cancelled'] += 1
                self._logger.info(f"Order cancelled: {order_id}")
            
            return success
            
        except Exception as e:
            self._logger.error(f"Error cancelling order {order_id}: {e}")
            return False
    
    async def get_order_status(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get order status and details."""
        if order_id not in self._orders:
            return None
        
        order = self._orders[order_id]
        return {
            'order_id': order.order_id,
            'symbol': order.symbol,
            'side': order.side,
            'quantity': order.quantity,
            'order_type': order.order_type.value,
            'price': order.price,
            'status': order.status.value,
            'filled_quantity': order.filled_quantity,
            'remaining_quantity': order.remaining_quantity,
            'average_fill_price': order.average_fill_price,
            'commission': order.commission,
            'created_at': order.created_at.isoformat(),
            'strategy_name': order.strategy_name,
        }
    
    def get_all_orders(self, status_filter: Optional[OrderStatus] = None) -> List[Dict[str, Any]]:
        """Get all orders with optional status filter."""
        orders = []
        for order in self._orders.values():
            if status_filter is None or order.status == status_filter:
                order_info = {
                    'order_id': order.order_id,
                    'symbol': order.symbol,
                    'side': order.side,
                    'quantity': order.quantity,
                    'status': order.status.value,
                    'filled_quantity': order.filled_quantity,
                    'created_at': order.created_at.isoformat(),
                    'strategy_name': order.strategy_name,
                }
                orders.append(order_info)
        
        return sorted(orders, key=lambda x: x['created_at'], reverse=True)
    
    def get_manager_stats(self) -> Dict[str, Any]:
        """Get order manager statistics."""
        active_orders = len([
            o for o in self._orders.values() 
            if o.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]
        ])
        
        return {
            **self._stats,
            'active_orders': active_orders,
            'total_orders': len(self._orders),
            'pending_signals': len(self._pending_signals),
            'daily_order_count': self._daily_order_count,
            'emergency_stop': self._emergency_stop,
            'current_broker': self._current_broker.__class__.__name__,
            'is_running': self._is_running,
        }
    
    # Event handlers
    
    async def _handle_signal_event(self, event: SignalGeneratedEvent) -> None:
        """Handle signal generated events."""
        self._stats['signals_received'] += 1
        
        # Convert event to signal object
        signal = Signal(
            symbol=event.symbol,
            signal_type=TradingSignal(event.signal_type),
            confidence=event.confidence,
            price=event.price,
            timestamp=event.timestamp,
            strategy_name=event.strategy_name,
            metadata=event.metadata
        )
        
        # Create order from signal
        await self.submit_order_from_signal(signal)
    
    async def _handle_order_filled_event(self, event: OrderFilledEvent) -> None:
        """Handle order fill events."""
        self._stats['orders_filled'] += 1
        self._stats['total_volume'] += event.quantity * event.price
        self._stats['total_commissions'] += event.commission
        
        # Update order tracking if it's our order
        if event.order_id in self._orders:
            order = self._orders[event.order_id]
            self._logger.info(
                f"Order fill confirmed: {order.symbol} {event.quantity} @ {event.price}"
            )
    
    async def _handle_order_status_event(self, event: OrderStatusEvent) -> None:
        """Handle order status change events."""
        if event.new_status == 'rejected':
            self._stats['orders_rejected'] += 1
    
    # Order creation and submission
    
    async def _create_order_from_signal(
        self,
        signal: Signal,
        quantity: float,
        order_type: OrderType,
        time_in_force: str
    ) -> Order:
        """Create order object from signal."""
        order_id = f"ORD_{uuid.uuid4().hex[:12].upper()}"
        
        # Determine order side
        side = 'buy' if signal.signal_type in [TradingSignal.BUY] else 'sell'
        
        # Set price for limit orders
        price = None
        if order_type == OrderType.LIMIT:
            price = signal.price
        
        order = Order(
            order_id=order_id,
            symbol=signal.symbol,
            side=side,
            quantity=quantity,
            order_type=order_type,
            price=price,
            time_in_force=time_in_force,
            strategy_name=signal.strategy_name,
            created_at=datetime.utcnow(),
            status=OrderStatus.PENDING
        )
        
        # Store order
        self._orders[order_id] = order
        
        return order
    
    async def _submit_order_to_broker(self, order: Order) -> Optional[str]:
        """Submit order to broker with failover."""
        for broker in [self._current_broker] + self.backup_brokers:
            if not self._broker_health.get(broker, False):
                continue
            
            try:
                broker_order_id = await broker.submit_order(order)
                
                # Store broker order mapping
                self._broker_order_mapping[broker_order_id] = order.order_id
                
                # Update order submission tracking
                self._order_submission_times.append(datetime.utcnow())
                
                return order.order_id
                
            except Exception as e:
                self._logger.error(f"Broker order submission failed: {e}")
                self._stats['broker_failures'] += 1
                self._broker_health[broker] = False
                
                # Try next broker
                continue
        
        # All brokers failed
        self._logger.error("All brokers failed - order not submitted")
        order.status = OrderStatus.REJECTED
        return None
    
    async def _cancel_order_with_broker(self, order: Order) -> bool:
        """Cancel order with broker."""
        # Find broker order ID
        broker_order_id = None
        for bid, oid in self._broker_order_mapping.items():
            if oid == order.order_id:
                broker_order_id = bid
                break
        
        if not broker_order_id:
            self._logger.error(f"Broker order ID not found for {order.order_id}")
            return False
        
        try:
            success = await self._current_broker.cancel_order(broker_order_id)
            return success
            
        except Exception as e:
            self._logger.error(f"Broker cancellation failed: {e}")
            return False
    
    # Background monitoring tasks
    
    async def _order_timeout_monitor(self) -> None:
        """Monitor orders for timeout."""
        while self._is_running:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                timeout_threshold = datetime.utcnow() - timedelta(minutes=self.order_timeout_minutes)
                
                for order in list(self._orders.values()):
                    if (order.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED] and
                        order.created_at < timeout_threshold):
                        
                        self._logger.warning(f"Order {order.order_id} timed out - cancelling")
                        await self.cancel_order(order.order_id)
                
            except Exception as e:
                self._logger.error(f"Order timeout monitor error: {e}")
    
    async def _rate_limit_monitor(self) -> None:
        """Process pending signals when rate limits allow."""
        while self._is_running:
            try:
                await asyncio.sleep(1)  # Check every second
                
                if self._pending_signals and await self._check_rate_limits():
                    signal = self._pending_signals.pop(0)
                    await self.submit_order_from_signal(signal)
                
            except Exception as e:
                self._logger.error(f"Rate limit monitor error: {e}")
    
    async def _broker_health_monitor(self) -> None:
        """Monitor broker health and perform failover."""
        while self._is_running:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                # Check current broker health
                try:
                    account_info = await self._current_broker.get_account_info()
                    self._broker_health[self._current_broker] = True
                except Exception:
                    self._broker_health[self._current_broker] = False
                    self._logger.warning("Primary broker health check failed")
                
                # Switch to backup broker if needed
                if not self._broker_health[self._current_broker] and self.backup_brokers:
                    for backup_broker in self.backup_brokers:
                        try:
                            await backup_broker.get_account_info()
                            self._current_broker = backup_broker
                            self._broker_health[backup_broker] = True
                            self._logger.info(f"Switched to backup broker: {backup_broker.__class__.__name__}")
                            break
                        except Exception:
                            continue
                
            except Exception as e:
                self._logger.error(f"Broker health monitor error: {e}")
    
    # Helper methods
    
    async def _check_rate_limits(self) -> bool:
        """Check if rate limits allow order submission."""
        current_time = datetime.utcnow()
        minute_ago = current_time - timedelta(minutes=1)
        
        # Clean old timestamps
        self._order_submission_times = [
            t for t in self._order_submission_times if t > minute_ago
        ]
        
        return len(self._order_submission_times) < self.max_orders_per_minute
    
    async def _check_daily_limits(self) -> None:
        """Check and reset daily order limits."""
        current_date = datetime.now().date()
        
        if current_date > self._last_reset_date:
            self._daily_order_count = 0
            self._last_reset_date = current_date
        
        if self._daily_order_count >= self._max_daily_orders:
            raise OrderError(f"Daily order limit exceeded: {self._max_daily_orders}")
    
    async def _publish_order_created_event(self, order: Order) -> None:
        """Publish order created event."""
        event = OrderCreatedEvent(
            order_id=order.order_id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            order_type=order.order_type.value,
            price=order.price,
            stop_price=order.stop_price,
            strategy_name=order.strategy_name,
            timestamp=order.created_at
        )
        await self.event_bus.publish(event)
    
    def set_portfolio(self, portfolio) -> None:
        """Set current portfolio for risk validation."""
        self._current_portfolio = portfolio
    
    def trigger_emergency_stop(self, reason: str = "Manual trigger") -> None:
        """Trigger emergency stop."""
        self._emergency_stop = True
        self._logger.critical(f"Emergency stop triggered: {reason}")
    
    def reset_emergency_stop(self) -> None:
        """Reset emergency stop."""
        self._emergency_stop = False
        self._logger.info("Emergency stop reset")