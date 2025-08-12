"""
Core interfaces and abstract base classes for Pi5 Trading System.

This module defines the fundamental interfaces that all components must implement,
ensuring consistent architecture and enabling dependency injection, testing,
and modular component development.

All interfaces use ABC (Abstract Base Class) to enforce implementation contracts
and provide type hints for better IDE support and static analysis.
"""

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple, Union

import pandas as pd


# ============================================================================
# EVENT SYSTEM INTERFACES
# ============================================================================

class BaseEvent(ABC):
    """
    Base event class for all system events.
    
    Provides consistent event structure with unique IDs, timestamps,
    and serialization capabilities for logging and persistence.
    """
    
    def __init__(self):
        self.event_id: str = uuid.uuid4().hex
        self.timestamp: datetime = datetime.utcnow()
        self.source_module: str = self.__class__.__module__
        self.event_type: str = self.__class__.__name__
        self.correlation_id: Optional[str] = None
        self.metadata: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        """Serialize event to dictionary for logging/persistence."""
        return {
            'event_id': self.event_id,
            'timestamp': self.timestamp.isoformat(),
            'source_module': self.source_module,
            'event_type': self.event_type,
            'correlation_id': self.correlation_id,
            'metadata': self.metadata,
            **self._event_data()
        }
    
    @abstractmethod
    def _event_data(self) -> Dict[str, Any]:
        """Return event-specific data for serialization."""
        pass


class EventHandler(ABC):
    """
    Base class for event handlers.
    
    All event handlers must implement this interface to participate
    in the event-driven architecture.
    """
    
    @abstractmethod
    async def handle(self, event: BaseEvent) -> None:
        """Handle an incoming event."""
        pass
    
    @abstractmethod
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can process the given event type."""
        pass


# ============================================================================
# MARKET DATA INTERFACES
# ============================================================================

class MarketDataProvider(ABC):
    """
    Abstract interface for market data providers.
    
    Provides standardized interface for different data sources (Yahoo Finance,
    Alpha Vantage, etc.) with connection management and health monitoring.
    """
    
    def __init__(self, name: str, priority: int = 100):
        self.name = name
        self.priority = priority  # Lower = higher priority
        self.is_connected = False
        self.last_heartbeat: Optional[datetime] = None
        self.error_count = 0
        self.success_count = 0
        
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to data provider."""
        pass
        
    @abstractmethod
    async def disconnect(self) -> None:
        """Clean disconnect from data provider."""
        pass
        
    @abstractmethod
    async def get_real_time_quotes(
        self, symbols: List[str]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream real-time quotes for given symbols."""
        pass
        
    @abstractmethod
    async def get_historical_data(
        self, 
        symbol: str, 
        start_date: datetime, 
        end_date: datetime,
        interval: str = '1min'
    ) -> pd.DataFrame:
        """Get historical OHLCV data."""
        pass
        
    @abstractmethod
    async def get_symbol_info(self, symbol: str) -> Dict[str, Any]:
        """Get symbol metadata (name, exchange, sector, etc.)."""
        pass
        
    async def health_check(self) -> bool:
        """Perform health check on provider."""
        try:
            # Basic connectivity test
            test_data = await self.get_symbol_info("AAPL")
            self.last_heartbeat = datetime.utcnow()
            self.success_count += 1
            return bool(test_data)
        except Exception:
            self.error_count += 1
            return False


# ============================================================================
# STRATEGY INTERFACES
# ============================================================================

class TradingSignal(Enum):
    """Trading signal types."""
    BUY = "buy"
    SELL = "sell" 
    HOLD = "hold"
    CLOSE_LONG = "close_long"
    CLOSE_SHORT = "close_short"


@dataclass
class Signal:
    """
    Trading signal with metadata.
    
    Represents a trading decision generated by a strategy with
    confidence level and contextual information.
    """
    symbol: str
    signal_type: TradingSignal
    confidence: float  # 0.0 to 1.0
    price: float
    timestamp: datetime
    strategy_name: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError("Confidence must be between 0.0 and 1.0")


class BaseStrategy(ABC):
    """
    Abstract base class for all trading strategies.
    
    Provides standardized interface for strategy implementation,
    lifecycle management, and performance tracking.
    """
    
    def __init__(self, name: str, parameters: Dict[str, Any] = None):
        self.name = name
        self.parameters = parameters or {}
        self.is_active = False
        self.positions: Dict[str, float] = {}  # symbol -> quantity
        self.performance_metrics: Dict[str, float] = {}
        self.last_update: Optional[datetime] = None
        self.symbols: List[str] = []
        
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize strategy (load models, set up indicators, etc.)."""
        pass
        
    @abstractmethod
    async def on_market_data(self, market_data: 'MarketDataEvent') -> List[Signal]:
        """Process market data and generate trading signals."""
        pass
        
    @abstractmethod
    async def on_order_filled(self, order_fill: 'OrderFilledEvent') -> None:
        """Handle order fill notifications."""
        pass
        
    @abstractmethod
    def get_required_history(self) -> int:
        """Return number of historical periods needed for strategy."""
        pass
        
    async def start(self) -> None:
        """Start the strategy."""
        await self.initialize()
        self.is_active = True
        
    async def stop(self) -> None:
        """Stop the strategy."""
        self.is_active = False
        
    def update_position(self, symbol: str, quantity_change: float) -> None:
        """Update position tracking."""
        current = self.positions.get(symbol, 0.0)
        self.positions[symbol] = current + quantity_change
        if abs(self.positions[symbol]) < 1e-8:
            del self.positions[symbol]


# ============================================================================
# RISK MANAGEMENT INTERFACES
# ============================================================================

@dataclass
class RiskLimits:
    """Risk limits configuration."""
    max_position_size: float = 0.1  # % of portfolio
    max_portfolio_exposure: float = 1.0  # % of portfolio
    max_daily_loss: float = 0.02  # % of portfolio
    max_drawdown: float = 0.1  # % from peak
    max_correlation: float = 0.8  # between positions
    max_sector_exposure: float = 0.3  # % in single sector


class RiskViolation(Exception):
    """Exception raised when risk limits are violated."""
    
    def __init__(self, violation_type: str, current_value: float, limit: float):
        self.violation_type = violation_type
        self.current_value = current_value
        self.limit = limit
        super().__init__(
            f"{violation_type}: {current_value:.4f} exceeds limit {limit:.4f}"
        )


class RiskManager(ABC):
    """Abstract risk manager interface."""
    
    @abstractmethod
    async def validate_signal(
        self, 
        signal: Signal, 
        current_portfolio: 'Portfolio'
    ) -> Tuple[bool, Optional[RiskViolation]]:
        """Validate if signal passes risk checks."""
        pass
        
    @abstractmethod
    async def calculate_position_size(
        self,
        signal: Signal,
        portfolio_value: float,
        current_price: float
    ) -> float:
        """Calculate appropriate position size."""
        pass
        
    @abstractmethod
    async def check_portfolio_risk(
        self, portfolio: 'Portfolio'
    ) -> List[RiskViolation]:
        """Check current portfolio against risk limits."""
        pass


# ============================================================================
# ORDER MANAGEMENT INTERFACES
# ============================================================================

class OrderType(Enum):
    """Order types supported by the system."""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderStatus(Enum):
    """Order status enumeration."""
    PENDING = "pending"
    SUBMITTED = "submitted" 
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


@dataclass
class Order:
    """
    Order data structure.
    
    Represents a trading order with all necessary information
    for execution and tracking.
    """
    order_id: str
    symbol: str
    side: str  # 'buy' | 'sell'
    quantity: float
    order_type: OrderType
    price: Optional[float] = None
    stop_price: Optional[float] = None
    time_in_force: str = "DAY"  # DAY, GTC, IOC, FOK
    strategy_name: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    # Execution tracking
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    average_fill_price: float = 0.0
    commission: float = 0.0
    
    @property
    def is_complete(self) -> bool:
        """Check if order is complete."""
        return self.status in [
            OrderStatus.FILLED, 
            OrderStatus.CANCELLED, 
            OrderStatus.REJECTED
        ]
    
    @property
    def remaining_quantity(self) -> float:
        """Calculate remaining unfilled quantity."""
        return self.quantity - self.filled_quantity


class BrokerInterface(ABC):
    """Abstract broker interface."""
    
    @abstractmethod
    async def submit_order(self, order: Order) -> str:
        """Submit order to broker and return broker order ID."""
        pass
        
    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel existing order."""
        pass
        
    @abstractmethod
    async def get_account_info(self) -> Dict[str, Any]:
        """Get account information (cash, buying power, etc.)."""
        pass
        
    @abstractmethod
    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get current positions from broker."""
        pass


# ============================================================================
# PORTFOLIO INTERFACES
# ============================================================================

@dataclass 
class Position:
    """
    Portfolio position representation.
    
    Tracks a single position with cost basis, market value,
    and P&L calculations.
    """
    symbol: str
    quantity: float
    average_cost: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    realized_pnl: float = 0.0
    last_updated: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def cost_basis(self) -> float:
        """Calculate total cost basis."""
        return self.quantity * self.average_cost
    
    def update_price(self, new_price: float) -> None:
        """Update current price and recalculate values."""
        self.current_price = new_price
        self.market_value = self.quantity * new_price
        self.unrealized_pnl = self.market_value - self.cost_basis
        self.last_updated = datetime.utcnow()


class Portfolio:
    """
    Portfolio state manager.
    
    Tracks all positions, cash, and provides portfolio-level
    calculations and metrics.
    """
    
    def __init__(self, initial_cash: float):
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.positions: Dict[str, Position] = {}
        self.trade_history: List['Trade'] = []
        self.created_at = datetime.utcnow()
        
    @property
    def total_value(self) -> float:
        """Total portfolio value (cash + positions)."""
        position_value = sum(pos.market_value for pos in self.positions.values())
        return self.cash + position_value
    
    @property
    def total_return(self) -> float:
        """Total return since inception."""
        return (self.total_value - self.initial_cash) / self.initial_cash
    
    def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for symbol."""
        return self.positions.get(symbol)
    
    def update_position(
        self, symbol: str, quantity_change: float, price: float
    ) -> None:
        """Update position with new trade."""
        if symbol not in self.positions:
            if quantity_change != 0:
                self.positions[symbol] = Position(
                    symbol=symbol,
                    quantity=quantity_change,
                    average_cost=price,
                    current_price=price,
                    market_value=quantity_change * price,
                    unrealized_pnl=0.0
                )
        else:
            pos = self.positions[symbol]
            old_quantity = pos.quantity
            new_quantity = old_quantity + quantity_change
            
            if abs(new_quantity) < 1e-8:
                # Closing position
                del self.positions[symbol]
            else:
                # Update average cost for position additions
                if ((old_quantity >= 0 and quantity_change > 0) or 
                    (old_quantity <= 0 and quantity_change < 0)):
                    total_cost = (old_quantity * pos.average_cost + 
                                quantity_change * price)
                    pos.average_cost = total_cost / new_quantity
                
                pos.quantity = new_quantity
                pos.update_price(price)
        
        # Update cash
        self.cash -= quantity_change * price


# ============================================================================
# FORWARD REFERENCES FOR TYPE HINTS
# ============================================================================

# These are imported from other modules to avoid circular imports
# They are defined here as string literals for type hints
MarketDataEvent = 'MarketDataEvent'
OrderFilledEvent = 'OrderFilledEvent'
Trade = 'Trade'