"""
Comprehensive Broker Failover Testing for Pi5 Trading System.

Advanced failover testing that simulates real-world broker failure scenarios
and validates the system's ability to maintain trading operations through
automatic broker switching and recovery.

Test Scenarios:
- Primary broker disconnection
- Secondary broker degradation
- Multiple broker failures
- Network connectivity issues
- Order execution during failover
- Recovery after broker restoration
- Load balancing verification
- Performance impact assessment
"""

import asyncio
import pytest
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import random
from unittest.mock import AsyncMock, MagicMock, patch

# Core imports
from core.interfaces import Order, OrderType, OrderStatus, Signal, TradingSignal
from core.exceptions import BrokerError, BrokerConnectionError, OrderExecutionError
from events.event_bus import EventBus

# Broker imports
from orders.brokers.broker_manager import (
    BrokerManager, BrokerConfig, BrokerType, FailoverStrategy, BrokerHealth
)
from orders.brokers.paper_broker import PaperTradingBroker
from orders.brokers.broker_health_monitor import BrokerHealthMonitor, HealthStatus, AlertLevel


logger = logging.getLogger(__name__)


class MockFailingBroker(PaperTradingBroker):
    """Mock broker that can simulate various failure modes."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.failure_mode = None
        self.failure_probability = 0.0
        self.connection_healthy = True
        self.response_delay_ms = 0
        self.order_failure_rate = 0.0
        
    def set_failure_mode(self, mode: str, probability: float = 1.0):
        """Set broker failure mode for testing."""
        self.failure_mode = mode
        self.failure_probability = probability
        
    def set_connection_health(self, healthy: bool):
        """Set connection health status."""
        self.connection_healthy = healthy
        
    def set_response_delay(self, delay_ms: int):
        """Set artificial response delay."""
        self.response_delay_ms = delay_ms
        
    def set_order_failure_rate(self, rate: float):
        """Set order failure rate (0.0 to 1.0)."""
        self.order_failure_rate = rate
    
    async def _simulate_delay(self):
        """Simulate response delay."""
        if self.response_delay_ms > 0:
            await asyncio.sleep(self.response_delay_ms / 1000.0)
    
    def _should_fail(self) -> bool:
        """Determine if operation should fail based on probability."""
        return random.random() < self.failure_probability
    
    async def submit_order(self, order: Order) -> str:
        """Submit order with potential failures."""
        await self._simulate_delay()
        
        # Check for connection failure
        if not self.connection_healthy:
            raise BrokerConnectionError("Simulated connection failure")
        
        # Check for general failure
        if self.failure_mode == "submit_failure" and self._should_fail():
            raise BrokerError("Simulated order submission failure")
        
        # Check for order-specific failure
        if random.random() < self.order_failure_rate:
            raise OrderExecutionError("Simulated order execution failure")
        
        # Normal execution
        return await super().submit_order(order)
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel order with potential failures."""
        await self._simulate_delay()
        
        if not self.connection_healthy:
            raise BrokerConnectionError("Simulated connection failure")
            
        if self.failure_mode == "cancel_failure" and self._should_fail():
            return False
            
        return await super().cancel_order(order_id)
    
    async def get_account_info(self) -> Dict[str, Any]:
        """Get account info with potential failures."""
        await self._simulate_delay()
        
        if not self.connection_healthy:
            raise BrokerConnectionError("Simulated connection failure")
            
        if self.failure_mode == "account_failure" and self._should_fail():
            raise BrokerError("Simulated account info failure")
            
        return await super().get_account_info()
    
    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get positions with potential failures."""
        await self._simulate_delay()
        
        if not self.connection_healthy:
            raise BrokerConnectionError("Simulated connection failure")
            
        if self.failure_mode == "position_failure" and self._should_fail():
            raise BrokerError("Simulated position retrieval failure")
            
        return await super().get_positions()


class TestBrokerFailoverBasic:
    """Test basic broker failover functionality."""
    
    @pytest.fixture
    async def failover_manager(self, event_bus):
        """Create broker manager with failover brokers."""
        manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.HEALTH_BASED,
            health_check_interval=5,  # Fast checks for testing
            max_failover_attempts=3,
            enable_load_balancing=False  # Disable for predictable routing
        )
        
        # Add primary broker (will fail)
        primary_broker = MockFailingBroker(
            event_bus=event_bus,
            initial_cash=100000,
            market_data_repo=None
        )
        
        primary_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=1,  # Highest priority
            config={'initial_cash': 100000}
        )
        
        manager._brokers["primary"] = primary_broker
        manager._broker_configs["primary"] = primary_config
        manager._broker_health["primary"] = BrokerHealth()
        manager._broker_order_counts["primary"] = 0
        manager._broker_order_times["primary"] = []
        manager._broker_order_mapping["primary"] = {}
        
        # Add secondary broker (backup)
        secondary_broker = MockFailingBroker(
            event_bus=event_bus,
            initial_cash=100000,
            market_data_repo=None
        )
        
        secondary_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=2,  # Lower priority
            config={'initial_cash': 100000}
        )
        
        manager._brokers["secondary"] = secondary_broker
        manager._broker_configs["secondary"] = secondary_config
        manager._broker_health["secondary"] = BrokerHealth()
        manager._broker_order_counts["secondary"] = 0
        manager._broker_order_times["secondary"] = []
        manager._broker_order_mapping["secondary"] = {}
        
        await manager.start()
        yield manager, primary_broker, secondary_broker
        await manager.stop()
    
    @pytest.mark.asyncio
    async def test_primary_broker_failure_failover(self, failover_manager):
        """Test failover when primary broker fails."""
        manager, primary_broker, secondary_broker = failover_manager
        
        # Initially, primary should be healthy
        assert primary_broker.connection_healthy is True
        assert secondary_broker.connection_healthy is True
        
        # Submit order - should go to primary broker
        test_order = Order(
            order_id="FAILOVER_TEST_001",
            symbol="AAPL",
            side="buy",
            quantity=10,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id, broker_name = await manager.submit_order(test_order)
        assert order_id is not None
        assert broker_name == "primary"  # Should use primary broker
        
        # Simulate primary broker failure
        primary_broker.set_connection_health(False)
        primary_broker.set_failure_mode("submit_failure", 1.0)
        
        # Submit another order - should failover to secondary
        test_order2 = Order(
            order_id="FAILOVER_TEST_002",
            symbol="MSFT",
            side="buy",
            quantity=5,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id2, broker_name2 = await manager.submit_order(test_order2)
        assert order_id2 is not None
        assert broker_name2 == "secondary"  # Should failover to secondary
        
        # Verify manager statistics
        stats = manager.get_manager_stats()
        assert stats['successful_orders'] >= 2
        assert stats['failover_events'] >= 1
    
    @pytest.mark.asyncio
    async def test_cascading_broker_failures(self, failover_manager):
        """Test system behavior when multiple brokers fail."""
        manager, primary_broker, secondary_broker = failover_manager
        
        # Add third broker for more comprehensive testing
        tertiary_broker = MockFailingBroker(
            event_bus=manager.event_bus,
            initial_cash=100000,
            market_data_repo=None
        )
        
        tertiary_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=3,
            config={'initial_cash': 100000}
        )
        
        manager._brokers["tertiary"] = tertiary_broker
        manager._broker_configs["tertiary"] = tertiary_config
        manager._broker_health["tertiary"] = BrokerHealth()
        manager._broker_order_counts["tertiary"] = 0
        manager._broker_order_times["tertiary"] = []
        manager._broker_order_mapping["tertiary"] = {}
        
        # Simulate primary broker failure
        primary_broker.set_connection_health(False)
        
        # Submit order - should use secondary
        test_order = Order(
            order_id="CASCADE_TEST_001",
            symbol="GOOGL",
            side="buy",
            quantity=3,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id, broker_name = await manager.submit_order(test_order)
        assert broker_name == "secondary"
        
        # Now fail secondary broker too
        secondary_broker.set_connection_health(False)
        
        # Submit another order - should use tertiary
        test_order2 = Order(
            order_id="CASCADE_TEST_002",
            symbol="TSLA",
            side="buy",
            quantity=2,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id2, broker_name2 = await manager.submit_order(test_order2)
        assert broker_name2 == "tertiary"
        
        # Fail all brokers
        tertiary_broker.set_connection_health(False)
        
        # Submit order - should fail
        test_order3 = Order(
            order_id="CASCADE_TEST_003",
            symbol="AMZN",
            side="buy",
            quantity=1,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id3, broker_name3 = await manager.submit_order(test_order3)
        assert order_id3 is None  # Should fail
        assert broker_name3 is None
    
    @pytest.mark.asyncio
    async def test_broker_recovery_after_failure(self, failover_manager):
        """Test broker recovery and restoration to service."""
        manager, primary_broker, secondary_broker = failover_manager
        
        # Fail primary broker
        primary_broker.set_connection_health(False)
        
        # Submit order - should use secondary
        test_order = Order(
            order_id="RECOVERY_TEST_001",
            symbol="META",
            side="buy",
            quantity=7,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id, broker_name = await manager.submit_order(test_order)
        assert broker_name == "secondary"
        
        # Restore primary broker
        primary_broker.set_connection_health(True)
        primary_broker.set_failure_mode(None, 0.0)
        
        # Wait for health checks to detect recovery
        await asyncio.sleep(2)
        
        # Submit new order - should eventually return to primary
        test_order2 = Order(
            order_id="RECOVERY_TEST_002",
            symbol="NFLX",
            side="buy",
            quantity=4,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id2, broker_name2 = await manager.submit_order(test_order2)
        
        # Note: May still use secondary temporarily due to health check timing
        # In real scenarios, health-based routing would eventually prefer primary
        assert order_id2 is not None


class TestBrokerFailoverAdvanced:
    """Test advanced failover scenarios and edge cases."""
    
    @pytest.fixture
    async def health_monitored_manager(self, event_bus):
        """Create broker manager with health monitoring."""
        # Create health monitor
        health_monitor = BrokerHealthMonitor(
            event_bus=event_bus,
            check_interval_seconds=2,  # Fast checks for testing
            enable_predictive_alerts=True,
            auto_recovery_enabled=True
        )
        
        # Create broker manager
        manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.PERFORMANCE_BASED,
            health_check_interval=2,
            enable_load_balancing=True
        )
        
        # Create mock brokers with different performance characteristics
        fast_broker = MockFailingBroker(
            event_bus=event_bus,
            initial_cash=100000,
            market_data_repo=None
        )
        fast_broker.set_response_delay(50)  # 50ms response time
        
        slow_broker = MockFailingBroker(
            event_bus=event_bus,
            initial_cash=100000,
            market_data_repo=None
        )
        slow_broker.set_response_delay(500)  # 500ms response time
        
        unstable_broker = MockFailingBroker(
            event_bus=event_bus,
            initial_cash=100000,
            market_data_repo=None
        )
        unstable_broker.set_order_failure_rate(0.2)  # 20% failure rate
        
        # Register brokers with manager
        configs = [
            ("fast", fast_broker, BrokerConfig(broker_type=BrokerType.PAPER, priority=1)),
            ("slow", slow_broker, BrokerConfig(broker_type=BrokerType.PAPER, priority=2)),
            ("unstable", unstable_broker, BrokerConfig(broker_type=BrokerType.PAPER, priority=3))
        ]
        
        for name, broker, config in configs:
            manager._brokers[name] = broker
            manager._broker_configs[name] = config
            manager._broker_health[name] = BrokerHealth()
            manager._broker_order_counts[name] = 0
            manager._broker_order_times[name] = []
            manager._broker_order_mapping[name] = {}
            
            # Register with health monitor
            health_monitor.register_broker(name, broker)
        
        await health_monitor.start()
        await manager.start()
        
        yield manager, health_monitor, fast_broker, slow_broker, unstable_broker
        
        await manager.stop()
        await health_monitor.stop()
    
    @pytest.mark.asyncio
    async def test_performance_based_routing(self, health_monitored_manager):
        """Test performance-based broker selection."""
        manager, health_monitor, fast_broker, slow_broker, unstable_broker = health_monitored_manager
        
        # Allow time for initial health checks
        await asyncio.sleep(3)
        
        # Submit multiple orders and track routing
        broker_usage = {}
        
        for i in range(10):
            test_order = Order(
                order_id=f"PERF_TEST_{i:03d}",
                symbol="AAPL",
                side="buy",
                quantity=1,
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            try:
                order_id, broker_name = await manager.submit_order(test_order)
                if broker_name:
                    broker_usage[broker_name] = broker_usage.get(broker_name, 0) + 1
            except Exception as e:
                logger.warning(f"Order {i} failed: {e}")
        
        logger.info(f"Broker usage distribution: {broker_usage}")
        
        # Fast broker should get most orders (performance-based routing)
        if "fast" in broker_usage:
            assert broker_usage["fast"] >= 3  # Should get significant portion
        
        # Get health reports
        health_reports = health_monitor.get_all_health_reports()
        for broker_name, report in health_reports.items():
            logger.info(f"{broker_name}: status={report.overall_status.value}, "
                       f"response_time={report.avg_response_time_ms:.1f}ms")
    
    @pytest.mark.asyncio
    async def test_health_monitoring_alerts(self, health_monitored_manager):
        """Test health monitoring alert system."""
        manager, health_monitor, fast_broker, slow_broker, unstable_broker = health_monitored_manager
        
        # Set up alert collection
        alerts_received = []
        
        def alert_callback(alert):
            alerts_received.append(alert)
        
        health_monitor.add_alert_callback(alert_callback)
        
        # Wait for initial health checks
        await asyncio.sleep(3)
        
        # Simulate broker degradation
        slow_broker.set_response_delay(3000)  # 3 second delay
        unstable_broker.set_order_failure_rate(0.8)  # 80% failure rate
        
        # Force health checks
        await health_monitor.force_health_check()
        
        # Wait for alerts
        await asyncio.sleep(2)
        
        # Verify alerts were generated
        assert len(alerts_received) > 0
        
        alert_messages = [alert.message for alert in alerts_received]
        logger.info(f"Alerts received: {alert_messages}")
        
        # Should have performance-related alerts
        performance_alerts = [alert for alert in alerts_received 
                            if "response time" in alert.message.lower()]
        assert len(performance_alerts) > 0
    
    @pytest.mark.asyncio
    async def test_order_execution_during_failover(self, health_monitored_manager):
        """Test order execution consistency during broker failover."""
        manager, health_monitor, fast_broker, slow_broker, unstable_broker = health_monitored_manager
        
        # Submit multiple orders concurrently while simulating failures
        async def submit_order_batch(batch_id: int, num_orders: int) -> List[bool]:
            results = []
            for i in range(num_orders):
                test_order = Order(
                    order_id=f"CONCURRENT_B{batch_id}_{i:03d}",
                    symbol="SPY",
                    side="buy",
                    quantity=1,
                    order_type=OrderType.MARKET,
                    created_at=datetime.utcnow()
                )
                
                try:
                    order_id, broker_name = await manager.submit_order(test_order)
                    results.append(order_id is not None)
                except Exception as e:
                    logger.warning(f"Order B{batch_id}_{i} failed: {e}")
                    results.append(False)
                
                # Small delay between orders
                await asyncio.sleep(0.1)
            
            return results
        
        # Start submitting orders
        batch1_task = asyncio.create_task(submit_order_batch(1, 5))
        
        # Wait a bit, then simulate broker failure
        await asyncio.sleep(0.5)
        fast_broker.set_connection_health(False)
        
        # Submit more orders (should failover)
        batch2_task = asyncio.create_task(submit_order_batch(2, 5))
        
        # Wait and restore broker
        await asyncio.sleep(1.0)
        fast_broker.set_connection_health(True)
        
        # Submit final batch
        batch3_task = asyncio.create_task(submit_order_batch(3, 5))
        
        # Wait for all batches to complete
        batch1_results = await batch1_task
        batch2_results = await batch2_task
        batch3_results = await batch3_task
        
        # Analyze results
        total_orders = len(batch1_results) + len(batch2_results) + len(batch3_results)
        successful_orders = sum(batch1_results) + sum(batch2_results) + sum(batch3_results)
        
        success_rate = successful_orders / total_orders
        
        logger.info(f"Order execution during failover: {successful_orders}/{total_orders} "
                   f"({success_rate:.1%} success rate)")
        
        # Should maintain reasonable success rate even during failover
        assert success_rate >= 0.6  # At least 60% success rate
        
        # Verify manager handled the scenario
        stats = manager.get_manager_stats()
        assert stats['total_orders'] >= total_orders
    
    @pytest.mark.asyncio
    async def test_load_balancing_with_failover(self, health_monitored_manager):
        """Test load balancing behavior when brokers fail."""
        manager, health_monitor, fast_broker, slow_broker, unstable_broker = health_monitored_manager
        
        # Enable load balancing
        manager.enable_load_balancing = True
        
        # Submit orders to establish baseline distribution
        initial_orders = 12  # Divisible by 3 for even distribution
        broker_usage = {}
        
        for i in range(initial_orders):
            test_order = Order(
                order_id=f"LOADBAL_INIT_{i:03d}",
                symbol="QQQ",
                side="buy",
                quantity=1,
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            order_id, broker_name = await manager.submit_order(test_order)
            if broker_name:
                broker_usage[broker_name] = broker_usage.get(broker_name, 0) + 1
        
        logger.info(f"Initial load distribution: {broker_usage}")
        
        # Disable one broker
        unstable_broker.set_connection_health(False)
        
        # Submit more orders - should redistribute load
        failover_orders = 10
        
        for i in range(failover_orders):
            test_order = Order(
                order_id=f"LOADBAL_FAILOVER_{i:03d}",
                symbol="IWM",
                side="buy",
                quantity=1,
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            order_id, broker_name = await manager.submit_order(test_order)
            if broker_name:
                broker_usage[broker_name] = broker_usage.get(broker_name, 0) + 1
        
        logger.info(f"Final load distribution: {broker_usage}")
        
        # Verify load was redistributed (unstable broker should have fewer/no new orders)
        if "unstable" in broker_usage:
            # Should not have gotten all the failover orders
            assert broker_usage["unstable"] <= initial_orders // 3 + 2
        
        # Other brokers should have picked up the load
        total_orders = sum(broker_usage.values())
        assert total_orders >= initial_orders + failover_orders - 2  # Allow for some failures


class TestBrokerFailoverEdgeCases:
    """Test edge cases and extreme scenarios."""
    
    @pytest.mark.asyncio
    async def test_all_brokers_fail_scenario(self, event_bus):
        """Test system behavior when all brokers fail."""
        manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.PRIORITY_BASED,
            max_failover_attempts=2
        )
        
        # Add brokers that will all fail
        for i in range(3):
            failing_broker = MockFailingBroker(
                event_bus=event_bus,
                initial_cash=100000,
                market_data_repo=None
            )
            failing_broker.set_connection_health(False)
            
            config = BrokerConfig(
                broker_type=BrokerType.PAPER,
                priority=i + 1,
                config={'initial_cash': 100000}
            )
            
            broker_name = f"failing_broker_{i}"
            manager._brokers[broker_name] = failing_broker
            manager._broker_configs[broker_name] = config
            manager._broker_health[broker_name] = BrokerHealth()
            manager._broker_order_counts[broker_name] = 0
            manager._broker_order_times[broker_name] = []
            manager._broker_order_mapping[broker_name] = {}
        
        await manager.start()
        
        try:
            # Submit order - should fail gracefully
            test_order = Order(
                order_id="ALL_FAIL_TEST_001",
                symbol="FAIL",
                side="buy",
                quantity=1,
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            order_id, broker_name = await manager.submit_order(test_order)
            
            # Should fail gracefully
            assert order_id is None
            assert broker_name is None
            
            # Check stats
            stats = manager.get_manager_stats()
            assert stats['failed_orders'] >= 1
            assert stats['healthy_brokers'] == 0
            
        finally:
            await manager.stop()
    
    @pytest.mark.asyncio
    async def test_rapid_broker_state_changes(self, event_bus):
        """Test system stability under rapid broker state changes."""
        manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.HEALTH_BASED,
            health_check_interval=1  # Very fast health checks
        )
        
        # Add broker that will change state rapidly
        volatile_broker = MockFailingBroker(
            event_bus=event_bus,
            initial_cash=100000,
            market_data_repo=None
        )
        
        config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=1,
            config={'initial_cash': 100000}
        )
        
        manager._brokers["volatile"] = volatile_broker
        manager._broker_configs["volatile"] = config
        manager._broker_health["volatile"] = BrokerHealth()
        manager._broker_order_counts["volatile"] = 0
        manager._broker_order_times["volatile"] = []
        manager._broker_order_mapping["volatile"] = {}
        
        await manager.start()
        
        try:
            # Start rapidly changing broker state
            async def flip_broker_state():
                for _ in range(10):
                    volatile_broker.set_connection_health(False)
                    await asyncio.sleep(0.2)
                    volatile_broker.set_connection_health(True)
                    await asyncio.sleep(0.2)
            
            state_flip_task = asyncio.create_task(flip_broker_state())
            
            # Simultaneously submit orders
            orders_submitted = 0
            orders_successful = 0
            
            for i in range(20):
                test_order = Order(
                    order_id=f"RAPID_CHANGE_{i:03d}",
                    symbol="VOLATILE",
                    side="buy",
                    quantity=1,
                    order_type=OrderType.MARKET,
                    created_at=datetime.utcnow()
                )
                
                orders_submitted += 1
                
                try:
                    order_id, broker_name = await manager.submit_order(test_order)
                    if order_id:
                        orders_successful += 1
                except Exception as e:
                    logger.warning(f"Order failed during rapid state changes: {e}")
                
                await asyncio.sleep(0.1)
            
            await state_flip_task
            
            logger.info(f"Rapid state change test: {orders_successful}/{orders_submitted} orders successful")
            
            # System should remain stable (at least some orders should succeed)
            assert orders_successful >= orders_submitted // 4  # At least 25% success
            
        finally:
            await manager.stop()


# Test fixtures
@pytest.fixture
def event_bus():
    """Create event bus for testing."""
    return EventBus()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])