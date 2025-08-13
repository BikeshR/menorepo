"""
Broker Manager for Pi5 Trading System.

Advanced broker management with intelligent failover, load balancing,
and redundancy across multiple broker connections.

Features:
- Multi-broker configuration and management
- Intelligent broker selection based on health and performance
- Automatic failover with configurable strategies
- Load balancing across healthy brokers
- Broker health monitoring and recovery
- Order routing optimization
- Broker-specific error handling
- Performance metrics and analytics
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
import json

from core.interfaces import BrokerInterface, Order, OrderStatus
from core.exceptions import BrokerError, OrderValidationError
from events.event_bus import EventBus
from .paper_broker import PaperTradingBroker
from .interactive_brokers import InteractiveBrokersBroker
from .alpaca_broker import AlpacaBroker


logger = logging.getLogger(__name__)


class BrokerType(Enum):
    """Supported broker types."""
    PAPER = "paper"
    INTERACTIVE_BROKERS = "interactive_brokers"
    ALPACA = "alpaca"


class FailoverStrategy(Enum):
    """Broker failover strategies."""
    ROUND_ROBIN = "round_robin"
    HEALTH_BASED = "health_based"
    PERFORMANCE_BASED = "performance_based"
    PRIORITY_BASED = "priority_based"


@dataclass
class BrokerConfig:
    """Broker configuration."""
    broker_type: BrokerType
    priority: int = 100  # Lower = higher priority
    enabled: bool = True
    config: Dict[str, Any] = None
    max_orders_per_minute: int = 100
    max_order_value: float = 100000.0
    allowed_symbols: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.config is None:
            self.config = {}


@dataclass
class BrokerHealth:
    """Broker health status."""
    is_healthy: bool = True
    last_check: datetime = None
    error_count: int = 0
    success_count: int = 0
    avg_response_time: float = 0.0
    last_error: str = ""
    consecutive_failures: int = 0
    last_successful_order: datetime = None
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        total = self.success_count + self.error_count
        return (self.success_count / total * 100) if total > 0 else 100.0
    
    @property
    def is_critical(self) -> bool:
        """Check if broker is in critical state."""
        return (self.consecutive_failures >= 5 or 
                self.success_rate < 50.0 or
                not self.is_healthy)


class BrokerManager:
    """
    Advanced broker manager with failover and load balancing.
    
    Manages multiple broker connections with intelligent routing,
    automatic failover, and performance optimization.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        failover_strategy: FailoverStrategy = FailoverStrategy.HEALTH_BASED,
        health_check_interval: int = 30,
        max_failover_attempts: int = 3,
        order_timeout_seconds: int = 300,
        enable_load_balancing: bool = True,
    ):
        """
        Initialize broker manager.
        
        Args:
            event_bus: Event bus for system communication
            failover_strategy: Strategy for broker failover
            health_check_interval: Health check interval in seconds
            max_failover_attempts: Maximum failover attempts per order
            order_timeout_seconds: Order timeout in seconds
            enable_load_balancing: Enable load balancing across brokers
        """
        self.event_bus = event_bus
        self.failover_strategy = failover_strategy
        self.health_check_interval = health_check_interval
        self.max_failover_attempts = max_failover_attempts
        self.order_timeout_seconds = order_timeout_seconds
        self.enable_load_balancing = enable_load_balancing
        
        # Broker management
        self._brokers: Dict[str, BrokerInterface] = {}
        self._broker_configs: Dict[str, BrokerConfig] = {}
        self._broker_health: Dict[str, BrokerHealth] = {}
        self._broker_order_counts: Dict[str, int] = {}
        self._broker_order_times: Dict[str, List[datetime]] = {}
        
        # Order tracking
        self._order_broker_mapping: Dict[str, str] = {}  # order_id -> broker_name
        self._broker_order_mapping: Dict[str, Dict[str, str]] = {}  # broker_name -> {broker_order_id -> our_order_id}
        
        # Health monitoring
        self._health_monitor_task: Optional[asyncio.Task] = None
        self._is_running = False
        
        # Round robin state
        self._last_broker_index = 0
        
        # Statistics
        self._stats = {
            'total_orders': 0,
            'successful_orders': 0,
            'failed_orders': 0,
            'failover_events': 0,
            'broker_switches': 0,
            'avg_order_time': 0.0,
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the broker manager."""
        if self._is_running:
            return
        
        self._logger.info("Starting broker manager...")
        self._is_running = True
        
        # Connect all enabled brokers
        for broker_name, broker in self._brokers.items():
            config = self._broker_configs[broker_name]
            if config.enabled:
                try:
                    if hasattr(broker, 'connect'):
                        await broker.connect()
                    self._broker_health[broker_name].is_healthy = True
                    self._logger.info(f"Connected to broker: {broker_name}")
                except Exception as e:
                    self._logger.error(f"Failed to connect to broker {broker_name}: {e}")
                    self._broker_health[broker_name].is_healthy = False
        
        # Start health monitoring
        self._health_monitor_task = asyncio.create_task(self._health_monitor())
        
        self._logger.info("Broker manager started")
    
    async def stop(self) -> None:
        """Stop the broker manager."""
        if not self._is_running:
            return
        
        self._logger.info("Stopping broker manager...")
        self._is_running = False
        
        # Stop health monitoring
        if self._health_monitor_task and not self._health_monitor_task.done():
            self._health_monitor_task.cancel()
        
        # Disconnect all brokers
        for broker_name, broker in self._brokers.items():
            try:
                if hasattr(broker, 'disconnect'):
                    await broker.disconnect()
                elif hasattr(broker, 'close'):
                    await broker.close()
                self._logger.info(f"Disconnected from broker: {broker_name}")
            except Exception as e:
                self._logger.error(f"Error disconnecting from broker {broker_name}: {e}")
        
        self._logger.info("Broker manager stopped")
    
    def add_broker(
        self,
        name: str,
        config: BrokerConfig,
        **broker_kwargs
    ) -> bool:
        """
        Add a broker to the manager.
        
        Args:
            name: Unique broker name
            config: Broker configuration
            **broker_kwargs: Additional broker initialization parameters
            
        Returns:
            True if broker was added successfully
        """
        try:
            if name in self._brokers:
                self._logger.warning(f"Broker {name} already exists")
                return False
            
            # Create broker instance
            broker = self._create_broker(config, **broker_kwargs)
            
            # Store broker and config
            self._brokers[name] = broker
            self._broker_configs[name] = config
            self._broker_health[name] = BrokerHealth()
            self._broker_order_counts[name] = 0
            self._broker_order_times[name] = []
            self._broker_order_mapping[name] = {}
            
            self._logger.info(f"Added broker: {name} ({config.broker_type.value})")
            return True
            
        except Exception as e:
            self._logger.error(f"Failed to add broker {name}: {e}")
            return False
    
    def remove_broker(self, name: str) -> bool:
        """Remove a broker from the manager."""
        try:
            if name not in self._brokers:
                return False
            
            # Disconnect broker
            broker = self._brokers[name]
            if hasattr(broker, 'close'):
                asyncio.create_task(broker.close())
            
            # Remove from tracking
            del self._brokers[name]
            del self._broker_configs[name]
            del self._broker_health[name]
            del self._broker_order_counts[name]
            del self._broker_order_times[name]
            del self._broker_order_mapping[name]
            
            self._logger.info(f"Removed broker: {name}")
            return True
            
        except Exception as e:
            self._logger.error(f"Failed to remove broker {name}: {e}")
            return False
    
    async def submit_order(self, order: Order) -> Tuple[Optional[str], Optional[str]]:
        """
        Submit order through best available broker.
        
        Args:
            order: Order to submit
            
        Returns:
            Tuple of (order_id, broker_name) if successful, (None, None) otherwise
        """
        try:
            self._stats['total_orders'] += 1
            start_time = datetime.utcnow()
            
            # Find best broker for order
            broker_name = await self._select_broker(order)
            
            if not broker_name:
                self._logger.error("No available brokers for order")
                self._stats['failed_orders'] += 1
                return None, None
            
            # Submit with failover
            order_id, final_broker = await self._submit_with_failover(order, broker_name)
            
            if order_id:
                # Track order
                self._order_broker_mapping[order_id] = final_broker
                self._broker_order_counts[final_broker] += 1
                
                # Update timing
                execution_time = (datetime.utcnow() - start_time).total_seconds()
                self._update_avg_order_time(execution_time)
                
                self._stats['successful_orders'] += 1
                self._logger.info(f"Order submitted successfully via {final_broker}: {order_id}")
                
                return order_id, final_broker
            else:
                self._stats['failed_orders'] += 1
                return None, None
                
        except Exception as e:
            self._logger.error(f"Error submitting order: {e}")
            self._stats['failed_orders'] += 1
            return None, None
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel order through the appropriate broker."""
        try:
            if order_id not in self._order_broker_mapping:
                self._logger.error(f"Order broker mapping not found: {order_id}")
                return False
            
            broker_name = self._order_broker_mapping[order_id]
            
            if broker_name not in self._brokers:
                self._logger.error(f"Broker not found: {broker_name}")
                return False
            
            broker = self._brokers[broker_name]
            result = await broker.cancel_order(order_id)
            
            if result:
                self._logger.info(f"Order cancelled via {broker_name}: {order_id}")
            
            return result
            
        except Exception as e:
            self._logger.error(f"Error cancelling order {order_id}: {e}")
            return False
    
    async def get_account_info(self, broker_name: Optional[str] = None) -> Dict[str, Any]:
        """Get account info from specified broker or primary broker."""
        try:
            if broker_name and broker_name in self._brokers:
                broker = self._brokers[broker_name]
            else:
                # Use first healthy broker
                broker_name = await self._get_healthy_broker()
                if not broker_name:
                    raise BrokerError("No healthy brokers available")
                broker = self._brokers[broker_name]
            
            return await broker.get_account_info()
            
        except Exception as e:
            self._logger.error(f"Error getting account info: {e}")
            raise BrokerError(f"Account info retrieval failed: {e}") from e
    
    async def get_positions(self, broker_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get positions from specified broker or primary broker."""
        try:
            if broker_name and broker_name in self._brokers:
                broker = self._brokers[broker_name]
            else:
                # Use first healthy broker
                broker_name = await self._get_healthy_broker()
                if not broker_name:
                    raise BrokerError("No healthy brokers available")
                broker = self._brokers[broker_name]
            
            return await broker.get_positions()
            
        except Exception as e:
            self._logger.error(f"Error getting positions: {e}")
            raise BrokerError(f"Position retrieval failed: {e}") from e
    
    def get_broker_health(self, broker_name: str) -> Optional[BrokerHealth]:
        """Get health status for a specific broker."""
        return self._broker_health.get(broker_name)
    
    def get_all_broker_health(self) -> Dict[str, BrokerHealth]:
        """Get health status for all brokers."""
        return self._broker_health.copy()
    
    def get_manager_stats(self) -> Dict[str, Any]:
        """Get broker manager statistics."""
        healthy_brokers = sum(1 for health in self._broker_health.values() if health.is_healthy)
        
        return {
            **self._stats,
            'total_brokers': len(self._brokers),
            'healthy_brokers': healthy_brokers,
            'critical_brokers': sum(1 for health in self._broker_health.values() if health.is_critical),
            'failover_strategy': self.failover_strategy.value,
            'load_balancing_enabled': self.enable_load_balancing,
            'broker_order_counts': self._broker_order_counts.copy(),
        }
    
    # Private helper methods
    
    def _create_broker(self, config: BrokerConfig, **kwargs) -> BrokerInterface:
        """Create broker instance based on configuration."""
        broker_params = {**config.config, **kwargs}
        
        if config.broker_type == BrokerType.PAPER:
            return PaperTradingBroker(
                event_bus=self.event_bus,
                **broker_params
            )
        elif config.broker_type == BrokerType.INTERACTIVE_BROKERS:
            return InteractiveBrokersBroker(
                event_bus=self.event_bus,
                **broker_params
            )
        elif config.broker_type == BrokerType.ALPACA:
            return AlpacaBroker(
                event_bus=self.event_bus,
                **broker_params
            )
        else:
            raise ValueError(f"Unsupported broker type: {config.broker_type}")
    
    async def _select_broker(self, order: Order) -> Optional[str]:
        """Select best broker for order based on strategy."""
        healthy_brokers = await self._get_healthy_brokers()
        
        if not healthy_brokers:
            return None
        
        # Filter by order constraints
        suitable_brokers = []
        for broker_name in healthy_brokers:
            config = self._broker_configs[broker_name]
            
            # Check symbol restrictions
            if (config.allowed_symbols and 
                order.symbol not in config.allowed_symbols):
                continue
            
            # Check order value limits
            estimated_value = order.quantity * (order.price or 100.0)  # Estimate if market order
            if estimated_value > config.max_order_value:
                continue
            
            # Check rate limits
            if not await self._check_rate_limits(broker_name):
                continue
            
            suitable_brokers.append(broker_name)
        
        if not suitable_brokers:
            return None
        
        # Apply selection strategy
        if self.failover_strategy == FailoverStrategy.ROUND_ROBIN:
            return self._select_round_robin(suitable_brokers)
        elif self.failover_strategy == FailoverStrategy.HEALTH_BASED:
            return self._select_by_health(suitable_brokers)
        elif self.failover_strategy == FailoverStrategy.PERFORMANCE_BASED:
            return self._select_by_performance(suitable_brokers)
        elif self.failover_strategy == FailoverStrategy.PRIORITY_BASED:
            return self._select_by_priority(suitable_brokers)
        else:
            return suitable_brokers[0]
    
    def _select_round_robin(self, brokers: List[str]) -> str:
        """Select broker using round-robin algorithm."""
        self._last_broker_index = (self._last_broker_index + 1) % len(brokers)
        return brokers[self._last_broker_index]
    
    def _select_by_health(self, brokers: List[str]) -> str:
        """Select broker with best health metrics."""
        best_broker = None
        best_score = -1
        
        for broker_name in brokers:
            health = self._broker_health[broker_name]
            # Health score based on success rate and response time
            score = health.success_rate - (health.avg_response_time * 10)
            
            if score > best_score:
                best_score = score
                best_broker = broker_name
        
        return best_broker or brokers[0]
    
    def _select_by_performance(self, brokers: List[str]) -> str:
        """Select broker with best performance metrics."""
        best_broker = None
        best_response_time = float('inf')
        
        for broker_name in brokers:
            health = self._broker_health[broker_name]
            if health.avg_response_time < best_response_time:
                best_response_time = health.avg_response_time
                best_broker = broker_name
        
        return best_broker or brokers[0]
    
    def _select_by_priority(self, brokers: List[str]) -> str:
        """Select broker with highest priority."""
        brokers_with_priority = [
            (broker_name, self._broker_configs[broker_name].priority)
            for broker_name in brokers
        ]
        brokers_with_priority.sort(key=lambda x: x[1])  # Lower priority = higher preference
        return brokers_with_priority[0][0]
    
    async def _submit_with_failover(
        self, 
        order: Order, 
        primary_broker: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """Submit order with automatic failover."""
        attempts = 0
        brokers_tried = set()
        
        current_broker = primary_broker
        
        while attempts < self.max_failover_attempts:
            attempts += 1
            
            if current_broker in brokers_tried:
                # Find alternative broker
                healthy_brokers = await self._get_healthy_brokers()
                available_brokers = [b for b in healthy_brokers if b not in brokers_tried]
                
                if not available_brokers:
                    break
                
                current_broker = available_brokers[0]
            
            brokers_tried.add(current_broker)
            
            try:
                broker = self._brokers[current_broker]
                start_time = datetime.utcnow()
                
                order_id = await broker.submit_order(order)
                
                if order_id:
                    # Update broker health on success
                    response_time = (datetime.utcnow() - start_time).total_seconds()
                    await self._update_broker_health(current_broker, True, response_time)
                    
                    if current_broker != primary_broker:
                        self._stats['failover_events'] += 1
                        self._stats['broker_switches'] += 1
                    
                    return order_id, current_broker
                    
            except Exception as e:
                # Update broker health on failure
                await self._update_broker_health(current_broker, False, 0, str(e))
                
                self._logger.warning(
                    f"Order submission failed on {current_broker} (attempt {attempts}): {e}"
                )
                
                # Try next broker
                continue
        
        return None, None
    
    async def _get_healthy_brokers(self) -> List[str]:
        """Get list of healthy brokers."""
        healthy = []
        for name, health in self._broker_health.items():
            config = self._broker_configs[name]
            if config.enabled and health.is_healthy and not health.is_critical:
                healthy.append(name)
        return healthy
    
    async def _get_healthy_broker(self) -> Optional[str]:
        """Get first healthy broker."""
        healthy_brokers = await self._get_healthy_brokers()
        return healthy_brokers[0] if healthy_brokers else None
    
    async def _check_rate_limits(self, broker_name: str) -> bool:
        """Check if broker is within rate limits."""
        config = self._broker_configs[broker_name]
        order_times = self._broker_order_times[broker_name]
        
        # Clean old timestamps
        minute_ago = datetime.utcnow() - timedelta(minutes=1)
        self._broker_order_times[broker_name] = [
            t for t in order_times if t > minute_ago
        ]
        
        return len(self._broker_order_times[broker_name]) < config.max_orders_per_minute
    
    async def _update_broker_health(
        self,
        broker_name: str,
        success: bool,
        response_time: float,
        error: str = ""
    ) -> None:
        """Update broker health metrics."""
        if broker_name not in self._broker_health:
            return
        
        health = self._broker_health[broker_name]
        health.last_check = datetime.utcnow()
        
        if success:
            health.success_count += 1
            health.consecutive_failures = 0
            health.last_successful_order = datetime.utcnow()
            
            # Update average response time (exponential moving average)
            if health.avg_response_time == 0:
                health.avg_response_time = response_time
            else:
                health.avg_response_time = (health.avg_response_time * 0.9 + response_time * 0.1)
        else:
            health.error_count += 1
            health.consecutive_failures += 1
            health.last_error = error
            
            # Mark as unhealthy if too many consecutive failures
            if health.consecutive_failures >= 3:
                health.is_healthy = False
    
    async def _health_monitor(self) -> None:
        """Monitor broker health periodically."""
        while self._is_running:
            try:
                await asyncio.sleep(self.health_check_interval)
                
                for broker_name, broker in self._brokers.items():
                    if not self._broker_configs[broker_name].enabled:
                        continue
                    
                    try:
                        # Perform health check
                        start_time = datetime.utcnow()
                        
                        if hasattr(broker, 'get_account_info'):
                            await broker.get_account_info()
                        
                        response_time = (datetime.utcnow() - start_time).total_seconds()
                        await self._update_broker_health(broker_name, True, response_time)
                        
                        # Mark as healthy if it was down
                        if not self._broker_health[broker_name].is_healthy:
                            self._broker_health[broker_name].is_healthy = True
                            self._logger.info(f"Broker {broker_name} is back online")
                        
                    except Exception as e:
                        await self._update_broker_health(broker_name, False, 0, str(e))
                        
                        if self._broker_health[broker_name].is_healthy:
                            self._broker_health[broker_name].is_healthy = False
                            self._logger.warning(f"Broker {broker_name} health check failed: {e}")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Health monitor error: {e}")
    
    def _update_avg_order_time(self, execution_time: float) -> None:
        """Update average order execution time."""
        if self._stats['avg_order_time'] == 0:
            self._stats['avg_order_time'] = execution_time
        else:
            # Exponential moving average
            self._stats['avg_order_time'] = (
                self._stats['avg_order_time'] * 0.9 + execution_time * 0.1
            )