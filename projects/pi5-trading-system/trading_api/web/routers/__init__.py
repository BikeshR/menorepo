"""
API Routers for Pi5 Trading System Web Interface.

Contains all API endpoint routers for strategies, portfolio,
orders, system monitoring, WebSocket, and authentication.
"""

from .strategies import router as strategies_router
from .portfolio import router as portfolio_router
from .orders import router as orders_router
from .system import router as system_router
from .websocket import router as websocket_router
from .auth import router as auth_router

__all__ = [
    "strategies_router",
    "portfolio_router", 
    "orders_router",
    "system_router",
    "websocket_router",
    "auth_router"
]