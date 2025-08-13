"""
Interactive Brokers API integration for Pi5 Trading System.

Live trading broker implementation using Interactive Brokers TWS/Gateway API.
Provides real-time order execution, position tracking, and account management.

Features:
- TWS/Gateway connection management with auto-reconnect
- Real-time order execution and fill notifications
- Position and account synchronization
- Market data integration for order pricing
- Error handling and connection monitoring
- Order status tracking and updates
- Commission and execution tracking
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
import time

try:
    from ib_insync import IB, Stock, Order as IBOrder, Trade, Contract
    from ib_insync.objects import OrderStatus as IBOrderStatus
    IB_AVAILABLE = True
except ImportError:
    IB_AVAILABLE = False
    # Create mock classes for type hints
    class IB: pass
    class Stock: pass
    class IBOrder: pass
    class Trade: pass
    class Contract: pass
    class IBOrderStatus: pass

from core.interfaces import BrokerInterface, Order, OrderStatus, OrderType
from core.exceptions import (
    BrokerError,
    OrderValidationError,
    OrderExecutionError,
    InsufficientFundsError,
    OrderNotFoundError,
    BrokerConnectionError,
)
from events.event_bus import EventBus
from events.event_types import OrderFilledEvent, OrderStatusEvent


logger = logging.getLogger(__name__)


class InteractiveBrokersBroker(BrokerInterface):
    """
    Interactive Brokers live trading broker.
    
    Provides real order execution through IB TWS/Gateway with comprehensive
    order management, position tracking, and account monitoring.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        host: str = "127.0.0.1",
        port: int = 7497,  # TWS paper trading port (7496 for live)
        client_id: int = 1,
        account: Optional[str] = None,
        connect_timeout: int = 30,
        heartbeat_interval: int = 30,
        auto_reconnect: bool = True,
        max_reconnect_attempts: int = 5,
    ):
        """
        Initialize Interactive Brokers broker.
        
        Args:
            event_bus: Event bus for publishing order events
            host: IB Gateway/TWS host address
            port: IB Gateway/TWS port (7497=paper, 7496=live)
            client_id: Unique client ID for connection
            account: Account number (None for default)
            connect_timeout: Connection timeout in seconds
            heartbeat_interval: Heartbeat check interval
            auto_reconnect: Enable automatic reconnection
            max_reconnect_attempts: Maximum reconnection attempts
        """
        if not IB_AVAILABLE:
            raise ImportError(
                "ib-insync is required for Interactive Brokers integration. "
                "Install with: pip install ib-insync"
            )
        
        self.event_bus = event_bus
        self.host = host
        self.port = port
        self.client_id = client_id
        self.account = account
        self.connect_timeout = connect_timeout
        self.heartbeat_interval = heartbeat_interval
        self.auto_reconnect = auto_reconnect
        self.max_reconnect_attempts = max_reconnect_attempts
        
        # IB connection
        self.ib = IB()
        self._is_connected = False
        self._connection_attempts = 0
        self._last_heartbeat = None
        
        # Order tracking
        self._orders: Dict[str, Order] = {}  # our_order_id -> Order
        self._ib_order_mapping: Dict[int, str] = {}  # ib_order_id -> our_order_id
        self._trade_mapping: Dict[str, Trade] = {}  # our_order_id -> IB Trade
        self._order_id_counter = 0
        
        # Account state (cached from IB)
        self._account_info: Dict[str, Any] = {}
        self._positions: List[Dict[str, Any]] = []
        self._last_account_update = None
        
        # Connection monitoring
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._reconnect_task: Optional[asyncio.Task] = None
        
        # Statistics
        self._stats = {
            'orders_submitted': 0,
            'orders_filled': 0,
            'orders_cancelled': 0,
            'orders_rejected': 0,
            'connection_drops': 0,
            'reconnections': 0,
            'total_commissions': 0.0,
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        
        # Setup IB event handlers
        self._setup_ib_event_handlers()
    
    def _setup_ib_event_handlers(self) -> None:
        """Setup Interactive Brokers event handlers."""
        self.ib.orderStatusEvent += self._on_ib_order_status
        self.ib.execDetailsEvent += self._on_ib_execution
        self.ib.errorEvent += self._on_ib_error
        self.ib.disconnectedEvent += self._on_ib_disconnected
        self.ib.connectedEvent += self._on_ib_connected
    
    async def connect(self) -> bool:
        """Connect to Interactive Brokers TWS/Gateway."""
        try:
            if self._is_connected:
                return True
            
            self._logger.info(f"Connecting to IB at {self.host}:{self.port} (client {self.client_id})")
            
            # Connect to IB
            await self.ib.connectAsync(
                host=self.host,
                port=self.port,
                clientId=self.client_id,
                timeout=self.connect_timeout
            )
            
            self._is_connected = True
            self._connection_attempts = 0
            self._last_heartbeat = datetime.utcnow()
            
            # Start heartbeat monitoring
            if self._heartbeat_task is None or self._heartbeat_task.done():
                self._heartbeat_task = asyncio.create_task(self._heartbeat_monitor())
            
            # Get account information
            await self._update_account_info()
            
            self._logger.info(f"Successfully connected to IB (account: {self.account or 'default'})")
            return True
            
        except Exception as e:
            self._logger.error(f"Failed to connect to IB: {e}")
            self._is_connected = False
            if self.auto_reconnect:
                await self._schedule_reconnect()
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from Interactive Brokers."""
        try:
            self._logger.info("Disconnecting from IB...")
            
            # Stop monitoring tasks
            if self._heartbeat_task and not self._heartbeat_task.done():
                self._heartbeat_task.cancel()
            
            if self._reconnect_task and not self._reconnect_task.done():
                self._reconnect_task.cancel()
            
            # Cancel all pending orders
            for order_id in list(self._orders.keys()):
                if self._orders[order_id].status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]:
                    await self.cancel_order(order_id)
            
            # Disconnect from IB
            if self.ib.isConnected():
                self.ib.disconnect()
            
            self._is_connected = False
            self._logger.info("Disconnected from IB")
            
        except Exception as e:
            self._logger.error(f"Error during IB disconnect: {e}")
    
    async def submit_order(self, order: Order) -> str:
        """
        Submit order to Interactive Brokers.
        
        Args:
            order: Order to submit
            
        Returns:
            Our internal order ID
            
        Raises:
            BrokerError: If order submission fails
        """
        try:
            if not self._is_connected:
                if not await self.connect():
                    raise BrokerError("Not connected to Interactive Brokers")
            
            # Validate order
            await self._validate_order(order)
            
            # Generate internal order ID
            self._order_id_counter += 1
            internal_order_id = f"IB_{self._order_id_counter:08d}"
            
            # Create IB contract
            contract = await self._create_ib_contract(order.symbol)
            
            # Create IB order
            ib_order = await self._create_ib_order(order)
            
            # Store order tracking
            order.status = OrderStatus.SUBMITTED
            self._orders[internal_order_id] = order
            
            # Submit to IB
            trade = self.ib.placeOrder(contract, ib_order)
            
            # Store mapping
            self._ib_order_mapping[ib_order.orderId] = internal_order_id
            self._trade_mapping[internal_order_id] = trade
            
            self._stats['orders_submitted'] += 1
            
            # Publish order status event
            await self._publish_order_status_event(
                order, OrderStatus.PENDING, OrderStatus.SUBMITTED, "Order submitted to IB"
            )
            
            self._logger.info(
                f"Order submitted to IB: {order.side} {order.quantity} {order.symbol} "
                f"@ {order.price or 'MARKET'} (ID: {internal_order_id}, IB: {ib_order.orderId})"
            )
            
            return internal_order_id
            
        except Exception as e:
            self._logger.error(f"Failed to submit order to IB: {e}")
            raise BrokerError(f"Order submission failed: {e}") from e
    
    async def cancel_order(self, order_id: str) -> bool:
        """
        Cancel order by internal order ID.
        
        Args:
            order_id: Internal order identifier
            
        Returns:
            True if cancellation was successful
        """
        try:
            if order_id not in self._orders:
                raise OrderNotFoundError(f"Order not found: {order_id}")
            
            order = self._orders[order_id]
            
            if order.status not in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]:
                self._logger.warning(f"Cannot cancel order {order_id} in status {order.status}")
                return False
            
            # Find IB trade
            if order_id not in self._trade_mapping:
                self._logger.error(f"IB trade not found for order {order_id}")
                return False
            
            trade = self._trade_mapping[order_id]
            
            # Cancel with IB
            self.ib.cancelOrder(trade.order)
            
            self._logger.info(f"Cancellation requested for order {order_id}")
            return True
            
        except Exception as e:
            self._logger.error(f"Failed to cancel order {order_id}: {e}")
            return False
    
    async def get_account_info(self) -> Dict[str, Any]:
        """Get account information from Interactive Brokers."""
        try:
            if not self._is_connected:
                if not await self.connect():
                    raise BrokerError("Not connected to Interactive Brokers")
            
            # Update account info if stale
            if (not self._last_account_update or 
                datetime.utcnow() - self._last_account_update > timedelta(seconds=30)):
                await self._update_account_info()
            
            return self._account_info
            
        except Exception as e:
            self._logger.error(f"Failed to get account info: {e}")
            raise BrokerError(f"Account info retrieval failed: {e}") from e
    
    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get current positions from Interactive Brokers."""
        try:
            if not self._is_connected:
                if not await self.connect():
                    raise BrokerError("Not connected to Interactive Brokers")
            
            # Update positions if stale
            if (not self._last_account_update or 
                datetime.utcnow() - self._last_account_update > timedelta(seconds=30)):
                await self._update_account_info()
            
            return self._positions
            
        except Exception as e:
            self._logger.error(f"Failed to get positions: {e}")
            raise BrokerError(f"Position retrieval failed: {e}") from e
    
    # Event handlers for IB callbacks
    
    def _on_ib_order_status(self, trade: Trade) -> None:
        """Handle IB order status updates."""
        try:
            ib_order_id = trade.order.orderId
            
            if ib_order_id not in self._ib_order_mapping:
                return  # Not our order
            
            internal_order_id = self._ib_order_mapping[ib_order_id]
            order = self._orders.get(internal_order_id)
            
            if not order:
                return
            
            # Map IB status to our status
            old_status = order.status
            new_status = self._map_ib_order_status(trade.orderStatus.status)
            
            if new_status != old_status:
                order.status = new_status
                
                # Update statistics
                if new_status == OrderStatus.FILLED:
                    self._stats['orders_filled'] += 1
                elif new_status == OrderStatus.CANCELLED:
                    self._stats['orders_cancelled'] += 1
                elif new_status == OrderStatus.REJECTED:
                    self._stats['orders_rejected'] += 1
                
                # Publish status event asynchronously
                asyncio.create_task(self._publish_order_status_event(
                    order, old_status, new_status, f"IB status: {trade.orderStatus.status}"
                ))
                
                self._logger.info(
                    f"Order status update: {internal_order_id} {old_status.value} -> {new_status.value}"
                )
        
        except Exception as e:
            self._logger.error(f"Error handling IB order status: {e}")
    
    def _on_ib_execution(self, trade: Trade, fill) -> None:
        """Handle IB execution notifications."""
        try:
            ib_order_id = trade.order.orderId
            
            if ib_order_id not in self._ib_order_mapping:
                return  # Not our order
            
            internal_order_id = self._ib_order_mapping[ib_order_id]
            order = self._orders.get(internal_order_id)
            
            if not order:
                return
            
            # Update order fill tracking
            order.filled_quantity = float(trade.orderStatus.filled)
            order.average_fill_price = float(trade.orderStatus.avgFillPrice) if trade.orderStatus.avgFillPrice else 0.0
            order.commission = sum(abs(f.commission) for f in trade.fills)
            
            # Track commission
            self._stats['total_commissions'] += abs(fill.commission)
            
            # Create fill event
            fill_event = OrderFilledEvent(
                order_id=order.order_id,
                symbol=order.symbol,
                quantity=float(fill.execution.shares),
                price=float(fill.execution.price),
                commission=abs(fill.commission),
                fill_id=fill.execution.execId,
                timestamp=datetime.utcnow(),
                remaining_quantity=order.quantity - order.filled_quantity,
                is_partial=order.filled_quantity < order.quantity
            )
            
            # Publish fill event asynchronously
            asyncio.create_task(self.event_bus.publish(fill_event))
            
            self._logger.info(
                f"Order fill: {order.symbol} {fill.execution.shares} @ {fill.execution.price} "
                f"(commission: ${abs(fill.commission):.2f})"
            )
        
        except Exception as e:
            self._logger.error(f"Error handling IB execution: {e}")
    
    def _on_ib_error(self, reqId: int, errorCode: int, errorString: str, contract) -> None:
        """Handle IB error messages."""
        # Filter out informational messages
        if errorCode in [2104, 2106, 2158]:  # Market data farm connection messages
            return
        
        if errorCode >= 2100 and errorCode < 2200:  # Warning messages
            self._logger.warning(f"IB Warning {errorCode}: {errorString}")
        else:
            self._logger.error(f"IB Error {errorCode}: {errorString}")
            
            # Handle order-specific errors
            if reqId in self._ib_order_mapping:
                internal_order_id = self._ib_order_mapping[reqId]
                order = self._orders.get(internal_order_id)
                if order and order.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]:
                    order.status = OrderStatus.REJECTED
                    self._stats['orders_rejected'] += 1
                    
                    # Publish rejection event
                    asyncio.create_task(self._publish_order_status_event(
                        order, OrderStatus.SUBMITTED, OrderStatus.REJECTED, 
                        f"IB Error {errorCode}: {errorString}"
                    ))
    
    def _on_ib_disconnected(self) -> None:
        """Handle IB disconnection."""
        self._logger.warning("Disconnected from Interactive Brokers")
        self._is_connected = False
        self._stats['connection_drops'] += 1
        
        if self.auto_reconnect:
            asyncio.create_task(self._schedule_reconnect())
    
    def _on_ib_connected(self) -> None:
        """Handle IB connection."""
        self._logger.info("Connected to Interactive Brokers")
        self._is_connected = True
        self._last_heartbeat = datetime.utcnow()
    
    # Helper methods
    
    async def _validate_order(self, order: Order) -> None:
        """Validate order before submission."""
        if order.quantity <= 0:
            raise OrderValidationError("Order quantity must be positive")
        
        if order.side not in ['buy', 'sell']:
            raise OrderValidationError("Order side must be 'buy' or 'sell'")
        
        if order.order_type == OrderType.LIMIT and not order.price:
            raise OrderValidationError("Limit orders must have a price")
        
        # Additional validation could include:
        # - Market hours check
        # - Symbol validation
        # - Account buying power check
    
    async def _create_ib_contract(self, symbol: str) -> Contract:
        """Create IB contract for symbol."""
        # For now, assume all symbols are US stocks
        contract = Stock(symbol, 'SMART', 'USD')
        return contract
    
    async def _create_ib_order(self, order: Order) -> IBOrder:
        """Create IB order from our order."""
        ib_order = IBOrder()
        
        # Basic order properties
        ib_order.action = 'BUY' if order.side == 'buy' else 'SELL'
        ib_order.totalQuantity = int(order.quantity)
        ib_order.tif = order.time_in_force
        
        # Order type
        if order.order_type == OrderType.MARKET:
            ib_order.orderType = 'MKT'
        elif order.order_type == OrderType.LIMIT:
            ib_order.orderType = 'LMT'
            ib_order.lmtPrice = order.price
        elif order.order_type == OrderType.STOP:
            ib_order.orderType = 'STP'
            ib_order.auxPrice = order.stop_price
        elif order.order_type == OrderType.STOP_LIMIT:
            ib_order.orderType = 'STP LMT'
            ib_order.lmtPrice = order.price
            ib_order.auxPrice = order.stop_price
        
        return ib_order
    
    def _map_ib_order_status(self, ib_status: str) -> OrderStatus:
        """Map IB order status to our order status."""
        mapping = {
            'Submitted': OrderStatus.SUBMITTED,
            'Filled': OrderStatus.FILLED,
            'Cancelled': OrderStatus.CANCELLED,
            'Inactive': OrderStatus.REJECTED,
            'PendingSubmit': OrderStatus.PENDING,
            'PreSubmitted': OrderStatus.SUBMITTED,
            'PartiallyFilled': OrderStatus.PARTIALLY_FILLED,
        }
        return mapping.get(ib_status, OrderStatus.PENDING)
    
    async def _update_account_info(self) -> None:
        """Update account information from IB."""
        try:
            if not self.ib.isConnected():
                return
            
            # Request account updates
            if self.account:
                account_values = self.ib.accountValues(account=self.account)
                positions = self.ib.positions(account=self.account)
            else:
                account_values = self.ib.accountValues()
                positions = self.ib.positions()
            
            # Process account values
            account_dict = {}
            for value in account_values:
                if value.currency == 'USD':  # Focus on USD values
                    account_dict[value.tag] = value.value
            
            # Process positions
            position_list = []
            for pos in positions:
                if pos.position != 0:
                    position_list.append({
                        'symbol': pos.contract.symbol,
                        'quantity': float(pos.position),
                        'avg_cost': float(pos.avgCost),
                        'market_value': float(pos.marketValue),
                        'unrealized_pnl': float(pos.unrealizedPNL),
                        'side': 'long' if pos.position > 0 else 'short',
                    })
            
            # Store updated information
            self._account_info = {
                'account_id': self.account or 'default',
                'cash': float(account_dict.get('TotalCashValue', 0)),
                'buying_power': float(account_dict.get('BuyingPower', 0)),
                'total_equity': float(account_dict.get('NetLiquidation', 0)),
                'unrealized_pnl': float(account_dict.get('UnrealizedPnL', 0)),
                'realized_pnl': float(account_dict.get('RealizedPnL', 0)),
                'positions': position_list,
                'statistics': self._stats,
            }
            
            self._positions = position_list
            self._last_account_update = datetime.utcnow()
            
        except Exception as e:
            self._logger.error(f"Failed to update account info: {e}")
    
    async def _heartbeat_monitor(self) -> None:
        """Monitor connection health and trigger reconnection if needed."""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                
                if not self.ib.isConnected():
                    self._logger.warning("IB connection lost during heartbeat check")
                    self._is_connected = False
                    if self.auto_reconnect:
                        await self._schedule_reconnect()
                    break
                else:
                    self._last_heartbeat = datetime.utcnow()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Heartbeat monitor error: {e}")
    
    async def _schedule_reconnect(self) -> None:
        """Schedule reconnection attempt."""
        if self._reconnect_task and not self._reconnect_task.done():
            return  # Reconnection already in progress
        
        self._reconnect_task = asyncio.create_task(self._reconnect_loop())
    
    async def _reconnect_loop(self) -> None:
        """Reconnection loop with exponential backoff."""
        while (self._connection_attempts < self.max_reconnect_attempts and 
               self.auto_reconnect and not self._is_connected):
            
            self._connection_attempts += 1
            backoff_seconds = min(60, 2 ** self._connection_attempts)
            
            self._logger.info(
                f"Reconnection attempt {self._connection_attempts}/{self.max_reconnect_attempts} "
                f"in {backoff_seconds} seconds"
            )
            
            await asyncio.sleep(backoff_seconds)
            
            try:
                if await self.connect():
                    self._stats['reconnections'] += 1
                    self._logger.info("Successfully reconnected to IB")
                    break
            except Exception as e:
                self._logger.error(f"Reconnection attempt failed: {e}")
        
        if self._connection_attempts >= self.max_reconnect_attempts:
            self._logger.error("Maximum reconnection attempts reached - giving up")
    
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
            broker_message=f"Interactive Brokers: {reason}" if reason else None
        )
        await self.event_bus.publish(event)
    
    def get_broker_stats(self) -> Dict[str, Any]:
        """Get broker statistics."""
        return {
            **self._stats,
            'is_connected': self._is_connected,
            'connection_attempts': self._connection_attempts,
            'last_heartbeat': self._last_heartbeat.isoformat() if self._last_heartbeat else None,
            'active_orders': len([o for o in self._orders.values() 
                                if o.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]]),
            'total_orders': len(self._orders),
            'host': self.host,
            'port': self.port,
            'account': self.account,
        }
    
    async def close(self) -> None:
        """Close broker connection and clean up resources."""
        await self.disconnect()