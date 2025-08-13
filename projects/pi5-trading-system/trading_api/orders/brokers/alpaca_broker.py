"""
Alpaca Markets API integration for Pi5 Trading System.

Live trading broker implementation using Alpaca Markets REST API.
Provides commission-free stock trading with real-time execution.

Features:
- REST API connection with authentication
- Real-time order execution and status tracking
- WebSocket streaming for order updates
- Position and account synchronization
- Market data integration
- Fractional share support
- Error handling and retry logic
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
import json

try:
    import alpaca_trade_api as tradeapi
    from alpaca_trade_api.rest import APIError
    from alpaca_trade_api.stream import Stream
    ALPACA_AVAILABLE = True
except ImportError:
    ALPACA_AVAILABLE = False
    # Create mock classes
    class tradeapi:
        class REST: pass
    class APIError(Exception): pass
    class Stream: pass

import aiohttp
import websockets

from core.interfaces import BrokerInterface, Order, OrderStatus, OrderType
from core.exceptions import (
    BrokerError,
    OrderValidationError,
    OrderExecutionError,
    InsufficientFundsError,
    OrderNotFoundError,
    ConnectionError,
)
from events.event_bus import EventBus
from events.event_types import OrderFilledEvent, OrderStatusEvent


logger = logging.getLogger(__name__)


class AlpacaBroker(BrokerInterface):
    """
    Alpaca Markets live trading broker.
    
    Provides commission-free stock trading through Alpaca's REST API
    with real-time order execution and position tracking.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        api_key: str,
        secret_key: str,
        base_url: str = "https://paper-api.alpaca.markets",  # Paper trading
        data_feed: str = "iex",  # iex or sip
        enable_streaming: bool = True,
        request_timeout: int = 30,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """
        Initialize Alpaca broker.
        
        Args:
            event_bus: Event bus for publishing order events
            api_key: Alpaca API key
            secret_key: Alpaca secret key
            base_url: API base URL (paper or live)
            data_feed: Market data feed (iex or sip)
            enable_streaming: Enable WebSocket streaming
            request_timeout: Request timeout in seconds
            max_retries: Maximum retry attempts
            retry_delay: Delay between retries
        """
        if not ALPACA_AVAILABLE:
            raise ImportError(
                "alpaca-trade-api is required for Alpaca integration. "
                "Install with: pip install alpaca-trade-api"
            )
        
        self.event_bus = event_bus
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = base_url
        self.data_feed = data_feed
        self.enable_streaming = enable_streaming
        self.request_timeout = request_timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
        # Alpaca API client
        self.api = tradeapi.REST(
            key_id=api_key,
            secret_key=secret_key,
            base_url=base_url,
            api_version='v2'
        )
        
        # Streaming client
        self.stream: Optional[Stream] = None
        self._streaming_task: Optional[asyncio.Task] = None
        
        # Connection state
        self._is_connected = False
        self._last_heartbeat = None
        
        # Order tracking
        self._orders: Dict[str, Order] = {}  # our_order_id -> Order
        self._alpaca_order_mapping: Dict[str, str] = {}  # alpaca_order_id -> our_order_id
        self._order_id_counter = 0
        
        # Account state (cached)
        self._account_info: Dict[str, Any] = {}
        self._positions: List[Dict[str, Any]] = []
        self._last_account_update = None
        
        # Rate limiting
        self._request_times: List[datetime] = []
        self._max_requests_per_minute = 200  # Alpaca limit
        
        # Statistics
        self._stats = {
            'orders_submitted': 0,
            'orders_filled': 0,
            'orders_cancelled': 0,
            'orders_rejected': 0,
            'api_calls': 0,
            'api_errors': 0,
            'stream_reconnections': 0,
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def connect(self) -> bool:
        """Connect to Alpaca Markets API."""
        try:
            if self._is_connected:
                return True
            
            self._logger.info(f"Connecting to Alpaca at {self.base_url}")
            
            # Test API connection
            account = await self._api_call(self.api.get_account)
            if not account:
                return False
            
            self._is_connected = True
            self._last_heartbeat = datetime.utcnow()
            
            # Start streaming if enabled
            if self.enable_streaming:
                await self._start_streaming()
            
            # Update account info
            await self._update_account_info()
            
            self._logger.info(f"Successfully connected to Alpaca (account: {account.id})")
            return True
            
        except Exception as e:
            self._logger.error(f"Failed to connect to Alpaca: {e}")
            self._is_connected = False
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from Alpaca Markets."""
        try:
            self._logger.info("Disconnecting from Alpaca...")
            
            # Stop streaming
            if self._streaming_task and not self._streaming_task.done():
                self._streaming_task.cancel()
                try:
                    await self._streaming_task
                except asyncio.CancelledError:
                    pass
            
            if self.stream:
                try:
                    await self.stream.stop_ws()
                except:
                    pass
            
            self._is_connected = False
            self._logger.info("Disconnected from Alpaca")
            
        except Exception as e:
            self._logger.error(f"Error during Alpaca disconnect: {e}")
    
    async def submit_order(self, order: Order) -> str:
        """
        Submit order to Alpaca Markets.
        
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
                    raise BrokerError("Not connected to Alpaca")
            
            # Check rate limits
            if not await self._check_rate_limits():
                raise BrokerError("Rate limit exceeded")
            
            # Validate order
            await self._validate_order(order)
            
            # Generate internal order ID
            self._order_id_counter += 1
            internal_order_id = f"ALP_{self._order_id_counter:08d}"
            
            # Prepare order parameters
            order_params = await self._prepare_order_params(order)
            
            # Submit to Alpaca
            alpaca_order = await self._api_call(
                self.api.submit_order,
                **order_params
            )
            
            if not alpaca_order:
                raise BrokerError("Order submission returned no result")
            
            # Store order tracking
            order.status = OrderStatus.SUBMITTED
            self._orders[internal_order_id] = order
            self._alpaca_order_mapping[alpaca_order.id] = internal_order_id
            
            self._stats['orders_submitted'] += 1
            
            # Publish order status event
            await self._publish_order_status_event(
                order, OrderStatus.PENDING, OrderStatus.SUBMITTED, "Order submitted to Alpaca"
            )
            
            self._logger.info(
                f"Order submitted to Alpaca: {order.side} {order.quantity} {order.symbol} "
                f"@ {order.price or 'MARKET'} (ID: {internal_order_id}, Alpaca: {alpaca_order.id})"
            )
            
            return internal_order_id
            
        except Exception as e:
            self._logger.error(f"Failed to submit order to Alpaca: {e}")
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
            
            # Find Alpaca order ID
            alpaca_order_id = None
            for aid, oid in self._alpaca_order_mapping.items():
                if oid == order_id:
                    alpaca_order_id = aid
                    break
            
            if not alpaca_order_id:
                self._logger.error(f"Alpaca order ID not found for {order_id}")
                return False
            
            # Cancel with Alpaca
            result = await self._api_call(self.api.cancel_order, alpaca_order_id)
            
            if result:
                self._logger.info(f"Cancellation requested for order {order_id}")
                return True
            else:
                return False
            
        except Exception as e:
            self._logger.error(f"Failed to cancel order {order_id}: {e}")
            return False
    
    async def get_account_info(self) -> Dict[str, Any]:
        """Get account information from Alpaca."""
        try:
            if not self._is_connected:
                if not await self.connect():
                    raise BrokerError("Not connected to Alpaca")
            
            # Update account info if stale
            if (not self._last_account_update or 
                datetime.utcnow() - self._last_account_update > timedelta(seconds=30)):
                await self._update_account_info()
            
            return self._account_info
            
        except Exception as e:
            self._logger.error(f"Failed to get account info: {e}")
            raise BrokerError(f"Account info retrieval failed: {e}") from e
    
    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get current positions from Alpaca."""
        try:
            if not self._is_connected:
                if not await self.connect():
                    raise BrokerError("Not connected to Alpaca")
            
            # Update positions if stale
            if (not self._last_account_update or 
                datetime.utcnow() - self._last_account_update > timedelta(seconds=30)):
                await self._update_account_info()
            
            return self._positions
            
        except Exception as e:
            self._logger.error(f"Failed to get positions: {e}")
            raise BrokerError(f"Position retrieval failed: {e}") from e
    
    # Helper methods
    
    async def _api_call(self, func, *args, **kwargs):
        """Make API call with retry logic and rate limiting."""
        for attempt in range(self.max_retries):
            try:
                self._stats['api_calls'] += 1
                
                # Track API calls for rate limiting
                self._request_times.append(datetime.utcnow())
                
                # Execute API call
                result = func(*args, **kwargs)
                return result
                
            except APIError as e:
                self._stats['api_errors'] += 1
                
                # Handle specific API errors
                if e.code == 40010000:  # Rate limit exceeded
                    self._logger.warning("Alpaca rate limit exceeded, retrying...")
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
                    continue
                elif e.code == 40310000:  # Insufficient buying power
                    raise InsufficientFundsError(str(e))
                elif e.code == 42210000:  # Order not found
                    raise OrderNotFoundError(str(e))
                else:
                    raise BrokerError(f"Alpaca API error {e.code}: {e}")
                    
            except Exception as e:
                self._stats['api_errors'] += 1
                
                if attempt == self.max_retries - 1:
                    raise
                
                self._logger.warning(f"API call failed (attempt {attempt + 1}): {e}")
                await asyncio.sleep(self.retry_delay * (attempt + 1))
        
        return None
    
    async def _check_rate_limits(self) -> bool:
        """Check if we're within rate limits."""
        current_time = datetime.utcnow()
        minute_ago = current_time - timedelta(minutes=1)
        
        # Clean old requests
        self._request_times = [t for t in self._request_times if t > minute_ago]
        
        return len(self._request_times) < self._max_requests_per_minute
    
    async def _validate_order(self, order: Order) -> None:
        """Validate order before submission."""
        if order.quantity <= 0:
            raise OrderValidationError("Order quantity must be positive")
        
        if order.side not in ['buy', 'sell']:
            raise OrderValidationError("Order side must be 'buy' or 'sell'")
        
        if order.order_type == OrderType.LIMIT and not order.price:
            raise OrderValidationError("Limit orders must have a price")
        
        # Check market hours (Alpaca handles this, but we can pre-validate)
        # Additional validation could be added here
    
    async def _prepare_order_params(self, order: Order) -> Dict[str, Any]:
        """Prepare order parameters for Alpaca API."""
        params = {
            'symbol': order.symbol,
            'qty': order.quantity,
            'side': order.side,
            'time_in_force': order.time_in_force,
        }
        
        # Order type
        if order.order_type == OrderType.MARKET:
            params['type'] = 'market'
        elif order.order_type == OrderType.LIMIT:
            params['type'] = 'limit'
            params['limit_price'] = order.price
        elif order.order_type == OrderType.STOP:
            params['type'] = 'stop'
            params['stop_price'] = order.stop_price
        elif order.order_type == OrderType.STOP_LIMIT:
            params['type'] = 'stop_limit'
            params['limit_price'] = order.price
            params['stop_price'] = order.stop_price
        
        return params
    
    async def _update_account_info(self) -> None:
        """Update account information from Alpaca."""
        try:
            # Get account info
            account = await self._api_call(self.api.get_account)
            if not account:
                return
            
            # Get positions
            positions = await self._api_call(self.api.list_positions)
            if not positions:
                positions = []
            
            # Process positions
            position_list = []
            for pos in positions:
                position_list.append({
                    'symbol': pos.symbol,
                    'quantity': float(pos.qty),
                    'avg_cost': float(pos.avg_entry_price),
                    'market_value': float(pos.market_value),
                    'unrealized_pnl': float(pos.unrealized_pl),
                    'side': pos.side,
                })
            
            # Store account information
            self._account_info = {
                'account_id': account.id,
                'cash': float(account.cash),
                'buying_power': float(account.buying_power),
                'total_equity': float(account.equity),
                'day_trade_buying_power': float(account.daytrading_buying_power),
                'portfolio_value': float(account.portfolio_value),
                'positions': position_list,
                'account_blocked': account.account_blocked,
                'trade_suspended': account.trade_suspended_by_user,
                'statistics': self._stats,
            }
            
            self._positions = position_list
            self._last_account_update = datetime.utcnow()
            
        except Exception as e:
            self._logger.error(f"Failed to update account info: {e}")
    
    async def _start_streaming(self) -> None:
        """Start WebSocket streaming for real-time updates."""
        try:
            if not self.enable_streaming:
                return
            
            # Create stream client
            self.stream = Stream(
                key_id=self.api_key,
                secret_key=self.secret_key,
                base_url=self.base_url,
                data_feed=self.data_feed
            )
            
            # Subscribe to trade updates
            @self.stream.on('trade_updates')
            async def on_trade_update(data):
                await self._handle_trade_update(data)
            
            # Start streaming task
            self._streaming_task = asyncio.create_task(self._run_stream())
            
            self._logger.info("Started Alpaca streaming")
            
        except Exception as e:
            self._logger.error(f"Failed to start streaming: {e}")
    
    async def _run_stream(self) -> None:
        """Run the streaming client."""
        try:
            await self.stream.run()
        except Exception as e:
            self._logger.error(f"Streaming error: {e}")
            self._stats['stream_reconnections'] += 1
            # Could implement reconnection logic here
    
    async def _handle_trade_update(self, data) -> None:
        """Handle trade update from stream."""
        try:
            order_id = data.order.get('id')
            
            if order_id not in self._alpaca_order_mapping:
                return  # Not our order
            
            internal_order_id = self._alpaca_order_mapping[order_id]
            order = self._orders.get(internal_order_id)
            
            if not order:
                return
            
            # Map Alpaca status to our status
            old_status = order.status
            new_status = self._map_alpaca_order_status(data.order.get('status'))
            
            if new_status != old_status:
                order.status = new_status
                
                # Update statistics
                if new_status == OrderStatus.FILLED:
                    self._stats['orders_filled'] += 1
                elif new_status == OrderStatus.CANCELLED:
                    self._stats['orders_cancelled'] += 1
                elif new_status == OrderStatus.REJECTED:
                    self._stats['orders_rejected'] += 1
                
                # Publish status event
                await self._publish_order_status_event(
                    order, old_status, new_status, f"Alpaca status: {data.order.get('status')}"
                )
            
            # Handle fills
            if data.event == 'fill' or data.event == 'partial_fill':
                await self._handle_fill_update(data, order)
            
        except Exception as e:
            self._logger.error(f"Error handling trade update: {e}")
    
    async def _handle_fill_update(self, data, order: Order) -> None:
        """Handle fill update from stream."""
        try:
            # Update order fill tracking
            order.filled_quantity = float(data.order.get('filled_qty', 0))
            if data.order.get('filled_avg_price'):
                order.average_fill_price = float(data.order.get('filled_avg_price'))
            
            # Create fill event
            fill_quantity = float(data.qty) if data.qty else 0
            fill_price = float(data.price) if data.price else 0
            
            fill_event = OrderFilledEvent(
                order_id=order.order_id,
                symbol=order.symbol,
                quantity=fill_quantity,
                price=fill_price,
                commission=0.0,  # Alpaca is commission-free
                fill_id=data.execution_id or str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                remaining_quantity=order.quantity - order.filled_quantity,
                is_partial=order.filled_quantity < order.quantity
            )
            
            await self.event_bus.publish(fill_event)
            
            self._logger.info(
                f"Order fill: {order.symbol} {fill_quantity} @ {fill_price} (commission-free)"
            )
            
        except Exception as e:
            self._logger.error(f"Error handling fill update: {e}")
    
    def _map_alpaca_order_status(self, alpaca_status: str) -> OrderStatus:
        """Map Alpaca order status to our order status."""
        mapping = {
            'new': OrderStatus.SUBMITTED,
            'filled': OrderStatus.FILLED,
            'canceled': OrderStatus.CANCELLED,
            'rejected': OrderStatus.REJECTED,
            'pending_new': OrderStatus.PENDING,
            'partially_filled': OrderStatus.PARTIALLY_FILLED,
            'done_for_day': OrderStatus.CANCELLED,
            'expired': OrderStatus.CANCELLED,
        }
        return mapping.get(alpaca_status, OrderStatus.PENDING)
    
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
            broker_message=f"Alpaca: {reason}" if reason else None
        )
        await self.event_bus.publish(event)
    
    def get_broker_stats(self) -> Dict[str, Any]:
        """Get broker statistics."""
        return {
            **self._stats,
            'is_connected': self._is_connected,
            'last_heartbeat': self._last_heartbeat.isoformat() if self._last_heartbeat else None,
            'active_orders': len([o for o in self._orders.values() 
                                if o.status in [OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED]]),
            'total_orders': len(self._orders),
            'requests_per_minute': len([t for t in self._request_times 
                                      if datetime.utcnow() - t < timedelta(minutes=1)]),
            'base_url': self.base_url,
            'data_feed': self.data_feed,
            'streaming_enabled': self.enable_streaming,
        }
    
    async def close(self) -> None:
        """Close broker connection and clean up resources."""
        await self.disconnect()