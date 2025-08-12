"""
Strategy manager for Pi5 Trading System.

Manages multiple trading strategies with lifecycle management, performance
monitoring, and coordination. Provides centralized strategy orchestration
with load balancing, error handling, and resource management.

Features:
- Strategy loading and registration
- Lifecycle management (start/stop/restart)
- Performance monitoring and metrics
- Resource allocation and load balancing
- Error handling and strategy isolation
- Configuration management
- Event-driven strategy coordination
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Type
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

from core.interfaces import BaseStrategy, EventHandler, Signal
from core.exceptions import (
    StrategyError,
    StrategyInitializationError,
    StrategyNotFoundError,
    ConfigurationError,
)
from events.event_types import (
    MarketDataEvent,
    OrderFilledEvent,
    SignalGeneratedEvent,
    StrategyStatusEvent,
    StrategyPerformanceEvent,
)
from events.event_bus import EventBus
from database.connection_manager import DatabaseManager


logger = logging.getLogger(__name__)


class StrategyManager(EventHandler):
    """
    Central manager for all trading strategies.
    
    Coordinates strategy execution, manages resources, monitors performance,
    and handles strategy lifecycle with fault isolation and recovery.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        db_manager: DatabaseManager,
        max_concurrent_strategies: int = 10,
        strategy_timeout: float = 30.0,
        enable_performance_monitoring: bool = True,
    ):
        """
        Initialize strategy manager.
        
        Args:
            event_bus: Event bus for system communication
            db_manager: Database manager for persistence
            max_concurrent_strategies: Maximum concurrent strategy executions
            strategy_timeout: Strategy execution timeout in seconds
            enable_performance_monitoring: Enable performance tracking
        """
        self.event_bus = event_bus
        self.db_manager = db_manager
        self.max_concurrent_strategies = max_concurrent_strategies
        self.strategy_timeout = strategy_timeout
        self.enable_performance_monitoring = enable_performance_monitoring
        
        # Strategy management
        self._strategies: Dict[str, BaseStrategy] = {}
        self._strategy_configs: Dict[str, Dict[str, Any]] = {}
        self._strategy_status: Dict[str, str] = {}  # strategy_id -> status
        self._strategy_errors: Dict[str, List[Exception]] = defaultdict(list)
        
        # Execution control
        self._strategy_semaphore = asyncio.Semaphore(max_concurrent_strategies)
        self._executor = ThreadPoolExecutor(max_workers=max_concurrent_strategies)
        self._running_strategies: Set[str] = set()
        self._is_manager_running = False
        
        # Performance monitoring
        self._strategy_metrics: Dict[str, Dict[str, Any]] = {}
        self._performance_history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        # Event handling
        self._handled_event_types = {
            'market_data',
            'order_filled',
            'strategy_status',
        }
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the strategy manager."""
        if self._is_manager_running:
            return
        
        self._logger.info("Starting strategy manager...")
        self._is_manager_running = True
        
        # Subscribe to events
        for event_type in self._handled_event_types:
            self.event_bus.subscribe(event_type, self)
        
        # Start performance monitoring if enabled
        if self.enable_performance_monitoring:
            asyncio.create_task(self._performance_monitor())
        
        self._logger.info("Strategy manager started")
    
    async def stop(self) -> None:
        """Stop the strategy manager and all strategies."""
        if not self._is_manager_running:
            return
        
        self._logger.info("Stopping strategy manager...")
        self._is_manager_running = False
        
        # Stop all running strategies
        stop_tasks = []
        for strategy_id in list(self._running_strategies):
            stop_tasks.append(self.stop_strategy(strategy_id))
        
        if stop_tasks:
            await asyncio.gather(*stop_tasks, return_exceptions=True)
        
        # Unsubscribe from events
        for event_type in self._handled_event_types:
            self.event_bus.unsubscribe(event_type, self)
        
        # Shutdown executor
        self._executor.shutdown(wait=True)
        
        self._logger.info("Strategy manager stopped")
    
    def register_strategy(
        self,
        strategy: BaseStrategy,
        config: Dict[str, Any] = None,
        auto_start: bool = False
    ) -> str:
        """
        Register a strategy with the manager.
        
        Args:
            strategy: Strategy instance
            config: Strategy configuration
            auto_start: Whether to start strategy immediately
            
        Returns:
            Strategy ID
        """
        strategy_id = f"{strategy.name}_{uuid.uuid4().hex[:8]}"
        
        self._strategies[strategy_id] = strategy
        self._strategy_configs[strategy_id] = config or {}
        self._strategy_status[strategy_id] = 'registered'
        self._strategy_metrics[strategy_id] = {
            'registered_at': datetime.utcnow(),
            'signals_generated': 0,
            'orders_placed': 0,
            'total_pnl': 0.0,
            'last_active': None,
        }
        
        self._logger.info(
            f"Registered strategy: {strategy.name} (ID: {strategy_id})"
        )
        
        if auto_start:
            asyncio.create_task(self.start_strategy(strategy_id))
        
        return strategy_id
    
    def unregister_strategy(self, strategy_id: str) -> bool:
        """
        Unregister a strategy from the manager.
        
        Args:
            strategy_id: Strategy identifier
            
        Returns:
            True if strategy was found and removed
        """
        if strategy_id not in self._strategies:
            return False
        
        # Stop strategy if running
        if strategy_id in self._running_strategies:
            asyncio.create_task(self.stop_strategy(strategy_id))
        
        # Remove from all tracking
        strategy_name = self._strategies[strategy_id].name
        del self._strategies[strategy_id]
        self._strategy_configs.pop(strategy_id, None)
        self._strategy_status.pop(strategy_id, None)
        self._strategy_errors.pop(strategy_id, None)
        self._strategy_metrics.pop(strategy_id, None)
        self._performance_history.pop(strategy_id, None)
        
        self._logger.info(
            f"Unregistered strategy: {strategy_name} (ID: {strategy_id})"
        )
        return True
    
    async def start_strategy(self, strategy_id: str) -> bool:
        """
        Start a specific strategy.
        
        Args:
            strategy_id: Strategy identifier
            
        Returns:
            True if strategy started successfully
        """
        if strategy_id not in self._strategies:
            raise StrategyNotFoundError(f"Strategy not found: {strategy_id}")
        
        if strategy_id in self._running_strategies:
            self._logger.warning(f"Strategy {strategy_id} is already running")
            return False
        
        strategy = self._strategies[strategy_id]
        
        try:
            self._logger.info(f"Starting strategy: {strategy.name}")
            self._strategy_status[strategy_id] = 'starting'
            
            # Initialize strategy
            await strategy.start()
            
            # Mark as running
            self._running_strategies.add(strategy_id)
            self._strategy_status[strategy_id] = 'active'
            self._strategy_metrics[strategy_id]['last_active'] = datetime.utcnow()
            
            # Publish status event
            await self._publish_strategy_status_event(
                strategy_id, 'registered', 'active', 'Strategy started successfully'
            )
            
            self._logger.info(f"Strategy started: {strategy.name}")
            return True
            
        except Exception as e:
            self._strategy_status[strategy_id] = 'error'
            self._strategy_errors[strategy_id].append(e)
            
            await self._publish_strategy_status_event(
                strategy_id, 'starting', 'error', f'Strategy start failed: {e}'
            )
            
            self._logger.error(f"Failed to start strategy {strategy.name}: {e}")
            raise StrategyInitializationError(
                f"Failed to start strategy {strategy.name}: {e}",
                context={'strategy_id': strategy_id}
            ) from e
    
    async def stop_strategy(self, strategy_id: str) -> bool:
        """
        Stop a specific strategy.
        
        Args:
            strategy_id: Strategy identifier
            
        Returns:
            True if strategy stopped successfully
        """
        if strategy_id not in self._strategies:
            raise StrategyNotFoundError(f"Strategy not found: {strategy_id}")
        
        if strategy_id not in self._running_strategies:
            self._logger.warning(f"Strategy {strategy_id} is not running")
            return False
        
        strategy = self._strategies[strategy_id]
        
        try:
            self._logger.info(f"Stopping strategy: {strategy.name}")
            self._strategy_status[strategy_id] = 'stopping'
            
            # Stop strategy
            await strategy.stop()
            
            # Mark as stopped
            self._running_strategies.discard(strategy_id)
            self._strategy_status[strategy_id] = 'stopped'
            
            # Publish status event
            await self._publish_strategy_status_event(
                strategy_id, 'active', 'stopped', 'Strategy stopped successfully'
            )
            
            self._logger.info(f"Strategy stopped: {strategy.name}")
            return True
            
        except Exception as e:
            self._strategy_status[strategy_id] = 'error'
            self._strategy_errors[strategy_id].append(e)
            
            await self._publish_strategy_status_event(
                strategy_id, 'stopping', 'error', f'Strategy stop failed: {e}'
            )
            
            self._logger.error(f"Failed to stop strategy {strategy.name}: {e}")
            return False
    
    async def restart_strategy(self, strategy_id: str) -> bool:
        """
        Restart a specific strategy.
        
        Args:
            strategy_id: Strategy identifier
            
        Returns:
            True if strategy restarted successfully
        """
        self._logger.info(f"Restarting strategy: {strategy_id}")
        
        # Stop if running
        if strategy_id in self._running_strategies:
            await self.stop_strategy(strategy_id)
        
        # Start again
        return await self.start_strategy(strategy_id)
    
    def get_strategy_status(self, strategy_id: str = None) -> Dict[str, Any]:
        """
        Get strategy status information.
        
        Args:
            strategy_id: Specific strategy ID (None for all strategies)
            
        Returns:
            Strategy status information
        """
        if strategy_id:
            if strategy_id not in self._strategies:
                raise StrategyNotFoundError(f"Strategy not found: {strategy_id}")
            
            strategy = self._strategies[strategy_id]
            return {
                'strategy_id': strategy_id,
                'name': strategy.name,
                'status': self._strategy_status[strategy_id],
                'is_running': strategy_id in self._running_strategies,
                'metrics': self._strategy_metrics.get(strategy_id, {}),
                'error_count': len(self._strategy_errors.get(strategy_id, [])),
                'last_error': str(self._strategy_errors[strategy_id][-1]) if self._strategy_errors.get(strategy_id) else None,
                'positions': dict(strategy.positions),
                'parameters': strategy.parameters,
            }
        
        # Return all strategies
        all_status = {}
        for sid in self._strategies:
            all_status[sid] = self.get_strategy_status(sid)
        
        return all_status
    
    def get_performance_metrics(self, strategy_id: str = None) -> Dict[str, Any]:
        """Get performance metrics for strategies."""
        if strategy_id:
            if strategy_id not in self._strategies:
                raise StrategyNotFoundError(f"Strategy not found: {strategy_id}")
            
            strategy = self._strategies[strategy_id]
            metrics = strategy.get_performance_metrics()
            metrics.update(self._strategy_metrics.get(strategy_id, {}))
            return metrics
        
        # Return all strategy metrics
        all_metrics = {}
        for sid in self._strategies:
            all_metrics[sid] = self.get_performance_metrics(sid)
        
        return all_metrics
    
    async def handle(self, event) -> None:
        """Handle incoming events."""
        try:
            if isinstance(event, MarketDataEvent):
                await self._handle_market_data_event(event)
            elif isinstance(event, OrderFilledEvent):
                await self._handle_order_filled_event(event)
                
        except Exception as e:
            self._logger.error(f"Error handling event {event.event_type}: {e}")
    
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can process the given event type."""
        return event_type in self._handled_event_types
    
    async def _handle_market_data_event(self, event: MarketDataEvent) -> None:
        """Handle market data events by routing to active strategies."""
        if not self._running_strategies:
            return
        
        # Process strategies concurrently with semaphore control
        tasks = []
        for strategy_id in self._running_strategies:
            task = self._process_strategy_market_data(strategy_id, event)
            tasks.append(task)
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle any exceptions
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    strategy_id = list(self._running_strategies)[i]
                    self._logger.error(
                        f"Strategy {strategy_id} failed processing market data: {result}"
                    )
                    self._strategy_errors[strategy_id].append(result)
    
    async def _process_strategy_market_data(
        self,
        strategy_id: str,
        event: MarketDataEvent
    ) -> None:
        """Process market data for a specific strategy."""
        async with self._strategy_semaphore:
            try:
                strategy = self._strategies[strategy_id]
                
                # Check if strategy should process this symbol
                if strategy.symbols and event.symbol not in strategy.symbols:
                    return
                
                # Process market data with timeout
                signals = await asyncio.wait_for(
                    strategy.on_market_data(event),
                    timeout=self.strategy_timeout
                )
                
                # Update metrics
                self._strategy_metrics[strategy_id]['last_active'] = datetime.utcnow()
                
                # Publish signals
                for signal in signals:
                    await self._publish_signal_event(strategy_id, signal)
                    self._strategy_metrics[strategy_id]['signals_generated'] += 1
                
            except asyncio.TimeoutError:
                self._logger.warning(
                    f"Strategy {strategy_id} timed out processing market data"
                )
            except Exception as e:
                self._logger.error(
                    f"Strategy {strategy_id} error processing market data: {e}"
                )
                self._strategy_errors[strategy_id].append(e)
    
    async def _handle_order_filled_event(self, event: OrderFilledEvent) -> None:
        """Handle order fill events by routing to relevant strategies."""
        # Find strategies that might be interested in this fill
        # (could be based on strategy name in order metadata)
        
        for strategy_id in self._running_strategies:
            try:
                strategy = self._strategies[strategy_id]
                
                # Check if this fill is relevant to the strategy
                if event.symbol in strategy.positions or strategy.name in event.order_id:
                    await strategy.on_order_filled(event)
                    self._strategy_metrics[strategy_id]['orders_placed'] += 1
                
            except Exception as e:
                self._logger.error(
                    f"Strategy {strategy_id} error processing order fill: {e}"
                )
                self._strategy_errors[strategy_id].append(e)
    
    async def _publish_signal_event(self, strategy_id: str, signal: Signal) -> None:
        """Publish signal generated event."""
        event = SignalGeneratedEvent(
            strategy_name=signal.strategy_name,
            symbol=signal.symbol,
            signal_type=signal.signal_type,
            confidence=signal.confidence,
            price=signal.price,
            timestamp=signal.timestamp,
            metadata=signal.metadata
        )
        await self.event_bus.publish(event)
    
    async def _publish_strategy_status_event(
        self,
        strategy_id: str,
        old_status: str,
        new_status: str,
        reason: str = None
    ) -> None:
        """Publish strategy status change event."""
        strategy = self._strategies[strategy_id]
        event = StrategyStatusEvent(
            strategy_name=strategy.name,
            old_status=old_status,
            new_status=new_status,
            timestamp=datetime.utcnow(),
            reason=reason
        )
        await self.event_bus.publish(event)
    
    async def _performance_monitor(self) -> None:
        """Background task to monitor and publish strategy performance."""
        while self._is_manager_running:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                for strategy_id in self._running_strategies:
                    strategy = self._strategies[strategy_id]
                    metrics = strategy.get_performance_metrics()
                    
                    # Store performance history
                    performance_snapshot = {
                        'timestamp': datetime.utcnow(),
                        'metrics': metrics,
                    }
                    self._performance_history[strategy_id].append(performance_snapshot)
                    
                    # Keep only last 1000 snapshots
                    if len(self._performance_history[strategy_id]) > 1000:
                        self._performance_history[strategy_id] = self._performance_history[strategy_id][-1000:]
                    
                    # Publish performance event
                    perf_event = StrategyPerformanceEvent(
                        strategy_name=strategy.name,
                        timestamp=datetime.utcnow(),
                        total_return=metrics.get('total_pnl', 0.0),
                        daily_return=0.0,  # TODO: Calculate from daily returns
                        sharpe_ratio=metrics.get('sharpe_ratio'),
                        max_drawdown=None,  # TODO: Calculate
                        win_rate=metrics.get('win_rate'),
                        total_trades=metrics.get('total_trades', 0)
                    )
                    await self.event_bus.publish(perf_event)
                
            except Exception as e:
                self._logger.error(f"Performance monitoring error: {e}")
    
    def get_manager_stats(self) -> Dict[str, Any]:
        """Get strategy manager statistics."""
        return {
            'total_strategies': len(self._strategies),
            'running_strategies': len(self._running_strategies),
            'stopped_strategies': len([s for s in self._strategy_status.values() if s == 'stopped']),
            'error_strategies': len([s for s in self._strategy_status.values() if s == 'error']),
            'total_signals_generated': sum(
                m.get('signals_generated', 0) for m in self._strategy_metrics.values()
            ),
            'total_orders_placed': sum(
                m.get('orders_placed', 0) for m in self._strategy_metrics.values()
            ),
            'is_running': self._is_manager_running,
            'max_concurrent_strategies': self.max_concurrent_strategies,
        }