"""
Paper trading broker implementation for Pi5 Trading System.

Simulates real broker behavior for testing and development without actual trades.
Provides realistic order execution, slippage, commissions, and market impact.

Features:
- Realistic order fill simulation with slippage
- Commission and fee simulation
- Market hours and liquidity simulation
- Order rejection scenarios (insufficient funds, invalid orders)
- Partial fill simulation for large orders
- Market data integration for realistic pricing
- Account and position tracking
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
import random

from core.interfaces import BrokerInterface, Order, OrderStatus, OrderType
from core.exceptions import (
    BrokerError,
    OrderValidationError,
    OrderExecutionError,
    InsufficientFundsError,
    OrderNotFoundError,
)
from events.event_bus import EventBus
from events.event_types import OrderFilledEvent, OrderStatusEvent
from database.repositories.market_data import MarketDataRepository


logger = logging.getLogger(__name__)


class PaperTradingBroker(BrokerInterface):
    """
    Paper trading broker with realistic execution simulation.
    
    Simulates real broker behavior including order execution, fees,
    slippage, and various market conditions without actual trading.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        market_data_repo: MarketDataRepository,
        initial_cash: float = 100000.0,
        commission_per_trade: float = 1.0,
        commission_per_share: float = 0.005,
        max_slippage_bps: int = 10,  # Maximum slippage in basis points
        fill_delay_ms: Tuple[int, int] = (100, 1000),  # Min/max fill delay
        partial_fill_probability: float = 0.1,
        rejection_probability: float = 0.02,
    ):
        """
        Initialize paper trading broker.
        
        Args:
            event_bus: Event bus for publishing order events
            market_data_repo: Market data repository for pricing
            initial_cash: Starting cash balance
            commission_per_trade: Fixed commission per trade
            commission_per_share: Commission per share
            max_slippage_bps: Maximum slippage in basis points
            fill_delay_ms: Min/max milliseconds delay for order fills
            partial_fill_probability: Probability of partial fills
            rejection_probability: Probability of order rejection
        """
        self.event_bus = event_bus
        self.market_data_repo = market_data_repo
        self.initial_cash = initial_cash
        self.commission_per_trade = commission_per_trade
        self.commission_per_share = commission_per_share
        self.max_slippage_bps = max_slippage_bps
        self.fill_delay_ms = fill_delay_ms
        self.partial_fill_probability = partial_fill_probability
        self.rejection_probability = rejection_probability
        
        # Account state
        self._cash = initial_cash
        self._positions: Dict[str, float] = defaultdict(float)  # symbol -> quantity
        self._buying_power = initial_cash
        
        # Order tracking
        self._orders: Dict[str, Order] = {}
        self._order_id_counter = 0
        self._fill_tasks: Dict[str, asyncio.Task] = {}  # order_id -> fill task
        
        # Execution simulation state
        self._market_hours = {
            'open_time': '09:30',
            'close_time': '16:00',
            'timezone': 'US/Eastern'
        }
        
        # Statistics
        self._stats = {
            'orders_submitted': 0,
            'orders_filled': 0,
            'orders_cancelled': 0,
            'orders_rejected': 0,
            'total_commissions': 0.0,
            'total_slippage': 0.0,
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        self._logger.info(f"Paper trading broker initialized with ${initial_cash:,.2f}")
    
    async def submit_order(self, order: Order) -> str:
        """
        Submit order to paper broker.
        
        Args:
            order: Order to submit
            
        Returns:
            Broker order ID
            
        Raises:
            OrderValidationError: If order validation fails
            BrokerError: If order submission fails
        """
        try:
            # Validate order
            await self._validate_order(order)
            
            # Generate broker order ID
            self._order_id_counter += 1
            broker_order_id = f"PAPER_{self._order_id_counter:08d}"
            
            # Update order with broker ID
            order.status = OrderStatus.SUBMITTED
            
            # Store order
            self._orders[broker_order_id] = order
            self._stats['orders_submitted'] += 1
            
            # Publish order status event
            await self._publish_order_status_event(
                order, OrderStatus.PENDING, OrderStatus.SUBMITTED, "Order submitted to paper broker"
            )
            
            self._logger.info(
                f"Order submitted: {order.side} {order.quantity} {order.symbol} "
                f"@ {order.price or 'MARKET'} (ID: {broker_order_id})"
            )
            
            # Start fill simulation task
            fill_task = asyncio.create_task(self._simulate_order_execution(broker_order_id))
            self._fill_tasks[broker_order_id] = fill_task
            
            return broker_order_id
            
        except Exception as e:
            self._logger.error(f"Failed to submit order: {e}")
            raise BrokerError(f"Order submission failed: {e}") from e
    
    async def cancel_order(self, broker_order_id: str) -> bool:
        """
        Cancel order by broker order ID.
        
        Args:
            broker_order_id: Broker order identifier
            
        Returns:
            True if order was cancelled successfully
        """
        try:
            if broker_order_id not in self._orders:
                raise OrderNotFoundError(f"Order not found: {broker_order_id}")
            
            order = self._orders[broker_order_id]
            
            # Can only cancel submitted or partially filled orders
            if order.status not in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]:
                self._logger.warning(
                    f"Cannot cancel order {broker_order_id} in status {order.status}"
                )
                return False
            
            # Cancel fill task if running
            if broker_order_id in self._fill_tasks:
                self._fill_tasks[broker_order_id].cancel()
                del self._fill_tasks[broker_order_id]
            
            # Update order status
            old_status = order.status
            order.status = OrderStatus.CANCELLED
            self._stats['orders_cancelled'] += 1
            
            # Publish status event
            await self._publish_order_status_event(
                order, old_status, OrderStatus.CANCELLED, "Order cancelled by user"
            )
            
            self._logger.info(f"Order cancelled: {broker_order_id}")
            return True
            
        except Exception as e:
            self._logger.error(f"Failed to cancel order {broker_order_id}: {e}")
            return False
    
    async def get_account_info(self) -> Dict[str, Any]:
        """Get account information."""
        # Calculate total position value
        position_values = {}
        total_position_value = 0.0
        
        for symbol, quantity in self._positions.items():
            if quantity != 0:
                try:
                    # Get current price (simplified - would use real market data)
                    current_price = await self._get_current_price(symbol)
                    position_value = quantity * current_price
                    position_values[symbol] = {
                        'quantity': quantity,
                        'price': current_price,
                        'value': position_value
                    }
                    total_position_value += abs(position_value)
                except Exception as e:
                    self._logger.warning(f"Could not value position in {symbol}: {e}")
        
        total_equity = self._cash + total_position_value
        
        return {
            'account_id': 'PAPER_ACCOUNT',
            'cash': self._cash,
            'buying_power': self._buying_power,
            'total_equity': total_equity,
            'total_position_value': total_position_value,
            'positions': position_values,
            'initial_cash': self.initial_cash,
            'pnl': total_equity - self.initial_cash,
            'pnl_pct': (total_equity - self.initial_cash) / self.initial_cash,
            'statistics': self._stats,
        }
    
    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get current positions."""
        positions = []
        
        for symbol, quantity in self._positions.items():
            if quantity == 0:
                continue
            
            try:
                current_price = await self._get_current_price(symbol)
                market_value = quantity * current_price
                
                positions.append({
                    'symbol': symbol,
                    'quantity': quantity,
                    'current_price': current_price,
                    'market_value': market_value,
                    'side': 'long' if quantity > 0 else 'short',
                })
            except Exception as e:
                self._logger.warning(f"Could not get position info for {symbol}: {e}")
        
        return positions
    
    async def _validate_order(self, order: Order) -> None:
        """Validate order before submission."""
        # Basic validation
        if order.quantity <= 0:
            raise OrderValidationError("Order quantity must be positive")
        
        if order.side not in ['buy', 'sell']:
            raise OrderValidationError("Order side must be 'buy' or 'sell'")
        
        # Check market hours (simplified)
        current_time = datetime.now().time()
        if not (9 <= current_time.hour < 16):  # Simplified market hours
            if random.random() < 0.1:  # 10% chance of rejection outside hours
                raise OrderValidationError("Market is closed")
        
        # Check buying power for buy orders
        if order.side == 'buy':
            required_cash = order.quantity * (order.price or await self._get_current_price(order.symbol))
            commission = self._calculate_commission(order.quantity, required_cash)
            total_required = required_cash + commission
            
            if total_required > self._buying_power:
                raise InsufficientFundsError(
                    f"Insufficient buying power: need ${total_required:,.2f}, have ${self._buying_power:,.2f}"
                )
        
        # Check position for sell orders
        elif order.side == 'sell':
            current_position = self._positions.get(order.symbol, 0.0)
            if current_position < order.quantity:
                raise OrderValidationError(
                    f"Insufficient position to sell: need {order.quantity}, have {current_position}"
                )
        
        # Simulate random rejections
        if random.random() < self.rejection_probability:
            rejection_reasons = [
                "Symbol not found",
                "Order size too small",
                "Market volatility halt",
                "System maintenance"
            ]
            reason = random.choice(rejection_reasons)
            raise OrderValidationError(f"Order rejected: {reason}")
    
    async def _simulate_order_execution(self, broker_order_id: str) -> None:
        """Simulate realistic order execution with delays and partial fills."""
        try:
            order = self._orders[broker_order_id]
            
            # Random delay before first fill
            delay_ms = random.randint(*self.fill_delay_ms)
            await asyncio.sleep(delay_ms / 1000.0)
            
            # Check if order was cancelled during delay
            if order.status == OrderStatus.CANCELLED:
                return
            
            remaining_quantity = order.quantity - order.filled_quantity
            
            while remaining_quantity > 0 and order.status != OrderStatus.CANCELLED:
                # Determine fill quantity (full or partial)
                if random.random() < self.partial_fill_probability and remaining_quantity > 1:
                    # Partial fill - fill 20-80% of remaining
                    fill_quantity = remaining_quantity * random.uniform(0.2, 0.8)
                    fill_quantity = max(1, int(fill_quantity))  # At least 1 share
                else:
                    # Full fill
                    fill_quantity = remaining_quantity
                
                fill_quantity = min(fill_quantity, remaining_quantity)
                
                # Get execution price with slippage
                execution_price = await self._calculate_execution_price(order)
                
                # Execute the fill
                await self._execute_fill(broker_order_id, fill_quantity, execution_price)
                
                remaining_quantity -= fill_quantity
                
                # If partially filled, wait before next fill
                if remaining_quantity > 0:
                    partial_delay = random.randint(100, 2000)  # 100ms to 2s
                    await asyncio.sleep(partial_delay / 1000.0)
            
        except asyncio.CancelledError:
            # Order was cancelled
            pass
        except Exception as e:
            # Execution error - reject order
            order = self._orders[broker_order_id]
            old_status = order.status
            order.status = OrderStatus.REJECTED
            self._stats['orders_rejected'] += 1
            
            await self._publish_order_status_event(
                order, old_status, OrderStatus.REJECTED, f"Execution error: {e}"
            )
            
            self._logger.error(f"Order execution failed for {broker_order_id}: {e}")
        
        finally:
            # Clean up fill task
            if broker_order_id in self._fill_tasks:
                del self._fill_tasks[broker_order_id]
    
    async def _execute_fill(
        self,
        broker_order_id: str,
        fill_quantity: float,
        fill_price: float
    ) -> None:
        """Execute a fill for an order."""
        order = self._orders[broker_order_id]
        
        # Calculate commission
        fill_value = fill_quantity * fill_price
        commission = self._calculate_commission(fill_quantity, fill_value)
        
        # Update order fill tracking
        order.filled_quantity += fill_quantity
        order.average_fill_price = (
            (order.average_fill_price * (order.filled_quantity - fill_quantity) + 
             fill_price * fill_quantity) / order.filled_quantity
        )
        order.commission += commission
        
        # Update account state
        if order.side == 'buy':
            self._cash -= (fill_value + commission)
            self._positions[order.symbol] += fill_quantity
        else:  # sell
            self._cash += (fill_value - commission)
            self._positions[order.symbol] -= fill_quantity
        
        # Update buying power
        self._buying_power = self._cash  # Simplified buying power calculation
        
        # Update statistics
        self._stats['total_commissions'] += commission
        
        # Determine order status
        old_status = order.status
        if order.filled_quantity >= order.quantity:
            order.status = OrderStatus.FILLED
            self._stats['orders_filled'] += 1
        else:
            order.status = OrderStatus.PARTIALLY_FILLED
        
        # Generate fill ID
        fill_id = f"FILL_{uuid.uuid4().hex[:8]}"
        
        # Publish fill event
        fill_event = OrderFilledEvent(
            order_id=order.order_id,
            symbol=order.symbol,
            quantity=fill_quantity,
            price=fill_price,
            commission=commission,
            fill_id=fill_id,
            timestamp=datetime.utcnow(),
            remaining_quantity=order.quantity - order.filled_quantity,
            is_partial=order.status == OrderStatus.PARTIALLY_FILLED
        )
        await self.event_bus.publish(fill_event)
        
        # Publish status event if status changed
        if old_status != order.status:
            await self._publish_order_status_event(
                order, old_status, order.status, 
                f"Fill: {fill_quantity} @ {fill_price}"
            )
        
        self._logger.info(
            f"Order fill: {order.symbol} {fill_quantity} @ {fill_price} "
            f"(commission: ${commission:.2f}, remaining: {order.quantity - order.filled_quantity})"
        )
    
    async def _calculate_execution_price(self, order: Order) -> float:
        """Calculate execution price with slippage simulation."""
        # Get current market price
        if order.order_type == OrderType.MARKET or order.price is None:
            base_price = await self._get_current_price(order.symbol)
        else:
            base_price = order.price
        
        # Apply slippage
        slippage_bps = random.randint(0, self.max_slippage_bps)
        slippage_factor = slippage_bps / 10000.0
        
        if order.side == 'buy':
            # Buying - prices slip up
            execution_price = base_price * (1 + slippage_factor)
        else:
            # Selling - prices slip down
            execution_price = base_price * (1 - slippage_factor)
        
        # Track slippage stats
        slippage_cost = abs(execution_price - base_price) * order.quantity
        self._stats['total_slippage'] += slippage_cost
        
        return execution_price
    
    async def _get_current_price(self, symbol: str) -> float:
        """Get current market price for symbol."""
        try:
            # This would normally query real market data
            # For now, return a simulated price with some randomness
            base_price = 100.0  # Default base price
            
            # Add some random movement (±2%)
            price_movement = random.uniform(-0.02, 0.02)
            current_price = base_price * (1 + price_movement)
            
            return round(current_price, 2)
            
        except Exception as e:
            self._logger.warning(f"Could not get price for {symbol}: {e}")
            return 100.0  # Default price
    
    def _calculate_commission(self, quantity: float, value: float) -> float:
        """Calculate commission for trade."""
        per_share_commission = quantity * self.commission_per_share
        total_commission = self.commission_per_trade + per_share_commission
        return round(total_commission, 2)
    
    async def _publish_order_status_event(
        self,
        order: Order,
        old_status: OrderStatus,
        new_status: OrderStatus,
        reason: str = None
    ) -> None:
        """Publish order status change event."""
        event = OrderStatusEvent(
            order_id=order.order_id,
            old_status=old_status.value,
            new_status=new_status.value,
            timestamp=datetime.utcnow(),
            reason=reason,
            broker_message=f"Paper broker: {reason}" if reason else None
        )
        await self.event_bus.publish(event)
    
    def get_broker_stats(self) -> Dict[str, Any]:
        """Get broker statistics."""
        return {
            **self._stats,
            'cash': self._cash,
            'buying_power': self._buying_power,
            'active_orders': len([o for o in self._orders.values() 
                                if o.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]]),
            'total_orders': len(self._orders),
            'position_count': len([p for p in self._positions.values() if p != 0]),
        }
    
    async def reset_account(self, new_cash: Optional[float] = None) -> None:
        """Reset paper trading account (useful for testing)."""
        self._cash = new_cash or self.initial_cash
        self._buying_power = self._cash
        self._positions.clear()
        
        # Cancel all active orders
        for broker_order_id, order in self._orders.items():
            if order.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]:
                await self.cancel_order(broker_order_id)
        
        self._orders.clear()
        self._fill_tasks.clear()
        
        # Reset statistics
        self._stats = {key: 0 if isinstance(value, (int, float)) else value 
                      for key, value in self._stats.items()}
        
        self._logger.info(f"Paper trading account reset with ${self._cash:,.2f}")
    
    async def close(self) -> None:
        """Close broker and clean up resources."""
        # Cancel all pending fill tasks
        for task in self._fill_tasks.values():
            if not task.done():
                task.cancel()
        
        if self._fill_tasks:
            await asyncio.gather(*self._fill_tasks.values(), return_exceptions=True)
        
        self._fill_tasks.clear()
        self._logger.info("Paper trading broker closed")