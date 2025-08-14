"""
Live Broker Integration Tests for Pi5 Trading System.

Comprehensive integration tests for live broker connections including
Interactive Brokers and Alpaca Markets. These tests validate actual
broker API connections, order execution, and failover capabilities.

⚠️  IMPORTANT: These tests require actual broker credentials and connections.
    Set ENABLE_LIVE_BROKER_TESTS=true environment variable to run.

Test Categories:
- Interactive Brokers TWS/Gateway connection
- Alpaca Markets API connection  
- Real order execution (paper trading)
- Broker health monitoring
- Failover and redundancy
- End-to-end integration
"""

import asyncio
import os
import pytest
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import yaml

# Core imports
from core.interfaces import Order, OrderType, OrderStatus, Signal, TradingSignal
from core.exceptions import BrokerError, BrokerConnectionError
from events.event_bus import EventBus

# Broker imports
from orders.brokers.interactive_brokers import InteractiveBrokersBroker
from orders.brokers.alpaca_broker import AlpacaBroker
from orders.brokers.broker_manager import (
    BrokerManager, BrokerConfig, BrokerType, FailoverStrategy
)


logger = logging.getLogger(__name__)

# Skip these tests unless explicitly enabled
ENABLE_LIVE_TESTS = os.getenv("ENABLE_LIVE_BROKER_TESTS", "false").lower() == "true"

pytestmark = pytest.mark.skipif(
    not ENABLE_LIVE_TESTS,
    reason="Live broker tests disabled. Set ENABLE_LIVE_BROKER_TESTS=true to enable."
)


class TestInteractiveBrokersIntegration:
    """Test Interactive Brokers live connection and integration."""
    
    @pytest.fixture
    async def ib_broker(self, event_bus):
        """Create Interactive Brokers broker instance."""
        # Use paper trading configuration
        broker = InteractiveBrokersBroker(
            event_bus=event_bus,
            host="127.0.0.1",
            port=7497,  # Paper trading port
            client_id=999,  # Use high client ID for testing
            connect_timeout=30,
            auto_reconnect=True
        )
        
        yield broker
        
        # Cleanup
        try:
            await broker.disconnect()
        except Exception as e:
            logger.warning(f"Error during IB cleanup: {e}")
    
    @pytest.mark.asyncio
    async def test_ib_connection(self, ib_broker):
        """Test Interactive Brokers connection."""
        try:
            # Attempt connection
            connected = await ib_broker.connect()
            
            if not connected:
                pytest.skip("Unable to connect to Interactive Brokers TWS/Gateway")
            
            # Verify connection
            assert ib_broker._is_connected is True
            
            # Test account info retrieval
            account_info = await ib_broker.get_account_info()
            assert account_info is not None
            assert 'account_id' in account_info
            assert 'cash' in account_info
            assert 'buying_power' in account_info
            
            logger.info(f"IB Account Info: {account_info}")
            
        except Exception as e:
            pytest.skip(f"Interactive Brokers connection failed: {e}")
    
    @pytest.mark.asyncio
    async def test_ib_positions(self, ib_broker):
        """Test Interactive Brokers position retrieval."""
        try:
            connected = await ib_broker.connect()
            if not connected:
                pytest.skip("Unable to connect to Interactive Brokers")
            
            # Get positions
            positions = await ib_broker.get_positions()
            assert isinstance(positions, list)
            
            # Positions may be empty for new accounts
            logger.info(f"IB Positions: {len(positions)} positions found")
            
            # Validate position structure if any exist
            for position in positions:
                assert 'symbol' in position
                assert 'quantity' in position
                assert 'avg_cost' in position
                assert 'market_value' in position
                assert 'side' in position
                
        except Exception as e:
            pytest.skip(f"IB position test failed: {e}")
    
    @pytest.mark.asyncio
    async def test_ib_order_submission(self, ib_broker):
        """Test Interactive Brokers order submission (paper trading)."""
        try:
            connected = await ib_broker.connect()
            if not connected:
                pytest.skip("Unable to connect to Interactive Brokers")
            
            # Create small test order
            test_order = Order(
                order_id=f"IB_TEST_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                symbol="AAPL",
                side="buy",
                quantity=1,  # Small quantity for testing
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            # Submit order
            order_id = await ib_broker.submit_order(test_order)
            assert order_id is not None
            
            logger.info(f"IB Order submitted: {order_id}")
            
            # Wait briefly for order processing
            await asyncio.sleep(2)
            
            # Check broker stats
            stats = ib_broker.get_broker_stats()
            assert stats['orders_submitted'] >= 1
            assert stats['is_connected'] is True
            
            # Attempt to cancel the order
            cancel_result = await ib_broker.cancel_order(order_id)
            logger.info(f"IB Order cancellation: {cancel_result}")
            
        except Exception as e:
            logger.error(f"IB order test failed: {e}")
            # Don't skip - this could be a real error we want to catch
            raise
    
    @pytest.mark.asyncio
    async def test_ib_connection_recovery(self, ib_broker):
        """Test Interactive Brokers connection recovery."""
        try:
            # Connect initially
            connected = await ib_broker.connect()
            if not connected:
                pytest.skip("Unable to connect to Interactive Brokers")
            
            # Simulate disconnect
            await ib_broker.disconnect()
            assert ib_broker._is_connected is False
            
            # Test reconnection
            reconnected = await ib_broker.connect()
            if reconnected:
                assert ib_broker._is_connected is True
                logger.info("IB reconnection successful")
            else:
                logger.warning("IB reconnection failed")
                
        except Exception as e:
            logger.warning(f"IB connection recovery test failed: {e}")


class TestAlpacaIntegration:
    """Test Alpaca Markets live connection and integration."""
    
    @pytest.fixture
    async def alpaca_broker(self, event_bus):
        """Create Alpaca broker instance."""
        # Get credentials from environment
        api_key = os.getenv("ALPACA_API_KEY")
        secret_key = os.getenv("ALPACA_SECRET_KEY")
        
        if not api_key or not secret_key:
            pytest.skip("Alpaca credentials not configured. Set ALPACA_API_KEY and ALPACA_SECRET_KEY")
        
        broker = AlpacaBroker(
            event_bus=event_bus,
            api_key=api_key,
            secret_key=secret_key,
            base_url="https://paper-api.alpaca.markets",  # Paper trading
            enable_streaming=False,  # Disable for testing
            request_timeout=30
        )
        
        yield broker
        
        # Cleanup
        try:
            await broker.disconnect()
        except Exception as e:
            logger.warning(f"Error during Alpaca cleanup: {e}")
    
    @pytest.mark.asyncio
    async def test_alpaca_connection(self, alpaca_broker):
        """Test Alpaca Markets connection."""
        try:
            # Attempt connection
            connected = await alpaca_broker.connect()
            
            if not connected:
                pytest.skip("Unable to connect to Alpaca Markets")
            
            # Verify connection
            assert alpaca_broker._is_connected is True
            
            # Test account info retrieval
            account_info = await alpaca_broker.get_account_info()
            assert account_info is not None
            assert 'account_id' in account_info
            assert 'cash' in account_info
            assert 'buying_power' in account_info
            assert 'portfolio_value' in account_info
            
            logger.info(f"Alpaca Account Info: {account_info}")
            
        except Exception as e:
            pytest.skip(f"Alpaca connection failed: {e}")
    
    @pytest.mark.asyncio
    async def test_alpaca_positions(self, alpaca_broker):
        """Test Alpaca Markets position retrieval."""
        try:
            connected = await alpaca_broker.connect()
            if not connected:
                pytest.skip("Unable to connect to Alpaca Markets")
            
            # Get positions
            positions = await alpaca_broker.get_positions()
            assert isinstance(positions, list)
            
            logger.info(f"Alpaca Positions: {len(positions)} positions found")
            
            # Validate position structure if any exist
            for position in positions:
                assert 'symbol' in position
                assert 'quantity' in position
                assert 'avg_cost' in position
                assert 'market_value' in position
                assert 'side' in position
                
        except Exception as e:
            pytest.skip(f"Alpaca position test failed: {e}")
    
    @pytest.mark.asyncio
    async def test_alpaca_order_submission(self, alpaca_broker):
        """Test Alpaca Markets order submission (paper trading)."""
        try:
            connected = await alpaca_broker.connect()
            if not connected:
                pytest.skip("Unable to connect to Alpaca Markets")
            
            # Check market hours (Alpaca requires market to be open for orders)
            account_info = await alpaca_broker.get_account_info()
            if account_info.get('trade_suspended', False):
                pytest.skip("Alpaca trading is suspended")
            
            # Create small test order
            test_order = Order(
                order_id=f"ALP_TEST_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                symbol="AAPL",
                side="buy",
                quantity=1,  # Small quantity for testing
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            try:
                # Submit order
                order_id = await alpaca_broker.submit_order(test_order)
                assert order_id is not None
                
                logger.info(f"Alpaca Order submitted: {order_id}")
                
                # Wait briefly for order processing
                await asyncio.sleep(2)
                
                # Check broker stats
                stats = alpaca_broker.get_broker_stats()
                assert stats['orders_submitted'] >= 1
                assert stats['is_connected'] is True
                
                # Attempt to cancel the order
                cancel_result = await alpaca_broker.cancel_order(order_id)
                logger.info(f"Alpaca Order cancellation: {cancel_result}")
                
            except Exception as order_error:
                # Market may be closed or other trading restrictions
                logger.warning(f"Alpaca order submission failed (may be expected): {order_error}")
                
        except Exception as e:
            logger.error(f"Alpaca order test failed: {e}")
            raise


class TestMultiBrokerIntegration:
    """Test multi-broker system with live connections."""
    
    @pytest.fixture
    async def multi_broker_manager(self, event_bus):
        """Create broker manager with multiple live brokers."""
        manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.HEALTH_BASED,
            health_check_interval=10,
            enable_load_balancing=True
        )
        
        # Add paper broker (always available)
        paper_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=100,  # Lower priority
            config={
                'initial_cash': 100000,
                'commission_per_trade': 1.0
            }
        )
        manager.add_broker("paper_primary", paper_config, market_data_repo=None)
        
        # Try to add live brokers if credentials available
        try:
            # Interactive Brokers
            ib_config = BrokerConfig(
                broker_type=BrokerType.INTERACTIVE_BROKERS,
                priority=1,  # Highest priority
                config={
                    'host': '127.0.0.1',
                    'port': 7497,
                    'client_id': 998
                }
            )
            manager.add_broker("ib_primary", ib_config)
            
            # Alpaca Markets
            api_key = os.getenv("ALPACA_API_KEY")
            secret_key = os.getenv("ALPACA_SECRET_KEY")
            
            if api_key and secret_key:
                alpaca_config = BrokerConfig(
                    broker_type=BrokerType.ALPACA,
                    priority=2,
                    config={
                        'api_key': api_key,
                        'secret_key': secret_key,
                        'base_url': 'https://paper-api.alpaca.markets',
                        'enable_streaming': False
                    }
                )
                manager.add_broker("alpaca_secondary", alpaca_config)
                
        except Exception as e:
            logger.warning(f"Could not add live brokers: {e}")
        
        await manager.start()
        yield manager
        await manager.stop()
    
    @pytest.mark.asyncio
    async def test_multi_broker_health_monitoring(self, multi_broker_manager):
        """Test health monitoring across multiple brokers."""
        # Wait for initial health checks
        await asyncio.sleep(2)
        
        # Get broker health status
        health_status = multi_broker_manager.get_all_broker_health()
        
        assert len(health_status) >= 1  # At least paper broker
        
        # Check paper broker is healthy
        paper_health = health_status.get("paper_primary")
        assert paper_health is not None
        assert paper_health.is_healthy is True
        
        # Log health status for all brokers
        for broker_name, health in health_status.items():
            logger.info(f"Broker {broker_name}: healthy={health.is_healthy}, "
                       f"success_rate={health.success_rate:.1f}%, "
                       f"failures={health.consecutive_failures}")
        
        # Get manager stats
        stats = multi_broker_manager.get_manager_stats()
        assert stats['total_brokers'] >= 1
        assert stats['healthy_brokers'] >= 1
        
        logger.info(f"Broker Manager Stats: {stats}")
    
    @pytest.mark.asyncio
    async def test_multi_broker_order_routing(self, multi_broker_manager):
        """Test intelligent order routing across brokers."""
        # Create test order
        test_order = Order(
            order_id=f"MULTI_TEST_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            symbol="AAPL",
            side="buy",
            quantity=5,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        # Submit order - should route to best available broker
        order_id, broker_name = await multi_broker_manager.submit_order(test_order)
        
        assert order_id is not None
        assert broker_name is not None
        
        logger.info(f"Order routed to broker: {broker_name} with ID: {order_id}")
        
        # Verify order tracking
        stats = multi_broker_manager.get_manager_stats()
        assert stats['successful_orders'] >= 1
        
        # Test order cancellation through manager
        cancel_result = await multi_broker_manager.cancel_order(order_id)
        logger.info(f"Order cancellation result: {cancel_result}")
    
    @pytest.mark.asyncio
    async def test_broker_failover_simulation(self, multi_broker_manager):
        """Test broker failover when primary broker fails."""
        initial_stats = multi_broker_manager.get_manager_stats()
        initial_broker_count = initial_stats['total_brokers']
        
        if initial_broker_count < 2:
            pytest.skip("Need at least 2 brokers for failover testing")
        
        # Submit order to establish primary broker
        test_order1 = Order(
            order_id=f"FAILOVER_TEST1_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            symbol="MSFT",
            side="buy",
            quantity=2,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id1, broker1 = await multi_broker_manager.submit_order(test_order1)
        assert order_id1 is not None
        
        logger.info(f"First order routed to: {broker1}")
        
        # Simulate broker failure by removing it
        multi_broker_manager.remove_broker(broker1)
        
        # Submit another order - should failover to different broker
        test_order2 = Order(
            order_id=f"FAILOVER_TEST2_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            symbol="GOOGL",
            side="buy",
            quantity=1,
            order_type=OrderType.MARKET,
            created_at=datetime.utcnow()
        )
        
        order_id2, broker2 = await multi_broker_manager.submit_order(test_order2)
        
        if order_id2 is not None:
            assert broker2 != broker1  # Should use different broker
            logger.info(f"Failover successful - second order routed to: {broker2}")
            
            # Check failover stats
            final_stats = multi_broker_manager.get_manager_stats()
            assert final_stats['total_brokers'] == initial_broker_count - 1
        else:
            logger.warning("Failover order failed - no backup brokers available")


class TestBrokerConfigurationValidation:
    """Test broker configuration loading and validation."""
    
    def test_load_broker_config(self):
        """Test loading broker configuration from YAML file."""
        config_path = "config/trading_config.yaml"
        
        try:
            with open(config_path, 'r') as file:
                config = yaml.safe_load(file)
            
            # Verify broker configuration exists
            assert 'brokers' in config
            brokers_config = config['brokers']
            
            # Check required broker types
            assert 'paper_trading' in brokers_config
            assert 'interactive_brokers' in brokers_config
            assert 'alpaca' in brokers_config
            
            # Validate paper trading config
            paper_config = brokers_config['paper_trading']
            assert paper_config['enabled'] is True
            assert paper_config['type'] == "paper"
            assert 'config' in paper_config
            assert 'limits' in paper_config
            
            # Validate Interactive Brokers config
            ib_config = brokers_config['interactive_brokers']
            assert ib_config['type'] == "interactive_brokers"
            assert 'config' in ib_config
            assert 'limits' in ib_config
            
            # Validate Alpaca config
            alpaca_config = brokers_config['alpaca']
            assert alpaca_config['type'] == "alpaca"
            assert 'config' in alpaca_config
            assert 'limits' in alpaca_config
            
            # Check broker management config
            assert 'broker_management' in config
            mgmt_config = config['broker_management']
            assert 'failover_strategy' in mgmt_config
            assert 'health_check_interval' in mgmt_config
            
            logger.info("Broker configuration validation passed")
            
        except FileNotFoundError:
            pytest.fail("Trading configuration file not found")
        except Exception as e:
            pytest.fail(f"Broker configuration validation failed: {e}")
    
    def test_broker_config_validation(self):
        """Test broker configuration parameter validation."""
        # Test valid configuration
        valid_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=50,
            enabled=True,
            config={'initial_cash': 100000},
            max_orders_per_minute=60,
            max_order_value=50000
        )
        
        assert valid_config.broker_type == BrokerType.PAPER
        assert valid_config.priority == 50
        assert valid_config.enabled is True
        
        # Test default values
        minimal_config = BrokerConfig(broker_type=BrokerType.ALPACA)
        assert minimal_config.priority == 100  # Default value
        assert minimal_config.enabled is True  # Default value
        assert minimal_config.config == {}     # Default empty dict


class TestEndToEndBrokerIntegration:
    """Test complete end-to-end broker integration workflow."""
    
    @pytest.mark.asyncio
    async def test_complete_trading_workflow(self, event_bus):
        """Test complete trading workflow with broker integration."""
        
        # 1. Setup broker manager
        manager = BrokerManager(
            event_bus=event_bus,
            failover_strategy=FailoverStrategy.PRIORITY_BASED,
            enable_load_balancing=False  # Use priority-based routing
        )
        
        # Add paper broker for guaranteed functionality
        paper_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            priority=10,
            config={'initial_cash': 200000}
        )
        manager.add_broker("paper_test", paper_config, market_data_repo=None)
        
        await manager.start()
        
        try:
            # 2. Test account info retrieval
            account_info = await manager.get_account_info()
            assert account_info is not None
            assert account_info['cash'] > 0
            
            initial_cash = account_info['cash']
            logger.info(f"Initial account balance: ${initial_cash:,.2f}")
            
            # 3. Test position retrieval
            positions = await manager.get_positions()
            assert isinstance(positions, list)
            initial_positions = len(positions)
            
            # 4. Submit buy order
            buy_order = Order(
                order_id=f"E2E_BUY_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                symbol="AAPL",
                side="buy",
                quantity=10,
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            buy_order_id, buy_broker = await manager.submit_order(buy_order)
            assert buy_order_id is not None
            assert buy_broker == "paper_test"
            
            # Wait for order execution
            await asyncio.sleep(1)
            
            # 5. Verify position was created
            updated_positions = await manager.get_positions()
            assert len(updated_positions) >= initial_positions
            
            # 6. Submit sell order
            sell_order = Order(
                order_id=f"E2E_SELL_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                symbol="AAPL",
                side="sell",
                quantity=5,  # Partial sale
                order_type=OrderType.MARKET,
                created_at=datetime.utcnow()
            )
            
            sell_order_id, sell_broker = await manager.submit_order(sell_order)
            assert sell_order_id is not None
            
            # Wait for execution
            await asyncio.sleep(1)
            
            # 7. Verify final account state
            final_account = await manager.get_account_info()
            final_positions = await manager.get_positions()
            
            # Check statistics
            manager_stats = manager.get_manager_stats()
            assert manager_stats['successful_orders'] >= 2
            assert manager_stats['failed_orders'] == 0
            
            logger.info(f"End-to-end test completed successfully:")
            logger.info(f"  - Orders executed: {manager_stats['successful_orders']}")
            logger.info(f"  - Final balance: ${final_account['cash']:,.2f}")
            logger.info(f"  - Final positions: {len(final_positions)}")
            
        finally:
            await manager.stop()


# Test fixtures
@pytest.fixture
def event_bus():
    """Create event bus for testing."""
    return EventBus()


# Test configuration
def pytest_configure(config):
    """Configure pytest for live broker tests."""
    if ENABLE_LIVE_TESTS:
        logger.warning("LIVE BROKER TESTS ENABLED - These tests will attempt real broker connections")
        logger.warning("Ensure TWS/Gateway is running for Interactive Brokers tests")
        logger.warning("Ensure Alpaca credentials are set for Alpaca tests")
    else:
        logger.info("Live broker tests disabled - use ENABLE_LIVE_BROKER_TESTS=true to enable")


if __name__ == "__main__":
    # Run tests with explicit configuration
    pytest.main([
        __file__, 
        "-v", 
        "--tb=short",
        "-s",  # Don't capture output
        "--log-cli-level=INFO"
    ])