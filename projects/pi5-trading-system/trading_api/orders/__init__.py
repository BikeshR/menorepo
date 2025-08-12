"""
Order management module for Pi5 Trading System.

Handles order creation, execution, tracking, and broker integration.
Provides paper trading implementation for testing and live broker interfaces.

Components:
- manager.py: Order manager with lifecycle management and tracking
- brokers/: Broker interface implementations
  - paper_broker.py: Paper trading broker for testing
  - live_broker.py: Live broker integrations (Interactive Brokers, etc.)
- order_types.py: Order type definitions and validation
- execution.py: Order execution engine and matching logic
"""

from orders.manager import OrderManager
from orders.brokers.paper_broker import PaperTradingBroker

__all__ = [
    "OrderManager",
    "PaperTradingBroker",
]