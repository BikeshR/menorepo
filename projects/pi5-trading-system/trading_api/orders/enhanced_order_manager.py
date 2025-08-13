"""
Enhanced Order Manager for Pi5 Trading System.

Advanced order management with multi-broker support, intelligent routing,
and comprehensive execution confirmation handling.

Features:
- Multi-broker order routing with intelligent selection
- Advanced order execution confirmation and tracking
- Real-time order status monitoring and updates
- Order execution analytics and performance metrics
- Enhanced error handling and recovery
- Order execution algorithms (TWAP, VWAP, etc.)
- Smart order routing (SOR) capabilities
- Order lifecycle management with detailed audit trail
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict
from enum import Enum
from dataclasses import dataclass

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
    OrderRejectedEvent,
)
from database.connection_manager import DatabaseManager
from .brokers.broker_manager import BrokerManager, BrokerConfig, BrokerType, FailoverStrategy


logger = logging.getLogger(__name__)


class ExecutionAlgorithm(Enum):
    """Order execution algorithms."""
    MARKET = "market"
    TWAP = "twap"  # Time-Weighted Average Price
    VWAP = "vwap"  # Volume-Weighted Average Price
    IMPLEMENTATION_SHORTFALL = "implementation_shortfall"
    PARTICIPATION_RATE = "participation_rate"


@dataclass
class OrderExecutionParams:
    """Order execution parameters."""
    algorithm: ExecutionAlgorithm = ExecutionAlgorithm.MARKET
    max_participation_rate: float = 0.1  # Max % of volume
    time_horizon_minutes: int = 60  # Execution time horizon
    price_limit: Optional[float] = None  # Price limit for execution
    urgency: float = 0.5  # 0=patient, 1=aggressive
    allow_cross_venue: bool = True  # Allow cross-venue execution
    dark_pool_preference: float = 0.0  # Preference for dark pools (0-1)


@dataclass
class ExecutionConfirmation:
    """Order execution confirmation details."""
    order_id: str
    fill_id: str
    symbol: str
    quantity: float
    price: float
    commission: float
    timestamp: datetime
    broker_name: str
    execution_venue: str
    liquidity_flag: str  # "ADD", "REMOVE", "ROUTED"
    execution_quality: Dict[str, float]  # Slippage, speed, etc.
    order_book_state: Optional[Dict[str, Any]] = None


class EnhancedOrderManager(EventHandler):
    """
    Enhanced order management system with multi-broker support.
    
    Provides intelligent order routing, execution algorithms, and comprehensive
    execution confirmation handling across multiple brokers.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        db_manager: DatabaseManager,
        risk_manager: RiskManagerImplementation,
        broker_manager: BrokerManager,
        max_orders_per_minute: int = 60,
        order_timeout_minutes: int = 60,
        enable_smart_routing: bool = True,
        execution_quality_threshold: float = 0.8,
    ):
        """
        Initialize enhanced order manager.
        
        Args:
            event_bus: Event bus for system communication
            db_manager: Database manager for persistence
            risk_manager: Risk manager for order validation
            broker_manager: Multi-broker manager
            max_orders_per_minute: Rate limit for order submission
            order_timeout_minutes: Timeout for unfilled orders
            enable_smart_routing: Enable smart order routing
            execution_quality_threshold: Minimum execution quality score
        """
        self.event_bus = event_bus
        self.db = db_manager
        self.risk_manager = risk_manager
        self.broker_manager = broker_manager
        self.max_orders_per_minute = max_orders_per_minute
        self.order_timeout_minutes = order_timeout_minutes
        self.enable_smart_routing = enable_smart_routing
        self.execution_quality_threshold = execution_quality_threshold
        
        # Order tracking
        self._orders: Dict[str, Order] = {}  # order_id -> Order
        self._order_executions: Dict[str, List[ExecutionConfirmation]] = {}  # order_id -> confirmations
        self._pending_signals: List[Signal] = []
        self._order_execution_params: Dict[str, OrderExecutionParams] = {}  # order_id -> params
        
        # Execution state
        self._is_running = False
        self._order_submission_times: List[datetime] = []
        
        # Portfolio tracking
        self._current_portfolio = None
        
        # Emergency controls
        self._emergency_stop = False
        self._max_daily_orders = 1000
        self._daily_order_count = 0
        self._last_reset_date = datetime.now().date()
        
        # Execution analytics
        self._execution_metrics = {
            'total_orders': 0,
            'successful_orders': 0,
            'failed_orders': 0,
            'avg_execution_time': 0.0,
            'avg_slippage': 0.0,
            'avg_commission': 0.0,
            'execution_quality_score': 0.0,
            'broker_performance': defaultdict(dict),
        }
        
        # Smart routing state
        self._venue_performance: Dict[str, Dict[str, float]] = defaultdict(dict)
        self._symbol_routing_preferences: Dict[str, str] = {}  # symbol -> preferred_broker
        
        # Event handling
        self._handled_event_types = {
            'signal_generated',
            'order_filled',
            'order_status',
            'order_rejected',
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the enhanced order manager."""
        if self._is_running:
            return
        
        self._logger.info("Starting enhanced order manager...")
        self._is_running = True
        
        # Start broker manager
        await self.broker_manager.start()
        
        # Subscribe to events
        for event_type in self._handled_event_types:
            self.event_bus.subscribe(event_type, self)
        
        # Start background tasks
        asyncio.create_task(self._order_timeout_monitor())
        asyncio.create_task(self._rate_limit_monitor())
        asyncio.create_task(self._execution_analytics_processor())
        asyncio.create_task(self._smart_routing_optimizer())
        
        self._logger.info("Enhanced order manager started")
    
    async def stop(self) -> None:
        """Stop the enhanced order manager."""
        if not self._is_running:
            return
        
        self._logger.info("Stopping enhanced order manager...")
        self._is_running = False
        
        # Cancel all pending orders
        for order_id in list(self._orders.keys()):
            order = self._orders[order_id]
            if order.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]:
                try:
                    await self.cancel_order(order_id)
                except Exception as e:
                    self._logger.error(f"Error cancelling order {order_id}: {e}")
        
        # Stop broker manager
        await self.broker_manager.stop()
        
        # Unsubscribe from events
        for event_type in self._handled_event_types:
            self.event_bus.unsubscribe(event_type, self)
        
        self._logger.info("Enhanced order manager stopped")
    
    async def handle(self, event) -> None:
        """Handle incoming events."""
        try:
            if isinstance(event, SignalGeneratedEvent):
                await self._handle_signal_event(event)
            elif isinstance(event, OrderFilledEvent):
                await self._handle_order_filled_event(event)
            elif isinstance(event, OrderStatusEvent):
                await self._handle_order_status_event(event)
            elif hasattr(event, 'event_type') and event.event_type == 'order_rejected':
                await self._handle_order_rejected_event(event)
                
        except Exception as e:
            self._logger.error(f"Error handling event {getattr(event, 'event_type', type(event))}: {e}")
    
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can process the given event type."""
        return event_type in self._handled_event_types
    
    async def submit_order_with_algorithm(
        self,
        signal: Signal,
        execution_params: OrderExecutionParams,
        order_type: OrderType = OrderType.MARKET,
        time_in_force: str = "DAY"
    ) -> Optional[str]:
        """
        Submit order with specific execution algorithm.
        
        Args:
            signal: Trading signal
            execution_params: Execution algorithm parameters
            order_type: Order type
            time_in_force: Time in force
            
        Returns:
            Order ID if successful
        """
        try:
            # Create and submit order
            order_id = await self.submit_order_from_signal(signal, order_type, time_in_force)
            
            if order_id:
                # Store execution parameters
                self._order_execution_params[order_id] = execution_params
                
                # Start execution algorithm
                if execution_params.algorithm != ExecutionAlgorithm.MARKET:
                    asyncio.create_task(self._execute_algorithm(order_id, execution_params))
            
            return order_id
            
        except Exception as e:
            self._logger.error(f"Error submitting order with algorithm: {e}")
            return None
    
    async def submit_order_from_signal(
        self,
        signal: Signal,
        order_type: OrderType = OrderType.MARKET,
        time_in_force: str = "DAY"
    ) -> Optional[str]:
        """
        Create and submit order from trading signal with enhanced routing.
        
        Args:
            signal: Trading signal
            order_type: Order type
            time_in_force: Time in force
            
        Returns:
            Order ID if successful
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
                self._logger.warning(f"Signal rejected by risk manager: {risk_violation}")
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
            
            # Submit through broker manager with enhanced routing
            order_id, broker_name = await self.broker_manager.submit_order(order)
            
            if order_id:
                self._execution_metrics['total_orders'] += 1
                self._daily_order_count += 1
                
                # Initialize execution tracking
                self._order_executions[order_id] = []
                
                # Publish order created event
                await self._publish_order_created_event(order, broker_name)
                
                self._logger.info(
                    f"Order created with enhanced routing: {order.side} {order.quantity} "
                    f"{order.symbol} @ {order.price or 'MARKET'} via {broker_name} (ID: {order_id})"
                )
            
            return order_id
            
        except Exception as e:
            self._logger.error(f"Error creating order from signal: {e}")
            return None
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel order through broker manager."""
        try:
            result = await self.broker_manager.cancel_order(order_id)
            
            if result:
                self._logger.info(f"Order cancelled: {order_id}")
            
            return result
            
        except Exception as e:
            self._logger.error(f"Error cancelling order {order_id}: {e}")
            return False
    
    async def get_order_execution_details(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed execution information for an order."""
        if order_id not in self._orders:
            return None
        
        order = self._orders[order_id]
        executions = self._order_executions.get(order_id, [])
        execution_params = self._order_execution_params.get(order_id)
        
        # Calculate execution quality metrics
        quality_metrics = self._calculate_execution_quality(order, executions)
        
        return {
            'order_id': order_id,
            'order_details': {
                'symbol': order.symbol,
                'side': order.side,
                'quantity': order.quantity,
                'order_type': order.order_type.value,
                'status': order.status.value,
                'created_at': order.created_at.isoformat(),
                'strategy_name': order.strategy_name,
            },
            'execution_params': execution_params.__dict__ if execution_params else None,
            'executions': [
                {
                    'fill_id': exec.fill_id,
                    'quantity': exec.quantity,
                    'price': exec.price,
                    'commission': exec.commission,
                    'timestamp': exec.timestamp.isoformat(),
                    'broker_name': exec.broker_name,
                    'execution_venue': exec.execution_venue,
                    'liquidity_flag': exec.liquidity_flag,
                }
                for exec in executions
            ],
            'quality_metrics': quality_metrics,
            'total_executed': sum(exec.quantity for exec in executions),
            'volume_weighted_price': self._calculate_vwap(executions),
            'total_commission': sum(exec.commission for exec in executions),
        }
    
    def get_execution_analytics(self) -> Dict[str, Any]:
        """Get comprehensive execution analytics."""
        broker_stats = self.broker_manager.get_manager_stats()
        
        return {
            **self._execution_metrics,
            'broker_manager_stats': broker_stats,
            'smart_routing_enabled': self.enable_smart_routing,
            'venue_performance': dict(self._venue_performance),
            'symbol_routing_preferences': self._symbol_routing_preferences.copy(),
            'orders_in_flight': len([
                o for o in self._orders.values()
                if o.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]
            ]),
            'pending_signals': len(self._pending_signals),
        }
    
    # Event handlers
    
    async def _handle_signal_event(self, event: SignalGeneratedEvent) -> None:
        """Handle signal generated events."""
        signal = Signal(
            symbol=event.symbol,
            signal_type=TradingSignal(event.signal_type),
            confidence=event.confidence,
            price=event.price,
            timestamp=event.timestamp,
            strategy_name=event.strategy_name,
            metadata=event.metadata
        )
        
        await self.submit_order_from_signal(signal)
    
    async def _handle_order_filled_event(self, event: OrderFilledEvent) -> None:
        """Handle order fill events with enhanced tracking."""
        if event.order_id not in self._orders:
            return
        
        order = self._orders[event.order_id]
        
        # Create execution confirmation
        confirmation = ExecutionConfirmation(
            order_id=event.order_id,
            fill_id=event.fill_id,
            symbol=order.symbol,
            quantity=event.quantity,
            price=event.price,
            commission=event.commission,
            timestamp=event.timestamp,
            broker_name=getattr(event, 'broker_name', 'unknown'),
            execution_venue=getattr(event, 'execution_venue', 'unknown'),
            liquidity_flag=getattr(event, 'liquidity_flag', 'unknown'),
            execution_quality=getattr(event, 'execution_quality', {}),
        )
        
        # Store execution
        if event.order_id not in self._order_executions:
            self._order_executions[event.order_id] = []
        self._order_executions[event.order_id].append(confirmation)
        
        # Update execution metrics
        await self._update_execution_metrics(confirmation)
        
        # Update venue performance tracking
        await self._update_venue_performance(confirmation)
        
        self._logger.info(
            f"Enhanced fill tracking: {order.symbol} {event.quantity} @ {event.price} "
            f"via {confirmation.broker_name} (quality: {confirmation.execution_quality})"
        )
    
    async def _handle_order_status_event(self, event: OrderStatusEvent) -> None:
        """Handle order status change events."""
        if event.new_status == 'rejected':
            self._execution_metrics['failed_orders'] += 1
        elif event.new_status == 'filled':
            self._execution_metrics['successful_orders'] += 1
    
    async def _handle_order_rejected_event(self, event) -> None:
        """Handle order rejection events."""
        self._execution_metrics['failed_orders'] += 1
        
        # Update venue performance on rejection
        if hasattr(event, 'broker_name'):
            venue_stats = self._venue_performance[event.broker_name]
            venue_stats['rejection_rate'] = venue_stats.get('rejection_rate', 0) + 1
    
    # Execution algorithms
    
    async def _execute_algorithm(self, order_id: str, params: OrderExecutionParams) -> None:
        """Execute order using specified algorithm."""
        try:
            if params.algorithm == ExecutionAlgorithm.TWAP:
                await self._execute_twap(order_id, params)
            elif params.algorithm == ExecutionAlgorithm.VWAP:
                await self._execute_vwap(order_id, params)
            elif params.algorithm == ExecutionAlgorithm.IMPLEMENTATION_SHORTFALL:
                await self._execute_implementation_shortfall(order_id, params)
            elif params.algorithm == ExecutionAlgorithm.PARTICIPATION_RATE:
                await self._execute_participation_rate(order_id, params)
            
        except Exception as e:
            self._logger.error(f"Error executing algorithm for order {order_id}: {e}")
    
    async def _execute_twap(self, order_id: str, params: OrderExecutionParams) -> None:
        """Execute Time-Weighted Average Price algorithm."""
        order = self._orders[order_id]
        time_slices = 10  # Number of time slices
        slice_duration = params.time_horizon_minutes * 60 / time_slices
        quantity_per_slice = order.quantity / time_slices
        
        for i in range(time_slices):
            if order.status != OrderStatus.SUBMITTED:
                break
            
            # Create child order for this slice
            child_order = Order(
                order_id=f"{order_id}_TWAP_{i}",
                symbol=order.symbol,
                side=order.side,
                quantity=quantity_per_slice,
                order_type=OrderType.MARKET,
                strategy_name=f"{order.strategy_name}_TWAP",
                created_at=datetime.utcnow()
            )
            
            # Submit child order
            await self.broker_manager.submit_order(child_order)
            
            # Wait for next slice
            await asyncio.sleep(slice_duration)
    
    async def _execute_vwap(self, order_id: str, params: OrderExecutionParams) -> None:
        """Execute Volume-Weighted Average Price algorithm."""
        # Simplified VWAP implementation
        # In practice, this would use real-time volume data
        order = self._orders[order_id]
        
        # For now, use adaptive timing based on historical volume patterns
        peak_hours = [10, 11, 14, 15]  # Market hours with high volume
        current_hour = datetime.now().hour
        
        if current_hour in peak_hours:
            participation_rate = params.max_participation_rate * 1.5
        else:
            participation_rate = params.max_participation_rate * 0.5
        
        # Execute in smaller chunks during high volume periods
        chunks = max(5, int(order.quantity / 100))  # At least 5 chunks
        quantity_per_chunk = order.quantity / chunks
        
        for i in range(chunks):
            if order.status != OrderStatus.SUBMITTED:
                break
            
            child_order = Order(
                order_id=f"{order_id}_VWAP_{i}",
                symbol=order.symbol,
                side=order.side,
                quantity=quantity_per_chunk,
                order_type=OrderType.MARKET,
                strategy_name=f"{order.strategy_name}_VWAP",
                created_at=datetime.utcnow()
            )
            
            await self.broker_manager.submit_order(child_order)
            await asyncio.sleep(30)  # 30 second intervals
    
    async def _execute_implementation_shortfall(self, order_id: str, params: OrderExecutionParams) -> None:
        """Execute Implementation Shortfall algorithm."""
        # Simplified implementation shortfall
        order = self._orders[order_id]
        
        # Balance between market impact and timing risk
        immediate_ratio = params.urgency  # Execute immediately
        gradual_ratio = 1 - params.urgency  # Execute gradually
        
        # Immediate execution
        immediate_quantity = order.quantity * immediate_ratio
        if immediate_quantity > 0:
            immediate_order = Order(
                order_id=f"{order_id}_IS_IMMEDIATE",
                symbol=order.symbol,
                side=order.side,
                quantity=immediate_quantity,
                order_type=OrderType.MARKET,
                strategy_name=f"{order.strategy_name}_IS",
                created_at=datetime.utcnow()
            )
            await self.broker_manager.submit_order(immediate_order)
        
        # Gradual execution
        gradual_quantity = order.quantity * gradual_ratio
        if gradual_quantity > 0:
            # Execute remaining over time horizon
            await self._execute_twap(order_id, params)
    
    async def _execute_participation_rate(self, order_id: str, params: OrderExecutionParams) -> None:
        """Execute Participation Rate algorithm."""
        order = self._orders[order_id]
        
        # Monitor market volume and participate at specified rate
        # This is a simplified version - real implementation would use live volume data
        target_participation = params.max_participation_rate
        
        remaining_quantity = order.quantity
        execution_interval = 60  # 1 minute intervals
        
        while remaining_quantity > 0 and order.status == OrderStatus.SUBMITTED:
            # Estimate market volume (simplified)
            estimated_minute_volume = 1000  # Would come from market data
            
            # Calculate our participation
            our_quantity = min(
                remaining_quantity,
                estimated_minute_volume * target_participation
            )
            
            if our_quantity > 0:
                child_order = Order(
                    order_id=f"{order_id}_PR_{int(remaining_quantity)}",
                    symbol=order.symbol,
                    side=order.side,
                    quantity=our_quantity,
                    order_type=OrderType.MARKET,
                    strategy_name=f"{order.strategy_name}_PR",
                    created_at=datetime.utcnow()
                )
                
                await self.broker_manager.submit_order(child_order)
                remaining_quantity -= our_quantity
            
            await asyncio.sleep(execution_interval)
    
    # Analytics and performance tracking
    
    def _calculate_execution_quality(self, order: Order, executions: List[ExecutionConfirmation]) -> Dict[str, float]:
        """Calculate execution quality metrics."""
        if not executions:
            return {}
        
        # Calculate slippage
        benchmark_price = order.price if order.price else executions[0].price
        total_slippage = 0.0
        total_quantity = 0.0
        
        for exec in executions:
            slippage = abs(exec.price - benchmark_price) / benchmark_price
            total_slippage += slippage * exec.quantity
            total_quantity += exec.quantity
        
        avg_slippage = total_slippage / total_quantity if total_quantity > 0 else 0.0
        
        # Calculate execution speed
        first_fill = min(executions, key=lambda x: x.timestamp)
        last_fill = max(executions, key=lambda x: x.timestamp)
        execution_duration = (last_fill.timestamp - order.created_at).total_seconds()
        
        # Calculate fill rate
        fill_rate = sum(e.quantity for e in executions) / order.quantity
        
        return {
            'avg_slippage': avg_slippage,
            'execution_duration_seconds': execution_duration,
            'fill_rate': fill_rate,
            'number_of_fills': len(executions),
            'total_commission': sum(e.commission for e in executions),
        }
    
    def _calculate_vwap(self, executions: List[ExecutionConfirmation]) -> float:
        """Calculate volume-weighted average price."""
        if not executions:
            return 0.0
        
        total_value = sum(e.price * e.quantity for e in executions)
        total_quantity = sum(e.quantity for e in executions)
        
        return total_value / total_quantity if total_quantity > 0 else 0.0
    
    async def _update_execution_metrics(self, confirmation: ExecutionConfirmation) -> None:
        """Update global execution metrics."""
        # Update average commission
        if self._execution_metrics['avg_commission'] == 0:
            self._execution_metrics['avg_commission'] = confirmation.commission
        else:
            self._execution_metrics['avg_commission'] = (
                self._execution_metrics['avg_commission'] * 0.9 + confirmation.commission * 0.1
            )
        
        # Update broker performance
        broker_stats = self._execution_metrics['broker_performance'][confirmation.broker_name]
        broker_stats['fill_count'] = broker_stats.get('fill_count', 0) + 1
        broker_stats['total_volume'] = broker_stats.get('total_volume', 0) + confirmation.quantity
        broker_stats['total_commission'] = broker_stats.get('total_commission', 0) + confirmation.commission
    
    async def _update_venue_performance(self, confirmation: ExecutionConfirmation) -> None:
        """Update venue performance tracking for smart routing."""
        venue_stats = self._venue_performance[confirmation.broker_name]
        
        # Update execution speed
        execution_time = (confirmation.timestamp - datetime.utcnow()).total_seconds()
        if 'avg_execution_time' not in venue_stats:
            venue_stats['avg_execution_time'] = abs(execution_time)
        else:
            venue_stats['avg_execution_time'] = (
                venue_stats['avg_execution_time'] * 0.9 + abs(execution_time) * 0.1
            )
        
        # Update fill quality
        quality_score = confirmation.execution_quality.get('quality_score', 0.8)
        if 'avg_quality_score' not in venue_stats:
            venue_stats['avg_quality_score'] = quality_score
        else:
            venue_stats['avg_quality_score'] = (
                venue_stats['avg_quality_score'] * 0.9 + quality_score * 0.1
            )
        
        venue_stats['total_fills'] = venue_stats.get('total_fills', 0) + 1
    
    # Background tasks
    
    async def _execution_analytics_processor(self) -> None:
        """Process execution analytics periodically."""
        while self._is_running:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                
                # Calculate overall execution quality score
                total_quality = 0.0
                quality_count = 0
                
                for executions in self._order_executions.values():
                    if executions:
                        order_id = executions[0].order_id
                        order = self._orders.get(order_id)
                        if order:
                            quality_metrics = self._calculate_execution_quality(order, executions)
                            # Simple quality score based on slippage and speed
                            quality_score = max(0, 1 - quality_metrics.get('avg_slippage', 0) * 10)
                            total_quality += quality_score
                            quality_count += 1
                
                if quality_count > 0:
                    self._execution_metrics['execution_quality_score'] = total_quality / quality_count
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Execution analytics processor error: {e}")
    
    async def _smart_routing_optimizer(self) -> None:
        """Optimize smart routing based on performance data."""
        while self._is_running:
            try:
                await asyncio.sleep(600)  # Every 10 minutes
                
                if not self.enable_smart_routing:
                    continue
                
                # Update symbol routing preferences based on venue performance
                for symbol in set(order.symbol for order in self._orders.values()):
                    best_venue = None
                    best_score = 0.0
                    
                    for venue, stats in self._venue_performance.items():
                        if stats.get('total_fills', 0) < 5:  # Need minimum fills for reliability
                            continue
                        
                        # Calculate composite score
                        quality_score = stats.get('avg_quality_score', 0.5)
                        speed_score = max(0, 1 - stats.get('avg_execution_time', 10) / 30)  # Normalize to 30s
                        fill_rate = 1 - stats.get('rejection_rate', 0) / 100
                        
                        composite_score = (quality_score * 0.4 + speed_score * 0.3 + fill_rate * 0.3)
                        
                        if composite_score > best_score:
                            best_score = composite_score
                            best_venue = venue
                    
                    if best_venue and best_score > self.execution_quality_threshold:
                        self._symbol_routing_preferences[symbol] = best_venue
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Smart routing optimizer error: {e}")
    
    # Helper methods (inherited from base OrderManager)
    
    async def _create_order_from_signal(
        self,
        signal: Signal,
        quantity: float,
        order_type: OrderType,
        time_in_force: str
    ) -> Order:
        """Create order object from signal."""
        order_id = f"ENH_{uuid.uuid4().hex[:12].upper()}"
        
        side = 'buy' if signal.signal_type in [TradingSignal.BUY] else 'sell'
        
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
        
        self._orders[order_id] = order
        return order
    
    async def _check_rate_limits(self) -> bool:
        """Check if rate limits allow order submission."""
        current_time = datetime.utcnow()
        minute_ago = current_time - timedelta(minutes=1)
        
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
    
    async def _publish_order_created_event(self, order: Order, broker_name: str) -> None:
        """Publish enhanced order created event."""
        event = OrderCreatedEvent(
            order_id=order.order_id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            order_type=order.order_type.value,
            price=order.price,
            stop_price=order.stop_price,
            strategy_name=order.strategy_name,
            timestamp=order.created_at,
            broker_name=broker_name,
            routing_info={
                'smart_routing_enabled': self.enable_smart_routing,
                'selected_broker': broker_name,
                'routing_reason': 'smart_routing' if self.enable_smart_routing else 'default',
            }
        )
        await self.event_bus.publish(event)
    
    async def _order_timeout_monitor(self) -> None:
        """Monitor orders for timeout."""
        while self._is_running:
            try:
                await asyncio.sleep(60)
                
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
                await asyncio.sleep(1)
                
                if self._pending_signals and await self._check_rate_limits():
                    signal = self._pending_signals.pop(0)
                    await self.submit_order_from_signal(signal)
                
            except Exception as e:
                self._logger.error(f"Rate limit monitor error: {e}")
    
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