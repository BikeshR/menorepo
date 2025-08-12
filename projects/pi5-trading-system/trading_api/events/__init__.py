"""
Events module for Pi5 Trading System.

Implements event-driven architecture with async event processing,
routing, and pub/sub messaging throughout the system.

Components:
- event_types.py: All system event definitions and schemas
- event_router.py: Event routing rules and handlers  
- event_bus.py: Central event bus with async processing
"""

from events.event_bus import EventBus
from events.event_router import EventRouter
from events.event_types import (
    EVENT_TYPES,
    create_event,
    get_event_type_name,
    # Market Data Events
    MarketDataEvent,
    QuoteEvent,
    MarketStatusEvent,
    # Strategy Events
    SignalGeneratedEvent,
    StrategyStatusEvent,
    StrategyPerformanceEvent,
    # Order Events
    OrderCreatedEvent,
    OrderFilledEvent,
    OrderStatusEvent,
    # Portfolio Events
    PositionChangedEvent,
    PortfolioValueEvent,
    # Risk Events
    RiskViolationEvent,
    RiskMetricsEvent,
    # System Events
    SystemStartupEvent,
    SystemShutdownEvent,
    SystemErrorEvent,
    HealthCheckEvent,
)

__all__ = [
    "EventBus",
    "EventRouter",
    "EVENT_TYPES",
    "create_event",
    "get_event_type_name",
    # Event classes
    "MarketDataEvent",
    "QuoteEvent", 
    "MarketStatusEvent",
    "SignalGeneratedEvent",
    "StrategyStatusEvent",
    "StrategyPerformanceEvent",
    "OrderCreatedEvent",
    "OrderFilledEvent",
    "OrderStatusEvent",
    "PositionChangedEvent",
    "PortfolioValueEvent",
    "RiskViolationEvent",
    "RiskMetricsEvent",
    "SystemStartupEvent",
    "SystemShutdownEvent",
    "SystemErrorEvent",
    "HealthCheckEvent",
]