"""
Broker Health Monitoring System for Pi5 Trading System.

Advanced broker health monitoring with real-time status tracking,
performance metrics, and automated recovery capabilities.

Features:
- Real-time connection monitoring
- Performance metric tracking
- Automated health checks
- Connection recovery
- Alert system integration
- Health history tracking
- Predictive failure detection
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import statistics
import json

from core.interfaces import BrokerInterface
from core.exceptions import BrokerError, BrokerConnectionError
from events.event_bus import EventBus
from events.event_types import BaseEvent


logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Broker health status levels."""
    HEALTHY = "healthy"
    WARNING = "warning"  
    CRITICAL = "critical"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class AlertLevel(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class HealthMetric:
    """Individual health metric tracking."""
    name: str
    value: float
    timestamp: datetime
    threshold_warning: float = 0.0
    threshold_critical: float = 0.0
    unit: str = ""
    
    @property
    def status(self) -> HealthStatus:
        """Determine status based on thresholds."""
        if self.threshold_critical > 0 and self.value >= self.threshold_critical:
            return HealthStatus.CRITICAL
        elif self.threshold_warning > 0 and self.value >= self.threshold_warning:
            return HealthStatus.WARNING
        else:
            return HealthStatus.HEALTHY


@dataclass
class BrokerHealthReport:
    """Comprehensive broker health report."""
    broker_name: str
    overall_status: HealthStatus
    last_check: datetime
    uptime_percent: float
    connection_status: bool
    
    # Performance metrics
    avg_response_time_ms: float = 0.0
    success_rate_percent: float = 100.0
    order_success_rate: float = 100.0
    
    # Error tracking
    consecutive_failures: int = 0
    total_errors: int = 0
    last_error: Optional[str] = None
    last_error_time: Optional[datetime] = None
    
    # Detailed metrics
    metrics: Dict[str, HealthMetric] = field(default_factory=dict)
    
    # Historical data
    uptime_history: List[bool] = field(default_factory=list)
    response_time_history: List[float] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            'broker_name': self.broker_name,
            'overall_status': self.overall_status.value,
            'last_check': self.last_check.isoformat(),
            'uptime_percent': self.uptime_percent,
            'connection_status': self.connection_status,
            'avg_response_time_ms': self.avg_response_time_ms,
            'success_rate_percent': self.success_rate_percent,
            'order_success_rate': self.order_success_rate,
            'consecutive_failures': self.consecutive_failures,
            'total_errors': self.total_errors,
            'last_error': self.last_error,
            'last_error_time': self.last_error_time.isoformat() if self.last_error_time else None,
            'metrics': {name: {
                'value': metric.value,
                'status': metric.status.value,
                'timestamp': metric.timestamp.isoformat(),
                'unit': metric.unit
            } for name, metric in self.metrics.items()}
        }


class BrokerHealthAlert(BaseEvent):
    """Broker health alert event."""
    
    def __init__(
        self,
        broker_name: str,
        alert_level: AlertLevel,
        message: str,
        metric_name: str = None,
        metric_value: float = None
    ):
        super().__init__()
        self.broker_name = broker_name
        self.alert_level = alert_level
        self.message = message
        self.metric_name = metric_name
        self.metric_value = metric_value
    
    def _event_data(self) -> Dict:
        return {
            'broker_name': self.broker_name,
            'alert_level': self.alert_level.value,
            'message': self.message,
            'metric_name': self.metric_name,
            'metric_value': self.metric_value
        }


class BrokerHealthMonitor:
    """
    Advanced broker health monitoring system.
    
    Monitors broker connections, performance, and health metrics
    with automated alerting and recovery capabilities.
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        check_interval_seconds: int = 30,
        history_retention_hours: int = 24,
        enable_predictive_alerts: bool = True,
        auto_recovery_enabled: bool = True
    ):
        """
        Initialize broker health monitor.
        
        Args:
            event_bus: Event bus for publishing alerts
            check_interval_seconds: Health check interval
            history_retention_hours: How long to retain historical data
            enable_predictive_alerts: Enable predictive failure detection
            auto_recovery_enabled: Enable automatic recovery attempts
        """
        self.event_bus = event_bus
        self.check_interval_seconds = check_interval_seconds
        self.history_retention_hours = history_retention_hours
        self.enable_predictive_alerts = enable_predictive_alerts
        self.auto_recovery_enabled = auto_recovery_enabled
        
        # Broker tracking
        self._brokers: Dict[str, BrokerInterface] = {}
        self._health_reports: Dict[str, BrokerHealthReport] = {}
        self._check_tasks: Dict[str, asyncio.Task] = {}
        
        # Alert callbacks
        self._alert_callbacks: List[Callable] = []
        
        # Configuration
        self._thresholds = {
            'response_time_warning_ms': 1000,
            'response_time_critical_ms': 5000,
            'success_rate_warning': 90.0,
            'success_rate_critical': 70.0,
            'consecutive_failures_warning': 3,
            'consecutive_failures_critical': 5,
            'uptime_warning': 95.0,
            'uptime_critical': 85.0
        }
        
        # Monitoring state
        self._is_running = False
        self._global_monitor_task: Optional[asyncio.Task] = None
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def start(self) -> None:
        """Start the health monitoring system."""
        if self._is_running:
            return
        
        self._logger.info("Starting broker health monitoring system...")
        self._is_running = True
        
        # Start global monitoring task
        self._global_monitor_task = asyncio.create_task(self._global_monitor_loop())
        
        self._logger.info("Broker health monitoring system started")
    
    async def stop(self) -> None:
        """Stop the health monitoring system."""
        if not self._is_running:
            return
        
        self._logger.info("Stopping broker health monitoring system...")
        self._is_running = False
        
        # Cancel all monitoring tasks
        if self._global_monitor_task and not self._global_monitor_task.done():
            self._global_monitor_task.cancel()
        
        for task in self._check_tasks.values():
            if not task.done():
                task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self._check_tasks.values(), return_exceptions=True)
        
        self._logger.info("Broker health monitoring system stopped")
    
    def register_broker(self, name: str, broker: BrokerInterface) -> None:
        """Register a broker for health monitoring."""
        self._brokers[name] = broker
        self._health_reports[name] = BrokerHealthReport(
            broker_name=name,
            overall_status=HealthStatus.UNKNOWN,
            last_check=datetime.utcnow(),
            uptime_percent=0.0,
            connection_status=False
        )
        
        # Start monitoring task for this broker
        if self._is_running:
            self._start_broker_monitoring(name)
        
        self._logger.info(f"Registered broker for health monitoring: {name}")
    
    def unregister_broker(self, name: str) -> None:
        """Unregister a broker from health monitoring."""
        if name in self._brokers:
            # Cancel monitoring task
            if name in self._check_tasks:
                self._check_tasks[name].cancel()
                del self._check_tasks[name]
            
            # Remove from tracking
            del self._brokers[name]
            del self._health_reports[name]
            
            self._logger.info(f"Unregistered broker from health monitoring: {name}")
    
    def get_health_report(self, broker_name: str) -> Optional[BrokerHealthReport]:
        """Get health report for specific broker."""
        return self._health_reports.get(broker_name)
    
    def get_all_health_reports(self) -> Dict[str, BrokerHealthReport]:
        """Get health reports for all brokers."""
        return self._health_reports.copy()
    
    def get_healthy_brokers(self) -> List[str]:
        """Get list of currently healthy broker names."""
        return [
            name for name, report in self._health_reports.items()
            if report.overall_status == HealthStatus.HEALTHY
        ]
    
    def get_critical_brokers(self) -> List[str]:
        """Get list of brokers in critical state."""
        return [
            name for name, report in self._health_reports.items()
            if report.overall_status == HealthStatus.CRITICAL
        ]
    
    def add_alert_callback(self, callback: Callable) -> None:
        """Add callback function for health alerts."""
        self._alert_callbacks.append(callback)
    
    def update_thresholds(self, thresholds: Dict[str, float]) -> None:
        """Update health monitoring thresholds."""
        self._thresholds.update(thresholds)
        self._logger.info(f"Updated health monitoring thresholds: {thresholds}")
    
    async def force_health_check(self, broker_name: str = None) -> None:
        """Force immediate health check for broker(s)."""
        if broker_name:
            if broker_name in self._brokers:
                await self._check_broker_health(broker_name)
        else:
            # Check all brokers
            tasks = []
            for name in self._brokers.keys():
                tasks.append(self._check_broker_health(name))
            await asyncio.gather(*tasks, return_exceptions=True)
    
    # Private methods
    
    def _start_broker_monitoring(self, broker_name: str) -> None:
        """Start monitoring task for specific broker."""
        if broker_name in self._check_tasks:
            self._check_tasks[broker_name].cancel()
        
        self._check_tasks[broker_name] = asyncio.create_task(
            self._broker_monitor_loop(broker_name)
        )
    
    async def _global_monitor_loop(self) -> None:
        """Global monitoring loop for system-wide checks."""
        while self._is_running:
            try:
                await asyncio.sleep(self.check_interval_seconds * 2)  # Less frequent than individual checks
                
                # Cleanup old history data
                await self._cleanup_old_data()
                
                # Perform predictive analysis
                if self.enable_predictive_alerts:
                    await self._predictive_failure_analysis()
                
                # Generate summary reports
                await self._generate_summary_alerts()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Global monitor loop error: {e}")
                await asyncio.sleep(60)  # Wait before retrying
    
    async def _broker_monitor_loop(self, broker_name: str) -> None:
        """Individual broker monitoring loop."""
        while self._is_running and broker_name in self._brokers:
            try:
                await self._check_broker_health(broker_name)
                await asyncio.sleep(self.check_interval_seconds)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Broker monitor loop error for {broker_name}: {e}")
                await asyncio.sleep(self.check_interval_seconds)
    
    async def _check_broker_health(self, broker_name: str) -> None:
        """Perform comprehensive health check for broker."""
        broker = self._brokers.get(broker_name)
        report = self._health_reports.get(broker_name)
        
        if not broker or not report:
            return
        
        start_time = datetime.utcnow()
        
        try:
            # Test basic connectivity
            if hasattr(broker, 'get_account_info'):
                account_info = await broker.get_account_info()
                connection_success = account_info is not None
            else:
                connection_success = True  # Assume healthy if no test method
            
            # Calculate response time
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Update metrics
            await self._update_health_metrics(broker_name, {
                'response_time_ms': response_time,
                'connection_success': connection_success
            })
            
            # Update report
            report.last_check = datetime.utcnow()
            report.connection_status = connection_success
            report.avg_response_time_ms = self._calculate_avg_response_time(broker_name, response_time)
            
            if connection_success:
                report.consecutive_failures = 0
                report.uptime_history.append(True)
            else:
                report.consecutive_failures += 1
                report.uptime_history.append(False)
                
                # Attempt auto-recovery if enabled
                if self.auto_recovery_enabled and report.consecutive_failures >= 2:
                    await self._attempt_broker_recovery(broker_name)
            
            # Calculate uptime percentage
            report.uptime_percent = self._calculate_uptime_percent(broker_name)
            
            # Determine overall status
            report.overall_status = self._calculate_overall_status(report)
            
            # Check for alerts
            await self._check_health_alerts(broker_name, report)
            
        except Exception as e:
            # Handle health check failure
            report.consecutive_failures += 1
            report.total_errors += 1
            report.last_error = str(e)
            report.last_error_time = datetime.utcnow()
            report.connection_status = False
            report.uptime_history.append(False)
            report.overall_status = HealthStatus.CRITICAL
            
            await self._send_alert(
                broker_name,
                AlertLevel.ERROR,
                f"Health check failed: {e}"
            )
            
            self._logger.error(f"Health check failed for {broker_name}: {e}")
    
    async def _update_health_metrics(self, broker_name: str, metrics: Dict[str, float]) -> None:
        """Update health metrics for broker."""
        report = self._health_reports.get(broker_name)
        if not report:
            return
        
        timestamp = datetime.utcnow()
        
        for metric_name, value in metrics.items():
            if metric_name == 'response_time_ms':
                report.metrics[metric_name] = HealthMetric(
                    name=metric_name,
                    value=value,
                    timestamp=timestamp,
                    threshold_warning=self._thresholds['response_time_warning_ms'],
                    threshold_critical=self._thresholds['response_time_critical_ms'],
                    unit="ms"
                )
                
                # Update response time history
                report.response_time_history.append(value)
                if len(report.response_time_history) > 100:  # Keep last 100 measurements
                    report.response_time_history.pop(0)
    
    def _calculate_avg_response_time(self, broker_name: str, current_time: float) -> float:
        """Calculate average response time using exponential moving average."""
        report = self._health_reports.get(broker_name)
        if not report:
            return current_time
        
        # Use exponential moving average (alpha = 0.1)
        if report.avg_response_time_ms == 0:
            return current_time
        else:
            return report.avg_response_time_ms * 0.9 + current_time * 0.1
    
    def _calculate_uptime_percent(self, broker_name: str) -> float:
        """Calculate uptime percentage from history."""
        report = self._health_reports.get(broker_name)
        if not report or not report.uptime_history:
            return 0.0
        
        # Keep only recent history (last 24 hours worth)
        max_history_size = (self.history_retention_hours * 3600) // self.check_interval_seconds
        if len(report.uptime_history) > max_history_size:
            report.uptime_history = report.uptime_history[-max_history_size:]
        
        successful_checks = sum(report.uptime_history)
        total_checks = len(report.uptime_history)
        
        return (successful_checks / total_checks) * 100 if total_checks > 0 else 0.0
    
    def _calculate_overall_status(self, report: BrokerHealthReport) -> HealthStatus:
        """Calculate overall health status based on all metrics."""
        if not report.connection_status:
            return HealthStatus.OFFLINE
        
        # Check critical thresholds
        if (report.consecutive_failures >= self._thresholds['consecutive_failures_critical'] or
            report.uptime_percent < self._thresholds['uptime_critical'] or
            report.avg_response_time_ms > self._thresholds['response_time_critical_ms']):
            return HealthStatus.CRITICAL
        
        # Check warning thresholds
        if (report.consecutive_failures >= self._thresholds['consecutive_failures_warning'] or
            report.uptime_percent < self._thresholds['uptime_warning'] or
            report.avg_response_time_ms > self._thresholds['response_time_warning_ms']):
            return HealthStatus.WARNING
        
        return HealthStatus.HEALTHY
    
    async def _check_health_alerts(self, broker_name: str, report: BrokerHealthReport) -> None:
        """Check if any alerts should be triggered."""
        
        # Connection status alert
        if not report.connection_status and report.consecutive_failures >= 3:
            await self._send_alert(
                broker_name,
                AlertLevel.CRITICAL,
                f"Broker offline for {report.consecutive_failures} consecutive checks"
            )
        
        # Response time alerts
        if report.avg_response_time_ms > self._thresholds['response_time_critical_ms']:
            await self._send_alert(
                broker_name,
                AlertLevel.ERROR,
                f"Response time critical: {report.avg_response_time_ms:.1f}ms"
            )
        elif report.avg_response_time_ms > self._thresholds['response_time_warning_ms']:
            await self._send_alert(
                broker_name,
                AlertLevel.WARNING,
                f"Response time high: {report.avg_response_time_ms:.1f}ms"
            )
        
        # Uptime alerts
        if report.uptime_percent < self._thresholds['uptime_critical']:
            await self._send_alert(
                broker_name,
                AlertLevel.ERROR,
                f"Uptime critical: {report.uptime_percent:.1f}%"
            )
        elif report.uptime_percent < self._thresholds['uptime_warning']:
            await self._send_alert(
                broker_name,
                AlertLevel.WARNING,
                f"Uptime low: {report.uptime_percent:.1f}%"
            )
    
    async def _attempt_broker_recovery(self, broker_name: str) -> None:
        """Attempt to recover failed broker connection."""
        broker = self._brokers.get(broker_name)
        if not broker:
            return
        
        try:
            self._logger.info(f"Attempting recovery for broker: {broker_name}")
            
            # Try to reconnect if broker supports it
            if hasattr(broker, 'connect'):
                result = await broker.connect()
                if result:
                    self._logger.info(f"Successfully recovered broker: {broker_name}")
                    await self._send_alert(
                        broker_name,
                        AlertLevel.INFO,
                        "Broker connection recovered automatically"
                    )
                else:
                    self._logger.warning(f"Failed to recover broker: {broker_name}")
            
        except Exception as e:
            self._logger.error(f"Broker recovery failed for {broker_name}: {e}")
    
    async def _send_alert(self, broker_name: str, level: AlertLevel, message: str) -> None:
        """Send health alert."""
        alert = BrokerHealthAlert(
            broker_name=broker_name,
            alert_level=level,
            message=message
        )
        
        # Publish to event bus
        await self.event_bus.publish(alert)
        
        # Call registered callbacks
        for callback in self._alert_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(alert)
                else:
                    callback(alert)
            except Exception as e:
                self._logger.error(f"Alert callback error: {e}")
        
        self._logger.warning(f"BROKER ALERT [{level.value.upper()}] {broker_name}: {message}")
    
    async def _cleanup_old_data(self) -> None:
        """Clean up old historical data."""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.history_retention_hours)
        
        for report in self._health_reports.values():
            # Clean up old metrics
            for metric in report.metrics.values():
                if metric.timestamp < cutoff_time:
                    # Keep metrics but could implement more sophisticated cleanup
                    pass
    
    async def _predictive_failure_analysis(self) -> None:
        """Perform predictive failure analysis."""
        if not self.enable_predictive_alerts:
            return
        
        for broker_name, report in self._health_reports.items():
            # Analyze response time trends
            if len(report.response_time_history) >= 10:
                recent_times = report.response_time_history[-10:]
                if len(recent_times) >= 5:
                    # Check for increasing trend
                    slope = self._calculate_trend_slope(recent_times)
                    if slope > 50:  # Response time increasing by >50ms per check
                        await self._send_alert(
                            broker_name,
                            AlertLevel.WARNING,
                            f"Response time trending upward (slope: {slope:.1f}ms/check)"
                        )
    
    def _calculate_trend_slope(self, values: List[float]) -> float:
        """Calculate trend slope using linear regression."""
        if len(values) < 2:
            return 0.0
        
        n = len(values)
        x = list(range(n))
        y = values
        
        # Simple linear regression slope calculation
        sum_xy = sum(x[i] * y[i] for i in range(n))
        sum_x = sum(x)
        sum_y = sum(y)
        sum_x2 = sum(x[i] ** 2 for i in range(n))
        
        denominator = n * sum_x2 - sum_x ** 2
        if denominator == 0:
            return 0.0
        
        slope = (n * sum_xy - sum_x * sum_y) / denominator
        return slope
    
    async def _generate_summary_alerts(self) -> None:
        """Generate summary alerts for overall system health."""
        total_brokers = len(self._brokers)
        healthy_brokers = len(self.get_healthy_brokers())
        critical_brokers = len(self.get_critical_brokers())
        
        if total_brokers > 0:
            health_ratio = healthy_brokers / total_brokers
            
            if health_ratio < 0.5:  # Less than 50% healthy
                await self._send_alert(
                    "SYSTEM",
                    AlertLevel.CRITICAL,
                    f"System health critical: {healthy_brokers}/{total_brokers} brokers healthy"
                )
            elif health_ratio < 0.8:  # Less than 80% healthy
                await self._send_alert(
                    "SYSTEM",
                    AlertLevel.WARNING,
                    f"System health degraded: {healthy_brokers}/{total_brokers} brokers healthy"
                )
    
    def get_system_health_summary(self) -> Dict:
        """Get overall system health summary."""
        total_brokers = len(self._brokers)
        healthy_brokers = len(self.get_healthy_brokers())
        critical_brokers = len(self.get_critical_brokers())
        
        avg_uptime = 0.0
        avg_response_time = 0.0
        
        if self._health_reports:
            uptimes = [r.uptime_percent for r in self._health_reports.values()]
            response_times = [r.avg_response_time_ms for r in self._health_reports.values()]
            
            avg_uptime = statistics.mean(uptimes) if uptimes else 0.0
            avg_response_time = statistics.mean(response_times) if response_times else 0.0
        
        return {
            'total_brokers': total_brokers,
            'healthy_brokers': healthy_brokers,
            'critical_brokers': critical_brokers,
            'system_health_percent': (healthy_brokers / total_brokers * 100) if total_brokers > 0 else 0,
            'avg_uptime_percent': avg_uptime,
            'avg_response_time_ms': avg_response_time,
            'monitoring_active': self._is_running,
            'last_update': datetime.utcnow().isoformat()
        }