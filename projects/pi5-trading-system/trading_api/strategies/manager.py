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
import numpy as np
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Type, Tuple
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
from enum import Enum
from dataclasses import dataclass

from core.interfaces import BaseStrategy, EventHandler, Signal, TradingSignal
from core.exceptions import (
    StrategyError,
    StrategyInitializationError,
    StrategyNotFoundError,
    ConfigurationError,
    RiskManagementError,
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


class SignalAggregationMethod(Enum):
    """Signal aggregation methods for multi-strategy coordination."""
    FIRST_WINS = "first_wins"  # First signal takes precedence
    HIGHEST_CONFIDENCE = "highest_confidence"  # Signal with highest confidence
    WEIGHTED_AVERAGE = "weighted_average"  # Weighted by strategy allocation
    CONSENSUS = "consensus"  # Require majority agreement
    RISK_ADJUSTED = "risk_adjusted"  # Adjust by strategy risk metrics


class ConflictResolutionMode(Enum):
    """Conflict resolution modes for opposing signals."""
    CANCEL_ALL = "cancel_all"  # Cancel all conflicting signals
    NET_POSITION = "net_position"  # Calculate net position change
    HIGHEST_CONFIDENCE = "highest_confidence"  # Use highest confidence signal
    STRATEGY_PRIORITY = "strategy_priority"  # Use strategy priority ranking


@dataclass
class StrategyAllocation:
    """Strategy allocation and weighting information."""
    strategy_id: str
    weight: float  # Portfolio weight (0.0 to 1.0)
    max_allocation: float  # Maximum capital allocation
    risk_limit: float  # Maximum risk per trade
    priority: int  # Strategy priority for conflict resolution
    is_active: bool = True
    performance_weight: float = 1.0  # Dynamic weight based on performance


@dataclass
class AggregatedSignal:
    """Aggregated signal from multiple strategies."""
    symbol: str
    signal_type: TradingSignal
    confidence: float
    price: float
    timestamp: datetime
    position_size: float
    contributing_strategies: List[str]
    aggregation_method: SignalAggregationMethod
    metadata: Dict[str, Any]


@dataclass
class PortfolioRiskMetrics:
    """Portfolio-level risk metrics."""
    total_exposure: float
    symbol_exposures: Dict[str, float]
    strategy_exposures: Dict[str, float]
    correlation_risk: float
    concentration_risk: float
    var_estimate: float  # Value at Risk
    max_drawdown: float


class EnhancedStrategyManager(EventHandler):
    """
    Enhanced central manager for all trading strategies.
    
    Coordinates multi-strategy execution with advanced portfolio management,
    signal aggregation, risk control, and performance attribution.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        db_manager: DatabaseManager,
        max_concurrent_strategies: int = 10,
        strategy_timeout: float = 30.0,
        enable_performance_monitoring: bool = True,
        total_capital: float = 100000.0,
        max_portfolio_risk: float = 0.10,  # 10% portfolio risk limit
        signal_aggregation_method: SignalAggregationMethod = SignalAggregationMethod.WEIGHTED_AVERAGE,
        conflict_resolution_mode: ConflictResolutionMode = ConflictResolutionMode.HIGHEST_CONFIDENCE,
        enable_dynamic_allocation: bool = True,
        rebalance_frequency: int = 60,  # Rebalance every 60 minutes
    ):
        """
        Initialize enhanced strategy manager.
        
        Args:
            event_bus: Event bus for system communication
            db_manager: Database manager for persistence
            max_concurrent_strategies: Maximum concurrent strategy executions
            strategy_timeout: Strategy execution timeout in seconds
            enable_performance_monitoring: Enable performance tracking
            total_capital: Total available capital for allocation
            max_portfolio_risk: Maximum portfolio-level risk exposure
            signal_aggregation_method: Method for aggregating signals
            conflict_resolution_mode: Mode for resolving signal conflicts
            enable_dynamic_allocation: Enable dynamic strategy weight adjustment
            rebalance_frequency: Portfolio rebalancing frequency in minutes
        """
        self.event_bus = event_bus
        self.db_manager = db_manager
        self.max_concurrent_strategies = max_concurrent_strategies
        self.strategy_timeout = strategy_timeout
        self.enable_performance_monitoring = enable_performance_monitoring
        
        # Portfolio management
        self.total_capital = total_capital
        self.max_portfolio_risk = max_portfolio_risk
        self.signal_aggregation_method = signal_aggregation_method
        self.conflict_resolution_mode = conflict_resolution_mode
        self.enable_dynamic_allocation = enable_dynamic_allocation
        self.rebalance_frequency = rebalance_frequency
        
        # Strategy management
        self._strategies: Dict[str, BaseStrategy] = {}
        self._strategy_configs: Dict[str, Dict[str, Any]] = {}
        self._strategy_allocations: Dict[str, StrategyAllocation] = {}
        self._strategy_status: Dict[str, str] = {}  # strategy_id -> status
        self._strategy_errors: Dict[str, List[Exception]] = defaultdict(list)
        self._strategy_groups: Dict[str, List[str]] = {}  # group_name -> strategy_ids
        
        # Execution control
        self._strategy_semaphore = asyncio.Semaphore(max_concurrent_strategies)
        self._executor = ThreadPoolExecutor(max_workers=max_concurrent_strategies)
        self._running_strategies: Set[str] = set()
        self._is_manager_running = False
        
        # Performance monitoring and attribution
        self._strategy_metrics: Dict[str, Dict[str, Any]] = {}
        self._performance_history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self._performance_attribution: Dict[str, float] = {}  # strategy_id -> contribution
        self._correlation_matrix: Dict[Tuple[str, str], float] = {}  # strategy correlation
        
        # Signal aggregation and coordination
        self._pending_signals: Dict[str, List[Signal]] = defaultdict(list)  # symbol -> signals
        self._signal_aggregation_window: float = 5.0  # seconds to wait for signals
        self._last_aggregation: Dict[str, datetime] = {}  # symbol -> last aggregation time
        
        # Risk management
        self._portfolio_positions: Dict[str, float] = {}  # symbol -> net position
        self._risk_metrics: Optional[PortfolioRiskMetrics] = None
        self._position_limits: Dict[str, float] = {}  # symbol -> max position
        
        # Dynamic allocation
        self._last_rebalance: Optional[datetime] = None
        self._strategy_performance_window: int = 30  # days for performance calculation
        
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
        allocation: Optional[StrategyAllocation] = None,
        auto_start: bool = False
    ) -> str:
        """
        Register a strategy with the enhanced manager.
        
        Args:
            strategy: Strategy instance
            config: Strategy configuration
            allocation: Strategy allocation and weighting information
            auto_start: Whether to start strategy immediately
            
        Returns:
            Strategy ID
        """
        strategy_id = f"{strategy.name}_{uuid.uuid4().hex[:8]}"
        
        self._strategies[strategy_id] = strategy
        self._strategy_configs[strategy_id] = config or {}
        
        # Set up allocation with defaults if not provided
        if allocation is None:
            allocation = StrategyAllocation(
                strategy_id=strategy_id,
                weight=0.1,  # Default 10% allocation
                max_allocation=self.total_capital * 0.2,  # Max 20% of capital
                risk_limit=0.02,  # 2% risk per trade
                priority=len(self._strategies),  # Lower priority for new strategies
                is_active=True
            )
        else:
            allocation.strategy_id = strategy_id
        
        self._strategy_allocations[strategy_id] = allocation
        self._strategy_status[strategy_id] = 'registered'
        self._strategy_metrics[strategy_id] = {
            'registered_at': datetime.utcnow(),
            'signals_generated': 0,
            'orders_placed': 0,
            'total_pnl': 0.0,
            'last_active': None,
            'allocated_capital': allocation.max_allocation,
            'risk_limit': allocation.risk_limit,
            'performance_contribution': 0.0,
        }
        self._performance_attribution[strategy_id] = 0.0
        
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
            'total_capital': self.total_capital,
            'portfolio_exposure': sum(abs(pos) for pos in self._portfolio_positions.values()),
            'active_allocations': len([a for a in self._strategy_allocations.values() if a.is_active]),
        }

    def get_manager_status(self) -> Dict[str, Any]:
        """Get strategy manager status (alias for get_manager_stats for compatibility)."""
        return self.get_manager_stats()

    # ============================================================================
    # ENHANCED MULTI-STRATEGY COORDINATION METHODS
    # ============================================================================
    
    def set_strategy_allocation(
        self,
        strategy_id: str,
        allocation: StrategyAllocation
    ) -> None:
        """Set or update strategy allocation."""
        if strategy_id not in self._strategies:
            raise StrategyNotFoundError(f"Strategy not found: {strategy_id}")
        
        allocation.strategy_id = strategy_id
        self._strategy_allocations[strategy_id] = allocation
        
        # Update metrics
        if strategy_id in self._strategy_metrics:
            self._strategy_metrics[strategy_id].update({
                'allocated_capital': allocation.max_allocation,
                'risk_limit': allocation.risk_limit,
            })
        
        self._logger.info(
            f"Updated allocation for strategy {strategy_id}: "
            f"weight={allocation.weight:.2%}, capital={allocation.max_allocation:,.0f}"
        )
    
    def create_strategy_group(
        self,
        group_name: str,
        strategy_ids: List[str],
        group_weight: float = 1.0
    ) -> None:
        """Create a group of strategies for coordinated management."""
        # Validate all strategies exist
        for strategy_id in strategy_ids:
            if strategy_id not in self._strategies:
                raise StrategyNotFoundError(f"Strategy not found: {strategy_id}")
        
        self._strategy_groups[group_name] = strategy_ids
        
        # Adjust individual strategy weights within group
        individual_weight = group_weight / len(strategy_ids)
        for strategy_id in strategy_ids:
            if strategy_id in self._strategy_allocations:
                self._strategy_allocations[strategy_id].weight = individual_weight
        
        self._logger.info(
            f"Created strategy group '{group_name}' with {len(strategy_ids)} strategies"
        )
    
    async def aggregate_signals(self, symbol: str) -> Optional[AggregatedSignal]:
        """Aggregate signals from multiple strategies for a symbol."""
        signals = self._pending_signals.get(symbol, [])
        
        if not signals:
            return None
        
        # Filter signals by strategy allocation status
        active_signals = []
        for signal in signals:
            strategy_id = self._get_strategy_id_by_name(signal.strategy_name)
            if (strategy_id and 
                strategy_id in self._strategy_allocations and 
                self._strategy_allocations[strategy_id].is_active):
                active_signals.append(signal)
        
        if not active_signals:
            return None
        
        # Apply aggregation method
        if self.signal_aggregation_method == SignalAggregationMethod.FIRST_WINS:
            return self._aggregate_first_wins(symbol, active_signals)
        elif self.signal_aggregation_method == SignalAggregationMethod.HIGHEST_CONFIDENCE:
            return self._aggregate_highest_confidence(symbol, active_signals)
        elif self.signal_aggregation_method == SignalAggregationMethod.WEIGHTED_AVERAGE:
            return self._aggregate_weighted_average(symbol, active_signals)
        elif self.signal_aggregation_method == SignalAggregationMethod.CONSENSUS:
            return self._aggregate_consensus(symbol, active_signals)
        elif self.signal_aggregation_method == SignalAggregationMethod.RISK_ADJUSTED:
            return self._aggregate_risk_adjusted(symbol, active_signals)
        
        return None
    
    def _aggregate_first_wins(self, symbol: str, signals: List[Signal]) -> AggregatedSignal:
        """Use first signal that arrives."""
        first_signal = min(signals, key=lambda s: s.timestamp)
        strategy_id = self._get_strategy_id_by_name(first_signal.strategy_name)
        position_size = self._calculate_position_size(strategy_id, first_signal)
        
        return AggregatedSignal(
            symbol=symbol,
            signal_type=first_signal.signal_type,
            confidence=first_signal.confidence,
            price=first_signal.price,
            timestamp=first_signal.timestamp,
            position_size=position_size,
            contributing_strategies=[first_signal.strategy_name],
            aggregation_method=SignalAggregationMethod.FIRST_WINS,
            metadata=first_signal.metadata
        )
    
    def _aggregate_highest_confidence(self, symbol: str, signals: List[Signal]) -> AggregatedSignal:
        """Use signal with highest confidence."""
        best_signal = max(signals, key=lambda s: s.confidence)
        strategy_id = self._get_strategy_id_by_name(best_signal.strategy_name)
        position_size = self._calculate_position_size(strategy_id, best_signal)
        
        return AggregatedSignal(
            symbol=symbol,
            signal_type=best_signal.signal_type,
            confidence=best_signal.confidence,
            price=best_signal.price,
            timestamp=best_signal.timestamp,
            position_size=position_size,
            contributing_strategies=[best_signal.strategy_name],
            aggregation_method=SignalAggregationMethod.HIGHEST_CONFIDENCE,
            metadata=best_signal.metadata
        )
    
    def _aggregate_weighted_average(self, symbol: str, signals: List[Signal]) -> AggregatedSignal:
        """Aggregate signals using strategy weights."""
        if not signals:
            return None
        
        # Resolve conflicts first
        resolved_signals = self._resolve_signal_conflicts(signals)
        
        if not resolved_signals:
            return None
        
        # Calculate weighted averages
        total_weight = 0.0
        weighted_confidence = 0.0
        weighted_price = 0.0
        total_position_size = 0.0
        contributing_strategies = []
        
        for signal in resolved_signals:
            strategy_id = self._get_strategy_id_by_name(signal.strategy_name)
            if not strategy_id or strategy_id not in self._strategy_allocations:
                continue
            
            allocation = self._strategy_allocations[strategy_id]
            weight = allocation.weight * allocation.performance_weight
            position_size = self._calculate_position_size(strategy_id, signal)
            
            weighted_confidence += signal.confidence * weight
            weighted_price += signal.price * weight
            total_position_size += position_size
            total_weight += weight
            contributing_strategies.append(signal.strategy_name)
        
        if total_weight == 0:
            return None
        
        # Determine aggregated signal type
        buy_weight = sum(
            self._strategy_allocations[self._get_strategy_id_by_name(s.strategy_name)].weight
            for s in resolved_signals if s.signal_type == TradingSignal.BUY
        )
        sell_weight = sum(
            self._strategy_allocations[self._get_strategy_id_by_name(s.strategy_name)].weight
            for s in resolved_signals if s.signal_type == TradingSignal.SELL
        )
        
        signal_type = TradingSignal.BUY if buy_weight > sell_weight else TradingSignal.SELL
        
        return AggregatedSignal(
            symbol=symbol,
            signal_type=signal_type,
            confidence=weighted_confidence / total_weight,
            price=weighted_price / total_weight,
            timestamp=datetime.utcnow(),
            position_size=total_position_size,
            contributing_strategies=contributing_strategies,
            aggregation_method=SignalAggregationMethod.WEIGHTED_AVERAGE,
            metadata={
                'total_weight': total_weight,
                'buy_weight': buy_weight,
                'sell_weight': sell_weight,
                'original_signal_count': len(signals)
            }
        )
    
    def _aggregate_consensus(self, symbol: str, signals: List[Signal]) -> Optional[AggregatedSignal]:
        """Require consensus (majority agreement) for signals."""
        if len(signals) < 2:
            return None
        
        buy_signals = [s for s in signals if s.signal_type == TradingSignal.BUY]
        sell_signals = [s for s in signals if s.signal_type == TradingSignal.SELL]
        
        # Require majority
        majority_threshold = len(signals) / 2
        
        if len(buy_signals) > majority_threshold:
            # Use weighted average of buy signals
            return self._aggregate_weighted_average(symbol, buy_signals)
        elif len(sell_signals) > majority_threshold:
            # Use weighted average of sell signals
            return self._aggregate_weighted_average(symbol, sell_signals)
        
        # No consensus
        return None
    
    def _aggregate_risk_adjusted(self, symbol: str, signals: List[Signal]) -> Optional[AggregatedSignal]:
        """Aggregate signals with risk adjustment."""
        # Calculate risk-adjusted weights
        risk_adjusted_signals = []
        
        for signal in signals:
            strategy_id = self._get_strategy_id_by_name(signal.strategy_name)
            if not strategy_id or strategy_id not in self._strategy_allocations:
                continue
            
            allocation = self._strategy_allocations[strategy_id]
            
            # Calculate strategy risk (simplified)
            strategy_metrics = self._strategy_metrics.get(strategy_id, {})
            win_rate = strategy_metrics.get('win_rate', 0.5)
            sharpe_ratio = strategy_metrics.get('sharpe_ratio', 0.0)
            
            # Risk adjustment factor (higher is better)
            risk_factor = (win_rate * 2) + max(0, sharpe_ratio / 2)
            risk_factor = max(0.1, min(2.0, risk_factor))  # Bound between 0.1 and 2.0
            
            # Adjust signal
            adjusted_signal = Signal(
                symbol=signal.symbol,
                signal_type=signal.signal_type,
                confidence=signal.confidence * risk_factor,
                price=signal.price,
                timestamp=signal.timestamp,
                strategy_name=signal.strategy_name,
                metadata={**signal.metadata, 'risk_factor': risk_factor}
            )
            risk_adjusted_signals.append(adjusted_signal)
        
        if not risk_adjusted_signals:
            return None
        
        # Use weighted average with risk-adjusted signals
        return self._aggregate_weighted_average(symbol, risk_adjusted_signals)
    
    def _resolve_signal_conflicts(self, signals: List[Signal]) -> List[Signal]:
        """Resolve conflicting signals based on resolution mode."""
        if len(signals) <= 1:
            return signals
        
        buy_signals = [s for s in signals if s.signal_type == TradingSignal.BUY]
        sell_signals = [s for s in signals if s.signal_type == TradingSignal.SELL]
        
        # No conflict if all signals are same direction
        if not buy_signals or not sell_signals:
            return signals
        
        # Handle conflicts based on resolution mode
        if self.conflict_resolution_mode == ConflictResolutionMode.CANCEL_ALL:
            return []
        
        elif self.conflict_resolution_mode == ConflictResolutionMode.NET_POSITION:
            # Calculate net position change
            buy_strength = sum(s.confidence for s in buy_signals)
            sell_strength = sum(s.confidence for s in sell_signals)
            
            if buy_strength > sell_strength:
                return buy_signals
            elif sell_strength > buy_strength:
                return sell_signals
            else:
                return []  # Equal strength, cancel
        
        elif self.conflict_resolution_mode == ConflictResolutionMode.HIGHEST_CONFIDENCE:
            best_buy = max(buy_signals, key=lambda s: s.confidence) if buy_signals else None
            best_sell = max(sell_signals, key=lambda s: s.confidence) if sell_signals else None
            
            if best_buy and best_sell:
                return [best_buy] if best_buy.confidence > best_sell.confidence else [best_sell]
            elif best_buy:
                return [best_buy]
            elif best_sell:
                return [best_sell]
        
        elif self.conflict_resolution_mode == ConflictResolutionMode.STRATEGY_PRIORITY:
            # Use strategy with highest priority
            priority_signal = min(
                signals,
                key=lambda s: self._strategy_allocations.get(
                    self._get_strategy_id_by_name(s.strategy_name), 
                    StrategyAllocation("", 0, 0, 0, 999)
                ).priority
            )
            return [priority_signal]
        
        return signals
    
    def _calculate_position_size(self, strategy_id: str, signal: Signal) -> float:
        """Calculate position size based on strategy allocation and risk limits."""
        if strategy_id not in self._strategy_allocations:
            return 0.0
        
        allocation = self._strategy_allocations[strategy_id]
        
        # Base position size from signal metadata
        signal_position_size = signal.metadata.get('position_size', 0.1)
        
        # Apply strategy allocation limits
        max_position = allocation.max_allocation / signal.price if signal.price > 0 else 0
        allocated_position = max_position * signal_position_size
        
        # Apply risk limits
        risk_position = (allocation.risk_limit * self.total_capital) / signal.price if signal.price > 0 else 0
        
        # Use the smaller of allocation or risk limit
        final_position = min(allocated_position, risk_position)
        
        # Check portfolio-level limits
        current_exposure = sum(abs(pos) for pos in self._portfolio_positions.values())
        max_portfolio_exposure = self.total_capital * self.max_portfolio_risk
        
        if current_exposure + abs(final_position * signal.price) > max_portfolio_exposure:
            # Scale down to fit within portfolio limits
            available_capacity = max_portfolio_exposure - current_exposure
            if available_capacity > 0:
                final_position = min(final_position, available_capacity / signal.price)
            else:
                final_position = 0.0
        
        return max(0.0, final_position)
    
    def _get_strategy_id_by_name(self, strategy_name: str) -> Optional[str]:
        """Get strategy ID by name."""
        for strategy_id, strategy in self._strategies.items():
            if strategy.name == strategy_name:
                return strategy_id
        return None
    
    async def rebalance_portfolio(self) -> None:
        """Rebalance portfolio based on strategy performance."""
        if not self.enable_dynamic_allocation:
            return
        
        current_time = datetime.utcnow()
        
        # Check if rebalancing is due
        if (self._last_rebalance and 
            (current_time - self._last_rebalance).total_seconds() < self.rebalance_frequency * 60):
            return
        
        self._logger.info("Starting portfolio rebalancing...")
        
        try:
            # Calculate performance metrics for each strategy
            performance_scores = {}
            
            for strategy_id in self._strategies:
                if strategy_id not in self._running_strategies:
                    continue
                
                strategy = self._strategies[strategy_id]
                metrics = strategy.get_performance_metrics()
                
                # Calculate performance score (simplified)
                total_return = metrics.get('total_pnl', 0)
                win_rate = metrics.get('win_rate', 0.5)
                sharpe_ratio = metrics.get('sharpe_ratio', 0) or 0
                
                # Combined score
                performance_score = (
                    (total_return / self.total_capital) * 0.4 +  # Return contribution
                    win_rate * 0.3 +  # Win rate
                    max(0, sharpe_ratio / 3) * 0.3  # Risk-adjusted return
                )
                
                performance_scores[strategy_id] = max(0.1, performance_score)  # Minimum score
            
            if not performance_scores:
                return
            
            # Normalize scores to sum to 1.0
            total_score = sum(performance_scores.values())
            if total_score > 0:
                for strategy_id in performance_scores:
                    normalized_score = performance_scores[strategy_id] / total_score
                    
                    # Update performance weight (with dampening)
                    current_weight = self._strategy_allocations[strategy_id].performance_weight
                    new_weight = 0.7 * current_weight + 0.3 * normalized_score  # Smooth adjustment
                    
                    self._strategy_allocations[strategy_id].performance_weight = new_weight
                    
                    self._logger.debug(
                        f"Updated performance weight for {strategy_id}: {new_weight:.3f}"
                    )
            
            self._last_rebalance = current_time
            self._logger.info("Portfolio rebalancing completed")
            
        except Exception as e:
            self._logger.error(f"Error during portfolio rebalancing: {e}")
    
    def calculate_portfolio_risk(self) -> PortfolioRiskMetrics:
        """Calculate comprehensive portfolio risk metrics."""
        total_exposure = sum(abs(pos) for pos in self._portfolio_positions.values())
        
        symbol_exposures = {
            symbol: abs(position) for symbol, position in self._portfolio_positions.items()
        }
        
        strategy_exposures = {}
        for strategy_id, allocation in self._strategy_allocations.items():
            if allocation.is_active:
                strategy_exposures[strategy_id] = allocation.max_allocation
        
        # Calculate concentration risk (Herfindahl index)
        if total_exposure > 0:
            concentration_risk = sum(
                (exposure / total_exposure) ** 2 
                for exposure in symbol_exposures.values()
            )
        else:
            concentration_risk = 0.0
        
        # Simplified correlation risk (would need historical data for proper calculation)
        correlation_risk = 0.5  # Placeholder
        
        # Simplified VaR estimation (would need proper statistical calculation)
        var_estimate = total_exposure * 0.05  # 5% of total exposure as simple estimate
        
        # Calculate max drawdown (simplified)
        portfolio_values = [metrics.get('total_pnl', 0) for metrics in self._strategy_metrics.values()]
        if portfolio_values:
            peak = max(portfolio_values)
            trough = min(portfolio_values)
            max_drawdown = (peak - trough) / peak if peak > 0 else 0
        else:
            max_drawdown = 0.0
        
        self._risk_metrics = PortfolioRiskMetrics(
            total_exposure=total_exposure,
            symbol_exposures=symbol_exposures,
            strategy_exposures=strategy_exposures,
            correlation_risk=correlation_risk,
            concentration_risk=concentration_risk,
            var_estimate=var_estimate,
            max_drawdown=max_drawdown
        )
        
        return self._risk_metrics
    
    def get_enhanced_portfolio_status(self) -> Dict[str, Any]:
        """Get comprehensive portfolio status with multi-strategy coordination info."""
        base_status = self.get_manager_stats()
        
        # Calculate risk metrics
        risk_metrics = self.calculate_portfolio_risk()
        
        # Strategy allocation summary
        allocation_summary = {}
        for strategy_id, allocation in self._strategy_allocations.items():
            strategy_name = self._strategies[strategy_id].name
            allocation_summary[strategy_name] = {
                'weight': allocation.weight,
                'performance_weight': allocation.performance_weight,
                'max_allocation': allocation.max_allocation,
                'risk_limit': allocation.risk_limit,
                'priority': allocation.priority,
                'is_active': allocation.is_active,
            }
        
        # Performance attribution
        attribution_summary = {}
        for strategy_id, contribution in self._performance_attribution.items():
            strategy_name = self._strategies[strategy_id].name
            attribution_summary[strategy_name] = contribution
        
        enhanced_status = {
            **base_status,
            'portfolio_risk_metrics': {
                'total_exposure': risk_metrics.total_exposure,
                'concentration_risk': risk_metrics.concentration_risk,
                'correlation_risk': risk_metrics.correlation_risk,
                'var_estimate': risk_metrics.var_estimate,
                'max_drawdown': risk_metrics.max_drawdown,
            },
            'strategy_allocations': allocation_summary,
            'performance_attribution': attribution_summary,
            'signal_aggregation_method': self.signal_aggregation_method.value,
            'conflict_resolution_mode': self.conflict_resolution_mode.value,
            'last_rebalance': self._last_rebalance.isoformat() if self._last_rebalance else None,
            'pending_signals_count': sum(len(signals) for signals in self._pending_signals.values()),
            'strategy_groups': dict(self._strategy_groups),
        }
        
        return enhanced_status


# Keep backward compatibility
StrategyManager = EnhancedStrategyManager