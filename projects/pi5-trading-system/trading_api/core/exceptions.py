"""
Exception hierarchy for Pi5 Trading System.

Provides comprehensive error handling with structured exception types,
error codes, context information, and serialization capabilities.

All exceptions inherit from TradingSystemError and include:
- Error categorization and codes
- Context information for debugging
- Timestamp tracking
- Serialization for logging and API responses

Exception Categories:
- MarketDataError: Data provider and market data issues
- StrategyError: Strategy execution and configuration issues  
- RiskManagementError: Risk limit violations and controls
- OrderError: Order execution and broker issues
- PortfolioError: Portfolio and position management issues
- SystemError: System-level and infrastructure issues
"""

from datetime import datetime
from typing import Any, Dict, Optional


class TradingSystemError(Exception):
    """
    Base exception for all trading system errors.
    
    Provides structured error information with context and timestamps
    for comprehensive error handling and logging.
    """
    
    def __init__(self, message: str, error_code: str = None, context: Dict = None):
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.context = context or {}
        self.timestamp = datetime.utcnow()
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging/API responses."""
        return {
            'error_type': self.__class__.__name__,
            'error_code': self.error_code,
            'message': self.message,
            'context': self.context,
            'timestamp': self.timestamp.isoformat()
        }


# ============================================================================
# MARKET DATA EXCEPTIONS
# ============================================================================

class MarketDataError(TradingSystemError):
    """Base exception for market data errors."""
    pass


class DataProviderError(MarketDataError):
    """
    Data provider connection/API error.
    
    Raised when external data providers (Yahoo Finance, Alpha Vantage)
    fail to respond or return errors.
    """
    pass


class DataQualityError(MarketDataError):
    """
    Data quality validation failed.
    
    Raised when market data fails quality checks such as:
    - Missing OHLCV columns
    - Invalid price relationships (high < low)
    - Extreme price movements
    - Data completeness issues
    """
    pass


class DataNotFoundError(MarketDataError):
    """
    Requested data not available.
    
    Raised when requested symbols or date ranges are not available
    from any configured data provider.
    """
    pass


class DataProviderConnectionError(DataProviderError):
    """
    Data provider connection failed.
    
    Raised when unable to establish connection to data provider APIs.
    """
    pass


class DataProviderRateLimitError(DataProviderError):
    """
    Data provider rate limit exceeded.
    
    Raised when API rate limits are exceeded and requests are throttled.
    """
    pass


# ============================================================================
# STRATEGY EXCEPTIONS
# ============================================================================

class StrategyError(TradingSystemError):
    """Base exception for strategy errors."""
    pass


class StrategyInitializationError(StrategyError):
    """
    Strategy failed to initialize.
    
    Raised when strategy cannot be properly initialized due to:
    - Missing required parameters
    - Invalid configuration
    - Insufficient historical data
    """
    pass


class StrategyExecutionError(StrategyError):
    """
    Strategy execution failed.
    
    Raised when strategy encounters runtime errors during:
    - Market data processing
    - Signal generation
    - Indicator calculations
    """
    pass


class StrategyConfigurationError(StrategyError):
    """
    Invalid strategy configuration.
    
    Raised when strategy parameters are invalid or incompatible.
    """
    pass


class StrategyNotFoundError(StrategyError):
    """
    Strategy not found.
    
    Raised when attempting to access a strategy that doesn't exist.
    """
    pass


class InsufficientHistoryError(StrategyError):
    """
    Insufficient historical data for strategy.
    
    Raised when strategy requires more historical data than available.
    """
    pass


# ============================================================================
# RISK MANAGEMENT EXCEPTIONS
# ============================================================================

class RiskManagementError(TradingSystemError):
    """Base exception for risk management errors."""
    pass


class RiskLimitViolationError(RiskManagementError):
    """
    Risk limits exceeded.
    
    Raised when trading signals or portfolio state violate configured
    risk limits such as position size, exposure, or loss limits.
    """
    
    def __init__(
        self, 
        violation_type: str, 
        current_value: float, 
        limit_value: float, 
        **kwargs
    ):
        self.violation_type = violation_type
        self.current_value = current_value
        self.limit_value = limit_value
        
        message = f"{violation_type}: {current_value:.4f} exceeds limit {limit_value:.4f}"
        context = {
            'violation_type': violation_type,
            'current_value': current_value,
            'limit_value': limit_value,
            **kwargs
        }
        super().__init__(message, context=context)


class InsufficientFundsError(RiskManagementError):
    """
    Insufficient funds for trade.
    
    Raised when attempting to place orders that exceed available cash.
    """
    pass


class PositionSizeError(RiskManagementError):
    """
    Position size exceeds limits.
    
    Raised when calculated position size violates risk management rules.
    """
    pass


class CorrelationRiskError(RiskManagementError):
    """
    Portfolio correlation risk exceeded.
    
    Raised when adding positions would create excessive correlation risk.
    """
    pass


class DrawdownLimitError(RiskManagementError):
    """
    Maximum drawdown limit exceeded.
    
    Raised when portfolio drawdown exceeds configured limits.
    """
    pass


# ============================================================================
# ORDER MANAGEMENT EXCEPTIONS
# ============================================================================

class OrderError(TradingSystemError):
    """Base exception for order-related errors."""
    pass


class OrderValidationError(OrderError):
    """
    Order failed validation.
    
    Raised when order parameters are invalid or incomplete.
    """
    pass


class OrderExecutionError(OrderError):
    """
    Order execution failed.
    
    Raised when order cannot be executed due to:
    - Market conditions
    - Broker issues
    - Insufficient liquidity
    """
    pass


class BrokerError(OrderError):
    """
    Broker API error.
    
    Raised when broker API calls fail or return errors.
    """
    pass


class OrderNotFoundError(OrderError):
    """
    Order not found.
    
    Raised when attempting to access or modify non-existent orders.
    """
    pass


class BrokerConnectionError(BrokerError):
    """
    Broker connection failed.
    
    Raised when unable to connect to broker API.
    """
    pass


class BrokerAuthenticationError(BrokerError):
    """
    Broker authentication failed.
    
    Raised when broker API credentials are invalid or expired.
    """
    pass


class OrderRejectedError(OrderError):
    """
    Order rejected by broker.
    
    Raised when broker rejects order due to account or market conditions.
    """
    pass


# ============================================================================
# PORTFOLIO EXCEPTIONS
# ============================================================================

class PortfolioError(TradingSystemError):
    """Base exception for portfolio errors."""
    pass


class PositionError(PortfolioError):
    """
    Position-related error.
    
    Raised when position operations fail or produce invalid states.
    """
    pass


class PerformanceCalculationError(PortfolioError):
    """
    Performance calculation failed.
    
    Raised when portfolio performance metrics cannot be calculated.
    """
    pass


class PositionNotFoundError(PositionError):
    """
    Position not found.
    
    Raised when attempting to access non-existent positions.
    """
    pass


class InvalidPositionStateError(PositionError):
    """
    Invalid position state.
    
    Raised when position operations result in invalid states.
    """
    pass


# ============================================================================
# SYSTEM EXCEPTIONS
# ============================================================================

class SystemError(TradingSystemError):
    """Base exception for system errors."""
    pass


class ConfigurationError(SystemError):
    """
    Configuration error.
    
    Raised when system configuration is invalid or missing.
    """
    pass


class DatabaseError(SystemError):
    """
    Database operation failed.
    
    Raised when database operations fail due to:
    - Connection issues
    - Query errors
    - Data integrity violations
    """
    pass


class EventProcessingError(SystemError):
    """
    Event processing failed.
    
    Raised when event system encounters errors during:
    - Event routing
    - Handler execution
    - Message serialization
    """
    pass


class InitializationError(SystemError):
    """
    System initialization failed.
    
    Raised when core system components fail to initialize.
    """
    pass


class ShutdownError(SystemError):
    """
    System shutdown failed.
    
    Raised when system cannot cleanly shutdown components.
    """
    pass


class ResourceExhaustionError(SystemError):
    """
    System resources exhausted.
    
    Raised when system resources (memory, CPU, disk) are exhausted.
    """
    pass


class DatabaseConnectionError(DatabaseError):
    """
    Database connection failed.
    
    Raised when unable to establish database connections.
    """
    pass


class DatabaseMigrationError(DatabaseError):
    """
    Database migration failed.
    
    Raised when database schema migrations encounter errors.
    """
    pass


class EventQueueFullError(EventProcessingError):
    """
    Event queue is full.
    
    Raised when event queue reaches capacity and cannot accept new events.
    """
    pass


# ============================================================================
# BACKTESTING EXCEPTIONS
# ============================================================================

class BacktestError(TradingSystemError):
    """Base exception for backtesting errors."""
    pass


class BacktestConfigurationError(BacktestError):
    """
    Backtest configuration is invalid.
    
    Raised when backtest parameters are invalid or incomplete.
    """
    pass


class BacktestExecutionError(BacktestError):
    """
    Backtest execution failed.
    
    Raised when backtest encounters runtime errors.
    """
    pass


class BacktestDataError(BacktestError):
    """
    Backtest data is insufficient or invalid.
    
    Raised when backtest cannot access required historical data.
    """
    pass


# ============================================================================
# API EXCEPTIONS
# ============================================================================

class APIError(TradingSystemError):
    """Base exception for API errors."""
    pass


class AuthenticationError(APIError):
    """
    API authentication failed.
    
    Raised when API requests fail authentication.
    """
    pass


class AuthorizationError(APIError):
    """
    API authorization failed.
    
    Raised when API requests are not authorized for requested operations.
    """
    pass


class ValidationError(APIError):
    """
    API request validation failed.
    
    Raised when API request parameters are invalid.
    """
    pass


class RateLimitError(APIError):
    """
    API rate limit exceeded.
    
    Raised when API rate limits are exceeded.
    """
    pass