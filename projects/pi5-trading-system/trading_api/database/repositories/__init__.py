"""
Repository layer for Pi5 Trading System.

Implements repository pattern for data access with consistent interfaces
and separation between business logic and data persistence.

Components:
- base.py: Abstract base repository with common CRUD operations
- market_data.py: Market data and time-series data repository
- order.py: Orders and order fills repository
- portfolio.py: Portfolio and positions repository
- strategy.py: Strategy management repository
- system.py: System events and logging repository
"""

from database.repositories.base import BaseRepository
from database.repositories.market_data import MarketDataRepository

__all__ = [
    "BaseRepository",
    "MarketDataRepository",
]