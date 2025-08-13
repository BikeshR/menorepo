"""
Core module for Pi5 Trading System.

Contains fundamental interfaces, base classes, and system-wide utilities.
Provides the architectural foundation for all other modules.

Components:
- interfaces.py: Abstract base classes and protocols
- implementations.py: Core implementations and event system
- exceptions.py: System-wide exception hierarchy  
- error_recovery.py: Error handling and recovery strategies
"""

from .interfaces import (
    BaseEvent,
    EventHandler,
    MarketDataProvider, 
    BaseStrategy,
    Signal,
    TradingSignal,
    RiskManager,
    BrokerInterface,
    Order,
    OrderType,
    OrderStatus,
    Position,
    Portfolio,
)

from .exceptions import (
    TradingSystemError,
    MarketDataError,
    StrategyError,
    RiskManagementError,
    OrderError,
    PortfolioError,
    SystemError,
)

# Import market data components (temporarily disabled for deployment)
# from .market_data import (
#     YahooFinanceProvider,
#     AlphaVantageProvider,
#     MarketDataManager,
#     TechnicalIndicators,
#     DataQualityValidator
# )

__all__ = [
    # Interfaces
    "BaseEvent",
    "EventHandler",
    "MarketDataProvider",
    "BaseStrategy", 
    "Signal",
    "TradingSignal",
    "RiskManager",
    "BrokerInterface",
    "Order",
    "OrderType",
    "OrderStatus",
    "Position",
    "Portfolio",
    
    # Market Data Components (temporarily disabled for deployment)
    # "YahooFinanceProvider",
    # "AlphaVantageProvider", 
    # "MarketDataManager",
    # "TechnicalIndicators",
    # "DataQualityValidator",
    
    # Exceptions
    "TradingSystemError",
    "MarketDataError", 
    "StrategyError",
    "RiskManagementError",
    "OrderError",
    "PortfolioError",
    "SystemError",
]