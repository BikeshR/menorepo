"""
Broker implementations for Pi5 Trading System.

Provides various broker interfaces including paper trading for testing
and live broker integrations for real trading.

Components:
- paper_broker.py: Paper trading broker with realistic fill simulation
- interactive_brokers.py: Live trading through Interactive Brokers TWS/Gateway
- alpaca_broker.py: Commission-free live trading through Alpaca Markets
- broker_manager.py: Advanced broker management with failover and load balancing
"""

from orders.brokers.paper_broker import PaperTradingBroker
from orders.brokers.interactive_brokers import InteractiveBrokersBroker
from orders.brokers.alpaca_broker import AlpacaBroker
from orders.brokers.broker_manager import BrokerManager, BrokerConfig, BrokerType, FailoverStrategy

__all__ = [
    "PaperTradingBroker",
    "InteractiveBrokersBroker", 
    "AlpacaBroker",
    "BrokerManager",
    "BrokerConfig",
    "BrokerType",
    "FailoverStrategy",
]