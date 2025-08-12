"""
Event bus implementation for Pi5 Trading System.

Provides async event processing, queuing, and routing for the event-driven
architecture. Handles high-throughput event processing with backpressure
management and error recovery.

Features:
- Async event processing with asyncio
- Multiple event handler registration
- Event queuing with backpressure management
- Error handling and retry mechanisms
- Event persistence for audit and replay
- Performance monitoring and metrics
- Graceful shutdown with event preservation
"""

import asyncio
import logging
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Set, Type

from core.interfaces import BaseEvent, EventHandler
from core.exceptions import (
    EventProcessingError,
    EventQueueFullError,
    SystemError,
)


logger = logging.getLogger(__name__)


class EventBus:
    """
    Async event bus for system-wide event processing and routing.
    
    Provides high-performance event processing with queuing, error handling,
    and monitoring for the event-driven trading system architecture.
    """
    
    def __init__(
        self,
        max_queue_size: int = 10000,
        max_concurrent_handlers: int = 100,
        handler_timeout: float = 30.0,
        retry_attempts: int = 3,
        retry_delay: float = 1.0,
        persistence_enabled: bool = True,
    ):
        """
        Initialize event bus.
        
        Args:
            max_queue_size: Maximum events in queue before backpressure
            max_concurrent_handlers: Max concurrent event handlers
            handler_timeout: Handler execution timeout in seconds
            retry_attempts: Number of retry attempts for failed handlers
            retry_delay: Delay between retries in seconds
            persistence_enabled: Whether to persist events for audit
        """
        self.max_queue_size = max_queue_size
        self.max_concurrent_handlers = max_concurrent_handlers
        self.handler_timeout = handler_timeout
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
        self.persistence_enabled = persistence_enabled
        
        # Event processing state
        self._event_queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._global_handlers: List[EventHandler] = []
        self._is_running = False
        self._processing_tasks: List[asyncio.Task] = []
        self._handler_semaphore = asyncio.Semaphore(max_concurrent_handlers)
        
        # Metrics and monitoring
        self._stats = {
            'events_published': 0,
            'events_processed': 0,
            'events_failed': 0,
            'handlers_executed': 0,
            'handlers_failed': 0,
            'average_processing_time': 0.0,
            'queue_size': 0,
            'start_time': None,
        }
        
        # Error tracking
        self._failed_events: deque = deque(maxlen=1000)  # Keep last 1000 failures
        self._processing_times: deque = deque(maxlen=1000)  # For average calculation
        
        # Event persistence
        self._event_history: deque = deque(maxlen=10000) if persistence_enabled else None
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the event bus and processing workers."""
        if self._is_running:
            return
        
        self._logger.info("Starting event bus...")
        self._is_running = True
        self._stats['start_time'] = datetime.utcnow()
        
        # Start event processing workers
        worker_count = min(4, self.max_concurrent_handlers // 10) or 1
        for i in range(worker_count):
            task = asyncio.create_task(self._event_processor_worker(f"worker-{i}"))
            self._processing_tasks.append(task)
        
        # Start monitoring task
        monitor_task = asyncio.create_task(self._monitor_worker())
        self._processing_tasks.append(monitor_task)
        
        self._logger.info(f"Event bus started with {worker_count} processing workers")
    
    async def stop(self, timeout: float = 30.0) -> None:
        """Stop the event bus gracefully."""
        if not self._is_running:
            return
        
        self._logger.info("Stopping event bus...")
        self._is_running = False
        
        # Wait for current events to be processed
        try:
            await asyncio.wait_for(self._event_queue.join(), timeout=timeout)
        except asyncio.TimeoutError:
            self._logger.warning(f"Event queue did not drain within {timeout}s timeout")
        
        # Cancel processing tasks
        for task in self._processing_tasks:
            if not task.done():
                task.cancel()
        
        # Wait for tasks to complete
        if self._processing_tasks:
            await asyncio.gather(*self._processing_tasks, return_exceptions=True)
        
        self._processing_tasks.clear()
        self._logger.info("Event bus stopped")
    
    async def publish(self, event: BaseEvent) -> None:
        """
        Publish event to the bus.
        
        Args:
            event: Event to publish
            
        Raises:
            EventQueueFullError: If event queue is at capacity
            SystemError: If event bus is not running
        """
        if not self._is_running:
            raise SystemError("Event bus is not running")
        
        # Set correlation ID if not already set
        if not event.correlation_id:
            event.correlation_id = str(uuid.uuid4())
        
        try:
            # Non-blocking put with immediate check for full queue
            self._event_queue.put_nowait(event)
            self._stats['events_published'] += 1
            
            # Store in history for audit
            if self._event_history is not None:
                self._event_history.append({
                    'event_id': event.event_id,
                    'event_type': event.event_type,
                    'timestamp': event.timestamp,
                    'correlation_id': event.correlation_id,
                })
            
            self._logger.debug(
                f"Published event {event.event_type} (ID: {event.event_id[:8]})"
            )
            
        except asyncio.QueueFull:
            self._logger.error(f"Event queue is full (size: {self.max_queue_size})")
            raise EventQueueFullError(
                "Event queue is at capacity",
                context={'queue_size': self.max_queue_size, 'event_type': event.event_type}
            )
    
    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """
        Subscribe handler to specific event type.
        
        Args:
            event_type: Event type to subscribe to
            handler: Event handler instance
        """
        self._handlers[event_type].append(handler)
        self._logger.info(
            f"Subscribed {handler.__class__.__name__} to {event_type} events"
        )
    
    def subscribe_all(self, handler: EventHandler) -> None:
        """
        Subscribe handler to all events (global handler).
        
        Args:
            handler: Event handler instance
        """
        self._global_handlers.append(handler)
        self._logger.info(
            f"Subscribed {handler.__class__.__name__} as global handler"
        )
    
    def unsubscribe(self, event_type: str, handler: EventHandler) -> bool:
        """
        Unsubscribe handler from event type.
        
        Args:
            event_type: Event type to unsubscribe from
            handler: Event handler instance
            
        Returns:
            True if handler was found and removed
        """
        try:
            self._handlers[event_type].remove(handler)
            self._logger.info(
                f"Unsubscribed {handler.__class__.__name__} from {event_type} events"
            )
            return True
        except ValueError:
            return False
    
    def unsubscribe_all(self, handler: EventHandler) -> bool:
        """
        Unsubscribe global handler.
        
        Args:
            handler: Event handler instance
            
        Returns:
            True if handler was found and removed
        """
        try:
            self._global_handlers.remove(handler)
            self._logger.info(
                f"Unsubscribed {handler.__class__.__name__} from global events"
            )
            return True
        except ValueError:
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get event bus statistics."""
        current_time = datetime.utcnow()
        uptime = (current_time - self._stats['start_time']).total_seconds() if self._stats['start_time'] else 0
        
        return {
            **self._stats,
            'queue_size': self._event_queue.qsize(),
            'is_running': self._is_running,
            'uptime_seconds': uptime,
            'events_per_second': self._stats['events_processed'] / uptime if uptime > 0 else 0,
            'handler_count': sum(len(handlers) for handlers in self._handlers.values()),
            'global_handler_count': len(self._global_handlers),
            'recent_failures': len(self._failed_events),
        }
    
    def get_recent_failures(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent event processing failures."""
        return list(self._failed_events)[-limit:]
    
    def get_event_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent event history."""
        if self._event_history is None:
            return []
        return list(self._event_history)[-limit:]
    
    async def _event_processor_worker(self, worker_id: str) -> None:
        """Event processing worker coroutine."""
        self._logger.debug(f"Started event processor worker: {worker_id}")
        
        while self._is_running:
            try:
                # Get event from queue with timeout
                try:
                    event = await asyncio.wait_for(
                        self._event_queue.get(), 
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Process the event
                start_time = time.time()
                success = await self._process_event(event)
                processing_time = time.time() - start_time
                
                # Update statistics
                self._stats['events_processed'] += 1
                self._processing_times.append(processing_time)
                
                # Update average processing time
                if self._processing_times:
                    self._stats['average_processing_time'] = sum(self._processing_times) / len(self._processing_times)
                
                if not success:
                    self._stats['events_failed'] += 1
                
                # Mark task as done
                self._event_queue.task_done()
                
                self._logger.debug(
                    f"Worker {worker_id} processed {event.event_type} "
                    f"in {processing_time:.3f}s (success: {success})"
                )
                
            except Exception as e:
                self._logger.error(f"Event processor worker {worker_id} error: {e}")
                # Mark task as done even on error to prevent queue blocking
                try:
                    self._event_queue.task_done()
                except ValueError:
                    pass  # task_done() called more than once
        
        self._logger.debug(f"Event processor worker {worker_id} stopped")
    
    async def _process_event(self, event: BaseEvent) -> bool:
        """
        Process a single event with all relevant handlers.
        
        Args:
            event: Event to process
            
        Returns:
            True if all handlers succeeded, False otherwise
        """
        event_type = event.event_type
        handlers_to_run = []
        
        # Collect specific handlers for this event type
        if event_type in self._handlers:
            handlers_to_run.extend(self._handlers[event_type])
        
        # Add global handlers
        handlers_to_run.extend(self._global_handlers)
        
        if not handlers_to_run:
            self._logger.debug(f"No handlers for event type: {event_type}")
            return True
        
        # Filter handlers that can handle this event
        capable_handlers = [
            handler for handler in handlers_to_run
            if handler.can_handle(event_type)
        ]
        
        if not capable_handlers:
            self._logger.debug(
                f"No capable handlers for event type: {event_type} "
                f"({len(handlers_to_run)} registered handlers)"
            )
            return True
        
        # Execute handlers concurrently with semaphore control
        handler_tasks = [
            self._execute_handler_with_retry(handler, event)
            for handler in capable_handlers
        ]
        
        results = await asyncio.gather(*handler_tasks, return_exceptions=True)
        
        # Check results and log failures
        success_count = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                handler = capable_handlers[i]
                self._logger.error(
                    f"Handler {handler.__class__.__name__} failed for event "
                    f"{event_type}: {result}"
                )
                self._record_handler_failure(event, handler, result)
            else:
                success_count += 1
        
        total_handlers = len(capable_handlers)
        self._stats['handlers_executed'] += total_handlers
        self._stats['handlers_failed'] += (total_handlers - success_count)
        
        return success_count == total_handlers
    
    async def _execute_handler_with_retry(
        self, 
        handler: EventHandler, 
        event: BaseEvent
    ) -> None:
        """Execute handler with retry logic."""
        async with self._handler_semaphore:
            last_exception = None
            
            for attempt in range(self.retry_attempts):
                try:
                    await asyncio.wait_for(
                        handler.handle(event), 
                        timeout=self.handler_timeout
                    )
                    # Success, return immediately
                    return
                    
                except asyncio.TimeoutError as e:
                    last_exception = e
                    self._logger.warning(
                        f"Handler {handler.__class__.__name__} timed out "
                        f"(attempt {attempt + 1}/{self.retry_attempts})"
                    )
                    
                except Exception as e:
                    last_exception = e
                    self._logger.warning(
                        f"Handler {handler.__class__.__name__} failed "
                        f"(attempt {attempt + 1}/{self.retry_attempts}): {e}"
                    )
                
                # Wait before retry (except on last attempt)
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
            
            # All retries failed
            raise EventProcessingError(
                f"Handler {handler.__class__.__name__} failed after "
                f"{self.retry_attempts} attempts: {last_exception}",
                context={
                    'handler_class': handler.__class__.__name__,
                    'event_type': event.event_type,
                    'event_id': event.event_id,
                }
            ) from last_exception
    
    def _record_handler_failure(
        self, 
        event: BaseEvent, 
        handler: EventHandler, 
        exception: Exception
    ) -> None:
        """Record handler failure for monitoring."""
        failure_record = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_id': event.event_id,
            'event_type': event.event_type,
            'handler_class': handler.__class__.__name__,
            'exception_type': type(exception).__name__,
            'exception_message': str(exception),
            'correlation_id': event.correlation_id,
        }
        
        self._failed_events.append(failure_record)
    
    async def _monitor_worker(self) -> None:
        """Background monitoring worker."""
        self._logger.debug("Started event bus monitor worker")
        
        while self._is_running:
            try:
                await asyncio.sleep(30.0)  # Monitor every 30 seconds
                
                stats = self.get_stats()
                queue_size = stats['queue_size']
                
                # Log statistics
                self._logger.info(
                    f"Event bus stats - Processed: {stats['events_processed']}, "
                    f"Queue: {queue_size}, Failed: {stats['events_failed']}, "
                    f"Avg time: {stats['average_processing_time']:.3f}s"
                )
                
                # Check for concerning conditions
                if queue_size > self.max_queue_size * 0.8:
                    self._logger.warning(
                        f"Event queue is {queue_size / self.max_queue_size:.1%} full "
                        f"({queue_size}/{self.max_queue_size})"
                    )
                
                failure_rate = (stats['events_failed'] / max(stats['events_processed'], 1))
                if failure_rate > 0.1:  # More than 10% failure rate
                    self._logger.warning(
                        f"High event processing failure rate: {failure_rate:.1%}"
                    )
                
            except Exception as e:
                self._logger.error(f"Event bus monitor error: {e}")
        
        self._logger.debug("Event bus monitor worker stopped")
    
    @asynccontextmanager
    async def batch_publish(self, max_batch_size: int = 100):
        """
        Context manager for efficient batch event publishing.
        
        Args:
            max_batch_size: Maximum events to batch before auto-flush
            
        Usage:
            async with event_bus.batch_publish() as batch:
                for event in events:
                    await batch.add(event)
        """
        batch = _BatchPublisher(self, max_batch_size)
        try:
            yield batch
        finally:
            await batch.flush()


class _BatchPublisher:
    """Internal batch publisher for efficient bulk event publishing."""
    
    def __init__(self, event_bus: EventBus, max_batch_size: int):
        self.event_bus = event_bus
        self.max_batch_size = max_batch_size
        self.batch: List[BaseEvent] = []
    
    async def add(self, event: BaseEvent) -> None:
        """Add event to batch."""
        self.batch.append(event)
        
        # Auto-flush if batch is full
        if len(self.batch) >= self.max_batch_size:
            await self.flush()
    
    async def flush(self) -> None:
        """Flush current batch to event bus."""
        if not self.batch:
            return
        
        # Publish all events in batch
        for event in self.batch:
            await self.event_bus.publish(event)
        
        self.batch.clear()