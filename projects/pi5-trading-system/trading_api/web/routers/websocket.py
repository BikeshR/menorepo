"""
WebSocket API Endpoints.

WebSocket endpoints for real-time data streaming including
portfolio updates, order status, market data, and system events.
"""

import logging
import json
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from ..models import WebSocketMessage, WebSocketSubscription


logger = logging.getLogger(__name__)

router = APIRouter()


class WebSocketManager:
    """Manager for WebSocket connections and message broadcasting."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: Dict[str, WebSocketSubscription] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept new WebSocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket client connected: {client_id}")
    
    def disconnect(self, client_id: str):
        """Remove WebSocket connection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.subscriptions:
            del self.subscriptions[client_id]
        logger.info(f"WebSocket client disconnected: {client_id}")
    
    async def send_message(self, client_id: str, message: Dict[str, Any]):
        """Send message to specific client."""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")
                self.disconnect(client_id)
    
    async def broadcast_message(self, message: Dict[str, Any], channel: str = None):
        """Broadcast message to all subscribed clients."""
        message_obj = WebSocketMessage(
            type=message.get("type", "unknown"),
            data=message,
            timestamp=datetime.utcnow()
        )
        
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            # Check if client is subscribed to the channel
            if channel and client_id in self.subscriptions:
                subscription = self.subscriptions[client_id]
                if channel not in subscription.channels:
                    continue
            
            try:
                await websocket.send_text(message_obj.model_dump_json())
            except Exception as e:
                logger.error(f"Error broadcasting to {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics."""
        return {
            "total_connections": len(self.active_connections),
            "total_subscriptions": len(self.subscriptions),
            "active_clients": list(self.active_connections.keys())
        }


# Global WebSocket manager
websocket_manager = WebSocketManager()


@router.websocket("/")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str = Query(..., description="Unique client identifier")
):
    """
    Main WebSocket endpoint for real-time communication.
    
    Provides real-time updates for:
    - Portfolio changes
    - Order status updates  
    - Strategy signals
    - System health alerts
    - Market data updates
    """
    await websocket_manager.connect(websocket, client_id)
    
    try:
        # Send welcome message
        await websocket_manager.send_message(client_id, {
            "type": "connection",
            "data": {
                "status": "connected",
                "client_id": client_id,
                "timestamp": datetime.utcnow().isoformat(),
                "available_channels": [
                    "portfolio",
                    "orders",
                    "strategies", 
                    "system",
                    "market_data"
                ]
            }
        })
        
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "subscribe":
                await handle_subscription(client_id, message)
            elif message.get("type") == "unsubscribe":
                await handle_unsubscription(client_id, message)
            elif message.get("type") == "ping":
                await handle_ping(client_id)
            else:
                logger.warning(f"Unknown message type from {client_id}: {message.get('type')}")
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        websocket_manager.disconnect(client_id)


async def handle_subscription(client_id: str, message: Dict[str, Any]):
    """Handle client subscription requests."""
    try:
        channels = message.get("channels", [])
        symbols = message.get("symbols", [])
        strategies = message.get("strategies", [])
        
        # Validate channels
        valid_channels = ["portfolio", "orders", "strategies", "system", "market_data"]
        channels = [c for c in channels if c in valid_channels]
        
        subscription = WebSocketSubscription(
            channels=channels,
            symbols=symbols,
            strategies=strategies
        )
        
        websocket_manager.subscriptions[client_id] = subscription
        
        # Send confirmation
        await websocket_manager.send_message(client_id, {
            "type": "subscription_confirmed",
            "data": {
                "channels": channels,
                "symbols": symbols,
                "strategies": strategies,
                "timestamp": datetime.utcnow().isoformat()
            }
        })
        
        # Send initial data for subscribed channels
        await send_initial_data(client_id, subscription)
        
        logger.info(f"Client {client_id} subscribed to channels: {channels}")
        
    except Exception as e:
        logger.error(f"Error handling subscription for {client_id}: {e}")


async def handle_unsubscription(client_id: str, message: Dict[str, Any]):
    """Handle client unsubscription requests."""
    try:
        channels = message.get("channels", [])
        
        if client_id in websocket_manager.subscriptions:
            subscription = websocket_manager.subscriptions[client_id]
            # Remove specified channels
            for channel in channels:
                if channel in subscription.channels:
                    subscription.channels.remove(channel)
        
        await websocket_manager.send_message(client_id, {
            "type": "unsubscription_confirmed", 
            "data": {
                "channels": channels,
                "timestamp": datetime.utcnow().isoformat()
            }
        })
        
        logger.info(f"Client {client_id} unsubscribed from channels: {channels}")
        
    except Exception as e:
        logger.error(f"Error handling unsubscription for {client_id}: {e}")


async def handle_ping(client_id: str):
    """Handle ping messages (keepalive)."""
    await websocket_manager.send_message(client_id, {
        "type": "pong",
        "data": {
            "timestamp": datetime.utcnow().isoformat()
        }
    })


async def send_initial_data(client_id: str, subscription: WebSocketSubscription):
    """Send initial data for newly subscribed channels."""
    try:
        for channel in subscription.channels:
            if channel == "portfolio":
                await websocket_manager.send_message(client_id, {
                    "type": "portfolio_update",
                    "data": {
                        "total_equity": 127450.75,
                        "day_change": 1245.30,
                        "day_change_percent": 0.98,
                        "positions_count": 8,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                })
            
            elif channel == "orders":
                await websocket_manager.send_message(client_id, {
                    "type": "orders_summary",
                    "data": {
                        "pending_orders": 3,
                        "filled_orders_today": 12,
                        "total_value": 45600.00,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                })
            
            elif channel == "strategies":
                await websocket_manager.send_message(client_id, {
                    "type": "strategies_summary", 
                    "data": {
                        "active_strategies": 2,
                        "total_strategies": 4,
                        "performance_today": 1.2,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                })
            
            elif channel == "system":
                await websocket_manager.send_message(client_id, {
                    "type": "system_status",
                    "data": {
                        "status": "healthy",
                        "cpu_usage": 23.5,
                        "memory_usage": 34.2,
                        "uptime_hours": 120.5,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                })
                
    except Exception as e:
        logger.error(f"Error sending initial data to {client_id}: {e}")


# Broadcasting functions (called by other parts of the system)

async def broadcast_portfolio_update(data: Dict[str, Any]):
    """Broadcast portfolio update to subscribed clients."""
    await websocket_manager.broadcast_message({
        "type": "portfolio_update",
        "data": data
    }, channel="portfolio")


async def broadcast_order_update(data: Dict[str, Any]):
    """Broadcast order update to subscribed clients."""
    await websocket_manager.broadcast_message({
        "type": "order_update",
        "data": data
    }, channel="orders")


async def broadcast_strategy_signal(data: Dict[str, Any]):
    """Broadcast strategy signal to subscribed clients."""
    await websocket_manager.broadcast_message({
        "type": "strategy_signal",
        "data": data
    }, channel="strategies")


async def broadcast_system_alert(data: Dict[str, Any]):
    """Broadcast system alert to subscribed clients.""" 
    await websocket_manager.broadcast_message({
        "type": "system_alert",
        "data": data
    }, channel="system")


async def broadcast_market_data(data: Dict[str, Any]):
    """Broadcast market data update to subscribed clients."""
    await websocket_manager.broadcast_message({
        "type": "market_data",
        "data": data
    }, channel="market_data")


# Utility endpoint to get WebSocket stats
@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    return websocket_manager.get_stats()