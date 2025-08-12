"""
Event router implementation for Pi5 Trading System.

Provides intelligent event routing with rules, filtering, and transformation
capabilities. Enables complex event processing workflows and conditional
routing based on event content and system state.

Features:
- Rule-based event routing with flexible conditions
- Event filtering and transformation pipelines
- Conditional routing based on event content and context
- Event enrichment and metadata injection
- Priority-based routing for critical events
- Circuit breaker pattern for failing routes
- Routing metrics and monitoring
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Set, Union
from enum import Enum

from core.interfaces import BaseEvent, EventHandler
from core.exceptions import EventProcessingError


logger = logging.getLogger(__name__)


class RouteCondition(Enum):
    """Event routing condition types."""
    ALWAYS = "always"
    EVENT_TYPE = "event_type" 
    SYMBOL = "symbol"
    STRATEGY = "strategy"
    CUSTOM = "custom"
    TIME_WINDOW = "time_window"
    METADATA = "metadata"


class RoutePriority(Enum):
    """Route priority levels."""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class RouteRule:
    """Event routing rule definition."""
    
    rule_id: str
    name: str
    condition: RouteCondition
    condition_value: Any
    target_handlers: List[str]
    priority: RoutePriority = RoutePriority.NORMAL
    is_enabled: bool = True
    
    # Advanced options
    transform_function: Optional[Callable] = None
    filter_function: Optional[Callable] = None
    max_retries: int = 3
    timeout_seconds: float = 30.0
    
    # Circuit breaker settings
    failure_threshold: int = 5
    recovery_timeout: int = 60
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    description: str = ""
    
    def __post_init__(self):
        """Validate rule configuration."""
        if not self.rule_id:
            raise ValueError("Rule ID cannot be empty")
        if not self.target_handlers:
            raise ValueError("At least one target handler must be specified")


class EventRouter:
    """
    Intelligent event router with rule-based routing and circuit breaker protection.
    
    Provides flexible event routing capabilities with conditional logic,
    transformation, filtering, and error resilience.
    """
    
    def __init__(self, enable_circuit_breaker: bool = True):
        """
        Initialize event router.
        
        Args:
            enable_circuit_breaker: Enable circuit breaker protection
        """
        self.enable_circuit_breaker = enable_circuit_breaker
        
        # Routing configuration
        self._rules: Dict[str, RouteRule] = {}
        self._handlers: Dict[str, EventHandler] = {}
        self._route_priorities = sorted(RoutePriority, key=lambda x: x.value, reverse=True)
        
        # Circuit breaker state
        self._circuit_breaker_state: Dict[str, Dict[str, Any]] = {}
        
        # Statistics and monitoring
        self._stats = {
            'events_routed': 0,
            'events_filtered': 0,
            'events_transformed': 0,
            'routing_errors': 0,
            'rules_matched': 0,
            'circuit_breaker_trips': 0,
        }
        
        # Route performance tracking
        self._route_performance: Dict[str, Dict[str, Any]] = {}
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    def add_rule(self, rule: RouteRule) -> None:
        """
        Add routing rule.
        
        Args:
            rule: Routing rule configuration
        """
        self._rules[rule.rule_id] = rule
        
        # Initialize circuit breaker state
        if self.enable_circuit_breaker:
            self._circuit_breaker_state[rule.rule_id] = {
                'state': 'closed',  # closed, open, half_open
                'failure_count': 0,
                'last_failure_time': None,
                'success_count': 0,
            }
        
        # Initialize performance tracking
        self._route_performance[rule.rule_id] = {
            'executions': 0,
            'successes': 0,
            'failures': 0,
            'avg_execution_time': 0.0,
            'last_execution': None,
        }
        
        self._logger.info(f"Added routing rule: {rule.name} (ID: {rule.rule_id})")
    
    def remove_rule(self, rule_id: str) -> bool:
        """
        Remove routing rule.
        
        Args:
            rule_id: Rule identifier
            
        Returns:
            True if rule was found and removed
        """
        if rule_id in self._rules:
            del self._rules[rule_id]
            self._circuit_breaker_state.pop(rule_id, None)
            self._route_performance.pop(rule_id, None)
            self._logger.info(f"Removed routing rule: {rule_id}")
            return True
        return False
    
    def register_handler(self, handler_id: str, handler: EventHandler) -> None:
        """
        Register event handler.
        
        Args:
            handler_id: Handler identifier
            handler: Event handler instance
        """
        self._handlers[handler_id] = handler
        self._logger.info(f"Registered handler: {handler_id}")
    
    def unregister_handler(self, handler_id: str) -> bool:
        """
        Unregister event handler.
        
        Args:
            handler_id: Handler identifier
            
        Returns:
            True if handler was found and removed
        """
        if handler_id in self._handlers:
            del self._handlers[handler_id]
            self._logger.info(f"Unregistered handler: {handler_id}")
            return True
        return False
    
    async def route_event(self, event: BaseEvent) -> List[str]:
        """
        Route event through matching rules.
        
        Args:
            event: Event to route
            
        Returns:
            List of rule IDs that processed the event
        """
        executed_rules = []
        
        # Get matching rules ordered by priority
        matching_rules = self._get_matching_rules(event)
        
        if not matching_rules:
            self._logger.debug(f"No routing rules matched for event: {event.event_type}")
            return executed_rules
        
        self._logger.debug(
            f"Found {len(matching_rules)} matching rules for event {event.event_type}"
        )
        
        # Process rules in priority order
        for rule in matching_rules:
            try:
                success = await self._execute_rule(rule, event)
                if success:
                    executed_rules.append(rule.rule_id)
                    self._stats['rules_matched'] += 1
                
            except Exception as e:
                self._logger.error(f"Error executing rule {rule.rule_id}: {e}")
                self._stats['routing_errors'] += 1
                self._record_rule_failure(rule.rule_id, e)
        
        self._stats['events_routed'] += 1
        return executed_rules
    
    def _get_matching_rules(self, event: BaseEvent) -> List[RouteRule]:
        """Get rules that match the event, ordered by priority."""
        matching_rules = []
        
        for rule in self._rules.values():
            if not rule.is_enabled:
                continue
            
            # Check circuit breaker state
            if self.enable_circuit_breaker and not self._is_rule_available(rule.rule_id):
                continue
            
            # Check if rule matches event
            if self._rule_matches_event(rule, event):
                matching_rules.append(rule)
        
        # Sort by priority (highest first)
        matching_rules.sort(key=lambda r: r.priority.value, reverse=True)
        return matching_rules
    
    def _rule_matches_event(self, rule: RouteRule, event: BaseEvent) -> bool:
        """Check if rule matches event based on condition."""
        try:
            condition = rule.condition
            condition_value = rule.condition_value
            
            if condition == RouteCondition.ALWAYS:
                return True
            
            elif condition == RouteCondition.EVENT_TYPE:
                return event.event_type == condition_value
            
            elif condition == RouteCondition.SYMBOL:
                # Check if event has symbol attribute
                if hasattr(event, 'symbol'):
                    if isinstance(condition_value, (list, set)):
                        return event.symbol in condition_value
                    return event.symbol == condition_value
                return False
            
            elif condition == RouteCondition.STRATEGY:
                # Check if event has strategy_name attribute
                if hasattr(event, 'strategy_name'):
                    if isinstance(condition_value, (list, set)):
                        return event.strategy_name in condition_value
                    return event.strategy_name == condition_value
                return False
            
            elif condition == RouteCondition.TIME_WINDOW:
                # Time window format: {'start': 'HH:MM', 'end': 'HH:MM'}
                if isinstance(condition_value, dict):
                    current_time = datetime.now().time()
                    start_time = datetime.strptime(condition_value['start'], '%H:%M').time()
                    end_time = datetime.strptime(condition_value['end'], '%H:%M').time()
                    
                    if start_time <= end_time:
                        return start_time <= current_time <= end_time
                    else:
                        # Handle overnight window (e.g., 22:00 to 06:00)
                        return current_time >= start_time or current_time <= end_time
                return False
            
            elif condition == RouteCondition.METADATA:
                # Metadata condition format: {'key': 'value'} or {'key': ['val1', 'val2']}
                if isinstance(condition_value, dict):
                    for key, expected_value in condition_value.items():
                        event_value = event.metadata.get(key)
                        if isinstance(expected_value, (list, set)):
                            if event_value not in expected_value:
                                return False
                        elif event_value != expected_value:
                            return False
                    return True
                return False
            
            elif condition == RouteCondition.CUSTOM:
                # Custom condition function
                if callable(condition_value):
                    return condition_value(event)
                return False
            
            else:
                self._logger.warning(f"Unknown condition type: {condition}")
                return False
                
        except Exception as e:
            self._logger.error(f"Error evaluating rule condition {rule.rule_id}: {e}")
            return False
    
    async def _execute_rule(self, rule: RouteRule, event: BaseEvent) -> bool:
        """Execute rule with circuit breaker protection."""
        rule_id = rule.rule_id
        start_time = datetime.utcnow()
        
        try:
            # Apply filter if configured
            if rule.filter_function and not rule.filter_function(event):
                self._stats['events_filtered'] += 1
                self._logger.debug(f"Event filtered by rule {rule_id}")
                return False
            
            # Apply transformation if configured
            processed_event = event
            if rule.transform_function:
                processed_event = rule.transform_function(event)
                self._stats['events_transformed'] += 1
                self._logger.debug(f"Event transformed by rule {rule_id}")
            
            # Route to target handlers
            success_count = 0
            for handler_id in rule.target_handlers:
                if handler_id not in self._handlers:
                    self._logger.warning(f"Handler {handler_id} not found for rule {rule_id}")
                    continue
                
                handler = self._handlers[handler_id]
                
                # Check if handler can process this event type
                if not handler.can_handle(processed_event.event_type):
                    continue
                
                # Execute handler with timeout
                try:
                    await asyncio.wait_for(
                        handler.handle(processed_event),
                        timeout=rule.timeout_seconds
                    )
                    success_count += 1
                    
                except asyncio.TimeoutError:
                    self._logger.warning(
                        f"Handler {handler_id} timed out for rule {rule_id}"
                    )
                except Exception as e:
                    self._logger.error(
                        f"Handler {handler_id} failed for rule {rule_id}: {e}"
                    )
            
            # Update performance metrics
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            self._update_rule_performance(rule_id, execution_time, success_count > 0)
            
            # Update circuit breaker state
            if self.enable_circuit_breaker:
                if success_count > 0:
                    self._record_rule_success(rule_id)
                else:
                    self._record_rule_failure(rule_id, Exception("No handlers succeeded"))
            
            return success_count > 0
            
        except Exception as e:
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            self._update_rule_performance(rule_id, execution_time, False)
            
            if self.enable_circuit_breaker:
                self._record_rule_failure(rule_id, e)
            
            raise EventProcessingError(
                f"Rule execution failed: {e}",
                context={'rule_id': rule_id, 'event_type': event.event_type}
            ) from e
    
    def _is_rule_available(self, rule_id: str) -> bool:
        """Check if rule is available (circuit breaker state)."""
        if not self.enable_circuit_breaker:
            return True
        
        state = self._circuit_breaker_state.get(rule_id)
        if not state:
            return True
        
        current_time = datetime.utcnow()
        
        if state['state'] == 'closed':
            return True
        elif state['state'] == 'open':
            # Check if recovery timeout has passed
            rule = self._rules.get(rule_id)
            if not rule:
                return False
            
            if (state['last_failure_time'] and 
                current_time - state['last_failure_time'] > timedelta(seconds=rule.recovery_timeout)):
                # Transition to half-open
                state['state'] = 'half_open'
                state['success_count'] = 0
                self._logger.info(f"Circuit breaker for rule {rule_id} transitioned to half-open")
                return True
            return False
        elif state['state'] == 'half_open':
            return True
        
        return False
    
    def _record_rule_success(self, rule_id: str) -> None:
        """Record successful rule execution."""
        state = self._circuit_breaker_state.get(rule_id)
        if not state:
            return
        
        if state['state'] == 'half_open':
            state['success_count'] += 1
            # If we have 3 consecutive successes, close the circuit
            if state['success_count'] >= 3:
                state['state'] = 'closed'
                state['failure_count'] = 0
                self._logger.info(f"Circuit breaker for rule {rule_id} closed after recovery")
        
        # Reset failure count on success
        if state['state'] == 'closed':
            state['failure_count'] = 0
    
    def _record_rule_failure(self, rule_id: str, exception: Exception) -> None:
        """Record failed rule execution."""
        if not self.enable_circuit_breaker:
            return
        
        state = self._circuit_breaker_state.get(rule_id)
        rule = self._rules.get(rule_id)
        if not state or not rule:
            return
        
        current_time = datetime.utcnow()
        state['failure_count'] += 1
        state['last_failure_time'] = current_time
        
        # Check if we should trip the circuit breaker
        if (state['state'] in ['closed', 'half_open'] and 
            state['failure_count'] >= rule.failure_threshold):
            state['state'] = 'open'
            self._stats['circuit_breaker_trips'] += 1
            self._logger.warning(
                f"Circuit breaker tripped for rule {rule_id} after "
                f"{state['failure_count']} failures"
            )
    
    def _update_rule_performance(
        self, 
        rule_id: str, 
        execution_time: float, 
        success: bool
    ) -> None:
        """Update rule performance metrics."""
        perf = self._route_performance.get(rule_id)
        if not perf:
            return
        
        perf['executions'] += 1
        perf['last_execution'] = datetime.utcnow()
        
        if success:
            perf['successes'] += 1
        else:
            perf['failures'] += 1
        
        # Update average execution time (exponential moving average)
        if perf['avg_execution_time'] == 0:
            perf['avg_execution_time'] = execution_time
        else:
            perf['avg_execution_time'] = (
                0.9 * perf['avg_execution_time'] + 0.1 * execution_time
            )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get router statistics."""
        return {
            **self._stats,
            'active_rules': sum(1 for r in self._rules.values() if r.is_enabled),
            'total_rules': len(self._rules),
            'registered_handlers': len(self._handlers),
            'circuit_breaker_enabled': self.enable_circuit_breaker,
        }
    
    def get_rule_performance(self, rule_id: Optional[str] = None) -> Dict[str, Any]:
        """Get performance metrics for rules."""
        if rule_id:
            return self._route_performance.get(rule_id, {})
        return dict(self._route_performance)
    
    def get_circuit_breaker_status(self) -> Dict[str, Dict[str, Any]]:
        """Get circuit breaker status for all rules."""
        if not self.enable_circuit_breaker:
            return {}
        
        status = {}
        for rule_id, state in self._circuit_breaker_state.items():
            rule = self._rules.get(rule_id)
            status[rule_id] = {
                'rule_name': rule.name if rule else 'Unknown',
                'state': state['state'],
                'failure_count': state['failure_count'],
                'last_failure_time': state['last_failure_time'].isoformat() if state['last_failure_time'] else None,
                'is_available': self._is_rule_available(rule_id),
            }
        
        return status
    
    def reset_circuit_breaker(self, rule_id: str) -> bool:
        """
        Manually reset circuit breaker for a rule.
        
        Args:
            rule_id: Rule identifier
            
        Returns:
            True if circuit breaker was reset
        """
        if not self.enable_circuit_breaker:
            return False
        
        state = self._circuit_breaker_state.get(rule_id)
        if state:
            state['state'] = 'closed'
            state['failure_count'] = 0
            state['last_failure_time'] = None
            state['success_count'] = 0
            self._logger.info(f"Circuit breaker manually reset for rule {rule_id}")
            return True
        
        return False