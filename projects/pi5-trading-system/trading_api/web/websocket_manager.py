"""
WebSocket Connection Manager for Pi5 Trading System.

Manages WebSocket connections, subscriptions, and real-time
message broadcasting throughout the system.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Set
from events.event_bus import EventBus
from core.interfaces import EventHandler


logger = logging.getLogger(__name__)


class WebSocketManager(EventHandler):
    """
    Centralized WebSocket manager for real-time communication.
    
    Integrates with the event bus to broadcast trading system events
    to connected web clients via WebSocket connections.
    """
    
    def __init__(self, event_bus: EventBus):
        """
        Initialize WebSocket manager.
        
        Args:
            event_bus: Trading system event bus
        """
        self.event_bus = event_bus
        self.active_connections: Dict[str, Any] = {}
        self.subscriptions: Dict[str, Set[str]] = {}
        self.is_running = False
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self):
        """Start the WebSocket manager."""
        if self.is_running:
            return
        
        self.is_running = True
        
        # Subscribe to relevant events from the trading system
        await self._setup_event_subscriptions()
        
        self._logger.info("WebSocket manager started")
    
    async def stop(self):
        """Stop the WebSocket manager."""
        if not self.is_running:
            return
        
        self.is_running = False
        
        # Close all active connections
        for client_id in list(self.active_connections.keys()):
            await self.disconnect_client(client_id)
        
        # Unsubscribe from all events
        event_types = [
            "portfolio.updated", "position.updated",
            "order.created", "order.filled", "order.cancelled",
            "strategy.signal", "strategy.started", "strategy.stopped",
            "system.health", "system.alert"
        ]
        for event_type in event_types:
            self.event_bus.unsubscribe(event_type, self)
        
        self._logger.info("WebSocket manager stopped")
    
    async def _setup_event_subscriptions(self):
        """Subscribe to trading system events."""
        try:
            # Subscribe to portfolio events
            self.event_bus.subscribe("portfolio.updated", self)
            self.event_bus.subscribe("position.updated", self)
            
            # Subscribe to order events
            self.event_bus.subscribe("order.created", self)
            self.event_bus.subscribe("order.filled", self)
            self.event_bus.subscribe("order.cancelled", self)
            
            # Subscribe to strategy events
            self.event_bus.subscribe("strategy.signal", self)
            self.event_bus.subscribe("strategy.started", self)
            self.event_bus.subscribe("strategy.stopped", self)
            
            # Subscribe to system events
            self.event_bus.subscribe("system.health", self)
            self.event_bus.subscribe("system.alert", self)
            
        except Exception as e:
            self._logger.error(f"Error setting up event subscriptions: {e}")
    
    async def handle(self, event) -> None:
        """Handle incoming events from the event bus."""
        try:
            event_type = event.event_type
            
            if event_type in ["portfolio.updated", "position.updated"]:
                await self._handle_portfolio_event(event)
            elif event_type in ["order.created", "order.filled", "order.cancelled"]:
                await self._handle_order_event(event)
            elif event_type in ["strategy.signal", "strategy.started", "strategy.stopped"]:
                await self._handle_strategy_event(event)
            elif event_type in ["system.health", "system.alert"]:
                await self._handle_system_event(event)
            
        except Exception as e:
            self._logger.error(f"Error handling event {event.event_type}: {e}")
    
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can process the given event type."""
        return event_type in [
            "portfolio.updated", "position.updated",
            "order.created", "order.filled", "order.cancelled",
            "strategy.signal", "strategy.started", "strategy.stopped",
            "system.health", "system.alert"
        ]
    
    async def add_connection(self, client_id: str, websocket: Any):
        """Add a new WebSocket connection."""
        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = set()
        
        self._logger.info(f"WebSocket client connected: {client_id}")
    
    async def disconnect_client(self, client_id: str):
        """Disconnect a WebSocket client."""
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                await websocket.close()
            except Exception as e:
                self._logger.error(f"Error closing WebSocket for {client_id}: {e}")
            finally:
                del self.active_connections[client_id]
        
        if client_id in self.subscriptions:
            del self.subscriptions[client_id]
        
        self._logger.info(f"WebSocket client disconnected: {client_id}")
    
    async def broadcast_message(self, message: Dict[str, Any], channel: str = None):
        """Broadcast message to subscribed clients."""
        if not self.active_connections:
            return
        
        message_data = {
            **message,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            # Check channel subscription
            if channel and channel not in self.subscriptions.get(client_id, set()):
                continue
            
            try:
                import json
                await websocket.send_text(json.dumps(message_data))
            except Exception as e:
                self._logger.error(f"Error sending message to {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            await self.disconnect_client(client_id)
    
    # Event handlers
    
    async def _handle_portfolio_event(self, event):
        """Handle portfolio-related events."""
        try:
            await self.broadcast_message({
                "type": "portfolio_update",
                "data": {
                    "event_id": event.event_id,
                    "timestamp": event.timestamp.isoformat(),
                    "event_type": event.event_type,
                    "data": getattr(event, 'data', {})
                }
            }, channel="portfolio")
        except Exception as e:
            self._logger.error(f"Error handling portfolio event: {e}")
    
    async def _handle_order_event(self, event):
        """Handle order-related events."""
        try:
            await self.broadcast_message({
                "type": "order_update",
                "data": {
                    "event_id": event.event_id,
                    "timestamp": event.timestamp.isoformat(),
                    "event_type": event.event_type,
                    "data": getattr(event, 'data', {})
                }
            }, channel="orders")
        except Exception as e:
            self._logger.error(f"Error handling order event: {e}")
    
    async def _handle_strategy_event(self, event):
        """Handle strategy-related events."""
        try:
            await self.broadcast_message({
                "type": "strategy_update",
                "data": {
                    "event_id": event.event_id,
                    "timestamp": event.timestamp.isoformat(),
                    "event_type": event.event_type,
                    "data": getattr(event, 'data', {})
                }
            }, channel="strategies")
        except Exception as e:
            self._logger.error(f"Error handling strategy event: {e}")
    
    async def _handle_system_event(self, event):
        """Handle system-related events."""
        try:
            await self.broadcast_message({
                "type": "system_update",
                "data": {
                    "event_id": event.event_id,
                    "timestamp": event.timestamp.isoformat(),
                    "event_type": event.event_type,
                    "data": getattr(event, 'data', {})
                }
            }, channel="system")
        except Exception as e:
            self._logger.error(f"Error handling system event: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": len(self.active_connections),
            "active_clients": list(self.active_connections.keys()),
            "total_subscriptions": sum(len(subs) for subs in self.subscriptions.values()),
            "is_running": self.is_running
        }