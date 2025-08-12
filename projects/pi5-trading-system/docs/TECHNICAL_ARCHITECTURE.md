# Pi 5 Trading System - Technical Architecture Design

**Version:** 1.0  
**Date:** 2025-01-09  
**Status:** Technical Design Phase - COMPREHENSIVE SPECIFICATION  

## Table of Contents
1. [Class Architecture & Interfaces](#1-class-architecture--interfaces)
2. [Database Architecture & Schema](#2-database-architecture--schema)
3. [Event System Architecture](#3-event-system-architecture)
4. [API Architecture & Specifications](#4-api-architecture--specifications)
5. [Error Handling & Recovery](#5-error-handling--recovery)
6. [Performance Optimization](#6-performance-optimization)
7. [Concurrency & Threading Model](#7-concurrency--threading-model)
8. [Configuration Management](#8-configuration-management)
9. [Security Architecture](#9-security-architecture)
10. [Testing Architecture](#10-testing-architecture)
11. [Logging & Monitoring](#11-logging--monitoring)
12. [Data Flow Specifications](#12-data-flow-specifications)
13. [Deployment Architecture](#13-deployment-architecture)

---

## 1. Class Architecture & Interfaces

### 1.1 Core Interfaces & Abstract Base Classes

```python
# src/core/interfaces.py
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, AsyncGenerator
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import asyncio

# ============================================================================
# EVENT SYSTEM INTERFACES
# ============================================================================

class BaseEvent(ABC):
    """Base event class for all system events."""
    
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
    """Base class for event handlers."""
    
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
    """Abstract interface for market data providers."""
    
    def __init__(self, name: str, priority: int = 100):
        self.name = name
        self.priority = priority  # Lower = higher priority
        self.is_connected = False
        self.last_heartbeat = None
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
    async def get_real_time_quotes(self, symbols: List[str]) -> AsyncGenerator[Dict[str, Any], None]:
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
            test_data = await asyncio.wait_for(
                self.get_symbol_info("AAPL"), 
                timeout=5.0
            )
            self.last_heartbeat = datetime.utcnow()
            self.success_count += 1
            return True
        except Exception as e:
            self.error_count += 1
            logger.error(f"Health check failed for {self.name}: {e}")
            return False

# ============================================================================
# STRATEGY INTERFACES
# ============================================================================

class TradingSignal(Enum):
    BUY = "buy"
    SELL = "sell" 
    HOLD = "hold"
    CLOSE_LONG = "close_long"
    CLOSE_SHORT = "close_short"

@dataclass
class Signal:
    """Trading signal with metadata."""
    symbol: str
    signal_type: TradingSignal
    confidence: float  # 0.0 to 1.0
    price: float
    timestamp: datetime
    strategy_name: str
    metadata: Dict[str, Any]
    
    def __post_init__(self):
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError("Confidence must be between 0.0 and 1.0")

class BaseStrategy(ABC):
    """Abstract base class for all trading strategies."""
    
    def __init__(self, name: str, parameters: Dict[str, Any] = None):
        self.name = name
        self.parameters = parameters or {}
        self.is_active = False
        self.positions: Dict[str, float] = {}  # symbol -> quantity
        self.performance_metrics: Dict[str, float] = {}
        self.last_update = None
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
        super().__init__(f"{violation_type}: {current_value:.4f} exceeds limit {limit:.4f}")

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
    async def check_portfolio_risk(self, portfolio: 'Portfolio') -> List[RiskViolation]:
        """Check current portfolio against risk limits."""
        pass

# ============================================================================
# ORDER MANAGEMENT INTERFACES
# ============================================================================

class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"

class OrderStatus(Enum):
    PENDING = "pending"
    SUBMITTED = "submitted" 
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"

@dataclass
class Order:
    """Order data structure."""
    order_id: str
    symbol: str
    side: str  # 'buy' | 'sell'
    quantity: float
    order_type: OrderType
    price: Optional[float] = None
    stop_price: Optional[float] = None
    time_in_force: str = "DAY"  # DAY, GTC, IOC, FOK
    strategy_name: str = ""
    created_at: datetime = datetime.utcnow()
    
    # Execution tracking
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    average_fill_price: float = 0.0
    commission: float = 0.0
    
    @property
    def is_complete(self) -> bool:
        return self.status in [OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED]
    
    @property
    def remaining_quantity(self) -> float:
        return self.quantity - self.filled_quantity

class BrokerInterface(ABC):
    """Abstract broker interface."""
    
    @abstractmethod
    async def submit_order(self, order: Order) -> str:
        """Submit order to broker and return order ID."""
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
        """Get current positions."""
        pass

# ============================================================================
# PORTFOLIO INTERFACES
# ============================================================================

@dataclass 
class Position:
    """Portfolio position."""
    symbol: str
    quantity: float
    average_cost: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    realized_pnl: float = 0.0
    
    @property
    def cost_basis(self) -> float:
        return self.quantity * self.average_cost
    
    def update_price(self, new_price: float) -> None:
        """Update current price and recalculate values."""
        self.current_price = new_price
        self.market_value = self.quantity * new_price
        self.unrealized_pnl = self.market_value - self.cost_basis

class Portfolio:
    """Portfolio state manager."""
    
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
    
    def update_position(self, symbol: str, quantity_change: float, price: float) -> None:
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
                # Update average cost
                if (old_quantity >= 0 and quantity_change > 0) or (old_quantity <= 0 and quantity_change < 0):
                    # Adding to position
                    total_cost = (old_quantity * pos.average_cost) + (quantity_change * price)
                    pos.average_cost = total_cost / new_quantity
                
                pos.quantity = new_quantity
                pos.update_price(price)
        
        # Update cash
        self.cash -= quantity_change * price
```

### 1.2 Concrete Implementation Classes

```python
# src/core/implementations.py

# ============================================================================
# EVENT SYSTEM IMPLEMENTATION
# ============================================================================

class EventBus:
    """Centralized event bus for async event processing."""
    
    def __init__(self, max_queue_size: int = 10000):
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._event_queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        self._running = False
        self._processor_task: Optional[asyncio.Task] = None
        self._stats = {
            'events_published': 0,
            'events_processed': 0,
            'events_failed': 0,
            'handlers_registered': 0
        }
    
    async def start(self) -> None:
        """Start event processing."""
        self._running = True
        self._processor_task = asyncio.create_task(self._process_events())
        logger.info("EventBus started")
    
    async def stop(self) -> None:
        """Stop event processing."""
        self._running = False
        if self._processor_task:
            self._processor_task.cancel()
            try:
                await self._processor_task
            except asyncio.CancelledError:
                pass
        logger.info("EventBus stopped")
    
    def register_handler(self, event_type: str, handler: EventHandler) -> None:
        """Register event handler."""
        self._handlers[event_type].append(handler)
        self._stats['handlers_registered'] += 1
        logger.debug(f"Registered handler {handler.__class__.__name__} for {event_type}")
    
    async def publish(self, event: BaseEvent) -> None:
        """Publish event to bus."""
        try:
            await self._event_queue.put(event)
            self._stats['events_published'] += 1
            logger.debug(f"Published {event.event_type} event: {event.event_id}")
        except asyncio.QueueFull:
            logger.error("Event queue full, dropping event")
            self._stats['events_failed'] += 1
    
    async def _process_events(self) -> None:
        """Main event processing loop."""
        while self._running:
            try:
                event = await asyncio.wait_for(self._event_queue.get(), timeout=1.0)
                await self._handle_event(event)
                self._stats['events_processed'] += 1
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing event: {e}")
                self._stats['events_failed'] += 1
    
    async def _handle_event(self, event: BaseEvent) -> None:
        """Route event to appropriate handlers."""
        handlers = self._handlers.get(event.event_type, [])
        if not handlers:
            logger.warning(f"No handlers for event type: {event.event_type}")
            return
        
        # Process handlers concurrently
        tasks = []
        for handler in handlers:
            if handler.can_handle(event.event_type):
                task = asyncio.create_task(
                    self._handle_with_error_handling(handler, event)
                )
                tasks.append(task)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _handle_with_error_handling(self, handler: EventHandler, event: BaseEvent) -> None:
        """Handle event with error isolation."""
        try:
            await handler.handle(event)
        except Exception as e:
            logger.error(f"Handler {handler.__class__.__name__} failed: {e}")
            # Publish error event for monitoring
            error_event = SystemErrorEvent(
                error_type="handler_error",
                handler_name=handler.__class__.__name__,
                original_event_id=event.event_id,
                error_message=str(e)
            )
            await self.publish(error_event)

# ============================================================================
# MARKET DATA EVENTS
# ============================================================================

class MarketDataEvent(BaseEvent):
    """Real-time market data event."""
    
    def __init__(self, symbol: str, data: Dict[str, Any]):
        super().__init__()
        self.symbol = symbol
        self.bid = data.get('bid')
        self.ask = data.get('ask')
        self.last_price = data.get('last_price')
        self.volume = data.get('volume')
        self.bid_size = data.get('bid_size')
        self.ask_size = data.get('ask_size')
        self.timestamp_exchange = data.get('timestamp')
        
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.symbol,
            'bid': self.bid,
            'ask': self.ask,
            'last_price': self.last_price,
            'volume': self.volume,
            'bid_size': self.bid_size,
            'ask_size': self.ask_size,
            'timestamp_exchange': self.timestamp_exchange
        }

class SignalEvent(BaseEvent):
    """Trading signal event."""
    
    def __init__(self, signal: Signal):
        super().__init__()
        self.signal = signal
        
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.signal.symbol,
            'signal_type': self.signal.signal_type.value,
            'confidence': self.signal.confidence,
            'price': self.signal.price,
            'strategy_name': self.signal.strategy_name,
            'metadata': self.signal.metadata
        }

class OrderEvent(BaseEvent):
    """Order lifecycle event."""
    
    def __init__(self, order: Order, event_subtype: str):
        super().__init__()
        self.order = order
        self.event_subtype = event_subtype  # 'submitted', 'filled', 'cancelled', 'rejected'
        
    def _event_data(self) -> Dict[str, Any]:
        return {
            'order_id': self.order.order_id,
            'symbol': self.order.symbol,
            'side': self.order.side,
            'quantity': self.order.quantity,
            'order_type': self.order.order_type.value,
            'status': self.order.status.value,
            'event_subtype': self.event_subtype,
            'filled_quantity': self.order.filled_quantity,
            'average_fill_price': self.order.average_fill_price
        }

# ============================================================================
# STRATEGY IMPLEMENTATIONS
# ============================================================================

class MovingAverageCrossoverStrategy(BaseStrategy):
    """Moving average crossover strategy implementation."""
    
    def __init__(self, parameters: Dict[str, Any] = None):
        default_params = {
            'short_window': 10,
            'long_window': 20,
            'min_confidence': 0.6
        }
        params = {**default_params, **(parameters or {})}
        super().__init__("MovingAverageCrossover", params)
        
        self.short_window = params['short_window']
        self.long_window = params['long_window'] 
        self.min_confidence = params['min_confidence']
        
        # Data storage for calculations
        self.price_history: Dict[str, List[float]] = defaultdict(list)
        self.short_ma: Dict[str, float] = {}
        self.long_ma: Dict[str, float] = {}
        self.previous_signal: Dict[str, TradingSignal] = {}
        
    async def initialize(self) -> None:
        """Initialize strategy."""
        logger.info(f"Initializing {self.name} with params: {self.parameters}")
        
    def get_required_history(self) -> int:
        """Return required history length."""
        return self.long_window + 10  # Buffer for stability
        
    async def on_market_data(self, market_data: MarketDataEvent) -> List[Signal]:
        """Process market data and generate signals."""
        symbol = market_data.symbol
        price = market_data.last_price
        
        if not price:
            return []
            
        # Update price history
        self.price_history[symbol].append(price)
        
        # Maintain window size
        max_history = self.long_window * 2
        if len(self.price_history[symbol]) > max_history:
            self.price_history[symbol] = self.price_history[symbol][-max_history:]
        
        # Need enough data for calculation
        if len(self.price_history[symbol]) < self.long_window:
            return []
            
        # Calculate moving averages
        prices = self.price_history[symbol]
        self.short_ma[symbol] = sum(prices[-self.short_window:]) / self.short_window
        self.long_ma[symbol] = sum(prices[-self.long_window:]) / self.long_window
        
        # Generate signal
        signal = self._generate_signal(symbol, price, market_data.timestamp)
        return [signal] if signal else []
        
    def _generate_signal(self, symbol: str, price: float, timestamp: datetime) -> Optional[Signal]:
        """Generate trading signal based on MA crossover."""
        short_ma = self.short_ma.get(symbol)
        long_ma = self.long_ma.get(symbol)
        
        if not (short_ma and long_ma):
            return None
            
        previous_signal = self.previous_signal.get(symbol, TradingSignal.HOLD)
        current_signal = TradingSignal.HOLD
        
        # Signal generation logic
        if short_ma > long_ma:
            current_signal = TradingSignal.BUY
        elif short_ma < long_ma:
            current_signal = TradingSignal.SELL
            
        # Only generate signal on change
        if current_signal == previous_signal or current_signal == TradingSignal.HOLD:
            return None
            
        self.previous_signal[symbol] = current_signal
        
        # Calculate confidence based on MA separation
        ma_separation = abs(short_ma - long_ma) / long_ma
        confidence = min(ma_separation * 10, 1.0)  # Scale to 0-1
        
        if confidence < self.min_confidence:
            return None
            
        return Signal(
            symbol=symbol,
            signal_type=current_signal,
            confidence=confidence,
            price=price,
            timestamp=timestamp,
            strategy_name=self.name,
            metadata={
                'short_ma': short_ma,
                'long_ma': long_ma,
                'ma_separation': ma_separation
            }
        )
        
    async def on_order_filled(self, order_fill: 'OrderFilledEvent') -> None:
        """Handle order fill notifications."""
        symbol = order_fill.order.symbol
        quantity_change = order_fill.order.filled_quantity
        if order_fill.order.side == 'sell':
            quantity_change = -quantity_change
            
        self.update_position(symbol, quantity_change)
        logger.info(f"{self.name} position updated: {symbol} {self.positions.get(symbol, 0)}")

# ============================================================================
# RISK MANAGEMENT IMPLEMENTATION
# ============================================================================

class StandardRiskManager(RiskManager):
    """Standard risk management implementation."""
    
    def __init__(self, limits: RiskLimits = None):
        self.limits = limits or RiskLimits()
        self.daily_pnl = 0.0
        self.daily_reset_time = datetime.utcnow().date()
        
    async def validate_signal(
        self, 
        signal: Signal, 
        current_portfolio: Portfolio
    ) -> Tuple[bool, Optional[RiskViolation]]:
        """Validate signal against risk limits."""
        try:
            # Check daily loss limit
            self._check_daily_loss(current_portfolio)
            
            # Check portfolio exposure
            self._check_portfolio_exposure(signal, current_portfolio)
            
            # Check position size
            self._check_position_size(signal, current_portfolio)
            
            return True, None
            
        except RiskViolation as rv:
            return False, rv
    
    def _check_daily_loss(self, portfolio: Portfolio) -> None:
        """Check daily loss limits."""
        current_date = datetime.utcnow().date()
        if current_date != self.daily_reset_time:
            self.daily_pnl = 0.0  # Reset daily tracking
            self.daily_reset_time = current_date
            
        daily_return = self.daily_pnl / portfolio.initial_cash
        if daily_return < -self.limits.max_daily_loss:
            raise RiskViolation(
                "daily_loss_limit", 
                abs(daily_return), 
                self.limits.max_daily_loss
            )
    
    def _check_portfolio_exposure(self, signal: Signal, portfolio: Portfolio) -> None:
        """Check total portfolio exposure."""
        total_exposure = sum(abs(pos.market_value) for pos in portfolio.positions.values())
        exposure_ratio = total_exposure / portfolio.total_value
        
        if exposure_ratio > self.limits.max_portfolio_exposure:
            raise RiskViolation(
                "portfolio_exposure", 
                exposure_ratio, 
                self.limits.max_portfolio_exposure
            )
    
    def _check_position_size(self, signal: Signal, portfolio: Portfolio) -> None:
        """Check individual position size limits."""
        # This would require the proposed position size
        # Implementation depends on position sizing calculation
        pass
    
    async def calculate_position_size(
        self,
        signal: Signal,
        portfolio_value: float,
        current_price: float
    ) -> float:
        """Calculate position size based on risk limits."""
        # Simple fixed percentage sizing
        max_position_value = portfolio_value * self.limits.max_position_size
        max_shares = max_position_value / current_price
        
        # Apply confidence scaling
        confidence_adjusted = max_shares * signal.confidence
        
        return confidence_adjusted
    
    async def check_portfolio_risk(self, portfolio: Portfolio) -> List[RiskViolation]:
        """Comprehensive portfolio risk check."""
        violations = []
        
        try:
            self._check_daily_loss(portfolio)
        except RiskViolation as rv:
            violations.append(rv)
            
        # Add more checks as needed
        return violations
```

---

## 2. Database Architecture & Schema

### 2.1 TimescaleDB Schema Design

```sql
-- ============================================================================
-- TIME-SERIES TABLES (HYPERTABLES)
-- ============================================================================

-- Market data hypertable - optimized for high-frequency inserts
CREATE TABLE market_data (
    time TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    
    -- OHLCV data
    open DECIMAL(12,4),
    high DECIMAL(12,4), 
    low DECIMAL(12,4),
    close DECIMAL(12,4),
    volume BIGINT,
    
    -- Level 1 quote data
    bid DECIMAL(12,4),
    ask DECIMAL(12,4),
    bid_size INTEGER,
    ask_size INTEGER,
    
    -- Metadata
    exchange TEXT,
    data_provider TEXT,
    data_quality_score INTEGER DEFAULT 100, -- 0-100
    
    PRIMARY KEY (time, symbol)
);

-- Create hypertable with 1-day chunks (optimal for Pi 5 memory)
SELECT create_hypertable('market_data', 'time', chunk_time_interval => INTERVAL '1 day');

-- Create indexes for efficient queries
CREATE INDEX idx_market_data_symbol_time ON market_data (symbol, time DESC);
CREATE INDEX idx_market_data_provider ON market_data (data_provider, time DESC);

-- Continuous aggregate for OHLCV resampling
CREATE MATERIALIZED VIEW market_data_1min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS time_bucket,
    symbol,
    FIRST(open, time) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, time) AS close,
    SUM(volume) AS volume,
    COUNT(*) AS tick_count
FROM market_data
GROUP BY time_bucket, symbol;

-- ============================================================================
-- TRADING TABLES
-- ============================================================================

-- Orders table
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_order_id UUID REFERENCES orders(order_id), -- For child orders
    
    -- Order details
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(18,8) NOT NULL CHECK (quantity > 0),
    order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
    
    -- Pricing
    limit_price DECIMAL(12,4),
    stop_price DECIMAL(12,4),
    
    -- Execution details
    filled_quantity DECIMAL(18,8) DEFAULT 0,
    remaining_quantity DECIMAL(18,8),
    average_fill_price DECIMAL(12,4),
    
    -- Status and timing
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'submitted', 'partially_filled', 'filled', 'cancelled', 'rejected')),
    time_in_force TEXT DEFAULT 'DAY' CHECK (time_in_force IN ('DAY', 'GTC', 'IOC', 'FOK')),
    
    -- Trading context
    strategy_name TEXT,
    signal_confidence DECIMAL(3,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    first_fill_at TIMESTAMPTZ,
    last_fill_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    
    -- Financial tracking
    commission DECIMAL(12,4) DEFAULT 0,
    fees DECIMAL(12,4) DEFAULT 0,
    
    -- Metadata
    broker_order_id TEXT,
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX idx_orders_symbol ON orders (symbol, created_at DESC);
CREATE INDEX idx_orders_strategy ON orders (strategy_name, created_at DESC);
CREATE INDEX idx_orders_status ON orders (status, created_at DESC);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

-- Order fills (executions)
CREATE TABLE order_fills (
    fill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id),
    
    -- Execution details
    fill_quantity DECIMAL(18,8) NOT NULL,
    fill_price DECIMAL(12,4) NOT NULL,
    fill_time TIMESTAMPTZ DEFAULT NOW(),
    
    -- Costs
    commission DECIMAL(12,4) DEFAULT 0,
    fees DECIMAL(12,4) DEFAULT 0,
    
    -- Source tracking
    broker_fill_id TEXT,
    exchange TEXT,
    
    CONSTRAINT valid_fill_quantity CHECK (fill_quantity > 0)
);

CREATE INDEX idx_order_fills_order_id ON order_fills (order_id, fill_time DESC);
CREATE INDEX idx_order_fills_time ON order_fills (fill_time DESC);

-- ============================================================================
-- PORTFOLIO TABLES  
-- ============================================================================

-- Current positions snapshot
CREATE TABLE positions (
    symbol TEXT PRIMARY KEY,
    
    -- Position details
    quantity DECIMAL(18,8) NOT NULL,
    average_cost DECIMAL(12,4) NOT NULL,
    
    -- Current market data
    current_price DECIMAL(12,4),
    market_value DECIMAL(18,2),
    
    -- P&L tracking
    unrealized_pnl DECIMAL(18,2),
    realized_pnl DECIMAL(18,2) DEFAULT 0,
    
    -- Risk metrics
    day_change DECIMAL(18,2),
    day_change_percent DECIMAL(8,4),
    
    -- Metadata
    first_acquired TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Strategy attribution
    primary_strategy TEXT,
    strategy_allocation JSONB, -- {"strategy1": 0.6, "strategy2": 0.4}
    
    CONSTRAINT non_zero_position CHECK (quantity != 0)
);

CREATE INDEX idx_positions_updated ON positions (last_updated DESC);

-- Historical position snapshots
CREATE TABLE position_history (
    time TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    
    -- Historical position data
    quantity DECIMAL(18,8),
    market_value DECIMAL(18,2),
    unrealized_pnl DECIMAL(18,2),
    
    -- Context
    trigger_event TEXT, -- 'trade', 'price_update', 'dividend', etc.
    
    PRIMARY KEY (time, symbol)
);

SELECT create_hypertable('position_history', 'time', chunk_time_interval => INTERVAL '7 days');

-- Portfolio performance snapshots
CREATE TABLE portfolio_snapshots (
    time TIMESTAMPTZ NOT NULL PRIMARY KEY,
    
    -- Portfolio values
    total_value DECIMAL(18,2) NOT NULL,
    cash DECIMAL(18,2) NOT NULL,
    positions_value DECIMAL(18,2) NOT NULL,
    
    -- Returns
    daily_return DECIMAL(8,6),
    total_return DECIMAL(8,6),
    
    -- Risk metrics
    volatility DECIMAL(8,6),
    sharpe_ratio DECIMAL(8,4),
    max_drawdown DECIMAL(8,6),
    
    -- Portfolio composition
    num_positions INTEGER,
    largest_position_percent DECIMAL(5,2),
    
    -- Metadata
    snapshot_trigger TEXT, -- 'scheduled', 'trade', 'eod'
    market_hours BOOLEAN DEFAULT true
);

SELECT create_hypertable('portfolio_snapshots', 'time', chunk_time_interval => INTERVAL '1 month');

-- ============================================================================
-- STRATEGY TABLES
-- ============================================================================

-- Strategy configurations
CREATE TABLE strategies (
    strategy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    class_name TEXT NOT NULL, -- Python class name
    version TEXT DEFAULT '1.0',
    
    -- Configuration
    parameters JSONB NOT NULL,
    symbols TEXT[] NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    is_backtested BOOLEAN DEFAULT false,
    
    -- Performance tracking
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2),
    total_return DECIMAL(8,6),
    sharpe_ratio DECIMAL(8,4),
    max_drawdown DECIMAL(8,6),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    last_run TIMESTAMPTZ,
    
    -- Risk allocation
    max_portfolio_allocation DECIMAL(3,2) DEFAULT 0.25 -- 25%
);

CREATE INDEX idx_strategies_active ON strategies (is_active, name);

-- Strategy performance history
CREATE TABLE strategy_performance (
    time TIMESTAMPTZ NOT NULL,
    strategy_id UUID NOT NULL REFERENCES strategies(strategy_id),
    
    -- Performance metrics
    portfolio_value DECIMAL(18,2),
    daily_return DECIMAL(8,6),
    cumulative_return DECIMAL(8,6),
    
    -- Trade statistics
    trades_today INTEGER DEFAULT 0,
    win_rate_30d DECIMAL(5,2),
    
    -- Risk metrics
    volatility_30d DECIMAL(8,6),
    sharpe_ratio_30d DECIMAL(8,4),
    current_drawdown DECIMAL(8,6),
    
    -- Position metrics
    num_positions INTEGER,
    gross_exposure DECIMAL(18,2),
    net_exposure DECIMAL(18,2),
    
    PRIMARY KEY (time, strategy_id)
);

SELECT create_hypertable('strategy_performance', 'time', chunk_time_interval => INTERVAL '1 month');

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================

-- System events and logs
CREATE TABLE system_events (
    id SERIAL PRIMARY KEY,
    time TIMESTAMPTZ DEFAULT NOW(),
    
    -- Event classification
    event_type TEXT NOT NULL,
    module TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    
    -- Event details
    message TEXT NOT NULL,
    correlation_id UUID,
    
    -- Context
    strategy_name TEXT,
    symbol TEXT,
    order_id UUID,
    
    -- Structured data
    metadata JSONB,
    stack_trace TEXT,
    
    -- Performance context
    cpu_percent DECIMAL(5,2),
    memory_mb INTEGER,
    
    -- Retention policy
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX idx_system_events_time ON system_events (time DESC);
CREATE INDEX idx_system_events_severity ON system_events (severity, time DESC);
CREATE INDEX idx_system_events_module ON system_events (module, time DESC);
CREATE INDEX idx_system_events_correlation ON system_events (correlation_id) WHERE correlation_id IS NOT NULL;

-- System health metrics
CREATE TABLE system_health (
    time TIMESTAMPTZ NOT NULL PRIMARY KEY,
    
    -- System resources
    cpu_percent DECIMAL(5,2),
    memory_used_mb INTEGER,
    memory_available_mb INTEGER,
    disk_used_gb DECIMAL(8,2),
    disk_available_gb DECIMAL(8,2),
    
    -- Network stats
    network_latency_ms DECIMAL(8,2),
    api_calls_per_minute INTEGER,
    api_errors_per_minute INTEGER,
    
    -- Trading system stats
    active_strategies INTEGER,
    active_positions INTEGER,
    orders_per_minute INTEGER,
    
    -- Event processing
    events_processed_per_sec DECIMAL(8,2),
    event_queue_size INTEGER,
    
    -- Database stats
    db_connections INTEGER,
    db_query_time_avg_ms DECIMAL(8,2)
);

SELECT create_hypertable('system_health', 'time', chunk_time_interval => INTERVAL '1 day');

-- ============================================================================
-- BACKTESTING TABLES
-- ============================================================================

-- Backtest runs
CREATE TABLE backtest_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Configuration
    strategy_name TEXT NOT NULL,
    strategy_parameters JSONB NOT NULL,
    symbols TEXT[] NOT NULL,
    
    -- Time period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Execution context
    initial_capital DECIMAL(18,2) NOT NULL,
    commission_rate DECIMAL(6,5) DEFAULT 0.001,
    slippage_rate DECIMAL(6,5) DEFAULT 0.0005,
    
    -- Results summary
    final_value DECIMAL(18,2),
    total_return DECIMAL(8,6),
    annualized_return DECIMAL(8,6),
    volatility DECIMAL(8,6),
    sharpe_ratio DECIMAL(8,4),
    sortino_ratio DECIMAL(8,4),
    max_drawdown DECIMAL(8,6),
    
    -- Trade statistics
    total_trades INTEGER,
    win_rate DECIMAL(5,2),
    profit_factor DECIMAL(8,4),
    
    -- Execution metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    execution_time_seconds DECIMAL(8,2),
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_backtest_runs_strategy ON backtest_runs (strategy_name, created_at DESC);
CREATE INDEX idx_backtest_runs_performance ON backtest_runs (sharpe_ratio DESC, total_return DESC);

-- Backtest trade history
CREATE TABLE backtest_trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES backtest_runs(run_id) ON DELETE CASCADE,
    
    -- Trade details
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity DECIMAL(18,8) NOT NULL,
    price DECIMAL(12,4) NOT NULL,
    
    -- Timing
    timestamp TIMESTAMPTZ NOT NULL,
    
    -- P&L
    commission DECIMAL(12,4),
    pnl DECIMAL(18,2), -- For closing trades
    
    -- Strategy context
    signal_confidence DECIMAL(3,2),
    strategy_metadata JSONB
);

CREATE INDEX idx_backtest_trades_run ON backtest_trades (run_id, timestamp);

-- ============================================================================
-- REFERENCE TABLES
-- ============================================================================

-- Symbol master data
CREATE TABLE symbols (
    symbol TEXT PRIMARY KEY,
    
    -- Basic info
    name TEXT,
    exchange TEXT,
    currency TEXT DEFAULT 'USD',
    asset_type TEXT CHECK (asset_type IN ('stock', 'etf', 'crypto', 'forex', 'option', 'future')),
    
    -- Classification
    sector TEXT,
    industry TEXT,
    market_cap_category TEXT CHECK (market_cap_category IN ('large', 'mid', 'small', 'micro')),
    
    -- Trading info
    is_tradeable BOOLEAN DEFAULT true,
    min_tick_size DECIMAL(8,6),
    lot_size INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- External IDs
    isin TEXT,
    cusip TEXT,
    bloomberg_id TEXT
);

CREATE INDEX idx_symbols_exchange ON symbols (exchange, asset_type);
CREATE INDEX idx_symbols_sector ON symbols (sector, industry);

-- ============================================================================
-- DATA RETENTION POLICIES
-- ============================================================================

-- Retention policy for market_data (keep 2 years)
SELECT add_retention_policy('market_data', INTERVAL '2 years');

-- Retention policy for system_events (keep 90 days)  
SELECT add_retention_policy('system_events', INTERVAL '90 days');

-- Retention policy for system_health (keep 1 year)
SELECT add_retention_policy('system_health', INTERVAL '1 year');

-- Retention policy for position_history (keep 5 years)
SELECT add_retention_policy('position_history', INTERVAL '5 years');

-- ============================================================================
-- CONTINUOUS AGGREGATES FOR PERFORMANCE
-- ============================================================================

-- Hourly market data aggregates
CREATE MATERIALIZED VIEW market_data_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS time_bucket,
    symbol,
    FIRST(open, time) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, time) AS close,
    SUM(volume) AS volume,
    AVG(bid) AS avg_bid,
    AVG(ask) AS avg_ask
FROM market_data
GROUP BY time_bucket, symbol;

-- Daily portfolio performance aggregates  
CREATE MATERIALIZED VIEW portfolio_daily_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS date,
    LAST(total_value, time) AS eod_value,
    MAX(total_value) - MIN(total_value) AS intraday_range,
    LAST(daily_return, time) AS daily_return,
    AVG(num_positions) AS avg_positions
FROM portfolio_snapshots
GROUP BY time_bucket('1 day', time);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update position after order fill
CREATE OR REPLACE FUNCTION update_position_on_fill()
RETURNS TRIGGER AS $$
DECLARE
    pos_record positions%ROWTYPE;
    new_quantity DECIMAL(18,8);
    new_avg_cost DECIMAL(12,4);
BEGIN
    -- Get current position
    SELECT * INTO pos_record FROM positions WHERE symbol = NEW.symbol;
    
    IF NOT FOUND THEN
        -- Create new position
        INSERT INTO positions (
            symbol, quantity, average_cost, current_price, 
            market_value, unrealized_pnl, first_acquired
        ) VALUES (
            NEW.symbol,
            CASE WHEN NEW.side = 'buy' THEN NEW.filled_quantity ELSE -NEW.filled_quantity END,
            NEW.average_fill_price,
            NEW.average_fill_price,
            NEW.filled_quantity * NEW.average_fill_price,
            0,
            NOW()
        );
    ELSE
        -- Update existing position
        new_quantity := pos_record.quantity + 
            CASE WHEN NEW.side = 'buy' THEN NEW.filled_quantity ELSE -NEW.filled_quantity END;
            
        -- Calculate new average cost (for same-side additions)
        IF (pos_record.quantity > 0 AND NEW.side = 'buy') OR 
           (pos_record.quantity < 0 AND NEW.side = 'sell') THEN
            new_avg_cost := (pos_record.quantity * pos_record.average_cost + 
                           NEW.filled_quantity * NEW.average_fill_price) / new_quantity;
        ELSE
            new_avg_cost := pos_record.average_cost;
        END IF;
        
        IF ABS(new_quantity) < 0.00000001 THEN
            -- Close position
            DELETE FROM positions WHERE symbol = NEW.symbol;
        ELSE
            -- Update position
            UPDATE positions SET
                quantity = new_quantity,
                average_cost = new_avg_cost,
                last_updated = NOW()
            WHERE symbol = NEW.symbol;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update positions when orders are filled
CREATE TRIGGER trigger_update_position_on_fill
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (NEW.status = 'filled' AND OLD.status != 'filled')
    EXECUTE FUNCTION update_position_on_fill();

-- Function to calculate portfolio metrics
CREATE OR REPLACE FUNCTION calculate_portfolio_metrics(as_of_time TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE(
    total_value DECIMAL(18,2),
    cash DECIMAL(18,2),
    positions_value DECIMAL(18,2),
    unrealized_pnl DECIMAL(18,2),
    num_positions INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(p.market_value), 0) + 50000 AS total_value, -- TODO: actual cash tracking
        50000::DECIMAL(18,2) AS cash, -- TODO: actual cash tracking
        COALESCE(SUM(p.market_value), 0) AS positions_value,
        COALESCE(SUM(p.unrealized_pnl), 0) AS unrealized_pnl,
        COUNT(*)::INTEGER AS num_positions
    FROM positions p;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Database Connection Management

```python
# src/database/connection_manager.py
import asyncio
import asyncpg
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

class DatabaseManager:
    """Async database connection manager for TimescaleDB."""
    
    def __init__(self, connection_string: str, pool_size: int = 10):
        self.connection_string = connection_string
        self.pool_size = pool_size
        self.pool: Optional[asyncpg.Pool] = None
        
    async def initialize(self) -> None:
        """Initialize database connection pool."""
        self.pool = await asyncpg.create_pool(
            self.connection_string,
            min_size=2,
            max_size=self.pool_size,
            command_timeout=30,
            server_settings={
                'application_name': 'pi5_trading_system',
                'timezone': 'UTC'
            }
        )
        logger.info(f"Database pool initialized with {self.pool_size} connections")
        
    async def close(self) -> None:
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            
    @asynccontextmanager
    async def acquire_connection(self):
        """Get database connection from pool."""
        async with self.pool.acquire() as conn:
            yield conn
            
    async def execute_query(self, query: str, *args) -> None:
        """Execute a query without returning results."""
        async with self.acquire_connection() as conn:
            await conn.execute(query, *args)
            
    async def fetch_one(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Fetch single row."""
        async with self.acquire_connection() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
            
    async def fetch_all(self, query: str, *args) -> List[Dict[str, Any]]:
        """Fetch all rows."""
        async with self.acquire_connection() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]
```

---

## 3. Event System Architecture

### 3.1 Event Message Specifications

```python
# src/events/event_types.py

# ============================================================================
# MARKET DATA EVENTS
# ============================================================================

@dataclass
class MarketDataEvent(BaseEvent):
    """Real-time market data update."""
    symbol: str
    timestamp_exchange: datetime
    bid: Optional[float] = None
    ask: Optional[float] = None
    last_price: Optional[float] = None
    volume: Optional[int] = None
    bid_size: Optional[int] = None
    ask_size: Optional[int] = None
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.symbol,
            'timestamp_exchange': self.timestamp_exchange.isoformat(),
            'bid': self.bid,
            'ask': self.ask,
            'last_price': self.last_price,
            'volume': self.volume,
            'bid_size': self.bid_size,
            'ask_size': self.ask_size
        }

@dataclass  
class HistoricalDataLoadedEvent(BaseEvent):
    """Historical data loaded for backtesting."""
    symbol: str
    start_date: datetime
    end_date: datetime
    records_loaded: int
    data_provider: str
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.symbol,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(), 
            'records_loaded': self.records_loaded,
            'data_provider': self.data_provider
        }

# ============================================================================
# STRATEGY EVENTS
# ============================================================================

@dataclass
class StrategySignalEvent(BaseEvent):
    """Trading signal generated by strategy."""
    signal: Signal
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.signal.symbol,
            'signal_type': self.signal.signal_type.value,
            'confidence': self.signal.confidence,
            'price': self.signal.price,
            'strategy_name': self.signal.strategy_name,
            'metadata': self.signal.metadata
        }

@dataclass
class StrategyStartedEvent(BaseEvent):
    """Strategy started successfully."""
    strategy_name: str
    parameters: Dict[str, Any]
    symbols: List[str]
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'strategy_name': self.strategy_name,
            'parameters': self.parameters,
            'symbols': self.symbols
        }

@dataclass
class StrategyErrorEvent(BaseEvent):
    """Strategy encountered an error."""
    strategy_name: str
    error_type: str
    error_message: str
    symbol: Optional[str] = None
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'strategy_name': self.strategy_name,
            'error_type': self.error_type,
            'error_message': self.error_message,
            'symbol': self.symbol
        }

# ============================================================================
# RISK MANAGEMENT EVENTS
# ============================================================================

@dataclass
class RiskViolationEvent(BaseEvent):
    """Risk limit violation detected."""
    violation_type: str
    current_value: float
    limit_value: float
    symbol: Optional[str] = None
    strategy_name: Optional[str] = None
    severity: str = "WARNING"  # WARNING, ERROR, CRITICAL
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'violation_type': self.violation_type,
            'current_value': self.current_value,
            'limit_value': self.limit_value,
            'symbol': self.symbol,
            'strategy_name': self.strategy_name,
            'severity': self.severity
        }

@dataclass
class PositionSizeCalculatedEvent(BaseEvent):
    """Position size calculated by risk manager."""
    symbol: str
    signal: Signal
    calculated_size: float
    max_allowed_size: float
    risk_adjusted: bool
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.symbol,
            'signal_type': self.signal.signal_type.value,
            'calculated_size': self.calculated_size,
            'max_allowed_size': self.max_allowed_size,
            'risk_adjusted': self.risk_adjusted
        }

# ============================================================================
# ORDER MANAGEMENT EVENTS  
# ============================================================================

@dataclass
class OrderRequestEvent(BaseEvent):
    """Order request from risk manager."""
    signal: Signal
    quantity: float
    order_type: OrderType = OrderType.MARKET
    limit_price: Optional[float] = None
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.signal.symbol,
            'signal_type': self.signal.signal_type.value,
            'quantity': self.quantity,
            'order_type': self.order_type.value,
            'limit_price': self.limit_price,
            'strategy_name': self.signal.strategy_name
        }

@dataclass
class OrderSubmittedEvent(BaseEvent):
    """Order submitted to broker."""
    order: Order
    broker_order_id: str
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'order_id': self.order.order_id,
            'symbol': self.order.symbol,
            'side': self.order.side,
            'quantity': self.order.quantity,
            'broker_order_id': self.broker_order_id
        }

@dataclass
class OrderFilledEvent(BaseEvent):
    """Order execution completed."""
    order: Order
    fill_price: float
    fill_quantity: float
    commission: float = 0.0
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'order_id': self.order.order_id,
            'symbol': self.order.symbol,
            'side': self.order.side,
            'fill_price': self.fill_price,
            'fill_quantity': self.fill_quantity,
            'commission': self.commission
        }

# ============================================================================
# PORTFOLIO EVENTS
# ============================================================================

@dataclass
class PositionUpdatedEvent(BaseEvent):
    """Position updated after trade."""
    symbol: str
    old_quantity: float
    new_quantity: float
    average_cost: float
    market_value: float
    unrealized_pnl: float
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'symbol': self.symbol,
            'old_quantity': self.old_quantity,
            'new_quantity': self.new_quantity,
            'average_cost': self.average_cost,
            'market_value': self.market_value,
            'unrealized_pnl': self.unrealized_pnl
        }

@dataclass
class PortfolioPerformanceEvent(BaseEvent):
    """Portfolio performance update."""
    total_value: float
    cash: float
    positions_value: float
    daily_return: float
    total_return: float
    unrealized_pnl: float
    realized_pnl: float
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'total_value': self.total_value,
            'cash': self.cash,
            'positions_value': self.positions_value,
            'daily_return': self.daily_return,
            'total_return': self.total_return,
            'unrealized_pnl': self.unrealized_pnl,
            'realized_pnl': self.realized_pnl
        }

# ============================================================================
# SYSTEM EVENTS
# ============================================================================

@dataclass
class SystemHealthEvent(BaseEvent):
    """System health metrics."""
    cpu_percent: float
    memory_used_mb: int
    memory_available_mb: int
    disk_usage_gb: float
    active_strategies: int
    active_positions: int
    event_queue_size: int
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'cpu_percent': self.cpu_percent,
            'memory_used_mb': self.memory_used_mb,
            'memory_available_mb': self.memory_available_mb,
            'disk_usage_gb': self.disk_usage_gb,
            'active_strategies': self.active_strategies,
            'active_positions': self.active_positions,
            'event_queue_size': self.event_queue_size
        }

@dataclass
class SystemErrorEvent(BaseEvent):
    """System error occurred."""
    error_type: str
    error_message: str
    module_name: str
    stack_trace: Optional[str] = None
    handler_name: Optional[str] = None
    original_event_id: Optional[str] = None
    
    def _event_data(self) -> Dict[str, Any]:
        return {
            'error_type': self.error_type,
            'error_message': self.error_message,
            'module_name': self.module_name,
            'stack_trace': self.stack_trace,
            'handler_name': self.handler_name,
            'original_event_id': self.original_event_id
        }
```

### 3.2 Event Flow Routing Rules

```python
# src/events/event_router.py

class EventRouter:
    """Routes events to appropriate handlers based on rules."""
    
    def __init__(self):
        self.routing_rules: List[RoutingRule] = []
        self.event_stats: Dict[str, int] = defaultdict(int)
        
    def add_routing_rule(self, rule: RoutingRule) -> None:
        """Add routing rule."""
        self.routing_rules.append(rule)
        self.routing_rules.sort(key=lambda r: r.priority)
        
    async def route_event(self, event: BaseEvent) -> List[str]:
        """Determine which handlers should receive this event."""
        matching_handlers = []
        
        for rule in self.routing_rules:
            if rule.matches(event):
                matching_handlers.extend(rule.handlers)
                
        self.event_stats[event.event_type] += 1
        return list(set(matching_handlers))  # Remove duplicates

@dataclass
class RoutingRule:
    """Event routing rule definition."""
    event_types: List[str]
    handlers: List[str] 
    conditions: Dict[str, Any] = None
    priority: int = 100
    
    def matches(self, event: BaseEvent) -> bool:
        """Check if event matches this rule."""
        if event.event_type not in self.event_types:
            return False
            
        if self.conditions:
            return self._evaluate_conditions(event)
            
        return True
        
    def _evaluate_conditions(self, event: BaseEvent) -> bool:
        """Evaluate conditional routing."""
        # Simple condition evaluation - can be extended
        for key, expected_value in self.conditions.items():
            if hasattr(event, key):
                actual_value = getattr(event, key)
                if actual_value != expected_value:
                    return False
        return True

# ============================================================================
# DEFAULT ROUTING CONFIGURATION
# ============================================================================

DEFAULT_ROUTING_RULES = [
    # Market data routing
    RoutingRule(
        event_types=['MarketDataEvent'],
        handlers=['strategy_engine', 'market_data_recorder'],
        priority=1
    ),
    
    # Strategy signal routing  
    RoutingRule(
        event_types=['StrategySignalEvent'],
        handlers=['risk_manager', 'signal_logger'],
        priority=2
    ),
    
    # Risk management routing
    RoutingRule(
        event_types=['RiskViolationEvent'],
        handlers=['alert_manager', 'portfolio_manager'],
        conditions={'severity': 'CRITICAL'},
        priority=1
    ),
    
    # Order flow routing
    RoutingRule(
        event_types=['OrderRequestEvent'],
        handlers=['order_manager'],
        priority=2
    ),
    
    RoutingRule(
        event_types=['OrderFilledEvent'],
        handlers=['portfolio_manager', 'strategy_engine'],
        priority=1
    ),
    
    # Portfolio updates
    RoutingRule(
        event_types=['PositionUpdatedEvent', 'PortfolioPerformanceEvent'],
        handlers=['performance_tracker', 'web_dashboard'],
        priority=3
    ),
    
    # System monitoring
    RoutingRule(
        event_types=['SystemHealthEvent'],
        handlers=['health_monitor', 'web_dashboard'],
        priority=4
    ),
    
    # Error handling
    RoutingRule(
        event_types=['SystemErrorEvent', 'StrategyErrorEvent'],
        handlers=['error_logger', 'alert_manager'],
        priority=1
    )
]
```

---

## 4. API Architecture & Specifications

### 4.1 FastAPI Application Structure

```python
# src/api/main.py
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware  
from contextlib import asynccontextmanager
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class StrategyConfigModel(BaseModel):
    """Strategy configuration model."""
    name: str = Field(..., description="Strategy name")
    class_name: str = Field(..., description="Python class name")
    parameters: Dict[str, Any] = Field(..., description="Strategy parameters")
    symbols: List[str] = Field(..., description="Trading symbols")
    max_allocation: float = Field(0.25, description="Maximum portfolio allocation")
    is_active: bool = Field(False, description="Whether strategy is active")

class StrategyPerformanceModel(BaseModel):
    """Strategy performance response."""
    strategy_name: str
    total_return: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    total_trades: int
    last_updated: datetime

class PositionModel(BaseModel):
    """Portfolio position model."""
    symbol: str
    quantity: float
    average_cost: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    day_change: float
    day_change_percent: float

class OrderModel(BaseModel):
    """Order model."""
    order_id: str
    symbol: str
    side: str
    quantity: float
    order_type: str
    status: str
    created_at: datetime
    filled_quantity: float = 0.0
    average_fill_price: Optional[float] = None

class PortfolioSummaryModel(BaseModel):
    """Portfolio summary model."""
    total_value: float
    cash: float
    positions_value: float
    daily_return: float
    total_return: float
    unrealized_pnl: float
    num_positions: int

class BacktestConfigModel(BaseModel):
    """Backtest configuration."""
    strategy_name: str
    parameters: Dict[str, Any]
    symbols: List[str]
    start_date: date
    end_date: date
    initial_capital: float = 100000.0
    commission_rate: float = 0.001
    slippage_rate: float = 0.0005

class BacktestResultModel(BaseModel):
    """Backtest results."""
    run_id: str
    status: str
    total_return: float
    annualized_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    total_trades: int
    win_rate: float
    created_at: datetime
    completed_at: Optional[datetime]

class SystemHealthModel(BaseModel):
    """System health status."""
    cpu_percent: float
    memory_used_mb: int
    memory_available_mb: int
    disk_usage_gb: float
    active_strategies: int
    active_positions: int
    event_queue_size: int
    uptime_seconds: int
    last_updated: datetime

# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Pi5 Trading System API")
    
    # Initialize core systems
    await trading_engine.initialize()
    await db_manager.initialize()
    await event_bus.start()
    
    logger.info("API startup completed")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Pi5 Trading System API")
    await event_bus.stop()
    await db_manager.close()
    await trading_engine.shutdown()

app = FastAPI(
    title="Pi5 Trading System API",
    description="Comprehensive algorithmic trading system for Raspberry Pi 5",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ============================================================================
# STRATEGY MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/strategies", response_model=List[StrategyConfigModel])
async def list_strategies():
    """List all configured strategies."""
    try:
        strategies = await strategy_manager.get_all_strategies()
        return [StrategyConfigModel(**strategy) for strategy in strategies]
    except Exception as e:
        logger.error(f"Error listing strategies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/strategies", response_model=StrategyConfigModel)
async def create_strategy(strategy: StrategyConfigModel):
    """Create a new strategy."""
    try:
        created_strategy = await strategy_manager.create_strategy(strategy.dict())
        return StrategyConfigModel(**created_strategy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/strategies/{strategy_name}", response_model=StrategyConfigModel)
async def get_strategy(strategy_name: str):
    """Get strategy configuration."""
    try:
        strategy = await strategy_manager.get_strategy(strategy_name)
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        return StrategyConfigModel(**strategy)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting strategy {strategy_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/strategies/{strategy_name}", response_model=StrategyConfigModel)
async def update_strategy(strategy_name: str, strategy: StrategyConfigModel):
    """Update strategy configuration."""
    try:
        updated_strategy = await strategy_manager.update_strategy(
            strategy_name, strategy.dict()
        )
        return StrategyConfigModel(**updated_strategy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating strategy {strategy_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/strategies/{strategy_name}/start")
async def start_strategy(strategy_name: str, background_tasks: BackgroundTasks):
    """Start a strategy."""
    try:
        background_tasks.add_task(strategy_manager.start_strategy, strategy_name)
        return {"message": f"Starting strategy {strategy_name}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting strategy {strategy_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/strategies/{strategy_name}/stop")
async def stop_strategy(strategy_name: str, background_tasks: BackgroundTasks):
    """Stop a strategy."""
    try:
        background_tasks.add_task(strategy_manager.stop_strategy, strategy_name)
        return {"message": f"Stopping strategy {strategy_name}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error stopping strategy {strategy_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/strategies/{strategy_name}/performance", response_model=StrategyPerformanceModel)
async def get_strategy_performance(strategy_name: str):
    """Get strategy performance metrics."""
    try:
        performance = await performance_tracker.get_strategy_performance(strategy_name)
        if not performance:
            raise HTTPException(status_code=404, detail="Strategy performance not found")
        return StrategyPerformanceModel(**performance)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting strategy performance {strategy_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PORTFOLIO MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/portfolio/summary", response_model=PortfolioSummaryModel)
async def get_portfolio_summary():
    """Get portfolio summary."""
    try:
        summary = await portfolio_manager.get_portfolio_summary()
        return PortfolioSummaryModel(**summary)
    except Exception as e:
        logger.error(f"Error getting portfolio summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/positions", response_model=List[PositionModel])
async def get_positions():
    """Get current positions."""
    try:
        positions = await portfolio_manager.get_all_positions()
        return [PositionModel(**pos) for pos in positions]
    except Exception as e:
        logger.error(f"Error getting positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/orders", response_model=List[OrderModel])
async def get_orders(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get order history."""
    try:
        orders = await order_manager.get_orders(
            status=status, limit=limit, offset=offset
        )
        return [OrderModel(**order) for order in orders]
    except Exception as e:
        logger.error(f"Error getting orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/performance")
async def get_portfolio_performance(
    period: str = "1M",  # 1D, 1W, 1M, 3M, 6M, 1Y
    granularity: str = "1D"  # 1H, 1D, 1W
):
    """Get portfolio performance history."""
    try:
        performance = await performance_tracker.get_portfolio_performance(
            period=period, granularity=granularity
        )
        return performance
    except Exception as e:
        logger.error(f"Error getting portfolio performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# BACKTESTING ENDPOINTS
# ============================================================================

@app.post("/api/backtest/run", response_model=Dict[str, str])
async def run_backtest(config: BacktestConfigModel, background_tasks: BackgroundTasks):
    """Run a backtest."""
    try:
        run_id = await backtest_engine.create_backtest_run(config.dict())
        background_tasks.add_task(backtest_engine.execute_backtest, run_id)
        return {"run_id": run_id, "status": "started"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error running backtest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backtest/runs", response_model=List[BacktestResultModel])
async def list_backtest_runs(
    strategy_name: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List backtest runs."""
    try:
        runs = await backtest_engine.get_backtest_runs(
            strategy_name=strategy_name, limit=limit, offset=offset
        )
        return [BacktestResultModel(**run) for run in runs]
    except Exception as e:
        logger.error(f"Error listing backtest runs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backtest/runs/{run_id}", response_model=BacktestResultModel)
async def get_backtest_run(run_id: str):
    """Get backtest run details."""
    try:
        run = await backtest_engine.get_backtest_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Backtest run not found")
        return BacktestResultModel(**run)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting backtest run {run_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backtest/runs/{run_id}/results")
async def get_backtest_results(run_id: str):
    """Get detailed backtest results."""
    try:
        results = await backtest_engine.get_detailed_results(run_id)
        if not results:
            raise HTTPException(status_code=404, detail="Backtest results not found")
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting backtest results {run_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/backtest/runs/{run_id}")
async def cancel_backtest(run_id: str):
    """Cancel a running backtest."""
    try:
        success = await backtest_engine.cancel_backtest(run_id)
        if not success:
            raise HTTPException(status_code=404, detail="Backtest not found or not cancellable")
        return {"message": "Backtest cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling backtest {run_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MARKET DATA ENDPOINTS
# ============================================================================

@app.get("/api/market-data/{symbol}")
async def get_market_data(
    symbol: str,
    period: str = "1D",
    interval: str = "1m"
):
    """Get market data for symbol."""
    try:
        data = await market_data_manager.get_market_data(
            symbol=symbol, period=period, interval=interval
        )
        return data
    except Exception as e:
        logger.error(f"Error getting market data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market-data/{symbol}/quote")
async def get_quote(symbol: str):
    """Get real-time quote for symbol."""
    try:
        quote = await market_data_manager.get_real_time_quote(symbol)
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        return quote
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting quote for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# SYSTEM MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/system/health", response_model=SystemHealthModel)
async def get_system_health():
    """Get system health status."""
    try:
        health = await system_monitor.get_system_health()
        return SystemHealthModel(**health)
    except Exception as e:
        logger.error(f"Error getting system health: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/status")
async def get_system_status():
    """Get overall system status."""
    try:
        status = {
            "trading_engine": await trading_engine.get_status(),
            "event_bus": event_bus.get_stats(),
            "database": await db_manager.get_connection_status(),
            "strategies": await strategy_manager.get_strategy_status(),
            "uptime": await system_monitor.get_uptime()
        }
        return status
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system/shutdown")
async def shutdown_system(background_tasks: BackgroundTasks):
    """Gracefully shutdown the system."""
    try:
        background_tasks.add_task(trading_engine.graceful_shutdown)
        return {"message": "System shutdown initiated"}
    except Exception as e:
        logger.error(f"Error initiating shutdown: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/logs")
async def get_system_logs(
    level: str = "INFO",
    limit: int = 100,
    offset: int = 0
):
    """Get system logs."""
    try:
        logs = await log_manager.get_logs(
            level=level, limit=limit, offset=offset
        )
        return logs
    except Exception as e:
        logger.error(f"Error getting system logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CONFIGURATION ENDPOINTS
# ============================================================================

@app.get("/api/config")
async def get_configuration():
    """Get current system configuration."""
    try:
        config = await config_manager.get_current_config()
        return config
    except Exception as e:
        logger.error(f"Error getting configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/config")
async def update_configuration(config: Dict[str, Any]):
    """Update system configuration."""
    try:
        updated_config = await config_manager.update_config(config)
        return updated_config
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### 4.2 WebSocket Implementation

```python
# src/api/websocket.py
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio
from datetime import datetime

class WebSocketManager:
    """Manage WebSocket connections and real-time updates."""
    
    def __init__(self):
        # Connection management
        self.active_connections: Dict[str, Set[WebSocket]] = {
            'market_data': set(),
            'portfolio_updates': set(),
            'system_events': set(),
            'strategy_signals': set()
        }
        
        # Message queues for each channel
        self.message_queues: Dict[str, asyncio.Queue] = {}
        self.broadcasting_tasks: Dict[str, asyncio.Task] = {}
        
    async def start(self):
        """Start WebSocket message broadcasting."""
        for channel in self.active_connections.keys():
            self.message_queues[channel] = asyncio.Queue()
            self.broadcasting_tasks[channel] = asyncio.create_task(
                self._broadcast_messages(channel)
            )
            
    async def stop(self):
        """Stop WebSocket broadcasting."""
        for task in self.broadcasting_tasks.values():
            task.cancel()
            
    async def connect(self, websocket: WebSocket, channel: str):
        """Accept WebSocket connection."""
        await websocket.accept()
        self.active_connections[channel].add(websocket)
        logger.info(f"WebSocket connected to {channel}")
        
    def disconnect(self, websocket: WebSocket, channel: str):
        """Remove WebSocket connection."""
        self.active_connections[channel].discard(websocket)
        logger.info(f"WebSocket disconnected from {channel}")
        
    async def send_to_channel(self, channel: str, message: Dict):
        """Queue message for broadcasting to channel."""
        if channel in self.message_queues:
            try:
                await self.message_queues[channel].put(message)
            except asyncio.QueueFull:
                logger.warning(f"Message queue full for channel {channel}")
                
    async def _broadcast_messages(self, channel: str):
        """Broadcast messages to all connections in channel."""
        while True:
            try:
                message = await self.message_queues[channel].get()
                message['timestamp'] = datetime.utcnow().isoformat()
                
                disconnected = set()
                for websocket in self.active_connections[channel].copy():
                    try:
                        await websocket.send_text(json.dumps(message))
                    except WebSocketDisconnect:
                        disconnected.add(websocket)
                    except Exception as e:
                        logger.error(f"WebSocket send error: {e}")
                        disconnected.add(websocket)
                        
                # Clean up disconnected websockets
                for ws in disconnected:
                    self.active_connections[channel].discard(ws)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Broadcast error in {channel}: {e}")

# WebSocket endpoints
websocket_manager = WebSocketManager()

@app.websocket("/ws/market-data")
async def websocket_market_data(websocket: WebSocket):
    """Real-time market data updates."""
    await websocket_manager.connect(websocket, 'market_data')
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, 'market_data')

@app.websocket("/ws/portfolio-updates")
async def websocket_portfolio_updates(websocket: WebSocket):
    """Real-time portfolio updates."""
    await websocket_manager.connect(websocket, 'portfolio_updates')
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, 'portfolio_updates')

@app.websocket("/ws/system-events")
async def websocket_system_events(websocket: WebSocket):
    """Real-time system events."""
    await websocket_manager.connect(websocket, 'system_events')
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, 'system_events')
```

---

## 5. Error Handling & Recovery

### 5.1 Exception Hierarchy

```python
# src/core/exceptions.py

class TradingSystemError(Exception):
    """Base exception for all trading system errors."""
    
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
    """Data provider connection/API error."""
    pass

class DataQualityError(MarketDataError):
    """Data quality validation failed."""
    pass

class DataNotFoundError(MarketDataError):
    """Requested data not available."""
    pass

# ============================================================================
# STRATEGY EXCEPTIONS
# ============================================================================

class StrategyError(TradingSystemError):
    """Base exception for strategy errors."""
    pass

class StrategyInitializationError(StrategyError):
    """Strategy failed to initialize."""
    pass

class StrategyExecutionError(StrategyError):
    """Strategy execution failed."""
    pass

class StrategyConfigurationError(StrategyError):
    """Invalid strategy configuration."""
    pass

# ============================================================================
# RISK MANAGEMENT EXCEPTIONS
# ============================================================================

class RiskManagementError(TradingSystemError):
    """Base exception for risk management errors."""
    pass

class RiskLimitViolationError(RiskManagementError):
    """Risk limits exceeded."""
    
    def __init__(self, violation_type: str, current_value: float, limit_value: float, **kwargs):
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
    """Insufficient funds for trade."""
    pass

# ============================================================================
# ORDER MANAGEMENT EXCEPTIONS
# ============================================================================

class OrderError(TradingSystemError):
    """Base exception for order-related errors."""
    pass

class OrderValidationError(OrderError):
    """Order failed validation."""
    pass

class OrderExecutionError(OrderError):
    """Order execution failed."""
    pass

class BrokerError(OrderError):
    """Broker API error."""
    pass

class OrderNotFoundError(OrderError):
    """Order not found."""
    pass

# ============================================================================
# PORTFOLIO EXCEPTIONS
# ============================================================================

class PortfolioError(TradingSystemError):
    """Base exception for portfolio errors."""
    pass

class PositionError(PortfolioError):
    """Position-related error."""
    pass

class PerformanceCalculationError(PortfolioError):
    """Performance calculation failed."""
    pass

# ============================================================================
# SYSTEM EXCEPTIONS
# ============================================================================

class SystemError(TradingSystemError):
    """Base exception for system errors."""
    pass

class ConfigurationError(SystemError):
    """Configuration error."""
    pass

class DatabaseError(SystemError):
    """Database operation failed."""
    pass

class EventProcessingError(SystemError):
    """Event processing failed."""
    pass
```

### 5.2 Error Recovery Strategies

```python
# src/core/error_recovery.py

class ErrorRecoveryManager:
    """Manage error recovery strategies across the system."""
    
    def __init__(self):
        self.recovery_strategies: Dict[Type[Exception], Callable] = {}
        self.retry_configs: Dict[Type[Exception], RetryConfig] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.error_stats: Dict[str, ErrorStats] = defaultdict(ErrorStats)
        
    def register_recovery_strategy(
        self, 
        exception_type: Type[Exception], 
        strategy: Callable,
        retry_config: RetryConfig = None
    ):
        """Register error recovery strategy."""
        self.recovery_strategies[exception_type] = strategy
        if retry_config:
            self.retry_configs[exception_type] = retry_config
            
    def register_circuit_breaker(self, name: str, config: CircuitBreakerConfig):
        """Register circuit breaker for component."""
        self.circuit_breakers[name] = CircuitBreaker(name, config)
        
    async def handle_error(
        self, 
        error: Exception, 
        context: Dict[str, Any],
        component: str = None
    ) -> bool:
        """Handle error with appropriate recovery strategy."""
        error_type = type(error)
        
        # Update error statistics
        self.error_stats[error_type.__name__].increment()
        
        # Check circuit breaker
        if component and component in self.circuit_breakers:
            circuit_breaker = self.circuit_breakers[component]
            if circuit_breaker.is_open():
                logger.error(f"Circuit breaker open for {component}")
                return False
                
        # Find recovery strategy
        recovery_strategy = None
        for exc_type, strategy in self.recovery_strategies.items():
            if isinstance(error, exc_type):
                recovery_strategy = strategy
                break
                
        if not recovery_strategy:
            logger.error(f"No recovery strategy for {error_type.__name__}")
            return False
            
        # Execute recovery with retries
        retry_config = self.retry_configs.get(error_type, RetryConfig())
        
        for attempt in range(retry_config.max_attempts):
            try:
                await recovery_strategy(error, context)
                logger.info(f"Recovery successful after {attempt + 1} attempts")
                
                # Record success in circuit breaker
                if component:
                    self.circuit_breakers[component].record_success()
                    
                return True
                
            except Exception as recovery_error:
                logger.warning(
                    f"Recovery attempt {attempt + 1} failed: {recovery_error}"
                )
                
                if attempt < retry_config.max_attempts - 1:
                    await asyncio.sleep(retry_config.delay * (2 ** attempt))
                    
        # Recovery failed
        logger.error(f"Recovery failed for {error_type.__name__}")
        
        # Record failure in circuit breaker
        if component:
            self.circuit_breakers[component].record_failure()
            
        return False

@dataclass
class RetryConfig:
    """Retry configuration for error recovery."""
    max_attempts: int = 3
    delay: float = 1.0  # Base delay in seconds
    backoff_multiplier: float = 2.0
    max_delay: float = 60.0

@dataclass  
class CircuitBreakerConfig:
    """Circuit breaker configuration."""
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    half_open_max_calls: int = 3

class CircuitBreaker:
    """Circuit breaker implementation."""
    
    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.failure_count = 0
        self.last_failure_time = None
        self.half_open_calls = 0
        
    def is_open(self) -> bool:
        """Check if circuit breaker is open."""
        if self.state == "OPEN":
            if self._should_attempt_reset():
                self.state = "HALF_OPEN"
                self.half_open_calls = 0
                logger.info(f"Circuit breaker {self.name} entering HALF_OPEN state")
                return False
            return True
            
        return False
        
    def record_success(self):
        """Record successful operation."""
        self.failure_count = 0
        
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            logger.info(f"Circuit breaker {self.name} reset to CLOSED")
            
    def record_failure(self):
        """Record failed operation."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.state == "HALF_OPEN":
            self.state = "OPEN"
            logger.warning(f"Circuit breaker {self.name} opened from HALF_OPEN")
        elif self.failure_count >= self.config.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit breaker {self.name} opened due to failures")
            
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        if self.last_failure_time is None:
            return False
            
        return time.time() - self.last_failure_time > self.config.recovery_timeout

class ErrorStats:
    """Track error statistics."""
    
    def __init__(self):
        self.count = 0
        self.first_occurrence = None
        self.last_occurrence = None
        self.rate_limiter = RateLimiter(60, 10)  # 10 per minute
        
    def increment(self):
        """Increment error count."""
        now = datetime.utcnow()
        
        if self.first_occurrence is None:
            self.first_occurrence = now
            
        self.last_occurrence = now
        self.count += 1

# ============================================================================
# RECOVERY STRATEGY IMPLEMENTATIONS
# ============================================================================

async def recover_data_provider_error(error: DataProviderError, context: Dict):
    """Recover from data provider errors."""
    symbol = context.get('symbol')
    provider_name = context.get('provider')
    
    logger.info(f"Attempting to recover from {provider_name} error for {symbol}")
    
    # Switch to backup provider
    market_data_manager = context.get('market_data_manager')
    if market_data_manager:
        await market_data_manager.switch_to_backup_provider()
        
async def recover_strategy_execution_error(error: StrategyExecutionError, context: Dict):
    """Recover from strategy execution errors."""
    strategy_name = context.get('strategy_name')
    
    logger.info(f"Attempting to recover strategy {strategy_name}")
    
    # Restart strategy with last known good state
    strategy_manager = context.get('strategy_manager')
    if strategy_manager:
        await strategy_manager.restart_strategy(strategy_name)

async def recover_order_execution_error(error: OrderExecutionError, context: Dict):
    """Recover from order execution errors."""
    order_id = context.get('order_id')
    
    logger.info(f"Attempting to recover order {order_id}")
    
    # Check order status and retry if appropriate
    order_manager = context.get('order_manager')
    if order_manager:
        await order_manager.retry_order_execution(order_id)

async def recover_database_error(error: DatabaseError, context: Dict):
    """Recover from database errors."""
    logger.info("Attempting to recover from database error")
    
    # Reconnect to database
    db_manager = context.get('db_manager')
    if db_manager:
        await db_manager.reconnect()

# ============================================================================
# ERROR RECOVERY INITIALIZATION
# ============================================================================

def initialize_error_recovery() -> ErrorRecoveryManager:
    """Initialize error recovery system."""
    recovery_manager = ErrorRecoveryManager()
    
    # Register recovery strategies
    recovery_manager.register_recovery_strategy(
        DataProviderError,
        recover_data_provider_error,
        RetryConfig(max_attempts=3, delay=2.0)
    )
    
    recovery_manager.register_recovery_strategy(
        StrategyExecutionError,
        recover_strategy_execution_error,
        RetryConfig(max_attempts=2, delay=5.0)
    )
    
    recovery_manager.register_recovery_strategy(
        OrderExecutionError,
        recover_order_execution_error,
        RetryConfig(max_attempts=3, delay=1.0)
    )
    
    recovery_manager.register_recovery_strategy(
        DatabaseError,
        recover_database_error,
        RetryConfig(max_attempts=5, delay=1.0)
    )
    
    # Register circuit breakers
    recovery_manager.register_circuit_breaker(
        "market_data",
        CircuitBreakerConfig(failure_threshold=5, recovery_timeout=30.0)
    )
    
    recovery_manager.register_circuit_breaker(
        "order_execution",
        CircuitBreakerConfig(failure_threshold=3, recovery_timeout=60.0)
    )
    
    recovery_manager.register_circuit_breaker(
        "database",
        CircuitBreakerConfig(failure_threshold=10, recovery_timeout=30.0)
    )
    
    return recovery_manager
```

This continues the ultra-comprehensive technical architecture. I'm building out every aspect systematically. Should I continue with the remaining sections (Performance Optimization, Concurrency Model, Security Architecture, etc.) to complete the full technical specification?
